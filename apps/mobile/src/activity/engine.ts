import type { DatabaseAdapter } from '@/database/adapter';
import { ActivitiesRepository } from '@/database/repositories/activities';
import { type ActivityPointInput,ActivityPointsRepository } from '@/database/repositories/activity-points';
import { ActivitySplitsRepository } from '@/database/repositories/activity-splits';
import { ActivityStepsRepository } from '@/database/repositories/activity-steps';
import { AppPreferencesRepository } from '@/database/repositories/preferences';
import type { Activity, ActivityStatusSlug, ActivityTypeSlug } from '@/database/types';
import type { GpsSample } from '@/gps/filter';
import { haversineDistanceMeters } from '@/gps/distance';
import { GpsFilterOrchestrator } from '@/gps/orchestrator';
import { addSignalSample, createSignalQualityState, evaluateSignalTimeout, type SignalQuality, type SignalQualityState } from '@/gps/signal-quality';
import { activityPointBatchFlushIntervalSeconds, activityPointBatchSize, activityStatePersistenceIntervalSeconds, currentPaceMinimumDurationSeconds, currentPaceWindowSeconds, movingMinimumDisplacementMeters, movingSpeedThresholdMetersPerSecond } from '@/gps/thresholds';

import { type ActivityClock,elapsedSeconds, paceSecondsPerKm, systemActivityClock } from './clock';
import { GuidanceService, verbalizeSplit, verbalizeStep } from './guidance';
import { KilometerSplitDetector } from './split-detector';
import { expandTrainingBlocks, TrainingEngine, type TrainingBlockWithSteps } from './training-engine';

export interface ActivityMetricsSnapshot { elapsed: number; moving: number; distance: number; currentPace: number | null; averagePace: number | null }
export interface StructuredStepSnapshot {
  name: string;
  slug: string;
  position: number;
  total: number;
  repetitionIndex: number;
  repeatCount: number;
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  remainingSeconds: number;
  instructions: string | null;
  next: { name: string; slug: string; plannedDurationSeconds: number } | null;
}
export interface ActivityRecoverySnapshot extends ActivityMetricsSnapshot { activityId: number; activityType: ActivityTypeSlug; trainingName: string | null; startedAt: Date; currentStep: StructuredStepSnapshot | null }
export interface ActivityGuidance { emit(cue: { text: string; haptic?: 'default' | 'success' }): Promise<void>; drain?(): Promise<void>; setPreference?(key: 'audio_cues_enabled' | 'haptic_cues_enabled', value: boolean): Promise<void> }
export interface ActivityEngineOptions { pointBatchSize?: number; pointBatchFlushIntervalSeconds?: number; persistenceIntervalSeconds?: number; paceWindowSeconds?: number; clock?: ActivityClock; onStartError?: (message: string) => void; guidance?: ActivityGuidance }
type ValidSample = { at: number; distance: number };

export class InvalidActivityTransitionError extends Error {}

export class ActivityEngine {
  private activity: Activity | null = null;
  private statusValue: ActivityStatusSlug | null = null;
  private pending: ActivityPointInput[] = [];
  private movingSeconds = 0;
  private accumulatedPausedMilliseconds = 0;
  private pausedAt: number | null = null;
  private distanceMeters = 0;
  private lastAcceptedAt: number | null = null;
  private recent: ValidSample[] = [];
  private signal: SignalQualityState = createSignalQualityState();
  private lastCheckpointAt = 0;
  private lastPointFlushAt = 0;
  private segmentIndex = 0;
  private splitDetector = new KilometerSplitDetector();
  private currentStepValue: ActivityRecoverySnapshot['currentStep'] = null;
  private trainingEngine: TrainingEngine | null = null;
  private trainingFinishedListeners = new Set<(activityId: number) => void | Promise<void>>();
  private writeChain: Promise<void> = Promise.resolve();
  private pendingWriteError: unknown = null;
  private readonly activities: ActivitiesRepository;
  private readonly points: ActivityPointsRepository;
  private readonly splits: ActivitySplitsRepository;
  private readonly steps: ActivityStepsRepository;
  private readonly orchestrator: GpsFilterOrchestrator;
  private readonly clock: ActivityClock;
  private readonly batchSize: number;
  private readonly batchFlushSeconds: number;
  private readonly checkpointSeconds: number;
  private readonly paceWindow: number;
  private readonly onStartError?: (message: string) => void;
  private readonly guidance: ActivityGuidance;

  constructor(private readonly database: DatabaseAdapter, options: ActivityEngineOptions = {}) {
    this.activities = new ActivitiesRepository(database);
    this.points = new ActivityPointsRepository(database);
    this.splits = new ActivitySplitsRepository(database);
    this.steps = new ActivityStepsRepository(database);
    this.clock = options.clock ?? systemActivityClock;
    this.batchSize = options.pointBatchSize ?? activityPointBatchSize;
    this.batchFlushSeconds = options.pointBatchFlushIntervalSeconds ?? activityPointBatchFlushIntervalSeconds;
    this.checkpointSeconds = options.persistenceIntervalSeconds ?? activityStatePersistenceIntervalSeconds;
    this.paceWindow = options.paceWindowSeconds ?? currentPaceWindowSeconds;
    this.onStartError = options.onStartError;
    this.guidance = options.guidance ?? new GuidanceService(database);
    this.orchestrator = new GpsFilterOrchestrator(undefined, (sample, result) => this.consume(sample, result));
  }

  get id(): number | null { return this.activity?.id ?? null; }
  get status(): ActivityStatusSlug | null { return this.statusValue; }
  get signalQuality(): SignalQuality { return evaluateSignalTimeout(this.signal, this.clock.now()).quality; }
  get currentStep(): ActivityRecoverySnapshot['currentStep'] { return this.currentStepValue; }
  get trainingName(): string | null { return this.activity?.training_session_name ?? null; }

  async startFreeRun(userId: number, startedAt = new Date(this.clock.now())): Promise<Activity> {
    this.releaseFinishedActivity();
    if (this.activity) throw new Error('Já existe uma atividade neste motor');
    try {
      if (await this.activities.buscarEmAndamento()) throw new Error('Existe uma atividade pendente de resolução');
      const created = await this.activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: startedAt });
      this.activity = created; this.statusValue = 'in_progress'; this.lastCheckpointAt = startedAt.getTime(); this.lastPointFlushAt = startedAt.getTime();
      return created;
    } catch (error) {
      this.onStartError?.('Não foi possível iniciar a atividade. Tente novamente.');
      throw error;
    }
  }

  async startStructuredRun(userId: number, trainingSessionId: number, trainingName: string, startedAt = new Date(this.clock.now())): Promise<Activity> {
    this.releaseFinishedActivity();
    if (this.activity) throw new Error('Já existe uma atividade neste motor');
    try {
      if (await this.activities.buscarEmAndamento()) throw new Error('Existe uma atividade pendente de resolução');
      const source = await this.database.all<{ id: number; block_id: number; block_position: number; step_position: number; step_type_id: number; duration_seconds: number; instructions: string | null; repeat_count: number }>(
        'SELECT s.id,b.id block_id,b.position block_position,s.position step_position,s.step_type_id,s.duration_seconds,s.instructions,b.repeat_count FROM training_blocks b JOIN training_steps s ON s.training_block_id=b.id WHERE b.training_session_id=? ORDER BY b.position,s.position',
        [trainingSessionId],
      );
      const blocks: TrainingBlockWithSteps[] = [...new Set(source.map(step => step.block_id))].map(blockId => { const rows=source.filter(step=>step.block_id===blockId); return { position: rows[0]!.block_position, repeat_count: rows[0]!.repeat_count, steps: rows.map(step=>({ id:step.id,step_type_id:step.step_type_id,position:step.step_position,duration_seconds:step.duration_seconds,instructions:step.instructions })) }; });
      const snapshots = expandTrainingBlocks(blocks);
      const created = await this.activities.criarComEtapas({ user_id:userId,activity_type_slug:'structured',training_session_id:trainingSessionId,training_session_name:trainingName,started_at:startedAt }, snapshots, startedAt);
      this.attachTrainingEngine(created.id);
      this.activity = created; this.statusValue = 'in_progress'; this.lastCheckpointAt = startedAt.getTime(); this.lastPointFlushAt = startedAt.getTime();
      this.currentStepValue = await this.loadCurrentStep(created.id, startedAt);
      await this.trainingEngine!.announceCurrentStep();
      return created;
    } catch (error) {
      this.onStartError?.('Não foi possível iniciar a atividade. Tente novamente.');
      throw error;
    }
  }

  async restoreLastActivity(): Promise<Activity | null> {
    if (this.activity) throw new Error('Já existe uma atividade neste motor');
    const activity = await this.activities.buscarEmAndamento();
    if (!activity) return null;
    const [status] = await this.database.all<{ slug: ActivityStatusSlug }>('SELECT s.slug FROM activity_statuses s JOIN activities a ON a.activity_status_id=s.id WHERE a.id=?', [activity.id]);
    this.activity = activity;
    this.statusValue = status?.slug ?? 'in_progress';
    this.movingSeconds = activity.moving_duration_seconds;
    this.distanceMeters = activity.distance_meters;
    this.lastCheckpointAt = this.clock.now(); this.lastPointFlushAt = this.clock.now();
    const validPoints = await this.database.all<{ latitude: number; longitude: number; segment_index: number }>('SELECT latitude,longitude,segment_index FROM activity_points WHERE activity_id=? AND is_valid=1 ORDER BY recorded_at,id', [activity.id]);
    if (validPoints.length) {
      this.distanceMeters = validPoints.slice(1).reduce((total, point, index) => total + (point.segment_index === validPoints[index]!.segment_index ? haversineDistanceMeters(validPoints[index]!, point) : 0), 0);
    }
    const [lastPoint] = await this.database.all<{ segment_index: number }>('SELECT segment_index FROM activity_points WHERE activity_id=? ORDER BY recorded_at DESC LIMIT 1', [activity.id]);
    this.segmentIndex = lastPoint?.segment_index ?? 0;
    const pauses = await this.database.all<{ started_at: string; finished_at: string | null }>('SELECT started_at,finished_at FROM activity_pause_intervals WHERE activity_id=? ORDER BY started_at', [activity.id]);
    this.accumulatedPausedMilliseconds = pauses.reduce((total, pause) => total + (pause.finished_at ? Math.max(0, Date.parse(pause.finished_at) - Date.parse(pause.started_at)) : 0), 0);
    const openPause = pauses.find(pause => pause.finished_at === null);
    this.pausedAt = openPause ? Date.parse(openPause.started_at) : null;
    const persistedSplits = await this.splits.listar(activity.id);
    this.splitDetector = new KilometerSplitDetector(persistedSplits.at(-1)?.kilometer ?? 0, persistedSplits.reduce((total, split) => total + split.duration_seconds, 0));
    await this.restoreFilterState(activity.id);
    this.currentStepValue = await this.loadCurrentStep(activity.id);
    const [structured] = await this.database.all<{ count: number }>('SELECT COUNT(*) count FROM activity_steps WHERE activity_id=?',[activity.id]);
    if (structured?.count) this.attachTrainingEngine(activity.id);
    else this.trainingEngine = null;
    if (this.trainingEngine && this.statusValue === 'in_progress') await this.trainingEngine.advance(new Date(this.clock.now()));
    return activity;
  }

  async pause(at = new Date(this.clock.now())): Promise<void> {
    if (this.trainingEngine) { await this.trainingEngine.advance(at); this.currentStepValue = await this.loadCurrentStep(this.activity!.id, at); }
    this.requireTransition('paused');
    await this.flush();
    this.checkpoint(at, true);
    await this.drainWrites();
    await this.database.transaction(async tx => {
      await new ActivitiesRepository(tx).atualizarStatus(this.activity!.id, 'paused', at);
      await tx.run('INSERT INTO activity_pause_intervals(activity_id,started_at,created_at) VALUES(?,?,?)', [this.activity!.id, at.toISOString(), at.toISOString()]);
    });
    this.statusValue = 'paused'; this.pausedAt = at.getTime(); this.lastAcceptedAt = null;
  }

  async resume(at = new Date(this.clock.now())): Promise<void> {
    this.requireTransition('in_progress');
    await this.database.transaction(async tx => {
      const result = await tx.run('UPDATE activity_pause_intervals SET finished_at=? WHERE id=(SELECT id FROM activity_pause_intervals WHERE activity_id=? AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1)', [at.toISOString(), this.activity!.id]);
      if (!result.changes) throw new Error('Intervalo de pausa aberto não encontrado');
      await new ActivitiesRepository(tx).atualizarStatus(this.activity!.id, 'in_progress', at);
    });
    if (this.pausedAt !== null) this.accumulatedPausedMilliseconds += Math.max(0, at.getTime() - this.pausedAt);
    this.statusValue = 'in_progress'; this.pausedAt = null; this.lastAcceptedAt = null;
    if (this.trainingEngine) { await this.trainingEngine.advance(at); this.currentStepValue = await this.loadCurrentStep(this.activity!.id, at); }
  }

  async advanceTraining(at = new Date(this.clock.now())) { if (!this.trainingEngine || this.statusValue === 'paused') return null; const state=await this.trainingEngine.advance(at); this.currentStepValue=await this.loadCurrentStep(this.activity!.id, at); return state; }
  async skipTrainingStep(at = new Date(this.clock.now())) { if (!this.trainingEngine || this.statusValue !== 'in_progress') return null; const state=await this.trainingEngine.skip(at); this.currentStepValue=await this.loadCurrentStep(this.activity!.id, at); return state; }
  onTrainingFinished(listener: (activityId:number)=>void|Promise<void>): ()=>void { this.trainingFinishedListeners.add(listener); return () => this.trainingFinishedListeners.delete(listener); }
  async setGuidancePreference(key: 'audio_cues_enabled' | 'haptic_cues_enabled', value: boolean): Promise<void> {
    if (this.guidance.setPreference) await this.guidance.setPreference(key, value);
    else await new AppPreferencesRepository(this.database).gravar(key, value);
  }

  async ingest(sample: GpsSample): Promise<void> {
    if (this.statusValue !== 'in_progress') return;
    await this.orchestrator.processSample(sample);
  }

  async onBackground(): Promise<void> {
    await this.flush();
    this.checkpoint(new Date(this.clock.now()), true);
    await this.drainWrites();
    await this.guidance.drain?.();
  }

  metrics(now = this.clock.now()): ActivityMetricsSnapshot {
    if (!this.activity) return { elapsed: 0, moving: 0, distance: 0, currentPace: null, averagePace: null };
    const effectiveNow = this.pausedAt ?? now;
    const elapsed = Math.max(0, elapsedSeconds(this.activity.started_at.getTime(), effectiveNow) - Math.floor(this.accumulatedPausedMilliseconds / 1000));
    const moving = Math.min(this.movingSeconds, elapsed);
    let currentPace: number | null = null;
    if (this.statusValue === 'in_progress' && this.signalQuality !== 'sem_sinal' && this.recent.length > 1) {
      const cutoff = now - this.paceWindow * 1000;
      const window = this.recent.filter(item => item.at >= cutoff);
      if (window.length > 1) {
        const duration = (window.at(-1)!.at - window[0]!.at) / 1000;
        const distance = window.slice(1).reduce((sum, item) => sum + item.distance, 0);
        if (duration >= currentPaceMinimumDurationSeconds) currentPace = paceSecondsPerKm(distance, duration);
      }
    }
    return { elapsed, moving, distance: this.distanceMeters, currentPace, averagePace: paceSecondsPerKm(this.distanceMeters, moving) };
  }

  async finish(at = new Date(this.clock.now())): Promise<Activity> {
    if (!this.activity || this.statusValue === 'finished') throw new InvalidActivityTransitionError('Atividade finalizada é terminal');
    await this.flush();
    if (this.trainingEngine) { await this.trainingEngine.advance(at); await this.trainingEngine.stop(at); }
    const snapshot = this.metrics(at.getTime());
    await this.database.transaction(async tx => {
      const best = await new ActivitySplitsRepository(tx).melhorPace(this.activity!.id);
      await new ActivitiesRepository(tx).atualizarMetricas(this.activity!.id, { finished_at: at, activity_status_slug: 'finished', elapsed_duration_seconds: snapshot.elapsed, moving_duration_seconds: snapshot.moving, distance_meters: snapshot.distance, average_pace_seconds_per_km: snapshot.averagePace, best_pace_seconds_per_km: best }, at);
      await new ActivityStepsRepository(tx).finalizarPendentes(this.activity!.id, at);
      await tx.run('UPDATE activity_pause_intervals SET finished_at=? WHERE activity_id=? AND finished_at IS NULL', [at.toISOString(), this.activity!.id]);
    });
    this.statusValue = 'finished';
    return (await this.activities.buscarPorId(this.activity.id))!;
  }

  async recoverySnapshot(now = this.clock.now()): Promise<ActivityRecoverySnapshot | null> {
    if (!this.activity) return null;
    const [type] = await this.database.all<{ slug: ActivityTypeSlug }>('SELECT t.slug FROM activity_types t JOIN activities a ON a.activity_type_id=t.id WHERE a.id=?', [this.activity.id]);
    this.currentStepValue = await this.loadCurrentStep(this.activity.id);
    return { activityId: this.activity.id, activityType: type?.slug ?? 'free_run', trainingName: this.activity.training_session_name, startedAt: this.activity.started_at, currentStep: this.currentStepValue, ...this.metrics(now) };
  }

  async discard(): Promise<void> {
    if (!this.activity) return;
    await this.flush();
    await this.activities.excluir(this.activity.id);
    this.activity = null;
    this.statusValue = null;
    this.pending = [];
  }

  private requireTransition(next: ActivityStatusSlug): void {
    if (!this.activity) throw new InvalidActivityTransitionError('Atividade não iniciada');
    const valid = (this.statusValue === 'in_progress' && next === 'paused') || (this.statusValue === 'paused' && next === 'in_progress');
    if (!valid) throw new InvalidActivityTransitionError(`Transição inválida: ${this.statusValue} -> ${next}`);
  }

  private releaseFinishedActivity(): void {
    if (this.statusValue !== 'finished') return;
    this.activity = null; this.statusValue = null; this.pending = []; this.movingSeconds = 0;
    this.accumulatedPausedMilliseconds = 0; this.pausedAt = null; this.distanceMeters = 0;
    this.lastAcceptedAt = null; this.recent = []; this.signal = createSignalQualityState(); this.segmentIndex = 0;
    this.splitDetector = new KilometerSplitDetector();
    this.currentStepValue = null;
    this.trainingEngine = null;
  }

  private async loadCurrentStep(activityId: number, at = new Date(this.clock.now())): Promise<ActivityRecoverySnapshot['currentStep']> {
    const [current] = await this.database.all<{ name: string; slug: string; position: number; total: number; repetition_index: number; repeat_count: number | null; planned_duration_seconds: number; instructions: string | null; started_at: string }>(
      `SELECT t.name,t.slug,s.position,s.repetition_index,s.planned_duration_seconds,s.instructions,s.started_at,
              COALESCE(b.repeat_count,1) repeat_count,
              (SELECT COUNT(*) FROM activity_steps WHERE activity_id=s.activity_id) total
       FROM activity_steps s JOIN step_types t ON t.id=s.step_type_id
       LEFT JOIN training_steps source ON source.id=s.training_step_id
       LEFT JOIN training_blocks b ON b.id=source.training_block_id
       WHERE s.activity_id=? AND s.finished_at IS NULL ORDER BY s.position LIMIT 1`,
      [activityId],
    );
    if (!current) return null;
    const [next] = await this.database.all<{ name: string; slug: string; planned_duration_seconds: number }>(
      `SELECT t.name,t.slug,s.planned_duration_seconds FROM activity_steps s
       JOIN step_types t ON t.id=s.step_type_id WHERE s.activity_id=? AND s.position>? ORDER BY s.position LIMIT 1`,
      [activityId, current.position],
    );
    const elapsed = this.trainingEngine
      ? (await this.trainingEngine.state(at)).elapsedSeconds
      : Math.max(0, Math.floor((at.getTime() - Date.parse(current.started_at)) / 1000));
    return {
      name: current.name,
      slug: current.slug,
      position: current.position + 1,
      total: current.total,
      repetitionIndex: current.repetition_index,
      repeatCount: current.repeat_count ?? 1,
      plannedDurationSeconds: current.planned_duration_seconds,
      actualDurationSeconds: Math.min(elapsed, current.planned_duration_seconds),
      remainingSeconds: Math.max(0, current.planned_duration_seconds - elapsed),
      instructions: current.instructions,
      next: next ? { name: next.name, slug: next.slug, plannedDurationSeconds: next.planned_duration_seconds } : null,
    };
  }

  private attachTrainingEngine(activityId: number): void {
    this.trainingEngine = new TrainingEngine(this.database, activityId);
    this.trainingEngine.onStepStarted(step => this.guidance.emit({ text: verbalizeStep(step.slug as import('@/database/types').StepTypeSlug, step.plannedDurationSeconds, step.instructions) }));
    this.trainingEngine.onThirtySecondsRemaining(() => this.guidance.emit({ text: 'Faltam trinta segundos.' }));
    this.trainingEngine.onFinished(async id => {
      this.currentStepValue = null;
      await this.guidance.emit({ text: 'Treino concluído.', haptic: 'success' });
      for (const listener of this.trainingFinishedListeners) await listener(id);
    });
  }

  /**
   * Reconstrói o estado do filtro a partir do último ponto VÁLIDO persistido.
   * Entra com lacuna pendente marcada no timestamp desse ponto: o tempo em que
   * o app esteve fora do ar é uma lacuna real, então a retomada abre um novo
   * segmento com distância zero em vez de ligar os dois lados por uma reta
   * (US-6.3, US-3.3, US-7.2).
   */
  private async restoreFilterState(activityId: number): Promise<void> {
    const [last] = await this.database.all<{
      latitude: number; longitude: number; accuracy: number | null;
      altitude: number | null; speed: number | null; recorded_at: string; segment_index: number;
    }>(
      'SELECT latitude, longitude, accuracy, altitude, speed, recorded_at, segment_index FROM activity_points WHERE activity_id=? AND is_valid=1 ORDER BY recorded_at DESC LIMIT 1',
      [activityId],
    );
    if (!last) return;
    const recordedAt = Date.parse(last.recorded_at);
    this.orchestrator.restoreState({
      lastAccepted: {
        latitude: last.latitude,
        longitude: last.longitude,
        accuracy: last.accuracy,
        altitude: last.altitude,
        speed: last.speed,
        recordedAt,
      },
      gapPending: true,
      gapDetectedAt: recordedAt,
      segment: last.segment_index,
    });
  }

  private async consume(sample: GpsSample, result: Awaited<ReturnType<GpsFilterOrchestrator['processSample']>>): Promise<void> {
    if (!this.activity || this.statusValue !== 'in_progress') return;
    if (this.trainingEngine) await this.trainingEngine.advance(new Date(sample.recordedAt));
    const accepted = result.decisao.aceito;
    if (accepted) this.segmentIndex = result.decisao.segmento;
    this.pending.push({ activity_id: this.activity.id, latitude: sample.latitude, longitude: sample.longitude, altitude: sample.altitude, accuracy: sample.accuracy, speed: sample.speed, recorded_at: new Date(sample.recordedAt), is_valid: accepted, rejection_reason_slug: accepted ? null : result.decisao.motivo, segment_index: this.segmentIndex });
    if (accepted) {
      const increment = result.decisao.distanciaIncremental;
      if (this.trainingEngine) await this.trainingEngine.addDistance(increment);
      const previousDistance = this.distanceMeters;
      const previousMoving = this.movingSeconds;
      this.distanceMeters += increment;
      if (sample.accuracy != null) this.signal = addSignalSample(this.signal, sample.accuracy, sample.recordedAt);
      if (this.lastAcceptedAt != null && !result.decisao.descontinuidade) {
        const interval = Math.max(0, (sample.recordedAt - this.lastAcceptedAt) / 1000);
        const speed = sample.speed != null && sample.speed >= 0 ? sample.speed : (interval > 0 ? increment / interval : 0);
        if (speed >= movingSpeedThresholdMetersPerSecond && increment >= movingMinimumDisplacementMeters) this.movingSeconds += interval;
      }
      this.lastAcceptedAt = sample.recordedAt;
      this.recent.push({ at: sample.recordedAt, distance: increment });
      this.recent = this.recent.filter(item => item.at >= sample.recordedAt - this.paceWindow * 1000);
      const closedSplits = this.splitDetector.detect(previousDistance, this.distanceMeters, previousMoving, this.movingSeconds);
      if (closedSplits.length) {
        await this.flush(sample.recordedAt);
        for (const split of closedSplits) {
          const inserted = await this.splits.fecharSeAusente(this.activity.id, split.kilometer, split.durationSeconds, split.paceSecondsPerKm, new Date(sample.recordedAt));
          if (inserted) await this.guidance.emit({ text: verbalizeSplit(split.kilometer, split.paceSecondsPerKm) });
        }
      }
    }
    if (this.pending.length >= this.batchSize || sample.recordedAt - this.lastPointFlushAt >= this.batchFlushSeconds * 1000) await this.flush(sample.recordedAt);
    this.checkpoint(new Date(sample.recordedAt));
  }

  async flush(at = this.clock.now()): Promise<void> {
    const batch = this.pending.splice(0);
    if (batch.length) { this.lastPointFlushAt = at; this.queueWrite(() => this.points.inserirEmLote(batch)); }
    await this.drainWrites();
  }

  private checkpoint(at: Date, force = false): void {
    if (!this.activity || this.statusValue === 'finished') return;
    if (!force && at.getTime() - this.lastCheckpointAt < this.checkpointSeconds * 1000) return;
    const snapshot = this.metrics(at.getTime()); this.lastCheckpointAt = at.getTime();
    this.queueWrite(() => this.activities.atualizarMetricas(this.activity!.id, { elapsed_duration_seconds: snapshot.elapsed, moving_duration_seconds: snapshot.moving, distance_meters: snapshot.distance, average_pace_seconds_per_km: snapshot.averagePace }));
  }

  async drainWrites(): Promise<void> {
    await this.writeChain;
    if (this.pendingWriteError) { const error = this.pendingWriteError; this.pendingWriteError = null; throw error; }
  }

  private queueWrite(operation: () => Promise<void>): void {
    this.writeChain = this.writeChain.then(operation).catch(error => { this.pendingWriteError ??= error; });
  }
}
