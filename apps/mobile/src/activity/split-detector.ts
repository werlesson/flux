export interface ClosedKilometerSplit {
  kilometer: number;
  durationSeconds: number;
  paceSecondsPerKm: number;
  closedAtMovingSeconds: number;
}

/** Detecta limites sobre a distancia validada e interpola o tempo no segmento. */
export class KilometerSplitDetector {
  private nextKilometer: number;
  private lastSplitMovingSeconds: number;

  constructor(lastClosedKilometer = 0, closedSplitMovingSeconds = 0) {
    this.nextKilometer = lastClosedKilometer + 1;
    this.lastSplitMovingSeconds = Math.max(0, closedSplitMovingSeconds);
  }

  detect(previousDistanceMeters: number, currentDistanceMeters: number, previousMovingSeconds: number, currentMovingSeconds: number): ClosedKilometerSplit[] {
    if (currentDistanceMeters <= previousDistanceMeters) return [];
    const results: ClosedKilometerSplit[] = [];
    const distanceDelta = currentDistanceMeters - previousDistanceMeters;
    const movingDelta = Math.max(0, currentMovingSeconds - previousMovingSeconds);
    while (this.nextKilometer * 1000 <= currentDistanceMeters) {
      const boundary = this.nextKilometer * 1000;
      const ratio = Math.min(1, Math.max(0, (boundary - previousDistanceMeters) / distanceDelta));
      const closedAtMovingSeconds = Math.round(previousMovingSeconds + movingDelta * ratio);
      const durationSeconds = Math.max(0, closedAtMovingSeconds - this.lastSplitMovingSeconds);
      results.push({ kilometer: this.nextKilometer, durationSeconds, paceSecondsPerKm: durationSeconds, closedAtMovingSeconds });
      this.lastSplitMovingSeconds = closedAtMovingSeconds;
      this.nextKilometer += 1;
    }
    return results;
  }
}
