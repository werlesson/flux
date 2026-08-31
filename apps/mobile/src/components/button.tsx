import type { PropsWithChildren } from 'react';
import { Pressable, type PressableProps,StyleSheet, Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'destructive-outline';
export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> { children: string; variant?: ButtonVariant; activity?: boolean }

export function Button({ children, variant = 'primary', activity = false, disabled: disabledProp = false, ...props }: PropsWithChildren<ButtonProps>) {
  const theme = useTheme();
  const disabled = disabledProp === true;
  const primary = variant === 'primary';
  const destructive = variant === 'destructive';
  const destructiveOutline = variant === 'destructive-outline';
  const backgroundColor = primary ? theme.colors.action : destructive ? theme.colors.destructive : 'transparent';
  const color = primary ? (theme.isDark ? '#1A120E' : '#FFFFFF') : destructive ? '#FFFFFF' : destructiveOutline ? theme.colors.destructive : theme.colors.text;
  const borderColor = destructive || destructiveOutline ? theme.colors.destructive : theme.colors.border;
  return (
    <Pressable {...props} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} style={({ pressed }) => [styles.button, activity && styles.activity, { backgroundColor, borderColor, borderWidth: primary ? 0 : 1 }, primary && { experimental_backgroundImage: `linear-gradient(to bottom, ${theme.colors.action}, ${theme.effects.primaryButtonGradient.colors[1]})` }, primary && styles.primaryShadow, (pressed || disabled) && styles.disabled]}>
      <Text style={[styles.label, { color, fontFamily: theme.fonts.title.semibold }]}>{children}</Text>
    </Pressable>
  );
}

export const PrimaryButton = (props: ButtonProps) => <Button {...props} variant="primary" />;
export const SecondaryButton = (props: ButtonProps) => <Button {...props} variant="secondary" />;
export const DestructiveButton = (props: ButtonProps) => <Button {...props} variant="destructive" />;

const styles = StyleSheet.create({
  button: { alignItems: 'center', borderRadius: 999, justifyContent: 'center', minHeight: 48, overflow: 'hidden', paddingHorizontal: 24 },
  activity: { minHeight: 132 }, label: { fontSize: 18, zIndex: 1 }, disabled: { opacity: 0.4 },
  primaryShadow: { elevation: 14, shadowColor: '#FF5E3A', shadowOffset: { height: 14, width: 0 }, shadowOpacity: 0.26, shadowRadius: 17 },
});
