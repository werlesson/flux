import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
} from '@expo-google-fonts/barlow';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { ActivityProvider } from '@/activity/activity-context';
import { ActivityRecoveryDialog } from '@/activity/activity-recovery-dialog';
import { initializeDatabase } from '@/database';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    void initializeDatabase();
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return <ActivityProvider><Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="training-library" />
    <Stack.Screen name="training-editor" />
    <Stack.Screen name="training-preview" />
    <Stack.Screen name="activity" options={{ gestureEnabled: false }} />
    <Stack.Screen name="structured-activity" options={{ gestureEnabled: false }} />
    <Stack.Screen name="activity-blocked" options={{ gestureEnabled: false }} />
    <Stack.Screen name="activity-result" />
    <Stack.Screen name="rpe" />
    <Stack.Screen name="history" />
    <Stack.Screen name="activity-detail" />
  </Stack><ActivityRecoveryDialog /></ActivityProvider>;
}
