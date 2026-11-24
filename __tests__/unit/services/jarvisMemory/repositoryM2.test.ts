const mockExecuteSync = jest.fn();

jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => ({ executeSync: mockExecuteSync })),
}));

import { SecretMemoryBlockedError } from '../../../../src/services/jarvisMemory/secretGuard';
import { MemoryConcurrencyError } from '../../../../src/services/jarvisMemory/repository';

const BASE_ROW = {
  id: 'mem-1',
  kind: 'fact',
  subject: 'phone',
  predicate: 'device_model',
  value_json: JSON.stringify({ model: 'PGEM10', os: 'ColorOS 16' }),
  scope: 'project',
  scope_id: 'proj-1',
  source_conversation_id: 'conv-1',
  source_message_id: 'msg-1',
  source_excerpt_hash: 'hash-abc',
  created_at: 1000,
  updated_at: 2000,
  expires_at: null,
  confidence_milli: 1000,
  status: 'confirmed',
  user_approved_at: 1500,
  sync_policy: 'local_only',
  schema_version: 1,
};

describe('Jarvis memory M2 repository behaviors', () => {
  let repository: typeof import('../../../../src/services/jarvisMemory/repository').jarvisMemoryRepository;
  let ConcurrencyErr: typeof MemoryConcurrencyError;
  let SecretErr: typeof SecretMemoryBlockedError;

  beforeEach(() => {
    mockExecuteSync.mockReset();
    mockExecuteSync.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT schema_version')) return { rows: [] };
      return { rows: [], rowsAffected: 1 };
    });
    jest.resetModules();
    const repoMod = require('../../../../src/services/jarvisMemory/repository');
    const guardMod = require('../../../../src/services/jarvisMemory/secretGuard');
    repository = repoMod.jarvisMemoryRepository;
    ConcurrencyErr = repoMod.MemoryConcurrencyError;
    SecretErr = guardMod.SecretMemoryBlockedError;
  });

  it('blocks secret payloads before touching SQLite on createProposal (MEM-014)', async () => {
    await expect(
      repository.createProposal({
        kind: 'fact',
        subject: 'GitHub',
        predicate: 'token',
        value: 'ghp_1234567890abcdefghij1234567890abcdef',
        scope: 'global',
      }),
    ).rejects.toBeInstanceOf(SecretErr);

    expect(
      mockExecuteSync.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO memory_records')),
    ).toBe(false);
  });

  it('isolates conflict detection by scope and distinguishes differing vs duplicate values (MEM-010)', async () => {
    mockExecuteSync.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT schema_version')) return { rows: [] };
      if (sql.includes("status = 'confirmed'") && sql.includes('lower(trim(subject))')) {
        return { rows: [BASE_ROW] };
      }
      return { rows: [], rowsAffected: 1 };
    });

    const differing = await repository.findConflicts({
      scope: 'project',
      scopeId: 'proj-1',
      subject: 'phone',
      predicate: 'device_model',
      value: { os: 'ColorOS 17', model: 'PGEM10' },
      excludeId: 'mem-new',
    });
    expect(differing).toHaveLength(1);
    expect(differing[0]?.reason).toBe('same_subject_predicate_different_value');

    const duplicate = await repository.findConflicts({
      scope: 'project',
      scopeId: 'proj-1',
      subject: 'phone',
      predicate: 'device_model',
      // Same semantic object with reversed key order -> canonicalizes identically
      value: { os: 'ColorOS 16', model: 'PGEM10' },
    });
    expect(duplicate[0]?.reason).toBe('duplicate_confirmed_value');

    await expect(
      repository.findConflicts({
        scope: 'global',
        scopeId: 'proj-1',
        subject: 'phone',
        predicate: 'device_model',
      }),
    ).rejects.toThrow(/must not have a scope id/);
  });

  it('enforces optimistic concurrency and secret screening in updateRecord (MEM-011)', async () => {
    mockExecuteSync.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT schema_version')) return { rows: [] };
      if (sql.includes('WHERE id = ? LIMIT 1')) return { rows: [BASE_ROW] };
      if (sql.includes('SET subject = ?')) return { rows: [], rowsAffected: 0 };
      return { rows: [], rowsAffected: 1 };
    });

    await expect(
      repository.updateRecord('mem-1', { value: { model: 'PGEM10 Pro' } }, 1999),
    ).rejects.toBeInstanceOf(ConcurrencyErr);

    await expect(
      repository.updateRecord('mem-1', { value: { api_key: 'sk-proj-1234567890abcdefghijklmnop' } }, 2000),
    ).rejects.toBeInstanceOf(SecretErr);
  });

  it('deletes inside a savepoint and records a value-free tombstone (MEM-006)', async () => {
    mockExecuteSync.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT schema_version')) return { rows: [] };
      if (sql.startsWith('SELECT source_excerpt_hash')) return { rows: [{ source_excerpt_hash: 'hash-abc' }] };
      if (sql.startsWith('DELETE FROM memory_records')) return { rows: [], rowsAffected: 1 };
      return { rows: [], rowsAffected: 1 };
    });

    const deleted = await repository.deleteRecord('mem-1', 'user_delete');
    expect(deleted).toBe(true);

    const calls = mockExecuteSync.mock.calls.map(([sql, params]) => [String(sql), params]);
    expect(calls.some(([sql]) => sql === 'SAVEPOINT jarvis_memory_delete')).toBe(true);
    const tombstoneCall = calls.find(([sql]) => sql.includes('INSERT OR REPLACE INTO memory_deletion_tombstones'));
    expect(tombstoneCall).toBeDefined();
    expect(tombstoneCall?.[1]).toEqual(['mem-1', expect.any(Number), 'user_delete', 'hash-abc']);
    expect(calls.some(([sql]) => sql === 'RELEASE SAVEPOINT jarvis_memory_delete')).toBe(true);
  });

  it('clears user_approved_at when expiring stale confirmed records to satisfy CHECK constraint (MEM-005)', async () => {
    await repository.expireStale(5000);
    const expireCall = mockExecuteSync.mock.calls.find(([sql]) =>
      String(sql).includes("SET status = 'expired'"),
    );
    expect(expireCall).toBeDefined();
    expect(String(expireCall?.[0])).toContain('user_approved_at = NULL');
    expect(expireCall?.[1]).toEqual([5000, 5000]);
  });

  it('filters expired records out of listActiveConfirmed even before background cleanup (MEM-005)', async () => {
    const expiredButUnmarked = { ...BASE_ROW, id: 'mem-expired', expires_at: 4000 };
    const activeFuture = { ...BASE_ROW, id: 'mem-active', expires_at: 9000 };
    mockExecuteSync.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT schema_version')) return { rows: [] };
      if (sql.includes('ORDER BY created_at DESC')) {
        return { rows: [expiredButUnmarked, activeFuture] };
      }
      return { rows: [], rowsAffected: 1 };
    });

    const active = await repository.listActiveConfirmed({
      scope: 'project',
      scopeId: 'proj-1',
      now: 5000,
    });
    expect(active.map(r => r.id)).toEqual(['mem-active']);
  });
});

export {};
