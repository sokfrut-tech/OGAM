import { jarvisMemoryRepository } from './repository';
import { assertNoSecretRisk } from './secretGuard';
import type {
  MemoryDeletionReason,
  MemoryKind,
  MemoryProposalDraft,
  MemoryRecord,
  MemoryScope,
  MemoryUpdatePatch,
  NewMemoryProposal,
} from './types';

export interface ExplicitConfirmationAction {
  userAction: 'explicit_confirm';
}

export interface MemoryScopeSnapshot {
  confirmed: MemoryRecord[];
  pending: MemoryRecord[];
  tombstoneCount: number;
}

const KIND_LABELS: Record<MemoryKind, string> = {
  fact: 'Факт',
  preference: 'Предпочтение',
  project_decision: 'Решение проекта',
  routine: 'Привычка',
  reminder: 'Напоминание',
};

export function formatKindLabel(kind: MemoryKind): string {
  return KIND_LABELS[kind];
}

export function formatScopeLabel(scope: MemoryScope, scopeId: string | null): string {
  if (scope === 'global') return 'Глобально';
  if (scope === 'project') return `Проект · ${scopeId ?? 'без id'}`;
  return `Диалог · ${scopeId ?? 'без id'}`;
}

export function formatValuePreview(value: unknown, maxLength = 220): string {
  let formatted: string;
  if (typeof value === 'string') {
    formatted = value;
  } else {
    try {
      formatted = JSON.stringify(value, null, 2);
    } catch {
      formatted = String(value);
    }
  }
  if (formatted.length <= maxLength) return formatted;
  return `${formatted.slice(0, maxLength - 1)}…`;
}

export function formatProvenanceLabel(record: Pick<
  MemoryRecord,
  'sourceConversationId' | 'sourceMessageId' | 'syncPolicy'
>): string {
  const origin = record.sourceConversationId
    ? `источник: чат ${record.sourceConversationId}${record.sourceMessageId ? `#${record.sourceMessageId}` : ''}`
    : 'источник: ручной ввод';
  const syncLabel = record.syncPolicy === 'local_only' ? 'только локально' : 'явная синхронизация';
  return `${origin} · ${syncLabel}`;
}

/** Coordinates explicit user confirmation, secret screening, conflict surfacing, and deletion. */
export class JarvisMemoryConfirmationController {
  async propose(input: NewMemoryProposal): Promise<MemoryProposalDraft> {
    assertNoSecretRisk({
      subject: input.subject.trim(),
      predicate: input.predicate.trim(),
      value: input.value,
    });
    return jarvisMemoryRepository.proposeForConfirmation(input);
  }

  /** Rejects implicit calls unless an explicit user gesture token is provided. */
  async confirm(id: string, action: ExplicitConfirmationAction): Promise<boolean> {
    if (!action || action.userAction !== 'explicit_confirm') {
      throw new Error('Explicit user confirmation gesture is required to store memory.');
    }
    return jarvisMemoryRepository.confirmProposal(id);
  }

  reject(id: string): Promise<boolean> {
    return jarvisMemoryRepository.rejectProposal(id);
  }

  updateConfirmed(
    id: string,
    patch: MemoryUpdatePatch,
    expectedUpdatedAt: number,
  ): Promise<MemoryRecord> {
    return jarvisMemoryRepository.updateRecord(id, patch, expectedUpdatedAt);
  }

  remove(id: string, reason: MemoryDeletionReason = 'user_delete'): Promise<boolean> {
    return jarvisMemoryRepository.deleteRecord(id, reason);
  }

  expireStale(now = Date.now()): Promise<number> {
    return jarvisMemoryRepository.expireStale(now);
  }

  async loadScopeSnapshot(
    scope: MemoryScope,
    scopeId?: string,
    now = Date.now(),
  ): Promise<MemoryScopeSnapshot> {
    const [confirmed, pending, tombstones] = await Promise.all([
      jarvisMemoryRepository.listActiveConfirmed({ scope, scopeId, now }),
      jarvisMemoryRepository.listPendingProposals({ scope, scopeId, now }),
      jarvisMemoryRepository.listTombstones(100),
    ]);
    return {
      confirmed,
      pending,
      tombstoneCount: tombstones.length,
    };
  }
}

export const jarvisMemoryConfirmationController = new JarvisMemoryConfirmationController();
