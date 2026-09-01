import type { Activity } from '@/database/types';
import { formatDateTime, formatDistance, formatDuration, formatPace, getRpeAnchor } from '@/utils/formatters';

export function resultSubtitle(activity: Activity): string {
  return `${activity.training_session_name ?? 'Corrida livre'} · ${formatDateTime(activity.started_at, 'detail')}`;
}

export function resultMetrics(activity: Activity, hasValidPoints: boolean) {
  return {
    distance: formatDistance(hasValidPoints ? activity.distance_meters : 0),
    elapsed: formatDuration(activity.elapsed_duration_seconds),
    averagePace: formatPace(hasValidPoints ? activity.average_pace_seconds_per_km : null),
    bestPace: formatPace(hasValidPoints ? activity.best_pace_seconds_per_km : null),
    moving: formatDuration(activity.moving_duration_seconds),
    stopped: formatDuration(Math.max(0, activity.elapsed_duration_seconds - activity.moving_duration_seconds)),
  };
}

export function discardSummary(activity: Activity, splitCount: number): string[] {
  const values = [`${formatDistance(activity.distance_meters)} · ${formatDuration(activity.elapsed_duration_seconds)}`];
  if (splitCount > 0) values.push(`${splitCount} ${splitCount === 1 ? 'split' : 'splits'}`);
  return values;
}

export function rpeReading(rpe: number | null): string {
  return rpe === null ? '—/10' : `${rpe}/10 · ${getRpeAnchor(rpe)}`;
}

export interface ActivityEvaluationWriter { atualizarAvaliacao(id: number, rpe: number | null, notes: string | null): Promise<void> }
export async function saveActivityEvaluation(writer: ActivityEvaluationWriter, activityId: number, rpe: number | null, notes: string): Promise<void> {
  if (rpe !== null) getRpeAnchor(rpe);
  const normalizedNotes = notes.trim() || null;
  await writer.atualizarAvaliacao(activityId, rpe, normalizedNotes);
}
