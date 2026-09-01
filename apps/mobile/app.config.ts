import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  return {
    ...config,
    ...appJson.expo,
    android: { ...appJson.expo.android, ...(apiKey ? { config: { googleMaps: { apiKey } } } : {}) },
    extra: { ...config.extra, googleMapsApiKeyConfigured: Boolean(apiKey) },
  } as ExpoConfig;
};
