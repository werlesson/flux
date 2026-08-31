import type { DatabaseAdapter } from '@/database/adapter';
import { NodeSQLiteAdapter } from '@/database/node-adapter';
import {
  ActivitiesRepository, ActivityPointsRepository, ActivitySplitsRepository, ActivityStepsRepository,
  AppPreferencesRepository, LookupRepository, TrainingBlocksRepository, TrainingSessionsRepository,
  TrainingStepsRepository,
} from '@/database/repositories';
import { runMigrations } from '@/database/migrations';
import { bootstrapLocalUser, seedAppPreferences, seedLookups } from '@/database/seeds';
import { withTransaction } from '@/database/transaction';

async function ready() {
  const database = new NodeSQLiteAdapter();
  await runMigrations(database); await seedLookups(database); await seedAppPreferences(database);
  const userId = await bootstrapLocalUser(database);
  const lookups = new LookupRepository(database); await lookups.carregar();
  return { database, userId, lookups };
}

async function activity(database: DatabaseAdapter, userId: number, lookups: LookupRepository, started = new Date('2026-01-01T10:00:00Z')) {
  return new ActivitiesRepository(database, lookups).criar({ user_id: userId, activity_type_slug: 'free_run', started_at: started });
}

describe('infraestrutura de repositório', () => {
  it('exceção no meio da transação não deixa escrita parcial e aninhamento usa savepoint', async () => {
    const { database } = await ready();
    await expect(withTransaction(database, async tx => {
      await tx.run("INSERT INTO users(name,created_at,updated_at) VALUES('a','x','x')");
      await withTransaction(tx, async nested => { await nested.run("INSERT INTO users(name,created_at,updated_at) VALUES('b','x','x')"); throw new Error('falha'); });
    })).rejects.toThrow('falha');
    expect((await database.all<{ count: number }>('SELECT COUNT(*) count FROM users'))[0]!.count).toBe(1);
    database.close();
  });

  it('lookups falham explicitamente e não consultam por slug depois da carga', async () => {
    const { database } = await ready(); const spy = jest.spyOn(database, 'all');
    const repository = new LookupRepository(database); await repository.carregar();
    const calls = spy.mock.calls.length;
    expect(await repository.idPorSlug('step_types', 'run')).toBeGreaterThan(0);
    await expect(repository.porSlug('step_types', 'inexistente' as 'run')).rejects.toThrow('Lookup desconhecido');
    expect(spy).toHaveBeenCalledTimes(calls); database.close();
  });

  it('preferências preservam tipos, atualizam sem duplicar, usam cache e aceitam default', async () => {
    const { database } = await ready(); const spy = jest.spyOn(database, 'all'); const preferences = new AppPreferencesRepository(database);
    await preferences.gravar('audio_cues_enabled', false);
    expect(await preferences.ler('audio_cues_enabled', true)).toBe(false);
    expect(typeof await preferences.ler('audio_cues_enabled', true)).toBe('boolean');
    expect(await preferences.ler('nova_preferencia', 42)).toBe(42);
    const calls = spy.mock.calls.length; await preferences.ler('audio_cues_enabled', true); expect(spy).toHaveBeenCalledTimes(calls);
    expect((await database.all<{ count: number }>("SELECT COUNT(*) count FROM app_preferences WHERE key='audio_cues_enabled'"))[0]!.count).toBe(1);
    database.close();
  });
});

describe('planejamento', () => {
  it('salva e lê árvore ordenada, materializa duração e oculta somente na listagem', async () => {
    const { database, userId, lookups } = await ready(); const sessions = new TrainingSessionsRepository(database, lookups);
    const saved = await sessions.salvar({ user_id: userId, name: 'Intervalado', blocks: [
      { repeat_count: 2, steps: [{ step_type_slug: 'run', duration_seconds: 60 }, { step_type_slug: 'walk', duration_seconds: 30 }] },
      { repeat_count: 1, steps: [{ step_type_slug: 'cooldown', duration_seconds: 120 }] },
    ] });
    expect(saved.estimated_duration_seconds).toBe(300);
    expect(saved.blocks.map(x => x.position)).toEqual([0, 1]); expect(saved.blocks[0]!.steps.map(x => x.position)).toEqual([0, 1]);
    await sessions.excluir(saved.id); expect(await sessions.listar()).toEqual([]); expect((await sessions.buscarPorId(saved.id))?.name).toBe('Intervalado');
    database.close();
  });

  it('soft delete preserva as atividades originadas do treino', async () => {
    const { database, userId, lookups } = await ready();
    const sessions = new TrainingSessionsRepository(database, lookups);
    const training = await sessions.salvar({
      user_id: userId,
      name: 'Treino com histórico',
      blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'run', duration_seconds: 60 }] }],
    });
    const createdActivity = await new ActivitiesRepository(database, lookups).criar({
      user_id: userId,
      activity_type_slug: 'structured',
      started_at: new Date('2026-01-01T10:00:00Z'),
      training_session_id: training.id,
      training_session_name: training.name,
    });

    await sessions.excluir(training.id);

    const persistedActivity = await new ActivitiesRepository(database, lookups).buscarPorId(createdActivity.id);
    expect(persistedActivity).toMatchObject({
      id: createdActivity.id,
      training_session_id: training.id,
      training_session_name: training.name,
    });
    expect(await sessions.buscarPorId(training.id)).not.toBeNull();
    database.close();
  });

  it('reordena blocos/etapas localmente e remove etapas em cascata', async () => {
    const { database, userId, lookups } = await ready(); const sessions = new TrainingSessionsRepository(database, lookups);
    const saved = await sessions.salvar({ user_id: userId, name: 'T', blocks: [
      { repeat_count: 1, steps: [{ step_type_slug: 'run', duration_seconds: 10 }, { step_type_slug: 'walk', duration_seconds: 20 }] },
      { repeat_count: 1, steps: [{ step_type_slug: 'run', duration_seconds: 30 }] },
    ] });
    const blocks = new TrainingBlocksRepository(database); const steps = new TrainingStepsRepository(database);
    await blocks.reordenar(saved.id, saved.blocks.map(x => x.id).reverse());
    await steps.reordenar(saved.blocks[0]!.id, saved.blocks[0]!.steps.map(x => x.id).reverse());
    expect((await database.all<{ position: number }>('SELECT position FROM training_steps WHERE training_block_id=? ORDER BY position', [saved.blocks[1]!.id])).map(x => x.position)).toEqual([0]);
    await expect(steps.criar({ training_block_id: undefined, step_type_id: saved.blocks[0]!.steps[0]!.step_type_id, duration_seconds: 1 })).rejects.toThrow('training_block_id');
    await expect(steps.criar({ training_block_id: saved.blocks[0]!.id, step_type_id: saved.blocks[0]!.steps[0]!.step_type_id, duration_seconds: 0 })).rejects.toThrow('maior que zero');
    await blocks.remover(saved.blocks[0]!.id); expect(await database.all('SELECT * FROM training_steps WHERE training_block_id=?', [saved.blocks[0]!.id])).toEqual([]);
    database.close();
  });

  it('reordenação de blocos mantém positions contíguas e únicas', async () => {
    const { database, userId, lookups } = await ready();
    const sessions = new TrainingSessionsRepository(database, lookups);
    const saved = await sessions.salvar({
      user_id: userId,
      name: 'Três blocos',
      blocks: [10, 20, 30].map(duration_seconds => ({
        repeat_count: 1,
        steps: [{ step_type_slug: 'run' as const, duration_seconds }],
      })),
    });
    const reorderedIds = [saved.blocks[2]!.id, saved.blocks[0]!.id, saved.blocks[1]!.id];

    await new TrainingBlocksRepository(database).reordenar(saved.id, reorderedIds);

    const rows = await database.all<{ id: number; position: number }>(
      'SELECT id, position FROM training_blocks WHERE training_session_id=? ORDER BY position',
      [saved.id],
    );
    expect(rows.map(row => row.id)).toEqual(reorderedIds);
    expect(rows.map(row => row.position)).toEqual([0, 1, 2]);
    expect(new Set(rows.map(row => row.position)).size).toBe(rows.length);
    database.close();
  });
});

describe('execução', () => {
  it('lista finalizadas em ordem e avaliação não altera métricas', async () => {
    const { database, userId, lookups } = await ready(); const activities = new ActivitiesRepository(database, lookups);
    const current = await activity(database, userId, lookups, new Date('2026-01-03T00:00:00Z'));
    const old = await activity(database, userId, lookups, new Date('2026-01-01T00:00:00Z')); const recent = await activity(database, userId, lookups, new Date('2026-01-02T00:00:00Z'));
    for (const item of [old, recent]) await activities.atualizarMetricas(item.id, { finished_at: new Date(), activity_status_slug: 'finished', elapsed_duration_seconds: 10, moving_duration_seconds: 9, distance_meters: 100 });
    expect((await activities.listarFinalizadas()).map(x => x.id)).toEqual([recent.id, old.id]); expect((await activities.buscarEmAndamento())?.id).toBe(current.id);
    await activities.atualizarAvaliacao(old.id, 7, 'ok'); expect((await activities.buscarPorId(old.id))?.distance_meters).toBe(100);
    await expect(activities.atualizarMetricas(old.id, { elapsed_duration_seconds: 1, moving_duration_seconds: 1, distance_meters: 1 })).rejects.toThrow('finalizada'); database.close();
  });

  it('valida, insere e consulta pontos em lote', async () => {
    const { database, userId, lookups } = await ready(); const a = await activity(database, userId, lookups); const points = new ActivityPointsRepository(database, lookups);
    await expect(points.inserirEmLote([{ activity_id: a.id, latitude: 1, longitude: 1, recorded_at: new Date(), is_valid: false }])).rejects.toThrow('exige motivo');
    await expect(points.inserirEmLote([{ activity_id: a.id, latitude: 1, longitude: 1, recorded_at: new Date(), is_valid: true, rejection_reason_slug: 'low_accuracy' }])).rejects.toThrow('não pode');
    await points.inserirEmLote([
      { activity_id: a.id, latitude: 1, longitude: 1, recorded_at: new Date('2026-01-01T00:00:02Z'), is_valid: true },
      { activity_id: a.id, latitude: 2, longitude: 2, recorded_at: new Date('2026-01-01T00:00:01Z'), is_valid: false, rejection_reason_slug: 'low_accuracy' },
    ]);
    expect((await points.listarValidos(a.id)).map(x => x.latitude)).toEqual([1]); expect(await points.contarPorMotivo(a.id)).toEqual([{ reason: 'low_accuracy', count: 1 }]); database.close();
  });

  it('splits rejeitam duplicata e calculam o melhor pace', async () => {
    const { database, userId, lookups } = await ready(); const a = await activity(database, userId, lookups); const splits = new ActivitySplitsRepository(database);
    expect(await splits.melhorPace(a.id)).toBeNull(); await splits.registrar(a.id, 2, 400, 400); await splits.registrar(a.id, 1, 380, 380);
    await expect(splits.registrar(a.id, 1, 390, 390)).rejects.toThrow('duplicado'); expect(await splits.melhorPace(a.id)).toBe(380); expect((await splits.listar(a.id)).map(x => x.kilometer)).toEqual([1, 2]); database.close();
  });

  it('snapshot sobrevive à edição/exclusão da origem e agrega status', async () => {
    const { database, userId, lookups } = await ready(); const sessions = new TrainingSessionsRepository(database, lookups);
    const training = await sessions.salvar({ user_id: userId, name: 'Origem', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'run', duration_seconds: 60, instructions: 'antiga' }] }] });
    const a = await new ActivitiesRepository(database, lookups).criar({ user_id: userId, activity_type_slug: 'structured', started_at: new Date(), training_session_id: training.id, training_session_name: training.name });
    const repository = new ActivityStepsRepository(database, lookups); const source = training.blocks[0]!.steps[0]!;
    await repository.criarSnapshot(a.id, [{ training_step_id: source.id, step_type_id: source.step_type_id, instructions: source.instructions, planned_duration_seconds: source.duration_seconds, position: 0, repetition_index: 1 }]);
    await sessions.salvar({ id: training.id, user_id: userId, name: 'Editado', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'walk', duration_seconds: 90, instructions: 'nova' }] }] });
    const [snapshot] = await repository.listar(a.id); expect(snapshot).toMatchObject({ training_step_id: null, instructions: 'antiga', planned_duration_seconds: 60 });
    await repository.concluir(snapshot!.id, 'completed', 61, 100, new Date()); expect(await repository.contarPorStatus(a.id)).toEqual({ completed: 1, skipped: 0, not_performed: 0 });
    await sessions.excluir(training.id); expect((await repository.listar(a.id))).toHaveLength(1); database.close();
  });

  it('exclusão de atividade remove dependências e preserva o treino', async () => {
    const { database, userId, lookups } = await ready(); const sessions = new TrainingSessionsRepository(database, lookups);
    const training = await sessions.salvar({ user_id: userId, name: 'T', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'run', duration_seconds: 60 }] }] });
    const activities = new ActivitiesRepository(database, lookups); const a = await activities.criar({ user_id: userId, activity_type_slug: 'structured', started_at: new Date(), training_session_id: training.id, training_session_name: training.name });
    await new ActivityPointsRepository(database, lookups).inserirEmLote([{ activity_id: a.id, latitude: 1, longitude: 1, recorded_at: new Date(), is_valid: true }]);
    await new ActivitySplitsRepository(database).registrar(a.id, 1, 60, 60);
    await new ActivityStepsRepository(database, lookups).criarSnapshot(a.id, [{ step_type_id: training.blocks[0]!.steps[0]!.step_type_id, planned_duration_seconds: 60, position: 0, repetition_index: 1 }]);
    await activities.excluir(a.id); for (const table of ['activities', 'activity_points', 'activity_splits', 'activity_steps']) expect((await database.all<{ count: number }>(`SELECT COUNT(*) count FROM ${table}`))[0]!.count).toBe(0);
    expect((await database.all<{ name: string }>('PRAGMA table_info(activities)')).map(column => column.name)).not.toContain('deleted_at');
    expect(await sessions.buscarPorId(training.id)).not.toBeNull(); database.close();
  });

  it('falha no meio da exclusão faz rollback completo', async () => {
    const { database, userId, lookups } = await ready();
    const a = await activity(database, userId, lookups);
    await new ActivityPointsRepository(database, lookups).inserirEmLote([
      { activity_id: a.id, latitude: 1, longitude: 1, recorded_at: new Date(), is_valid: true },
    ]);
    await new ActivitySplitsRepository(database).registrar(a.id, 1, 60, 60);
    await new ActivityStepsRepository(database, lookups).criarSnapshot(a.id, [{
      step_type_id: await lookups.idPorSlug('step_types', 'run'),
      planned_duration_seconds: 60,
      position: 0,
      repetition_index: 1,
    }]);
    await database.exec(`
      CREATE TRIGGER fail_activity_delete_after_cascade
      AFTER DELETE ON activities
      BEGIN
        SELECT RAISE(ABORT, 'falha injetada no meio da exclusão');
      END
    `);

    await expect(new ActivitiesRepository(database, lookups).excluir(a.id)).rejects.toThrow('falha injetada');

    for (const table of ['activities', 'activity_points', 'activity_splits', 'activity_steps']) {
      expect((await database.all<{ count: number }>(
        `SELECT COUNT(*) count FROM ${table} WHERE ${table === 'activities' ? 'id' : 'activity_id'}=?`,
        [a.id],
      ))[0]!.count).toBe(1);
    }
    database.close();
  });
});
