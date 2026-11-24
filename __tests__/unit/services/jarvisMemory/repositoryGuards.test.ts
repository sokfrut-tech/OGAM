// CI event probe only: this comment verifies that a branch update triggers the PR workflow.
const mockExecuteSync = jest.fn();

jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => ({ executeSync: mockExecuteSync })),
}));

describe('Jarvis memory repository scope and expiry guards', () => {
  let repository: typeof import('../../../../src/services/jarvisMemory/repository').jarvisMemoryRepository;

  beforeEach(() => {
    mockExecuteSync.mockReset();
    mockExecuteSync.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT schema_version')) return { rows: [] };
      return { rows: [], rowsAffected: 1 };
    });
    jest.resetModules();
    repository = require('../../../../src/services/jarvisMemory/repository').jarvisMemoryRepository;
  });

  it('requires an explicit scope for every listing', async () => {
    await expect(repository.list({} as never)).rejects.toThrow(/scope/);
    expect(mockExecuteSync.mock.calls.some(([sql]) => String(sql).startsWith('SELECT id, kind'))).toBe(false);
  });

  it('requires a scope id for project and conversation listings', async () => {
    await expect(repository.list({ scope: 'project' })).rejects.toThrow(/require a scope id/);
    await expect(repository.list({ scope: 'conversation' })).rejects.toThrow(/require a scope id/);
  });

  it('pins project listings to the requested project id', async () => {
    await repository.list({ scope: 'project', scopeId: 'project-42', status: 'confirmed' });
    const [sql, params] = mockExecuteSync.mock.calls.find(([statement]) =>
      String(statement).includes('ORDER BY created_at DESC'),
    ) as [string, unknown[]];

    expect(sql).toContain('WHERE scope = ? AND scope_id = ? AND status = ?');
    expect(params).toEqual(['project', 'project-42', 'confirmed']);
  });

  it('keeps global listings separate from project and conversation records', async () => {
    await repository.list({ scope: 'global' });
    const [sql, params] = mockExecuteSync.mock.calls.find(([statement]) =>
      String(statement).includes('ORDER BY created_at DESC'),
    ) as [string, unknown[]];

    expect(sql).toContain('WHERE scope = ? AND scope_id IS NULL');
    expect(params).toEqual(['global']);
  });

  it('does not confirm a proposal after its expiry timestamp', async () => {
    await repository.confirmProposal('memory-1');
    const [sql, params] = mockExecuteSync.mock.calls.find(([statement]) =>
      String(statement).includes("SET status = 'confirmed'"),
    ) as [string, unknown[]];

    expect(sql).toContain('(expires_at IS NULL OR expires_at > ?)');
    expect(params).toHaveLength(4);
    expect(params[2]).toBe('memory-1');
    expect(params[0]).toBe(params[1]);
    expect(params[1]).toBe(params[3]);
  });
});
