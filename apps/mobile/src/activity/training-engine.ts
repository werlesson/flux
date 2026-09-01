import type { DatabaseAdapter } from '@/database/adapter';
import { LookupRepository } from '@/database/repositories/lookups';
import type { ActivityStep, TrainingBlock, TrainingStep } from '@/database/types';

export interface TrainingBlockWithSteps extends Pick<TrainingBlock, 'position' | 'repeat_count'> { steps: Array<Pick<TrainingStep, 'id' | 'step_type_id' | 'position' | 'duration_seconds' | 'instructions'>> }
export interface ExecutableTrainingStep { training_step_id: number | null; step_type_id: number; position: number; repetition_index: number; planned_duration_seconds: number; instructions: string | null }

/** Pure expansion. Neither the input nor its ordering is mutated. */
export function expandTrainingBlocks(blocks: readonly TrainingBlockWithSteps[]): ExecutableTrainingStep[] {
  const result: ExecutableTrainingStep[] = [];
  for (const block of [...blocks].sort((a, b) => a.position - b.position)) {
    if (!Number.isInteger(block.repeat_count) || block.repeat_count < 1) throw new Error('repeat_count deve ser maior que zero');
    const steps = [...block.steps].sort((a, b) => a.position - b.position);
    for (let repetition = 1; repetition <= block.repeat_count; repetition += 1) {
      for (const step of steps) result.push({ training_step_id: step.id, step_type_id: step.step_type_id, position: result.length, repetition_index: repetition, planned_duration_seconds: step.duration_seconds, instructions: step.instructions });
    }
  }
  return result;
}

export type TrainingFinishedListener = (activityId: number) => void | Promise<void>;
export interface TrainingCueStep { position: number; slug: string; plannedDurationSeconds: number; instructions: string | null }
export type TrainingCueListener = (step: TrainingCueStep) => void | Promise<void>;
export interface TrainingEngineState { currentStep: ActivityStep | null; elapsedSeconds: number; remainingSeconds: number; finished: boolean }

export class TrainingEngine {
  private finishedEmitted = false;
  private listeners = new Set<TrainingFinishedListener>();
  private startedListeners = new Set<TrainingCueListener>();
  private warningListeners = new Set<TrainingCueListener>();
  constructor(private readonly database: DatabaseAdapter, readonly activityId: number) {}
  onFinished(listener: TrainingFinishedListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  onStepStarted(listener: TrainingCueListener): () => void { this.startedListeners.add(listener); return () => this.startedListeners.delete(listener); }
  onThirtySecondsRemaining(listener: TrainingCueListener): () => void { this.warningListeners.add(listener); return () => this.warningListeners.delete(listener); }

  async announceCurrentStep(): Promise<void> {
    const current = (await this.steps()).find(step => step.started_at && !step.finished_at);
    if (!current) return;
    const claimed = await this.database.run('UPDATE activity_steps SET started_cue_emitted=1 WHERE id=? AND started_cue_emitted=0', [current.id]);
    if (!claimed.changes) return;
    const cue = await this.cueStep(current);
    for (const listener of this.startedListeners) await listener(cue);
  }

  async state(at = new Date()): Promise<TrainingEngineState> {
    const steps = await this.steps(); const current = steps.find(step => step.started_at && !step.finished_at) ?? null;
    const elapsedSeconds = current ? await this.activeSeconds(current.started_at!, at) : 0;
    return { currentStep: current, elapsedSeconds, remainingSeconds: current ? Math.max(0, current.planned_duration_seconds - elapsedSeconds) : 0, finished: steps.length > 0 && steps.every(step => step.finished_at !== null) };
  }

  async advance(at = new Date()): Promise<TrainingEngineState> {
    let rows = await this.steps();
    while (true) {
      const current = rows.find(step => step.started_at && !step.finished_at);
      if (!current) break;
      const elapsed = await this.activeSeconds(current.started_at!, at);
      if (current.planned_duration_seconds > 30 && elapsed >= current.planned_duration_seconds - 30) {
        const claimed = await this.database.run('UPDATE activity_steps SET warning_cue_emitted=1 WHERE id=? AND warning_cue_emitted=0', [current.id]);
        if (claimed.changes) {
          const cue = await this.cueStep(current);
          for (const listener of this.warningListeners) await listener(cue);
        }
      }
      if (elapsed < current.planned_duration_seconds) break;
      const finishedAt = await this.wallTimeAfterActiveSeconds(current.started_at!, current.planned_duration_seconds, at);
      const actualDuration = await this.activeSeconds(current.started_at!, finishedAt);
      await this.completeAndStartNext(current, 'completed', actualDuration, finishedAt);
      rows = await this.steps();
    }
    await this.emitFinishedIfNeeded(rows);
    return this.state(at);
  }

  async skip(at = new Date()): Promise<TrainingEngineState> {
    const current = (await this.steps()).find(step => step.started_at && !step.finished_at);
    if (!current) return this.state(at);
    await this.completeAndStartNext(current, 'skipped', await this.activeSeconds(current.started_at!, at), at);
    const rows = await this.steps(); await this.emitFinishedIfNeeded(rows); return this.state(at);
  }

  async stop(at = new Date()): Promise<void> {
    const current = (await this.steps()).find(step => step.started_at && !step.finished_at);
    if (current) await this.complete(current, 'skipped', await this.activeSeconds(current.started_at!, at), at);
  }

  /** Attributes one accepted GPS increment to the step active at that sample. */
  async addDistance(distanceMeters: number): Promise<void> {
    if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return;
    await this.database.run(
      `UPDATE activity_steps SET distance_meters=distance_meters+?,updated_at=?
       WHERE id=(SELECT id FROM activity_steps WHERE activity_id=? AND started_at IS NOT NULL AND finished_at IS NULL ORDER BY position LIMIT 1)`,
      [distanceMeters, new Date().toISOString(), this.activityId],
    );
  }

  private async completeAndStartNext(current: ActivityStep, status: 'completed' | 'skipped', duration: number, at: Date): Promise<void> {
    const statusId = await new LookupRepository(this.database).idPorSlug('step_execution_statuses', status);
    await this.database.transaction(async tx => {
      await tx.run('UPDATE activity_steps SET actual_duration_seconds=?,finished_at=?,step_execution_status_id=?,updated_at=? WHERE id=? AND finished_at IS NULL', [Math.max(0, Math.floor(duration)), at.toISOString(), statusId, at.toISOString(), current.id]);
      await tx.run('UPDATE activity_steps SET started_at=?,started_cue_emitted=1,updated_at=? WHERE id=(SELECT id FROM activity_steps WHERE activity_id=? AND position>? AND started_at IS NULL ORDER BY position LIMIT 1)', [at.toISOString(), at.toISOString(), this.activityId, current.position]);
    });
    const next = (await this.steps()).find(step => step.started_at && !step.finished_at);
    if (next) {
      const cue = await this.cueStep(next);
      for (const listener of this.startedListeners) await listener(cue);
    }
  }
  private async complete(current: ActivityStep, status: 'completed' | 'skipped', duration: number, at: Date): Promise<void> {
    const statusId = await new LookupRepository(this.database).idPorSlug('step_execution_statuses', status);
    await this.database.run('UPDATE activity_steps SET actual_duration_seconds=?,finished_at=?,step_execution_status_id=?,updated_at=? WHERE id=? AND finished_at IS NULL', [Math.max(0, Math.floor(duration)), at.toISOString(), statusId, at.toISOString(), current.id]);
  }
  private async steps(): Promise<ActivityStep[]> { const rows = await this.database.all<Record<string, unknown>>('SELECT * FROM activity_steps WHERE activity_id=? ORDER BY position', [this.activityId]); return rows.map(r => ({ ...r, started_at: r.started_at ? new Date(String(r.started_at)) : null, finished_at: r.finished_at ? new Date(String(r.finished_at)) : null, created_at: new Date(String(r.created_at)), updated_at: new Date(String(r.updated_at)) } as unknown as ActivityStep)); }
  private async cueStep(step: ActivityStep): Promise<TrainingCueStep> {
    const [row] = await this.database.all<{ slug: string }>('SELECT slug FROM step_types WHERE id=?', [step.step_type_id]);
    return { position: step.position, slug: row?.slug ?? 'run', plannedDurationSeconds: step.planned_duration_seconds, instructions: step.instructions };
  }
  private async activeSeconds(from: Date, to: Date): Promise<number> { const pauses=await this.database.all<{started_at:string;finished_at:string|null}>('SELECT started_at,finished_at FROM activity_pause_intervals WHERE activity_id=? AND started_at<? AND COALESCE(finished_at,?)>?',[this.activityId,to.toISOString(),to.toISOString(),from.toISOString()]); const pausedMs=pauses.reduce((sum,p)=>sum+Math.max(0,Math.min(to.getTime(),p.finished_at?Date.parse(p.finished_at):to.getTime())-Math.max(from.getTime(),Date.parse(p.started_at))),0); return Math.max(0,Math.floor((to.getTime()-from.getTime()-pausedMs)/1000)); }
  private async wallTimeAfterActiveSeconds(from: Date, seconds: number, ceiling: Date): Promise<Date> { let candidate = new Date(Math.min(ceiling.getTime(), from.getTime()+seconds*1000)); for (let i=0;i<16;i+=1) { const active=await this.activeSeconds(from,candidate); if(active>=seconds) return candidate; candidate=new Date(Math.min(ceiling.getTime(),candidate.getTime()+(seconds-active)*1000)); } return candidate; }
  private async emitFinishedIfNeeded(rows: ActivityStep[]): Promise<void> { if (this.finishedEmitted || rows.length===0 || rows.some(s=>!s.finished_at)) return; this.finishedEmitted=true; for(const listener of this.listeners) await listener(this.activityId); }
}
