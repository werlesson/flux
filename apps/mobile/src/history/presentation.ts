import type { Activity, StepExecutionStatusSlug } from '@/database/types';
import { formatDateTime, formatDistance, formatDuration, formatPace, getRpeAnchor } from '@/utils/formatters';

export function activityOrigin(activity: Pick<Activity, 'training_session_name'>): string {
  return activity.training_session_name ?? 'Corrida livre';
}

export function historyCard(activity: Activity, now = new Date()) {
  return {
    date: formatDateTime(activity.started_at, 'list', now),
    origin: activityOrigin(activity),
    distance: formatDistance(activity.distance_meters),
    duration: formatDuration(activity.elapsed_duration_seconds),
    pace: `Pace médio ${formatPace(activity.average_pace_seconds_per_km)}`,
    evaluation: activity.rpe === null ? 'Pendente de avaliação' : `RPE ${activity.rpe}`,
    pending: activity.rpe === null,
  };
}

export type StepCounts = Record<StepExecutionStatusSlug, number>;

export function stepCountSummary(counts: StepCounts) {
  const completed = counts.completed ?? 0;
  const skipped = counts.skipped ?? 0;
  const notPerformed = counts.not_performed ?? 0;
  return {
    total: completed + skipped + notPerformed,
    labels: [
      `${completed} ${completed === 1 ? 'concluída' : 'concluídas'}`,
      `${skipped} ${skipped === 1 ? 'pulada' : 'puladas'}`,
      `${notPerformed} ${notPerformed === 1 ? 'não realizada' : 'não realizadas'}`,
    ],
  };
}

export function perceivedEffort(activity: Pick<Activity, 'rpe' | 'notes'>) {
  return activity.rpe === null ? null : {
    value: `${activity.rpe}/10`,
    range: getRpeAnchor(activity.rpe),
    notes: activity.notes,
  };
}

export function partialDistanceMeters(activity: Pick<Activity, 'distance_meters'>): number {
  const remainder = activity.distance_meters % 1000;
  return remainder < 0.005 ? 0 : remainder;
}
