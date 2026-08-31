import * as Location from 'expo-location';

import { maxAccuracyMeters } from '@/gps/thresholds';

export type InitialFixState = { status: 'aguardando' | 'boa_precisao' | 'sem_precisao_aceitavel'; location: Location.LocationObject | null };
export interface InitialFixAttempt { cancel(): void; done: Promise<InitialFixState> }

export function acquireInitialFix(onChange: (state: InitialFixState) => void, timeoutMilliseconds = 15_000): InitialFixAttempt {
  let settled = false;
  let subscription: Location.LocationSubscription | undefined;
  let finish!: (state: InitialFixState) => void;
  const done = new Promise<InitialFixState>(resolve => { finish = resolve; });
  const complete = (state: InitialFixState) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    subscription?.remove();
    onChange(state);
    finish(state);
  };
  const waiting: InitialFixState = { status: 'aguardando', location: null };
  onChange(waiting);
  const timer = setTimeout(() => complete({ status: 'sem_precisao_aceitavel', location: null }), timeoutMilliseconds);
  void Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }, location => {
    if (location.coords.accuracy != null && location.coords.accuracy <= maxAccuracyMeters) complete({ status: 'boa_precisao', location });
    else onChange({ status: 'sem_precisao_aceitavel', location });
  }).then(value => { subscription = value; if (settled) value.remove(); });
  return { cancel: () => complete({ status: 'sem_precisao_aceitavel', location: null }), done };
}
