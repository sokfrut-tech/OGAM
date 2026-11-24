import { Buffer } from 'buffer';
import { generateId } from '../../utils/generateId';
import { jarvisMemoryDatabase } from './database';
import { jarvisMemoryRepository } from './repository';
import { assessSecretRisk, assertNoSecretRisk } from './secretGuard';
import {
  MEMORY_KINDS,
  MEMORY_SCOPES,
  type MemoryDeletionReason,
  type MemoryExportBundle,
  type MemoryExportOptions,
  type MemoryExportRecord,
  type MemoryRecord,
  type MemoryScope,
  type MemorySearchFilters,
  type MemorySettingsState,
  type MemorySourceDeletionAction,
  type MemorySourceDeletionResult,
  type MemoryStatus,
  type MemorySyncPolicy,
  type MemoryUndoCheckpoint,
  type MemoryUndoOperation,
  type MemoryUndoResult,
  type MemoryUpdatePatch,
} from './types';

const MAX_ACTIVE_UNDO_CHECKPOINTS = 25;

export const UNENCRYPTED_EXPORT_WARNING =
  'Экспорт выполнен в незашифрованном JSON. Не загружайте этот файл в публичные облака и чаты. / Unencrypted JSON export — keep local.';

/** Error raised when persistent Jarvis memory is paused by the user (MEM-026 fail-closed). */
export class MemoryDisabledError extends Error {
  constructor(
    message = 'Долговременная память Jarvis отключена пользователем (fail-closed). Включите память, чтобы сохранять записи.',
  ) {
    super(message);
    this.name = 'MemoryDisabledError';
  }
}

type DbHandle = ReturnType<typeof jarvisMemoryDatabase.getDatabase>;

type SettingsRow = {
  enabled: number;
  updated_at: number;
};

type UndoRow = {
  id: string;
  operation: MemoryUndoOperation;
  memory_id: string;
  snapshot_json: string;
  created_at: number;
  consumed_at: number | null;
};

type RawExportRow = {
  id: string;
  kind: MemoryRecord['kind'];
  subject: string;
  predicate: string;
  value_json: string;
  scope: MemoryScope;
  scope_id: string | null;
  source_conversation_id: string | null;
  source_message_id: string | null;
  source_excerpt_hash: string | null;
  created_at: number;
  updated_at: number;
  expires_at: number | null;
  confidence_milli: number;
  status: MemoryStatus;
  user_approved_at: number | null;
  sync_policy: MemorySyncPolicy;
  schema_version: number;
};

function serializeValueForSearch(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
}

function mapRawRow(row: RawExportRow): MemoryRecord {
  let parsedValue: unknown = null;
  try {
    parsedValue = JSON.parse(row.value_json);
  } catch {
    throw new Error(`Jarvis memory record ${row.id} contains invalid JSON.`);
  }
  return {
    id: row.id,
    kind: row.kind,
    subject: row.subject,
    predicate: row.predicate,
    value: parsedValue,
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

function toExportRecord(record: MemoryRecord): MemoryExportRecord {
  return {
    id: record.id,
    kind: record.kind,
    subject: record.subject,
    predicate: record.predicate,
    value: record.value,
    scope: record.scope,
    scopeId: record.scopeId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    expiresAt: record.expiresAt,
    confidenceMilli: record.confidenceMilli,
    status: record.status,
    userApprovedAt: record.userApprovedAt,
    syncPolicy: record.syncPolicy,
    provenance: {
      sourceConversationId: record.sourceConversationId,
      sourceMessageId: record.sourceMessageId,
    },
  };
}

function mapUndoRow(row: UndoRow): MemoryUndoCheckpoint {
  let snapshot: MemoryRecord;
  try {
    snapshot = JSON.parse(row.snapshot_json) as MemoryRecord;
  } catch {
    throw new Error(`Jarvis undo checkpoint ${row.id} contains invalid JSON snapshot.`);
  }
  return {
    id: row.id,
    operation: row.operation,
    memoryId: row.memory_id,
    snapshot,
    createdAt: Number(row.created_at),
    consumedAt: row.consumed_at == null ? null : Number(row.consumed_at),
  };
}

/** Coordinates M3 management: fail-closed disable switch, scoped search, undo checkpoints, source deletion, and portable JSON export. */
export class JarvisMemoryManagementService {
  private initializedDb: DbHandle | null = null;

  private async ensureManagementTables(): Promise<DbHandle> {
    await jarvisMemoryDatabase.ensureReady();
    const db = jarvisMemoryDatabase.getDatabase();
    if (this.initializedDb !== db) {
      db.executeSync(`CREATE TABLE IF NOT EXISTS memory_settings (
        singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
        enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)) DEFAULT 1,
        updated_at INTEGER NOT NULL
      )`);
      db.executeSync(`CREATE TABLE IF NOT EXISTS memory_undo_checkpoints (
        id TEXT PRIMARY KEY NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('update', 'delete')),
        memory_id TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        consumed_at INTEGER
      )`);
      db.executeSync(`CREATE INDEX IF NOT EXISTS idx_memory_undo_active
        ON memory_undo_checkpoints(consumed_at, created_at DESC)`);
      this.initializedDb = db;
    }
    return db;
  }

  async getMemoryState(): Promise<MemorySettingsState> {
    const db = await this.ensureManagementTables();
    const rows = (db.executeSync(
      'SELECT enabled, updated_at FROM memory_settings WHERE singleton_id = 1',
    ).rows ?? []) as unknown as SettingsRow[];
    if (!rows[0]) {
      return { enabled: true, updatedAt: null };
    }
    return {
      enabled: Number(rows[0].enabled) === 1,
      updatedAt: Number(rows[0].updated_at),
    };
  }

  async isMemoryEnabled(): Promise<boolean> {
    const state = await this.getMemoryState();
    return state.enabled;
  }

  /** Persists global fail-closed enable/disable switch without deleting stored records (MEM-026). */
  async setMemoryEnabled(enabled: boolean): Promise<MemorySettingsState> {
    const db = await this.ensureManagementTables();
    const updatedAt = Date.now();
    db.executeSync(
      `INSERT INTO memory_settings (singleton_id, enabled, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(singleton_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`,
      [enabled ? 1 : 0, updatedAt],
    );
    return { enabled, updatedAt };
  }

  async assertMemoryEnabled(): Promise<void> {
    const enabled = await this.isMemoryEnabled();
    if (!enabled) {
      throw new MemoryDisabledError();
    }
  }

  /** Searches records inside a single explicit scope with kind, status, expiry, and substring filters (MEM-025). */
  async searchRecords(filters: MemorySearchFilters): Promise<MemoryRecord[]> {
    if (filters.kind !== undefined && !MEMORY_KINDS.includes(filters.kind)) {
      throw new Error('Unsupported memory kind filter.');
    }

    const scopedRecords = await jarvisMemoryRepository.list({
      scope: filters.scope,
      scopeId: filters.scopeId,
      status: filters.status,
      excludeExpired: filters.excludeExpired,
      now: filters.now,
    });

    const normalizedQuery = filters.query?.trim().toLocaleLowerCase() ?? '';
    const limit = Math.max(1, Math.min(500, Math.floor(filters.limit ?? 100)));

    const filtered = scopedRecords.filter(record => {
      if (filters.kind && record.kind !== filters.kind) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const haystack = [
        record.subject,
        record.predicate,
        serializeValueForSearch(record.value),
      ]
        .join('\n')
        .toLocaleLowerCase();
      return haystack.includes(normalizedQuery);
    });

    return filtered.slice(0, limit);
  }

  private saveCheckpoint(db: DbHandle, operation: MemoryUndoOperation, snapshot: MemoryRecord): MemoryUndoCheckpoint {
    const id = generateId();
    const createdAt = Date.now();
    const snapshotJson = JSON.stringify(snapshot);
    db.executeSync(
      `INSERT INTO memory_undo_checkpoints (id, operation, memory_id, snapshot_json, created_at, consumed_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      [id, operation, snapshot.id, snapshotJson, createdAt],
    );
    db.executeSync(
      `DELETE FROM memory_undo_checkpoints
       WHERE id NOT IN (
         SELECT id FROM memory_undo_checkpoints
         WHERE consumed_at IS NULL
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?
       ) AND consumed_at IS NULL`,
      [MAX_ACTIVE_UNDO_CHECKPOINTS],
    );
    return {
      id,
      operation,
      memoryId: snapshot.id,
      snapshot,
      createdAt,
      consumedAt: null,
    };
  }

  /** Captures a pre-edit local snapshot before delegating to repository.updateRecord (MEM-011 + PocketMind undo). */
  async updateWithCheckpoint(
    id: string,
    patch: MemoryUpdatePatch,
    expectedUpdatedAt: number,
  ): Promise<{ record: MemoryRecord; checkpoint: MemoryUndoCheckpoint }> {
    const db = await this.ensureManagementTables();
    const existing = await jarvisMemoryRepository.getById(id);
    if (!existing || existing.status === 'deleted') {
      throw new Error(`Jarvis memory record ${id} was not found.`);
    }

    db.executeSync('SAVEPOINT jarvis_memory_update_checkpoint');
    try {
      const checkpoint = this.saveCheckpoint(db, 'update', existing);
      const updated = await jarvisMemoryRepository.updateRecord(id, patch, expectedUpdatedAt);
      db.executeSync('RELEASE SAVEPOINT jarvis_memory_update_checkpoint');
      return { record: updated, checkpoint };
    } catch (error) {
      try {
        db.executeSync('ROLLBACK TO SAVEPOINT jarvis_memory_update_checkpoint');
        db.executeSync('RELEASE SAVEPOINT jarvis_memory_update_checkpoint');
      } catch {
        /* Preserve the primary update/checkpoint failure. */
      }
      throw error;
    }
  }

  /** Captures a pre-delete local snapshot before delegating to repository.deleteRecord (MEM-006 + PocketMind undo). */
  async deleteWithCheckpoint(
    id: string,
    reason: MemoryDeletionReason = 'user_delete',
  ): Promise<{ deleted: boolean; checkpoint: MemoryUndoCheckpoint | null }> {
    const db = await this.ensureManagementTables();
    const existing = await jarvisMemoryRepository.getById(id);
    if (!existing) {
      return { deleted: false, checkpoint: null };
    }

    db.executeSync('SAVEPOINT jarvis_memory_delete_checkpoint');
    try {
      const checkpoint = this.saveCheckpoint(db, 'delete', existing);
      const deleted = await jarvisMemoryRepository.deleteRecord(id, reason);
      if (!deleted) {
        db.executeSync('ROLLBACK TO SAVEPOINT jarvis_memory_delete_checkpoint');
        db.executeSync('RELEASE SAVEPOINT jarvis_memory_delete_checkpoint');
        return { deleted: false, checkpoint: null };
      }
      db.executeSync('RELEASE SAVEPOINT jarvis_memory_delete_checkpoint');
      return { deleted: true, checkpoint };
    } catch (error) {
      try {
        db.executeSync('ROLLBACK TO SAVEPOINT jarvis_memory_delete_checkpoint');
        db.executeSync('RELEASE SAVEPOINT jarvis_memory_delete_checkpoint');
      } catch {
        /* Preserve the primary delete/checkpoint failure. */
      }
      throw error;
    }
  }

  async getLatestUndoCheckpoint(): Promise<MemoryUndoCheckpoint | null> {
    const db = await this.ensureManagementTables();
    const rows = (db.executeSync(
      `SELECT id, operation, memory_id, snapshot_json, created_at, consumed_at
       FROM memory_undo_checkpoints
       WHERE consumed_at IS NULL
       ORDER BY created_at DESC, rowid DESC
       LIMIT 1`,
    ).rows ?? []) as unknown as UndoRow[];
    return rows[0] ? mapUndoRow(rows[0]) : null;
  }

  /** Atomically restores the latest local pre-operation snapshot, clearing any deletion tombstone on delete undo. */
  async undoLastChange(): Promise<MemoryUndoResult> {
    const db = await this.ensureManagementTables();
    db.executeSync('SAVEPOINT jarvis_memory_undo');

    try {
      const rows = (db.executeSync(
        `SELECT id, operation, memory_id, snapshot_json, created_at, consumed_at
         FROM memory_undo_checkpoints
         WHERE consumed_at IS NULL
         ORDER BY created_at DESC, rowid DESC
         LIMIT 1`,
      ).rows ?? []) as unknown as UndoRow[];

      if (!rows[0]) {
        db.executeSync('RELEASE SAVEPOINT jarvis_memory_undo');
        return {
          undone: false,
          operation: null,
          restoredRecord: null,
          checkpointId: null,
        };
      }

      const checkpoint = mapUndoRow(rows[0]);
      const snapshot = checkpoint.snapshot;
      assertNoSecretRisk({
        subject: snapshot.subject,
        predicate: snapshot.predicate,
        value: snapshot.value,
      });

      const snapshotValueJson = JSON.stringify(snapshot.value);
      if (snapshotValueJson === undefined || Buffer.byteLength(snapshotValueJson, 'utf8') > 16 * 1024) {
        throw new Error('Undo snapshot value exceeds constraints.');
      }

      if (checkpoint.operation === 'update') {
        const currentRows = (db.executeSync(
          "SELECT updated_at FROM memory_records WHERE id = ? AND status <> 'deleted' LIMIT 1",
          [snapshot.id],
        ).rows ?? []) as unknown as Array<{ updated_at?: number }>;

        if (!currentRows[0]) {
          throw new Error(`Cannot undo update: Jarvis memory record ${snapshot.id} no longer exists.`);
        }

        const currentUpdatedAt = Number(currentRows[0].updated_at ?? snapshot.updatedAt);
        const nextUpdatedAt = Math.max(Date.now(), currentUpdatedAt + 1);
        db.executeSync(
          `UPDATE memory_records
           SET subject = ?, predicate = ?, value_json = ?, expires_at = ?, confidence_milli = ?, updated_at = ?
           WHERE id = ? AND status <> 'deleted'`,
          [
            snapshot.subject,
            snapshot.predicate,
            snapshotValueJson,
            snapshot.expiresAt ?? null,
            snapshot.confidenceMilli,
            nextUpdatedAt,
            snapshot.id,
          ],
        );
      } else {
        const collisionRows = (db.executeSync(
          'SELECT id FROM memory_records WHERE id = ? LIMIT 1',
          [snapshot.id],
        ).rows ?? []) as unknown as Array<{ id?: string }>;
        if (collisionRows[0]) {
          throw new Error(`Cannot undo delete: record ${snapshot.id} already exists.`);
        }

        const nextUpdatedAt = Math.max(Date.now(), snapshot.updatedAt + 1);
        const restoredApprovedAt =
          snapshot.status === 'confirmed'
            ? snapshot.userApprovedAt ?? snapshot.updatedAt
            : null;

        db.executeSync(
          `INSERT INTO memory_records (
            id, kind, subject, predicate, value_json, scope, scope_id,
            source_conversation_id, source_message_id, source_excerpt_hash,
            created_at, updated_at, expires_at, confidence_milli, status,
            user_approved_at, sync_policy, schema_version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            snapshot.id,
            snapshot.kind,
            snapshot.subject,
            snapshot.predicate,
            snapshotValueJson,
            snapshot.scope,
            snapshot.scopeId ?? null,
            snapshot.sourceConversationId ?? null,
            snapshot.sourceMessageId ?? null,
            snapshot.sourceExcerptHash ?? null,
            snapshot.createdAt,
            nextUpdatedAt,
            snapshot.expiresAt ?? null,
            snapshot.confidenceMilli,
            snapshot.status,
            restoredApprovedAt,
            snapshot.syncPolicy,
            snapshot.schemaVersion ?? 1,
          ],
        );
        db.executeSync('DELETE FROM memory_deletion_tombstones WHERE memory_id = ?', [snapshot.id]);
      }

      db.executeSync('UPDATE memory_undo_checkpoints SET consumed_at = ? WHERE id = ?', [
        Date.now(),
        checkpoint.id,
      ]);

      db.executeSync('RELEASE SAVEPOINT jarvis_memory_undo');
      const restoredRecord = await jarvisMemoryRepository.getById(snapshot.id);
      return {
        undone: true,
        operation: checkpoint.operation,
        restoredRecord: restoredRecord ?? null,
        checkpointId: checkpoint.id,
      };
    } catch (error) {
      try {
        db.executeSync('ROLLBACK TO SAVEPOINT jarvis_memory_undo');
        db.executeSync('RELEASE SAVEPOINT jarvis_memory_undo');
      } catch {
        /* Preserve primary undo error */
      }
      throw error;
    }
  }

  async clearUndoCheckpoints(): Promise<number> {
    const db = await this.ensureManagementTables();
    const res = db.executeSync('DELETE FROM memory_undo_checkpoints');
    return res.rowsAffected ?? 0;
  }

  /** Explicitly resolves memory linked to a deleted source conversation without silent orphaning (MEM-019). */
  async handleSourceConversationDeleted(
    conversationId: string,
    action: MemorySourceDeletionAction,
  ): Promise<MemorySourceDeletionResult> {
    const trimmedConversationId = conversationId.trim();
    if (!trimmedConversationId) {
      throw new Error('Conversation id is required for source deletion handling.');
    }
    if (action !== 'delete_linked' && action !== 'keep_memory') {
      throw new Error('Unsupported source deletion action.');
    }

    const db = await this.ensureManagementTables();
    const matchingRows = (db.executeSync(
      `SELECT id FROM memory_records
       WHERE status <> 'deleted'
         AND (source_conversation_id = ? OR (scope = 'conversation' AND scope_id = ?))`,
      [trimmedConversationId, trimmedConversationId],
    ).rows ?? []) as unknown as Array<{ id: string }>;

    const ids = matchingRows.map(row => row.id);
    if (ids.length === 0) {
      return {
        action,
        conversationId: trimmedConversationId,
        affectedCount: 0,
        deletedIds: [],
        detachedIds: [],
      };
    }

    if (action === 'delete_linked') {
      const deletedIds: string[] = [];
      for (const memoryId of ids) {
        const deleted = await jarvisMemoryRepository.deleteRecord(memoryId, 'source_deleted');
        if (deleted) deletedIds.push(memoryId);
      }
      return {
        action,
        conversationId: trimmedConversationId,
        affectedCount: deletedIds.length,
        deletedIds,
        detachedIds: [],
      };
    }

    const now = Date.now();
    db.executeSync(
      `UPDATE memory_records
       SET source_conversation_id = NULL,
           source_message_id = NULL,
           updated_at = CASE WHEN updated_at >= ? THEN updated_at + 1 ELSE ? END
       WHERE status <> 'deleted'
         AND (source_conversation_id = ? OR (scope = 'conversation' AND scope_id = ?))`,
      [now, now, trimmedConversationId, trimmedConversationId],
    );

    return {
      action,
      conversationId: trimmedConversationId,
      affectedCount: ids.length,
      deletedIds: [],
      detachedIds: ids,
    };
  }

  /** Creates a portable versioned unencrypted JSON export only on explicit user action, re-screening for secrets (MEM-020). */
  async exportPortableJson(options: MemoryExportOptions): Promise<MemoryExportBundle> {
    if (!options || options.userInitiated !== true) {
      throw new Error('Portable memory export requires explicit user initiation.');
    }

    const db = await this.ensureManagementTables();
    const now = options.now ?? Date.now();
    const allowedStatuses: MemoryStatus[] = options.includePending
      ? ['confirmed', 'proposed']
      : ['confirmed'];

    let candidates: MemoryRecord[];
    let scopeSummary: MemoryExportBundle['scopeSummary'];

    if (options.includeAllScopes) {
      const statusPlaceholders = allowedStatuses.map(() => '?').join(', ');
      const rows = (db.executeSync(
        `SELECT id, kind, subject, predicate, value_json, scope, scope_id,
                source_conversation_id, source_message_id, source_excerpt_hash,
                created_at, updated_at, expires_at, confidence_milli, status,
                user_approved_at, sync_policy, schema_version
         FROM memory_records
         WHERE status IN (${statusPlaceholders})
           AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY scope ASC, updated_at DESC, id ASC`,
        [...allowedStatuses, now],
      ).rows ?? []) as unknown as RawExportRow[];
      candidates = rows.map(mapRawRow);
      scopeSummary = { mode: 'all_scopes' };
    } else {
      if (!options.scope || !MEMORY_SCOPES.includes(options.scope)) {
        throw new Error('Export requires either includeAllScopes or a valid target scope.');
      }
      const listByStatus = await Promise.all(
        allowedStatuses.map(status =>
          jarvisMemoryRepository.list({
            scope: options.scope!,
            scopeId: options.scopeId,
            status,
            excludeExpired: true,
            now,
          }),
        ),
      );
      candidates = listByStatus.flat().sort((a, b) => {
        if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
        return a.id.localeCompare(b.id);
      });
      scopeSummary = {
        mode: 'single_scope',
        scope: options.scope,
        scopeId: options.scope === 'global' ? null : options.scopeId?.trim() ?? null,
      };
    }

    const records: MemoryExportRecord[] = [];
    let redactedSecretCount = 0;

    for (const candidate of candidates) {
      const risk = assessSecretRisk({
        subject: candidate.subject,
        predicate: candidate.predicate,
        value: candidate.value,
      });
      if (risk.blocked) {
        redactedSecretCount += 1;
        continue;
      }
      records.push(toExportRecord(candidate));
    }

    return {
      format: 'jarvis.memory.export.v1',
      schemaVersion: 1,
      exportedAt: Date.now(),
      encrypted: false,
      securityWarning: UNENCRYPTED_EXPORT_WARNING,
      scopeSummary,
      recordCount: records.length,
      redactedSecretCount,
      records,
    };
  }
}

export const jarvisMemoryManagementService = new JarvisMemoryManagementService();
