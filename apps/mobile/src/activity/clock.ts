export interface ActivityClock { now(): number }
export const systemActivityClock: ActivityClock = { now: () => Date.now() };

export function elapsedSeconds(startedAt: number, currentTime: number): number {
  return Math.max(0, Math.floor((currentTime - startedAt) / 1000));
}

export function paceSecondsPerKm(distanceMeters: number, durationSeconds: number): number | null {
  if (distanceMeters <= 0 || durationSeconds <= 0) return null;
  return Math.round(durationSeconds * 1000 / distanceMeters);
}
