import { open, type DB } from '@op-engineering/op-sqlite';
import logger from '../../utils/logger';
import { MEMORY_SCHEMA_VERSION, MEMORY_V1_STATEMENTS } from './schema';

type VersionRow = { schema_version: number };

class JarvisMemoryDatabase {
  private db: DB | null = null;
  private ready = false;

  async ensureReady(): Promise<void> {
    if (this.ready) return;

    const db = this.db ?? open({ name: 'jarvis_memory.db' });
    this.db = db;

    db.executeSync('BEGIN IMMEDIATE');
    try {
      db.executeSync(`CREATE TABLE IF NOT EXISTS memory_schema_meta (
        singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
        schema_version INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);

      const rows = (db.executeSync(
        'SELECT schema_version FROM memory_schema_meta WHERE singleton_id = 1',
      ).rows ?? []) as unknown as VersionRow[];

      let version = rows[0]?.schema_version ?? 0;
      if (!Number.isInteger(version) || version < 0) {
        throw new Error('Jarvis memory database has an invalid schema version.');
      }
      if (version > MEMORY_SCHEMA_VERSION) {
        throw new Error(
          `Jarvis memory schema ${version} is newer than this app supports (${MEMORY_SCHEMA_VERSION}).`,
        );
      }

      if (version < 1) {
        for (const statement of MEMORY_V1_STATEMENTS) db.executeSync(statement);
        db.executeSync(
          'INSERT OR REPLACE INTO memory_schema_meta (singleton_id, schema_version, updated_at) VALUES (1, ?, ?)',
          [1, Date.now()],
        );
        version = 1;
      }

      if (version !== MEMORY_SCHEMA_VERSION) {
        throw new Error(`No migration path from Jarvis memory schema ${version}.`);
      }

      db.executeSync('COMMIT');
      this.ready = true;
    } catch (error) {
      try {
        db.executeSync('ROLLBACK');
      } catch (rollbackError) {
        logger.error('[JarvisMemory] Migration rollback failed:', rollbackError);
      }
      logger.error('[JarvisMemory] Failed to initialize:', error);
      throw error;
    }
  }

  getDatabase(): DB {
    if (!this.ready || !this.db) {
      throw new Error('Jarvis memory database is not ready. Call ensureReady() first.');
    }
    return this.db;
  }

  /** Test seam only; production callers must never reset a live database handle. */
  resetForTests(): void {
    this.db = null;
    this.ready = false;
  }
}

export const jarvisMemoryDatabase = new JarvisMemoryDatabase();
