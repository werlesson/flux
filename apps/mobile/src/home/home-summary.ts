import type { DatabaseAdapter } from '@/database/adapter';
import { ActivitiesRepository, TrainingSessionsRepository } from '@/database/repositories';
import { formatDistance, formatDuration } from '@/utils/formatters';

export interface HomeSummary { trainingCount: number; latestActivity: string | null }

export function formatTrainingCount(count: number): string {
  if (count === 0) return 'Nenhum treino';
  return count === 1 ? '1 treino' : `${count} treinos`;
}

export function formatLatestActivity(distanceMeters: number, elapsedSeconds: number): string {
  return `Última: ${formatDistance(distanceMeters)} · ${formatDuration(elapsedSeconds)}`;
}

export async function loadHomeSummary(database: DatabaseAdapter): Promise<HomeSummary> {
  const [trainings, activities] = await Promise.all([new TrainingSessionsRepository(database).listar(), new ActivitiesRepository(database).listarFinalizadas()]);
  const latest = activities[0];
  return { trainingCount: trainings.length, latestActivity: latest ? formatLatestActivity(latest.distance_meters, latest.elapsed_duration_seconds) : null };
}
