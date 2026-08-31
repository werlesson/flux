import { openDatabaseAsync } from 'expo-sqlite';

import { configureDatabaseConnection, type DatabaseAdapter } from './adapter';
import { ExpoSQLiteAdapter } from './expo-adapter';
import { runMigrations } from './migrations';
import { bootstrapLocalUser, seedAppPreferences, seedLookups } from './seeds';
import { LookupRepository } from './repositories/lookups';

let databasePromise: Promise<DatabaseAdapter> | undefined;
let localUserId: number | undefined;

export async function initializeDatabase(): Promise<DatabaseAdapter> {
  databasePromise ??= (async () => {
    const native = await openDatabaseAsync('flux.db');
    const database = new ExpoSQLiteAdapter(native);
    await configureDatabaseConnection(database);
    await runMigrations(database);
    await seedLookups(database);
    await seedAppPreferences(database);
    localUserId = await bootstrapLocalUser(database);
    await new LookupRepository(database).carregar();
    return database;
  })();
  return databasePromise;
}

export function getLocalUserId(): number {
  if (localUserId === undefined) throw new Error('Database has not been initialized');
  return localUserId;
}

export type { DatabaseAdapter } from './adapter';
export * from './dates';
export * from './repositories';
export * from './transaction';
export * from './types';
