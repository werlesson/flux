import type { DatabaseAdapter } from './adapter';

export interface Migration { version: number; migrate(database: DatabaseAdapter): Promise<void> }

const initialSchema = `
CREATE TABLE step_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE activity_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE activity_statuses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE step_execution_statuses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE gps_rejection_reasons (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE training_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL, estimated_duration_seconds INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
CREATE TABLE training_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, training_session_id INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE, position INTEGER NOT NULL, repeat_count INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(training_session_id, position));
CREATE TABLE training_steps (id INTEGER PRIMARY KEY AUTOINCREMENT, training_block_id INTEGER NOT NULL REFERENCES training_blocks(id) ON DELETE CASCADE, step_type_id INTEGER NOT NULL REFERENCES step_types(id), position INTEGER NOT NULL, duration_seconds INTEGER NOT NULL, distance_meters REAL, target_rpe INTEGER, instructions TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(training_block_id, position));
CREATE TABLE activities (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), activity_type_id INTEGER NOT NULL REFERENCES activity_types(id), activity_status_id INTEGER NOT NULL REFERENCES activity_statuses(id), training_session_id INTEGER REFERENCES training_sessions(id) ON DELETE SET NULL, training_session_name TEXT, started_at TEXT NOT NULL, finished_at TEXT, elapsed_duration_seconds INTEGER NOT NULL DEFAULT 0, moving_duration_seconds INTEGER NOT NULL DEFAULT 0, distance_meters REAL NOT NULL DEFAULT 0, average_pace_seconds_per_km INTEGER, best_pace_seconds_per_km INTEGER, rpe INTEGER, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX activities_user_started_at_index ON activities(user_id, started_at);
CREATE INDEX activities_status_index ON activities(activity_status_id);
CREATE TABLE activity_points (id INTEGER PRIMARY KEY AUTOINCREMENT, activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE, latitude REAL NOT NULL, longitude REAL NOT NULL, altitude REAL, accuracy REAL, speed REAL, recorded_at TEXT NOT NULL, is_valid INTEGER NOT NULL DEFAULT 1 CHECK(is_valid IN (0,1)), rejection_reason_id INTEGER REFERENCES gps_rejection_reasons(id), segment_index INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE INDEX activity_points_activity_recorded_at_index ON activity_points(activity_id, recorded_at);
CREATE INDEX activity_points_activity_valid_index ON activity_points(activity_id, is_valid);
CREATE TABLE activity_splits (id INTEGER PRIMARY KEY AUTOINCREMENT, activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE, kilometer INTEGER NOT NULL, duration_seconds INTEGER NOT NULL, pace_seconds_per_km INTEGER NOT NULL, created_at TEXT NOT NULL, UNIQUE(activity_id, kilometer));
CREATE TABLE activity_steps (id INTEGER PRIMARY KEY AUTOINCREMENT, activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE, training_step_id INTEGER REFERENCES training_steps(id) ON DELETE SET NULL, step_type_id INTEGER NOT NULL REFERENCES step_types(id), step_execution_status_id INTEGER NOT NULL REFERENCES step_execution_statuses(id), position INTEGER NOT NULL, repetition_index INTEGER NOT NULL DEFAULT 1, planned_duration_seconds INTEGER NOT NULL, instructions TEXT, actual_duration_seconds INTEGER NOT NULL DEFAULT 0, distance_meters REAL NOT NULL DEFAULT 0, started_at TEXT, finished_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(activity_id, position));
CREATE TABLE activity_pause_intervals (id INTEGER PRIMARY KEY AUTOINCREMENT, activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE, started_at TEXT NOT NULL, finished_at TEXT, created_at TEXT NOT NULL);
CREATE INDEX activity_pause_intervals_activity_index ON activity_pause_intervals(activity_id, started_at);
CREATE TABLE app_preferences (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, value TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
`;

export const migrations: readonly Migration[] = [
  { version: 1, migrate: (database) => database.exec(initialSchema) },
  { version: 7, migrate: async (database) => {
    const columns = await database.all<{ name: string }>('PRAGMA table_info(activity_points)');
    if (!columns.some(column => column.name === 'segment_index')) {
      await database.exec('ALTER TABLE activity_points ADD COLUMN segment_index INTEGER NOT NULL DEFAULT 0');
    }
  } },
];

export async function runMigrations(database: DatabaseAdapter, list: readonly Migration[] = migrations): Promise<void> {
  const rows = await database.all<{ user_version: number }>('PRAGMA user_version');
  let current = rows[0]?.user_version ?? 0;
  const ordered = [...list].sort((a, b) => a.version - b.version);
  for (const migration of ordered) {
    if (migration.version <= current) continue;
    if (!Number.isSafeInteger(migration.version) || migration.version <= 0) throw new Error('Migration versions must be positive integers');
    await database.transaction(async (transaction) => {
      await migration.migrate(transaction);
      await transaction.exec(`PRAGMA user_version = ${migration.version}`);
    });
    current = migration.version;
  }
}
