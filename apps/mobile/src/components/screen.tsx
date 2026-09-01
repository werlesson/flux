import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

export interface ScreenProps {
  children: ReactNode;
  title?: string;
  canGoBack?: boolean;
  headerAction?: ReactNode;
  footer?: ReactNode;
  scrollable?: boolean;
  testID?: string;
  onBack?: () => void;
}

export function Screen({ children, title, canGoBack = false, headerAction, footer, scrollable = true, testID, onBack }: ScreenProps) {
  const theme = useTheme();
  const content = scrollable ? (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">{children}</ScrollView>
  ) : <View style={styles.fixedContent}>{children}</View>;

  return (
    <SafeAreaView testID={testID} edges={['top', 'left', 'right', 'bottom']} style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <View pointerEvents="none" testID="screen-warm-wash" style={[styles.wash, { experimental_backgroundImage: `linear-gradient(to bottom, ${theme.isDark ? 'rgba(255,94,58,0.10)' : 'rgba(214,67,26,0.06)'}, transparent)` }]} />
      {(title || canGoBack || headerAction) ? (
        <View style={styles.header}>
          {canGoBack ? <Pressable accessibilityLabel="Voltar" accessibilityRole="button" hitSlop={8} onPress={onBack ?? (() => router.back())} style={styles.back}><Text style={[styles.backText, { color: theme.colors.text }]}>‹</Text></Pressable> : <View style={styles.headerSpacer} />}
          <Text numberOfLines={2} style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.title.semibold }]}>{title}</Text>
          <View style={styles.headerAction}>{headerAction}</View>
        </View>
      ) : null}
      {content}
      {footer ? <View style={[styles.footer, { backgroundColor: theme.colors.background }]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' }, wash: { height: '40%', left: 0, position: 'absolute', right: 0, top: 0 },
  header: { alignItems: 'center', flexDirection: 'row', minHeight: 64, paddingHorizontal: 20 },
  back: { alignItems: 'flex-start', justifyContent: 'center', minHeight: 44, minWidth: 44 }, backText: { fontSize: 36, lineHeight: 38 },
  headerSpacer: { width: 0 }, title: { flex: 1, fontSize: 24 }, headerAction: { alignItems: 'flex-end', minWidth: 44 },
  scrollContent: { flexGrow: 1, paddingBottom: 24, paddingHorizontal: 24 }, fixedContent: { flex: 1, paddingHorizontal: 24 },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
});
