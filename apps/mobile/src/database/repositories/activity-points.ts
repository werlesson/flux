import type { DatabaseAdapter } from '../adapter';
import type { ActivityPoint, GpsRejectionReasonSlug } from '../types';
import { withTransaction } from '../transaction';
import { LookupRepository } from './lookups';
import { dates, now } from './mappers';

export interface ActivityPointInput { activity_id: number; latitude: number; longitude: number; altitude?: number | null; accuracy?: number | null; speed?: number | null; recorded_at: Date; is_valid: boolean; rejection_reason_slug?: GpsRejectionReasonSlug | null }

export class ActivityPointsRepository {
  constructor(private readonly database: DatabaseAdapter, private readonly lookups = new LookupRepository(database)) {}
  async inserirEmLote(points: ActivityPointInput[], at = new Date()): Promise<void> {
    for (const point of points) {
      if (!point.is_valid && !point.rejection_reason_slug) throw new Error('Ponto rejeitado exige motivo');
      if (point.is_valid && point.rejection_reason_slug) throw new Error('Ponto válido não pode ter motivo de rejeição');
    }
    const prepared = await Promise.all(points.map(async point => ({ point, reasonId: point.rejection_reason_slug ? await this.lookups.idPorSlug('gps_rejection_reasons', point.rejection_reason_slug) : null })));
    await withTransaction(this.database, async tx => {
      for (const { point, reasonId } of prepared) await tx.run('INSERT INTO activity_points(activity_id,latitude,longitude,altitude,accuracy,speed,recorded_at,is_valid,rejection_reason_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', [point.activity_id, point.latitude, point.longitude, point.altitude ?? null, point.accuracy ?? null, point.speed ?? null, now(point.recorded_at), point.is_valid ? 1 : 0, reasonId, now(at)]);
    });
  }
  inserir(points: ActivityPointInput[], at = new Date()): Promise<void> { return this.inserirEmLote(points, at); }
  async listarValidos(activityId: number): Promise<ActivityPoint[]> { return (await this.database.all<Record<string, unknown>>('SELECT * FROM activity_points WHERE activity_id=? AND is_valid=1 ORDER BY recorded_at', [activityId])).map(row => dates(row) as unknown as ActivityPoint); }
  async contarPorMotivo(activityId: number): Promise<Array<{ reason: GpsRejectionReasonSlug; count: number }>> { return this.database.all('SELECT r.slug reason, COUNT(*) count FROM activity_points p JOIN gps_rejection_reasons r ON r.id=p.rejection_reason_id WHERE p.activity_id=? AND p.is_valid=0 GROUP BY r.id,r.slug ORDER BY r.slug', [activityId]); }
}
