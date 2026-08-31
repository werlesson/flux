import type { SQLiteDatabase } from 'expo-sqlite';

import type { DatabaseAdapter, RunResult, SqlParams } from './adapter';

function bind(params: SqlParams | undefined): SqlParams {
  return params ?? [];
}

export class ExpoSQLiteAdapter implements DatabaseAdapter {
  constructor(
    private readonly database: SQLiteDatabase,
    private readonly transactionState = { depth: 0, sequence: 0 },
  ) {}

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
    if (this.transactionState.depth > 0) {
      const savepoint = `flux_transaction_${this.transactionState.sequence++}`;
      await this.database.execAsync(`SAVEPOINT ${savepoint}`);
      this.transactionState.depth++;
      try {
        const result = await operation(this);
        await this.database.execAsync(`RELEASE SAVEPOINT ${savepoint}`);
        return result;
      } catch (error) {
        await this.database.execAsync(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await this.database.execAsync(`RELEASE SAVEPOINT ${savepoint}`);
        throw error;
      } finally {
        this.transactionState.depth--;
      }
    }
    let result!: T;
    this.transactionState.depth++;
    try {
      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        result = await operation(new ExpoSQLiteAdapter(transaction, this.transactionState));
      });
    } finally {
      this.transactionState.depth--;
    }
    return result;
  }
}
