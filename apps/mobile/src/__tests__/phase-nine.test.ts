import { ActivityEngine } from '@/activity';
import { KilometerSplitDetector } from '@/activity/split-detector';
import { presentActivitySplits } from '@/components/activity-splits';
import { NodeSQLiteAdapter } from '@/database/node-adapter';
import { runMigrations } from '@/database/migrations';
import { ActivitiesRepository } from '@/database/repositories/activities';
import { ActivitySplitsRepository } from '@/database/repositories/activity-splits';
import { bootstrapLocalUser, seedAppPreferences, seedLookups } from '@/database/seeds';
import type { ActivitySplit } from '@/database/types';

async function setup() {
  const database = new NodeSQLiteAdapter();
  await runMigrations(database); await seedLookups(database); await seedAppPreferences(database);
  const userId = await bootstrapLocalUser(database);
  const activity = await new ActivitiesRepository(database).criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date(0) });
  return { database, activity, splits: new ActivitySplitsRepository(database) };
}

describe('fase 9 — splits por quilômetro', () => {
  it('cruzar 1000 m fecha o split 1', () => {
    expect(new KilometerSplitDetector().detect(990, 1010, 500, 510)).toEqual([{ kilometer: 1, durationSeconds: 505, paceSecondsPerKm: 505, closedAtMovingSeconds: 505 }]);
  });

  it('um segmento de 2500 m a partir de 0 fecha os splits 1 e 2', () => {
    expect(new KilometerSplitDetector().detect(0, 2500, 0, 1000).map(split => [split.kilometer, split.durationSeconds])).toEqual([[1, 400], [2, 400]]);
  });

  it.each([999, 800])('distância de %s m não cruza o múltiplo nem gera split', distance => {
    expect(new KilometerSplitDetector().detect(0, distance, 0, 400)).toEqual([]);
  });

  it('pace do split bate com a duração do quilômetro', () => {
    const [split] = new KilometerSplitDetector().detect(0, 1000, 0, 372);
    expect(split).toMatchObject({ durationSeconds: 372, paceSecondsPerKm: 372 });
  });

  it('pausa no meio do quilômetro não infla o pace do split', () => {
    const detector = new KilometerSplitDetector();
    expect(detector.detect(0, 500, 0, 180)).toEqual([]);
    // O relógio de parede avançou 10 min, mas moving só avançou mais 180 s.
    expect(detector.detect(500, 1000, 180, 360)[0]).toMatchObject({ durationSeconds: 360, paceSecondsPerKm: 360 });
  });

  it('split existe no banco antes de a atividade terminar e atualiza o melhor pace', async () => {
    const { database, activity, splits } = await setup();
    await splits.fecharSeAusente(activity.id, 1, 420, 420);
    expect(await splits.listar(activity.id)).toHaveLength(1);
    expect((await new ActivitiesRepository(database).buscarPorId(activity.id))!.finished_at).toBeNull();
    expect((await new ActivitiesRepository(database).buscarPorId(activity.id))!.best_pace_seconds_per_km).toBe(420);
    database.close();
  });

  it('uma corrida de 3,18 km produz exatamente 3 splits persistidos e distância parcial não cria o quarto', async () => {
    const { database, activity, splits } = await setup();
    for (const split of new KilometerSplitDetector().detect(0, 3180, 0, 1200)) await splits.fecharSeAusente(activity.id, split.kilometer, split.durationSeconds, split.paceSecondsPerKm);
    expect((await splits.listar(activity.id)).map(split => split.kilometer)).toEqual([1, 2, 3]);
    database.close();
  });

  it('tentativa de split duplicado não interrompe a atividade', async () => {
    const { database, activity, splits } = await setup();
    await expect(splits.fecharSeAusente(activity.id, 1, 400, 400)).resolves.toBe(true);
    await expect(splits.fecharSeAusente(activity.id, 1, 999, 999)).resolves.toBe(false);
    expect((await splits.listar(activity.id))[0]).toMatchObject({ duration_seconds: 400, pace_seconds_per_km: 400 });
    database.close();
  });

  it('melhor pace acompanha o menor split e atividade sem split mantém best_pace nulo', async () => {
    const { database, activity, splits } = await setup();
    expect(activity.best_pace_seconds_per_km).toBeNull();
    await splits.fecharSeAusente(activity.id, 1, 430, 430); await splits.fecharSeAusente(activity.id, 2, 390, 390); await splits.fecharSeAusente(activity.id, 3, 410, 410);
    const activities = new ActivitiesRepository(database);
    expect((await activities.buscarPorId(activity.id))!.best_pace_seconds_per_km).toBe(390);
    await activities.atualizarMetricas(activity.id, { elapsed_duration_seconds: 1200, moving_duration_seconds: 1200, distance_meters: 3180 });
    expect((await activities.buscarPorId(activity.id))!.best_pace_seconds_per_km).toBe(390);
    expect(await splits.melhorPace(activity.id)).toBe(390); database.close();
  });

  it('progresso parcial do quilômetro é reconstruído a partir do banco sem reemitir split', async () => {
    const { database, activity, splits } = await setup();
    const clock = { value: 0 };
    const beforeCrash = new ActivityEngine(database, {
      clock: { now: () => clock.value },
      pointBatchSize: 1,
      persistenceIntervalSeconds: 1,
    });
    await beforeCrash.restoreLastActivity();

    // Quinze segmentos válidos de ~100 m deixam cerca de 500 m acumulados
    // depois do primeiro split, todos persistidos antes de simular o crash.
    for (let index = 0; index <= 15; index += 1) {
      clock.value = index * 10_000;
      await beforeCrash.ingest({ latitude: 0, longitude: index * 0.0009, accuracy: 5, speed: 10, recordedAt: clock.value });
    }
    await beforeCrash.onBackground();
    expect((await splits.listar(activity.id)).map(split => split.kilometer)).toEqual([1]);
    expect(beforeCrash.metrics().distance).toBeGreaterThan(1_400);

    // Um novo motor não recebe estado em memória: distância parcial e splits
    // fechados precisam vir exclusivamente dos pontos e linhas do SQLite.
    const recovered = new ActivityEngine(database, {
      clock: { now: () => clock.value },
      pointBatchSize: 1,
      persistenceIntervalSeconds: 1,
    });
    const recoveredActivity = await recovered.restoreLastActivity();
    expect(recoveredActivity?.id).toBe(activity.id);
    expect(recovered.metrics().distance).toBeCloseTo(beforeCrash.metrics().distance, 6);

    // A primeira amostra abre o novo segmento após a recuperação sem inventar
    // distância; as seis seguintes completam os ~500 m que faltavam para km 2.
    clock.value += 10_000;
    await recovered.ingest({ latitude: 0, longitude: 0.0135, accuracy: 5, speed: 10, recordedAt: clock.value });
    for (let index = 16; index <= 21; index += 1) {
      clock.value += 10_000;
      await recovered.ingest({ latitude: 0, longitude: index * 0.0009, accuracy: 5, speed: 10, recordedAt: clock.value });
    }

    expect((await splits.listar(activity.id)).map(split => split.kilometer)).toEqual([1, 2]);
    database.close();
  });

  it('expõe splits ordenados e identifica o melhor para destaque', () => {
    const base = { id: 1, activity_id: 1, duration_seconds: 400, created_at: new Date(0) };
    const input = [{ ...base, kilometer: 2, pace_seconds_per_km: 390 }, { ...base, id: 2, kilometer: 1, pace_seconds_per_km: 420 }] satisfies ActivitySplit[];
    expect(presentActivitySplits(input).map(split => [split.kilometer, split.isBest])).toEqual([[1, false], [2, true]]);
  });
});
