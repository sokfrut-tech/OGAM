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

describe('Jarvis memory M3 management service (real SQLite)', () => {
  let controller: typeof import('../../../../src/services/jarvisMemory/confirmationController').jarvisMemoryConfirmationController;
  let management: typeof import('../../../../src/services/jarvisMemory/managementService').jarvisMemoryManagementService;
  let repository: typeof import('../../../../src/services/jarvisMemory/repository').jarvisMemoryRepository;
  let MemoryDisabledErr: typeof import('../../../../src/services/jarvisMemory/managementService').MemoryDisabledError;
  let SecretBlockedErr: typeof import('../../../../src/services/jarvisMemory/secretGuard').SecretMemoryBlockedError;

  beforeEach(() => {
    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
    activeSqliteDb = new DatabaseSync(':memory:');
    activeSqliteDb.exec('PRAGMA foreign_keys = ON');

    jest.resetModules();
    const ctrlMod = require('../../../../src/services/jarvisMemory/confirmationController');
    const mgmtMod = require('../../../../src/services/jarvisMemory/managementService');
    const repoMod = require('../../../../src/services/jarvisMemory/repository');
    const guardMod = require('../../../../src/services/jarvisMemory/secretGuard');

    controller = ctrlMod.jarvisMemoryConfirmationController;
    management = mgmtMod.jarvisMemoryManagementService;
    repository = repoMod.jarvisMemoryRepository;
    MemoryDisabledErr = mgmtMod.MemoryDisabledError;
    SecretBlockedErr = guardMod.SecretMemoryBlockedError;
  });

  afterEach(() => {
    if (activeSqliteDb) {
      activeSqliteDb.close();
      activeSqliteDb = null;
    }
  });

  it('persists fail-closed memory pause/resume without deleting records (MEM-026)', async () => {
    expect(await management.isMemoryEnabled()).toBe(true);

    const draft = await controller.propose({
      kind: 'preference',
      subject: 'язык общения',
      predicate: 'language',
      value: 'Русский',
      scope: 'global',
    });
    expect(
      await controller.confirm(draft.proposal.id, { userAction: 'explicit_confirm' }),
    ).toBe(true);

    const pausedState = await management.setMemoryEnabled(false);
    expect(pausedState.enabled).toBe(false);
    expect(pausedState.updatedAt).not.toBeNull();
    expect(await management.isMemoryEnabled()).toBe(false);

    // Secrets are still blocked immediately by secretGuard even while memory is paused.
    await expect(
      controller.propose({
        kind: 'fact',
        subject: 'token',
        predicate: 'api_key',
        value: 'ghp_1234567890abcdefghij1234567890abcdef',
        scope: 'global',
      }),
    ).rejects.toBeInstanceOf(SecretBlockedErr);

    // Non-secret proposals fail closed while paused.
    await expect(
      controller.propose({
        kind: 'fact',
        subject: 'device',
        predicate: 'model',
        value: 'PGEM10',
        scope: 'global',
      }),
    ).rejects.toBeInstanceOf(MemoryDisabledErr);

    // Existing confirmed records stay preserved intact.
    const existing = await repository.listActiveConfirmed({ scope: 'global' });
    expect(existing.map(r => r.id)).toEqual([draft.proposal.id]);

    // Re-enabling restores proposals.
    await management.setMemoryEnabled(true);
    const secondDraft = await controller.propose({
      kind: 'fact',
      subject: 'device',
      predicate: 'model',
      value: 'PGEM10',
      scope: 'global',
    });
    expect(secondDraft.proposal.status).toBe('proposed');
  });

  it('searches and filters within strict scope boundaries (MEM-025)', async () => {
    const g = await controller.propose({
      kind: 'fact',
      subject: 'Профиль',
      predicate: 'город',
      value: 'Москва',
      scope: 'global',
    });
    const pAlpha1 = await controller.propose({
      kind: 'project_decision',
      subject: 'Хранилище',
      predicate: 'db_engine',
      value: 'OP-SQLite 15.2.5',
      scope: 'project',
      scopeId: 'alpha',
    });
    const pAlpha2 = await controller.propose({
      kind: 'routine',
      subject: 'Релиз',
      predicate: 'checks',
      value: 'Проверять 16 KB выравнивание APK',
      scope: 'project',
      scopeId: 'alpha',
    });
    const pBeta = await controller.propose({
      kind: 'project_decision',
      subject: 'Хранилище',
      predicate: 'db_engine',
      value: 'OP-SQLite secret beta',
      scope: 'project',
      scopeId: 'beta',
    });

    for (const id of [g.proposal.id, pAlpha1.proposal.id, pAlpha2.proposal.id, pBeta.proposal.id]) {
      await controller.confirm(id, { userAction: 'explicit_confirm' });
    }

    const alphaMatches = await management.searchRecords({
      scope: 'project',
      scopeId: 'alpha',
      query: 'sqlite',
      status: 'confirmed',
    });
    expect(alphaMatches.map(r => r.id)).toEqual([pAlpha1.proposal.id]);

    const alphaRoutines = await management.searchRecords({
      scope: 'project',
      scopeId: 'alpha',
      kind: 'routine',
      status: 'confirmed',
    });
    expect(alphaRoutines.map(r => r.id)).toEqual([pAlpha2.proposal.id]);

    const cyrillicGlobal = await management.searchRecords({
      scope: 'global',
      query: 'моск',
      status: 'confirmed',
    });
    expect(cyrillicGlobal.map(r => r.id)).toEqual([g.proposal.id]);
  });

  it('captures pre-edit and pre-delete snapshots for atomic 1-step Undo clearing tombstones', async () => {
    const draft = await controller.propose({
      kind: 'fact',
      subject: 'Телефон',
      predicate: 'device_os',
      value: 'ColorOS 16',
      scope: 'global',
      sourceConversationId: 'chat-1',
      sourceExcerptHash: 'hash-undo-1',
    });
    await controller.confirm(draft.proposal.id, { userAction: 'explicit_confirm' });
    const confirmedBeforeEdit = await repository.getById(draft.proposal.id);
    expect(confirmedBeforeEdit).toBeDefined();

    // Edit with checkpoint
    const { record: updated, checkpoint: editCp } = await management.updateWithCheckpoint(
      draft.proposal.id,
      { subject: 'Смартфон PGEM10', value: 'Android 16' },
      confirmedBeforeEdit!.updatedAt,
    );
    expect(updated.subject).toBe('Смартфон PGEM10');
    expect(editCp.operation).toBe('update');

    const latestBeforeUndo = await management.getLatestUndoCheckpoint();
    expect(latestBeforeUndo?.id).toBe(editCp.id);

    const undoEditResult = await management.undoLastChange();
    expect(undoEditResult.undone).toBe(true);
    expect(undoEditResult.operation).toBe('update');
    expect(undoEditResult.restoredRecord?.subject).toBe('Телефон');
    expect(undoEditResult.restoredRecord?.value).toBe('ColorOS 16');
    expect(await management.getLatestUndoCheckpoint()).toBeNull();

    // Delete with checkpoint -> tombstone written -> undo delete restores row AND deletes tombstone
    const { deleted, checkpoint: delCp } = await management.deleteWithCheckpoint(
      draft.proposal.id,
      'user_delete',
    );
    expect(deleted).toBe(true);
    expect(delCp?.operation).toBe('delete');
    expect(await repository.getById(draft.proposal.id)).toBeUndefined();
    expect((await repository.listTombstones(10)).some(t => t.memoryId === draft.proposal.id)).toBe(
      true,
    );

    const undoDeleteResult = await management.undoLastChange();
    expect(undoDeleteResult.undone).toBe(true);
    expect(undoDeleteResult.operation).toBe('delete');
    expect(undoDeleteResult.restoredRecord?.id).toBe(draft.proposal.id);
    expect(undoDeleteResult.restoredRecord?.status).toBe('confirmed');
    expect((await repository.listTombstones(10)).some(t => t.memoryId === draft.proposal.id)).toBe(
      false,
    );

    // Consumed checkpoint cannot be undone twice.
    const secondUndo = await management.undoLastChange();
    expect(secondUndo).toEqual({
      undone: false,
      operation: null,
      restoredRecord: null,
      checkpointId: null,
    });
  });

  it('handles source conversation deletion with delete_linked or keep_memory (MEM-019)', async () => {
    const convLinked = await controller.propose({
      kind: 'fact',
      subject: 'Диалоговый факт',
      predicate: 'topic',
      value: 'Таймер на 10 минут',
      scope: 'global',
      sourceConversationId: 'chat-del-1',
      sourceMessageId: 'msg-9',
    });
    const convScoped = await controller.propose({
      kind: 'fact',
      subject: 'Локальная заметка',
      predicate: 'note',
      value: 'Спросить позже',
      scope: 'conversation',
      scopeId: 'chat-del-2',
      sourceConversationId: 'chat-del-2',
    });

    await controller.confirm(convLinked.proposal.id, { userAction: 'explicit_confirm' });
    await controller.confirm(convScoped.proposal.id, { userAction: 'explicit_confirm' });

    const kept = await management.handleSourceConversationDeleted('chat-del-1', 'keep_memory');
    expect(kept.affectedCount).toBe(1);
    expect(kept.detachedIds).toEqual([convLinked.proposal.id]);
    const retained = await repository.getById(convLinked.proposal.id);
    expect(retained?.sourceConversationId).toBeNull();
    expect(retained?.sourceMessageId).toBeNull();

    const deletedRes = await management.handleSourceConversationDeleted(
      'chat-del-2',
      'delete_linked',
    );
    expect(deletedRes.affectedCount).toBe(1);
    expect(deletedRes.deletedIds).toEqual([convScoped.proposal.id]);
    expect(await repository.getById(convScoped.proposal.id)).toBeUndefined();
    const tombstones = await repository.listTombstones(10);
    expect(
      tombstones.some(
        t => t.memoryId === convScoped.proposal.id && t.reason === 'source_deleted',
      ),
    ).toBe(true);
  });

  it('exports portable JSON only on explicit user action with unencrypted warning and secret re-screening (MEM-020)', async () => {
    await expect(
      management.exportPortableJson({ userInitiated: false, includeAllScopes: true }),
    ).rejects.toThrow(/explicit user initiation/i);

    const safe = await controller.propose({
      kind: 'preference',
      subject: 'Стиль ответа',
      predicate: 'conciseness',
      value: 'Кратко и по делу',
      scope: 'global',
    });
    await controller.confirm(safe.proposal.id, { userAction: 'explicit_confirm' });

    const pendingOnly = await controller.propose({
      kind: 'fact',
      subject: 'Черновик',
      predicate: 'draft',
      value: 'Не должен попасть по умолчанию',
      scope: 'global',
    });
    expect(pendingOnly.proposal.status).toBe('proposed');

    // Simulate a legacy row containing a secret bypassed outside repository.
    const now = Date.now();
    activeSqliteDb!.prepare(
      `INSERT INTO memory_records (
        id, kind, subject, predicate, value_json, scope, scope_id,
        created_at, updated_at, expires_at, confidence_milli, status,
        user_approved_at, sync_policy, schema_version
      ) VALUES (?, 'fact', 'Legacy', 'token', ?, 'global', NULL, ?, ?, NULL, 1000, 'confirmed', ?, 'local_only', 1)`,
    ).run(
      'legacy-secret-row',
      JSON.stringify('ghp_1234567890abcdefghij1234567890abcdef'),
      now,
      now,
      now,
    );

    const bundle = await management.exportPortableJson({
      userInitiated: true,
      includeAllScopes: true,
    });

    expect(bundle.format).toBe('jarvis.memory.export.v1');
    expect(bundle.encrypted).toBe(false);
    expect(bundle.securityWarning).toContain('Unencrypted JSON export');
    expect(bundle.recordCount).toBe(1);
    expect(bundle.redactedSecretCount).toBe(1);
    expect(bundle.records.map(r => r.id)).toEqual([safe.proposal.id]);
    expect(JSON.stringify(bundle)).not.toContain('ghp_1234567890');
  });
});

export {};
