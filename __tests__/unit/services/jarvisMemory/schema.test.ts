import { MEMORY_SCHEMA_VERSION, MEMORY_V1_STATEMENTS } from '../../../../src/services/jarvisMemory/schema';

describe('Jarvis memory schema v1', () => {
  it('is a dedicated versioned schema with the required tables and indexes', () => {
    expect(MEMORY_SCHEMA_VERSION).toBe(1);
    const ddl = MEMORY_V1_STATEMENTS.join('\n');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS memory_records');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS memory_deletion_tombstones');
    expect(ddl).toContain('idx_memory_retrieval');
    expect(ddl).toContain('idx_memory_subject_predicate');
    expect(ddl).toContain('idx_memory_source');
    expect(ddl).toContain("DEFAULT 'local_only'");
  });

  it('does not assume SQLite JSON1 support', () => {
    const ddl = MEMORY_V1_STATEMENTS.join('\n');
    expect(ddl).not.toContain('json_valid');
    expect(ddl).not.toContain('json_extract');
  });

  it('enforces approval, scope, expiry and confidence invariants in SQLite', () => {
    const ddl = MEMORY_V1_STATEMENTS.join('\n');
    expect(ddl).toContain("status = 'confirmed' AND user_approved_at IS NOT NULL");
    expect(ddl).toContain("scope = 'global' AND scope_id IS NULL");
    expect(ddl).toContain('expires_at > created_at');
    expect(ddl).toContain('confidence_milli BETWEEN 0 AND 1000');
  });
});
