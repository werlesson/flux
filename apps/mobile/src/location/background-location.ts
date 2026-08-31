import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { GpsFilterOrchestrator } from '@/gps/orchestrator';

export const LOCATION_TASK_NAME = 'flux-background-location';
export const locationUpdateOptions: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1_000,
  distanceInterval: 1,
  foregroundService: { notificationTitle: 'Flux está acompanhando sua corrida', notificationBody: 'Toque para voltar à atividade.' },
};

let gpsOrchestrator = new GpsFilterOrchestrator();

export function setBackgroundGpsOrchestrator(orchestrator: GpsFilterOrchestrator): void {
  gpsOrchestrator = orchestrator;
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  for (const location of data.locations) await gpsOrchestrator.processSample({
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    altitude: location.coords.altitude,
    accuracy: location.coords.accuracy,
    speed: location.coords.speed,
    recordedAt: location.timestamp,
  });
});

export async function startLocationTracking(foregroundGranted: boolean): Promise<void> {
  if (!foregroundGranted) throw new Error('Permissão de localização em primeiro plano é obrigatória');
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, locationUpdateOptions);
}

export async function stopLocationTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}
