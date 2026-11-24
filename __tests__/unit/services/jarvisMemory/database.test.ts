const mockExecuteSync = jest.fn();

jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => ({ executeSync: mockExecuteSync })),
}));

describe('Jarvis memory database migration', () => {
  beforeEach(() => {
    mockExecuteSync.mockReset();
    mockExecuteSync.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT schema_version')) return { rows: [] };
      return { rows: [], rowsAffected: 1 };
    });
    jest.resetModules();
  });

  it('creates schema v1 in a single transaction and records version only before commit', async () => {
    const { jarvisMemoryDatabase } = require('../../../../src/services/jarvisMemory/database');
    await jarvisMemoryDatabase.ensureReady();

    const statements = mockExecuteSync.mock.calls.map(([sql]) => String(sql));
    expect(statements[0]).toBe('BEGIN IMMEDIATE');
    expect(statements.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS memory_records'))).toBe(true);
    expect(statements.some(sql => sql.includes('INSERT OR REPLACE INTO memory_schema_meta'))).toBe(true);
    expect(statements[statements.length - 1]).toBe('COMMIT');
  });

  it('rolls back when a migration statement fails', async () => {
    mockExecuteSync.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT schema_version')) return { rows: [] };
      if (sql.includes('idx_memory_subject_predicate')) throw new Error('simulated DDL failure');
      return { rows: [], rowsAffected: 1 };
    });
    const { jarvisMemoryDatabase } = require('../../../../src/services/jarvisMemory/database');

    await expect(jarvisMemoryDatabase.ensureReady()).rejects.toThrow('simulated DDL failure');
    expect(mockExecuteSync.mock.calls.map(([sql]) => String(sql))).toContain('ROLLBACK');
    expect(mockExecuteSync.mock.calls.map(([sql]) => String(sql))).not.toContain('COMMIT');
  });

  it('refuses a database created by a newer app version without destructive downgrade', async () => {
    mockExecuteSync.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT schema_version')) return { rows: [{ schema_version: 99 }] };
      return { rows: [], rowsAffected: 1 };
    });
    const { jarvisMemoryDatabase } = require('../../../../src/services/jarvisMemory/database');

    await expect(jarvisMemoryDatabase.ensureReady()).rejects.toThrow(/newer than this app supports/);
    const statements = mockExecuteSync.mock.calls.map(([sql]) => String(sql));
    expect(statements).not.toContain('DROP TABLE memory_records');
    expect(statements).toContain('ROLLBACK');
  });
});

export {};
