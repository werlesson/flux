import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ActivityEngine } from '@/activity';
import { runMigrations } from '@/database/migrations';
import { NodeSQLiteAdapter } from '@/database/node-adapter';
import { ActivitiesRepository } from '@/database/repositories/activities';
import { ActivityPointsRepository } from '@/database/repositories/activity-points';
import { ActivitySplitsRepository } from '@/database/repositories/activity-splits';
import { ActivityStepsRepository } from '@/database/repositories/activity-steps';
import { TrainingSessionsRepository } from '@/database/repositories/training';
import { bootstrapLocalUser, seedAppPreferences, seedLookups } from '@/database/seeds';

async function setup() {
  const database = new NodeSQLiteAdapter();
  await runMigrations(database); await seedLookups(database); await seedAppPreferences(database);
  return { database, userId: await bootstrapLocalUser(database), activities: new ActivitiesRepository(database) };
}

async function structured(database: NodeSQLiteAdapter, userId: number) {
  return new TrainingSessionsRepository(database).salvar({ user_id: userId, name: 'Intervalado', blocks: [{ repeat_count: 2, steps: [{ step_type_slug: 'run', duration_seconds: 60 }, { step_type_slug: 'walk', duration_seconds: 30 }] }] });
}

describe('fase 11 — recuperação de atividade interrompida', () => {
  it('atividade sem finished_at é detectada na abertura', async () => {
    const { database, userId, activities } = await setup();
    const pending = await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date(0) });
    expect((await activities.buscarEmAndamento())?.id).toBe(pending.id);
    const engine = new ActivityEngine(database, { clock: { now: () => 10_000 } });
    await engine.restoreLastActivity();
    expect((await engine.recoverySnapshot())?.activityId).toBe(pending.id); database.close();
  });

  it('nenhuma atividade pendente não apresenta o diálogo', async () => {
    const { database } = await setup(); const engine = new ActivityEngine(database);
    expect(await engine.restoreLastActivity()).toBeNull(); expect(await engine.recoverySnapshot()).toBeNull(); database.close();
  });

  it('iniciar corrida livre com pendência é bloqueado', async () => {
    const { database, userId, activities } = await setup();
    await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date(0) });
    await expect(new ActivityEngine(database).startFreeRun(userId)).rejects.toThrow('pendente'); database.close();
  });

  it('iniciar treino com pendência é bloqueado', async () => {
    const { database, userId, activities } = await setup(); const training = await structured(database, userId);
    await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date(0) });
    await expect(new ActivityEngine(database).startStructuredRun(userId, training.id, training.name)).rejects.toThrow('pendente'); database.close();
  });

  it('após resolver, o início é liberado', async () => {
    const { database, userId, activities } = await setup(); await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date(0) });
    const recovered = new ActivityEngine(database, { clock: { now: () => 5_000 } }); await recovered.restoreLastActivity(); await recovered.finish();
    await expect(recovered.startFreeRun(userId)).resolves.toBeDefined(); database.close();
  });

  it('retomada reconstrói distância e splits do banco', async () => {
    const { database, userId } = await setup(); const clock = { value: 0 }; const before = new ActivityEngine(database, { clock: { now: () => clock.value }, pointBatchSize: 1 });
    const activity = await before.startFreeRun(userId);
    for (let index = 0; index <= 12; index += 1) { clock.value = index * 10_000; await before.ingest({ latitude: 0, longitude: index * 0.0009, accuracy: 5, speed: 10, recordedAt: clock.value }); }
    await before.onBackground(); const distance = before.metrics().distance;
    const recovered = new ActivityEngine(database, { clock: { now: () => clock.value + 60_000 } }); await recovered.restoreLastActivity();
    expect(recovered.metrics().distance).toBeCloseTo(distance, 6); expect((await new ActivitySplitsRepository(database).listar(activity.id))).toHaveLength(1); database.close();
  });

  it('intervalo offline conta para elapsed e não para moving', async () => {
    const { database, userId } = await setup(); const clock = { value: 0 }; const before = new ActivityEngine(database, { clock: { now: () => clock.value }, pointBatchSize: 1 });
    await before.startFreeRun(userId); await before.ingest({ latitude: 0, longitude: 0, accuracy: 5, speed: 2, recordedAt: 0 }); clock.value = 10_000; await before.ingest({ latitude: 0, longitude: 0.0001, accuracy: 5, speed: 2, recordedAt: clock.value }); await before.onBackground();
    const moving = before.metrics().moving; clock.value = 130_000; const recovered = new ActivityEngine(database, { clock: { now: () => clock.value } }); await recovered.restoreLastActivity();
    expect(recovered.metrics()).toMatchObject({ elapsed: 130, moving }); database.close();
  });

  it('nenhum activity_point é criado para o intervalo offline', async () => {
    const { database, userId } = await setup(); const engine = new ActivityEngine(database, { pointBatchSize: 1 }); const activity = await engine.startFreeRun(userId, new Date(0));
    await engine.ingest({ latitude: 0, longitude: 0, accuracy: 5, speed: 0, recordedAt: 0 }); const before = await database.all('SELECT id FROM activity_points WHERE activity_id=?', [activity.id]);
    const recovered = new ActivityEngine(database, { clock: { now: () => 999_000 } }); await recovered.restoreLastActivity();
    expect(await database.all('SELECT id FROM activity_points WHERE activity_id=?', [activity.id])).toHaveLength(before.length); database.close();
  });

  it('finalizar preserva pontos e splits gravados', async () => {
    const { database, userId, activities } = await setup(); const activity = await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date(0) });
    await new ActivityPointsRepository(database).inserir([{ activity_id: activity.id, latitude: 0, longitude: 0, recorded_at: new Date(0), is_valid: true }]); await new ActivitySplitsRepository(database).fecharSeAusente(activity.id, 1, 400, 400);
    const recovered = new ActivityEngine(database, { clock: { now: () => 500_000 } }); await recovered.restoreLastActivity(); await recovered.finish();
    expect(await database.all('SELECT id FROM activity_points WHERE activity_id=?', [activity.id])).toHaveLength(1); expect(await new ActivitySplitsRepository(database).listar(activity.id)).toHaveLength(1); database.close();
  });

  it('etapas restantes viram not_performed', async () => {
    const { database, userId } = await setup(); const training = await structured(database, userId); const engine = new ActivityEngine(database, { clock: { now: () => 0 } }); const activity = await engine.startStructuredRun(userId, training.id, training.name); await engine.finish(new Date(1_000));
    expect(await new ActivityStepsRepository(database).contarPorStatus(activity.id)).toEqual({ completed: 0, skipped: 0, not_performed: 4 }); database.close();
  });

  it('a atividade passa a aparecer no histórico', async () => {
    const { database, userId, activities } = await setup(); await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date(0) }); const engine = new ActivityEngine(database, { clock: { now: () => 1_000 } }); await engine.restoreLastActivity(); await engine.finish(); expect(await activities.listarFinalizadas()).toHaveLength(1); database.close();
  });

  it('o diálogo contém o texto exato e não oferece dispensa', () => {
    const source = readFileSync(join(__dirname, '../activity/activity-recovery-dialog.tsx'), 'utf8');
    expect(source).toContain('ATIVIDADE NÃO FINALIZADA'); expect(source).toContain('Você tem uma corrida interrompida'); expect(source).toContain('Tudo que havia sido gravado até ali está salvo.');
    expect(source).toContain('onRequestClose={() => undefined}'); expect(source).not.toMatch(/onBackdropPress|Botão fechar/);
  });
});
