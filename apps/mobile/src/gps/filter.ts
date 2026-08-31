import type { GpsRejectionReasonSlug } from '@/database/types';

import { haversineDistanceMeters } from './distance';
import {
  maxAccuracyMeters,
  maxPlausibleSpeedMetersPerSecond,
  maxPositionJumpMeters,
  maxSampleIntervalSeconds,
  minSampleIntervalSeconds,
} from './thresholds';

export interface GpsSample {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  speed?: number | null;
  recordedAt: number;
}

export interface GpsFilterState {
  lastAccepted: GpsSample | null;
  gapPending: boolean;
  gapDetectedAt: number | null;
  segment: number;
}

export type GpsDecision =
  | { aceito: true; distanciaIncremental: number; descontinuidade: boolean; segmento: number }
  | { aceito: false; motivo: GpsRejectionReasonSlug; lacuna: boolean };

export interface GpsFilterResult { decisao: GpsDecision; estado: GpsFilterState }

export function createGpsFilterState(): GpsFilterState {
  return { lastAccepted: null, gapPending: false, gapDetectedAt: null, segment: 0 };
}

export function filterGpsSample(sample: GpsSample, state: GpsFilterState): GpsFilterResult {
  if (sample.accuracy == null || !Number.isFinite(sample.accuracy) || sample.accuracy > maxAccuracyMeters) {
    return rejected('low_accuracy', state);
  }
  if (!state.lastAccepted) return accepted(sample, state, 0, false);

  if (state.gapPending && state.gapDetectedAt != null) {
    const intervalSinceGapDetection = (sample.recordedAt - state.gapDetectedAt) / 1000;
    if (intervalSinceGapDetection < minSampleIntervalSeconds) return rejected('stale_sample', state);
    if (intervalSinceGapDetection > maxSampleIntervalSeconds) return gapRejected(sample, state);
    return accepted(sample, state, 0, true);
  }

  const intervalSeconds = (sample.recordedAt - state.lastAccepted.recordedAt) / 1000;
  if (intervalSeconds < minSampleIntervalSeconds) return rejected('stale_sample', state);
  if (intervalSeconds > maxSampleIntervalSeconds) return gapRejected(sample, state);

  const distance = haversineDistanceMeters(state.lastAccepted, sample);
  if (distance / intervalSeconds > maxPlausibleSpeedMetersPerSecond) return rejected('implausible_speed', state);
  if (distance > maxPositionJumpMeters) return rejected('position_jump', state);
  return accepted(sample, state, distance, false);
}

function rejected(motivo: GpsRejectionReasonSlug, estado: GpsFilterState): GpsFilterResult {
  return { decisao: { aceito: false, motivo, lacuna: false }, estado };
}

function gapRejected(sample: GpsSample, state: GpsFilterState): GpsFilterResult {
  return {
    decisao: { aceito: false, motivo: 'stale_sample', lacuna: true },
    estado: { ...state, gapPending: true, gapDetectedAt: sample.recordedAt },
  };
}

function accepted(sample: GpsSample, state: GpsFilterState, distance: number, discontinuity: boolean): GpsFilterResult {
  const segment = discontinuity ? state.segment + 1 : state.segment;
  return {
    decisao: { aceito: true, distanciaIncremental: distance, descontinuidade: discontinuity, segmento: segment },
    estado: { lastAccepted: sample, gapPending: false, gapDetectedAt: null, segment },
  };
}
