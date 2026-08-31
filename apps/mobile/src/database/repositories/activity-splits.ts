import type { DatabaseAdapter } from '../adapter';
import type { ActivitySplit } from '../types';
import { dates, now } from './mappers';

export class ActivitySplitsRepository {
  constructor(private readonly database: DatabaseAdapter) {}
  async registrar(activityId: number, kilometer: number, durationSeconds: number, paceSecondsPerKm: number, at = new Date()): Promise<number> {
    if (!Number.isInteger(kilometer) || kilometer < 1) throw new Error('Kilometer inválido');
    try { return (await this.database.run('INSERT INTO activity_splits(activity_id,kilometer,duration_seconds,pace_seconds_per_km,created_at) VALUES(?,?,?,?,?)', [activityId, kilometer, durationSeconds, paceSecondsPerKm, now(at)])).lastInsertRowId; }
    catch (error) { throw new Error(`Split duplicado para o quilômetro ${kilometer}`, { cause: error }); }
  }
  async listar(activityId: number): Promise<ActivitySplit[]> { return (await this.database.all<Record<string, unknown>>('SELECT * FROM activity_splits WHERE activity_id=? ORDER BY kilometer', [activityId])).map(row => dates(row) as unknown as ActivitySplit); }
  async melhorPace(activityId: number): Promise<number | null> { const [row] = await this.database.all<{ pace: number | null }>('SELECT MIN(pace_seconds_per_km) pace FROM activity_splits WHERE activity_id=?', [activityId]); return row?.pace ?? null; }
}
