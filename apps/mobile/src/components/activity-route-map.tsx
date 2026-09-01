import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ActivityPoint } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';

const HEIGHT = 210;
const PADDING = 20;

export function ActivityRouteMap({ points }: { points: ActivityPoint[] }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const latitudes = points.map(point => point.latitude); const longitudes = points.map(point => point.longitude);
  const minLat = Math.min(...latitudes); const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes); const maxLon = Math.max(...longitudes);
  const latSpan = Math.max(maxLat - minLat, 0.000001); const lonSpan = Math.max(maxLon - minLon, 0.000001);
  const plotted = width === 0 ? [] : points.map(point => ({ id: point.id, segment: point.segment_index, x: PADDING + ((point.longitude - minLon) / lonSpan) * (width - PADDING * 2), y: PADDING + (1 - (point.latitude - minLat) / latSpan) * (HEIGHT - PADDING * 2) }));
  return <View accessibilityLabel={`Mapa do percurso com ${points.length} pontos válidos`} accessibilityRole="image" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.map, { backgroundColor: theme.isDark ? '#252B27' : '#E9E6DE' }]}>
    <View style={[styles.roadHorizontal, { backgroundColor: theme.isDark ? '#343C36' : '#F7F4EC' }]} /><View style={[styles.roadVertical, { backgroundColor: theme.isDark ? '#343C36' : '#F7F4EC' }]} />
    {plotted.slice(1).map((point, index) => { const previous = plotted[index]!; if (previous.segment !== point.segment) return null; const dx = point.x - previous.x; const dy = point.y - previous.y; const length = Math.sqrt(dx * dx + dy * dy); const angle = Math.atan2(dy, dx) * 180 / Math.PI; return <View key={`${previous.id}-${point.id}`} style={[styles.line, { left: previous.x, top: previous.y, width: Math.max(length, 3), transform: [{ rotate: `${angle}deg` }] }]} />; })}
    <View style={styles.caption}><Text style={styles.captionText}>PERCURSO GRAVADO</Text></View>
  </View>;
}

const styles = StyleSheet.create({ map: { borderRadius: 16, height: HEIGHT, marginTop: 20, overflow: 'hidden', position: 'relative' }, roadHorizontal: { height: 24, left: -20, position: 'absolute', right: -20, top: 72, transform: [{ rotate: '-8deg' }] }, roadVertical: { bottom: -20, left: 92, position: 'absolute', top: -20, width: 18, transform: [{ rotate: '12deg' }] }, line: { backgroundColor: '#D6431A', borderRadius: 2, height: 4, position: 'absolute', transformOrigin: 'left center' }, caption: { backgroundColor: 'rgba(28,25,22,0.72)', borderRadius: 8, bottom: 12, left: 12, paddingHorizontal: 10, paddingVertical: 6, position: 'absolute' }, captionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 } });
