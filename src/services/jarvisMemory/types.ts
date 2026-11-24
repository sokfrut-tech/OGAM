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

export interface MemorySearchFilters extends MemoryListFilters {
  kind?: MemoryKind;
  query?: string;
  limit?: number;
}

export interface MemorySettingsState {
  enabled: boolean;
  updatedAt: number | null;
}

export type MemoryUndoOperation = 'update' | 'delete';

export interface MemoryUndoCheckpoint {
  id: string;
  operation: MemoryUndoOperation;
  memoryId: string;
  snapshot: MemoryRecord;
  createdAt: number;
  consumedAt: number | null;
}

export interface MemoryUndoResult {
  undone: boolean;
  operation: MemoryUndoOperation | null;
  restoredRecord: MemoryRecord | null;
  checkpointId: string | null;
}

export type MemorySourceDeletionAction = 'delete_linked' | 'keep_memory';

export interface MemorySourceDeletionResult {
  action: MemorySourceDeletionAction;
  conversationId: string;
  affectedCount: number;
  deletedIds: string[];
  detachedIds: string[];
}

export interface MemoryExportOptions {
  userInitiated: boolean;
  scope?: MemoryScope;
  scopeId?: string;
  includeAllScopes?: boolean;
  includePending?: boolean;
  now?: number;
}

export interface MemoryExportRecord {
  id: string;
  kind: MemoryKind;
  subject: string;
  predicate: string;
  value: unknown;
  scope: MemoryScope;
  scopeId: string | null;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  confidenceMilli: number;
  status: MemoryStatus;
  userApprovedAt: number | null;
  syncPolicy: MemorySyncPolicy;
  provenance: {
    sourceConversationId: string | null;
    sourceMessageId: string | null;
  };
}

export interface MemoryExportBundle {
  format: 'jarvis.memory.export.v1';
  schemaVersion: 1;
  exportedAt: number;
  encrypted: false;
  securityWarning: string;
  scopeSummary: {
    mode: 'single_scope' | 'all_scopes';
    scope?: MemoryScope;
    scopeId?: string | null;
  };
  recordCount: number;
  redactedSecretCount: number;
  records: MemoryExportRecord[];
}

export interface MemoryRetrievalContext {
  query?: string;
  includeGlobal?: boolean;
  projectId?: string | null;
  conversationId?: string | null;
  maxTokens?: number;
  maxItems?: number;
  requireQueryMatch?: boolean;
  now?: number;
}

export interface MemoryRetrievalItem {
  record: MemoryRecord;
  score: number;
  citation: string;
  formattedLine: string;
  estimatedTokens: number;
}

export interface MemoryRetrievalResult {
  enabled: boolean;
  items: MemoryRetrievalItem[];
  promptBlock: string;
  totalMatched: number;
  omittedCount: number;
  estimatedTokens: number;
  maxTokens: number;
  scopesSearched: string[];
}
