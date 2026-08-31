export type SqlValue = string | number | null | Uint8Array;
export type SqlParams = SqlValue[] | Record<string, SqlValue>;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface DatabaseAdapter {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParams): Promise<RunResult>;
  all<T extends object>(sql: string, params?: SqlParams): Promise<T[]>;
  transaction<T>(operation: (database: DatabaseAdapter) => Promise<T>): Promise<T>;
}

export async function configureDatabaseConnection(database: DatabaseAdapter): Promise<void> {
  await database.exec('PRAGMA foreign_keys = ON');
  await database.exec('PRAGMA journal_mode = WAL');
}
