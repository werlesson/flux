import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type GpsStatus = 'good' | 'degraded' | 'no-signal' | 'unacceptable';
export const gpsStatusLabels: Record<GpsStatus, string> = { good: 'GPS: boa precisão', degraded: 'GPS: precisão degradada', 'no-signal': 'GPS: sem sinal', unacceptable: 'GPS: sem precisão aceitável' };
export function GpsStatusPill({ status }: { status: GpsStatus }) {
  const theme = useTheme();
  const color = status === 'good'
    ? theme.colors.confirmation
    : status === 'degraded' || status === 'unacceptable'
      ? theme.colors.highlight
      : theme.colors.destructive;
  const explanation = status === 'no-signal' ? 'O tempo continua contando. A distância volta a avançar quando o sinal retornar.' : undefined;
  return <View accessibilityLabel={gpsStatusLabels[status]} style={[styles.container, status === 'degraded' && { backgroundColor: theme.isDark ? '#2A1F0C' : '#FDF3E0' }]}><View style={[styles.pill, { borderColor: color }]}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={[styles.label, { color, fontFamily: theme.fonts.data.medium }]}>{gpsStatusLabels[status]}</Text></View>{explanation ? <Text style={[styles.explanation, { color: theme.colors.textSecondary, fontFamily: theme.fonts.title.regular }]}>{explanation}</Text> : null}</View>;
}
const styles = StyleSheet.create({ container: { alignItems: 'center', borderRadius: 12, padding: 8 }, pill: { alignItems: 'center', borderRadius: 999, borderWidth: 1, flexDirection: 'row', minHeight: 32, paddingHorizontal: 12 }, dot: { borderRadius: 4, height: 7, marginRight: 7, width: 7 }, label: { fontSize: 11 }, explanation: { fontSize: 13, lineHeight: 18, marginTop: 8, textAlign: 'center' } });
