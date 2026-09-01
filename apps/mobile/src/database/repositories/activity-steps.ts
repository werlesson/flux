import type { DatabaseAdapter } from '../adapter';
import type { ActivityStep, StepExecutionStatusSlug } from '../types';
import { withTransaction } from '../transaction';
import { LookupRepository } from './lookups';
import { dates, now } from './mappers';

export interface ActivityStepSnapshot { training_step_id?: number | null; step_type_id: number; instructions?: string | null; planned_duration_seconds: number; position: number; repetition_index: number; started_at?: Date | null }
export interface ActivityStepResult extends ActivityStep { step_type_name: string; step_type_slug: string; status_slug: StepExecutionStatusSlug }

export class ActivityStepsRepository {
  constructor(private readonly database: DatabaseAdapter, private readonly lookups = new LookupRepository(database)) {}
  async criarSnapshot(activityId: number, steps: ActivityStepSnapshot[], at = new Date()): Promise<void> {
    const pendingId = await this.lookups.idPorSlug('step_execution_statuses', 'not_performed');
    await withTransaction(this.database, async tx => {
      for (const step of steps) await tx.run('INSERT INTO activity_steps(activity_id,training_step_id,step_type_id,step_execution_status_id,position,repetition_index,planned_duration_seconds,instructions,started_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', [activityId, step.training_step_id ?? null, step.step_type_id, pendingId, step.position, step.repetition_index, step.planned_duration_seconds, step.instructions ?? null, step.started_at ? now(step.started_at) : null, now(at), now(at)]);
    });
  }
  async concluir(id: number, status: StepExecutionStatusSlug, actualDurationSeconds: number, distanceMeters: number, finishedAt: Date, at = new Date()): Promise<void> {
    const statusId = await this.lookups.idPorSlug('step_execution_statuses', status);
    await this.database.run('UPDATE activity_steps SET actual_duration_seconds=?,distance_meters=?,finished_at=?,step_execution_status_id=?,updated_at=? WHERE id=?', [actualDurationSeconds, distanceMeters, now(finishedAt), statusId, now(at), id]);
  }
  async listar(activityId: number): Promise<ActivityStep[]> { return (await this.database.all<Record<string, unknown>>('SELECT * FROM activity_steps WHERE activity_id=? ORDER BY position', [activityId])).map(row => dates(row) as unknown as ActivityStep); }
  async listarResultado(activityId: number): Promise<ActivityStepResult[]> {
    const rows = await this.database.all<Record<string, unknown>>(
      `SELECT a.*,t.name step_type_name,t.slug step_type_slug,s.slug status_slug
       FROM activity_steps a
       JOIN step_types t ON t.id=a.step_type_id
       JOIN step_execution_statuses s ON s.id=a.step_execution_status_id
       WHERE a.activity_id=? ORDER BY a.position`,
      [activityId],
    );
    return rows.map(row => dates(row) as unknown as ActivityStepResult);
  }
  async iniciarPrimeiraPendente(activityId: number, at = new Date()): Promise<void> {
    await this.database.run(
      'UPDATE activity_steps SET started_at=?,updated_at=? WHERE id=(SELECT id FROM activity_steps WHERE activity_id=? AND finished_at IS NULL ORDER BY position LIMIT 1) AND started_at IS NULL',
      [now(at), now(at), activityId],
    );
  }
  async finalizarPendentes(activityId: number, at = new Date()): Promise<void> {
    const statusId = await this.lookups.idPorSlug('step_execution_statuses', 'not_performed');
    await this.database.run(
      'UPDATE activity_steps SET step_execution_status_id=?,updated_at=? WHERE activity_id=? AND finished_at IS NULL',
      [statusId, now(at), activityId],
    );
  }
  async contarPorStatus(activityId: number): Promise<Record<StepExecutionStatusSlug, number>> {
    const result: Record<StepExecutionStatusSlug, number> = { completed: 0, skipped: 0, not_performed: 0 };
    const rows = await this.database.all<{ slug: StepExecutionStatusSlug; count: number }>('SELECT s.slug,COUNT(*) count FROM activity_steps a JOIN step_execution_statuses s ON s.id=a.step_execution_status_id WHERE a.activity_id=? GROUP BY s.id,s.slug', [activityId]);
    for (const row of rows) result[row.slug] = row.count;
    return result;
  }
}
