# Jarvis M5 Remediation Checkpoint — 2026-11-25

## Scope
Separate remediation branch based on `feature/jarvis-step-1-memory-m3-m4-2026-11-24`.
Branch: `fix/jarvis-m5-undo-secret-guard-2026-11-24`.
No changes to the default branch, PRs, production deployment, or release. No merge was performed.

## Changes made
1. `src/services/jarvisMemory/managementService.ts`
   - `updateWithCheckpoint` and `deleteWithCheckpoint` create the undo checkpoint before the data mutation inside a SQLite SAVEPOINT.
   - Failure rolls back the savepoint; a delete returning false also rolls back its unused checkpoint.
   - Latest concurrency correction uses synchronous repository mutation methods inside the SAVEPOINT; there is no `await` between opening and releasing the outer SAVEPOINT.
2. `src/services/jarvisMemory/repository.ts`
   - Added ready-only `updateRecordSync` and `deleteRecordSync` methods for transaction-safe synchronous mutations.
   - Existing async public methods await database readiness and delegate to those synchronous methods.
   - Delete keeps its tombstone/provenance work inside a nested savepoint.
3. `src/services/jarvisMemory/secretGuard.ts`
   - Iterative bounded traversal: maximum depth 8 and maximum 10,000 visited nodes.
   - Exceeding either bound emits an `inspection_limit` finding and fails closed; raw candidate values are not included in findings.
4. `src/services/jarvisMemory/types.ts`
   - Added `inspection_limit` to `SecretRiskCategory`.
5. `__tests__/unit/services/jarvisMemory/secretGuard.test.ts`
   - Exact depth boundary, over-depth, and over-node-budget tests.
6. `.ci/run-jarvis-memory-m3-m4.sh`
   - Real SQLite fault injection forces checkpoint insertion failure and asserts update/delete leave the original record unchanged.
7. Workflows now trigger focused validation and native Android probe on this remediation branch.

## Git evidence
Commits on this branch include:
- `9f9dee1d273fb4adf47f4b8c1d62df59aadda608` — atomic checkpoint/mutation savepoints
- `f99b98de5beefc7a9df3bec95350b4c7bcdae987` — fail-closed bounded secret scan
- `49fcf205254ecce150c734c84e048f780d12bdc8` — inspection-limit category
- `68fa7b5d83b6a813d4c34daf8ffa36590e7a2289` — scanner boundary/budget tests
- `876479eb370b1a99e79624fe6061714f3684bd9c` — SQLite checkpoint failure injection
- `1052bc91c7dd394978bcea71b4f404ace1e8e19c` — focused workflow branch trigger
- `0c1c65708a68fe9ec333f5e94b714d6b390f5ca5` — exact depth boundary correction
- `9dd519e80c0872c5b6ca74842126a640d389f878` — independent review report
- `e49538c86e1c2f0c4e27613c77e54c6f62c73c82` — synchronous repository mutations
- `dad7a0c35fb5f7403edda2876c2eccf0e3d9fe7c` — synchronous checkpoint transaction calls
- `2efa69acd019a37260741b66fac97db2405cb708` — native probe branch trigger

Independent review report:
`research/agent-ecosystem/JARVIS_M5_REMEDIATION_INDEPENDENT_REVIEW_2026-11-24.md`

## Verification evidence (GitHub Actions)
All listed runs completed with conclusion SUCCESS on head commit `2efa69acd019a37260741b66fac97db2405cb708`:
- Focused TypeScript/Jest/real SQLite validation #45483434482:
  https://github.com/sokfrut-tech/OGAM/actions/runs/45483434482
- Native OP-SQLite Android probe #45483434493:
  https://github.com/sokfrut-tech/OGAM/actions/runs/45483434493
  - Type-check, OP-SQLite Android autolinking, ARM64 and x86_64 release APK builds, APK checksum verification, emulator launch/diagnostics, and artifact upload all completed successfully.
  - Artifact: `Jarvis-M3-M4-OPSQLite-Native-Probe-APK`, 14,912,563 bytes; SHA-256 digest reported by GitHub artifact API: `6a9859d171aa8c95389dd053d0d4f2681247798863bdad18717220c06bce1402`.
  - Artifact expires 2026-12-08 21:01:48 UTC.
- Earlier focused run #45483207417 also SUCCESS:
  https://github.com/sokfrut-tech/OGAM/actions/runs/45483207417

## Latest verification on exact remediation head `9950b1eda558178e157bc3dcb0feba3c066ca2f8`

All three automated workflows completed with conclusion SUCCESS:
- External dependency audit #45544544419:
  https://github.com/sokfrut-tech/OGAM/actions/runs/45544544419
- Focused M1-M4 TypeScript/Jest/SQLite validation #45544544421:
  https://github.com/sokfrut-tech/OGAM/actions/runs/45544544421
- Native OP-SQLite Android probe #45544544635:
  https://github.com/sokfrut-tech/OGAM/actions/runs/45544544635
  - ARM64 and x86_64 release APK build, checksum verification, Android emulator launch/diagnostics, and artifact upload all completed successfully.
  - Artifact: `Jarvis-M3-M4-OPSQLite-Native-Probe-APK`, 14,933,047 bytes; GitHub artifact API digest: `sha256:2f82a6a8580178fb5e321c9dc20015272e8e8b443ff8d927606758c5ef2073b4`.
  - Artifact ID: `14991683127`; expires 2026-12-09 04:26:56 UTC.
  - Artifact download page: https://github.com/sokfrut-tech/OGAM/actions/runs/45544544635

## Remaining gates
1. Physical OPPO validation of a newly built APK is still pending. The native probe is an isolated M3+M4 probe APK, not the full Jarvis app.
2. Automated dependency/security audit on exact remediation head passed (#45544544419); independent physical-device validation remains pending.
3. Do not treat CI/emulator success as proof of real-device UI responsiveness or production readiness.
4. No merge, release, or promotion to default branch has been performed.

## Status
**M5 remediation has passed the focused CI, dependency audit, and isolated native Android probe on head 9950b1e, but remains PARTIAL pending physical OPPO device validation.** Planner + TaskLedger implementation remains gated until those checks are completed.
