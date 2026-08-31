import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import fs from 'node:fs';
import path from 'node:path';

import { haversineDistanceMeters } from '@/gps/distance';
import { createGpsFilterState, filterGpsSample, type GpsFilterState, type GpsSample } from '@/gps/filter';
import { GpsFilterOrchestrator } from '@/gps/orchestrator';
import { addSignalSample, createSignalQualityState, evaluateSignalTimeout } from '@/gps/signal-quality';
import { maxAccuracyMeters, maxPositionJumpMeters, maxSampleIntervalSeconds } from '@/gps/thresholds';
import { LOCATION_TASK_NAME, startLocationTracking, stopLocationTracking } from '@/location/background-location';
import { acquireInitialFix } from '@/location/initial-fix';
import { LocationPermissions, type PermissionApi } from '@/location/permissions';

const at = (seconds: number, overrides: Partial<GpsSample> = {}): GpsSample => ({ latitude: 0, longitude: 0, accuracy: maxAccuracyMeters, recordedAt: seconds * 1000, ...overrides });
const acceptedState = (): GpsFilterState => filterGpsSample(at(0), createGpsFilterState()).estado;

describe('configuração dos limiares', () => {
  it('não hardcoda os valores dos limiares fora do módulo de configuração', () => {
    const sourceDirectory = path.join(__dirname, '..');
    const gpsDirectory = path.join(sourceDirectory, 'gps');
    const thresholdSource = fs.readFileSync(path.join(gpsDirectory, 'thresholds.ts'), 'utf8');
    const configuredValues = [...thresholdSource.matchAll(/export const \w+ = ([\d_]+);/g)].map(match => match[1]!.replaceAll('_', ''));
    const productionSources = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : productionSources(entryPath);
      return /\.tsx?$/.test(entry.name) && entryPath !== path.join(gpsDirectory, 'thresholds.ts') ? [entryPath] : [];
    });
    const otherSources = [path.join(sourceDirectory, 'gps'), path.join(sourceDirectory, 'location')]
      .flatMap(productionSources)
      .map(file => fs.readFileSync(file, 'utf8'))
      .join('\n');

    for (const value of configuredValues.filter(value => Number(value) > 1)) {
      expect(otherSources).not.toMatch(new RegExp(`(?:^|[^\\w.])${value}(?:[^\\w.]|$)`));
    }
  });
});

describe('distância geográfica', () => {
  it('bate uma referência conhecida dentro de 0,5%', () => expect(haversineDistanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.001 })).toBeCloseTo(111.195, 2));
  it('é exatamente zero para o mesmo ponto', () => expect(haversineDistanceMeters({ latitude: -3.7, longitude: -38.5 }, { latitude: -3.7, longitude: -38.5 })).toBe(0));
  it('não acumula erro perceptível em mil segmentos curtos', () => {
    let total = 0;
    for (let index = 0; index < 1000; index += 1) total += haversineDistanceMeters({ latitude: 0, longitude: index / 1_000_000 }, { latitude: 0, longitude: (index + 1) / 1_000_000 });
    expect(total).toBeCloseTo(haversineDistanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.001 }), 8);
  });
});

describe('filtro de GPS', () => {
  it('aceita 5 m, rejeita 60 m e accuracy ausente', () => {
    expect(filterGpsSample(at(0, { accuracy: 5 }), createGpsFilterState()).decisao.aceito).toBe(true);
    expect(filterGpsSample(at(0, { accuracy: 60 }), createGpsFilterState()).decisao).toMatchObject({ aceito: false, motivo: 'low_accuracy' });
    expect(filterGpsSample(at(0, { accuracy: null }), createGpsFilterState()).decisao).toMatchObject({ aceito: false, motivo: 'low_accuracy' });
  });
  it('aceita accuracy no limiar exato e a primeira amostra não soma', () => expect(filterGpsSample(at(0), createGpsFilterState()).decisao).toMatchObject({ aceito: true, distanciaIncremental: 0 }));
  it('rejeita 500 m em 2 s por velocidade e aceita corrida normal', () => {
    expect(filterGpsSample(at(2, { longitude: 0.0045 }), acceptedState()).decisao).toMatchObject({ aceito: false, motivo: 'implausible_speed' });
    expect(filterGpsSample(at(2, { longitude: 0.00008 }), acceptedState()).decisao.aceito).toBe(true);
  });
  it('uma rejeição não contamina a amostra seguinte', () => {
    const state = acceptedState();
    const rejected = filterGpsSample(at(2, { longitude: 0.0045 }), state);
    expect(rejected.estado).toEqual(state);
    expect(filterGpsSample(at(3, { longitude: 0.0001 }), rejected.estado).decisao.aceito).toBe(true);
  });
  it('rejeita salto mesmo quando a velocidade seria plausível', () => {
    const state = acceptedState();
    const seconds = maxPositionJumpMeters / 10;
    expect(filterGpsSample(at(seconds, { longitude: 0.0027 }), state).decisao).toMatchObject({ aceito: false, motivo: 'position_jump' });
  });
  it('rejeita amostras fora de ordem e duplicadas', () => {
    for (const seconds of [-1, 0]) expect(filterGpsSample(at(seconds), acceptedState()).decisao).toMatchObject({ aceito: false, motivo: 'stale_sample' });
  });
  it('rejeita intervalo acima do máximo como stale_sample', () => {
    expect(filterGpsSample(at(maxSampleIntervalSeconds + 1), acceptedState()).decisao).toMatchObject({ aceito: false, motivo: 'stale_sample', lacuna: true });
  });
  it('usa ordem determinística: precisão vem antes das demais regras', () => expect(filterGpsSample(at(0, { accuracy: 60, longitude: 1 }), acceptedState()).decisao).toMatchObject({ motivo: 'low_accuracy' }));
  it('mantém a decisão após serializar e restaurar o estado', () => {
    const restored = JSON.parse(JSON.stringify(acceptedState())) as GpsFilterState;
    expect(filterGpsSample(at(2, { longitude: 0.00008 }), restored)).toEqual(filterGpsSample(at(2, { longitude: 0.00008 }), acceptedState()));
  });
  it('pontos ruins não alteram a distância da série', () => {
    const run = (samples: GpsSample[]) => samples.reduce((acc, sample) => { const result = filterGpsSample(sample, acc.state); return { state: result.estado, distance: acc.distance + (result.decisao.aceito ? result.decisao.distanciaIncremental : 0) }; }, { state: createGpsFilterState(), distance: 0 });
    const clean = [at(0), at(2, { longitude: 0.00005 }), at(4, { longitude: 0.0001 })];
    const dirty = [clean[0], at(1, { longitude: 0.02, accuracy: 60 }), ...clean.slice(1)];
    expect(run(dirty).distance).toBeCloseTo(run(clean).distance, 10);
  });
  it('marca lacuna, não soma o salto e abre um novo segmento', () => {
    const stale = filterGpsSample(at(120, { longitude: 0.01 }), acceptedState());
    expect(stale.decisao).toMatchObject({ aceito: false, motivo: 'stale_sample', lacuna: true });
    const resumed = filterGpsSample(at(122, { longitude: 0.01005 }), stale.estado);
    expect(resumed.decisao).toMatchObject({ aceito: true, distanciaIncremental: 0, descontinuidade: true, segmento: 1 });
    const following = filterGpsSample(at(124, { longitude: 0.0101 }), resumed.estado);
    expect(following.decisao).toMatchObject({ aceito: true, descontinuidade: false, segmento: 1 });
    expect(following.decisao.aceito && following.decisao.distanciaIncremental).toBeGreaterThan(0);
  });
});

describe('permissões', () => {
  // `status` precisa ser o enum PermissionStatus do expo-location, não a string
  // literal: com a literal o objeto não satisfaz PermissionResponse e o tsc
  // reprova, ainda que o jest passe (o gate 2 não faz typecheck).
  const response = (status: 'granted' | 'denied', canAskAgain: boolean) => ({
    status: status === 'granted' ? Location.PermissionStatus.GRANTED : Location.PermissionStatus.DENIED,
    canAskAgain,
  });
  it('só solicita background após foreground concedido', async () => {
    const calls: string[] = [];
    const api: PermissionApi = {
      getForegroundPermissionsAsync: async () => response('denied', true), requestForegroundPermissionsAsync: async () => { calls.push('foreground'); return response('granted', true); },
      getBackgroundPermissionsAsync: async () => response('denied', true), requestBackgroundPermissionsAsync: async () => { calls.push('background'); return response('granted', true); },
    };
    expect(await new LocationPermissions(api).checkAndRequest()).toEqual({ foreground: 'concedida', background: 'concedida' });
    expect(calls).toEqual(['foreground', 'background']);
  });
  it('distingue negativa permanente e não solicita background', async () => {
    const requestBackgroundPermissionsAsync = jest.fn();
    const api: PermissionApi = { getForegroundPermissionsAsync: async () => response('denied', false), requestForegroundPermissionsAsync: jest.fn(), getBackgroundPermissionsAsync: async () => response('denied', false), requestBackgroundPermissionsAsync };
    expect(await new LocationPermissions(api).checkAndRequest()).toEqual({ foreground: 'negada_permanentemente', background: 'negada_permanentemente' });
    expect(requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('fix inicial', () => {
  beforeEach(() => jest.clearAllMocks());
  it('publica boa precisão e pode ser cancelado', async () => {
    let callback!: (location: Location.LocationObject) => void;
    const remove = jest.fn();
    jest.mocked(Location.watchPositionAsync).mockImplementation(async (_options, next) => { callback = next; return { remove }; });
    const states: string[] = [];
    const attempt = acquireInitialFix(state => states.push(state.status));
    await Promise.resolve();
    callback({ timestamp: 0, coords: { latitude: 0, longitude: 0, altitude: null, accuracy: 5, altitudeAccuracy: null, heading: null, speed: null } });
    expect((await attempt.done).status).toBe('boa_precisao'); expect(states).toEqual(['aguardando', 'boa_precisao']); expect(remove).toHaveBeenCalled();
  });
  it('sem fix aceitável não bloqueia e cancelamento encerra', async () => {
    jest.mocked(Location.watchPositionAsync).mockResolvedValue({ remove: jest.fn() });
    const attempt = acquireInitialFix(() => undefined); attempt.cancel();
    await expect(attempt.done).resolves.toMatchObject({ status: 'sem_precisao_aceitavel' });
  });
});

describe('assinatura em background', () => {
  beforeEach(() => jest.clearAllMocks());
  it('registra a task no carregamento do módulo e exige foreground', async () => {
    jest.isolateModules(() => { require('@/location/background-location'); });
    expect(TaskManager.defineTask).toHaveBeenCalledWith(LOCATION_TASK_NAME, expect.any(Function));
    await expect(startLocationTracking(false)).rejects.toThrow(/primeiro plano/);
    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });
  it('não inicia nenhuma coleta quando foreground é negada', async () => {
    jest.mocked(Location.startLocationUpdatesAsync).mockClear();
    await expect(startLocationTracking(false)).rejects.toThrow();
    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });
  it('entrega as amostras da task ao orquestrador do filtro', async () => {
    const results: boolean[] = [];
    jest.isolateModules(() => {
      const isolated = require('@/location/background-location') as typeof import('@/location/background-location');
      isolated.setBackgroundGpsOrchestrator(new GpsFilterOrchestrator(undefined, (_sample, result) => {
        results.push(result.decisao.aceito);
      }));
    });
    const task = jest.mocked(TaskManager.defineTask).mock.calls.at(-1)![1] as (body: { data: { locations: Location.LocationObject[] }; error: null; executionInfo: { eventId: string; taskName: string } }) => Promise<void>;
    await task({ data: { locations: [{ timestamp: 0, coords: { latitude: 0, longitude: 0, altitude: null, accuracy: 5, altitudeAccuracy: null, heading: null, speed: null } }] }, error: null, executionInfo: { eventId: 'test', taskName: LOCATION_TASK_NAME } });
    expect(results).toEqual([true]);
  });
  it('inicia e encerra a assinatura', async () => {
    jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true);
    await startLocationTracking(true); await stopLocationTracking();
    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(LOCATION_TASK_NAME, expect.any(Object));
    expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(LOCATION_TASK_NAME);
  });
});

describe('qualidade do sinal', () => {
  it('tem histerese contra leitura ruim isolada e degrada com janela ruim', () => {
    let state = addSignalSample(createSignalQualityState(), 5, 0);
    state = addSignalSample(state, 60, 1_000); expect(state.quality).toBe('boa_precisao');
    state = addSignalSample(state, 60, 2_000); expect(state.quality).toBe('precisao_degradada');
  });
  it('vira sem sinal e retorna a boa precisão', () => {
    let state = addSignalSample(createSignalQualityState(), 5, 0);
    state = evaluateSignalTimeout(state, (maxSampleIntervalSeconds + 1) * 1000); expect(state.quality).toBe('sem_sinal');
    state = addSignalSample(state, 5, (maxSampleIntervalSeconds + 2) * 1000); expect(state.quality).toBe('boa_precisao');
  });
});
