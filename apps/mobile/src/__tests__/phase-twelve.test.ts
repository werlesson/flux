import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { discardSummary, resultMetrics, rpeReading, saveActivityEvaluation } from '@/activity/result';
import { NodeSQLiteAdapter } from '@/database/node-adapter';
import { ActivitiesRepository } from '@/database/repositories/activities';
import { ActivityPointsRepository } from '@/database/repositories/activity-points';
import { ActivitySplitsRepository } from '@/database/repositories/activity-splits';
import { ActivityStepsRepository } from '@/database/repositories/activity-steps';
import { TrainingSessionsRepository } from '@/database/repositories/training';
import { runMigrations } from '@/database/migrations';
import { bootstrapLocalUser, seedLookups } from '@/database/seeds';
import type { Activity } from '@/database/types';

async function setup() {
  const database = new NodeSQLiteAdapter();
  await runMigrations(database); await seedLookups(database);
  const userId = await bootstrapLocalUser(database);
  return { database, userId, activities: new ActivitiesRepository(database) };
}

describe('fase 12 — resultado e RPE', () => {
  it.each([0, 11])('rpe %i é rejeitado antes de chegar ao repositório', async rpe => {
    const writer = { atualizarAvaliacao: jest.fn(async () => undefined) };
    await expect(saveActivityEvaluation(writer, 1, rpe, '')).rejects.toThrow('RPE');
    expect(writer.atualizarAvaliacao).not.toHaveBeenCalled();
  });

  it('rpe nulo é aceito e mantém a atividade pendente', async () => {
    const { database, userId, activities } = await setup();
    const activity = await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date() });
    await saveActivityEvaluation(activities, activity.id, null, 'Chuva forte');
    expect(await activities.buscarPorId(activity.id)).toMatchObject({ rpe: null, notes: 'Chuva forte' });
    database.close();
  });

  it('a avaliação usa update e não cria nova atividade', async () => {
    const { database, userId, activities } = await setup();
    const activity = await activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date() });
    await saveActivityEvaluation(activities, activity.id, 6, 'Controlado');
    expect((await database.all<{ count: number }>('SELECT COUNT(*) count FROM activities'))[0]!.count).toBe(1);
    expect(await activities.buscarPorId(activity.id)).toMatchObject({ rpe: 6, notes: 'Controlado' });
    database.close();
  });

  it('formata estados degradados, leitura RPE e resumo sem splits', () => {
    const activity = { training_session_name: null, distance_meters: 420, elapsed_duration_seconds: 300, moving_duration_seconds: 180, average_pace_seconds_per_km: 714, best_pace_seconds_per_km: null } as Activity;
    expect(resultMetrics(activity, false)).toMatchObject({ distance: '0,00 km', averagePace: '—', bestPace: '—', moving: '03:00', stopped: '02:00', elapsed: '05:00' });
    expect(discardSummary(activity, 0)).toEqual(['0,42 km · 05:00']);
    expect(rpeReading(null)).toBe('—/10'); expect(rpeReading(6)).toBe('6/10 · Controlado');
  });

  it('as telas contêm os textos e interações obrigatórios', () => {
    const result = readFileSync(join(__dirname, '../app/activity-result.tsx'), 'utf8');
    const rpe = readFileSync(join(__dirname, '../app/rpe.tsx'), 'utf8');
    expect(result).toContain('Atividade concluída'); expect(result).toContain('SEM PERCURSO PARA EXIBIR'); expect(result).toContain('ETAPAS EXECUTADAS ·'); expect(result).toContain('Descartar esta atividade?');
    expect(rpe).toContain('O esforço percebido é opcional. Você pode responder depois, pelo histórico.'); expect(rpe).toContain('OBSERVAÇÕES · OPCIONAL'); expect(rpe).toContain('current === value ? null : value'); expect(rpe).toContain('minHeight: 84');
  });
  it('força splits vazios quando não há pontos válidos', () => {
    const result = readFileSync(join(__dirname, '../app/activity-result.tsx'), 'utf8');
    expect(result).toContain('<ActivitySplits splits={data.validPoints > 0 ? data.splits : []} />');
  });
});

describe('fase 12 — descarte', () => {
  it('remove todas as linhas relacionadas, preserva o treino e some imediatamente do histórico', async () => {
    const { database, userId, activities } = await setup();
    const training = await new TrainingSessionsRepository(database).salvar({ user_id: userId, name: 'Origem', blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'run', duration_seconds: 60 }] }] });
    const activity = await activities.criar({ user_id: userId, activity_type_slug: 'structured', started_at: new Date(), training_session_id: training.id, training_session_name: training.name });
    await new ActivityPointsRepository(database).inserir([{ activity_id: activity.id, latitude: 1, longitude: 1, recorded_at: new Date(), is_valid: true }]);
    await new ActivitySplitsRepository(database).registrar(activity.id, 1, 60, 60);
    await new ActivityStepsRepository(database).criarSnapshot(activity.id, [{ step_type_id: training.blocks[0]!.steps[0]!.step_type_id, planned_duration_seconds: 60, position: 0, repetition_index: 1 }]);
    await activities.atualizarMetricas(activity.id, { finished_at: new Date(), activity_status_slug: 'finished', elapsed_duration_seconds: 60, moving_duration_seconds: 60, distance_meters: 1000 });
    await activities.excluir(activity.id);
    for (const table of ['activities', 'activity_points', 'activity_splits', 'activity_steps']) expect((await database.all<{ count: number }>(`SELECT COUNT(*) count FROM ${table}`))[0]!.count).toBe(0);
    expect(await new TrainingSessionsRepository(database).buscarPorId(training.id)).not.toBeNull();
    expect(await activities.listarFinalizadas()).toEqual([]);
    database.close();
  });
});
