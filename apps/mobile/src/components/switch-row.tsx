import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function SwitchRow({ label, caption, value, disabled = false, onValueChange }: { label: string; caption?: string; value: boolean; disabled?: boolean; onValueChange: (value: boolean) => void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onValueChange(!value)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.copy}><Text style={[styles.label, { color: theme.colors.text, fontFamily: theme.fonts.title.medium }]}>{label}</Text>{caption ? <Text style={[styles.caption, { color: theme.colors.textSecondary, fontFamily: theme.fonts.title.regular }]}>{caption}</Text> : null}</View><Switch pointerEvents="none" trackColor={{ false: theme.colors.border, true: theme.colors.action }} thumbColor={theme.colors.text} value={value} /></Pressable>;
}
const styles = StyleSheet.create({ row: { alignItems: 'center', flexDirection: 'row', minHeight: 64, paddingVertical: 8 }, copy: { flex: 1, paddingRight: 16 }, label: { fontSize: 17 }, caption: { fontSize: 13, marginTop: 3 }, pressed: { opacity: 0.7 } });
