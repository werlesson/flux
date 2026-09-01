import { ActivitiesRepository, LookupRepository, TrainingSessionsRepository } from '@/database/repositories';
import { runMigrations } from '@/database/migrations';
import { NodeSQLiteAdapter } from '@/database/node-adapter';
import { bootstrapLocalUser, seedLookups } from '@/database/seeds';
import { activityOrigin } from '@/history/presentation';
import { formatTrainingBlock, trainingActions, trainingCardPresentation } from '@/training/presentation';

async function setup() {
  const database = new NodeSQLiteAdapter();
  await runMigrations(database); await seedLookups(database);
  const userId = await bootstrapLocalUser(database);
  const lookups = new LookupRepository(database); await lookups.carregar();
  const trainings = new TrainingSessionsRepository(database, lookups);
  const activities = new ActivitiesRepository(database, lookups);
  return { database, userId, trainings, activities };
}

describe('fase 15 — resumo da biblioteca', () => {
  it('bloco de repetição vira um único chip com o prefixo N×', async () => {
    const { database, userId, trainings } = await setup();
    const training = await trainings.salvar({ user_id: userId, name: 'Intervalado', blocks: [{ repeat_count: 6, steps: [{ step_type_slug: 'run', duration_seconds: 120 }, { step_type_slug: 'walk', duration_seconds: 120 }] }] });
    expect(formatTrainingBlock(training.blocks[0]!)).toBe('6× 2 min corrida + 2 min caminhada');
    expect(trainingCardPresentation(training).chips).toEqual(['6× 2 min corrida + 2 min caminhada']);
    database.close();
  });

  it('bloco simples vira um chip sem prefixo', async () => {
    const { database, userId, trainings } = await setup();
    const training = await trainings.salvar({ user_id: userId, name: 'Leve', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'walk', duration_seconds: 300 }] }] });
    expect(trainingCardPresentation(training).chips).toEqual(['5 min caminhada']);
    expect(trainingCardPresentation(training).metadata).toBe('1 etapa · 5 min estimados');
    database.close();
  });

  it('a ordem dos chips segue position e a contagem não expande repetições', async () => {
    const { database, userId, trainings } = await setup();
    const training = await trainings.salvar({ user_id: userId, name: 'Completo', blocks: [
      { repeat_count: 1, steps: [{ step_type_slug: 'warmup', duration_seconds: 300 }] },
      { repeat_count: 3, steps: [{ step_type_slug: 'run', duration_seconds: 60 }, { step_type_slug: 'walk', duration_seconds: 60 }] },
      { repeat_count: 1, steps: [{ step_type_slug: 'cooldown', duration_seconds: 300 }] },
    ] });
    expect(trainingCardPresentation(training)).toMatchObject({ metadata: '4 etapas · 16 min estimados', chips: ['5 min aquecimento', '3× 1 min corrida + 1 min caminhada', '5 min desaquecimento'] });
    database.close();
  });

  it('lista somente ativos pela atualização mais recente', async () => {
    const { database, userId, trainings } = await setup();
    const older = await trainings.salvar({ user_id: userId, name: 'Antigo', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'run', duration_seconds: 60 }] }] }, new Date('2026-01-01'));
    await trainings.salvar({ user_id: userId, name: 'Recente', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'walk', duration_seconds: 60 }] }] }, new Date('2026-01-02'));
    const removed = await trainings.salvar({ user_id: userId, name: 'Excluído', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'walk', duration_seconds: 60 }] }] }, new Date('2026-01-03'));
    await trainings.excluir(removed.id, new Date('2026-01-04'));
    expect((await trainings.listarBiblioteca()).map(item => item.name)).toEqual(['Recente', 'Antigo']);
    expect(older.deleted_at).toBeNull(); database.close();
  });
});

describe('fase 15 — exclusão e execução', () => {
  it('exclusão é soft delete e preserva as atividades', async () => {
    const { database, userId, trainings, activities } = await setup();
    const training = await trainings.salvar({ user_id: userId, name: 'Origem preservada', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'run', duration_seconds: 60 }] }] });
    const activity = await activities.criar({ user_id: userId, activity_type_slug: 'structured', started_at: new Date(), training_session_id: training.id, training_session_name: training.name });
    await activities.atualizarMetricas(activity.id, { finished_at: new Date(), activity_status_slug: 'finished', elapsed_duration_seconds: 60, moving_duration_seconds: 60, distance_meters: 100 });
    await trainings.excluir(training.id);
    expect((await trainings.buscarPorId(training.id))?.deleted_at).toBeInstanceOf(Date);
    expect(await activities.buscarPorId(activity.id)).not.toBeNull();
    database.close();
  });

  it('treino excluído some da listagem e o histórico continua exibindo o nome do treino após a exclusão', async () => {
    const { database, userId, trainings, activities } = await setup();
    const training = await trainings.salvar({ user_id: userId, name: 'Meu intervalado', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'run', duration_seconds: 60 }] }] });
    const activity = await activities.criar({ user_id: userId, activity_type_slug: 'structured', started_at: new Date(), training_session_id: training.id });
    await activities.atualizarMetricas(activity.id, { finished_at: new Date(), activity_status_slug: 'finished', elapsed_duration_seconds: 60, moving_duration_seconds: 60, distance_meters: 100 });
    await trainings.excluir(training.id);
    expect(await trainings.listarBiblioteca()).toEqual([]);
    expect(activityOrigin((await activities.buscarPorId(activity.id))!)).toBe('Meu intervalado');
    database.close();
  });

  it('treino em execução não pode ser editado nem excluído; outros treinos continuam editáveis', async () => {
    const { database, userId, trainings, activities } = await setup();
    const active = await trainings.salvar({ user_id: userId, name: 'Ativo', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'run', duration_seconds: 60 }] }] });
    const other = await trainings.salvar({ user_id: userId, name: 'Outro', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'walk', duration_seconds: 60 }] }] });
    await activities.criar({ user_id: userId, activity_type_slug: 'structured', started_at: new Date(), training_session_id: active.id, training_session_name: active.name });
    expect(trainingActions(true)).toEqual({ canEdit: false, canDelete: false });
    expect(trainingActions(false)).toEqual({ canEdit: true, canDelete: true });
    const edited = await trainings.salvar({ id: other.id, user_id: userId, name: 'Outro editado', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'walk', duration_seconds: 120 }] }] });
    const library = await trainings.listarBiblioteca();
    expect(library.find(item => item.id === active.id)?.is_in_progress).toBe(true);
    expect(edited.name).toBe('Outro editado');
    database.close();
  });
});
