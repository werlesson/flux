import type { DatabaseAdapter } from '../adapter';
import { now } from './mappers';

export type PreferenceValue = boolean | number | string | null;
const caches = new WeakMap<DatabaseAdapter, Map<string, PreferenceValue>>();

export class AppPreferencesRepository {
  private cache: Map<string, PreferenceValue> | undefined;
  constructor(private readonly database: DatabaseAdapter) { this.cache = caches.get(database); }

  private async carregar(): Promise<void> {
    if (this.cache) return;
    const rows = await this.database.all<{ key: string; value: string }>('SELECT key, value FROM app_preferences');
    this.cache = new Map(rows.map(row => [row.key, JSON.parse(row.value) as PreferenceValue]));
    caches.set(this.database, this.cache);
  }

  async ler<T extends PreferenceValue>(chave: string, padrao: T): Promise<T> {
    await this.carregar();
    return (this.cache!.has(chave) ? this.cache!.get(chave) : padrao) as T;
  }

  async gravar(chave: string, valor: PreferenceValue, at = new Date()): Promise<void> {
    await this.carregar();
    const timestamp = now(at);
    await this.database.run(
      `INSERT INTO app_preferences(key,value,created_at,updated_at) VALUES(?,?,?,?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
      [chave, JSON.stringify(valor), timestamp, timestamp],
    );
    this.cache!.set(chave, valor);
  }
}

export const PreferencesRepository = AppPreferencesRepository;
