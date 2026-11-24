# Jarvis Step 1 — curated memory design, privacy threat model and test contract

Date: 2026-11-24  
Project: `sokfrut-tech/OGAM`  
Status: design proposal; documentation only; not production implementation.

## 1. Scope and non-goals

Add a separate, additive `jarvis_memory.db` for user-approved durable memory. Do not replace chat history, Zustand persistence, RAG, document storage, or conversation sync. Do not infer that existing SQLite/app-private storage is encrypted. This phase defines a contract; it does not claim implementation, test execution, APK build, or device validation.

Memory stores compact structured knowledge, not a second transcript. Full source text remains in the conversation store unless the user explicitly chooses otherwise.

## 2. Data model

### 2.1 Canonical record

A memory record has these logical fields:

| Field | Type / constraint | Meaning |
|---|---|---|
| `id` | TEXT UUID, primary key, immutable | Stable identifier |
| `kind` | enum CHECK | `fact`, `preference`, `project_decision`, `routine`, `reminder` |
| `subject` | TEXT NOT NULL, trimmed, 1..256 chars | Entity/topic |
| `predicate` | TEXT NOT NULL, trimmed, 1..128 chars | Relation, e.g. `prefers`, `uses_device` |
| `value_json` | TEXT NOT NULL, valid JSON | Typed value; never executable |
| `scope` | enum CHECK | `global`, `project`, `conversation` |
| `scope_id` | TEXT nullable | Required iff scope is project/conversation; null iff global |
| `source_conversation_id` | TEXT nullable | Provenance pointer |
| `source_message_id` | TEXT nullable | Exact originating message, when available |
| `source_excerpt_hash` | TEXT nullable, SHA-256 hex | Provenance integrity without duplicating private source text |
| `created_at` | INTEGER NOT NULL | UTC epoch milliseconds |
| `updated_at` | INTEGER NOT NULL | UTC epoch milliseconds |
| `expires_at` | INTEGER nullable | UTC epoch milliseconds; null means no scheduled expiry |
| `confidence_milli` | INTEGER 0..1000 | Confidence estimate; never substitutes for approval |
| `status` | enum CHECK | `proposed`, `confirmed`, `rejected`, `expired`, `deleted` |
| `user_approved_at` | INTEGER nullable | Required for confirmed; otherwise null |
| `sync_policy` | enum CHECK | `local_only`, `explicitly_synced` |
| `schema_version` | INTEGER NOT NULL | Record serialization version |

Additional constraints:
- `status='confirmed'` requires non-null `user_approved_at`; non-confirmed states must not be retrieved.
- `scope='global'` requires null `scope_id`; other scopes require non-empty `scope_id`.
- `expires_at`, when present, must be greater than `created_at`.
- Timestamps are UTC epoch milliseconds, not local wall-clock strings.
- JSON value schema is versioned by `schema_version`; reject malformed or oversized values. Initial limit proposal: 16 KiB per value, 256 chars subject, 128 chars predicate.
- Store no passwords, API keys, access tokens, payment credentials, recovery codes, or secrets. The candidate detector is a safety filter, not a guarantee; the confirmation UI must warn users not to save secrets.

### 2.2 Suggested SQLite layout

Use SQLite with foreign keys enabled. Names below are a logical schema proposal; adapt naming to the repository's migration conventions after inspecting the actual database helper.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE memory_records (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN
    ('fact','preference','project_decision','routine','reminder')),
  subject TEXT NOT NULL CHECK (length(trim(subject)) BETWEEN 1 AND 256),
  predicate TEXT NOT NULL CHECK (length(trim(predicate)) BETWEEN 1 AND 128),
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  scope TEXT NOT NULL CHECK (scope IN ('global','project','conversation')),
  scope_id TEXT,
  source_conversation_id TEXT,
  source_message_id TEXT,
  source_excerpt_hash TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER,
  confidence_milli INTEGER NOT NULL CHECK (confidence_milli BETWEEN 0 AND 1000),
  status TEXT NOT NULL CHECK (status IN
    ('proposed','confirmed','rejected','expired','deleted')),
  user_approved_at INTEGER,
  sync_policy TEXT NOT NULL DEFAULT 'local_only'
    CHECK (sync_policy IN ('local_only','explicitly_synced')),
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
  CHECK ((scope = 'global' AND scope_id IS NULL) OR
         (scope <> 'global' AND scope_id IS NOT NULL AND length(trim(scope_id)) > 0)),
  CHECK (expires_at IS NULL OR expires_at > created_at),
  CHECK ((status = 'confirmed' AND user_approved_at IS NOT NULL) OR
         (status <> 'confirmed' AND user_approved_at IS NULL))
);

CREATE INDEX idx_memory_retrieval
  ON memory_records(status, scope, scope_id, kind, expires_at);

CREATE INDEX idx_memory_subject_predicate
  ON memory_records(scope, scope_id, subject, predicate, status);

CREATE INDEX idx_memory_source
  ON memory_records(source_conversation_id, source_message_id);

CREATE TABLE memory_schema_meta (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  schema_version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE memory_deletion_tombstones (
  memory_id TEXT PRIMARY KEY NOT NULL,
  deleted_at INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN
    ('user_delete','source_deleted','retention_expiry','account_reset')),
  provenance_hash TEXT
);
```

Implementation notes:
- If the bundled SQLite engine lacks JSON1, validate JSON in application code and remove the `json_valid` CHECK rather than silently breaking startup. Verify runtime capability first.
- If the project already uses SQLDelight/Room/Drizzle or a migration runner, follow that mechanism; do not add a competing database framework.
- Tombstones contain no memory value. Retain them only as long as needed for sync conflict/deletion propagation, then compact under a documented retention policy.
- Avoid a unique constraint on subject/predicate: multiple scoped facts and historical values may coexist. Detect possible conflicts in service logic and ask the user.
- Do not use SQLite FTS/vector search for v1 memory. Deterministic exact/normalized retrieval is easier to scope and audit.

## 3. API and lifecycle contract

Proposed typed service surface (names illustrative; align to project conventions):
- `propose(candidate, provenance) -> Proposal`: writes only a `proposed` record; never prompt-visible.
- `confirm(id, userAction) -> ConfirmedMemory`: only explicit user action; stamps `user_approved_at`.
- `reject(id)`: marks rejected; excluded from retrieval.
- `get(id)`, `list(filters)`: inspect, with scope and status visible.
- `update(id, patch, expectedUpdatedAt)`: optimistic concurrency; require confirmation for material value changes.
- `delete(id)`: remove value from active table and write minimal tombstone if sync requires it.
- `retrieve(context, budget)`: only confirmed, unexpired records whose scope is global or exactly matches the active project/conversation policy.
- `export(userInitiated)`: explicit user-initiated portable export; warn that exported data is unencrypted unless separately encrypted.
- `disable()`: stops retrieval and new proposals; preserve records unless user chooses erase.
- `setSyncPolicy(id, explicitlySynced)`: requires a separate explicit consent step and clear destination disclosure.

Lifecycle:
1. Conversation/model may suggest a candidate.
2. Deterministic validator checks allowed kind, size, scope, secret-risk signals and provenance.
3. UI shows exact proposed subject/value/scope/source and asks user to save.
4. Only a positive user action changes status to confirmed.
5. Retrieval filters in SQL and again in repository code; prompt assembly applies token budget and stable ordering.
6. Expired records are excluded immediately by query even before cleanup; cleanup marks them expired.
7. Conflicting values remain separate candidates; do not silently overwrite.
8. Source conversation deletion invokes a deterministic policy: prompt whether linked memory should also be deleted, or retain only if user explicitly chooses “keep memory”; never silently orphan.
9. User deletion removes active value and dependent caches; sync tombstone propagation is best-effort until every enabled replica acknowledges. Do not promise secure physical erasure from flash storage.

## 4. Privacy and security threat model

### Assets
- Confirmed personal facts/preferences and project decisions.
- Provenance pointers and hashes.
- Sync credentials and remote replicas, if sync is enabled.
- Exports/backups and Android backup copies.

### Threat actors / failure modes
- Another person with unlocked or compromised device access.
- Malicious or over-broad app/SDK code in the process.
- Prompt injection or malicious documents trying to create/alter memory.
- Accidental cross-project retrieval.
- Cloud sync provider compromise or account takeover.
- Backups/export files copied to shared storage.
- Crash, migration failure, low storage, partial deletion, stale caches.
- Device loss, rooted OS, forensic access to flash storage.

### Controls required
1. **Authorization boundary:** model output is untrusted input. Only deterministic service + explicit UI confirmation may write confirmed records. No model-generated SQL or tool can bypass this.
2. **Scope isolation:** every retrieval call must carry an explicit active scope. SQL predicate and repository-level guard both enforce it. Missing scope fails closed; no “search all” fallback.
3. **At-rest protection:** app-private storage is not equivalent to encryption. Evaluate SQLCipher or encrypted record payloads with Android Keystore-backed key wrapping. Threat-model key invalidation, device migration, biometric enrollment changes, backup/restore and recovery. Do not store raw keys in preferences, source, logs, or backups.
4. **Keystore:** use a non-exportable Android Keystore key where supported; document hardware-backed status as capability-dependent, not guaranteed. Decide whether authentication is required for each use; do not bind all background retrieval to biometrics without a usability design.
5. **Backup:** explicitly decide whether memory DB is excluded from Android Auto Backup/device transfer. Default proposal: exclude local-only memory and encryption keys; provide a user-triggered encrypted export/restore flow. Restore must not silently enable cloud sync.
6. **Sync:** local-only default. If opted in, explain provider, account, data classes, retention and deletion behavior. Encrypt in transit and at rest server-side; do not assume transport encryption protects server data. Sync only records marked explicitly_synced. Test deletion/tombstone replay and revoked consent.
7. **Logs/telemetry:** never log value_json, subject, source excerpt, prompt contents, keys or exports. Emit aggregate counters only. Redact crash breadcrumbs.
8. **Prompt injection:** imported docs/web pages/messages can propose memory but cannot authorize it. Treat source content as untrusted; never obey embedded instructions to persist, reveal, or change memory.
9. **Deletion:** clear active row, prompt caches, in-memory snapshots and local search caches. If sync enabled, propagate tombstone. Explain that flash wear-leveling, OS backups, remote backups and already-exported copies prevent a universal secure-erasure guarantee.
10. **Sensitive data:** do not auto-store sensitive personal attributes or credentials. Apply explicit category exclusions and conservative confirmation UX.
11. **Export:** require a user gesture, destination disclosure and warning. Prefer encrypted archive; never create an unencrypted shared-storage export silently.
12. **Failure mode:** if key unavailable, DB corrupt, migration fails, or scope unknown, fail closed: do not fall back to plaintext, default scope, or broad retrieval. Preserve recoverable backup and surface actionable error.

### Open decisions before production security claims
- Actual SQLite driver/version and JSON1 availability.
- Whether Android app currently excludes databases from backup.
- Existing key-management abstractions and minimum API support.
- Whether encrypted database library is license-compatible and supported on target ABI.
- Sync backend threat model and deletion acknowledgement semantics.
- Whether user wants biometric gating, device-credential gating, or app-unlock-only.
No claim of encryption-at-rest or biometric vault is permitted until code, configuration, and tests prove it.

## 5. Migration plan

- `v1`: create `memory_records`, indexes, metadata and tombstones. No automatic import from chats or RAG.
- Migrations run transactionally. Set `PRAGMA user_version` or the repository's canonical migration metadata only after successful DDL.
- On failure: rollback, keep previous schema usable, report migration error; never wipe DB to recover silently.
- Unknown newer schema: refuse writes and retrieval; preserve file for forward-compatible app version.
- Migration tests must use a real SQLite engine matching the app runtime, not only mocked repositories.
- Future schema changes increment one monotonic version and include forward migration plus rollback/recovery behavior where supported.

## 6. Acceptance test matrix

| ID | Scenario | Expected result |
|---|---|---|
| MEM-001 | Candidate proposed without user confirmation | Status proposed; absent from retrieval and prompts |
| MEM-002 | Explicit confirm | Confirmed with approval timestamp; retrievable only in allowed scope |
| MEM-003 | Reject candidate | Rejected; never retrieved |
| MEM-004 | Process death and relaunch | Confirmed memory survives; status/provenance intact |
| MEM-005 | Expiry boundary | Excluded at/after expiry even before cleanup |
| MEM-006 | User deletes memory | Active value and caches gone; tombstone only if needed |
| MEM-007 | Project A vs Project B | A-only record never appears in B, including fallback/error paths |
| MEM-008 | Conversation scope mismatch | Record excluded from other conversation unless policy explicitly allows |
| MEM-009 | Missing/unknown active scope | Retrieval fails closed and returns no scoped records |
| MEM-010 | Two conflicting values | Both retained or conflict surfaced; no silent overwrite |
| MEM-011 | Stale update timestamp | Optimistic update rejected; latest value preserved |
| MEM-012 | Local-only record with sync enabled globally | Record never enters sync payload |
| MEM-013 | Explicitly synced record | Only after per-record consent; payload excludes local-only rows |
| MEM-014 | Secret-like candidate | Not auto-confirmable; warning/rejection path |
| MEM-015 | Malformed/oversized JSON | Validation rejects; DB remains consistent |
| MEM-016 | Migration from empty DB | v1 schema created transactionally |
| MEM-017 | Interrupted/failed migration | Rollback; no silent DB deletion |
| MEM-018 | Newer schema version | Old app fails closed without destructive downgrade |
| MEM-019 | Source conversation deleted | User is asked keep/delete; no silent orphan |
| MEM-020 | Export | Only user initiated; disclosed destination; no secret/key in archive |
| MEM-021 | Logs/crash events | No memory value, excerpt, prompt, or key emitted |
| MEM-022 | Key unavailable / authentication cancelled | No plaintext fallback; no memory returned |
| MEM-023 | Corrupt DB / low storage | Safe error and recoverable state; chat history/RAG unaffected |
| MEM-024 | Existing chat and RAG regression | Existing history, RAG scope, citations and deletion behavior remain unchanged |
| MEM-025 | Offline CRUD | Create proposal, confirm, inspect, edit, delete work offline |
| MEM-026 | Cache invalidation | Deleted/rejected/expired records absent from already-built prompt context after next turn |
| MEM-027 | Android backup/restore | Local-only data follows documented exclusion/export policy; sync does not silently turn on |
| MEM-028 | Revoke sync consent | Future payload excludes record; deletion/revocation propagation behavior documented |

### Device acceptance on OPPO PGEM10
After CI and unit/integration tests pass, validate on the target device:
- cold start, process kill/relaunch, offline CRUD;
- app upgrade from previous installed schema;
- storage pressure during transaction and migration;
- Android backup/restore behavior;
- key availability after reboot, lock/unlock, credential changes;
- thermal/RAM impact during memory retrieval alongside local model;
- no ColorOS background restrictions cause partial writes or stale UI.
Do not claim any of these are complete until a recorded run has evidence.

## 7. Implementation sequence and gates

- **M1 — schema/repository:** create migration, typed repository, constraints and unit/integration tests. No model writes and no retrieval integration yet.
- **M2 — proposal/confirmation:** explicit user confirmation UI, source provenance, secret warnings.
- **M3 — management:** inspect/edit/delete/export, scope visibility and disable controls.
- **M4 — retrieval:** deterministic exact/normalized matching, hard scope filters, expiry, token budget and provenance citations.
- **M5 — resilience/security:** conflicts, backup/restore, optional sync controls, encryption implementation and threat-model verification.

Step 1 is not complete until all acceptance gates for M1–M4 pass and device validation is recorded. Encryption/sync gates must pass before making security claims or enabling sync. Only then begin Step 2 (scheduler).

## 8. Evidence status

- Based on the read-only Step 1 audit recorded in `JARVIS_STEP_1_MEMORY_AUDIT_2026-11-24.md`.
- This document is a design proposal, not proof that any schema/API/control exists.
- No production source files changed; no tests executed; no APK built; no PGEM10 device test performed.


## 9. OGAM repository compatibility review — 2026-11-24

Read-only comparison against the implementation branch `feature/jarvis-step-2-storage-privacy`:

- `package.json` and lockfile pin `@op-engineering/op-sqlite` to 15.2.5. Existing RAG/document stores open separate named SQLite files through `open({ name })` and use synchronous `executeSync`.
- `src/services/documents/store.ts` has a local transaction helper using `BEGIN`, `COMMIT`, and `ROLLBACK`. It creates tables/indexes on first open; it does not expose a shared schema migration framework.
- `src/services/rag/database.ts` performs additive ad-hoc migrations by inspecting `pragma_table_info` and applying `ALTER TABLE`; this is not a versioned migration runner.
- `package.json` includes `react-native-keychain` 10.0.0, but dependency presence alone does not prove that a memory encryption key is currently generated, wrapped, stored or used.
- `AndroidManifest.xml` currently sets `android:allowBackup="false"`. This is a useful baseline, but does not prove behavior for OEM device transfer, app reinstall, manual export or every Android backup path; validate on device.
- Current project already uses app-local SQLite files `rag.db` and `documents.db`. Keep Jarvis memory in a separate `jarvis_memory.db`; do not add its records to the document index or RAG sync.
- Existing code and config inspected do not establish SQLite JSON1 availability or the exact native SQLite compile options for the shipped Android binary.

### Required adjustments before M1

1. Do not include `CHECK(json_valid(value_json))` in the initial DDL until JSON1 is verified on the exact op-sqlite Android runtime. Parse and validate JSON in TypeScript first; add the DB CHECK only if runtime capability is demonstrated.
2. During M1, add a dedicated migration metadata table and transactional versioned migration for this database. Do not retrofit a global migration framework or modify existing databases.
3. Reuse the repository's established op-sqlite access pattern and transaction semantics, but put them in a dedicated memory database module. A failed migration must roll back and leave the old version intact.
4. Add a small runtime capability probe/test for `sqlite_version()`, JSON1, foreign keys and transaction rollback on the actual native SQLite driver. A Jest mock is not sufficient evidence.
5. Treat Keychain/Keystore encryption as a later security milestone. M1 stores no confirmed personal records yet and must not claim encryption. The manifest's backup-off setting should be preserved.
6. Existing database code does not show a shared migration abstraction. Keep M1 migration code local to memory service until a demonstrated need exists.

This review narrows the design to the OGAM codebase. It is still source-level evidence only: no native runtime probe, tests, APK build or device run was performed.
