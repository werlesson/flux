import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { configureDatabaseConnection, type DatabaseAdapter } from '@/database/adapter';
import { differenceInSeconds, fromDatabaseTimestamp, toDatabaseTimestamp } from '@/database/dates';
import { type Migration, migrations, runMigrations } from '@/database/migrations';
import { NodeSQLiteAdapter } from '@/database/node-adapter';
import { bootstrapLocalUser, lookupSeeds, seedAppPreferences, seedLookups } from '@/database/seeds';
import { fromDatabaseBoolean, toDatabaseBoolean } from '@/database/types';

async function ready(): Promise<NodeSQLiteAdapter> {
  const database = new NodeSQLiteAdapter();
  await runMigrations(database);
  await seedLookups(database, new Date('2026-01-01T00:00:00Z'));
  await seedAppPreferences(database, new Date('2026-01-01T00:00:00Z'));
  await bootstrapLocalUser(database, new Date('2026-01-01T00:00:00Z'));
  return database;
}

async function ids(database: DatabaseAdapter) {
  const user = (await database.all<{ id: number }>('SELECT id FROM users'))[0]!.id;
  const type = (await database.all<{ id: number }>("SELECT id FROM activity_types WHERE slug='free_run'"))[0]!.id;
  const status = (await database.all<{ id: number }>("SELECT id FROM activity_statuses WHERE slug='in_progress'"))[0]!.id;
  const stepType = (await database.all<{ id: number }>("SELECT id FROM step_types WHERE slug='run'"))[0]!.id;
  const stepStatus = (await database.all<{ id: number }>("SELECT id FROM step_execution_statuses WHERE slug='completed'"))[0]!.id;
  return { user, type, status, stepType, stepStatus };
}

describe('infraestrutura e migrações', () => {
  it('mantém foreign keys ativas na conexão', async () => {
    const db = await ready();
    await expect(db.run("INSERT INTO training_sessions(user_id,name,created_at,updated_at) VALUES(999,'x','x','x')")).rejects.toThrow();
    db.close();
  });

  it('journal_mode retorna WAL', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'flux-wal-'));
    const db = new NodeSQLiteAdapter(new DatabaseSync(join(directory, 'flux.db')));
    try {
      await configureDatabaseConnection(db);
      const [result] = await db.all<{ journal_mode: string }>('PRAGMA journal_mode');
      expect(result?.journal_mode.toLowerCase()).toBe('wal');
    } finally {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('é idempotente', async () => {
    const db = new NodeSQLiteAdapter();
    await runMigrations(db); const first = await db.all<{ sql: string }>("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name");
    await runMigrations(db); const second = await db.all<{ sql: string }>("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name");
    expect(second).toEqual(first); db.close();
  });

  it('faz rollback e interrompe migrações após falha', async () => {
    const db = new NodeSQLiteAdapter();
    const broken: Migration[] = [...migrations, { version: 2, migrate: async (tx) => { await tx.exec('CREATE TABLE partial(id INTEGER); SQL INVÁLIDO'); } }, { version: 3, migrate: (tx) => tx.exec('CREATE TABLE must_not_exist(id INTEGER)') }];
    await expect(runMigrations(db, broken)).rejects.toThrow();
    expect((await db.all<{ user_version: number }>('PRAGMA user_version'))[0]!.user_version).toBe(1);
    expect(await db.all("SELECT name FROM sqlite_master WHERE name IN ('partial','must_not_exist')")).toEqual([]); db.close();
  });
});

describe('tipos e datas', () => {
  it('faz roundtrip de boolean', () => { expect(fromDatabaseBoolean(toDatabaseBoolean(true))).toBe(true); expect(fromDatabaseBoolean(toDatabaseBoolean(false))).toBe(false); });
  it('preserva UTC no roundtrip de timestamp', () => { const date = new Date('2026-08-30T10:20:30.456-03:00'); expect(fromDatabaseTimestamp(toDatabaseTimestamp(date)).getTime()).toBe(date.getTime()); expect(toDatabaseTimestamp(date)).toBe('2026-08-30T13:20:30.456Z'); });
  it('calcula diferença imune a fuso', () => { expect(differenceInSeconds(new Date('2026-01-01T10:00:00-03:00'), new Date('2026-01-01T16:30:05+02:00'))).toBe(5405); });
});

describe('schema, seeds e restrições', () => {
  it('rejeita slug duplicado nas cinco lookups', async () => { const db = await ready(); for (const [table, entries] of Object.entries(lookupSeeds)) await expect(db.run(`INSERT INTO ${table}(name,slug,created_at,updated_at) VALUES('x',?,'x','x')`, [entries[0]![0]])).rejects.toThrow(); db.close(); });
  it('semeia todos os 19 identificadores esperados de forma idempotente', async () => { const db = await ready(); await seedLookups(db); await seedAppPreferences(db); for (const [table, entries] of Object.entries(lookupSeeds)) expect((await db.all<{ count: number }>(`SELECT COUNT(*) count FROM ${table}`))[0]!.count).toBe(entries.length); const slugs = (await Promise.all(Object.keys(lookupSeeds).map(table => db.all<{ slug: string }>(`SELECT slug FROM ${table}`)))).flat().map(x => x.slug); const preferenceKeys = (await db.all<{ key: string }>('SELECT key FROM app_preferences')).map(({ key }) => key); const identifiers = [...slugs, ...preferenceKeys]; expect(identifiers).toHaveLength(19); expect(new Set(identifiers).size).toBe(19); db.close(); });
  it('cria o usuário local uma vez', async () => { const db = await ready(); const first = await bootstrapLocalUser(db); const second = await bootstrapLocalUser(db); expect(second).toBe(first); expect((await db.all<{ count: number }>('SELECT COUNT(*) count FROM users'))[0]!.count).toBe(1); db.close(); });
  it('rejeita posições repetidas e apaga etapas com o bloco', async () => { const db = await ready(); const x = await ids(db); const session = (await db.run("INSERT INTO training_sessions(user_id,name,created_at,updated_at) VALUES(?,'t','x','x')", [x.user])).lastInsertRowId; const block = (await db.run("INSERT INTO training_blocks(training_session_id,position,created_at,updated_at) VALUES(?,1,'x','x')", [session])).lastInsertRowId; await expect(db.run("INSERT INTO training_blocks(training_session_id,position,created_at,updated_at) VALUES(?,1,'x','x')", [session])).rejects.toThrow(); await db.run("INSERT INTO training_steps(training_block_id,step_type_id,position,duration_seconds,created_at,updated_at) VALUES(?,?,1,60,'x','x')", [block,x.stepType]); await expect(db.run("INSERT INTO training_steps(training_block_id,step_type_id,position,duration_seconds,created_at,updated_at) VALUES(?,?,1,60,'x','x')", [block,x.stepType])).rejects.toThrow(); await db.run('DELETE FROM training_blocks WHERE id=?',[block]); expect(await db.all('SELECT * FROM training_steps')).toEqual([]); db.close(); });
  it('aceita atividade livre e mantém atividade após soft delete do treino', async () => { const db = await ready(); const x = await ids(db); await db.run("INSERT INTO activities(user_id,activity_type_id,activity_status_id,training_session_id,started_at,created_at,updated_at) VALUES(?,?,?,NULL,'x','x','x')",[x.user,x.type,x.status]); const session=(await db.run("INSERT INTO training_sessions(user_id,name,created_at,updated_at) VALUES(?,'t','x','x')",[x.user])).lastInsertRowId; await db.run("INSERT INTO activities(user_id,activity_type_id,activity_status_id,training_session_id,started_at,created_at,updated_at) VALUES(?,?,?,?,'x','x','x')",[x.user,x.type,x.status,session]); await db.run("UPDATE training_sessions SET deleted_at='x' WHERE id=?",[session]); expect((await db.all<{ count:number }>('SELECT COUNT(*) count FROM activities'))[0]!.count).toBe(2); db.close(); });
  it('apaga pontos, splits e etapas em cascata e aplica unicidade', async () => { const db=await ready(); const x=await ids(db); const activity=(await db.run("INSERT INTO activities(user_id,activity_type_id,activity_status_id,started_at,created_at,updated_at) VALUES(?,?,?,'x','x','x')",[x.user,x.type,x.status])).lastInsertRowId; await db.run("INSERT INTO activity_points(activity_id,latitude,longitude,recorded_at,created_at) VALUES(?,1,1,'x','x')",[activity]); await db.run("INSERT INTO activity_splits(activity_id,kilometer,duration_seconds,pace_seconds_per_km,created_at) VALUES(?,1,60,60,'x')",[activity]); await expect(db.run("INSERT INTO activity_splits(activity_id,kilometer,duration_seconds,pace_seconds_per_km,created_at) VALUES(?,1,60,60,'x')",[activity])).rejects.toThrow(); await db.run("INSERT INTO activity_steps(activity_id,step_type_id,step_execution_status_id,position,planned_duration_seconds,created_at,updated_at) VALUES(?,?,?,1,60,'x','x')",[activity,x.stepType,x.stepStatus]); await expect(db.run("INSERT INTO activity_steps(activity_id,step_type_id,step_execution_status_id,position,planned_duration_seconds,created_at,updated_at) VALUES(?,?,?,1,60,'x','x')",[activity,x.stepType,x.stepStatus])).rejects.toThrow(); await db.run('DELETE FROM activities WHERE id=?',[activity]); for(const table of ['activity_points','activity_splits','activity_steps']) expect((await db.all<{count:number}>(`SELECT COUNT(*) count FROM ${table}`))[0]!.count).toBe(0); db.close(); });
  it('cria preferências sem sobrescrever e rejeita chave duplicada', async () => { const db=await ready(); expect(await db.all('SELECT key,value FROM app_preferences ORDER BY key')).toEqual([{key:'audio_cues_enabled',value:'true'},{key:'haptic_cues_enabled',value:'true'}]); await db.run("UPDATE app_preferences SET value='false' WHERE key='audio_cues_enabled'"); await seedAppPreferences(db); expect((await db.all<{value:string}>("SELECT value FROM app_preferences WHERE key='audio_cues_enabled'"))[0]!.value).toBe('false'); await expect(db.run("INSERT INTO app_preferences(key,value,created_at,updated_at) VALUES('audio_cues_enabled','true','x','x')")).rejects.toThrow(); db.close(); });
});
