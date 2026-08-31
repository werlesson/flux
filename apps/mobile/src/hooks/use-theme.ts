import { type ColorSchemeName, useColorScheme } from 'react-native';

import {
  colors,
  type ColorScheme,
  effects,
  fonts,
  fontSizes,
  radii,
  sizes,
  spacing,
  tabularMetric,
} from '@/constants/theme';

export function resolveTheme(colorScheme: ColorSchemeName | null | undefined) {
  const scheme: ColorScheme = colorScheme === 'light' ? 'light' : 'dark';

  return {
    colorScheme: scheme,
    colors: colors[scheme],
    effects,
    fonts,
    fontSizes,
    isDark: scheme === 'dark',
    radii,
    sizes,
    spacing,
    tabularMetric,
  } as const;
}

export type Theme = ReturnType<typeof resolveTheme>;

export function useTheme(): Theme {
  return resolveTheme(useColorScheme());
}
