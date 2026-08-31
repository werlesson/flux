import { DatabaseSync } from 'node:sqlite';

import type { DatabaseAdapter, RunResult, SqlParams, SqlValue } from './adapter';

type NodeSqlValue = string | number | null | Uint8Array;

function values(params: SqlParams | undefined): NodeSqlValue[] | Record<string, NodeSqlValue> {
  return (params ?? []) as NodeSqlValue[] | Record<string, NodeSqlValue>;
}

export class NodeSQLiteAdapter implements DatabaseAdapter {
  private transactionDepth = 0;

  constructor(private readonly database = new DatabaseSync(':memory:')) {
    this.database.exec('PRAGMA foreign_keys = ON');
  }

  async exec(sql: string): Promise<void> {
    this.database.exec(sql);
  }

  async run(sql: string, params?: SqlParams): Promise<RunResult> {
    const statement = this.database.prepare(sql);
    const bound = values(params);
    const result = Array.isArray(bound) ? statement.run(...bound) : statement.run(bound);
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }

  async all<T extends object>(sql: string, params?: SqlParams): Promise<T[]> {
    const statement = this.database.prepare(sql);
    const bound = values(params);
    return (Array.isArray(bound) ? statement.all(...bound) : statement.all(bound)) as T[];
  }

  async transaction<T>(operation: (database: DatabaseAdapter) => Promise<T>): Promise<T> {
    const savepoint = `flux_transaction_${this.transactionDepth++}`;
    const nested = this.transactionDepth > 1;
    this.database.exec(nested ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE');
    try {
      const result = await operation(this);
      this.database.exec(nested ? `RELEASE SAVEPOINT ${savepoint}` : 'COMMIT');
      return result;
    } catch (error) {
      this.database.exec(nested ? `ROLLBACK TO SAVEPOINT ${savepoint}` : 'ROLLBACK');
      throw error;
    } finally {
      this.transactionDepth--;
    }
  }

  close(): void {
    this.database.close();
  }
}

export type { SqlValue };
