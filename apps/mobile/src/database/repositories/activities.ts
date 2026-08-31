import type { DatabaseAdapter } from '../adapter';
import type { Activity, ActivityStatusSlug, ActivityTypeSlug } from '../types';
import { withTransaction } from '../transaction';
import { LookupRepository } from './lookups';
import { dates, now } from './mappers';

export interface CreateActivityInput { user_id: number; activity_type_slug: ActivityTypeSlug; started_at: Date; training_session_id?: number | null; training_session_name?: string | null }
export interface ActivityMetrics { finished_at?: Date | null; activity_status_slug?: ActivityStatusSlug; elapsed_duration_seconds: number; moving_duration_seconds: number; distance_meters: number; average_pace_seconds_per_km?: number | null; best_pace_seconds_per_km?: number | null }

export class ActivitiesRepository {
  constructor(private readonly database: DatabaseAdapter, private readonly lookups = new LookupRepository(database)) {}
  private map(row: Record<string, unknown>): Activity { return dates(row) as unknown as Activity; }
  async criar(input: CreateActivityInput, at = new Date()): Promise<Activity> {
    const typeId = await this.lookups.idPorSlug('activity_types', input.activity_type_slug);
    const statusId = await this.lookups.idPorSlug('activity_statuses', 'in_progress');
    let trainingName = input.training_session_name ?? null;
    if (input.training_session_id != null && trainingName === null) {
      const [training] = await this.database.all<{ name: string }>('SELECT name FROM training_sessions WHERE id=?', [input.training_session_id]);
      if (!training) throw new Error(`Treino não encontrado: ${input.training_session_id}`);
      trainingName = training.name;
    }
    const result = await this.database.run('INSERT INTO activities(user_id,activity_type_id,activity_status_id,training_session_id,training_session_name,started_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)', [input.user_id, typeId, statusId, input.training_session_id ?? null, trainingName, now(input.started_at), now(at), now(at)]);
    return (await this.buscarPorId(result.lastInsertRowId))!;
  }
  async buscarPorId(id: number): Promise<Activity | null> { const [row] = await this.database.all<Record<string, unknown>>('SELECT * FROM activities WHERE id=?', [id]); return row ? this.map(row) : null; }
  async buscarEmAndamento(): Promise<Activity | null> { const [row] = await this.database.all<Record<string, unknown>>('SELECT * FROM activities WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1'); return row ? this.map(row) : null; }
  async listarFinalizadas(): Promise<Activity[]> { return (await this.database.all<Record<string, unknown>>('SELECT * FROM activities WHERE finished_at IS NOT NULL ORDER BY started_at DESC')).map(row => this.map(row)); }
  async atualizarMetricas(id: number, metrics: ActivityMetrics, at = new Date()): Promise<void> {
    const statusId = metrics.activity_status_slug ? await this.lookups.idPorSlug('activity_statuses', metrics.activity_status_slug) : null;
    const result = await this.database.run(`UPDATE activities SET elapsed_duration_seconds=?,moving_duration_seconds=?,distance_meters=?,average_pace_seconds_per_km=?,best_pace_seconds_per_km=?,finished_at=COALESCE(?,finished_at),activity_status_id=COALESCE(?,activity_status_id),updated_at=? WHERE id=? AND finished_at IS NULL`, [metrics.elapsed_duration_seconds, metrics.moving_duration_seconds, metrics.distance_meters, metrics.average_pace_seconds_per_km ?? null, metrics.best_pace_seconds_per_km ?? null, metrics.finished_at ? now(metrics.finished_at) : null, statusId, now(at), id]);
    if (!result.changes) throw new Error('Atividade finalizada não permite alterar métricas objetivas');
  }
  async atualizarStatus(id: number, status: ActivityStatusSlug, at = new Date()): Promise<void> {
    const statusId = await this.lookups.idPorSlug('activity_statuses', status);
    const result = await this.database.run('UPDATE activities SET activity_status_id=?,updated_at=? WHERE id=? AND finished_at IS NULL', [statusId, now(at), id]);
    if (!result.changes) throw new Error('Atividade finalizada nÃ£o permite transiÃ§Ã£o');
  }
  async atualizarAvaliacao(id: number, rpe: number | null, notes: string | null, at = new Date()): Promise<void> {
    if (rpe !== null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) throw new Error('RPE deve estar entre 1 e 10');
    await this.database.run('UPDATE activities SET rpe=?,notes=?,updated_at=? WHERE id=?', [rpe, notes, now(at), id]);
  }
  async excluir(id: number): Promise<void> { await withTransaction(this.database, tx => tx.run('DELETE FROM activities WHERE id=?', [id]).then(() => undefined)); }
}
