import { runMigrations } from '@/database/migrations';
import { NodeSQLiteAdapter } from '@/database/node-adapter';
import { ActivitiesRepository, LookupRepository, TrainingSessionsRepository } from '@/database/repositories';
import { bootstrapLocalUser, seedAppPreferences, seedLookups } from '@/database/seeds';
import { formatLatestActivity, formatTrainingCount, loadHomeSummary } from '@/home/home-summary';
import { routes } from '@/navigation/routes';

describe('fundação da tela inicial', () => {
  it.each([[0, 'Nenhum treino'], [1, '1 treino'], [2, '2 treinos']])('formata %i treino(s)', (count, expected) => expect(formatTrainingCount(count)).toBe(expected));
  it('formata a atividade mais recente conforme o design', () => expect(formatLatestActivity(3180, 1781)).toBe('Última: 3,18 km · 29:41'));

  it('lê apenas treinos ativos e a atividade finalizada mais recente', async () => {
    const database = new NodeSQLiteAdapter();
    await runMigrations(database); await seedLookups(database); await seedAppPreferences(database);
    const userId = await bootstrapLocalUser(database); const lookups = new LookupRepository(database); await lookups.carregar();
    const trainings = new TrainingSessionsRepository(database, lookups);
    const kept = await trainings.salvar({ user_id: userId, name: 'Ativo', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'run', duration_seconds: 60 }] }] });
    const removed = await trainings.salvar({ user_id: userId, name: 'Excluído', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'walk', duration_seconds: 60 }] }] });
    await trainings.excluir(removed.id);
    const activities = new ActivitiesRepository(database, lookups);
    const old = await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date('2026-01-01') });
    const latest = await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date('2026-01-02') });
    await activities.atualizarMetricas(old.id, { finished_at: new Date(), activity_status_slug: 'finished', elapsed_duration_seconds: 60, moving_duration_seconds: 60, distance_meters: 100 });
    await activities.atualizarMetricas(latest.id, { finished_at: new Date(), activity_status_slug: 'finished', elapsed_duration_seconds: 1781, moving_duration_seconds: 1700, distance_meters: 3180 });
    expect(await loadHomeSummary(database)).toEqual({ trainingCount: 1, latestActivity: 'Última: 3,18 km · 29:41' });
    expect(kept.deleted_at).toBeNull(); database.close();
  });
});

describe('shell de navegação', () => {
  it('centraliza todas as nove rotas do MVP em contratos tipados', () => {
    expect(Object.values(routes)).toEqual(['/', '/training-library', '/training-editor', '/training-preview', '/activity', '/activity-result', '/rpe', '/history', '/activity-detail']);
    expect(new Set(Object.values(routes)).size).toBe(9);
  });
});
