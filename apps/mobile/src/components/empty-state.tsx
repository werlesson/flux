import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';

export function EmptyState({ title, message, actionLabel, onAction }: { title: string; message: string; actionLabel?: string; onAction?: () => void }) {
  const theme = useTheme();
  return <View style={styles.container}><Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.title.semibold }]}>{title}</Text><Text style={[styles.message, { color: theme.colors.textSecondary, fontFamily: theme.fonts.title.regular }]}>{message}</Text>{actionLabel && onAction ? <View style={styles.action}><Button onPress={onAction}>{actionLabel}</Button></View> : null}</View>;
}
const styles = StyleSheet.create({ container: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 24 }, title: { fontSize: 24, textAlign: 'center' }, message: { fontSize: 16, lineHeight: 24, marginTop: 12, textAlign: 'center' }, action: { marginTop: 24, width: '100%' } });
