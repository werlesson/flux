import appConfig from './app.json';

const REQUIRED_ANDROID_PERMISSIONS = [
  'ACCESS_FINE_LOCATION',
  'ACCESS_COARSE_LOCATION',
  'ACCESS_BACKGROUND_LOCATION',
  'FOREGROUND_SERVICE',
  'FOREGROUND_SERVICE_LOCATION',
];

describe('Flux Expo configuration', () => {
  const { expo } = appConfig;

  it('uses the Flux identity and Android-only MVP settings', () => {
    expect(expo).toMatchObject({
      name: 'flux',
      slug: 'flux',
      scheme: 'flux',
      orientation: 'portrait',
      userInterfaceStyle: 'automatic',
      android: {
        package: 'com.werlesson.flux',
      },
    });
    expect(expo).not.toHaveProperty('ios');
  });

  it('enables background location and its foreground service', () => {
    expect(expo.plugins).toContainEqual([
      'expo-location',
      {
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ]);
  });

  it('declares every Android permission required for background tracking', () => {
    expect(expo.android.permissions).toEqual(
      expect.arrayContaining(REQUIRED_ANDROID_PERMISSIONS),
    );
  });
});
