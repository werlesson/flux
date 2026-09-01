import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

import type { DatabaseAdapter } from '@/database/adapter';
import { AppPreferencesRepository } from '@/database/repositories/preferences';

/** Guidance-layer consumer for the terminal training-engine event. */
export async function announceTrainingFinished(database: DatabaseAdapter): Promise<void> {
  const preferences = new AppPreferencesRepository(database);
  const [audioEnabled, hapticsEnabled] = await Promise.all([
    preferences.ler('audio_cues_enabled', true),
    preferences.ler('haptic_cues_enabled', true),
  ]);
  if (hapticsEnabled) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  if (audioEnabled) Speech.speak('Treino concluído.', { language: 'pt-BR' });
}
