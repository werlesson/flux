import type { GpsRejectionReasonSlug } from '@/database/types';

/**
 * Leitura de um `activity_point` já resolvida contra `gps_rejection_reasons`.
 * A ferramenta de inspeção lê pontos aceitos e rejeitados no mesmo conjunto —
 * é a comparação entre os dois que baliza a calibração da fase seguinte.
 */
export interface InspectedPoint {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  recorded_at: Date;
  is_valid: boolean;
  rejection_reason_slug: GpsRejectionReasonSlug | null;
  segment_index: number;
}

export interface RejectionBreakdown {
  reason: GpsRejectionReasonSlug;
  count: number;
  /** Fração do total coletado, não só dos rejeitados: é assim que se lê o custo do filtro. */
  share: number;
}

export interface AccuracyBucket {
  /** Limite superior em metros, inclusivo. `null` é a faixa aberta acima do último limite. */
  upperBound: number | null;
  count: number;
  share: number;
}

export interface AccuracyDistribution {
  count: number;
  min: number;
  median: number;
  p90: number;
  p95: number;
  max: number;
  mean: number;
  buckets: AccuracyBucket[];
}

export interface GpsInspectionReport {
  totalPoints: number;
  acceptedPoints: number;
  rejectedPoints: number;
  /** Rejeitados sem motivo gravado — indica dado inconsistente, não um motivo válido. */
  rejectedWithoutReason: number;
  /** Aceitos sem `accuracy` — ficam fora da distribuição e precisam ser visíveis. */
  acceptedWithoutAccuracy: number;
  segments: number;
  rejections: RejectionBreakdown[];
  accuracy: AccuracyDistribution | null;
}

export interface InspectionRouteCoordinate {
  latitude: number;
  longitude: number;
  recordedAt: Date;
  segmentIndex: number;
}

/** Ordem canônica dos motivos, usada como desempate estável na apresentação. */
export const gpsRejectionReasonOrder: readonly GpsRejectionReasonSlug[] = [
  'low_accuracy',
  'implausible_speed',
  'position_jump',
  'stale_sample',
];

/**
 * Faixas do histograma de `accuracy`. São faixas de leitura, deliberadamente
 * independentes de `maxAccuracyMeters`: o histograma existe para escolher esse
 * limiar em campo, então não pode ser desenhado a partir dele.
 */
export const accuracyBucketEdgesMeters: readonly number[] = [5, 10, 20, 40, 80];

export function percentile(values: readonly number[], fraction: number): number {
  if (!values.length) throw new RangeError('Percentil exige ao menos um valor');
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new RangeError('A fração deve estar entre 0 e 1');
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

export function accuracyDistribution(values: readonly number[]): AccuracyDistribution | null {
  const finite = values.filter(value => Number.isFinite(value));
  if (!finite.length) return null;
  const sorted = [...finite].sort((a, b) => a - b);
  const bounds: (number | null)[] = [...accuracyBucketEdgesMeters, null];
  const buckets = bounds.map((upperBound, index) => {
    const lowerBound = index === 0 ? Number.NEGATIVE_INFINITY : accuracyBucketEdgesMeters[index - 1]!;
    const count = sorted.filter(value => value > lowerBound && (upperBound === null || value <= upperBound)).length;
    return { upperBound, count, share: count / sorted.length };
  });
  return {
    count: sorted.length,
    min: sorted[0]!,
    median: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1]!,
    mean: sorted.reduce((total, value) => total + value, 0) / sorted.length,
    buckets,
  };
}

export function buildGpsInspectionReport(points: readonly InspectedPoint[]): GpsInspectionReport {
  const accepted = points.filter(point => point.is_valid);
  const rejected = points.filter(point => !point.is_valid);
  const counts = new Map<GpsRejectionReasonSlug, number>();
  for (const point of rejected) {
    if (!point.rejection_reason_slug) continue;
    counts.set(point.rejection_reason_slug, (counts.get(point.rejection_reason_slug) ?? 0) + 1);
  }
  const rejections = gpsRejectionReasonOrder
    .map(reason => ({ reason, count: counts.get(reason) ?? 0, share: points.length ? (counts.get(reason) ?? 0) / points.length : 0 }))
    .sort((a, b) => b.count - a.count || gpsRejectionReasonOrder.indexOf(a.reason) - gpsRejectionReasonOrder.indexOf(b.reason));
  const accuracies = accepted.map(point => point.accuracy).filter((value): value is number => value !== null && Number.isFinite(value));
  return {
    totalPoints: points.length,
    acceptedPoints: accepted.length,
    rejectedPoints: rejected.length,
    rejectedWithoutReason: rejected.filter(point => point.rejection_reason_slug === null).length,
    acceptedWithoutAccuracy: accepted.length - accuracies.length,
    segments: new Set(accepted.map(point => point.segment_index)).size,
    rejections,
    accuracy: accuracyDistribution(accuracies),
  };
}

/**
 * Percurso para comparação visual: com `includeRejected`, os pontos descartados
 * voltam para a linha na ordem em que foram medidos, expondo os saltos que o
 * filtro removeu.
 */
export function inspectionRouteCoordinates(points: readonly InspectedPoint[], includeRejected: boolean): InspectionRouteCoordinate[] {
  return points
    .filter(point => includeRejected || point.is_valid)
    .map(point => ({ latitude: point.latitude, longitude: point.longitude, recordedAt: point.recorded_at, segmentIndex: point.segment_index }));
}
