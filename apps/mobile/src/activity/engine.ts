import type { DatabaseAdapter } from '@/database/adapter';
import { ActivitiesRepository } from '@/database/repositories/activities';
import { type ActivityPointInput,ActivityPointsRepository } from '@/database/repositories/activity-points';
import { ActivitySplitsRepository } from '@/database/repositories/activity-splits';
import type { Activity, ActivityStatusSlug } from '@/database/types';
import type { GpsSample } from '@/gps/filter';
import { haversineDistanceMeters } from '@/gps/distance';
import { GpsFilterOrchestrator } from '@/gps/orchestrator';
import { addSignalSample, createSignalQualityState, evaluateSignalTimeout, type SignalQuality, type SignalQualityState } from '@/gps/signal-quality';
import { activityPointBatchFlushIntervalSeconds, activityPointBatchSize, activityStatePersistenceIntervalSeconds, currentPaceMinimumDurationSeconds, currentPaceWindowSeconds, movingMinimumDisplacementMeters, movingSpeedThresholdMetersPerSecond } from '@/gps/thresholds';

import { type ActivityClock,elapsedSeconds, paceSecondsPerKm, systemActivityClock } from './clock';
import { KilometerSplitDetector } from './split-detector';

export interface ActivityMetricsSnapshot { elapsed: number; moving: number; distance: number; currentPace: number | null; averagePace: number | null }
export interface ActivityEngineOptions { pointBatchSize?: number; pointBatchFlushIntervalSeconds?: number; persistenceIntervalSeconds?: number; paceWindowSeconds?: number; clock?: ActivityClock; onStartError?: (message: string) => void }
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
  private writeChain: Promise<void> = Promise.resolve();
  private pendingWriteError: unknown = null;
  private readonly activities: ActivitiesRepository;
  private readonly points: ActivityPointsRepository;
  private readonly splits: ActivitySplitsRepository;
  private readonly orchestrator: GpsFilterOrchestrator;
  private readonly clock: ActivityClock;
  private readonly batchSize: number;
  private readonly batchFlushSeconds: number;
  private readonly checkpointSeconds: number;
  private readonly paceWindow: number;
  private readonly onStartError?: (message: string) => void;

  constructor(private readonly database: DatabaseAdapter, options: ActivityEngineOptions = {}) {
    this.activities = new ActivitiesRepository(database);
    this.points = new ActivityPointsRepository(database);
    this.splits = new ActivitySplitsRepository(database);
    this.clock = options.clock ?? systemActivityClock;
    this.batchSize = options.pointBatchSize ?? activityPointBatchSize;
    this.batchFlushSeconds = options.pointBatchFlushIntervalSeconds ?? activityPointBatchFlushIntervalSeconds;
    this.checkpointSeconds = options.persistenceIntervalSeconds ?? activityStatePersistenceIntervalSeconds;
    this.paceWindow = options.paceWindowSeconds ?? currentPaceWindowSeconds;
    this.onStartError = options.onStartError;
    this.orchestrator = new GpsFilterOrchestrator(undefined, (sample, result) => this.consume(sample, result));
  }

  get id(): number | null { return this.activity?.id ?? null; }
  get status(): ActivityStatusSlug | null { return this.statusValue; }
  get signalQuality(): SignalQuality { return evaluateSignalTimeout(this.signal, this.clock.now()).quality; }

  async startFreeRun(userId: number, startedAt = new Date(this.clock.now())): Promise<Activity> {
    if (this.activity) throw new Error('JÃ¡ existe uma atividade neste motor');
    try {
      const created = await this.activities.criar({ user_id: userId, activity_type_slug: 'free_run', started_at: startedAt });
      this.activity = created; this.statusValue = 'in_progress'; this.lastCheckpointAt = startedAt.getTime(); this.lastPointFlushAt = startedAt.getTime();
      return created;
    } catch (error) {
      this.onStartError?.('Não foi possível iniciar a atividade. Tente novamente.');
      throw error;
    }
  }

  async startStructuredRun(userId: number, trainingSessionId: number, trainingName: string, startedAt = new Date(this.clock.now())): Promise<Activity> {
    if (this.activity) throw new Error('Já existe uma atividade neste motor');
    try {
      const created = await this.activities.criar({
        user_id: userId,
        activity_type_slug: 'structured',
        training_session_id: trainingSessionId,
        training_session_name: trainingName,
        started_at: startedAt,
      });
      this.activity = created; this.statusValue = 'in_progress'; this.lastCheckpointAt = startedAt.getTime(); this.lastPointFlushAt = startedAt.getTime();
      return created;
    } catch (error) {
      this.onStartError?.('Não foi possível iniciar a atividade. Tente novamente.');
      throw error;
    }
  }

  async restoreLastActivity(): Promise<Activity | null> {
    if (this.activity) throw new Error('JÃ¡ existe uma atividade neste motor');
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
    return activity;
  }

  async pause(at = new Date(this.clock.now())): Promise<void> {
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
      if (!result.changes) throw new Error('Intervalo de pausa aberto nÃ£o encontrado');
      await new ActivitiesRepository(tx).atualizarStatus(this.activity!.id, 'in_progress', at);
    });
    if (this.pausedAt !== null) this.accumulatedPausedMilliseconds += Math.max(0, at.getTime() - this.pausedAt);
    this.statusValue = 'in_progress'; this.pausedAt = null; this.lastAcceptedAt = null;
  }

  async ingest(sample: GpsSample): Promise<void> {
    if (this.statusValue !== 'in_progress') return;
    await this.orchestrator.processSample(sample);
  }

  async onBackground(): Promise<void> {
    await this.flush();
    this.checkpoint(new Date(this.clock.now()), true);
    await this.drainWrites();
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
    if (!this.activity || this.statusValue === 'finished') throw new InvalidActivityTransitionError('Atividade finalizada Ã© terminal');
    await this.flush();
    const snapshot = this.metrics(at.getTime());
    await this.database.transaction(async tx => {
      const best = await new ActivitySplitsRepository(tx).melhorPace(this.activity!.id);
      await new ActivitiesRepository(tx).atualizarMetricas(this.activity!.id, { finished_at: at, activity_status_slug: 'finished', elapsed_duration_seconds: snapshot.elapsed, moving_duration_seconds: snapshot.moving, distance_meters: snapshot.distance, average_pace_seconds_per_km: snapshot.averagePace, best_pace_seconds_per_km: best }, at);
      await tx.run('UPDATE activity_pause_intervals SET finished_at=? WHERE activity_id=? AND finished_at IS NULL', [at.toISOString(), this.activity!.id]);
    });
    this.statusValue = 'finished';
    return (await this.activities.buscarPorId(this.activity.id))!;
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
    if (!this.activity) throw new InvalidActivityTransitionError('Atividade nÃ£o iniciada');
    const valid = (this.statusValue === 'in_progress' && next === 'paused') || (this.statusValue === 'paused' && next === 'in_progress');
    if (!valid) throw new InvalidActivityTransitionError(`TransiÃ§Ã£o invÃ¡lida: ${this.statusValue} -> ${next}`);
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
    const accepted = result.decisao.aceito;
    if (accepted) this.segmentIndex = result.decisao.segmento;
    this.pending.push({ activity_id: this.activity.id, latitude: sample.latitude, longitude: sample.longitude, altitude: sample.altitude, accuracy: sample.accuracy, speed: sample.speed, recorded_at: new Date(sample.recordedAt), is_valid: accepted, rejection_reason_slug: accepted ? null : result.decisao.motivo, segment_index: this.segmentIndex });
    if (accepted) {
      const increment = result.decisao.distanciaIncremental;
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
        for (const split of closedSplits) await this.splits.fecharSeAusente(this.activity.id, split.kilometer, split.durationSeconds, split.paceSecondsPerKm, new Date(sample.recordedAt));
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
