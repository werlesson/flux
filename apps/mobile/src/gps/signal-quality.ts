import { maxAccuracyMeters, maxSampleIntervalSeconds } from './thresholds';

export type SignalQuality = 'boa_precisao' | 'precisao_degradada' | 'sem_sinal';
export interface SignalQualityState { quality: SignalQuality; recentAccuracies: number[]; lastValidSampleAt: number | null; candidate: SignalQuality | null; candidateCount: number }

export const createSignalQualityState = (): SignalQualityState => ({ quality: 'sem_sinal', recentAccuracies: [], lastValidSampleAt: null, candidate: null, candidateCount: 0 });

export function addSignalSample(state: SignalQualityState, accuracy: number, recordedAt: number, windowSize = 5): SignalQualityState {
  if (!Number.isFinite(accuracy)) return state;
  const recentAccuracies = [...state.recentAccuracies, accuracy].slice(-windowSize);
  const average = recentAccuracies.reduce((sum, value) => sum + value, 0) / recentAccuracies.length;
  const desired: SignalQuality = average <= maxAccuracyMeters ? 'boa_precisao' : 'precisao_degradada';
  const requiredReadings = state.quality === 'sem_sinal' ? 1 : 2;
  const candidateCount = state.candidate === desired ? state.candidateCount + 1 : 1;
  return {
    quality: desired === state.quality || candidateCount >= requiredReadings ? desired : state.quality,
    recentAccuracies,
    lastValidSampleAt: recordedAt,
    candidate: desired,
    candidateCount,
  };
}

export function evaluateSignalTimeout(state: SignalQualityState, now: number): SignalQualityState {
  if (state.lastValidSampleAt != null && now - state.lastValidSampleAt <= maxSampleIntervalSeconds * 1000) return state;
  return { ...state, quality: 'sem_sinal', candidate: null, candidateCount: 0, recentAccuracies: [] };
}
