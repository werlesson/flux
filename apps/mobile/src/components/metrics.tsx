import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function MetricTile({ label, value }: { label: string; value?: ReactNode | null }) {
  const theme = useTheme();
  return <View style={[styles.tile, { backgroundColor: theme.colors.surface }]}><Text style={[styles.label, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.semibold }]}>{label.toLocaleUpperCase('pt-BR')}</Text><Text style={[styles.value, { color: theme.colors.text, fontFamily: theme.fonts.title.semibold }]}>{value ?? '—'}</Text></View>;
}
export function MetricGrid({ children }: { children: ReactNode }) { return <View style={styles.grid}>{children}</View>; }
const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, tile: { borderRadius: 12, flexBasis: '47%', flexGrow: 1, minHeight: 82, padding: 16 }, label: { fontSize: 11, letterSpacing: 1.2 }, value: { fontSize: 26, marginTop: 5 } });
