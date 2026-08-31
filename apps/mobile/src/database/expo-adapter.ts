import type { SQLiteDatabase } from 'expo-sqlite';

import type { DatabaseAdapter, RunResult, SqlParams } from './adapter';

function bind(params: SqlParams | undefined): SqlParams {
  return params ?? [];
}

export class ExpoSQLiteAdapter implements DatabaseAdapter {
  constructor(private readonly database: SQLiteDatabase) {}

  async exec(sql: string): Promise<void> {
    await this.database.execAsync(sql);
  }

  async run(sql: string, params?: SqlParams): Promise<RunResult> {
    const result = await this.database.runAsync(sql, bind(params));
    return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
  }

  all<T extends object>(sql: string, params?: SqlParams): Promise<T[]> {
    return this.database.getAllAsync<T>(sql, bind(params));
  }

  async transaction<T>(operation: (database: DatabaseAdapter) => Promise<T>): Promise<T> {
    let result!: T;
    await this.database.withExclusiveTransactionAsync(async (transaction) => {
      result = await operation(new ExpoSQLiteAdapter(transaction));
    });
    return result;
  }
}
