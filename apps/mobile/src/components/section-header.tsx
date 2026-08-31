import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function SectionHeader({ title, count, actionLabel, onAction }: { title: string; count?: number; actionLabel?: string; onAction?: () => void }) {
  const theme = useTheme();
  return <View style={styles.row}><Text style={[styles.title, { color: theme.colors.textSecondary, fontFamily: theme.fonts.data.semibold }]}>{title.toLocaleUpperCase('pt-BR')}{count === undefined ? '' : ` · ${count}`}</Text>{actionLabel ? <Pressable accessibilityRole="button" onPress={onAction} style={styles.action}><Text style={{ color: theme.colors.action, fontFamily: theme.fonts.title.semibold }}>{actionLabel}</Text></Pressable> : null}</View>;
}
const styles = StyleSheet.create({ row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 44 }, title: { fontSize: 11, letterSpacing: 1.2 }, action: { justifyContent: 'center', minHeight: 44 } });
