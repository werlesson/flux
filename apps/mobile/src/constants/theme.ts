import type { TextStyle } from 'react-native';

export const colors = {
  dark: {
    background: '#15100F',
    surface: '#211814',
    surfaceElevated: '#2A2019',
    border: '#382A20',
    text: '#FAF3E6',
    textSecondary: '#A89684',
    action: '#FF5E3A',
    highlight: '#FFC857',
    confirmation: '#9BC7A8',
    destructive: '#FF4D4D',
  },
  light: {
    background: '#FBF7F2',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: '#EADFD2',
    text: '#1A120E',
    textSecondary: '#6B5B4C',
    action: '#D6431A',
    highlight: '#9A6B00',
    confirmation: '#537A5E',
    destructive: '#C0392B',
  },
  step: {
    warmup: '#A89684',
    run: '#FF5E3A',
    walk: '#FFC857',
    recovery: '#9BC7A8',
    cooldown: '#C79BB0',
  },
  effects: {
    actionGradientEnd: '#E94A28',
    transparent: 'rgba(255,255,255,0)',
    warmWash: 'rgba(255,94,58,0.10)',
    surfaceHairline: 'rgba(255,255,255,0.045)',
    actionShadow: 'rgba(255,94,58,0.26)',
  },
} as const;

export type ColorScheme = keyof Pick<typeof colors, 'dark' | 'light'>;
export type StepTypeSlug = keyof typeof colors.step;
export type ThemeColors = (typeof colors)[ColorScheme];

export const getStepTypeColor = (slug: StepTypeSlug): string => colors.step[slug];

export const fonts = {
  title: {
    regular: 'Barlow_400Regular',
    medium: 'Barlow_500Medium',
    semibold: 'Barlow_600SemiBold',
    bold: 'Barlow_700Bold',
  },
  data: {
    regular: 'JetBrainsMono_400Regular',
    medium: 'JetBrainsMono_500Medium',
    semibold: 'JetBrainsMono_600SemiBold',
    bold: 'JetBrainsMono_700Bold',
  },
} as const;

export const fontSizes = {
  caption: 11,
  label: 12,
  body: 16,
  heading: 24,
  metric: 40,
  activityStepRemaining: 92,
  activityDistance: 96,
  activityTime: 104,
} as const;

/** Apply to every changing numerical metric to keep digit widths stable. */
export const tabularMetric: TextStyle = {
  fontFamily: fonts.data.regular,
  fontVariant: ['tabular-nums'],
};

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  section: 48,
} as const;

export const radii = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const sizes = {
  hairline: 1,
  minimumTouchTarget: 44,
  activityPrimaryButtonHeight: 132,
} as const;

export const effects = {
  primaryButtonGradient: {
    colors: [colors.dark.action, colors.effects.actionGradientEnd] as const,
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  primaryButtonShadow: {
    shadowColor: colors.effects.actionShadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 17,
    elevation: 14,
  },
  surfaceInnerHairline: {
    color: colors.effects.surfaceHairline,
    width: sizes.hairline,
    edge: 'top' as const,
  },
  screenWarmWash: {
    colors: [colors.effects.warmWash, colors.effects.transparent] as const,
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 0.4 },
  },
} as const;

export const themeTokens = {
  colors,
  effects,
  fonts,
  fontSizes,
  radii,
  sizes,
  spacing,
  tabularMetric,
} as const;
