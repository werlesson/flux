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

export type AppRoute = (typeof routes)[keyof typeof routes];
