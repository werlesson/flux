import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ActivityEngine } from '@/activity';
import { colors } from '@/constants/theme';
import { runMigrations } from '@/database/migrations';
import { NodeSQLiteAdapter } from '@/database/node-adapter';
import { ActivitySplitsRepository } from '@/database/repositories/activity-splits';
import { TrainingSessionsRepository } from '@/database/repositories/training';
import { bootstrapLocalUser, seedAppPreferences, seedLookups } from '@/database/seeds';
import { BACKGROUND_LOCATION_WARNING, createLocationUpdateOptions, LOCATION_TASK_NAME, startLocationTracking, stopLocationTracking } from '@/location/background-location';

async function setup() {
  const database = new NodeSQLiteAdapter();
  await runMigrations(database); await seedLookups(database); await seedAppPreferences(database);
  return { database, userId: await bootstrapLocalUser(database) };
}

const nativeLocation = (seconds: number, longitude: number, accuracy = 5): Location.LocationObject => ({
  timestamp: seconds * 1_000,
  coords: { latitude: 0, longitude, altitude: null, accuracy, altitudeAccuracy: null, heading: null, speed: 10 },
});

describe('fase 10 — execução em background', () => {
  beforeEach(() => jest.clearAllMocks());

  it('serviço sobe ao iniciar e cai ao finalizar', async () => {
    jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true);
    await startLocationTracking(true); await stopLocationTracking();
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(LOCATION_TASK_NAME, expect.objectContaining({ foregroundService: expect.any(Object) }));
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(LOCATION_TASK_NAME);
  });

  it('ausência de permissão de background produz aviso explícito', () => {
    expect(BACKGROUND_LOCATION_WARNING).toMatch(/gravação.*tela apagar/);
    const home = readFileSync(join(__dirname, '../app/index.tsx'), 'utf8');
    expect(home).toContain("permissions.foreground !== 'concedida'");
    expect(home).not.toContain("permissions.foreground !== 'concedida' || permissions.background !== 'concedida'");
    const context = readFileSync(join(__dirname, '../activity/activity-context.tsx'), 'utf8');
    expect(context).toContain('BACKGROUND_LOCATION_WARNING');
    expect(context.indexOf('checkAndRequest()')).toBeLessThan(context.indexOf('startLocationTracking(true)'));
  });

  it('as opções do foreground service carregam título e corpo', () => {
    expect(createLocationUpdateOptions().foregroundService).toEqual({
      notificationTitle: 'Flux · Atividade em andamento', notificationBody: 'Corrida livre',
      notificationColor: colors.dark.action, killServiceOnDestroy: false,
    });
  });

  it('o corpo traz o nome do treino em atividade estruturada e Corrida livre na livre', () => {
    expect(createLocationUpdateOptions('Intervalado 5 km').foregroundService?.notificationBody).toBe('Intervalado 5 km');
    expect(createLocationUpdateOptions(null).foregroundService?.notificationBody).toBe('Corrida livre');
  });

  it('o fluxo de atividade estruturada passa o nome do treino para o serviço', async () => {
    const { database, userId } = await setup();
    const training = await new TrainingSessionsRepository(database).salvar({
      user_id: userId,
      name: 'Intervalado 5 km',
      blocks: [{ repeat_count: 1, steps: [{ step_type_slug: 'run', duration_seconds: 60 }] }],
    });
    const engine = new ActivityEngine(database);
    const activity = await engine.startStructuredRun(userId, training.id, training.name);
    await startLocationTracking(true, activity.training_session_name);
    expect(activity).toMatchObject({ training_session_id: training.id, training_session_name: training.name });
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      LOCATION_TASK_NAME,
      expect.objectContaining({ foregroundService: expect.objectContaining({ notificationBody: training.name }) }),
    );
    database.close();
  });

  it('encerrar duas vezes não lança', async () => {
    jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(stopLocationTracking()).resolves.toBeUndefined(); await expect(stopLocationTracking()).resolves.toBeUndefined();
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledTimes(1);
  });

  it('descartar a atividade também derruba o serviço', async () => {
    const { database, userId } = await setup(); const engine = new ActivityEngine(database);
    await engine.startFreeRun(userId); await engine.discard();
    jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true); await stopLocationTracking();
    expect(engine.id).toBeNull(); expect(await database.all('SELECT id FROM activities')).toHaveLength(0);
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalled(); database.close();
  });

  it('ingestão em background usa o mesmo filtro do foreground', async () => {
    const accepted: boolean[] = [];
    jest.isolateModules(() => {
      const isolated = require('@/location/background-location') as typeof import('@/location/background-location');
      const { GpsFilterOrchestrator } = require('@/gps/orchestrator') as typeof import('@/gps/orchestrator');
      isolated.setBackgroundGpsOrchestrator(new GpsFilterOrchestrator(undefined, (_sample, result) => { accepted.push(result.decisao.aceito); }));
    });
    const task = jest.mocked(TaskManager.defineTask).mock.calls.at(-1)![1] as (body: Parameters<Parameters<typeof TaskManager.defineTask>[1]>[0]) => Promise<void>;
    await task({ data: { locations: [nativeLocation(0, 0), nativeLocation(1, 1, 60)] }, error: null, executionInfo: { eventId: 'background', taskName: LOCATION_TASK_NAME } });
    expect(accepted).toEqual([true, false]);
  });

  it('split fecha e é persistido com a tela bloqueada', async () => {
    const { database, userId } = await setup(); const clock = { value: 0 };
    const engine = new ActivityEngine(database, { clock: { now: () => clock.value }, pointBatchSize: 1, persistenceIntervalSeconds: 1 });
    const activity = await engine.startFreeRun(userId);
    for (let index = 0; index <= 11; index += 1) { clock.value = index * 10_000; await engine.ingest({ latitude: 0, longitude: index * 0.0009, accuracy: 5, speed: 10, recordedAt: clock.value }); }
    await engine.onBackground();
    expect((await new ActivitySplitsRepository(database).listar(activity.id)).map(item => item.kilometer)).toEqual([1]); database.close();
  });

  it('elapsed após 25 min em background bate com o tempo de parede', async () => {
    const { database, userId } = await setup(); const clock = { value: 0 };
    const engine = new ActivityEngine(database, { clock: { now: () => clock.value } }); await engine.startFreeRun(userId);
    clock.value = 25 * 60 * 1_000; await engine.onBackground();
    expect(engine.metrics().elapsed).toBe(25 * 60); database.close();
  });

  it('corrida de 30 min com 25 min em background produz os mesmos dados da sempre acesa', async () => {
    const run = async (background: boolean) => {
      const { database, userId } = await setup(); const clock = { value: 0 };
      const engine = new ActivityEngine(database, { clock: { now: () => clock.value }, pointBatchSize: 1, persistenceIntervalSeconds: 1 });
      const activity = await engine.startFreeRun(userId);
      for (let index = 0; index <= 180; index += 1) {
        clock.value = index * 10_000;
        if (background && index === 30) await engine.onBackground();
        await engine.ingest({ latitude: 0, longitude: index * 0.00018, accuracy: 5, speed: 2, recordedAt: clock.value });
      }
      await engine.onBackground();
      const result = { metrics: engine.metrics(), splits: (await new ActivitySplitsRepository(database).listar(activity.id)).map(split => split.kilometer) };
      database.close();
      return result;
    };

    const alwaysOn = await run(false);
    const mostlyBackground = await run(true);
    expect(mostlyBackground).toEqual(alwaysOn);
    expect(mostlyBackground.metrics.elapsed).toBe(30 * 60);
    expect(mostlyBackground.splits).toEqual([1, 2, 3]);
  });
});
