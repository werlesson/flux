import type { DatabaseAdapter } from '../adapter';
import { now } from './mappers';

export type PreferenceValue = boolean | number | string | null;
interface PreferenceCache {
  values?: Map<string, PreferenceValue>;
  loading?: Promise<Map<string, PreferenceValue>>;
}

const caches = new WeakMap<DatabaseAdapter, PreferenceCache>();

export class AppPreferencesRepository {
  private readonly cache: PreferenceCache;

  constructor(private readonly database: DatabaseAdapter) {
    const existing = caches.get(database);
    this.cache = existing ?? {};
    if (!existing) caches.set(database, this.cache);
  }

  private async carregar(): Promise<Map<string, PreferenceValue>> {
    if (this.cache.values) return this.cache.values;
    this.cache.loading ??= this.database
      .all<{ key: string; value: string }>('SELECT key, value FROM app_preferences')
      .then(rows => {
        const values = new Map(rows.map(row => [row.key, JSON.parse(row.value) as PreferenceValue]));
        this.cache.values = values;
        return values;
      });
    try {
      return await this.cache.loading;
    } catch (error) {
      this.cache.loading = undefined;
      throw error;
    }
  }

  async ler<T extends PreferenceValue>(chave: string, padrao: T): Promise<T> {
    const values = await this.carregar();
    return (values.has(chave) ? values.get(chave) : padrao) as T;
  }

  async gravar(chave: string, valor: PreferenceValue, at = new Date()): Promise<void> {
    const values = await this.carregar();
    const existed = values.has(chave);
    const previous = values.get(chave);
    // Publish before the SQLite await so an activity cue fired in the same turn
    // observes the switch immediately.
    values.set(chave, valor);
    const timestamp = now(at);
    try {
      await this.database.run(
        `INSERT INTO app_preferences(key,value,created_at,updated_at) VALUES(?,?,?,?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
        [chave, JSON.stringify(valor), timestamp, timestamp],
      );
    } catch (error) {
      if (existed) values.set(chave, previous!); else values.delete(chave);
      throw error;
    }
  }
}

export const PreferencesRepository = AppPreferencesRepository;
