import type { SignalQuality } from '@/gps/signal-quality';

export const signalQualityToGpsStatus = (quality: SignalQuality) =>
  quality === 'boa_precisao' ? 'good' as const : quality === 'precisao_degradada' ? 'degraded' as const : 'no-signal' as const;

export function formatActivityTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [hours, minutes, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}

export const formatActivityDistance = (meters: number): string => `${(Math.max(0, meters) / 1000).toFixed(2).replace('.', ',')} km`;

export function formatActivityPace(secondsPerKm: number | null): string {
  if (secondsPerKm == null || !Number.isFinite(secondsPerKm)) return '—';
  const rounded = Math.max(0, Math.round(secondsPerKm));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')} /km`;
}

export function createActionGuard() {
  let running = false;
  return async <T>(action: () => Promise<T>): Promise<T | undefined> => {
    if (running) return undefined;
    running = true;
    try { return await action(); } finally { running = false; }
  };
}
