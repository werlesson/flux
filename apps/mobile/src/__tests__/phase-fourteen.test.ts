import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import React from 'react';
import { Platform, Text, View } from 'react-native';
import { act, create } from 'react-test-renderer';

import { ActivityRouteMap, buildRoutePolylines, calculateRouteCamera, type RouteCoordinate } from '@/components/activity-route-map';
import { runMigrations } from '@/database/migrations';
import { NodeSQLiteAdapter } from '@/database/node-adapter';
import { ActivitiesRepository } from '@/database/repositories/activities';
import { ActivityPointsRepository } from '@/database/repositories/activity-points';
import { bootstrapLocalUser, seedLookups } from '@/database/seeds';

// eslint-disable-next-line no-restricted-imports -- app.config.ts fica na raiz do app, fora de src/, e o alias @/* so alcanca src/.
import appConfig from '../../app.config';

let mockExpoMapsAvailable = true;
let mockGoogleMapsConfigured = false;
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { get expoConfig() { return { name: 'Flux', slug: 'flux', extra: { googleMapsApiKeyConfigured: mockGoogleMapsConfigured } }; } },
}));
jest.mock('expo-maps', () => ({
  get GoogleMaps() {
    const mockReact = require('react') as typeof React;
    const mockView = require('react-native').View as typeof View;
    return mockExpoMapsAvailable ? { View: (props: object) => mockReact.createElement(mockView, { ...props, testID: 'google-map' }) } : undefined;
  },
}));

const point = (latitude: number, longitude: number, seconds: number, segmentIndex = 0): RouteCoordinate => ({ latitude, longitude, recordedAt: new Date(seconds * 1000), segmentIndex });

describe('fase 14 — mapa do percurso', () => {
  const configureMapForTest = () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    mockGoogleMapsConfigured = true;
  };

  afterEach(() => {
    mockExpoMapsAvailable = true;
    mockGoogleMapsConfigured = false;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('pontos rejeitados não entram na polyline', async () => {
    const database = new NodeSQLiteAdapter(); await runMigrations(database); await seedLookups(database); const userId = await bootstrapLocalUser(database);
    const activity = await new ActivitiesRepository(database).criar({ user_id: userId, activity_type_slug: 'free_run', started_at: new Date(0) });
    const repository = new ActivityPointsRepository(database);
    await repository.inserir([
      { activity_id: activity.id, latitude: -3.7, longitude: -38.5, recorded_at: new Date(1000), is_valid: true },
      { activity_id: activity.id, latitude: 40, longitude: 40, recorded_at: new Date(2000), is_valid: false, rejection_reason_slug: 'position_jump' },
      { activity_id: activity.id, latitude: -3.71, longitude: -38.51, recorded_at: new Date(3000), is_valid: true },
    ]);
    const valid = await repository.listarValidos(activity.id);
    const lines = buildRoutePolylines(valid.map(item => ({ latitude: item.latitude, longitude: item.longitude, recordedAt: item.recorded_at, segmentIndex: item.segment_index })));
    expect(lines.flatMap(line => line.coordinates)).toEqual([{ latitude: -3.7, longitude: -38.5 }, { latitude: -3.71, longitude: -38.51 }]); database.close();
  });

  it('lacuna gera segmentos separados e não uma reta', () => {
    const lines = buildRoutePolylines([point(-3.7, -38.5, 1, 0), point(-3.71, -38.51, 2, 0), point(-3.8, -38.6, 3, 1), point(-3.81, -38.61, 4, 1)]);
    expect(lines).toHaveLength(2); expect(lines.map(line => line.coordinates.length)).toEqual([2, 2]);
  });

  it('mantém zigue-zague e calcula enquadramento com margem e zoom legível', () => {
    const route = [point(-3.70, -38.50, 3), point(-3.72, -38.48, 1), point(-3.68, -38.46, 2)];
    expect(buildRoutePolylines(route)[0]?.coordinates).toEqual([{ latitude: -3.72, longitude: -38.48 }, { latitude: -3.68, longitude: -38.46 }, { latitude: -3.70, longitude: -38.50 }]);
    expect(calculateRouteCamera(route)?.zoom).toBeLessThan(18);
    expect(calculateRouteCamera([point(-3.7, -38.5, 1)])?.zoom).toBeLessThanOrEqual(18);
  });

  it('sem chave configura estado degradado e não inclui segredo no versionamento', () => {
    const previous = process.env.GOOGLE_MAPS_API_KEY; delete process.env.GOOGLE_MAPS_API_KEY;
    const context: Parameters<typeof appConfig>[0] = { config: { name: 'x', slug: 'x' }, projectRoot: '', staticConfigPath: null, packageJsonPath: '' };
    const config = appConfig(context);
    expect(config.android?.config?.googleMaps?.apiKey).toBeUndefined(); expect(config.extra?.googleMapsApiKeyConfigured).toBe(false);
    process.env.GOOGLE_MAPS_API_KEY = 'external-key'; const configured = appConfig(context);
    expect(configured.android?.config?.googleMaps?.apiKey).toBe('external-key');
    if (previous === undefined) delete process.env.GOOGLE_MAPS_API_KEY; else process.env.GOOGLE_MAPS_API_KEY = previous;
  });

  it('sem chave renderiza o aviso degradado sem carregar a biblioteca nativa', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(React.createElement(ActivityRouteMap, { coordinates: [point(-3.7, -38.5, 1)] })); });
    expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'SEM PERCURSO PARA EXIBIR')).toBe(true);
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' })).toBeTruthy();
    act(() => renderer.unmount());
  });

  it('falha ao carregar a biblioteca nativa cai no aviso sem quebrar a tela', () => {
    configureMapForTest();
    mockExpoMapsAvailable = false;
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(React.createElement(ActivityRouteMap, { coordinates: [point(-3.7, -38.5, 1)] })); });
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' })).toBeTruthy();
    expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'SEM PERCURSO PARA EXIBIR')).toBe(true);
    act(() => renderer.unmount());
  });

  it('falha de carregamento dos tiles cai no aviso após o tempo limite', () => {
    configureMapForTest();
    jest.useFakeTimers();
    let renderer!: ReturnType<typeof create>;
    act(() => { renderer = create(React.createElement(ActivityRouteMap, { coordinates: [point(-3.7, -38.5, 1)] })); });
    expect(renderer.root.findByProps({ testID: 'google-map' })).toBeTruthy();
    act(() => { jest.advanceTimersByTime(10_000); });
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' })).toBeTruthy();
    expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'SEM PERCURSO PARA EXIBIR')).toBe(true);
    act(() => renderer.unmount());
  });

  it('isola expo-maps no componente e integra somente resultado e detalhe', () => {
    const root = join(__dirname, '..'); const map = readFileSync(join(root, 'components/activity-route-map.tsx'), 'utf8'); const result = readFileSync(join(root, 'app/activity-result.tsx'), 'utf8'); const detail = readFileSync(join(root, 'app/activity-detail.tsx'), 'utf8'); const active = readFileSync(join(root, 'app/activity.tsx'), 'utf8');
    expect(map).toContain("require('expo-maps')"); expect(map).toContain('interface ActivityRouteMapProps { coordinates: RouteCoordinate[] }'); expect(result).toContain('ActivityRouteMap'); expect(detail).toContain('ActivityRouteMap'); expect(active).not.toContain('ActivityRouteMap'); expect(result).not.toContain('<ActivityRouteMap expanded='); expect(detail).not.toContain('<ActivityRouteMap expanded=');
  });
});
