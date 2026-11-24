# Independent Review — Jarvis M5 Remediation — 2026-11-24

## Review target
Branch: `fix/jarvis-m5-undo-secret-guard-2026-11-24`
Reviewed against its M1-M4 parent branch. Read-only review; no merge or deployment.

## Confirmed improvements
- Undo checkpoint insertion now precedes update/delete, and both are wrapped in a SQLite SAVEPOINT.
- Checkpoint-write failure should roll back the enclosing savepoint.
- Secret scanner uses iterative traversal with explicit depth/node budgets.
- Exceeding either budget adds `inspection_limit`; assessment is blocked rather than silently accepted.
- Added focused tests for scan boundary, scan budget, and checkpoint insert fault injection.

## Blocking review finding: SAVEPOINT spans an asynchronous call
In `managementService.ts`, both new methods open a SAVEPOINT, then `await` repository methods before releasing it:
- `updateWithCheckpoint` awaits `jarvisMemoryRepository.updateRecord`.
- `deleteWithCheckpoint` awaits `jarvisMemoryRepository.deleteRecord`.

The repository methods themselves await database readiness and/or reads. The database wrapper exposes one shared SQLite handle. While the SAVEPOINT is open, another async memory operation may run on the same connection and its SQL may become part of the open savepoint. This can cause unrelated writes to be rolled back if the checkpointed operation fails, or included in its transaction boundary if it succeeds. This interleaving has not been tested and cannot be ruled out by the current tests.

**Required fix before acceptance:** make the checkpoint + mutation section non-yielding on the shared connection (e.g. add synchronous, already-ready repository mutation methods and call them without `await` inside the savepoint), or introduce a database-wide transaction/connection mutex that every operation using this connection honors. A lock used only by these two management methods is insufficient.

## Verification gaps
- No successful CI run has been observed for the remediation head. The commit-status endpoint returned no statuses; the available commit-workflow wrapper only reports pull-request-triggered runs and returned none. Therefore CI state remains UNKNOWN, not failed and not passed.
- The new fault-injection integration test is present, but has not executed in a verified workflow run.
- Native Android probe, dependency audit, APK rebuild, and physical OPPO re-test are still outstanding for this remediation head.
- Full independent review of the changed files is limited to source read-back; no executable local test environment was run.

## Decision
**M5 = PARTIAL / NOT ACCEPTED.** Do not merge this branch or mark Planner + TaskLedger unblocked until the asynchronous shared-connection transaction interleaving is fixed and CI/native/security verification is green.
