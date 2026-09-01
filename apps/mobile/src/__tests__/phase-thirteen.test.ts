import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { saveActivityEvaluation } from '@/activity/result';
import { NodeSQLiteAdapter } from '@/database/node-adapter';
import { ActivitiesRepository } from '@/database/repositories/activities';
import { ActivityPointsRepository } from '@/database/repositories/activity-points';
import { ActivitySplitsRepository } from '@/database/repositories/activity-splits';
import { TrainingSessionsRepository } from '@/database/repositories/training';
import { runMigrations } from '@/database/migrations';
import { bootstrapLocalUser, seedLookups } from '@/database/seeds';
import { historyCard, partialDistanceMeters, stepCountSummary } from '@/history/presentation';

async function setup() {
  const database = new NodeSQLiteAdapter(); await runMigrations(database); await seedLookups(database);
  const userId = await bootstrapLocalUser(database); const activities = new ActivitiesRepository(database);
  return { database, userId, activities };
}

describe('fase 13 — histórico e avaliação posterior', () => {
  it('lista somente finalizadas em started_at DESC e mantém o snapshot da origem', async () => {
    const { database, userId, activities } = await setup();
    const older = await activities.criar({ user_id: userId, activity_type_slug: 'structured', training_session_name: 'Treino removido', started_at: new Date('2026-08-29T10:00:00Z') });
    const newer = await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date('2026-08-30T10:00:00Z') });
    await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date('2026-08-31T10:00:00Z') });
    for (const item of [older, newer]) await activities.atualizarMetricas(item.id, { activity_status_slug: 'finished', finished_at: new Date(), elapsed_duration_seconds: 60, moving_duration_seconds: 60, distance_meters: 100 });
    expect((await activities.listarFinalizadas()).map(item => item.id)).toEqual([newer.id, older.id]);
    expect(historyCard((await activities.buscarPorId(older.id))!).origin).toBe('Treino removido'); database.close();
  });

  it('preencher rpe remove a marcação de pendente', async () => {
    const { database, userId, activities } = await setup(); const activity = await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date() });
    expect(historyCard(activity).pending).toBe(true); await saveActivityEvaluation(activities, activity.id, 6, 'Controlado');
    expect(historyCard((await activities.buscarPorId(activity.id))!).pending).toBe(false); database.close();
  });

  it('edição não altera distância, tempos nem paces', async () => {
    const { database, userId, activities } = await setup(); const activity = await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date() });
    await activities.atualizarMetricas(activity.id, { activity_status_slug: 'finished', finished_at: new Date(), elapsed_duration_seconds: 600, moving_duration_seconds: 550, distance_meters: 1200, average_pace_seconds_per_km: 500, best_pace_seconds_per_km: 480 });
    await saveActivityEvaluation(activities, activity.id, 8, 'Forte'); const updated = (await activities.buscarPorId(activity.id))!;
    expect(updated).toMatchObject({ distance_meters: 1200, elapsed_duration_seconds: 600, moving_duration_seconds: 550, average_pace_seconds_per_km: 500, best_pace_seconds_per_km: 480 }); database.close();
  });

  it('edição de observações sem rpe mantém a atividade pendente', async () => {
    const { database, userId, activities } = await setup(); const activity = await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date() });
    await saveActivityEvaluation(activities, activity.id, null, 'Choveu'); expect(historyCard((await activities.buscarPorId(activity.id))!).pending).toBe(true); database.close();
  });

  it('exclusão remove pontos e splits, preserva o treino e a lista reflete sem remontagem', async () => {
    const { database, userId, activities } = await setup(); const trainings = new TrainingSessionsRepository(database);
    const training = await trainings.salvar({ user_id: userId, name: 'Origem', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'run', duration_seconds: 60 }] }] });
    const activity = await activities.criar({ user_id: userId, activity_type_slug: 'structured', training_session_id: training.id, training_session_name: training.name, started_at: new Date() });
    await new ActivityPointsRepository(database).inserir([{ activity_id: activity.id, latitude: 1, longitude: 1, recorded_at: new Date(), is_valid: true }]); await new ActivitySplitsRepository(database).registrar(activity.id, 1, 60, 60);
    await activities.atualizarMetricas(activity.id, { activity_status_slug: 'finished', finished_at: new Date(), elapsed_duration_seconds: 60, moving_duration_seconds: 60, distance_meters: 1000 });
    expect(await activities.listarFinalizadas()).toHaveLength(1); await activities.excluir(activity.id);
    expect(await activities.listarFinalizadas()).toEqual([]); expect(await database.all('SELECT id FROM activity_points')).toEqual([]); expect(await database.all('SELECT id FROM activity_splits')).toEqual([]); expect(await trainings.buscarPorId(training.id)).not.toBeNull(); database.close();
  });

  it('resume etapas e distância parcial e não usa cliente HTTP', () => {
    expect(stepCountSummary({ completed: 11, skipped: 2, not_performed: 1 })).toEqual({ total: 14, labels: ['11 concluídas', '2 puladas', '1 não realizada'] });
    expect(partialDistanceMeters({ distance_meters: 3310 })).toBe(310);
    const history = readFileSync(join(__dirname, '../app/history.tsx'), 'utf8');
    expect(history).not.toMatch(/fetch\(|axios|httpClient|https?:\/\//i); expect(history).toContain('FlatList');
  });

  it('atualiza detalhe e lista por foco sem remontar o histórico', () => {
    const history = readFileSync(join(__dirname, '../app/history.tsx'), 'utf8');
    const detail = readFileSync(join(__dirname, '../app/activity-detail.tsx'), 'utf8');
    const rpe = readFileSync(join(__dirname, '../app/rpe.tsx'), 'utf8');
    expect(history).toContain('useFocusEffect'); expect(detail).toContain('useFocusEffect');
    expect(detail).toContain('router.back()'); expect(rpe).toContain('if (editing) router.back()');
    expect(detail).not.toContain('router.replace(routes.history)');
    expect(rpe).not.toContain("router.replace({ pathname: routes.activityDetail");
  });
});
