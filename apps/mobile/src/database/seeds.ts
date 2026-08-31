import type { DatabaseAdapter } from './adapter';
import { toDatabaseTimestamp } from './dates';

const lookups = {
  step_types: [['warmup', 'Aquecimento'], ['run', 'Corrida'], ['walk', 'Caminhada'], ['recovery', 'Recuperação'], ['cooldown', 'Desaquecimento']],
  activity_types: [['free_run', 'Corrida livre'], ['structured', 'Treino estruturado']],
  activity_statuses: [['in_progress', 'Em andamento'], ['paused', 'Pausada'], ['finished', 'Finalizada']],
  step_execution_statuses: [['completed', 'Concluída'], ['skipped', 'Pulada'], ['not_performed', 'Não realizada']],
  gps_rejection_reasons: [['low_accuracy', 'Precisão acima do limiar'], ['implausible_speed', 'Velocidade fisicamente implausível'], ['position_jump', 'Salto abrupto de posição'], ['stale_sample', 'Intervalo entre medições fora do aceitável']],
} as const;

export async function seedLookups(database: DatabaseAdapter, now = new Date()): Promise<void> {
  const timestamp = toDatabaseTimestamp(now);
  await database.transaction(async (transaction) => {
    for (const [table, entries] of Object.entries(lookups)) {
      for (const [slug, name] of entries) {
        await transaction.run(`INSERT INTO ${table} (name, slug, description, is_active, created_at, updated_at) VALUES (?, ?, NULL, 1, ?, ?) ON CONFLICT(slug) DO UPDATE SET name=excluded.name, is_active=1, updated_at=excluded.updated_at`, [name, slug, timestamp, timestamp]);
      }
    }
  });
}

export async function seedAppPreferences(database: DatabaseAdapter, now = new Date()): Promise<void> {
  const timestamp = toDatabaseTimestamp(now);
  for (const key of ['audio_cues_enabled', 'haptic_cues_enabled']) {
    await database.run('INSERT INTO app_preferences (key, value, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO NOTHING', [key, JSON.stringify(true), timestamp, timestamp]);
  }
}

export async function bootstrapLocalUser(database: DatabaseAdapter, now = new Date()): Promise<number> {
  const timestamp = toDatabaseTimestamp(now);
  await database.run('INSERT INTO users (name, created_at, updated_at) SELECT NULL, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users)', [timestamp, timestamp]);
  const users = await database.all<{ id: number }>('SELECT id FROM users ORDER BY id LIMIT 1');
  if (!users[0]) throw new Error('Unable to bootstrap local user');
  return users[0].id;
}

export { lookups as lookupSeeds };
