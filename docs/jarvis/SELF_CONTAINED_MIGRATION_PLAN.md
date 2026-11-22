# OGAM — self-contained fork migration plan

Status: inventory confirmed on `feature/jarvis-step-2-storage-privacy`. No private source has been copied and no dependency has been replaced with a stub.

## Goal

Make `sokfrut-tech/OGAM` build and test from its own checkout, without credentials or runtime/build-time source checkouts from `off-grid-ai`.

## Confirmed external source dependencies

1. Git submodule `pro`
   - `.gitmodules` points to `https://github.com/off-grid-ai/mobile-pro.git`.
   - The current submodule gitlink points to commit `cae82b3df1ec751205359c351beb18b953404251`.
   - The repository API identifies this path as a submodule, not a normal directory.
2. Sibling workspace `../shared`
   - `package.json` declares nine local file dependencies:
     - `@offgrid/design`
     - `@offgrid/models`
     - `@offgrid/notes`
     - `@offgrid/notes-editor`
     - `@offgrid/rag`
     - `@offgrid/speech`
     - `@offgrid/sync`
     - `@offgrid/ui`
     - `@offgrid/writing`
   - `.github/actions/setup-mobile/action.yml` checks out `off-grid-ai/shared` beside the OGAM workspace and builds these packages.
3. Android APK workflow
   - `.github/workflows/build-android-apk.yml` currently requires `PRO_SUBMODULE_PAT` and passes it to the shared setup action.
   - This secret requirement is a consequence of the two external source dependencies above, not a desired permanent OGAM configuration.

## Public fork research (2026-11-22)

Inspected two public forks rather than assuming how other developers solved unavailable private repositories.

### `wednesday-solutions/off-grid-mobile-ai`

- Public fork, created 2026-03-17; repository metadata reports its last push on 2026-03-17.
- Its `package.json` is version `0.0.81`.
- The inspected tree has no `.gitmodules` and no `pro` directory.
- Its package manifest does not declare the newer `@offgrid/*` sibling-workspace dependencies.
- This is a useful example of a standalone earlier open-core snapshot, but it does **not** prove that the maintainer removed current private dependencies: it predates the newer Pro/shared split and is not current parity with this OGAM branch.
- Potential use: compare its self-contained open-core implementation and tests for features that remain relevant. Do not replace our current branch wholesale with this old snapshot.

### `cristiannegru/off-grid-mobile-ai`

- Public fork of OGAM; current inspected tree contains `pro` as a submodule pinned to `ff0d874`.
- Its `.gitmodules` still points `pro` to `https://github.com/off-grid-ai/mobile-pro.git`; it has not made Pro self-contained.
- Its `package.json` still declares sibling `../shared` dependencies (including application, models, rag, speech, sync and ui).
- Its CI workflow documents a fork mode: when `PRO_SUBMODULE_PAT` is absent, private-source checkout steps are skipped and Pro-dependent test suites are skipped in favor of the open-core suite. When the secret is present, CI checks out matching Pro/shared branches with main fallback.
- This is a practical CI workaround for contributors without private-source access, **not** a full dependency migration. It does not satisfy OGAM's goal of a clean self-contained checkout.

### Research conclusion

There are two distinct approaches visible in public forks:

1. Earlier standalone core snapshot: omit Pro and newer shared-workspace integration; retain only features whose source is actually present in the fork.
2. Contributor CI fallback: conditionally skip private Pro/shared integration and run open-core checks; useful temporarily, but does not make the project independent.

For our stated goal, use the first approach as architectural evidence and the second only as a temporary test strategy. The target remains a real, fully tested OGAM-owned implementation with no private checkout token. Do not claim full independence while Pro or shared code is absent.

## Access finding

The connected GitHub integration can read `sokfrut-tech/OGAM`, but requests for `off-grid-ai/mobile-pro` and `off-grid-ai/shared` return 404. Their source contents therefore have not been inspected or copied. Do not create empty placeholder directories, fake packages, or no-op Pro implementations to make CI appear green.

## Migration sequence

1. Obtain legitimate source exports or authorized repository transfers for the exact pinned Pro submodule commit and the shared revision used by this OGAM branch.
2. Vendor the required source into OGAM-owned paths (for example `vendor/pro` and `packages/shared/*`) while preserving license notices, attribution, and any distribution restrictions. If redistribution is not permitted, replace each dependency with an independently implemented OGAM-owned equivalent rather than copying restricted source.
3. Rewrite all `file:../shared/...` package references, TypeScript/Jest/Metro aliases, scripts, Gradle hooks, and CI setup to use the in-repository paths.
4. Remove the `pro` git submodule and its gitlink only after all imports, tests, build scripts, and runtime entry points have been migrated.
5. Remove the private checkout/token logic from `.github/actions/setup-mobile/action.yml` and the `PRO_SUBMODULE_PAT` gate from the APK workflow.
6. Run dependency install from a clean checkout, then TypeScript, ESLint, Jest, dependency-cruiser/knip, actionlint, Android unit tests, and arm64 debug APK build.
7. Search the entire repository and CI configuration for `off-grid-ai/`, `PRO_SUBMODULE_PAT`, `../shared`, and `git submodule`; require zero build-time references before calling OGAM self-contained.

## Safety and release gates

- Keep PR #1 as draft; do not merge to unblock manual workflow dispatch.
- Do not publish a build until the APK is built from a clean OGAM-only checkout and the artifact checksum is recorded.
- Audit the licenses and redistribution rights for Pro, shared packages, and bundled native/QNN assets before distributing the resulting APK.
- A successful build must exercise real functionality; stubs or skipped suites do not count as migration completion.

## Current blockers

- Authorized source material for the pinned Pro commit and the shared workspace revision is not available through the current GitHub connection.
- The exact shared commit/ref used by the existing setup action is selected dynamically from the matching branch or its base branch; it must be recorded before copying so the migration is reproducible.


## Follow-up dependency audit (2026-11-22, current PR head)

The current PR head is `f2a5ef6f8b796567a982914be93cb8846d13e5e0` (PR #1 remains open/draft).

### What the current open-core wiring already does

- `pro/` is detected by checking for `pro/package.json`. If absent, Metro and Jest route `@offgrid/pro` to `src/bootstrap/proStub.js`.
- Jest skips the enumerated Pro-dependent suites only when the Pro submodule is absent. This is an explicit reduced open-core test mode, not a full Pro migration.
- `tsconfig.json` excludes `pro/**` and a list of tests that import Pro paths.
- The CI composite action conditionally checks out both private repositories only when its `private-token` input is non-empty. The CI workflow passes an empty token on workflow_dispatch and passes `secrets.PRO_SUBMODULE_PAT` for PR/push events.
- The manual APK workflow still hard-fails when `PRO_SUBMODULE_PAT` is empty.

### Why shared remains a hard build dependency

- The lockfile records all nine `@offgrid/*` packages as npm link dependencies whose resolved paths are `../shared/packages/<package>`. A clean OGAM-only checkout therefore does not contain the package targets required by `npm ci`.
- `metro.config.js` resolves and watches shared package directories outside the repository, including design, models, notes, notes-editor, rag, speech, sync, ui and writing; it also expects shared's root `node_modules`.
- `jest.config.js` maps source imports for design, sync (including adapters), writing and notes directly into `../shared/packages/.../src`.
- The setup action moves the private shared checkout to `../shared`, installs its workspace, builds the packages and caches its dependencies/dist output.
- This confirms that simply omitting the shared checkout or adding a Pro-style stub would break dependency installation, Metro resolution and at least part of Jest. No such workaround has been applied.

### CI evidence

- PR head workflow run `45014455066` (CI run 16) was reported as `pending` when checked. The jobs endpoint had not populated jobs yet, so there is no new pass/fail evidence to report.
- Earlier failure evidence remains applicable: missing private workspace checkout caused module/type-resolution failures. It is not proof that the changed application code itself is defective, but it also is not a successful validation.

### Revised next implementation sequence

1. Build a complete source-level consumer map for each of the nine shared packages and every `@offgrid/pro` entry point, including app bootstrap, runtime registration, native integration, tests and build scripts. The Git tree and configuration prove the package-level wiring, but the connected source-search index returned no matching code hits; do not treat that as evidence that imports are absent.
2. For each shared package, classify its API surface as (a) essential to free app runtime, (b) optional feature, (c) Pro-only, or (d) build/test tooling. Record exact importers and tests before moving anything.
3. Prefer a first-party in-repository package move only where source and redistribution rights are confirmed. Otherwise specify an independent implementation with behavior-level tests; do not copy private code or fabricate compatibility stubs.
4. Only after the map exists, create a dedicated migration branch/slice for one package at a time. Keep the existing PR draft and avoid broad dependency or lockfile edits until the first vertical slice can be installed and tested in a clean checkout.

### Current conclusion

The Pro fallback is already partially implemented for open-core CI. The remaining autonomy blocker is materially larger than one missing checkout: nine sibling packages are encoded as required npm links and referenced by Metro/Jest. The next safe action is a source-level consumer map, not changing CI to skip shared.


## Source-level consumer audit — first verified vertical slices (2026-11-22)

The following source files were opened directly from the current branch. This is a verified initial consumer map, not yet an exhaustive repository-wide import inventory.

| Package / boundary | Verified source consumer | Role and migration implication |
|---|---|---|
| `@offgrid/sync` | `src/services/sync/engine.ts` | Core peer-sync engine and React Native TCP adapter imports (`@offgrid/sync`, `/rn`). It is not safe to remove as a Pro-only dependency. |
| `@offgrid/sync` | `src/services/proLicenseService.ts` | Pro entitlement/seat lifecycle also uses sync contracts. This creates a mixed free-core / Pro consumer boundary that must be separated deliberately. |
| `@offgrid/rag/documents` | `src/services/rag/index.ts`, `src/services/documents/index.ts`, `src/services/documents/models.ts` | Shared document ingest/retrieval contracts and services are used by project knowledge base and chat attachments. Core feature, not a harmless optional dependency. |
| `@offgrid/speech` | `src/services/voiceSession.ts` | Owns voice-turn state/decision machine shared with desktop. Mobile voice path depends on it. |
| `@offgrid/pro` | `src/bootstrap/loadProFeatures.ts` | Loaded dynamically; absent package returns false. Free build can skip Pro activation via existing null stub. |
| `@offgrid/pro` | `metro.config.js`, `jest.config.js` | Explicit Metro/Jest fallback mapping exists when Pro submodule is not populated. |
| `@offgrid/design` | `jest.config.js`, `metro.config.js` | Shared design-token package is wired into runtime and tests. Direct app import inventory remains to be confirmed. |
| `@offgrid/models` | `metro.config.js` | Shared model contracts package is wired into Metro. Direct source import inventory remains to be confirmed. |
| `@offgrid/ui` | `metro.config.js` | Shared UI package is wired into Metro. Direct source import inventory remains to be confirmed. |
| `@offgrid/writing` | `metro.config.js`, `jest.config.js` | Scribe engine is explicitly loaded from shared package; runtime usage must be located before replacement. |
| `@offgrid/notes` | `metro.config.js`, `jest.config.js` | Notes link/history rules wired into runtime/test resolver; source consumer inventory remains to be confirmed. |
| `@offgrid/notes-editor` | `metro.config.js` | Notes WebView HTML bundle is a runtime mapping; source consumer must be located. |
| `@offgrid/automation` | `metro.config.js` | Additional shared package discovered in Metro configuration, beyond the original nine root dependencies. Confirm whether it is a transitive package of sync or a direct dependency before planning extraction. |

### Architectural findings

- `src/services/rag/index.ts` explicitly delegates file reading, indexing, search and citations to the shared document engine; the local `rag.db` stores project membership and sync identity only. Replacing the package with a null module would silently remove a major feature.
- `src/services/sync/engine.ts` constructs the mobile sync engine from the shared platform-neutral engine and RN TCP transport. A proper migration must preserve the portable engine API and separately implement/test the RN adapter.
- `src/services/voiceSession.ts` delegates voice-turn decisions to `@offgrid/speech`; it is a reusable state-machine boundary and should be preserved behaviorally.
- `src/bootstrap/loadProFeatures.ts` confirms Pro activation is dynamic and already safely optional for the free build. Pro licensing still has a cross-boundary dependency on `@offgrid/sync`, so removing Pro requires retaining or separating the sync contract used by entitlement handling.
- The Metro config's package list is not identical to the root `package.json` local-dependency list: it also references `@offgrid/automation`. This must be reconciled against shared package manifests and transitive dependencies.

### Audit limitation and next step

The connected GitHub code-search index returned no matches for these exact scoped package names, so absence of search results is not evidence of absence of imports. A complete import map still requires a repository-wide source scan. Do not start deleting or stubbing packages on the basis of this partial map. Next inspect the complete shared package manifests and each verified consumer's call surface, then migrate the highest-value vertical slice (likely the document engine or sync core) only after its public API and tests are understood.
