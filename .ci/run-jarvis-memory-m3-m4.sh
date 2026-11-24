#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORK_DIR="${JARVIS_M3_WORK_DIR:-$(mktemp -d)}"
CLEANUP_WORK_DIR=0
if [ -z "${JARVIS_M3_WORK_DIR:-}" ]; then
  CLEANUP_WORK_DIR=1
fi
trap 'if [ "$CLEANUP_WORK_DIR" -eq 1 ]; then rm -rf "$WORK_DIR"; fi' EXIT

mkdir -p "$WORK_DIR/src/services/jarvisMemory" \
         "$WORK_DIR/src/utils" \
         "$WORK_DIR/__tests__/unit/services/jarvisMemory" \
         "$WORK_DIR/types" \
         "$WORK_DIR/scripts"

cp -a "$REPO_ROOT/src/services/jarvisMemory/." "$WORK_DIR/src/services/jarvisMemory/"
cp "$REPO_ROOT/src/utils/generateId.ts" "$WORK_DIR/src/utils/generateId.ts"
cp "$REPO_ROOT/src/utils/logger.ts" "$WORK_DIR/src/utils/logger.ts"
cp -a "$REPO_ROOT/__tests__/unit/services/jarvisMemory/." "$WORK_DIR/__tests__/unit/services/jarvisMemory/"

cd "$WORK_DIR"

if [ ! -d node_modules/jest ]; then
  cat > package.json <<'JSON'
{
  "name": "jarvis-memory-m3-m4-ci",
  "private": true,
  "version": "1.0.0"
}
JSON
  npm install --no-save --no-audit --no-fund \
    typescript@5.8.3 \
    jest@29.7.0 \
    ts-jest@29.4.1 \
    @types/jest@29.5.14 \
    @types/node@22.15.3 \
    buffer@6.0.3
fi

mkdir -p node_modules/@op-engineering/op-sqlite
cat > node_modules/@op-engineering/op-sqlite/package.json <<'JSON'
{"name":"@op-engineering/op-sqlite","version":"0.0.0-ci-stub","main":"index.js","types":"index.d.ts"}
JSON
cat > node_modules/@op-engineering/op-sqlite/index.js <<'JS'
exports.open = function () {
  throw new Error('CI resolver stub reached: op-sqlite should be mocked by unit tests');
};
JS
cat > node_modules/@op-engineering/op-sqlite/index.d.ts <<'TS'
export interface DB {
  executeSync(sql: string, params?: unknown[]): { rows?: unknown[]; rowsAffected?: number };
}
export function open(options: { name: string }): DB;
TS

cat > types/ci-globals.d.ts <<'TS'
declare const __DEV__: boolean;
TS

cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["jest", "node"],
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src/**/*.ts", "__tests__/**/*.ts", "types/**/*.d.ts"]
}
JSON

cat > jest.setup.cjs <<'JS'
global.__DEV__ = false;
JS

cat > jest.config.cjs <<'JS'
module.exports = {
  setupFiles: ['<rootDir>/jest.setup.cjs'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/unit/services/jarvisMemory/**/*.test.ts'],
  clearMocks: true,
  verbose: true,
  testTimeout: 10000
};
JS

echo "=== Type-checking M1+M2+M3+M4 production services and all 9 focused tests ==="
npx tsc --noEmit -p tsconfig.json

echo "=== Running all 9 focused Jarvis memory Jest suites (M1+M2+M3+M4) ==="
npx jest --config jest.config.cjs --runInBand --no-coverage --no-cache

echo "=== Compiling production M1-M4 services for real node:sqlite integration ==="
cat > tsconfig.build.json <<'JSON'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "types/**/*.d.ts"],
  "exclude": ["__tests__"]
}
JSON
npx tsc -p tsconfig.build.json

cat > scripts/m3-m4-sqlite-integration.cjs <<'JS'
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');

global.__DEV__ = false;
const sqliteDb = new DatabaseSync(':memory:');
sqliteDb.exec('PRAGMA foreign_keys = ON');

const opSqliteStub = require('../node_modules/@op-engineering/op-sqlite/index.js');
opSqliteStub.open = () => ({
  executeSync(sql, params = []) {
    const trimmed = sql.trim();
    const stmt = sqliteDb.prepare(trimmed);
    const bindParams = params.map(v => (v === undefined ? null : v));
    if (/^(SELECT|PRAGMA|WITH)\b/i.test(trimmed)) {
      return { rows: stmt.all(...bindParams), rowsAffected: 0 };
    }
    const info = stmt.run(...bindParams);
    return { rows: [], rowsAffected: Number(info.changes ?? 0) };
  },
});

const { jarvisMemoryDatabase } = require('../dist/services/jarvisMemory/database.js');
const {
  jarvisMemoryRepository,
  MemoryConcurrencyError,
} = require('../dist/services/jarvisMemory/repository.js');
const { SecretMemoryBlockedError } = require('../dist/services/jarvisMemory/secretGuard.js');
const {
  jarvisMemoryConfirmationController,
} = require('../dist/services/jarvisMemory/confirmationController.js');
const {
  jarvisMemoryManagementService,
  MemoryDisabledError,
} = require('../dist/services/jarvisMemory/managementService.js');
const {
  jarvisMemoryRetrievalService,
} = require('../dist/services/jarvisMemory/retrievalService.js');

(async () => {
  try {
    await jarvisMemoryDatabase.ensureReady();
    await jarvisMemoryDatabase.ensureReady();

    // 1. Secret blocking before DB write (MEM-014)
    await assert.rejects(
      () =>
        jarvisMemoryConfirmationController.propose({
          kind: 'fact',
          subject: 'GitHub',
          predicate: 'token',
          value: 'ghp_1234567890abcdefghij1234567890abcdef',
          scope: 'global',
        }),
      err => err instanceof SecretMemoryBlockedError,
    );

    // 2. Propose + explicit confirmation + scope isolation
    const g1 = await jarvisMemoryConfirmationController.propose({
      kind: 'preference',
      subject: 'язык ответа',
      predicate: 'language',
      value: 'Всегда отвечать на русском языке',
      scope: 'global',
      sourceConversationId: 'conv-main',
      sourceMessageId: 'msg-1',
    });
    await assert.rejects(() =>
      jarvisMemoryConfirmationController.confirm(g1.proposal.id, { userAction: 'auto' }),
    );
    assert.equal(
      await jarvisMemoryConfirmationController.confirm(g1.proposal.id, {
        userAction: 'explicit_confirm',
      }),
      true,
    );

    const pAlpha = await jarvisMemoryConfirmationController.propose({
      kind: 'project_decision',
      subject: 'База данных',
      predicate: 'sqlite_driver',
      value: 'OP-SQLite 15.2.5 (PGEM10)',
      scope: 'project',
      scopeId: 'alpha',
    });
    assert.equal(
      await jarvisMemoryConfirmationController.confirm(pAlpha.proposal.id, {
        userAction: 'explicit_confirm',
      }),
      true,
    );

    const pBeta = await jarvisMemoryConfirmationController.propose({
      kind: 'project_decision',
      subject: 'База данных',
      predicate: 'sqlite_driver',
      value: 'Чужой проект beta',
      scope: 'project',
      scopeId: 'beta',
    });
    assert.equal(
      await jarvisMemoryConfirmationController.confirm(pBeta.proposal.id, {
        userAction: 'explicit_confirm',
      }),
      true,
    );

    // 3. M3 Fail-closed Disable / Enable (MEM-026)
    await jarvisMemoryManagementService.setMemoryEnabled(false);
    await assert.rejects(
      () =>
        jarvisMemoryConfirmationController.propose({
          kind: 'fact',
          subject: 'blocked',
          predicate: 'while_paused',
          value: 'should fail closed',
          scope: 'global',
        }),
      err => err instanceof MemoryDisabledError,
    );
    const pausedRetrieval = await jarvisMemoryRetrievalService.retrieveForPrompt({
      query: 'языка',
      includeGlobal: true,
      projectId: 'alpha',
    });
    assert.equal(pausedRetrieval.enabled, false);
    assert.equal(pausedRetrieval.items.length, 0);
    assert.equal(pausedRetrieval.promptBlock, '');
    await jarvisMemoryManagementService.setMemoryEnabled(true);

    // 4. M3 Scoped Search + Edit/Delete with 1-tap Undo
    const foundAlpha = await jarvisMemoryManagementService.searchRecords({
      scope: 'project',
      scopeId: 'alpha',
      query: 'pgem10',
      status: 'confirmed',
    });
    assert.deepEqual(foundAlpha.map(r => r.id), [pAlpha.proposal.id]);

    const currentAlpha = await jarvisMemoryRepository.getById(pAlpha.proposal.id);
    assert.ok(currentAlpha);
    const { record: updatedAlpha } = await jarvisMemoryManagementService.updateWithCheckpoint(
      pAlpha.proposal.id,
      { value: 'OP-SQLite v15.2.5 updated' },
      currentAlpha.updatedAt,
    );
    assert.ok(updatedAlpha.updatedAt > currentAlpha.updatedAt);
    await assert.rejects(
      () =>
        jarvisMemoryRepository.updateRecord(
          pAlpha.proposal.id,
          { value: 'stale write' },
          currentAlpha.updatedAt,
        ),
      err => err instanceof MemoryConcurrencyError,
    );

    const undoEdit = await jarvisMemoryManagementService.undoLastChange();
    assert.equal(undoEdit.undone, true);
    assert.equal(undoEdit.restoredRecord.value, 'OP-SQLite 15.2.5 (PGEM10)');

    await jarvisMemoryManagementService.deleteWithCheckpoint(pAlpha.proposal.id, 'user_delete');
    assert.equal(await jarvisMemoryRepository.getById(pAlpha.proposal.id), undefined);
    const undoDelete = await jarvisMemoryManagementService.undoLastChange();
    assert.equal(undoDelete.undone, true);
    assert.equal(undoDelete.restoredRecord.id, pAlpha.proposal.id);
    assert.equal(
      (await jarvisMemoryRepository.listTombstones()).some(t => t.memoryId === pAlpha.proposal.id),
      false,
    );

    // 5. M3 Source Conversation Deletion (MEM-019)
    const convKeep = await jarvisMemoryConfirmationController.propose({
      kind: 'fact',
      subject: 'Источник чат',
      predicate: 'keep_test',
      value: 'Оставить память без ссылки',
      scope: 'global',
      sourceConversationId: 'chat-to-keep',
    });
    await jarvisMemoryConfirmationController.confirm(convKeep.proposal.id, {
      userAction: 'explicit_confirm',
    });
    const keepRes = await jarvisMemoryManagementService.handleSourceConversationDeleted(
      'chat-to-keep',
      'keep_memory',
    );
    assert.equal(keepRes.affectedCount, 1);
    assert.equal((await jarvisMemoryRepository.getById(convKeep.proposal.id)).sourceConversationId, null);

    // 6. M3 Portable JSON Export + Secret re-screening (MEM-020)
    await assert.rejects(() =>
      jarvisMemoryManagementService.exportPortableJson({ userInitiated: false, includeAllScopes: true }),
    );
    const now = Date.now();
    sqliteDb
      .prepare(
        `INSERT INTO memory_records (
          id, kind, subject, predicate, value_json, scope, scope_id,
          created_at, updated_at, expires_at, confidence_milli, status,
          user_approved_at, sync_policy, schema_version
        ) VALUES ('bypassed-secret', 'fact', 'Auth', 'token', ?, 'global', NULL, ?, ?, NULL, 1000, 'confirmed', ?, 'local_only', 1)`,
      )
      .run(JSON.stringify('sk-proj-1234567890abcdefghijklmnop'), now, now, now);

    const exportBundle = await jarvisMemoryManagementService.exportPortableJson({
      userInitiated: true,
      includeAllScopes: true,
    });
    assert.equal(exportBundle.encrypted, false);
    assert.equal(exportBundle.redactedSecretCount, 1);
    assert.ok(exportBundle.recordCount >= 3);
    assert.ok(!JSON.stringify(exportBundle).includes('sk-proj-'));

    // 7. M4 Deterministic Scoped Retrieval + Cyrillic stem + budget + provenance
    const retrievalRes = await jarvisMemoryRetrievalService.retrieveForPrompt({
      query: 'языка sqlite',
      includeGlobal: true,
      projectId: 'alpha',
      maxTokens: 250,
    });
    assert.equal(retrievalRes.enabled, true);
    assert.deepEqual(retrievalRes.scopesSearched, ['global', 'project:alpha']);
    assert.ok(retrievalRes.items.length >= 2);
    assert.ok(retrievalRes.estimatedTokens <= 250);
    assert.ok(retrievalRes.promptBlock.includes('[JARVIS_CONFIRMED_MEMORY_BEGIN]'));
    assert.ok(retrievalRes.promptBlock.includes('chat:conv-main#msg-1'));
    assert.ok(!retrievalRes.promptBlock.includes('Чужой проект beta'));

    // 8. MEM-018 Newer schema version fails closed without dropping rows
    sqliteDb.exec('UPDATE memory_schema_meta SET schema_version = 99 WHERE singleton_id = 1');
    jarvisMemoryDatabase.resetForTests();
    await assert.rejects(() => jarvisMemoryDatabase.ensureReady(), /newer than this app supports/);

    console.log(
      JSON.stringify(
        {
          suite: 'jarvis-memory-m3-m4-real-sqlite',
          sqliteVersion: sqliteDb.prepare('SELECT sqlite_version() AS v').get().v,
          checksPassed: true,
        },
        null,
        2,
      ),
    );
  } finally {
    sqliteDb.close();
  }
})();
JS

echo "=== Running M3+M4 end-to-end integration against real node:sqlite ==="
node scripts/m3-m4-sqlite-integration.cjs
echo "Jarvis memory M3+M4 focused validation COMPLETED."
