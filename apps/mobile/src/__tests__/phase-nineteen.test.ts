import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

import { ActivityEngine, type ActivityGuidance } from '@/activity/engine';
import { GuidanceService, SpeechQueue, verbalizeDistance, verbalizeDuration, verbalizePace, verbalizeSplit, verbalizeStep } from '@/activity/guidance';
import { runMigrations } from '@/database/migrations';
import { NodeSQLiteAdapter } from '@/database/node-adapter';
import { AppPreferencesRepository, LookupRepository, TrainingSessionsRepository } from '@/database/repositories';
import { ActivitySplitsRepository } from '@/database/repositories/activity-splits';
import { bootstrapLocalUser, seedAppPreferences, seedLookups } from '@/database/seeds';
import type { StepTypeSlug } from '@/database/types';
import { handleBackgroundLocationTask, setBackgroundGpsConsumer } from '@/location/background-location';

const mockedSpeech = Speech as jest.Mocked<typeof Speech>;
const mockedHaptics = Haptics as jest.Mocked<typeof Haptics>;

async function setup(steps: { step_type_slug: StepTypeSlug; duration_seconds: number; instructions: string | null }[] = [{ step_type_slug: 'walk', duration_seconds: 120, instructions: null }, { step_type_slug: 'run', duration_seconds: 60, instructions: 'Comece a correr.' }]) {
  const database = new NodeSQLiteAdapter();
  await runMigrations(database); await seedLookups(database); await seedAppPreferences(database);
  const userId = await bootstrapLocalUser(database);
  const lookups = new LookupRepository(database); await lookups.carregar();
  const training = await new TrainingSessionsRepository(database, lookups).salvar({ user_id: userId, name: 'Guiado', blocks: [{ repeat_count: 1, steps }] });
  return { database, userId, training };
}

describe('fase 19 — orientações por áudio e vibração', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSpeech.getAvailableVoicesAsync.mockResolvedValue([{ identifier: 'br', language: 'pt-BR', name: 'Brasil', quality: 'Default' as Speech.VoiceQuality }]);
    mockedHaptics.notificationAsync.mockResolvedValue();
  });

  it('verbaliza distância, pace e duração sem numerais crus, com singular e plural', () => {
    expect(verbalizeDistance(2000)).toBe('Dois quilômetros');
    expect(verbalizeDistance(1000)).toBe('Um quilômetro');
    expect(verbalizePace(545)).toBe('nove minutos e cinco segundos');
    expect(verbalizePace(540)).toBe('nove minutos');
    expect(verbalizeDuration(120)).toBe('dois minutos');
    expect(verbalizeStep('walk', 120, null)).toBe('Caminhe por dois minutos.');
    expect(verbalizeSplit(2, 545)).toBe('Dois quilômetros. Pace nove minutos e cinco segundos.');
  });

  it('falas concorrentes são enfileiradas e não sobrepostas', async () => {
    const done: (() => void)[] = [];
    mockedSpeech.speak.mockImplementation((_text, options) => { done.push(() => options?.onDone?.()); });
    const queue = new SpeechQueue();
    queue.enqueue('Primeira'); queue.enqueue('Segunda');
    await new Promise(resolve => setImmediate(resolve));
    expect(mockedSpeech.speak).toHaveBeenCalledTimes(1);
    expect(mockedSpeech.speak).toHaveBeenLastCalledWith('Primeira', expect.objectContaining({ language: 'pt-BR', voice: 'br' }));
    done[0]!(); await new Promise(resolve => setImmediate(resolve));
    expect(mockedSpeech.speak).toHaveBeenCalledTimes(2);
    done[1]!(); await queue.drain();
  });

  it('falha do expo-speech é registrada e não interrompe os próximos avisos', async () => {
    const log = jest.fn();
    mockedSpeech.speak.mockImplementationOnce((_text, options) => options?.onError?.(new Error('tts'))).mockImplementationOnce((_text, options) => options?.onDone?.());
    const queue = new SpeechQueue(log); queue.enqueue('Falha'); queue.enqueue('Continua'); await queue.drain();
    expect(log).toHaveBeenCalled(); expect(mockedSpeech.speak).toHaveBeenCalledTimes(2);
  });

  it('falha do expo-speech não interrompe o motor nem a coleta em background', async () => {
    const { database, userId, training } = await setup([
      { step_type_slug: 'walk', duration_seconds: 40, instructions: null },
      { step_type_slug: 'run', duration_seconds: 40, instructions: null },
    ]);
    mockedSpeech.speak.mockImplementation((_text, options) => options?.onError?.(new Error('tts indisponível')));
    const log = jest.fn();
    const guidance = new GuidanceService(database, log);
    const engine = new ActivityEngine(database, { pointBatchSize: 1, guidance });
    const activity = await engine.startStructuredRun(userId, training.id, training.name, new Date(0));
    await engine.advanceTraining(new Date(40_000));
    await engine.ingest({ latitude: 0, longitude: 0, accuracy: 5, speed: 2, recordedAt: 40_000 });
    await engine.ingest({ latitude: 0, longitude: 0.0001, accuracy: 5, speed: 2, recordedAt: 50_000 });
    await engine.onBackground();
    await guidance.speech.drain();
    expect(engine.currentStep?.position).toBe(2);
    expect(await database.all('SELECT id FROM activity_points WHERE activity_id=?', [activity.id])).toHaveLength(2);
    expect(log).toHaveBeenCalled();
    database.close();
  });

  it('vibração e locução respeitam controles independentes e mudanças imediatas', async () => {
    const { database } = await setup();
    const preferences = new AppPreferencesRepository(database);
    const guidance = new GuidanceService(database);
    mockedSpeech.speak.mockImplementation((_text, options) => options?.onDone?.());
    await preferences.gravar('audio_cues_enabled', false); await guidance.emit({ text: 'Só vibra' });
    expect(mockedHaptics.notificationAsync).toHaveBeenCalledTimes(1); expect(mockedSpeech.speak).not.toHaveBeenCalled();
    await preferences.gravar('audio_cues_enabled', true); await preferences.gravar('haptic_cues_enabled', false);
    await guidance.emit({ text: 'Só fala' }); await guidance.speech.drain();
    expect(mockedSpeech.speak).toHaveBeenCalledWith('Só fala', expect.objectContaining({ language: 'pt-BR' }));
    expect(mockedHaptics.notificationAsync).toHaveBeenCalledTimes(1);
    database.close();
  });

  it('mudança disparada pela UI afeta o próximo aviso antes da gravação assíncrona terminar', async () => {
    const { database, userId } = await setup();
    const guidance = new GuidanceService(database);
    const engine = new ActivityEngine(database, { guidance });
    await engine.startFreeRun(userId, new Date(0));
    mockedSpeech.speak.mockImplementation((_text, options) => options?.onDone?.());
    const persistence = engine.setGuidancePreference('audio_cues_enabled', false);
    await guidance.emit({ text: 'Não deve falar' });
    await persistence;
    expect(mockedSpeech.speak).not.toHaveBeenCalled();
    expect(mockedHaptics.notificationAsync).toHaveBeenCalledTimes(1);
    database.close();
  });

  it('cada transição avisa uma vez, deriva instrução e avisa aos 30 segundos restantes sem duplicar após pausa', async () => {
    const { database, userId, training } = await setup();
    const cues: string[] = []; const guidance: ActivityGuidance = { emit: async cue => { cues.push(cue.text); } };
    const engine = new ActivityEngine(database, { clock: { now: () => 0 }, guidance });
    await engine.startStructuredRun(userId, training.id, training.name, new Date(0));
    expect(cues).toEqual(['Caminhe por dois minutos.']);
    await engine.advanceTraining(new Date(89_000)); expect(cues).toHaveLength(1);
    await engine.advanceTraining(new Date(90_000)); expect(cues.at(-1)).toBe('Faltam trinta segundos.');
    await engine.pause(new Date(100_000)); await engine.resume(new Date(200_000));
    await engine.advanceTraining(new Date(210_000)); expect(cues.filter(text => text === 'Faltam trinta segundos.')).toHaveLength(1);
    await engine.advanceTraining(new Date(220_000)); expect(cues.filter(text => text === 'Comece a correr.')).toHaveLength(1);
    database.close();
  });

  it('múltiplas transições atrasadas são emitidas em ordem e não duplicam após reconstruir o motor', async () => {
    const { database, userId, training } = await setup([
      { step_type_slug: 'walk', duration_seconds: 40, instructions: null },
      { step_type_slug: 'run', duration_seconds: 40, instructions: null },
      { step_type_slug: 'recovery', duration_seconds: 40, instructions: null },
      { step_type_slug: 'cooldown', duration_seconds: 40, instructions: null },
    ]);
    const first: string[] = [];
    const beforeBackground = new ActivityEngine(database, { clock: { now: () => 0 }, guidance: { emit: async cue => { first.push(cue.text); } } });
    await beforeBackground.startStructuredRun(userId, training.id, training.name, new Date(0));

    const resumed: string[] = [];
    const afterBackground = new ActivityEngine(database, { clock: { now: () => 130_000 }, guidance: { emit: async cue => { resumed.push(cue.text); } } });
    await afterBackground.restoreLastActivity();
    expect(resumed).toEqual([
      'Faltam trinta segundos.', 'Corra por quarenta segundos.',
      'Faltam trinta segundos.', 'Recupere-se por quarenta segundos.',
      'Faltam trinta segundos.', 'Desaqueça por quarenta segundos.',
      'Faltam trinta segundos.',
    ]);

    const reconstructedAgain: string[] = [];
    const again = new ActivityEngine(database, { clock: { now: () => 130_000 }, guidance: { emit: async cue => { reconstructedAgain.push(cue.text); } } });
    await again.restoreLastActivity();
    expect(reconstructedAgain).toEqual([]);
    database.close();
  });

  it('os três gatilhos e a vibração funcionam sem componente React montado', async () => {
    const { database, userId, training } = await setup([{ step_type_slug: 'run', duration_seconds: 120, instructions: null }]);
    mockedSpeech.speak.mockImplementation((_text, options) => options?.onDone?.());
    const engine = new ActivityEngine(database, { pointBatchSize: 1 });
    await engine.startStructuredRun(userId, training.id, training.name, new Date(0));
    await engine.advanceTraining(new Date(90_000));
    for (let index = 0; index <= 11; index += 1) {
      await engine.ingest({ latitude: 0, longitude: index * 0.0009, accuracy: 5, speed: 10, recordedAt: 90_000 + index * 10_000 });
    }
    await engine.onBackground();
    await new GuidanceService(database).speech.drain();
    expect(mockedHaptics.notificationAsync.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(mockedSpeech.speak.mock.calls.map(call => call[0])).toEqual(expect.arrayContaining([
      'Corra por dois minutos.', 'Faltam trinta segundos.',
      expect.stringMatching(/^Um quilômetro\. Pace /),
    ]));
    database.close();
  });

  it('a tarefa real de background aguarda locução e vibração antes de encerrar', async () => {
    let finishSpeech!: () => void;
    let finishHaptic!: () => void;
    mockedSpeech.speak.mockImplementation((_text, options) => { finishSpeech = () => options?.onDone?.(); });
    mockedHaptics.notificationAsync.mockImplementation(() => new Promise<void>(resolve => { finishHaptic = resolve; }));

    const { database } = await setup();
    const guidance = new GuidanceService(database);
    setBackgroundGpsConsumer(async () => {
      await guidance.emit({ text: 'Aviso em background' });
    }, () => guidance.drain());

    let completed = false;
    const execution = handleBackgroundLocationTask({
      data: { locations: [{ timestamp: 0, coords: { latitude: 0, longitude: 0, altitude: null, accuracy: 5, altitudeAccuracy: null, heading: null, speed: 2 } }] },
      error: null,
    }).then(() => { completed = true; });

    await new Promise(resolve => setImmediate(resolve));
    expect(completed).toBe(false);
    finishHaptic();
    await new Promise(resolve => setImmediate(resolve));
    expect(mockedSpeech.speak).toHaveBeenCalledWith('Aviso em background', expect.objectContaining({ language: 'pt-BR' }));
    expect(completed).toBe(false);
    finishSpeech();
    await execution;
    expect(completed).toBe(true);

    setBackgroundGpsConsumer();
    database.close();
  });

  it('anuncia corrida livre com o pace de cada split e fecha dois quilômetros em ordem', async () => {
    const { database, userId } = await setup();
    const cues: string[] = [];
    const engine = new ActivityEngine(database, { pointBatchSize: 1, guidance: { emit: async cue => { cues.push(cue.text); } } });
    const activity = await engine.startFreeRun(userId, new Date(0));
    for (let index = 0; index <= 21; index += 1) {
      await engine.ingest({ latitude: 0, longitude: index * 0.0009, accuracy: 5, speed: 10, recordedAt: index * 10_000 });
    }
    const splits = await new ActivitySplitsRepository(database).listar(activity.id);
    expect(splits.map(split => split.kilometer)).toEqual([1, 2]);
    expect(cues).toEqual(splits.map(split => verbalizeSplit(split.kilometer, split.pace_seconds_per_km)));
    expect(cues[0]).toMatch(/^Um quilômetro\. Pace /);
    expect(cues[1]).toMatch(/^Dois quilômetros\. Pace /);
    database.close();
  });

  it.each([30, 25])('etapa de %s segundos não dispara aviso iminente', async duration => {
    const { database, userId, training } = await setup([{ step_type_slug: 'run', duration_seconds: duration, instructions: null }]);
    const cues: string[] = []; const engine = new ActivityEngine(database, { guidance: { emit: async cue => { cues.push(cue.text); } } });
    await engine.startStructuredRun(userId, training.id, training.name, new Date(0));
    await engine.advanceTraining(new Date(duration * 1000));
    expect(cues).not.toContain('Faltam trinta segundos.');
    database.close();
  });

  it('preferência alterada sobrevive ao seed da próxima abertura', async () => {
    const { database } = await setup(); const preferences = new AppPreferencesRepository(database);
    await preferences.gravar('audio_cues_enabled', false); await seedAppPreferences(database);
    expect(await new AppPreferencesRepository(database).ler('audio_cues_enabled', true)).toBe(false);
    database.close();
  });
});
