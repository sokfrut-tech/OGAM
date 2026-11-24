export const MEMORY_SCHEMA_VERSION = 1;

/**
 * DDL intentionally avoids JSON1 functions: JSON support in the native SQLite build
 * must be probed before adding database-level JSON CHECK constraints. The repository
 * validates and serializes JSON before it reaches this table.
 */
export const MEMORY_V1_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS memory_records (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN
      ('fact','preference','project_decision','routine','reminder')),
    subject TEXT NOT NULL CHECK (length(trim(subject)) BETWEEN 1 AND 256),
    predicate TEXT NOT NULL CHECK (length(trim(predicate)) BETWEEN 1 AND 128),
    value_json TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('global','project','conversation')),
    scope_id TEXT,
    source_conversation_id TEXT,
    source_message_id TEXT,
    source_excerpt_hash TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    expires_at INTEGER,
    confidence_milli INTEGER NOT NULL CHECK (confidence_milli BETWEEN 0 AND 1000),
    status TEXT NOT NULL CHECK (status IN
      ('proposed','confirmed','rejected','expired','deleted')),
    user_approved_at INTEGER,
    sync_policy TEXT NOT NULL DEFAULT 'local_only'
      CHECK (sync_policy IN ('local_only','explicitly_synced')),
    schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
    CHECK ((scope = 'global' AND scope_id IS NULL) OR
      (scope <> 'global' AND scope_id IS NOT NULL AND length(trim(scope_id)) > 0)),
    CHECK (expires_at IS NULL OR expires_at > created_at),
    CHECK ((status = 'confirmed' AND user_approved_at IS NOT NULL) OR
      (status <> 'confirmed' AND user_approved_at IS NULL))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_memory_retrieval
    ON memory_records(status, scope, scope_id, kind, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_memory_subject_predicate
    ON memory_records(scope, scope_id, subject, predicate, status)`,
  `CREATE INDEX IF NOT EXISTS idx_memory_source
    ON memory_records(source_conversation_id, source_message_id)`,
  `CREATE TABLE IF NOT EXISTS memory_deletion_tombstones (
    memory_id TEXT PRIMARY KEY NOT NULL,
    deleted_at INTEGER NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN
      ('user_delete','source_deleted','retention_expiry','account_reset')),
    provenance_hash TEXT
  )`,
] as const;
