import Constants from 'expo-constants';
import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export interface RouteCoordinate { latitude: number; longitude: number; recordedAt: Date; segmentIndex: number }
interface ActivityRouteMapProps { coordinates: RouteCoordinate[] }
const FALLBACK_COPY = 'Nenhum ponto de GPS válido foi registrado nesta atividade, então o mapa não é exibido. O tempo gravado é mantido.';

export function buildRoutePolylines(coordinates: RouteCoordinate[]) {
  const valid = coordinates.filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180).sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const segments = new Map<number, { latitude: number; longitude: number }[]>();
  for (const point of valid) { const segment = segments.get(point.segmentIndex) ?? []; segment.push({ latitude: point.latitude, longitude: point.longitude }); segments.set(point.segmentIndex, segment); }
  return [...segments.entries()].map(([segmentIndex, points]) => ({ id: `route-${segmentIndex}`, coordinates: points, color: '#D6431A', width: 6 }));
}

export function calculateRouteCamera(coordinates: RouteCoordinate[]) {
  const points = buildRoutePolylines(coordinates).flatMap(line => line.coordinates); if (!points.length) return null;
  const minLat = Math.min(...points.map(point => point.latitude)); const maxLat = Math.max(...points.map(point => point.latitude)); const minLon = Math.min(...points.map(point => point.longitude)); const maxLon = Math.max(...points.map(point => point.longitude));
  const latitude = (minLat + maxLat) / 2; const longitude = (minLon + maxLon) / 2;
  const spanMeters = Math.max((maxLat - minLat) * 111_320, (maxLon - minLon) * 111_320 * Math.max(0.1, Math.cos(latitude * Math.PI / 180)), 180) * 1.35;
  return { coordinates: { latitude, longitude }, zoom: Math.max(2, Math.min(18, Math.log2(40_075_016 / spanMeters))) };
}

function MapFallback() {
  const theme = useTheme();
  return <View accessibilityRole="alert" style={[styles.fallback, { backgroundColor: theme.colors.surface }]}><Text style={[styles.fallbackTitle, { color: theme.colors.highlight }]}>SEM PERCURSO PARA EXIBIR</Text><Text style={{ color: theme.colors.textSecondary }}>{FALLBACK_COPY}</Text></View>;
}

class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }; static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* O mapa é complementar; a tela deve continuar disponível. */ }
  render() { return this.state.failed ? <MapFallback /> : this.props.children; }
}

export function ActivityRouteMap({ coordinates }: ActivityRouteMapProps) {
  const [loaded, setLoaded] = useState(false); const [loadFailed, setLoadFailed] = useState(false); const polylines = useMemo(() => buildRoutePolylines(coordinates), [coordinates]); const cameraPosition = useMemo(() => calculateRouteCamera(coordinates), [coordinates]);
  const canAttemptLoad = Constants.expoConfig?.extra?.googleMapsApiKeyConfigured === true && Platform.OS === 'android' && cameraPosition !== null && polylines.length > 0;
  useEffect(() => { if (!canAttemptLoad || loaded) return; const timeout = setTimeout(() => setLoadFailed(true), 10_000); return () => clearTimeout(timeout); }, [canAttemptLoad, loaded]);
  if (loadFailed) return <MapFallback />;
  if (!canAttemptLoad || !cameraPosition) return <MapFallback />;
  let GoogleMaps: typeof import('expo-maps').GoogleMaps | undefined;
  try { GoogleMaps = require('expo-maps')?.GoogleMaps as typeof import('expo-maps').GoogleMaps | undefined; } catch { return <MapFallback />; }
  if (!GoogleMaps?.View) return <MapFallback />;
  return <MapErrorBoundary><View style={styles.container}>{!loaded ? <View style={styles.loading}><Text style={styles.loadingText}>CARREGANDO MAPA…</Text></View> : null}<GoogleMaps.View cameraPosition={cameraPosition} contentPadding={{ top: 24, bottom: 24, start: 24, end: 24 }} onMapLoaded={() => setLoaded(true)} polylines={polylines} properties={{ maxZoomPreference: 18, selectionEnabled: false }} style={StyleSheet.absoluteFill} uiSettings={{ compassEnabled: false, mapToolbarEnabled: false, rotationGesturesEnabled: false, scrollGesturesEnabled: false, tiltGesturesEnabled: false, zoomControlsEnabled: false, zoomGesturesEnabled: false }} /></View></MapErrorBoundary>;
}

const styles = StyleSheet.create({ container: { borderRadius: 16, flex: 1, overflow: 'hidden' }, fallback: { borderRadius: 16, flex: 1, minHeight: 120, padding: 18 }, fallbackTitle: { fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 }, loading: { alignItems: 'center', backgroundColor: '#E9E6DE', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 }, loadingText: { color: '#6D6257', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 } });
