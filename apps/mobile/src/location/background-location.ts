import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { ActivityEngine } from '@/activity/engine';
import { colors } from '@/constants/theme';
import { initializeDatabase } from '@/database';
import type { GpsSample } from '@/gps/filter';
import { GpsFilterOrchestrator } from '@/gps/orchestrator';

export const LOCATION_TASK_NAME = 'flux-background-location';
export const BACKGROUND_LOCATION_WARNING = 'Sem acesso à localização em segundo plano, a gravação pode parar quando a tela apagar.';

export function createLocationUpdateOptions(trainingName?: string | null): Location.LocationTaskOptions {
  return {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1_000,
    distanceInterval: 1,
    foregroundService: {
      notificationTitle: 'Flux · Atividade em andamento',
      notificationBody: trainingName?.trim() || 'Corrida livre',
      notificationColor: colors.dark.action,
      killServiceOnDestroy: false,
    },
  };
}

export const locationUpdateOptions = createLocationUpdateOptions();

type BackgroundGpsConsumer = (sample: GpsSample) => void | Promise<void>;
type BackgroundGpsDrain = () => void | Promise<void>;

let headlessEnginePromise: Promise<ActivityEngine> | null = null;

async function getHeadlessEngine(): Promise<ActivityEngine> {
  headlessEnginePromise ??= (async () => {
    const engine = new ActivityEngine(await initializeDatabase());
    await engine.restoreLastActivity();
    return engine;
  })();
  return headlessEnginePromise;
}

const persistentBackgroundConsumer: BackgroundGpsConsumer = async sample => {
  const engine = await getHeadlessEngine();
  await engine.ingest(sample);
};

let gpsConsumer: BackgroundGpsConsumer = persistentBackgroundConsumer;
let gpsDrain: BackgroundGpsDrain = async () => {
  await (await getHeadlessEngine()).onBackground();
};

/** Connects the native task to the mounted activity engine when the UI process is alive. */
export function setBackgroundGpsConsumer(consumer?: BackgroundGpsConsumer, drain?: BackgroundGpsDrain): void {
  gpsConsumer = consumer ?? persistentBackgroundConsumer;
  gpsDrain = drain ?? (consumer
    ? async () => undefined
    : async () => {
        await (await getHeadlessEngine()).onBackground();
      });
}

/** Kept as an integration seam for callers that own an orchestrator. */
export function setBackgroundGpsOrchestrator(orchestrator: GpsFilterOrchestrator): void {
  setBackgroundGpsConsumer(async sample => {
    await orchestrator.processSample(sample);
  });
}

export async function handleBackgroundLocationTask({ data, error }: {
  data: { locations: Location.LocationObject[] } | null;
  error: unknown;
}): Promise<void> {
  if (error || !data) return;
  for (const location of data.locations) {
    await gpsConsumer({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      recordedAt: location.timestamp,
    });
  }

  // A headless execution may be suspended immediately after this callback.
  await gpsDrain();
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK_NAME, handleBackgroundLocationTask);

export async function startLocationTracking(foregroundGranted: boolean, trainingName?: string | null): Promise<void> {
  if (!foregroundGranted) throw new Error('Permissão de localização em primeiro plano é obrigatória');
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, createLocationUpdateOptions(trainingName));
}

export async function stopLocationTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}
