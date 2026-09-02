import type { Href } from 'expo-router';

export const routes = {
  home: '/',
  trainingLibrary: '/training-library',
  trainingEditor: '/training-editor',
  trainingPreview: '/training-preview',
  activity: '/activity',
  activityBlocked: '/activity-blocked',
  activityResult: '/activity-result',
  rpe: '/rpe',
  history: '/history',
  activityDetail: '/activity-detail',
} as const satisfies Record<string, Href>;

/**
 * Rotas que existem apenas no development build. Ficam fora de `routes` de
 * propósito: não fazem parte do contrato de navegação do MVP e nenhuma tela do
 * corredor aponta para elas.
 */
export const developmentRoutes = {
  gpsInspector: '/gps-inspector',
} as const satisfies Record<string, Href>;

export type AppRoute = (typeof routes)[keyof typeof routes];
export type DevelopmentRoute = (typeof developmentRoutes)[keyof typeof developmentRoutes];
