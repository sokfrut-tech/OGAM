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

export const MEMORY_DELETION_REASONS = [
  'user_delete',
  'source_deleted',
  'retention_expiry',
  'account_reset',
] as const;

export type MemoryDeletionReason = (typeof MEMORY_DELETION_REASONS)[number];

export interface MemoryDeletionTombstone {
  memoryId: string;
  deletedAt: number;
  reason: MemoryDeletionReason;
  provenanceHash: string | null;
}

export type SecretRiskCategory =
  | 'private_key'
  | 'api_token'
  | 'jwt'
  | 'auth_header_or_uri_secret'
  | 'secret_field_name'
  | 'payment_card'
  | 'seed_phrase';

export interface SecretRiskFinding {
  category: SecretRiskCategory;
  field: string;
  /** Safe category description without raw secret material. */
  label: string;
}

export interface SecretRiskAssessment {
  blocked: boolean;
  findings: SecretRiskFinding[];
  warningMessage: string | null;
}

export type MemoryConflictReason =
  | 'same_subject_predicate_different_value'
  | 'duplicate_confirmed_value';

export interface MemoryConflict {
  existingRecord: MemoryRecord;
  reason: MemoryConflictReason;
}

export interface MemoryProposalDraft {
  proposal: MemoryRecord;
  secretRisk: SecretRiskAssessment;
  conflicts: MemoryConflict[];
  requiresExplicitConfirmation: true;
}

export interface MemoryUpdatePatch {
  subject?: string;
  predicate?: string;
  value?: unknown;
  expiresAt?: number | null;
  confidenceMilli?: number;
}

export interface MemoryListFilters {
  scope: MemoryScope;
  scopeId?: string;
  status?: MemoryStatus;
  excludeExpired?: boolean;
  now?: number;
}
