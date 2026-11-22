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


## CI run 18 — first hard failure evidence (2026-11-22)

Run: https://github.com/sokfrut-tech/OGAM/actions/runs/45014987472
Head: `1c271e3b97d5d65b922732aa25d7fb5b6d004b25`

The run completed with failures; it is not a green validation and no APK/release gate is satisfied.

### Observed failures

- All eight Jest shards failed. The aggregate reported 89 failed suites, 1 skipped, 15 passed; 174 failed tests, 5 skipped, 92 passed (105 suites total).
- Representative Jest resolver errors: `Cannot find module '@offgrid/models'` from `src/services/modelManager/scan.ts`, `src/constants/models.ts`, and `src/utils/modelHelpers.ts`; and missing mapped source `../shared/packages/sync/src/index.ts` for `@offgrid/sync`.
- TypeScript reported TS2307 for `@offgrid/models`, `@offgrid/sync`, `@offgrid/pro/*`, and direct `../../pro/*` paths. This is consistent with missing shared and Pro source trees in the CI checkout; secondary implicit-any and interface-shape errors may be cascading from unresolved types and must be re-evaluated after dependencies are present.
- ESLint and actionlint passed. Native video helper tests passed.
- Type check, dependency-cruiser and knip failed. Knip also listed 34 unused exports and 6 unused exported types; these are a separate cleanup/audit category and should not be “fixed” by deleting public API blindly.

### Important interpretation

The job's “Set up the workspace” step reported success, but the subsequent Jest resolver could not find the exact shared paths configured in `jest.config.js`, and Pro source imports were unresolved. Therefore a green setup-step label does not prove that the private sibling repositories were actually checked out at the required paths. The next investigation must read the setup action logs and workflow inputs to establish whether the private-token gate skipped checkout or whether the checkout path/branch is wrong.

### Next actions

1. Inspect the CI job log around the shared/Pro checkout step and determine the actual checkout result, without asking the user for a token or changing secrets.
2. Confirm whether the repository's intended public/open-core workflow should run with shared packages at all; current tests and tsconfig still reference shared and Pro source, so silently skipping those sources is not a valid passing test strategy.
3. Separate genuinely open-core tests from private-package-dependent tests only after an explicit test inventory. Do not mask unresolved module errors with stubs.
4. Re-run CI only after the workspace checkout behavior is corrected or the test strategy is intentionally and transparently redesigned.

The PR remains draft and must not be merged. This run produced no successful APK evidence.


### CI checkout root cause — confirmed from job log

A follow-up inspection of run 18's actual job log resolves the earlier uncertainty:

- The composite setup action was invoked with `workspace: true` and `shared: true`, but its internal “Pick the pro and shared branches”, “Check out pro”, “Check out the shared monorepo”, “Put shared beside this checkout”, “Restore the built shared packages”, and “Build shared” steps were all explicitly marked `skipped`.
- The node_modules cache restore succeeded, so “Set up the workspace” was marked successful even though the required sibling source trees were not present. The dependency install step was also skipped because the cached node_modules was reused.
- This directly explains the Jest missing-module errors and TypeScript TS2307 errors. The CI is therefore exercising neither a complete private-workspace checkout nor a valid standalone open-core test mode.

This is a confirmed control-flow issue, not a guessed package API issue. Do not ask the user to create or share a token for the upstream organization's private repositories: the chosen product direction is to make OGAM self-contained. Next work should define a transparent migration/test boundary that can run from OGAM alone, while preserving real free-core features and not pretending Pro-dependent suites ran.


## `@offgrid/models` consumer map — first source-backed pass (2026-11-22)

Scope: inspected the OGAM feature-branch source tree at `2b5eb43336be056fb6e3ad3ab58f27aed9c2c02b`, plus the package manifest and Metro resolver. This is a consumer-side contract inventory, not a replacement implementation. The upstream package source remains unavailable through the connected GitHub access, so signatures and edge cases not demonstrated by consumers remain explicitly unresolved.

### Confirmed runtime imports and observable responsibilities

| Consumer | Imported API | Responsibility / classification |
|---|---|---|
| `src/constants/models.ts` | `CATALOG`, `ModelEntry`, `MobileTextCatalogModel` | **Runtime critical.** Filters catalog entries by kind/availability/grounder/quantOf/supersededBy, llama.cpp engine compatibility and primary file size; maps records to the mobile curated-model shape; registers the bundled fallback catalog. The consumer proves fields used: `kind`, `availability`, `grounder`, `quantOf`, `supersededBy`, `files[].role`, `files[].sizeBytes`, `minRamGb`, `params`, `description`, `org`, `id`, `name`, `isNew`, `activeParams`, `nonCommercial`. |
| `src/screens/ModelsScreen/useTextModels.ts` | `CATALOG`, `MobileTextCatalogModel` | **Runtime critical.** Uses catalog as base for remote-merged model discovery, filtering, search, mapping to UI details, and recommended-model detail retrieval. |
| `src/utils/recommendedModels.ts` | `MobileTextCatalogModel` | **Type contract.** Device RAM filtering and trending selection consume `id`, `minRam`, optional `maxRam`; runtime data shape is shared with the mobile catalog mapping. |
| `src/services/modelManager/scan.ts` | `isCompanionFile`, `splitGgufPartNames` | **Runtime critical.** Excludes companion/projector files and later split-GGUF parts from being registered as independent models. |
| `src/services/modelManager/index.ts` | `splitGgufPartNames` | **Runtime critical.** Removes all numbered GGUF split parts when deleting a model. |
| `src/services/modelScannerService.ts` | `splitGgufPartNames` | **Runtime critical.** Detects whether all parts of a split GGUF are present in a user-selected SAF folder before marking it installable. |
| `src/services/modelCardReasoning.ts` | `modelCardUrl`, `modelCardDeniesReasoning` | **Runtime critical.** Builds a revision-aware Hugging Face model-card URL and determines whether its text explicitly denies reasoning; result is persisted on the downloaded model. |
| `src/services/modelCatalogFiles.ts` | `prefersQ4_0` | **Runtime critical.** Chooses preferred quantization order based on platform and inference backend; current mobile behavior falls back to Q4_K_M. |
| `src/utils/modelHelpers.ts` | `CATALOG` | **Runtime critical.** Looks up video model display names by `kind === 'video'` and exact model ID, preserving a caller fallback. |
| `src/services/modelDownloadService/types.ts` | `ModelEntry` (type-only, inline import) | **Type contract / video-download boundary.** Video download requests carry a full catalog model entry. |

### Other confirmed consumer requirements

- `metro.config.js` resolves `@offgrid/models` directly to `../shared/packages/models/dist/index.js` and watches the external package directory. The manifest declares `file:../shared/packages/models`; this is not a registry package dependency.
- The shared catalog is a bundled offline fallback and is merged with a remote catalog. An offline-only implementation must preserve the bundled catalog path and must not make model discovery depend on a network request.
- Catalog entries are used across text, vision and video. The mobile text recommendation list is only a filtered projection; it is not a complete substitute for the full catalog.
- GGUF split handling and companion-file classification affect inventory correctness and deletion safety. These functions must be tested against real multi-part naming conventions and projector/companion edge cases.
- Model-card reasoning is deliberately fail-open to the existing template decision when the card is unavailable; the port must preserve that unknown state rather than treating network failure as “non-reasoning”.

### API surface proven by call sites

The following exports are directly evidenced by source imports: `CATALOG`, `isCompanionFile`, `splitGgufPartNames`, `modelCardUrl`, `modelCardDeniesReasoning`, `prefersQ4_0`, plus the types `ModelEntry` and `MobileTextCatalogModel`.

This does **not** yet prove the complete public export surface, the full field schema, catalog update format, validation rules, aliases, or behavior for malformed entries. Do not implement a substitute package until those are recovered from an accessible licensed source or independently specified and covered by tests.

### Next migration sequence

1. Recover the full `ModelEntry` and `MobileTextCatalogModel` shapes from additional local consumer usage, fixtures and test expectations; inventory all catalog field reads and writes.
2. Establish exact GGUF split/companion naming behavior from OGAM tests and documented upstream formats; build a compatibility test matrix before porting either helper.
3. Recover the model-card parsing rule and preferred-quant policy from consumer tests and app behavior.
4. Inventory the complete catalog data (including text, vision, video, embeddings, image and speech kinds) and its license/provenance. Do not fabricate a smaller catalog and label it equivalent.
5. Implement a first-party package only after the contract, data provenance and test fixtures are sufficient. Keep package imports and Metro/Jest/TypeScript resolution consistent; do not add a stub or silently bypass functionality.

### Current classification

- **Runtime critical:** catalog data and filtering; GGUF split/companion helpers; model-card URL and reasoning parser; platform/backend quant preference; video display-name lookup.
- **Tests/tooling:** test fixtures and mocks still need a dedicated pass; this first pass did not claim a complete import census of every test file.
- **Pro-only:** none of the confirmed imports above is directly imported from a Pro source file in this pass. Pro-only consumers must be classified separately after the Pro boundary is mapped.
- **Unresolved:** complete catalog schema and contents, all exported APIs, exact parser and naming edge cases, update/versioning contract, licensing and attribution of catalog metadata.

