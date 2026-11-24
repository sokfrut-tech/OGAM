# Jarvis M5 Security & Resilience Audit — 2026-11-24

## Scope and method
Read-only review of the M1–M4 memory implementation on `feature/jarvis-step-1-memory-m3-m4-2026-11-24` (PR #8 head at time of review), including:
- `src/services/jarvisMemory/secretGuard.ts`
- `repository.ts`, `managementService.ts`, `retrievalService.ts`
- `database.ts`, `schema.ts`, `confirmationController.ts`
- focused M3/M4 and secret-guard tests.

No source, tests, workflow, PR, or runtime state was modified. No merge, deployment, secret access, PC/local work, or device action was performed.

## Verdict
**M5: PARTIAL — not ready to declare security/resilience gates passed.**
The reviewed implementation has useful safeguards (local-only sync policy, explicit confirmation action, scope-filtered retrieval, expiry checks, redacted secret findings, SQLite savepoints for deletion/undo, opt-in unencrypted export warning). However, two concrete hardening gaps were identified and several M5 scenarios remain unverified.

## Findings

### M5-01 — Undo checkpoint is written after the destructive mutation
- Severity: **Medium**; confidence: **High**.
- Location: `managementService.ts`, `updateWithCheckpoint()` and `deleteWithCheckpoint()`.
- Evidence: both methods call `repository.updateRecord()` / `repository.deleteRecord()` first, then call `saveCheckpoint()`. The checkpoint insert is not in the same SQLite transaction/savepoint as the mutation.
- Consequence: if checkpoint serialization/insert/storage fails after the update or delete succeeds, the data change has already happened but no undo checkpoint exists. This violates the intended reliable one-step undo guarantee under storage pressure or database errors.
- Smallest remediation direction: place snapshot insert + guarded mutation in one SQLite transaction/savepoint, and roll back both if either operation fails. Add fault-injection tests for checkpoint insert failure.

### M5-02 — Secret scanner silently stops traversing deeply nested values
- Severity: **Medium**; confidence: **High**.
- Location: `secretGuard.ts`, `scanValueRecursive()`.
- Evidence: recursion returns immediately when `depth > 8`; it does not report truncation or fail closed. A secret field/token placed deeper than that boundary is not inspected by this traversal.
- Consequence: a deeply nested credential may pass proposal/update screening and be persisted; export screening uses the same scanner and can miss it too.
- Smallest remediation direction: reject or explicitly flag values exceeding the inspection depth/node budget, or replace recursion with bounded iterative traversal that fails closed when limits are exceeded. Add nested-secret tests just beyond and at the boundary.

## Controls observed in source
- Secret scan occurs before proposal persistence and before repository updates; findings carry labels/field paths rather than raw values.
- Confirmation requires the explicit `userAction: 'explicit_confirm'` discriminator.
- Retrieval queries only confirmed, unexpired rows from explicitly requested global/project/conversation scopes; disabled memory returns an empty prompt block.
- SQLite schema constrains scopes/status/approval timestamps and records deletion tombstones without storing the deleted value.
- Export requires `userInitiated: true`, labels output `encrypted: false`, warns users, and re-screens candidate records.

## Remaining M5 evidence gaps
These are **not established as passing** by the inspected source and existing focused test summaries:
1. Fault-injection / crash recovery around mutation + undo checkpoint and database initialization/rollback.
2. Secret-scanner adversarial boundary coverage (deep nesting, large object/node budgets, Unicode/confusable credential labels, token variants, malformed values).
3. Retrieval prompt-injection boundary: retrieved memory is labeled “data only, never system instructions” in the text block, but the actual downstream LLM message-role/quoting boundary was outside this review target and remains unverified.
4. Source-conversation deletion semantics and concurrent/repeated deletion behavior under failure.
5. Export destination handling and user-visible confirmation/retention behavior on Android; export is explicitly unencrypted.
6. Device process death/restart, low-storage, database corruption, and interrupted migration behavior on physical OPPO.
7. No fresh full CI rerun was started during this read-only review; previously reported green CI/emulator results remain historical evidence, not new audit execution.

## Next safe sequence
1. Fix M5-01 and M5-02 in a separately authorized implementation change, with focused failure-injection tests.
2. Add explicit M5 negative/security tests and verify prompt-role isolation at the real LLM call boundary.
3. Re-run focused suites, Android native probe, dependency/security audit, then repeat selected physical OPPO checks.
4. Only after independent review should Planner + TaskLedger implementation begin. Keep PRs #7 and #8 open/draft until the user explicitly authorizes any merge.

## User-reported physical validation carried forward
The user reports the M3+M4 probe APK launches on OPPO, all self-tests are green, all tabs respond, edit/undo and delete/undo work, and M4 displays retrieved memory with source and project/dialog scope. These are user-reported device checks, not independent verification of the M5 gaps above.
