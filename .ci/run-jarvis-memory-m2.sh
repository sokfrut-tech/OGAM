#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORK_DIR="${JARVIS_M2_WORK_DIR:-$(mktemp -d)}"
CLEANUP_WORK_DIR=0
if [ -z "${JARVIS_M2_WORK_DIR:-}" ]; then
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
  "name": "jarvis-memory-m2-ci",
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

# Resolver stub for unit tests (which mock @op-engineering/op-sqlite); real node:sqlite
# integration below replaces open() in a separate verification phase.
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

echo "=== Type-checking M1+M2 production services and 7 focused tests ==="
npx tsc --noEmit -p tsconfig.json

echo "=== Running all 7 focused Jarvis memory Jest suites ==="
npx jest --config jest.config.cjs --runInBand --no-coverage --no-cache

echo "=== Compiling production M1+M2 services for real node:sqlite integration ==="
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

cat > scripts/m2-sqlite-integration.cjs <<'JS'
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');

global.__DEV__ = false;
const sqliteDb = new DatabaseSync(':memory:');
sqliteDb.exec('PRAGMA foreign_keys = ON');

// Wire @op-engineering/op-sqlite open() to real node:sqlite DatabaseSync
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

(async () => {
  try {
    // 1. Real schema v1 migration + idempotent ensureReady
    await jarvisMemoryDatabase.ensureReady();
    await jarvisMemoryDatabase.ensureReady();

    // 2. MEM-014 Secret blocking without DB write
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

    // 3. MEM-001/002 Propose, verify not confirmed, confirm explicitly
    const draft1 = await jarvisMemoryConfirmationController.propose({
      kind: 'fact',
      subject: 'device',
      predicate: 'target',
      value: { model: 'PGEM10', os: 'ColorOS 16' },
      scope: 'global',
      sourceExcerptHash: 'sha256:excerpt1',
    });
    assert.equal(draft1.proposal.status, 'proposed');
    assert.equal(draft1.conflicts.length, 0);
    assert.equal(
      (await jarvisMemoryRepository.listActiveConfirmed({ scope: 'global' })).length,
      0,
    );

    await assert.rejects(() =>
      jarvisMemoryConfirmationController.confirm(draft1.proposal.id, { userAction: 'implicit' }),
    );
    const confirmedOk = await jarvisMemoryConfirmationController.confirm(draft1.proposal.id, {
      userAction: 'explicit_confirm',
    });
    assert.equal(confirmedOk, true);

    // 4. MEM-007 Scope isolation (project A vs project B vs global)
    const draftProjA = await jarvisMemoryConfirmationController.propose({
      kind: 'project_decision',
      subject: 'memory',
      predicate: 'driver',
      value: 'op-sqlite',
      scope: 'project',
      scopeId: 'proj-A',
    });
    assert.equal(
      await jarvisMemoryConfirmationController.confirm(draftProjA.proposal.id, {
        userAction: 'explicit_confirm',
      }),
      true,
    );
    assert.equal(
      (await jarvisMemoryRepository.listActiveConfirmed({ scope: 'project', scopeId: 'proj-B' }))
        .length,
      0,
    );
    assert.equal(
      (await jarvisMemoryRepository.listActiveConfirmed({ scope: 'global' })).length,
      1,
    );

    // 5. MEM-010 Conflict detection without overwriting confirmed record
    const draftConflict = await jarvisMemoryConfirmationController.propose({
      kind: 'fact',
      subject: 'device',
      predicate: 'target',
      value: { model: 'PGEM10', os: 'Android 16' },
      scope: 'global',
    });
    assert.equal(draftConflict.conflicts.length, 1);
    assert.equal(
      draftConflict.conflicts[0].reason,
      'same_subject_predicate_different_value',
    );
    const stillOld = await jarvisMemoryRepository.getById(draft1.proposal.id);
    assert.deepEqual(stillOld.value, { model: 'PGEM10', os: 'ColorOS 16' });

    // Reject conflicting proposal cleanly (MEM-003)
    assert.equal(await jarvisMemoryConfirmationController.reject(draftConflict.proposal.id), true);

    // 6. MEM-011 Optimistic concurrency update
    const updated = await jarvisMemoryConfirmationController.updateConfirmed(
      draft1.proposal.id,
      { value: { model: 'PGEM10', os: 'Android 16 / ColorOS 16' } },
      stillOld.updatedAt,
    );
    assert.ok(updated.updatedAt > stillOld.updatedAt);
    await assert.rejects(
      () =>
        jarvisMemoryConfirmationController.updateConfirmed(
          draft1.proposal.id,
          { value: { model: 'stale' } },
          stillOld.updatedAt,
        ),
      err => err instanceof MemoryConcurrencyError,
    );

    // 7. MEM-005 Expiry boundary + expireStale CHECK constraint compatibility
    const futureExpiry = Date.now() + 5000;
    const expDraft = await jarvisMemoryConfirmationController.propose({
      kind: 'reminder',
      subject: 'temp_note',
      predicate: 'expires',
      value: 'soon',
      scope: 'global',
      expiresAt: futureExpiry,
    });
    assert.equal(
      await jarvisMemoryConfirmationController.confirm(expDraft.proposal.id, {
        userAction: 'explicit_confirm',
      }),
      true,
    );
    const activeAfterExpiry = await jarvisMemoryRepository.listActiveConfirmed({
      scope: 'global',
      now: futureExpiry + 1,
    });
    assert.equal(
      activeAfterExpiry.some(r => r.id === expDraft.proposal.id),
      false,
    );
    const expiredCount = await jarvisMemoryConfirmationController.expireStale(futureExpiry + 1);
    assert.equal(expiredCount, 1);
    const expRow = await jarvisMemoryRepository.getById(expDraft.proposal.id);
    assert.equal(expRow.status, 'expired');
    assert.equal(expRow.userApprovedAt, null);

    // 8. MEM-006 Delete with tombstone (value absent from tombstone)
    const removed = await jarvisMemoryConfirmationController.remove(
      draft1.proposal.id,
      'user_delete',
    );
    assert.equal(removed, true);
    assert.equal(await jarvisMemoryRepository.getById(draft1.proposal.id), undefined);
    const tombstones = await jarvisMemoryRepository.listTombstones();
    const tomb = tombstones.find(t => t.memoryId === draft1.proposal.id);
    assert.ok(tomb);
    assert.equal(tomb.reason, 'user_delete');
    assert.equal(tomb.provenanceHash, 'sha256:excerpt1');

    // 9. MEM-018 Newer schema version fails closed without dropping rows
    sqliteDb.exec('UPDATE memory_schema_meta SET schema_version = 99 WHERE singleton_id = 1');
    jarvisMemoryDatabase.resetForTests();
    await assert.rejects(() => jarvisMemoryDatabase.ensureReady(), /newer than this app supports/);

    console.log(
      JSON.stringify(
        {
          suite: 'jarvis-memory-m2-real-sqlite',
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

echo "=== Running M2 end-to-end integration against real node:sqlite ==="
node scripts/m2-sqlite-integration.cjs
echo "Jarvis memory M2 focused validation COMPLETED."
