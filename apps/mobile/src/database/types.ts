export const SQLITE_TYPES = {
  bigint: 'INTEGER', boolean: 'INTEGER', decimal: 'REAL', integer: 'INTEGER', timestamp: 'TEXT', text: 'TEXT', varchar: 'TEXT',
} as const;

export function toDatabaseBoolean(value: boolean): 0 | 1 { return value ? 1 : 0; }
export function fromDatabaseBoolean(value: number): boolean { return value !== 0; }

interface Timestamps { created_at: Date; updated_at: Date }
interface Lookup<S extends string> extends Timestamps { id: number; name: string; slug: S; description: string | null; is_active: boolean }
export type StepTypeSlug = 'warmup' | 'run' | 'walk' | 'recovery' | 'cooldown';
export type ActivityTypeSlug = 'free_run' | 'structured';
export type ActivityStatusSlug = 'in_progress' | 'paused' | 'finished';
export type StepExecutionStatusSlug = 'completed' | 'skipped' | 'not_performed';
export type GpsRejectionReasonSlug = 'low_accuracy' | 'implausible_speed' | 'position_jump' | 'stale_sample';
export type StepType = Lookup<StepTypeSlug>;
export type ActivityType = Lookup<ActivityTypeSlug>;
export type ActivityStatus = Lookup<ActivityStatusSlug>;
export type StepExecutionStatus = Lookup<StepExecutionStatusSlug>;
export type GpsRejectionReason = Lookup<GpsRejectionReasonSlug>;
export interface User extends Timestamps { id: number; name: string | null }
export interface TrainingSession extends Timestamps { id: number; user_id: number; name: string; estimated_duration_seconds: number; deleted_at: Date | null }
export interface TrainingBlock extends Timestamps { id: number; training_session_id: number; position: number; repeat_count: number }
export interface TrainingStep extends Timestamps { id: number; training_block_id: number; step_type_id: number; position: number; duration_seconds: number; distance_meters: number | null; target_rpe: number | null; instructions: string | null }
export interface Activity extends Timestamps { id: number; user_id: number; activity_type_id: number; activity_status_id: number; training_session_id: number | null; training_session_name: string | null; started_at: Date; finished_at: Date | null; elapsed_duration_seconds: number; moving_duration_seconds: number; distance_meters: number; average_pace_seconds_per_km: number | null; best_pace_seconds_per_km: number | null; rpe: number | null; notes: string | null }
export interface ActivityPoint { id: number; activity_id: number; latitude: number; longitude: number; altitude: number | null; accuracy: number | null; speed: number | null; recorded_at: Date; is_valid: boolean; rejection_reason_id: number | null; created_at: Date }
export interface ActivitySplit { id: number; activity_id: number; kilometer: number; duration_seconds: number; pace_seconds_per_km: number; created_at: Date }
export interface ActivityStep extends Timestamps { id: number; activity_id: number; training_step_id: number | null; step_type_id: number; step_execution_status_id: number; position: number; repetition_index: number; planned_duration_seconds: number; instructions: string | null; actual_duration_seconds: number; distance_meters: number; started_at: Date | null; finished_at: Date | null }
export interface AppPreference extends Timestamps { id: number; key: string; value: boolean | number | string | null }
