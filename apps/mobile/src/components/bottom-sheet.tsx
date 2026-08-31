import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

export function BottomSheet({ visible, children, footer, dismissible = true, onDismiss }: { visible: boolean; children: ReactNode; footer?: ReactNode; dismissible?: boolean; onDismiss: () => void }) {
  const theme = useTheme();
  return <Modal animationType="slide" onRequestClose={() => dismissible && onDismiss()} transparent visible={visible}>
    <View style={styles.modal}><Pressable accessibilityLabel="Fechar" disabled={!dismissible} onPress={onDismiss} style={styles.backdrop} />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: theme.colors.surfaceElevated }]}>
        <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ modal: { flex: 1, justifyContent: 'flex-end' }, backdrop: { backgroundColor: 'rgba(0,0,0,0.4)', ...StyleSheet.absoluteFill }, sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', minHeight: 180 }, handle: { alignSelf: 'center', borderRadius: 4, height: 4, marginTop: 10, width: 40 }, content: { padding: 24 }, footer: { paddingBottom: 12, paddingHorizontal: 24 } });
