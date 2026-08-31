import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function Chip({ label, color }: { label: string; color?: string }) {
  const theme = useTheme();
  return <View style={[styles.chip, { backgroundColor: color ? `${color}20` : theme.colors.surfaceElevated }]}><Text style={[styles.text, { color: color ?? theme.colors.textSecondary, fontFamily: theme.fonts.data.regular }]}>{label}</Text></View>;
}
const styles = StyleSheet.create({ chip: { alignSelf: 'flex-start', borderRadius: 8, flexShrink: 1, paddingHorizontal: 8, paddingVertical: 5 }, text: { flexShrink: 1, fontSize: 12, lineHeight: 18 } });
