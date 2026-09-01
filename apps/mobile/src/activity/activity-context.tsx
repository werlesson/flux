import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { getLocalUserId, initializeDatabase } from '@/database';
import type { ActivityStatusSlug } from '@/database/types';
import type { GpsSample } from '@/gps/filter';
import type { SignalQuality } from '@/gps/signal-quality';
import { BACKGROUND_LOCATION_WARNING, setBackgroundGpsConsumer, startLocationTracking, stopLocationTracking } from '@/location/background-location';
import { LocationPermissions } from '@/location/permissions';

import { ActivityEngine, type ActivityMetricsSnapshot, type ActivityRecoverySnapshot } from './engine';
import { announceTrainingFinished } from './training-guidance';

interface ActivityContextValue extends ActivityMetricsSnapshot {
  status: ActivityStatusSlug | null;
  signalQuality: SignalQuality;
  activityId: number | null;
  trainingName: string | null;
  pendingRecovery: ActivityRecoverySnapshot | null;
  currentStep: ActivityRecoverySnapshot['currentStep'];
  trainingFinished: boolean;
  startFreeRun(): Promise<void>;
  startStructuredRun(trainingSessionId: number, trainingName: string): Promise<void>;
  ingest(sample: GpsSample): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  skipTrainingStep(): Promise<void>;
  finish(): Promise<void>;
  discard(): Promise<void>;
  resumeInterrupted(): Promise<void>;
  finishInterrupted(): Promise<void>;
}

const emptyMetrics: ActivityMetricsSnapshot = { elapsed: 0, moving: 0, distance: 0, currentPace: null, averagePace: null };
const ActivityContext = createContext<ActivityContextValue | null>(null);

export function ActivityProvider({ children }: PropsWithChildren) {
  const [engine, setEngine] = useState<ActivityEngine | null>(null);
  const [pendingRecovery, setPendingRecovery] = useState<ActivityRecoverySnapshot | null>(null);
  const [trainingFinished, setTrainingFinished] = useState(false);
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
      restoredEngine.onTrainingFinished(async () => {
        if (!mounted) return;
        setTrainingFinished(true);
        await announceTrainingFinished(database);
        refresh();
      });
      setPendingRecovery(await restoredEngine.recoverySnapshot());
      setBackgroundGpsConsumer(sample => restoredEngine.ingest(sample));
      setEngine(restoredEngine);
    });
    return () => {
      mounted = false;
      setBackgroundGpsConsumer();
    };
  }, []);

  useEffect(() => {
    let advancing = false;
    const advanceAndRefresh = async () => {
      if (advancing || !engine) return;
      advancing = true;
      try {
        await engine.advanceTraining();
        refresh();
      } finally {
        advancing = false;
      }
    };
    const timer = setInterval(() => { void advanceAndRefresh(); }, 1_000);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void advanceAndRefresh();
      else void engine?.onBackground();
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
    trainingName: engine?.trainingName ?? null,
    pendingRecovery,
    currentStep: engine?.currentStep ?? null,
    trainingFinished,
    startFreeRun: () => action(async item => {
      const permissions = await new LocationPermissions().checkAndRequest();
      if (permissions.foreground !== 'concedida') throw new Error('Permissão de localização em primeiro plano é obrigatória');
      if (permissions.background !== 'concedida') Alert.alert('Gravação em segundo plano indisponível', BACKGROUND_LOCATION_WARNING);
      await item.startFreeRun(getLocalUserId());
      try {
        await startLocationTracking(true);
      } catch (error) {
        await item.discard();
        throw error;
      }
    }),
    startStructuredRun: (trainingSessionId, trainingName) => action(async item => {
      setTrainingFinished(false);
      const permissions = await new LocationPermissions().checkAndRequest();
      if (permissions.foreground !== 'concedida') throw new Error('Permissão de localização em primeiro plano é obrigatória');
      if (permissions.background !== 'concedida') Alert.alert('Gravação em segundo plano indisponível', BACKGROUND_LOCATION_WARNING);
      await item.startStructuredRun(getLocalUserId(), trainingSessionId, trainingName);
      try {
        await startLocationTracking(true, trainingName);
      } catch (error) {
        await item.discard();
        throw error;
      }
    }),
    ingest: sample => action(item => item.ingest(sample)),
    pause: () => action(item => item.pause()),
    resume: () => action(item => item.resume()),
    skipTrainingStep: () => action(item => item.skipTrainingStep()),
    finish: () => action(async item => { await item.finish(); await stopLocationTracking(); }),
    discard: () => action(async item => { await item.discard(); await stopLocationTracking(); }),
    resumeInterrupted: () => action(async item => {
      if (!pendingRecovery) return;
      if (item.status === 'paused') await item.resume();
      await startLocationTracking(true, pendingRecovery.trainingName);
      setPendingRecovery(null);
      refresh();
    }),
    finishInterrupted: () => action(async item => {
      if (!pendingRecovery) return;
      await item.finish();
      await stopLocationTracking();
      setPendingRecovery(null);
      refresh();
    }),
  };

  if (!engine) return null;
  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity(): ActivityContextValue {
  const value = useContext(ActivityContext);
  if (!value) throw new Error('useActivity deve ser usado dentro de ActivityProvider');
  return value;
}
