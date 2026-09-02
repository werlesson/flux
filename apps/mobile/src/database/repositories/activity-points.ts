import type { DatabaseAdapter } from '../adapter';
import type { ActivityPoint, GpsRejectionReasonSlug } from '../types';
import { withTransaction } from '../transaction';
import { LookupRepository } from './lookups';
import { dates, now } from './mappers';

export interface ActivityPointInput { activity_id: number; latitude: number; longitude: number; altitude?: number | null; accuracy?: number | null; speed?: number | null; recorded_at: Date; is_valid: boolean; rejection_reason_slug?: GpsRejectionReasonSlug | null; segment_index?: number }
/** Projeção usada pela ferramenta de inspeção do GPS: o motivo da rejeição já resolvido contra `gps_rejection_reasons`. */
export interface InspectedActivityPoint extends ActivityPoint { rejection_reason_slug: GpsRejectionReasonSlug | null }

export class ActivityPointsRepository {
  constructor(private readonly database: DatabaseAdapter, private readonly lookups = new LookupRepository(database)) {}
  async inserirEmLote(points: ActivityPointInput[], at = new Date()): Promise<void> {
    for (const point of points) {
      if (!point.is_valid && !point.rejection_reason_slug) throw new Error('Ponto rejeitado exige motivo');
      if (point.is_valid && point.rejection_reason_slug) throw new Error('Ponto válido não pode ter motivo de rejeição');
    }
    const prepared = await Promise.all(points.map(async point => ({ point, reasonId: point.rejection_reason_slug ? await this.lookups.idPorSlug('gps_rejection_reasons', point.rejection_reason_slug) : null })));
    await withTransaction(this.database, async tx => {
      for (const { point, reasonId } of prepared) await tx.run('INSERT INTO activity_points(activity_id,latitude,longitude,altitude,accuracy,speed,recorded_at,is_valid,rejection_reason_id,segment_index,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', [point.activity_id, point.latitude, point.longitude, point.altitude ?? null, point.accuracy ?? null, point.speed ?? null, now(point.recorded_at), point.is_valid ? 1 : 0, reasonId, point.segment_index ?? 0, now(at)]);
    });
  }
  inserir(points: ActivityPointInput[], at = new Date()): Promise<void> { return this.inserirEmLote(points, at); }
  async listarValidos(activityId: number): Promise<ActivityPoint[]> { return (await this.database.all<Record<string, unknown>>('SELECT * FROM activity_points WHERE activity_id=? AND is_valid=1 ORDER BY recorded_at', [activityId])).map(row => dates(row) as unknown as ActivityPoint); }
  /** Aceitos e rejeitados na mesma leitura, base da ferramenta de inspeção — é a comparação entre os dois que a calibração consome. */
  async listarParaInspecao(activityId: number): Promise<InspectedActivityPoint[]> { return (await this.database.all<Record<string, unknown>>('SELECT p.*, r.slug rejection_reason_slug FROM activity_points p LEFT JOIN gps_rejection_reasons r ON r.id=p.rejection_reason_id WHERE p.activity_id=? ORDER BY p.recorded_at, p.id', [activityId])).map(row => dates(row) as unknown as InspectedActivityPoint); }
  async accuracyDosAceitos(activityId: number): Promise<number[]> { return (await this.database.all<{ accuracy: number }>('SELECT accuracy FROM activity_points WHERE activity_id=? AND is_valid=1 AND accuracy IS NOT NULL ORDER BY accuracy', [activityId])).map(row => row.accuracy); }
  /**
   * Remove os pontos rejeitados de UMA atividade. O `is_valid=0` no WHERE é a
   * garantia de que nenhum ponto válido é tocado — e, como a distância da
   * atividade é calculada só sobre os válidos, ela não se move. Quando isto
   * pode ser chamado é decisão da política, não do repositório: veja
   * `expurgoLiberado` em `@/gps/purge-policy`.
   */
  async expurgarRejeitados(activityId: number): Promise<number> {
    return withTransaction(this.database, async tx => (await tx.run('DELETE FROM activity_points WHERE activity_id=? AND is_valid=0', [activityId])).changes);
  }
  async contarRejeitados(activityId: number): Promise<number> { const [row] = await this.database.all<{ total: number }>('SELECT COUNT(*) total FROM activity_points WHERE activity_id=? AND is_valid=0', [activityId]); return row?.total ?? 0; }
  async contarPorMotivo(activityId: number): Promise<Array<{ reason: GpsRejectionReasonSlug; count: number }>> { return this.database.all('SELECT r.slug reason, COUNT(*) count FROM activity_points p JOIN gps_rejection_reasons r ON r.id=p.rejection_reason_id WHERE p.activity_id=? AND p.is_valid=0 GROUP BY r.id,r.slug ORDER BY r.slug', [activityId]); }
}
