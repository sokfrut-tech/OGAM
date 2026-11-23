import { Buffer } from 'buffer';
import { generateId } from '../../utils/generateId';
import { jarvisMemoryDatabase } from './database';
import { MEMORY_KINDS, MEMORY_SCOPES, type MemoryRecord, type NewMemoryProposal } from './types';

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

    const created = this.getById(id);
    if (!created) throw new Error('Jarvis memory proposal was not persisted.');
    return created;
  }

  /** Call only from an explicit user-confirmation action; model output must never call this. */
  async confirmProposal(id: string, userApprovedAt = Date.now()): Promise<boolean> {
    await jarvisMemoryDatabase.ensureReady();
    const result = jarvisMemoryDatabase.getDatabase().executeSync(
      `UPDATE memory_records
       SET status = 'confirmed', user_approved_at = ?, updated_at = ?
       WHERE id = ? AND status = 'proposed'`,
      [userApprovedAt, Date.now(), id],
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

  async list(filters: {
    status?: MemoryRecord['status'];
    scope?: MemoryRecord['scope'];
    scopeId?: string | null;
  } = {}): Promise<MemoryRecord[]> {
    await jarvisMemoryDatabase.ensureReady();
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.status) {
      where.push('status = ?');
      params.push(filters.status);
    }
    if (filters.scope) {
      where.push('scope = ?');
      params.push(filters.scope);
      if (filters.scope === 'global') {
        where.push('scope_id IS NULL');
      } else {
        where.push('scope_id = ?');
        params.push(filters.scopeId ?? null);
      }
    }
    const rows = (jarvisMemoryDatabase.getDatabase().executeSync(
      `SELECT ${COLUMNS} FROM memory_records
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY created_at DESC`,
      params as never[],
    ).rows ?? []) as unknown as DbRow[];
    return rows.map(mapRow);
  }
}

export const jarvisMemoryRepository = new JarvisMemoryRepository();
