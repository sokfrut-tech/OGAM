import 'react-native-get-random-values';
import { Buffer } from 'buffer';
(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MemoryProposalCard } from './src/components/jarvisMemory/MemoryProposalCard';
import {
  formatKindLabel,
  formatScopeLabel,
  formatValuePreview,
  jarvisMemoryConfirmationController,
} from './src/services/jarvisMemory/confirmationController';
import { jarvisMemoryDatabase } from './src/services/jarvisMemory/database';
import {
  jarvisMemoryRepository,
  MemoryConcurrencyError,
} from './src/services/jarvisMemory/repository';
import { SecretMemoryBlockedError } from './src/services/jarvisMemory/secretGuard';
import type {
  MemoryConflict,
  MemoryKind,
  MemoryRecord,
  MemoryScope,
} from './src/services/jarvisMemory/types';

type ProbeReport = {
  sqliteVersion: string;
  schemaVersion: number;
  json1: boolean;
  foreignKeys: boolean;
  proposalRoundTrip: boolean;
  explicitConfirmation: boolean;
  rejection: boolean;
  savepointRollback: boolean;
  checkConstraint: boolean;
  secretGuardBlocked: boolean;
  conflictDetected: boolean;
  optimisticConcurrency: boolean;
  deleteWithTombstone: boolean;
  expiryBoundary: boolean;
  databasePath: string;
};

type PendingDraft = {
  proposal: MemoryRecord;
  conflicts: MemoryConflict[];
};

function requireTrue(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function runNativeProbe(): Promise<ProbeReport> {
  await jarvisMemoryDatabase.ensureReady();
  const db = jarvisMemoryDatabase.getDatabase();
  const createdIds: string[] = [];

  try {
    const versionRow = db.executeSync('SELECT sqlite_version() AS version').rows?.[0] as
      | { version?: string }
      | undefined;
    requireTrue(versionRow?.version, 'SQLite did not return its version.');

    const schemaRow = db.executeSync(
      'SELECT schema_version FROM memory_schema_meta WHERE singleton_id = 1',
    ).rows?.[0] as { schema_version?: number } | undefined;
    requireTrue(schemaRow?.schema_version === 1, 'Jarvis memory schema version is not 1.');

    let json1 = false;
    try {
      const row = db.executeSync("SELECT json_valid('{}') AS valid").rows?.[0] as
        | { valid?: number }
        | undefined;
      json1 = Number(row?.valid) === 1;
    } catch {
      json1 = false;
    }

    db.executeSync('PRAGMA foreign_keys = ON');
    const foreignKeyRow = db.executeSync('PRAGMA foreign_keys').rows?.[0] as
      | { foreign_keys?: number }
      | undefined;
    const foreignKeys = Number(foreignKeyRow?.foreign_keys) === 1;
    requireTrue(foreignKeys, 'SQLite could not enable foreign-key enforcement.');

    // M2 Secret Guard check (MEM-014)
    let secretGuardBlocked = false;
    try {
      await jarvisMemoryConfirmationController.propose({
        kind: 'fact',
        subject: 'SelfTest Secret',
        predicate: 'api_key',
        value: 'ghp_1234567890abcdefghij1234567890abcdef',
        scope: 'conversation',
        scopeId: 'm2-selftest-scope',
      });
    } catch (err) {
      secretGuardBlocked = err instanceof SecretMemoryBlockedError;
    }
    requireTrue(secretGuardBlocked, 'SecretMemoryBlockedError did not block token payload.');

    // M1 Create + Read + Confirm + Scoped list
    const baseDraft = await jarvisMemoryConfirmationController.propose({
      kind: 'fact',
      subject: 'SelfTest Target Device',
      predicate: 'selftest_runtime',
      value: { os: 'ColorOS 16', probe: 'M2' },
      scope: 'conversation',
      scopeId: 'm2-selftest-scope',
      sourceExcerptHash: 'm2-selftest-hash',
    });
    createdIds.push(baseDraft.proposal.id);

    const readBack = await jarvisMemoryRepository.getById(baseDraft.proposal.id);
    requireTrue(
      readBack?.id === baseDraft.proposal.id &&
        (readBack.value as { probe?: string }).probe === 'M2',
      'M2 self-test JSON round-trip failed.',
    );

    const confirmed = await jarvisMemoryConfirmationController.confirm(baseDraft.proposal.id, {
      userAction: 'explicit_confirm',
    });
    requireTrue(confirmed, 'Explicit confirmation failed.');

    // M2 Conflict Detection (MEM-010)
    const conflictDraft = await jarvisMemoryConfirmationController.propose({
      kind: 'fact',
      subject: 'SelfTest Target Device',
      predicate: 'selftest_runtime',
      value: { os: 'Android 16', probe: 'M2' },
      scope: 'conversation',
      scopeId: 'm2-selftest-scope',
    });
    createdIds.push(conflictDraft.proposal.id);
    const conflictDetected =
      conflictDraft.conflicts.length === 1 &&
      conflictDraft.conflicts[0]?.reason === 'same_subject_predicate_different_value';
    requireTrue(conflictDetected, 'M2 conflict detector missed conflicting confirmed value.');

    const rejected = await jarvisMemoryConfirmationController.reject(conflictDraft.proposal.id);
    requireTrue(rejected, 'Proposal rejection failed.');

    // M2 Optimistic Concurrency Update (MEM-011)
    const beforeUpdate = await jarvisMemoryRepository.getById(baseDraft.proposal.id);
    requireTrue(beforeUpdate, 'Confirmed self-test record missing before update.');
    const updated = await jarvisMemoryConfirmationController.updateConfirmed(
      baseDraft.proposal.id,
      { value: { os: 'ColorOS 16.0.5', probe: 'M2' } },
      beforeUpdate.updatedAt,
    );
    let concurrencyRejected = false;
    try {
      await jarvisMemoryConfirmationController.updateConfirmed(
        baseDraft.proposal.id,
        { value: { os: 'Stale' } },
        beforeUpdate.updatedAt,
      );
    } catch (err) {
      concurrencyRejected = err instanceof MemoryConcurrencyError;
    }
    const optimisticConcurrency = updated.updatedAt > beforeUpdate.updatedAt && concurrencyRejected;
    requireTrue(optimisticConcurrency, 'Optimistic concurrency update guard failed.');

    // M2 Expiry Boundary (MEM-005)
    const expFuture = Date.now() + 60_000;
    const expDraft = await jarvisMemoryConfirmationController.propose({
      kind: 'reminder',
      subject: 'SelfTest Expiry',
      predicate: 'selftest_expiry',
      value: 'expiring',
      scope: 'conversation',
      scopeId: 'm2-selftest-scope',
      expiresAt: expFuture,
    });
    createdIds.push(expDraft.proposal.id);
    requireTrue(
      await jarvisMemoryConfirmationController.confirm(expDraft.proposal.id, {
        userAction: 'explicit_confirm',
      }),
      'Expiring proposal confirmation failed.',
    );
    const afterExpiry = await jarvisMemoryRepository.listActiveConfirmed({
      scope: 'conversation',
      scopeId: 'm2-selftest-scope',
      now: expFuture + 1,
    });
    requireTrue(
      !afterExpiry.some(item => item.id === expDraft.proposal.id),
      'Expired record remained in listActiveConfirmed.',
    );
    const expiredCount = await jarvisMemoryConfirmationController.expireStale(expFuture + 1);
    const expiredRow = await jarvisMemoryRepository.getById(expDraft.proposal.id);
    const expiryBoundary =
      expiredCount >= 1 && expiredRow?.status === 'expired' && expiredRow.userApprovedAt === null;
    requireTrue(expiryBoundary, 'expireStale did not transition record with NULL userApprovedAt.');

    // M2 Delete + Tombstone (MEM-006)
    const deleted = await jarvisMemoryConfirmationController.remove(
      baseDraft.proposal.id,
      'user_delete',
    );
    const afterDelete = await jarvisMemoryRepository.getById(baseDraft.proposal.id);
    const tombstones = await jarvisMemoryRepository.listTombstones(100);
    const deleteWithTombstone =
      deleted &&
      afterDelete === undefined &&
      tombstones.some(
        item =>
          item.memoryId === baseDraft.proposal.id &&
          item.reason === 'user_delete' &&
          item.provenanceHash === 'm2-selftest-hash',
      );
    requireTrue(deleteWithTombstone, 'Delete did not create value-free tombstone.');

    // M1 Savepoint Rollback & CHECK constraint
    const tempName = 'jarvis_m2_native_rollback_probe';
    db.executeSync('SAVEPOINT jarvis_m2_native_rollback');
    db.executeSync('CREATE TEMP TABLE ' + tempName + ' (id INTEGER NOT NULL)');
    db.executeSync('INSERT INTO ' + tempName + ' (id) VALUES (1)');
    db.executeSync('ROLLBACK TO SAVEPOINT jarvis_m2_native_rollback');
    db.executeSync('RELEASE SAVEPOINT jarvis_m2_native_rollback');
    const tempRow = db.executeSync(
      "SELECT COUNT(*) AS count FROM sqlite_temp_master WHERE name = '" + tempName + "'",
    ).rows?.[0] as { count?: number } | undefined;
    const savepointRollback = Number(tempRow?.count) === 0;
    requireTrue(savepointRollback, 'Savepoint rollback left temp table.');

    let checkConstraint = false;
    try {
      db.executeSync(
        "INSERT INTO memory_records (id, kind, subject, predicate, value_json, scope, created_at, updated_at, confidence_milli, status, sync_policy, schema_version) VALUES ('m2-invalid-kind-probe', 'not-a-kind', 'x', 'x', '{}', 'global', 1, 1, 1000, 'proposed', 'local_only', 1)",
      );
    } catch {
      checkConstraint = true;
    }
    requireTrue(checkConstraint, 'CHECK constraint did not reject invalid kind.');

    return {
      sqliteVersion: versionRow.version,
      schemaVersion: Number(schemaRow.schema_version),
      json1,
      foreignKeys,
      proposalRoundTrip: true,
      explicitConfirmation: true,
      rejection: true,
      savepointRollback,
      checkConstraint,
      secretGuardBlocked,
      conflictDetected,
      optimisticConcurrency,
      deleteWithTombstone,
      expiryBoundary,
      databasePath: db.getDbPath(),
    };
  } finally {
    for (const id of createdIds) {
      try {
        db.executeSync('DELETE FROM memory_records WHERE id = ?', [id]);
        db.executeSync('DELETE FROM memory_deletion_tombstones WHERE memory_id = ?', [id]);
      } catch {
        /* best-effort self-test cleanup */
      }
    }
  }
}

export default function App() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ProbeReport | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  // Interactive M2 sandbox state
  const [scopeMode, setScopeMode] = useState<MemoryScope>('global');
  const [kind, setKind] = useState<MemoryKind>('fact');
  const [subject, setSubject] = useState('OPPO Find X6 Pro');
  const [predicate, setPredicate] = useState('device_os');
  const [valueText, setValueText] = useState('ColorOS 16 · Android 16');
  const [sandboxBusy, setSandboxBusy] = useState(false);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [pendingDrafts, setPendingDrafts] = useState<PendingDraft[]>([]);
  const [confirmedRecords, setConfirmedRecords] = useState<MemoryRecord[]>([]);
  const [tombstoneCount, setTombstoneCount] = useState(0);

  const activeScopeId = scopeMode === 'project' ? 'jarvis-demo' : undefined;

  const refreshSandbox = useCallback(async () => {
    const snapshot = await jarvisMemoryConfirmationController.loadScopeSnapshot(
      scopeMode,
      activeScopeId,
    );
    const enrichedPending = await Promise.all(
      snapshot.pending.map(async item => ({
        proposal: item,
        conflicts: await jarvisMemoryRepository.findConflicts({
          scope: item.scope,
          scopeId: item.scopeId,
          subject: item.subject,
          predicate: item.predicate,
          value: item.value,
          excludeId: item.id,
        }),
      })),
    );
    setPendingDrafts(enrichedPending);
    setConfirmedRecords(snapshot.confirmed);
    setTombstoneCount(snapshot.tombstoneCount);
  }, [scopeMode, activeScopeId]);

  const runProbe = useCallback(async () => {
    setBusy(true);
    setReport(null);
    setProbeError(null);
    try {
      const nextReport = await runNativeProbe();
      setReport(nextReport);
      console.log('[JARVIS_M2_PROBE] PASS ' + JSON.stringify(nextReport));
      await refreshSandbox();
    } catch (cause) {
      const message = cause instanceof Error ? cause.stack || cause.message : String(cause);
      setProbeError(message);
      console.error('[JARVIS_M2_PROBE] FAIL ' + message);
    } finally {
      setBusy(false);
    }
  }, [refreshSandbox]);

  useEffect(() => {
    void runProbe();
  }, [runProbe]);

  useEffect(() => {
    void refreshSandbox().catch(() => undefined);
  }, [refreshSandbox]);

  const handlePropose = async () => {
    setSandboxBusy(true);
    setSandboxError(null);
    try {
      await jarvisMemoryConfirmationController.propose({
        kind,
        subject,
        predicate,
        value: valueText,
        scope: scopeMode,
        scopeId: activeScopeId ?? null,
      });
      await refreshSandbox();
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      setSandboxError(msg);
    } finally {
      setSandboxBusy(false);
    }
  };

  const handleConfirm = async (id: string) => {
    setSandboxBusy(true);
    setSandboxError(null);
    try {
      await jarvisMemoryConfirmationController.confirm(id, { userAction: 'explicit_confirm' });
      await refreshSandbox();
    } catch (cause) {
      setSandboxError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSandboxBusy(false);
    }
  };

  const handleReject = async (id: string) => {
    setSandboxBusy(true);
    setSandboxError(null);
    try {
      await jarvisMemoryConfirmationController.reject(id);
      await refreshSandbox();
    } catch (cause) {
      setSandboxError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSandboxBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSandboxBusy(true);
    setSandboxError(null);
    try {
      await jarvisMemoryConfirmationController.remove(id, 'user_delete');
      await refreshSandbox();
    } catch (cause) {
      setSandboxError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSandboxBusy(false);
    }
  };

  const checks: Array<[string, boolean]> = report
    ? [
        ['Схема v1 и нативный OP-SQLite', report.schemaVersion === 1 && report.foreignKeys],
        ['M2 Фильтр секретов (MEM-014)', report.secretGuardBlocked],
        ['M2 Детектор конфликтов (MEM-010)', report.conflictDetected],
        ['M2 Оптимистическая блокировка (MEM-011)', report.optimisticConcurrency],
        ['M2 Удаление + tombstone (MEM-006)', report.deleteWithTombstone],
        ['M2 Истечение срока + CHECK (MEM-005)', report.expiryBoundary],
        ['M1 SAVEPOINT + CHECK constraints', report.savepointRollback && report.checkConstraint],
      ]
    : [];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#101827" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>OGAM · JARVIS MEMORY STEP 1 · M2</Text>
        <Text style={styles.title}>Jarvis M2 Memory</Text>
        <Text style={styles.subtitle}>
          Нативный OP-SQLite 15.2.5 + фильтр секретов, конфликты и явное подтверждение
        </Text>

        <View style={styles.statusCard}>
          {busy ? (
            <ActivityIndicator size="large" color="#7DD3FC" />
          ) : report ? (
            <Text style={styles.passMark}>PASS</Text>
          ) : probeError ? (
            <Text style={styles.failMark}>FAIL</Text>
          ) : null}
          <Text style={styles.statusTitle}>
            {busy
              ? 'Нативная проверка M1+M2…'
              : report
                ? 'Нативный M1+M2 самотест пройден'
                : probeError
                  ? 'Ошибка самотеста'
                  : 'Ожидание'}
          </Text>
          <Text style={styles.muted}>
            {report
              ? `SQLite ${report.sqliteVersion} · JSON1: ${report.json1 ? 'да' : 'нет'} · Android ${String(Platform.Version)}`
              : 'Автопроверка схемы, секретов, конфликтов и транзакций'}
          </Text>
        </View>

        {report ? (
          <View style={styles.results}>
            {checks.map(([label, ok]) => (
              <View key={label} style={styles.resultRow}>
                <Text style={styles.resultLabel}>{label}</Text>
                <Text style={[styles.resultValue, ok ? styles.good : styles.bad]}>
                  {ok ? 'PASS' : 'FAIL'}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {probeError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Ошибка нативного самотеста</Text>
            <Text selectable style={styles.errorText}>
              {probeError}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void runProbe()}
          style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonMuted]}
        >
          <Text style={styles.buttonText}>
            {busy ? 'Проверяем…' : 'Повторить нативный самотест M1+M2'}
          </Text>
        </Pressable>

        <View style={styles.sandboxSection}>
          <Text style={styles.sectionTitle}>Интерактивная проверка M2 на телефоне</Text>
          <Text style={styles.sectionHint}>
            Создайте предложение: оно попадёт в очередь подтверждения, переживёт перезапуск после
            сохранения и заблокируется при попытке записать секрет.
          </Text>

          <View style={styles.chipRow}>
            {(['global', 'project'] as const).map(item => (
              <Pressable
                key={item}
                onPress={() => setScopeMode(item)}
                style={[styles.chip, scopeMode === item && styles.chipActive]}
              >
                <Text style={[styles.chipText, scopeMode === item && styles.chipTextActive]}>
                  {item === 'global' ? 'Глобально' : 'Проект: jarvis-demo'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.chipRow}>
            {(['fact', 'preference', 'project_decision'] as const).map(item => (
              <Pressable
                key={item}
                onPress={() => setKind(item)}
                style={[styles.chip, kind === item && styles.chipActive]}
              >
                <Text style={[styles.chipText, kind === item && styles.chipTextActive]}>
                  {formatKindLabel(item)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.chipRow}>
            <Pressable
              onPress={() => {
                setKind('fact');
                setSubject('OPPO Find X6 Pro');
                setPredicate('device_os');
                setValueText('ColorOS 16 · Android 16 · PGEM10');
                setSandboxError(null);
              }}
              style={styles.presetChip}
            >
              <Text style={styles.presetText}>Пресет: факт о телефоне</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setKind('fact');
                setSubject('GitHub API');
                setPredicate('api_key');
                setValueText('ghp_1234567890abcdefghij1234567890abcdef');
                setSandboxError(null);
              }}
              style={styles.presetChipDanger}
            >
              <Text style={styles.presetTextDanger}>Пресет: токен (проверка блока)</Text>
            </Pressable>
          </View>

          <Text style={styles.inputLabel}>Тема (subject)</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            style={styles.input}
            placeholder="Например, OPPO Find X6 Pro"
            placeholderTextColor="#64748B"
          />

          <Text style={styles.inputLabel}>Предикат (predicate)</Text>
          <TextInput
            value={predicate}
            onChangeText={setPredicate}
            style={styles.input}
            placeholder="Например, device_os"
            placeholderTextColor="#64748B"
          />

          <Text style={styles.inputLabel}>Значение (value)</Text>
          <TextInput
            value={valueText}
            onChangeText={setValueText}
            style={styles.input}
            placeholder="Любое текстовое значение"
            placeholderTextColor="#64748B"
          />

          <Pressable
            accessibilityRole="button"
            disabled={sandboxBusy}
            onPress={() => void handlePropose()}
            style={({ pressed }) => [
              styles.proposeButton,
              (pressed || sandboxBusy) && styles.buttonMuted,
            ]}
          >
            <Text style={styles.buttonText}>
              {sandboxBusy ? 'Обработка…' : 'Предложить запись в память'}
            </Text>
          </Pressable>

          {sandboxError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Заблокировано защитой памяти</Text>
              <Text selectable style={styles.errorText}>
                {sandboxError}
              </Text>
            </View>
          ) : null}

          <Text style={styles.listHeader}>
            Ожидают подтверждения ({pendingDrafts.length})
          </Text>
          {pendingDrafts.length === 0 ? (
            <Text style={styles.emptyHint}>Нет неподтверждённых предложений в выбранной области.</Text>
          ) : (
            pendingDrafts.map(({ proposal, conflicts }) => (
              <MemoryProposalCard
                key={proposal.id}
                proposal={proposal}
                conflicts={conflicts}
                busy={sandboxBusy}
                onConfirm={id => void handleConfirm(id)}
                onReject={id => void handleReject(id)}
              />
            ))
          )}

          <Text style={styles.listHeader}>
            Подтверждённая память ({formatScopeLabel(scopeMode, activeScopeId ?? null)} ·{' '}
            {confirmedRecords.length})
          </Text>
          {confirmedRecords.length === 0 ? (
            <Text style={styles.emptyHint}>
              Пока нет подтверждённых записей. Сохраните предложение выше и перезапустите
              приложение для проверки сохранности.
            </Text>
          ) : (
            confirmedRecords.map(record => (
              <View key={record.id} style={styles.confirmedCard}>
                <View style={styles.confirmedHeader}>
                  <View style={styles.confirmedTitleWrap}>
                    <Text style={styles.confirmedSubject}>{record.subject}</Text>
                    <Text style={styles.confirmedMeta}>
                      {formatKindLabel(record.kind)} · {record.predicate}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void handleDelete(record.id)}
                    disabled={sandboxBusy}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteText}>Удалить</Text>
                  </Pressable>
                </View>
                <Text selectable style={styles.confirmedValue}>
                  {formatValuePreview(record.value)}
                </Text>
              </View>
            ))
          )}

          <Text style={styles.tombstoneFooter}>
            Tombstones удалений (без значений): {tombstoneCount}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101827' },
  content: { padding: 20, paddingTop: 34, paddingBottom: 48 },
  eyebrow: { color: '#7DD3FC', fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  title: { color: '#F8FAFC', fontSize: 28, fontWeight: '800', marginTop: 8 },
  subtitle: { color: '#A8B5C7', fontSize: 13, lineHeight: 19, marginTop: 6 },
  statusCard: {
    backgroundColor: '#1B293B',
    borderRadius: 16,
    padding: 18,
    marginTop: 20,
    alignItems: 'center',
  },
  passMark: { color: '#4ADE80', fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  failMark: { color: '#F87171', fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  statusTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginTop: 6 },
  muted: { color: '#A8B5C7', fontSize: 12, marginTop: 4, textAlign: 'center' },
  results: { backgroundColor: '#1B293B', borderRadius: 16, padding: 14, marginTop: 14 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#35445A',
  },
  resultLabel: { color: '#DCE5F1', fontSize: 12, flex: 1, paddingRight: 10 },
  resultValue: { fontSize: 12, fontWeight: '800' },
  good: { color: '#4ADE80' },
  bad: { color: '#F87171' },
  errorCard: {
    backgroundColor: '#3A2028',
    borderColor: '#7F1D1D',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  errorTitle: { color: '#FCA5A5', fontWeight: '800', marginBottom: 6, fontSize: 13 },
  errorText: { color: '#FEE2E2', fontSize: 12, lineHeight: 18 },
  button: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    alignItems: 'center',
    padding: 14,
    marginTop: 14,
  },
  proposeButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    alignItems: 'center',
    padding: 14,
    marginTop: 14,
  },
  buttonMuted: { opacity: 0.55 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  sandboxSection: {
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#263449',
  },
  sectionTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  sectionHint: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: '#0C4A6E', borderColor: '#38BDF8' },
  chipText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#E0F2FE', fontWeight: '800' },
  presetChip: {
    backgroundColor: '#064E3B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  presetText: { color: '#A7F3D0', fontSize: 11, fontWeight: '700' },
  presetChipDanger: {
    backgroundColor: '#4C1D24',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  presetTextDanger: { color: '#FECACA', fontSize: 11, fontWeight: '700' },
  inputLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700', marginTop: 12 },
  input: {
    backgroundColor: '#1B293B',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
    fontSize: 13,
  },
  listHeader: { color: '#E2E8F0', fontSize: 14, fontWeight: '800', marginTop: 20 },
  emptyHint: { color: '#64748B', fontSize: 12, marginTop: 8, lineHeight: 18 },
  confirmedCard: {
    backgroundColor: '#1B293B',
    borderColor: '#065F46',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  confirmedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confirmedTitleWrap: { flex: 1, paddingRight: 10 },
  confirmedSubject: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  confirmedMeta: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  confirmedValue: { color: '#D1FAE5', fontSize: 12, marginTop: 8, lineHeight: 18 },
  deleteButton: {
    backgroundColor: '#7F1D1D',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteText: { color: '#FEE2E2', fontSize: 11, fontWeight: '800' },
  tombstoneFooter: { color: '#64748B', fontSize: 11, marginTop: 16, textAlign: 'center' },
});
