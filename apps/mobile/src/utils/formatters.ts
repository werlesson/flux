export type DateTimeStyle = 'list' | 'detail';

const MONTHS_PT_BR = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} deve ser um número finito não negativo`);
  }
}

function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDistance(meters: number): string {
  assertFiniteNonNegative(meters, 'A distância');
  const hundredthsOfKm = roundHalfUp(meters / 10);
  const kilometers = Math.floor(hundredthsOfKm / 100);
  const hundredths = hundredthsOfKm % 100;
  return `${kilometers},${pad2(hundredths)} km`;
}

export function formatDuration(durationSeconds: number): string {
  assertFiniteNonNegative(durationSeconds, 'A duração');
  const secondsTotal = roundHalfUp(durationSeconds);
  const seconds = secondsTotal % 60;
  const minutesTotal = Math.floor(secondsTotal / 60);
  const minutes = minutesTotal % 60;
  const hours = Math.floor(minutesTotal / 60);

  return hours > 0
    ? `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
    : `${pad2(minutes)}:${pad2(seconds)}`;
}

export function calculatePace(
  movingDurationSeconds: number,
  distanceMeters: number,
): number | null {
  assertFiniteNonNegative(movingDurationSeconds, 'A duração em movimento');
  assertFiniteNonNegative(distanceMeters, 'A distância');
  if (distanceMeters === 0) return null;
  return (movingDurationSeconds * 1000) / distanceMeters;
}

export function formatPace(secondsPerKilometer: number | null): string {
  if (secondsPerKilometer === null) return '—';
  assertFiniteNonNegative(secondsPerKilometer, 'O pace');
  const secondsTotal = roundHalfUp(secondsPerKilometer);
  const minutes = Math.floor(secondsTotal / 60);
  const seconds = secondsTotal % 60;
  return `${minutes}:${pad2(seconds)}/km`;
}

export function formatDateTime(
  value: Date | string | number,
  style: DateTimeStyle = 'list',
  now: Date = new Date(),
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError('Data inválida');

  const year = date.getFullYear();
  const yearSuffix = year === now.getFullYear() ? '' : ` ${year}`;
  const separator = style === 'detail' ? ',' : ' ·';
  return `${date.getDate()} ${MONTHS_PT_BR[date.getMonth()]}${yearSuffix}${separator} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function getRpeAnchor(rpe: number | null): string | null {
  if (rpe === null) return null;
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) {
    throw new RangeError('RPE deve ser um inteiro entre 1 e 10');
  }
  if (rpe <= 3) return 'Fácil';
  if (rpe <= 6) return 'Controlado';
  return 'Difícil';
}

/** Formats the complete RPE reading used by capture and result surfaces. */
export function formatRpe(rpe: number | null): string {
  if (rpe === null) return '—/10';
  getRpeAnchor(rpe);
  return `${rpe}/10`;
}
