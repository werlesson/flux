import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { getLocalUserId, initializeDatabase } from '@/database';
import type { ActivityStatusSlug } from '@/database/types';
import type { GpsSample } from '@/gps/filter';
import type { SignalQuality } from '@/gps/signal-quality';
import { setBackgroundGpsConsumer, startLocationTracking, stopLocationTracking } from '@/location/background-location';

import { ActivityEngine, type ActivityMetricsSnapshot } from './engine';

interface ActivityContextValue extends ActivityMetricsSnapshot {
  status: ActivityStatusSlug | null;
  signalQuality: SignalQuality;
  activityId: number | null;
  startFreeRun(): Promise<void>;
  ingest(sample: GpsSample): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  finish(): Promise<void>;
}

const emptyMetrics: ActivityMetricsSnapshot = { elapsed: 0, moving: 0, distance: 0, currentPace: null, averagePace: null };
const ActivityContext = createContext<ActivityContextValue | null>(null);

export function ActivityProvider({ children }: PropsWithChildren) {
  const [engine, setEngine] = useState<ActivityEngine | null>(null);
  const [, render] = useState(0);
  const refresh = useCallback(() => render(value => value + 1), []);

  useEffect(() => {
    let mounted = true;
    void initializeDatabase().then(async database => {
      const restoredEngine = new ActivityEngine(database, {
        onStartError: message => Alert.alert('Atividade não iniciada', message),
      });
      await restoredEngine.restoreLastActivity();
      if (!mounted) return;
      setBackgroundGpsConsumer(sample => restoredEngine.ingest(sample));
      setEngine(restoredEngine);
    });
    return () => {
      mounted = false;
      setBackgroundGpsConsumer();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(refresh, 1_000); // tick apenas solicita render; elapsed vem dos timestamps.
    const appState = AppState.addEventListener('change', state => {
      if (state !== 'active') void engine?.onBackground();
      refresh();
    });
    return () => { clearInterval(timer); appState.remove(); };
  }, [engine, refresh]);

  const action = useCallback(async (operation: (current: ActivityEngine) => Promise<unknown>) => {
    if (!engine) throw new Error('Motor da atividade ainda não está pronto');
    await operation(engine);
    refresh();
  }, [engine, refresh]);

  const value: ActivityContextValue = {
    ...(engine?.metrics() ?? emptyMetrics),
    status: engine?.status ?? null,
    signalQuality: engine?.signalQuality ?? 'sem_sinal',
    activityId: engine?.id ?? null,
    startFreeRun: () => action(async item => {
      await item.startFreeRun(getLocalUserId());
      await startLocationTracking(true);
    }),
    ingest: sample => action(item => item.ingest(sample)),
    pause: () => action(item => item.pause()),
    resume: () => action(item => item.resume()),
    finish: () => action(async item => { await item.finish(); await stopLocationTracking(); }),
  };

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity(): ActivityContextValue {
  const value = useContext(ActivityContext);
  if (!value) throw new Error('useActivity deve ser usado dentro de ActivityProvider');
  return value;
}
