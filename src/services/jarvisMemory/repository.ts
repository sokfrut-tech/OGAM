import { Buffer } from 'buffer';
import { generateId } from '../../utils/generateId';
import { jarvisMemoryDatabase } from './database';
import { assertNoSecretRisk } from './secretGuard';
import {
  MEMORY_DELETION_REASONS,
  MEMORY_KINDS,
  MEMORY_SCOPES,
  type MemoryConflict,
  type MemoryDeletionReason,
  type MemoryDeletionTombstone,
  type MemoryListFilters,
  type MemoryProposalDraft,
  type MemoryRecord,
  type MemoryScope,
  type MemoryUpdatePatch,
  type NewMemoryProposal,
} from './types';

/** Error raised when an optimistic update detects a stale updatedAt timestamp. */
export class MemoryConcurrencyError extends Error {
  constructor(message = 'Jarvis memory record was modified concurrently.') {
    super(message);
    this.name = 'MemoryConcurrencyError';
  }
}

function canonicalSort(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => canonicalSort(item));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry !== undefined) {
        out[key] = canonicalSort(entry);
      }
    }
    return out;
  }
  return value;
}

/** Deterministic key-sorted JSON representation for conflict comparison. */
export function canonicalizeJsonValue(value: unknown): string {
  const serialized = JSON.stringify(canonicalSort(value));
  return serialized === undefined ? 'null' : serialized;
}

type DbRow = {
  id: string;
  kind: MemoryRecord['kind'];
  subject: string;
  predicate: string;
  value_json: string;
  scope: MemoryRecord['scope'];
  scope_id: string | null;
  source_conversation_id: string | null;
  source_message_id: string | null;
  source_excerpt_hash: string | null;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
  confidence_milli: number;
  status: MemoryRecord['status'];
  user_approved_at: number | null;
  sync_policy: MemoryRecord['syncPolicy'];
  schema_version: number;
};

export function validateProposal(input: NewMemoryProposal): {
  subject: string;
  predicate: string;
  valueJson: string;
  scopeId: string | null;
} {
  if (!MEMORY_KINDS.includes(input.kind)) throw new Error('Unsupported memory kind.');
  if (!MEMORY_SCOPES.includes(input.scope)) throw new Error('Unsupported memory scope.');

  const subject = input.subject.trim();
  const predicate = input.predicate.trim();
  if (!subject || subject.length > 256) throw new Error('Memory subject must be 1–256 characters.');
  if (!predicate || predicate.length > 128) throw new Error('Memory predicate must be 1–128 characters.');

  const scopeId = input.scopeId?.trim() || null;
  if (input.scope === 'global' && scopeId !== null) {
    throw new Error('Global memory must not have a scope id.');
  }
  if (input.scope !== 'global' && !scopeId) {
    throw new Error('Project and conversation memory require a scope id.');
  }

  let valueJson: string;
  try {
    valueJson = JSON.stringify(input.value);
  } catch {
    throw new Error('Memory value must be JSON serializable.');
  }
  if (valueJson === undefined) throw new Error('Memory value must not be undefined.');
  if (Buffer.byteLength(valueJson, 'utf8') > 16 * 1024) {
    throw new Error('Memory value exceeds the 16 KiB limit.');
  }

  if (
    input.expiresAt != null &&
    (!Number.isSafeInteger(input.expiresAt) || input.expiresAt <= Date.now())
  ) {
    throw new Error('Memory expiry must be a future UTC epoch-millisecond timestamp.');
  }
  const confidence = input.confidenceMilli ?? 1000;
  if (!Number.isInteger(confidence) || confidence < 0 || confidence > 1000) {
    throw new Error('Memory confidence must be an integer from 0 to 1000.');
  }

  return { subject, predicate, valueJson, scopeId };
}

function mapRow(row: DbRow): MemoryRecord {
  let value: unknown;
  try {
    value = JSON.parse(row.value_json);
  } catch {
    throw new Error(`Jarvis memory record ${row.id} contains invalid JSON.`);
  }
  return {
    id: row.id,
    kind: row.kind,
    subject: row.subject,
    predicate: row.predicate,
    value,
    scope: row.scope,
    scopeId: row.scope_id,
    sourceConversationId: row.source_conversation_id,
    sourceMessageId: row.source_message_id,
    sourceExcerptHash: row.source_excerpt_hash,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    expiresAt: row.expires_at == null ? null : Number(row.expires_at),
    confidenceMilli: Number(row.confidence_milli),
    status: row.status,
    userApprovedAt: row.user_approved_at == null ? null : Number(row.user_approved_at),
    syncPolicy: row.sync_policy,
    schemaVersion: Number(row.schema_version),
  };
}

const COLUMNS = `id, kind, subject, predicate, value_json, scope, scope_id,
  source_conversation_id, source_message_id, source_excerpt_hash, created_at,
  updated_at, expires_at, confidence_milli, status, user_approved_at,
  sync_policy, schema_version`;

class JarvisMemoryRepository {
  async createProposal(input: NewMemoryProposal): Promise<MemoryRecord> {
    await jarvisMemoryDatabase.ensureReady();
    const { subject, predicate, valueJson, scopeId } = validateProposal(input);
    assertNoSecretRisk({ subject, predicate, value: input.value });
    const now = Date.now();
    const id = generateId();
    const db = jarvisMemoryDatabase.getDatabase();

    db.executeSync(
      `INSERT INTO memory_records (
        id, kind, subject, predicate, value_json, scope, scope_id,
        source_conversation_id, source_message_id, source_excerpt_hash,
        created_at, updated_at, expires_at, confidence_milli, status,
        user_approved_at, sync_policy, schema_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', NULL, 'local_only', 1)`,
      [
        id,
        input.kind,
        subject,
        predicate,
        valueJson,
        input.scope,
        scopeId,
        input.sourceConversationId ?? null,
        input.sourceMessageId ?? null,
        input.sourceExcerptHash ?? null,
        now,
        now,
        input.expiresAt ?? null,
        input.confidenceMilli ?? 1000,
      ],
    );

    const created = await this.getById(id);
    if (!created) throw new Error('Jarvis memory proposal was not persisted.');
    return created;
  }

  /** Call only from an explicit user-confirmation action; model output must never call this. */
  async confirmProposal(id: string): Promise<boolean> {
    await jarvisMemoryDatabase.ensureReady();
    const now = Date.now();
    const result = jarvisMemoryDatabase.getDatabase().executeSync(
      `UPDATE memory_records
       SET status = 'confirmed', user_approved_at = ?, updated_at = ?
       WHERE id = ? AND status = 'proposed'
         AND (expires_at IS NULL OR expires_at > ?)`,
      [now, now, id, now],
    );
    return result.rowsAffected === 1;
  }

  async rejectProposal(id: string): Promise<boolean> {
    await jarvisMemoryDatabase.ensureReady();
    const result = jarvisMemoryDatabase.getDatabase().executeSync(
      `UPDATE memory_records
       SET status = 'rejected', user_approved_at = NULL, updated_at = ?
       WHERE id = ? AND status = 'proposed'`,
      [Date.now(), id],
    );
    return result.rowsAffected === 1;
  }

  async getById(id: string): Promise<MemoryRecord | undefined> {
    await jarvisMemoryDatabase.ensureReady();
    const rows = (jarvisMemoryDatabase.getDatabase().executeSync(
      `SELECT ${COLUMNS} FROM memory_records WHERE id = ? LIMIT 1`,
      [id],
    ).rows ?? []) as unknown as DbRow[];
    return rows[0] ? mapRow(rows[0]) : undefined;
  }

  /**
   * Every list is explicitly scoped. This prevents a future prompt/retrieval caller
   * from accidentally mixing global, project and conversation memories.
   */
  async list(filters: MemoryListFilters): Promise<MemoryRecord[]> {
    await jarvisMemoryDatabase.ensureReady();

    if (!MEMORY_SCOPES.includes(filters.scope)) throw new Error('Unsupported memory scope.');
    const scopeId = filters.scopeId?.trim();
    if (filters.scope === 'global' && scopeId) {
      throw new Error('Global memory listing must not have a scope id.');
    }
    if (filters.scope !== 'global' && !scopeId) {
      throw new Error('Project and conversation memory listing require a scope id.');
    }

    const where = ['scope = ?'];
    const params: unknown[] = [filters.scope];
    if (filters.scope === 'global') {
      where.push('scope_id IS NULL');
    } else {
      where.push('scope_id = ?');
      params.push(scopeId);
    }
    if (filters.status) {
      where.push('status = ?');
      params.push(filters.status);
    }
    if (filters.excludeExpired) {
      const now = filters.now ?? Date.now();
      where.push('(expires_at IS NULL OR expires_at > ?)');
      params.push(now);
    }

    const rows = (jarvisMemoryDatabase.getDatabase().executeSync(
      `SELECT ${COLUMNS} FROM memory_records
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC`,
      params as never[],
    ).rows ?? []) as unknown as DbRow[];
    return rows.map(mapRow);
  }

  /** Lists active confirmed records, applying both SQL and TypeScript expiry checks (MEM-005). */
  async listActiveConfirmed(filters: {
    scope: MemoryScope;
    scopeId?: string;
    now?: number;
  }): Promise<MemoryRecord[]> {
    const now = filters.now ?? Date.now();
    const rows = await this.list({
      scope: filters.scope,
      scopeId: filters.scopeId,
      status: 'confirmed',
      excludeExpired: true,
      now,
    });
    return rows.filter(
      record => record.status === 'confirmed' && (record.expiresAt === null || record.expiresAt > now),
    );
  }

  /** Lists unexpired pending proposals waiting for explicit user confirmation. */
  async listPendingProposals(filters: {
    scope: MemoryScope;
    scopeId?: string;
    now?: number;
  }): Promise<MemoryRecord[]> {
    const now = filters.now ?? Date.now();
    const rows = await this.list({
      scope: filters.scope,
      scopeId: filters.scopeId,
      status: 'proposed',
      excludeExpired: true,
      now,
    });
    return rows.filter(
      record => record.status === 'proposed' && (record.expiresAt === null || record.expiresAt > now),
    );
  }

  /** Finds same-scope confirmed records sharing subject and predicate without overwriting them. */
  async findConflicts(params: {
    scope: MemoryScope;
    scopeId?: string | null;
    subject: string;
    predicate: string;
    value?: unknown;
    excludeId?: string;
    now?: number;
  }): Promise<MemoryConflict[]> {
    await jarvisMemoryDatabase.ensureReady();
    if (!MEMORY_SCOPES.includes(params.scope)) throw new Error('Unsupported memory scope.');
    const scopeId = params.scopeId?.trim() || null;
    if (params.scope === 'global' && scopeId !== null) {
      throw new Error('Global memory conflict check must not have a scope id.');
    }
    if (params.scope !== 'global' && !scopeId) {
      throw new Error('Project and conversation memory conflict checks require a scope id.');
    }

    const subject = params.subject.trim();
    const predicate = params.predicate.trim();
    if (!subject || !predicate) return [];

    const now = params.now ?? Date.now();
    const where = [
      'scope = ?',
      params.scope === 'global' ? 'scope_id IS NULL' : 'scope_id = ?',
      "status = 'confirmed'",
      '(expires_at IS NULL OR expires_at > ?)',
      'lower(trim(subject)) = lower(?)',
      'lower(trim(predicate)) = lower(?)',
    ];
    const queryParams: unknown[] = [params.scope];
    if (params.scope !== 'global') queryParams.push(scopeId);
    queryParams.push(now, subject, predicate);
    if (params.excludeId) {
      where.push('id <> ?');
      queryParams.push(params.excludeId);
    }

    const rows = (jarvisMemoryDatabase.getDatabase().executeSync(
      `SELECT ${COLUMNS} FROM memory_records
       WHERE ${where.join(' AND ')}
       ORDER BY updated_at DESC`,
      queryParams as never[],
    ).rows ?? []) as unknown as DbRow[];

    const incomingCanonical = 'value' in params ? canonicalizeJsonValue(params.value) : null;
    return rows.map(row => {
      const existingRecord = mapRow(row);
      const isDuplicate =
        incomingCanonical !== null && canonicalizeJsonValue(existingRecord.value) === incomingCanonical;
      return {
        existingRecord,
        reason: isDuplicate
          ? 'duplicate_confirmed_value'
          : 'same_subject_predicate_different_value',
      };
    });
  }

  /** Screens secrets, persists a proposed record, and surfaces conflicts for explicit UI approval. */
  async proposeForConfirmation(input: NewMemoryProposal): Promise<MemoryProposalDraft> {
    const secretRisk = assertNoSecretRisk({
      subject: input.subject.trim(),
      predicate: input.predicate.trim(),
      value: input.value,
    });
    const proposal = await this.createProposal(input);
    const conflicts = await this.findConflicts({
      scope: proposal.scope,
      scopeId: proposal.scopeId,
      subject: proposal.subject,
      predicate: proposal.predicate,
      value: proposal.value,
      excludeId: proposal.id,
    });
    return {
      proposal,
      secretRisk,
      conflicts,
      requiresExplicitConfirmation: true,
    };
  }

  /**
   * Synchronous update for callers that already initialized the shared DB.
   * Must not await while a caller-owned SAVEPOINT is open.
   */
  updateRecordSync(
    id: string,
    patch: MemoryUpdatePatch,
    expectedUpdatedAt: number,
  ): MemoryRecord {
    if (!Number.isSafeInteger(expectedUpdatedAt) || expectedUpdatedAt <= 0) {
      throw new Error('Expected updatedAt timestamp must be a valid epoch-millisecond integer.');
    }

    const db = jarvisMemoryDatabase.getDatabase();
    const rows = (db.executeSync(
      `SELECT ${COLUMNS} FROM memory_records WHERE id = ? LIMIT 1`,
      [id],
    ).rows ?? []) as unknown as DbRow[];
    const existing = rows[0] ? mapRow(rows[0]) : undefined;
    if (!existing || existing.status === 'deleted') {
      throw new Error(`Jarvis memory record ${id} was not found.`);
    }

    const nextInput: NewMemoryProposal = {
      kind: existing.kind,
      subject: patch.subject ?? existing.subject,
      predicate: patch.predicate ?? existing.predicate,
      value: 'value' in patch && patch.value !== undefined ? patch.value : existing.value,
      scope: existing.scope,
      scopeId: existing.scopeId,
      expiresAt: patch.expiresAt !== undefined ? patch.expiresAt : existing.expiresAt,
      confidenceMilli: patch.confidenceMilli ?? existing.confidenceMilli,
    };
    const { subject, predicate, valueJson } = validateProposal(nextInput);
    assertNoSecretRisk({ subject, predicate, value: nextInput.value });

    const nextUpdatedAt = Math.max(Date.now(), expectedUpdatedAt + 1);
    const result = db.executeSync(
      `UPDATE memory_records
       SET subject = ?, predicate = ?, value_json = ?, expires_at = ?, confidence_milli = ?, updated_at = ?
       WHERE id = ? AND updated_at = ? AND status <> 'deleted'`,
      [
        subject,
        predicate,
        valueJson,
        nextInput.expiresAt ?? null,
        nextInput.confidenceMilli ?? 1000,
        nextUpdatedAt,
        id,
        expectedUpdatedAt,
      ],
    );
    if (result.rowsAffected !== 1) {
      throw new MemoryConcurrencyError(
        `Jarvis memory record ${id} was modified concurrently; reload before saving.`,
      );
    }

    const updatedRows = (db.executeSync(
      `SELECT ${COLUMNS} FROM memory_records WHERE id = ? LIMIT 1`,
      [id],
    ).rows ?? []) as unknown as DbRow[];
    if (!updatedRows[0]) throw new Error('Updated Jarvis memory record could not be loaded.');
    return mapRow(updatedRows[0]);
  }

  async updateRecord(
    id: string,
    patch: MemoryUpdatePatch,
    expectedUpdatedAt: number,
  ): Promise<MemoryRecord> {
    await jarvisMemoryDatabase.ensureReady();
    return this.updateRecordSync(id, patch, expectedUpdatedAt);
  }

  /**
   * Synchronous delete for callers that already initialized the shared DB.
   * Contains no await points and is safe inside a caller-owned SAVEPOINT.
   */
  deleteRecordSync(id: string, reason: MemoryDeletionReason = 'user_delete'): boolean {
    if (!MEMORY_DELETION_REASONS.includes(reason)) {
      throw new Error('Unsupported memory deletion reason.');
    }
    const db = jarvisMemoryDatabase.getDatabase();
    db.executeSync('SAVEPOINT jarvis_memory_delete');
    try {
      const existingRows = (db.executeSync(
        'SELECT source_excerpt_hash FROM memory_records WHERE id = ? LIMIT 1',
        [id],
      ).rows ?? []) as unknown as Array<{ source_excerpt_hash?: string | null }>;
      const provenanceHash = existingRows[0]?.source_excerpt_hash ?? null;
      const deleted = db.executeSync('DELETE FROM memory_records WHERE id = ?', [id]);
      if (deleted.rowsAffected === 1) {
        db.executeSync(
          `INSERT OR REPLACE INTO memory_deletion_tombstones (
            memory_id, deleted_at, reason, provenance_hash
          ) VALUES (?, ?, ?, ?)`,
          [id, Date.now(), reason, provenanceHash],
        );
      }
      db.executeSync('RELEASE SAVEPOINT jarvis_memory_delete');
      return deleted.rowsAffected === 1;
    } catch (error) {
      try {
        db.executeSync('ROLLBACK TO SAVEPOINT jarvis_memory_delete');
        db.executeSync('RELEASE SAVEPOINT jarvis_memory_delete');
      } catch {
        /* Keep primary delete failure intact if savepoint cleanup also fails. */
      }
      throw error;
    }
  }

  async deleteRecord(id: string, reason: MemoryDeletionReason = 'user_delete'): Promise<boolean> {
    await jarvisMemoryDatabase.ensureReady();
    return this.deleteRecordSync(id, reason);
  }

  async listTombstones(limit = 100): Promise<MemoryDeletionTombstone[]> {
    await jarvisMemoryDatabase.ensureReady();
    const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
    const rows = (jarvisMemoryDatabase.getDatabase().executeSync(
      `SELECT memory_id, deleted_at, reason, provenance_hash
       FROM memory_deletion_tombstones
       ORDER BY deleted_at DESC
       LIMIT ?`,
      [safeLimit],
    ).rows ?? []) as unknown as Array<{
      memory_id: string;
      deleted_at: number;
      reason: MemoryDeletionReason;
      provenance_hash: string | null;
    }>;
    return rows.map(row => ({
      memoryId: row.memory_id,
      deletedAt: Number(row.deleted_at),
      reason: row.reason,
      provenanceHash: row.provenance_hash,
    }));
  }

  /** Marks expired proposed/confirmed records inactive and clears approval timestamp per CHECK. */
  async expireStale(now = Date.now()): Promise<number> {
    await jarvisMemoryDatabase.ensureReady();
    const result = jarvisMemoryDatabase.getDatabase().executeSync(
      `UPDATE memory_records
       SET status = 'expired', user_approved_at = NULL, updated_at = ?
       WHERE expires_at IS NOT NULL AND expires_at <= ? AND status IN ('proposed', 'confirmed')`,
      [now, now],
    );
    return result.rowsAffected ?? 0;
  }
}

export const jarvisMemoryRepository = new JarvisMemoryRepository();
