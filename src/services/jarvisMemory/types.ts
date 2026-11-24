export const MEMORY_KINDS = [
  'fact',
  'preference',
  'project_decision',
  'routine',
  'reminder',
] as const;

export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const MEMORY_SCOPES = ['global', 'project', 'conversation'] as const;
export type MemoryScope = (typeof MEMORY_SCOPES)[number];

export const MEMORY_STATUSES = [
  'proposed',
  'confirmed',
  'rejected',
  'expired',
  'deleted',
] as const;
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export type MemorySyncPolicy = 'local_only' | 'explicitly_synced';

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  subject: string;
  predicate: string;
  value: unknown;
  scope: MemoryScope;
  scopeId: string | null;
  sourceConversationId: string | null;
  sourceMessageId: string | null;
  sourceExcerptHash: string | null;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  confidenceMilli: number;
  status: MemoryStatus;
  userApprovedAt: number | null;
  syncPolicy: MemorySyncPolicy;
  schemaVersion: number;
}

export interface NewMemoryProposal {
  kind: MemoryKind;
  subject: string;
  predicate: string;
  value: unknown;
  scope: MemoryScope;
  scopeId?: string | null;
  sourceConversationId?: string | null;
  sourceMessageId?: string | null;
  sourceExcerptHash?: string | null;
  expiresAt?: number | null;
  confidenceMilli?: number;
}
