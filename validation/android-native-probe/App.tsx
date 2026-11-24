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
  View,
} from 'react-native';
import { jarvisMemoryDatabase } from './src/services/jarvisMemory/database';
import { jarvisMemoryRepository } from './src/services/jarvisMemory/repository';

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
  databasePath: string;
  probeRecordId: string;
};

function requireTrue(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function runNativeProbe(): Promise<ProbeReport> {
  await jarvisMemoryDatabase.ensureReady();
  const db = jarvisMemoryDatabase.getDatabase();

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

  const proposal = await jarvisMemoryRepository.createProposal({
    kind: 'fact',
    subject: 'Jarvis M1 Android native probe',
    predicate: 'runtime_acceptance',
    value: {
      app: 'Jarvis M1 Probe',
      platform: Platform.OS,
      androidApi: Platform.Version,
      testedAt: new Date().toISOString(),
    },
    scope: 'global',
  });
  const readBack = await jarvisMemoryRepository.getById(proposal.id);
  requireTrue(readBack?.id === proposal.id, 'Proposal could not be read back from native SQLite.');
  requireTrue(
    (readBack?.value as { app?: string } | undefined)?.app === 'Jarvis M1 Probe',
    'Stored JSON value did not round-trip.',
  );

  const confirmed = await jarvisMemoryRepository.confirmProposal(proposal.id);
  requireTrue(confirmed, 'Explicit confirmation did not update the proposal.');
  const confirmedRows = await jarvisMemoryRepository.list({
    scope: 'global',
    status: 'confirmed',
  });
  requireTrue(confirmedRows.some((record) => record.id === proposal.id),
    'Confirmed proposal is missing from scoped listing.');

  const rejectedProposal = await jarvisMemoryRepository.createProposal({
    kind: 'fact',
    subject: 'Jarvis M1 Android native probe',
    predicate: 'rejection_check',
    value: { expected: 'rejected' },
    scope: 'global',
  });
  const rejected = await jarvisMemoryRepository.rejectProposal(rejectedProposal.id);
  requireTrue(rejected, 'Proposal rejection did not update the record.');
  const rejectedReadBack = await jarvisMemoryRepository.getById(rejectedProposal.id);
  requireTrue(rejectedReadBack?.status === 'rejected', 'Rejected status was not persisted.');

  const tempName = 'jarvis_m1_native_rollback_probe';
  db.executeSync('SAVEPOINT jarvis_m1_native_rollback');
  db.executeSync('CREATE TEMP TABLE ' + tempName + ' (id INTEGER NOT NULL)');
  db.executeSync('INSERT INTO ' + tempName + ' (id) VALUES (1)');
  db.executeSync('ROLLBACK TO SAVEPOINT jarvis_m1_native_rollback');
  db.executeSync('RELEASE SAVEPOINT jarvis_m1_native_rollback');
  const tempRow = db.executeSync(
    "SELECT COUNT(*) AS count FROM sqlite_temp_master WHERE name = '" + tempName + "'",
  ).rows?.[0] as { count?: number } | undefined;
  const savepointRollback = Number(tempRow?.count) === 0;
  requireTrue(savepointRollback, 'Savepoint rollback did not remove the temporary table.');

  let checkConstraint = false;
  try {
    db.executeSync(
      "INSERT INTO memory_records (id, kind, subject, predicate, value_json, scope, created_at, updated_at, confidence_milli, status, sync_policy, schema_version) VALUES ('m1-invalid-kind-probe', 'not-a-kind', 'x', 'x', '{}', 'global', 1, 1, 1000, 'proposed', 'local_only', 1)",
    );
  } catch {
    checkConstraint = true;
  }
  requireTrue(checkConstraint, 'SQLite CHECK constraint did not reject an invalid memory kind.');

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
    databasePath: db.getDbPath(),
    probeRecordId: proposal.id,
  };
}

export default function App() {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ProbeReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setReport(null);
    setError(null);
    try {
      const nextReport = await runNativeProbe();
      setReport(nextReport);
      console.log('[JARVIS_M1_PROBE] PASS ' + JSON.stringify(nextReport));
    } catch (cause) {
      const message = cause instanceof Error ? cause.stack || cause.message : String(cause);
      setError(message);
      console.error('[JARVIS_M1_PROBE] FAIL ' + message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void run(); }, [run]);

  const checks: Array<[string, boolean]> = report ? [
    ['Открытие нативной БД и миграция v1', report.schemaVersion === 1],
    ['Запись, чтение и JSON round-trip', report.proposalRoundTrip],
    ['Подтверждение пользователем', report.explicitConfirmation],
    ['Отклонение предложения', report.rejection],
    ['Откат SAVEPOINT', report.savepointRollback],
    ['SQLite CHECK constraints', report.checkConstraint],
    ['Foreign keys PRAGMA', report.foreignKeys],
  ] : [];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#101827" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>OGAM · ANDROID DEVICE CHECK</Text>
        <Text style={styles.title}>Jarvis Memory M1</Text>
        <Text style={styles.subtitle}>Проверка настоящего OP-SQLite на Android ARM64</Text>

        <View style={styles.statusCard}>
          {busy ? <ActivityIndicator size="large" color="#7DD3FC" /> :
            report ? <Text style={styles.passMark}>PASS</Text> :
            error ? <Text style={styles.failMark}>FAIL</Text> : null}
          <Text style={styles.statusTitle}>
            {busy ? 'Проверка выполняется' : report ? 'Нативная проверка завершена' : error ? 'Проверка не пройдена' : 'Ожидание'}
          </Text>
          <Text style={styles.muted}>
            {report ? 'SQLite ' + report.sqliteVersion + ' · Android ' + String(Platform.Version) :
              busy ? 'Миграция, запись, чтение, подтверждение и откат' : 'Запустите проверку'}
          </Text>
        </View>

        {report ? <View style={styles.results}>
          {checks.map(([label, ok]) => <View key={label} style={styles.resultRow}>
            <Text style={styles.resultLabel}>{label}</Text>
            <Text style={[styles.resultValue, ok ? styles.good : styles.bad]}>{ok ? 'PASS' : 'FAIL'}</Text>
          </View>)}
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>JSON1</Text>
            <Text style={styles.detailValue}>{report.json1 ? 'Доступен' : 'Не обнаружен (не обязателен для M1)'}</Text>
          </View>
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>Файл базы</Text>
            <Text selectable style={styles.detailValue}>{report.databasePath}</Text>
          </View>
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>ID записи</Text>
            <Text selectable style={styles.detailValue}>{report.probeRecordId}</Text>
          </View>
        </View> : null}

        {error ? <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Техническая ошибка</Text>
          <Text selectable style={styles.errorText}>{error}</Text>
        </View> : null}

        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run()}
          style={({pressed}) => [styles.button, (pressed || busy) && styles.buttonMuted]}>
          <Text style={styles.buttonText}>{busy ? 'Проверяем…' : 'Проверить снова'}</Text>
        </Pressable>
        <Text style={styles.footnote}>
          Тестовый APK использует отдельную jarvis_memory.db и не изменяет основное приложение OGAM.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#101827' },
  content: { padding: 22, paddingTop: 38, paddingBottom: 48 },
  eyebrow: { color: '#7DD3FC', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { color: '#F8FAFC', fontSize: 30, fontWeight: '800', marginTop: 10 },
  subtitle: { color: '#A8B5C7', fontSize: 14, lineHeight: 21, marginTop: 8 },
  statusCard: { backgroundColor: '#1B293B', borderRadius: 18, padding: 22, marginTop: 26, alignItems: 'center', minHeight: 145, justifyContent: 'center' },
  passMark: { color: '#4ADE80', fontSize: 30, fontWeight: '900', letterSpacing: 2 },
  failMark: { color: '#F87171', fontSize: 30, fontWeight: '900', letterSpacing: 2 },
  statusTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '700', marginTop: 8 },
  muted: { color: '#A8B5C7', fontSize: 12, marginTop: 6, textAlign: 'center' },
  results: { backgroundColor: '#1B293B', borderRadius: 18, padding: 16, marginTop: 18 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#35445A' },
  resultLabel: { color: '#DCE5F1', fontSize: 13, flex: 1, paddingRight: 12 },
  resultValue: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  good: { color: '#4ADE80' },
  bad: { color: '#F87171' },
  detail: { paddingTop: 13 },
  detailLabel: { color: '#7F93AB', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  detailValue: { color: '#DCE5F1', fontSize: 12, marginTop: 5, lineHeight: 18 },
  errorCard: { backgroundColor: '#3A2028', borderColor: '#7F1D1D', borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 18 },
  errorTitle: { color: '#FCA5A5', fontWeight: '800', marginBottom: 8 },
  errorText: { color: '#FEE2E2', fontSize: 12, lineHeight: 18 },
  button: { backgroundColor: '#0284C7', borderRadius: 14, alignItems: 'center', padding: 16, marginTop: 20 },
  buttonMuted: { opacity: 0.55 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  footnote: { color: '#73849B', fontSize: 11, lineHeight: 17, marginTop: 22, textAlign: 'center' },
});
