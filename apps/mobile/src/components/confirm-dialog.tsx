import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { Button } from './button';

export function ConfirmDialog({ visible, title, message, summary, confirmLabel, cancelLabel = 'Cancelar', destructive = false, dismissible = true, onConfirm, onCancel }: { visible: boolean; title: string; message: string; summary?: ReactNode; confirmLabel: string; cancelLabel?: string; destructive?: boolean; dismissible?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const theme = useTheme();
  return <Modal animationType="fade" onRequestClose={() => dismissible && onCancel()} transparent visible={visible}>
    <View style={styles.modal}><Pressable disabled={!dismissible} onPress={onCancel} style={styles.backdrop} />
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.title.semibold }]}>{title}</Text>
        <Text style={[styles.message, { color: theme.colors.textSecondary, fontFamily: theme.fonts.title.regular }]}>{message}</Text>
        {summary ? <View style={[styles.summary, { backgroundColor: theme.colors.surface }]}>{summary}</View> : null}
        <View style={styles.actions}><Button onPress={onCancel} variant="secondary">{cancelLabel}</Button><Button onPress={onConfirm} variant={destructive ? 'destructive' : 'primary'}>{confirmLabel}</Button></View>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ modal: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 }, backdrop: { backgroundColor: 'rgba(0,0,0,0.4)', ...StyleSheet.absoluteFill }, dialog: { borderRadius: 20, borderWidth: 1, maxWidth: 440, padding: 24, width: '100%' }, title: { fontSize: 24 }, message: { fontSize: 16, lineHeight: 24, marginTop: 10 }, summary: { borderRadius: 12, marginTop: 16, padding: 16 }, actions: { gap: 10, marginTop: 24 } });
