import {
  formatKindLabel,
  formatProvenanceLabel,
  formatScopeLabel,
  formatValuePreview,
  jarvisMemoryConfirmationController,
} from '../../../../src/services/jarvisMemory/confirmationController';
import { jarvisMemoryRepository } from '../../../../src/services/jarvisMemory/repository';
import { SecretMemoryBlockedError } from '../../../../src/services/jarvisMemory/secretGuard';

describe('Jarvis memory confirmation controller', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires explicit confirmation gesture token', async () => {
    const spy = jest.spyOn(jarvisMemoryRepository, 'confirmProposal').mockResolvedValue(true);
    await expect(
      jarvisMemoryConfirmationController.confirm('mem-1', { userAction: 'auto' } as never),
    ).rejects.toThrow(/Explicit user confirmation gesture/);
    expect(spy).not.toHaveBeenCalled();

    const ok = await jarvisMemoryConfirmationController.confirm('mem-1', {
      userAction: 'explicit_confirm',
    });
    expect(ok).toBe(true);
    expect(spy).toHaveBeenCalledWith('mem-1');
  });

  it('screens secrets before calling repository proposeForConfirmation', async () => {
    const spy = jest.spyOn(jarvisMemoryRepository, 'proposeForConfirmation');
    await expect(
      jarvisMemoryConfirmationController.propose({
        kind: 'fact',
        subject: 'key',
        predicate: 'api_key',
        value: 'sk-proj-1234567890abcdefghijklmnop',
        scope: 'global',
      }),
    ).rejects.toBeInstanceOf(SecretMemoryBlockedError);
    expect(spy).not.toHaveBeenCalled();
  });

  it('loads scope snapshot and exposes Russian UI formatting helpers', async () => {
    jest.spyOn(jarvisMemoryRepository, 'listActiveConfirmed').mockResolvedValue([]);
    jest.spyOn(jarvisMemoryRepository, 'listPendingProposals').mockResolvedValue([]);
    jest.spyOn(jarvisMemoryRepository, 'listTombstones').mockResolvedValue([
      { memoryId: 'old-1', deletedAt: 100, reason: 'user_delete', provenanceHash: null },
    ]);

    const snapshot = await jarvisMemoryConfirmationController.loadScopeSnapshot('project', 'ogam');
    expect(snapshot.tombstoneCount).toBe(1);
    expect(formatKindLabel('project_decision')).toBe('Решение проекта');
    expect(formatScopeLabel('project', 'ogam')).toBe('Проект · ogam');
    expect(
      formatProvenanceLabel({
        sourceConversationId: 'chat-7',
        sourceMessageId: 'msg-2',
        syncPolicy: 'local_only',
      }),
    ).toBe('источник: чат chat-7#msg-2 · только локально');
    expect(formatValuePreview('x'.repeat(20), 10)).toBe('xxxxxxxxx…');
  });
});
