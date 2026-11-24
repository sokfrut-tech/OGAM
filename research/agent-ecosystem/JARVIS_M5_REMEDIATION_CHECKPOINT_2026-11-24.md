# Jarvis M5 Remediation Checkpoint — 2026-11-24

## Scope
Separate remediation branch based on `feature/jarvis-step-1-memory-m3-m4-2026-11-24`.
No changes to the default branch, PR #7, or PR #8. No merge, deployment, release, secrets, PC/local actions, or device actions.

## Changes made
1. `src/services/jarvisMemory/managementService.ts`
   - `updateWithCheckpoint` and `deleteWithCheckpoint` now create the undo checkpoint before the data mutation inside a SQLite SAVEPOINT.
   - If checkpoint persistence or the mutation fails, the method rolls back the savepoint and rethrows the original error.
   - Delete returning false also rolls back the unused checkpoint.
2. `src/services/jarvisMemory/secretGuard.ts`
   - Replaced recursive traversal with an iterative bounded traversal.
   - Maximum inspected depth remains 8; maximum visited nodes is 10,000.
   - Exceeding either limit emits a safe `inspection_limit` finding and blocks the candidate; raw values are not included in findings.
3. `src/services/jarvisMemory/types.ts`
   - Added `inspection_limit` to `SecretRiskCategory`.
4. `__tests__/unit/services/jarvisMemory/secretGuard.test.ts`
   - Added exact depth-boundary, over-depth, and over-node-budget tests.
5. `.ci/run-jarvis-memory-m3-m4.sh`
   - Added real SQLite fault-injection checks: trigger an undo-checkpoint insert failure and assert that both update and delete leave the original record intact.
6. `.github/workflows/jarvis-memory-m3-m4-focused.yml`
   - Added this remediation branch to the push trigger.

## Git evidence
Branch: `fix/jarvis-m5-undo-secret-guard-2026-11-24`

Commits:
- `9f9dee1d273fb4adf47f4b8c1d62df59aadda608` — atomic checkpoint/mutation savepoints
- `f99b98de5beefc7a9df3bec95350b4c7bcdae987` — fail-closed bounded secret scan
- `49fcf205254ecce150c734c84e048f780d12bdc8` — inspection-limit category
- `68fa7b5d83b6a813d4c34daf8ffa36590e7a2289` — scanner boundary/budget tests
- `876479eb370b1a99e79624fe6061714f3684bd9c` — SQLite checkpoint failure injection
- `1052bc91c7dd394978bcea71b4f404ace1e8e19c` — focused workflow branch trigger
- `0c1c65708a68fe9ec333f5e94b714d6b390f5ca5` — exact depth boundary correction

## Verification state
- GitHub read-back confirmed the changed source and test files exist on the remediation branch.
- GitHub commit status currently returns no statuses.
- No workflow run is currently returned for the latest commit; TypeScript/Jest/SQLite CI is therefore **not yet verified**.
- No Android APK rebuild or physical OPPO re-test has been performed.
- No independent review of the remediation diff has been completed.

## Remaining gates before M5 can pass
1. Obtain a fresh successful focused workflow run (strict TypeScript, all focused Jest suites, real SQLite integration including the injected checkpoint failures).
2. Inspect the complete diff and test results independently.
3. Review transaction behavior under concurrent calls on the shared SQLite connection; the current savepoint wraps an awaited repository operation and this concurrency case is not covered by the new fault-injection checks.
4. Run native Android probe and dependency/security audit on the remediation head.
5. Repeat relevant physical OPPO checks only after a new verified APK is available.

## Status
**M5 remains PARTIAL / remediation implemented but not verified.** Do not merge this branch or promote Planner + TaskLedger work as unblocked until the gates above are satisfied.
