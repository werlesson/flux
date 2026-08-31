import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export interface SurfaceProps extends ViewProps { onPress?: () => void; disabled?: boolean }

export function Surface({ children, style, onPress, disabled = false, ...props }: PropsWithChildren<SurfaceProps>) {
  const theme = useTheme();
  const surfaceStyle = [styles.surface, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, style];
  const hairline = <View pointerEvents="none" style={[styles.hairline, { backgroundColor: theme.isDark ? theme.effects.surfaceInnerHairline.color : 'rgba(255,255,255,0.75)' }]} />;
  if (onPress) return <Pressable {...props} accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [surfaceStyle, styles.touchable, (pressed || disabled) && styles.dimmed]}>{hairline}{children}</Pressable>;
  return <View {...props} style={surfaceStyle}>{hairline}{children}</View>;
}

export const Card = Surface;

const styles = StyleSheet.create({
  surface: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  touchable: { minHeight: 44 }, dimmed: { opacity: 0.6 }, hairline: { height: 1, left: 1, position: 'absolute', right: 1, top: 0 },
});
