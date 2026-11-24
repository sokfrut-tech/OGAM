#!/usr/bin/env bash
set -euo pipefail

# Run focused M1 tests from this checkout without installing the full React Native
# workspace, whose private sibling ../shared packages are not part of this repo.
readonly ROOT_DIR="$(git rev-parse --show-toplevel)"
readonly EXPECTED_M1_COMMIT="67c896cf21cab6f4d0c0ba9118e6013770165252"
readonly HARNESS_DIR="$(mktemp -d "${TMPDIR:-/tmp}/jarvis-memory-m1.XXXXXX")"
trap 'rm -rf "$HARNESS_DIR"' EXIT

git -C "$ROOT_DIR" merge-base --is-ancestor "$EXPECTED_M1_COMMIT" HEAD
echo "Verified M1 baseline is an ancestor of $(git -C "$ROOT_DIR" rev-parse HEAD)"

mkdir -p "$HARNESS_DIR/src/services" "$HARNESS_DIR/src/utils" \
  "$HARNESS_DIR/__tests__/unit/services/jarvisMemory" "$HARNESS_DIR/types" \
  "$HARNESS_DIR/scripts"

cp -a "$ROOT_DIR/src/services/jarvisMemory" "$HARNESS_DIR/src/services/"
cp "$ROOT_DIR/src/utils/generateId.ts" "$HARNESS_DIR/src/utils/"
cp "$ROOT_DIR/src/utils/logger.ts" "$HARNESS_DIR/src/utils/"
cp "$ROOT_DIR"/__tests__/unit/services/jarvisMemory/*.test.ts \
  "$HARNESS_DIR/__tests__/unit/services/jarvisMemory/"

cd "$HARNESS_DIR"
cat > package.json <<'JSON'
{"name":"jarvis-memory-m1-ci-harness","private":true,"version":"1.0.0"}
JSON

echo "Installing pinned isolated TypeScript/Jest toolchain"
npm install --no-save --no-audit --no-fund --no-package-lock \
  jest@29.7.0 ts-jest@29.2.5 typescript@5.8.3 \
  @types/jest@29.5.13 @types/node@25.3.5

# All focused database tests mock this native module; this stub only satisfies
# module resolution and deliberately fails if a test reaches the real open().
mkdir -p node_modules/@op-engineering/op-sqlite
cat > node_modules/@op-engineering/op-sqlite/package.json <<'JSON'
{"name":"@op-engineering/op-sqlite","version":"0.0.0-ci-stub","main":"index.js","types":"index.d.ts"}
JSON
cat > node_modules/@op-engineering/op-sqlite/index.js <<'JS'
exports.open = function () {
  throw new Error('CI resolver stub reached: op-sqlite should be mocked by the test');
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
    "target": "ES2022", "module": "commonjs", "moduleResolution": "node",
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["jest", "node"], "lib": ["ES2022", "DOM"]
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
  testMatch: ['<rootDir>/__tests__/unit/services/jarvisMemory/**/*.test.ts'],
  clearMocks: true,
  verbose: true,
  testTimeout: 10000
};
JS

echo "Type-checking M1 production modules and focused tests"
npx tsc --noEmit -p tsconfig.json

echo "Running focused Jarvis memory Jest suites"
npx jest --config jest.config.cjs --runInBand --no-coverage --no-cache

echo "Compiling production schema for native Node SQLite DDL probe"
npx tsc src/services/jarvisMemory/schema.ts \
  --target ES2022 --module commonjs --skipLibCheck \
  --rootDir src/services/jarvisMemory --outDir dist

cat > scripts/sqlite-schema-probe.cjs <<'JS'
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { MEMORY_SCHEMA_VERSION, MEMORY_V1_STATEMENTS } = require('../dist/schema.js');

const db = new DatabaseSync(':memory:');
try {
  db.exec('PRAGMA foreign_keys = ON');
  assert.equal(Number(db.prepare('PRAGMA foreign_keys').get().foreign_keys), 1);
  const sqliteVersion = db.prepare('SELECT sqlite_version() AS version').get().version;
  let json1Available = false;
  try {
    json1Available = Number(db.prepare("SELECT json_valid('{}') AS valid").get().valid) === 1;
  } catch {}
  db.exec('BEGIN IMMEDIATE');
  db.exec(`CREATE TABLE memory_schema_meta (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    schema_version INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`);
  for (const statement of MEMORY_V1_STATEMENTS) db.exec(statement);
  db.prepare('INSERT INTO memory_schema_meta VALUES (1, ?, ?)').run(MEMORY_SCHEMA_VERSION, Date.now());
  db.exec('COMMIT');

  db.exec('SAVEPOINT rollback_probe');
  db.exec('CREATE TEMP TABLE rollback_probe_table (id INTEGER NOT NULL)');
  db.exec('ROLLBACK TO SAVEPOINT rollback_probe');
  db.exec('RELEASE SAVEPOINT rollback_probe');
  assert.equal(Number(db.prepare("SELECT count(*) AS n FROM sqlite_temp_master WHERE name='rollback_probe_table'").get().n), 0);

  const insert = db.prepare(`INSERT INTO memory_records
    (id, kind, subject, predicate, value_json, scope, scope_id, created_at, updated_at,
     expires_at, confidence_milli, status, user_approved_at, sync_policy, schema_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const now = Date.now();
  const row = (id, extra = {}) => {
    const value = {
      id, kind: 'fact', subject: 'subject', predicate: 'predicate', value_json: '{"ok":true}',
      scope: 'global', scope_id: null, created_at: now, updated_at: now, expires_at: null,
      confidence_milli: 1000, status: 'proposed', user_approved_at: null,
      sync_policy: 'local_only', schema_version: 1, ...extra
    };
    return Object.values(value);
  };
  insert.run(...row('valid'));
  assert.throws(() => insert.run(...row('invalid-global-scope', { scope_id: 'project-1' })));
  assert.throws(() => insert.run(...row('invalid-confirmation', { status: 'confirmed' })));
  assert.throws(() => insert.run(...row('invalid-expiry', { expires_at: now })));
  assert.throws(() => insert.run(...row('invalid-confidence', { confidence_milli: 1001 })));
  console.log(JSON.stringify({
    schemaVersion: MEMORY_SCHEMA_VERSION, sqliteVersion, json1Available,
    foreignKeysEnabled: true, transactionRollback: 'passed', ddlConstraintChecks: 'passed'
  }, null, 2));
} finally {
  db.close();
}
JS

echo "Running real SQLite schema, constraint and rollback probe"
node scripts/sqlite-schema-probe.cjs
echo "Jarvis memory M1 focused validation completed"
