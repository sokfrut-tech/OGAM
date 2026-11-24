import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';

let activeSqliteDb: DatabaseSyncType | null = null;

jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => {
    if (!activeSqliteDb) {
      throw new Error('Test SQLite database was not initialized.');
    }
    const db = activeSqliteDb;
    return {
      executeSync(sql: string, params: unknown[] = []) {
        const trimmed = sql.trim();
        const stmt = db.prepare(trimmed);
        const bindParams = params.map(v => (v === undefined ? null : v)) as Array<
          string | number | Uint8Array | null
        >;
        if (/^(SELECT|PRAGMA|WITH)\b/i.test(trimmed)) {
          return { rows: stmt.all(...bindParams), rowsAffected: 0 };
        }
        const info = stmt.run(...bindParams);
        return { rows: [], rowsAffected: Number(info.changes ?? 0) };
      },
    };
  }),
}));

describe('Jarvis memory M4 deterministic scoped retrieval (real SQLite)', () => {
  let controller: typeof import('../../../../src/services/jarvisMemory/confirmationController').jarvisMemoryConfirmationController;
  let management: typeof import('../../../../src/services/jarvisMemory/managementService').jarvisMemoryManagementService;
  let retrieval: typeof import('../../../../src/services/jarvisMemory/retrievalService').jarvisMemoryRetrievalService;

  beforeEach(() => {
    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
    activeSqliteDb = new DatabaseSync(':memory:');
    activeSqliteDb.exec('PRAGMA foreign_keys = ON');

    jest.resetModules();
    controller = require('../../../../src/services/jarvisMemory/confirmationController')
      .jarvisMemoryConfirmationController;
    management = require('../../../../src/services/jarvisMemory/managementService')
      .jarvisMemoryManagementService;
    retrieval = require('../../../../src/services/jarvisMemory/retrievalService')
      .jarvisMemoryRetrievalService;
  });

  afterEach(() => {
    if (activeSqliteDb) {
      activeSqliteDb.close();
      activeSqliteDb = null;
    }
  });

  it('fails closed when memory is disabled or no active scopes are provided (MEM-009, MEM-026)', async () => {
    const draft = await controller.propose({
      kind: 'fact',
      subject: 'Язык',
      predicate: 'response_language',
      value: 'Всегда отвечать на русском языке',
      scope: 'global',
    });
    await controller.confirm(draft.proposal.id, { userAction: 'explicit_confirm' });

    const emptyScopes = await retrieval.retrieveForPrompt({
      query: 'язык',
      includeGlobal: false,
      projectId: null,
      conversationId: null,
    });
    expect(emptyScopes.items).toEqual([]);
    expect(emptyScopes.promptBlock).toBe('');
    expect(emptyScopes.scopesSearched).toEqual([]);

    await expect(
      retrieval.retrieveForPrompt({
        query: 'язык',
        projectId: '   ',
      }),
    ).rejects.toThrow(/must not be empty/i);

    await management.setMemoryEnabled(false);
    const paused = await retrieval.retrieveForPrompt({
      query: 'язык',
      includeGlobal: true,
    });
    expect(paused.enabled).toBe(false);
    expect(paused.items).toEqual([]);
    expect(paused.promptBlock).toBe('');
  });

  it('isolates project/conversation scopes and excludes proposed/rejected/expired records (MEM-001/005/007/008)', async () => {
    const gConfirmed = await controller.propose({
      kind: 'preference',
      subject: 'Язык ответа',
      predicate: 'language',
      value: 'Только русский язык',
      scope: 'global',
      sourceConversationId: 'chat-setup',
      sourceMessageId: 'm-1',
    });
    const alphaConfirmed = await controller.propose({
      kind: 'project_decision',
      subject: 'Движок SQLite проекта alpha',
      predicate: 'storage_driver',
      value: 'OP-SQLite 15.2.5 на Android 16',
      scope: 'project',
      scopeId: 'alpha',
    });
    const betaConfirmed = await controller.propose({
      kind: 'project_decision',
      subject: 'Секрет проекта beta',
      predicate: 'storage_driver',
      value: 'Проект beta нельзя смешивать с alpha',
      scope: 'project',
      scopeId: 'beta',
    });
    const proposedOnly = await controller.propose({
      kind: 'fact',
      subject: 'Неподтверждённый SQLite',
      predicate: 'unconfirmed',
      value: 'Не должен попадать в промпт',
      scope: 'project',
      scopeId: 'alpha',
    });
    const rejectedOnly = await controller.propose({
      kind: 'fact',
      subject: 'Отклонённый SQLite',
      predicate: 'rejected_note',
      value: 'Отклонено пользователем',
      scope: 'project',
      scopeId: 'alpha',
    });
    const futureExpiry = Date.now() + 5000;
    const expiredLater = await controller.propose({
      kind: 'reminder',
      subject: 'Временный SQLite кэш',
      predicate: 'ttl',
      value: 'Устаревшая запись',
      scope: 'project',
      scopeId: 'alpha',
      expiresAt: futureExpiry,
    });

    await controller.confirm(gConfirmed.proposal.id, { userAction: 'explicit_confirm' });
    await controller.confirm(alphaConfirmed.proposal.id, { userAction: 'explicit_confirm' });
    await controller.confirm(betaConfirmed.proposal.id, { userAction: 'explicit_confirm' });
    await controller.reject(rejectedOnly.proposal.id);
    await controller.confirm(expiredLater.proposal.id, { userAction: 'explicit_confirm' });

    const res = await retrieval.retrieveForPrompt({
      query: 'sqlite',
      includeGlobal: true,
      projectId: 'alpha',
      now: futureExpiry + 100,
    });

    expect(res.enabled).toBe(true);
    expect(res.scopesSearched).toEqual(['global', 'project:alpha']);
    expect(res.items.map(i => i.record.id)).toEqual([alphaConfirmed.proposal.id]);
    expect(res.promptBlock).toContain('[JARVIS_CONFIRMED_MEMORY_BEGIN]');
    expect(res.promptBlock).toContain(`[mem:${alphaConfirmed.proposal.id.slice(0, 8)} | project:alpha | manual]`);
    expect(res.promptBlock).not.toContain('beta');
    expect(res.promptBlock).not.toContain('Неподтверждённый');
    expect(res.promptBlock).not.toContain('Отклонённый');
    expect(res.promptBlock).not.toContain('Устаревшая');
    expect(proposedOnly.proposal.status).toBe('proposed');
  });

  it('orders deterministically by specificity and Russian stem matches while enforcing token budget', async () => {
    const globalLang = await controller.propose({
      kind: 'preference',
      subject: 'язык ответа',
      predicate: 'default_language',
      value: 'Русский язык для всех ответов по умолчанию ' + 'подробности '.repeat(8),
      scope: 'global',
      sourceConversationId: 'chat-global',
    });
    const projectLang = await controller.propose({
      kind: 'project_decision',
      subject: 'язык ответа',
      predicate: 'default_language',
      value: 'В проекте OGAM использовать русский язык интерфейса',
      scope: 'project',
      scopeId: 'ogam',
      sourceConversationId: 'chat-ogam',
      sourceMessageId: 'msg-4',
    });
    const convLang = await controller.propose({
      kind: 'routine',
      subject: 'язык ответа',
      predicate: 'default_language',
      value: 'Текущий диалог: краткие шаги на русском',
      scope: 'conversation',
      scopeId: 'conv-42',
    });

    await controller.confirm(globalLang.proposal.id, { userAction: 'explicit_confirm' });
    await controller.confirm(projectLang.proposal.id, { userAction: 'explicit_confirm' });
    await controller.confirm(convLang.proposal.id, { userAction: 'explicit_confirm' });

    // Cyrillic inflected query ("языка") matches "язык" via deterministic stem prefix.
    const fullRes = await retrieval.retrieveForPrompt({
      query: 'языка',
      includeGlobal: true,
      projectId: 'ogam',
      conversationId: 'conv-42',
      maxTokens: 800,
    });

    expect(fullRes.items.map(item => item.record.scope)).toEqual([
      'conversation',
      'project',
      'global',
    ]);
    expect(fullRes.promptBlock).toContain(
      `[mem:${projectLang.proposal.id.slice(0, 8)} | project:ogam | chat:chat-ogam#msg-4]`,
    );

    // Strict token budget truncates lower-priority entries cleanly and reports omittedCount.
    const tightBudgetRes = await retrieval.retrieveForPrompt({
      query: 'языка',
      includeGlobal: true,
      projectId: 'ogam',
      conversationId: 'conv-42',
      maxTokens: 90,
    });

    expect(tightBudgetRes.estimatedTokens).toBeLessThanOrEqual(90);
    expect(tightBudgetRes.items.length).toBeGreaterThanOrEqual(1);
    expect(tightBudgetRes.items.length).toBeLessThan(3);
    expect(tightBudgetRes.omittedCount).toBe(3 - tightBudgetRes.items.length);
  });
});

export {};
