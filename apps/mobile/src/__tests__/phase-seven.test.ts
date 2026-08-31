import { ActivityEngine, InvalidActivityTransitionError } from '@/activity';
import { runMigrations } from '@/database/migrations';
import { NodeSQLiteAdapter } from '@/database/node-adapter';
import { ActivitiesRepository } from '@/database/repositories/activities';
import { bootstrapLocalUser, seedAppPreferences, seedLookups } from '@/database/seeds';
import { haversineDistanceMeters } from '@/gps/distance';
import { currentPaceWindowSeconds } from '@/gps/thresholds';

async function setup(now = 0, options: ConstructorParameters<typeof ActivityEngine>[1] = {}) {
  const database = new NodeSQLiteAdapter();
  await runMigrations(database); await seedLookups(database); await seedAppPreferences(database);
  const userId = await bootstrapLocalUser(database);
  const time = { value: now };
  const engine = new ActivityEngine(database, { ...options, clock: { now: () => time.value } });
  return { database, userId, engine, time };
}

const sample = (seconds: number, longitude = 0, overrides = {}) => ({ latitude: 0, longitude, accuracy: 5, speed: 2, recordedAt: seconds * 1000, ...overrides });

describe('nÃºcleo da atividade', () => {
  it('cria a atividade antes do primeiro ponto e persiste cada transiÃ§Ã£o', async () => {
    const { database, userId, engine } = await setup(); await engine.startFreeRun(userId);
    expect(await database.all('SELECT * FROM activity_points')).toHaveLength(0);
    await engine.pause();
    expect(await database.all<{ slug: string }>('SELECT s.slug FROM activities a JOIN activity_statuses s ON s.id=a.activity_status_id')).toEqual([{ slug: 'paused' }]);
    await engine.resume(); expect(engine.status).toBe('in_progress'); database.close();
  });

  it('rejeita retomada fora da pausa e finished Ã© terminal', async () => {
    const { userId, engine, database } = await setup(); await engine.startFreeRun(userId);
    await expect(engine.resume()).rejects.toBeInstanceOf(InvalidActivityTransitionError);
    await engine.finish(); await expect(engine.pause()).rejects.toBeInstanceOf(InvalidActivityTransitionError); database.close();
  });

  it.each(['in_progress', 'paused'] as const)('finaliza a partir de %s', async status => {
    const { userId, engine, database } = await setup(); await engine.startFreeRun(userId); if (status === 'paused') await engine.pause();
    expect((await engine.finish()).finished_at).not.toBeNull(); database.close();
  });

  it('elapsed deriva do relÃ³gio, ignora ticks e nunca Ã© negativo', async () => {
    const { userId, engine, time, database } = await setup(1_000); await engine.startFreeRun(userId, new Date(1_000));
    time.value += 30 * 60 * 1000; expect(engine.metrics().elapsed).toBe(1800); expect(engine.metrics().elapsed).toBe(1800);
    time.value = 0; expect(engine.metrics().elapsed).toBe(0); database.close();
  });

  it('pausa conta no elapsed, nÃ£o incorpora GPS e sobrevive Ã restauraÃ§Ã£o', async () => {
    const { userId, engine, time, database } = await setup(); await engine.startFreeRun(userId); await engine.ingest(sample(0)); await engine.ingest(sample(10, 0.00018));
    time.value = 10_000; await engine.pause(); await engine.ingest(sample(20, 0.00036)); time.value = 30_000;
    expect(engine.metrics()).toMatchObject({ elapsed: 30, moving: 10 });
    const restored = new ActivityEngine(database, { clock: { now: () => time.value } }); await restored.restoreLastActivity();
    expect(restored.status).toBe('paused'); expect(await database.all('SELECT * FROM activity_points')).toHaveLength(2); database.close();
  });

  it('persiste rejeiÃ§Ãµes com motivo, nÃ£o soma distÃ¢ncia e descarrega lote na pausa', async () => {
    const { userId, engine, database } = await setup(0, { pointBatchSize: 100 }); await engine.startFreeRun(userId);
    await engine.ingest(sample(0)); await engine.ingest(sample(2, 1, { accuracy: 60 })); expect(await database.all('SELECT * FROM activity_points')).toHaveLength(0);
    await engine.pause(); const rows = await database.all<{ is_valid: number; slug: string | null }>('SELECT p.is_valid,r.slug FROM activity_points p LEFT JOIN gps_rejection_reasons r ON r.id=p.rejection_reason_id ORDER BY p.id');
    expect(rows).toEqual([{ is_valid: 1, slug: null }, { is_valid: 0, slug: 'low_accuracy' }]); expect(engine.metrics().distance).toBe(0); database.close();
  });

  it('distÃ¢ncia e moving usam somente segmentos aceitos e nÃ£o mudam status', async () => {
    const { userId, engine, time, database } = await setup(); await engine.startFreeRun(userId); await engine.ingest(sample(0)); await engine.ingest(sample(10, 0.00018)); time.value = 10_000;
    const moved = engine.metrics(); expect(moved.distance).toBeGreaterThan(19); expect(moved.moving).toBe(10);
    await engine.ingest(sample(20, 0.00018, { speed: 0 })); time.value = 20_000; expect(engine.metrics().moving).toBe(10); expect(engine.status).toBe('in_progress'); database.close();
  });

  it('pace atual exige base, some em pausa e pace mÃ©dio usa moving', async () => {
    const { userId, engine, database } = await setup(); await engine.startFreeRun(userId); await engine.ingest(sample(0)); expect(engine.metrics(0).currentPace).toBeNull();
    await engine.ingest(sample(10, 0.00018)); expect(engine.metrics(10_000).averagePace).toBe(engine.metrics(10_000).currentPace);
    await engine.pause(new Date(10_000)); expect(engine.metrics(10_000).currentPace).toBeNull(); database.close();
  });

  it('faz checkpoint sem finalizar e consolida paces nulos atomicamente', async () => {
    const { userId, engine, database } = await setup(0, { persistenceIntervalSeconds: 1 }); await engine.startFreeRun(userId); await engine.ingest(sample(0)); await engine.ingest(sample(2, 0.00002));
    const [checkpoint] = await database.all<{ finished_at: string | null; elapsed_duration_seconds: number }>('SELECT finished_at,elapsed_duration_seconds FROM activities');
    expect(checkpoint).toEqual({ finished_at: null, elapsed_duration_seconds: 2 });
    const finished = await engine.finish(new Date(2_000)); expect(finished.best_pace_seconds_per_km).toBeNull();
    await expect(engine.finish()).rejects.toBeInstanceOf(InvalidActivityTransitionError); database.close();
  });
  it('falha na criacao impede o inicio e avisa o usuario', async () => {
    const database = new NodeSQLiteAdapter(); const notify = jest.fn();
    const engine = new ActivityEngine(database, { onStartError: notify });
    await expect(engine.startFreeRun(999)).rejects.toThrow();
    expect(engine.status).toBeNull(); expect(engine.id).toBeNull();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Não foi possível iniciar'));
    database.close();
  });

  it('descarrega por cadencia temporal e nao perde amostras entre lotes', async () => {
    const { userId, engine, database } = await setup(0, { pointBatchSize: 100, pointBatchFlushIntervalSeconds: 5 });
    await engine.startFreeRun(userId);
    await engine.ingest(sample(0)); await engine.ingest(sample(2, 0.00002)); await engine.ingest(sample(5, 0.00004));
    expect(await database.all('SELECT id FROM activity_points')).toHaveLength(3);
    await engine.ingest(sample(6, 0.00006)); await engine.ingest(sample(7, 0.00008)); await engine.pause(new Date(7_000));
    expect(await database.all('SELECT id FROM activity_points')).toHaveLength(5); database.close();
  });

  it('persiste segmentos para a distancia ser derivavel sem ligar lacunas', async () => {
    const { userId, engine, database } = await setup(0, { pointBatchSize: 100 }); await engine.startFreeRun(userId);
    await engine.ingest(sample(0)); await engine.ingest(sample(10, 0.00018));
    await engine.ingest(sample(50, 0.01)); await engine.ingest(sample(60, 0.01018)); await engine.ingest(sample(70, 0.01036));
    await engine.finish(new Date(70_000));
    const rows = await database.all<{ latitude: number; longitude: number; segment_index: number }>('SELECT latitude,longitude,segment_index FROM activity_points WHERE is_valid=1 ORDER BY recorded_at');
    const derived = rows.slice(1).reduce((total, point, index) => total + (point.segment_index === rows[index]!.segment_index ? haversineDistanceMeters(rows[index]!, point) : 0), 0);
    expect(new Set(rows.map(row => row.segment_index)).size).toBe(2);
    expect(engine.metrics(70_000).distance).toBeCloseTo(derived, 6); database.close();
  });

  it('checkpoint nao bloqueia ingestao e a ultima gravacao fica preservada', async () => {
    const { userId, engine, database } = await setup(0, { persistenceIntervalSeconds: 1, pointBatchSize: 100 }); await engine.startFreeRun(userId);
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    const originalRun = database.run.bind(database); let delayed = false;
    database.run = async (sql, params) => {
      if (!delayed && sql.startsWith('UPDATE activities SET elapsed_duration_seconds')) { delayed = true; await gate; }
      return originalRun(sql, params);
    };
    await engine.ingest(sample(0)); const ingest = engine.ingest(sample(2, 0.00002));
    await expect(Promise.race([ingest.then(() => 'ingested'), new Promise(resolve => setTimeout(() => resolve('blocked'), 50))])).resolves.toBe('ingested');
    release(); await engine.drainWrites();
    const [saved] = await database.all<{ elapsed_duration_seconds: number; distance_meters: number }>('SELECT elapsed_duration_seconds,distance_meters FROM activities');
    expect(saved!.elapsed_duration_seconds).toBe(2); expect(saved!.distance_meters).toBeGreaterThan(0); database.close();
  });

  it('average e nulo sem distancia e metricas ficam imutaveis depois do fim', async () => {
    const { userId, engine, database } = await setup(); await engine.startFreeRun(userId);
    const finished = await engine.finish(new Date(2_000)); expect(finished.average_pace_seconds_per_km).toBeNull();
    await expect(new ActivitiesRepository(database).atualizarMetricas(finished.id, { elapsed_duration_seconds: 999, moving_duration_seconds: 999, distance_meters: 999 })).rejects.toThrow(/finalizada/);
    const [unchanged] = await database.all<{ elapsed_duration_seconds: number; distance_meters: number }>('SELECT elapsed_duration_seconds,distance_meters FROM activities');
    expect(unchanged).toEqual({ elapsed_duration_seconds: 2, distance_meters: 0 }); database.close();
  });

  it('reverte toda a consolidacao quando uma escrita atomica falha', async () => {
    const { userId, engine, database } = await setup(); await engine.startFreeRun(userId); await engine.pause(new Date(1_000));
    await database.exec("CREATE TRIGGER fail_finish BEFORE UPDATE OF finished_at ON activities WHEN NEW.finished_at IS NOT NULL BEGIN SELECT RAISE(ABORT, 'falha'); END");
    await expect(engine.finish(new Date(2_000))).rejects.toThrow();
    const [row] = await database.all<{ finished_at: string | null; slug: string }>('SELECT a.finished_at,s.slug FROM activities a JOIN activity_statuses s ON s.id=a.activity_status_id');
    expect(row).toEqual({ finished_at: null, slug: 'paused' });
    const [pause] = await database.all<{ finished_at: string | null }>('SELECT finished_at FROM activity_pause_intervals'); expect(pause!.finished_at).toBeNull(); database.close();
  });

  it('moving nunca excede elapsed, com ou sem pausa', async () => {
    const { userId, engine, time, database } = await setup(); await engine.startFreeRun(userId);
    // 0,00009° de longitude por 2 s ≈ 5 m/s — dentro do limiar de velocidade plausível
    for (let s = 0; s <= 20; s += 2) { time.value = s * 1000; await engine.ingest(sample(s, s * 0.00009)); }
    time.value = 20_000; expect(engine.metrics().moving).toBeLessThanOrEqual(engine.metrics().elapsed);
    await engine.pause(); time.value = 120_000;
    const { elapsed, moving } = engine.metrics();
    expect(moving).toBeLessThanOrEqual(elapsed); expect(elapsed).toBe(120); database.close();
  });

  it('pace atual é nulo sem sinal, mesmo com distância já acumulada', async () => {
    const { userId, engine, time, database } = await setup(); await engine.startFreeRun(userId);
    for (let s = 0; s <= 20; s += 2) { time.value = s * 1000; await engine.ingest(sample(s, s * 0.00009)); }
    expect(engine.metrics().currentPace).not.toBeNull();
    // sem amostra válida por mais que a janela de pace: a janela esvazia e o
    // pace atual volta a ser nulo, enquanto a distância acumulada permanece
    time.value = (20 + currentPaceWindowSeconds + 5) * 1000;
    const m = engine.metrics();
    expect(m.currentPace).toBeNull(); expect(m.distance).toBeGreaterThan(0); database.close();
  });

  it('restauração reidrata o filtro: a volta abre novo segmento sem inventar distância', async () => {
    // flush por ponto e checkpoint a cada segundo: o crash tem que encontrar
    // pontos e métricas já no banco, que é o que a restauração lê
    const { userId, engine, time, database } = await setup(0, { pointBatchSize: 1, persistenceIntervalSeconds: 1 });
    await engine.startFreeRun(userId);
    await engine.ingest(sample(0)); time.value = 10_000; await engine.ingest(sample(10, 0.00018));
    const distanciaAntes = engine.metrics().distance;
    expect(distanciaAntes).toBeGreaterThan(0);
    const [persistida] = await database.all<{ distance_meters: number }>('SELECT distance_meters FROM activities');
    expect(persistida!.distance_meters).toBeCloseTo(distanciaAntes, 6);

    // app cai e reabre 10 minutos depois, longe do último ponto
    time.value = 600_000;
    const restored = new ActivityEngine(database, { clock: { now: () => time.value } });
    await restored.restoreLastActivity();
    expect(restored.metrics().distance).toBeCloseTo(distanciaAntes, 6);

    // primeira amostra após a lacuna é rejeitada (intervalo > maxSampleIntervalSeconds)
    await restored.ingest(sample(600, 0.01));
    expect(restored.metrics().distance).toBeCloseTo(distanciaAntes, 6);

    // a seguinte é aceita, mas com distância zero e em um segmento novo —
    // sem reta artificial ligando os dois lados da lacuna
    await restored.ingest(sample(605, 0.01));
    expect(restored.metrics().distance).toBeCloseTo(distanciaAntes, 6);
    const segmentos = await database.all<{ segment_index: number }>('SELECT DISTINCT segment_index FROM activity_points WHERE is_valid=1 ORDER BY segment_index');
    expect(segmentos.map(s => s.segment_index)).toEqual([0, 1]);
    database.close();
  });
});
