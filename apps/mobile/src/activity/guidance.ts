import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

import type { DatabaseAdapter } from '@/database/adapter';
import { AppPreferencesRepository } from '@/database/repositories/preferences';
import type { StepTypeSlug } from '@/database/types';

export type GuidanceLogger = (message: string, error?: unknown) => void;

const units = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];

export function numberInPortuguese(value: number): string {
  const number = Math.max(0, Math.floor(value));
  if (number < 20) return units[number]!;
  if (number < 100) return tens[Math.floor(number / 10)]! + (number % 10 ? ' e ' + units[number % 10] : '');
  if (number === 100) return 'cem';
  if (number < 200) return 'cento e ' + numberInPortuguese(number - 100);
  if (number < 1000) {
    const hundreds = ['', '', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
    return hundreds[Math.floor(number / 100)]! + (number % 100 ? ' e ' + numberInPortuguese(number % 100) : '');
  }
  if (number < 2000) return 'mil' + (number % 1000 ? ' e ' + numberInPortuguese(number % 1000) : '');
  if (number < 1_000_000) return numberInPortuguese(Math.floor(number / 1000)) + ' mil' + (number % 1000 ? ' e ' + numberInPortuguese(number % 1000) : '');
  return String(number);
}

export function verbalizeDistance(distanceMeters: number): string {
  const kilometers = Math.floor(distanceMeters / 1000);
  return capitalize(numberInPortuguese(kilometers) + ' ' + (kilometers === 1 ? 'quilômetro' : 'quilômetros'));
}

export function verbalizePace(secondsPerKilometer: number): string {
  const total = Math.max(0, Math.round(secondsPerKilometer));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const minutePart = numberInPortuguese(minutes) + ' ' + (minutes === 1 ? 'minuto' : 'minutos');
  return seconds ? minutePart + ' e ' + numberInPortuguese(seconds) + ' ' + (seconds === 1 ? 'segundo' : 'segundos') : minutePart;
}

export function verbalizeDuration(durationSeconds: number): string {
  const total = Math.max(0, Math.round(durationSeconds));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (!minutes) return numberInPortuguese(seconds) + ' ' + (seconds === 1 ? 'segundo' : 'segundos');
  const result = numberInPortuguese(minutes) + ' ' + (minutes === 1 ? 'minuto' : 'minutos');
  return seconds ? result + ' e ' + numberInPortuguese(seconds) + ' ' + (seconds === 1 ? 'segundo' : 'segundos') : result;
}

function capitalize(value: string): string { return value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1); }

const stepVerbs: Record<StepTypeSlug, string> = {
  warmup: 'Aqueça', run: 'Corra', walk: 'Caminhe', recovery: 'Recupere-se', cooldown: 'Desaqueça',
};

export function verbalizeStep(slug: StepTypeSlug, durationSeconds: number, instructions: string | null): string {
  if (instructions?.trim()) return instructions.trim();
  return stepVerbs[slug] + ' por ' + verbalizeDuration(durationSeconds) + '.';
}

export function verbalizeSplit(kilometer: number, paceSecondsPerKilometer: number): string {
  return verbalizeDistance(kilometer * 1000) + '. Pace ' + verbalizePace(paceSecondsPerKilometer) + '.';
}

export class SpeechQueue {
  private tail = Promise.resolve();
  private voicePromise: Promise<string | null> | null = null;

  constructor(private readonly log: GuidanceLogger = (message, error) => console.warn(message, error)) {}

  enqueue(text: string): void {
    this.tail = this.tail.then(() => this.speak(text)).catch(error => this.log('Falha na locução da atividade', error));
  }

  async drain(): Promise<void> { await this.tail; }

  private async voice(): Promise<string | null> {
    this.voicePromise ??= Promise.resolve(Speech.getAvailableVoicesAsync()).then(voices => {
      if (!Array.isArray(voices)) return null;
      const voice = voices.find(item => item.language.toLocaleLowerCase() === 'pt-br');
      if (!voice) throw new Error('Voz pt-BR não disponível');
      return voice.identifier;
    });
    return this.voicePromise;
  }

  private async speak(text: string): Promise<void> {
    const voice = await this.voice();
    await new Promise<void>((resolve, reject) => {
      try {
        const result: unknown = Speech.speak(text, {
          language: 'pt-BR',
          ...(voice ? { voice } : {}),
          onDone: () => resolve(),
          onStopped: () => resolve(),
          onError: error => reject(error),
        });
        if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
          void Promise.resolve(result).catch(reject);
        }
      } catch (error) { reject(error); }
    });
  }
}

export interface GuidanceCue {
  text: string;
  haptic?: 'default' | 'success';
}

export class GuidanceService {
  readonly speech: SpeechQueue;
  private readonly preferences: AppPreferencesRepository;

  constructor(database: DatabaseAdapter, logger?: GuidanceLogger) {
    this.preferences = new AppPreferencesRepository(database);
    this.speech = new SpeechQueue(logger);
  }

  setPreference(key: 'audio_cues_enabled' | 'haptic_cues_enabled', value: boolean): Promise<void> {
    return this.preferences.gravar(key, value);
  }

  async emit(cue: GuidanceCue): Promise<void> {
    const [audio, haptic] = await Promise.all([
      this.preferences.ler('audio_cues_enabled', true),
      this.preferences.ler('haptic_cues_enabled', true),
    ]);
    if (haptic) {
      try {
        await Haptics.notificationAsync(cue.haptic === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      } catch (error) { console.warn('Falha na vibração da atividade', error); }
    }
    if (audio) this.speech.enqueue(cue.text);
  }

  async drain(): Promise<void> {
    await this.speech.drain();
  }
}
