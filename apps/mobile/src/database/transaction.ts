import type { DatabaseAdapter } from './adapter';

/** The single entry point for atomic repository operations. */
export function withTransaction<T>(
  database: DatabaseAdapter,
  operation: (transaction: DatabaseAdapter) => Promise<T>,
): Promise<T> {
  return database.transaction(operation);
}

export const emTransacao = withTransaction;
