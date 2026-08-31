import { DatabaseSync } from 'node:sqlite';

import * as SQLite from 'expo-sqlite';

describe('SQLite repository environment', () => {
  it('executes real SQL in memory through the expo-sqlite API', () => {
    const sqlite = new DatabaseSync(':memory:');
    const nativeDatabase = {
      closeSync: () => sqlite.close(),
      execSync: (source: string) => sqlite.exec(source),
    };
    const database = new SQLite.SQLiteDatabase(
      ':memory:',
      {},
      nativeDatabase as never,
    );

    try {
      database.execSync(`
        CREATE TABLE preferences (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        INSERT INTO preferences (key, value)
        VALUES ('audio_cues_enabled', 'true');
      `);

      const preference = sqlite
        .prepare('SELECT key, value FROM preferences WHERE key = ?')
        .get('audio_cues_enabled');

      expect(preference).toEqual({
        key: 'audio_cues_enabled',
        value: 'true',
      });
    } finally {
      database.closeSync();
    }
  });
});
