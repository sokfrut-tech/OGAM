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



## `@offgrid/models` — test-backed behavioral contract (2026-11-22)

A second pass inspected focused OGAM tests. These tests provide useful behavioral evidence, but they do not recover the private package's full source or catalog.

### Behaviors explicitly pinned by tests

- **Mobile curated recommendations:** `recommendedModelsForDevice` includes models only when `minRam <= deviceRam` and `maxRam` is absent or `deviceRam <= maxRam`; preserves editorial order. The trending selector chooses at most one best-fit member per family using the lowest `ramFitScore`. Evidence: `__tests__/unit/utils/recommendedModels.test.ts`.
- **Quantization order:** Android CPU/NPU prefers Q4_0, then Q4_K_M; Android GPU and iOS prefer Q4_K_M; when Q4_0 is absent, Q4_K_M remains first. The UI test verifies both the Recommended card and the first item in All files. Evidence: `__tests__/integration/models/preferredQuantOrder.rendered.test.tsx`.
- **Vision projector matching:** a model must only use its matching model-family projector; quantization may differ; unrelated projectors must be rejected even if they share a quant suffix. A missing correct projector returns undefined, never an unrelated fallback. Evidence: `__tests__/integration/models/mmProjMatchesModel.test.ts`. This behavior is currently implemented in OGAM's own `src/services/mmproj.ts`, not attributed to `@offgrid/models`.
- **Projector download hydration:** `*-projector.gguf` and `*-clip.gguf` sidecars must not appear as standalone downloads. Evidence: `__tests__/integration/models/mmProjHydrationClassify.test.ts`.
- **Catalog display names:** video display names are looked up by exact catalog ID and kind, with caller fallback (consumer code in `src/utils/modelHelpers.ts`; dedicated test path is `__tests__/integration/models/catalogGgufDisplayName.rendered.test.tsx`).
- **Catalog replacement and licensing fields:** `supersededBy` supports a “Newer” warning; `nonCommercial` on a remote text-catalog entry drives a “Research licence” label. The test also records that the published catalog's text section was empty at that time, so the UI wiring alone is not evidence that real entries were present. Evidence: `__tests__/integration/models/modelCardReplacedAndResearchLicence.rendered.test.tsx`.
- **Catalog capability facts:** tests expect selected bundled recommendations to surface “Thinking likely”, “Tool calling likely”, and “Vision” capabilities. Evidence: `__tests__/integration/models/catalogChoice.rendered.test.tsx`.

### Important test gap — do not overclaim

The inspected tests do **not** directly test the private `splitGgufPartNames` or `isCompanionFile` exports. Existing scanner tests exercise projector cleanup and generic GGUF scanning, but no split-GGUF naming matrix was found in the inspected test files. The exact split filename convention and companion-file predicate therefore remain unresolved and need independent fixtures before porting.

Likewise, no focused unit test for `modelCardUrl` / `modelCardDeniesReasoning` was identified in this pass. The app's model-card reasoning behavior has a consumer-level contract, but parser edge cases remain unverified.

### Additional portability concern

The catalog update path is a separate external integration: `src/stores/modelCatalogStore.ts` imports `MOBILE_CATALOG_URL` and fetches the remote catalog. Tests refer to the old upstream catalog URL `https://raw.githubusercontent.com/off-grid-ai/OGAM/main/catalog/models.json`. A truly self-owned OGAM release must audit and repoint the catalog source to a repository-controlled URL (or a documented, independently hosted source), while retaining the bundled offline fallback. Do not silently keep a runtime dependency on the original organization's repository.

### Next implementation gate

Before changing production imports:
1. Add/locate explicit fixture tests for split GGUF naming and companion sidecars.
2. Specify the full catalog schema and publish a versioned, license-audited catalog owned by `sokfrut-tech/OGAM`.
3. Port the proven helpers with parity tests, then migrate consumers one helper at a time.
4. Keep the complete bundled catalog and the offline fallback; test offline startup and remote catalog failure.


## External open-source implementation survey — reusable alternatives (2026-11-22)

The migration policy is clarified: third-party libraries and projects are allowed. A dependency is acceptable when it is publicly accessible, maintained enough for our needs, compatible with OGAM's architecture/device targets, and has a usable licence. If an original Off Grid source package is inaccessible, inspect other public implementations and either (a) add a suitable licensed dependency, (b) vendor/adapt code with required notices, or (c) independently implement the behavior from documented contracts and tests. Do not treat an inaccessible upstream as a reason to abandon the feature.

### Repositories inspected

| Project | Verified repository licence | Relevant implementation areas observed in its public tree / README | OGAM use |
|---|---|---|---|
| [OfflineMate](https://github.com/KingPegasus/OfflineMate) | MIT in LICENSE.md (GitHub metadata says NOASSERTION; the actual file contains MIT terms) | React Native local LLM engine/model registry, RAG pipeline and grounding, long-term memory, voice hooks, tool schemas and Android device tools; architecture docs for RAG, speech and agent tool flow | High-value reference for replacing unavailable shared React Native packages, subject to per-file and dependency notice audit |
| [Vesta](https://github.com/RisorseArtificiali/vesta) | MIT | React Native llama engine and model registry/download manager; MCP tool registry/server; Android native system actions, calendar, contacts, reminders, voice activity and service; memory orchestration and confirmation tests | High-value source for tool/action orchestration and Android integration patterns |
| [ToolNeuron](https://github.com/vapordude/ToolNeuron-cai) | Apache-2.0 | Kotlin native implementation: GGUF engine, embedding engine, RAG activities/reader, Room DAO for memory and knowledge, plugin models, AIDL service interfaces, encrypted storage modules | High-value native Android reference for RAG, model engine/service boundaries and persistent memory |
| [Offline AI Assistant](https://github.com/its-hazratbilal/offline-ai-assistant) | MIT | Kotlin/Compose/JNI llama.cpp app with model download/switching and persistent local inference | Useful reference for the native inference and model-management boundary; narrower feature scope |
| [NIDO](https://github.com/Nido007-cmyk/Nido) | MIT | Offline local agent, encrypted memory, action confirmation, reminders/calendar/notes, document/image ingestion and local knowledge packs; explicit privacy/threat-model documentation | Useful reference for memory safety, offline actions and confirmation UX; inspect module-level third-party notices before reuse |
| [Local AI](https://github.com/smartworldarafath/Local-AI) | AGPL-3.0 | Kotlin memory search/planning, RAG vector engine, local tools/workspace tools, VoiceInteractionService and assistant overlay | Study architecture and tests only by default. Do not copy/link its AGPL code into OGAM unless we deliberately accept AGPL obligations for the combined distribution |
| [OffHand](https://github.com/MRDarshan7/OffHand) | No repository licence was confirmed in this inspection | Kotlin voice-to-action pipeline, grammar-constrained JSON parsing, independent validation, human confirmation and durable offline outbox | Architecture/test ideas only until an explicit compatible licence is confirmed |
| [Fieldkit AI](https://github.com/bth0mp/fieldkit-ai) | Licence details require a separate review; README describes free/non-commercial use | Local GGUF chat, PDF knowledge base, embeddings and citations, Whisper transcription, vision and image generation | Research reference only; non-commercial terms may conflict with OGAM distribution goals |

### First mapping to unavailable packages

- `@offgrid/models`: compare OfflineMate and Vesta model registries/catalogues/download managers, then preserve OGAM's already documented model-catalog, RAM-fit, quantization, GGUF split and projector contracts with direct tests.
- `@offgrid/rag`: compare OfflineMate RAG pipeline/grounding, Vesta memory orchestration, and ToolNeuron embedding/RAG implementation. Keep document extraction, chunking, embedding, retrieval, citations and failure behavior as separately tested seams.
- `@offgrid/speech`: inspect OfflineMate voice hooks/docs and Vesta voice activity/service; select an on-device ASR/TTS stack separately and preserve the existing voice-turn state-machine behavior.
- `@offgrid/sync`: no equivalent should be adopted blindly. Vesta's MCP/server and local storage code may inform transport boundaries, but OGAM peer sync requires its own protocol, compatibility and security audit.
- `@offgrid/design` / `@offgrid/ui`: use OGAM's own existing screens/components as the source of truth; extract reusable tokens/components from accessible MIT/Apache sources only where it improves consistency and does not import a whole unrelated UI.
- `@offgrid/notes`, `@offgrid/notes-editor`, `@offgrid/writing`: compare OfflineMate notes/memory and ToolNeuron's local document workflows; preserve OGAM data formats and editor behavior instead of copying an unrelated product wholesale.
- Pro-only paths: keep optional Pro activation isolated. Do not let unavailable commercial/private Pro code block the free OGAM runtime.

### Licence and integration rules

1. The repository's top-level licence does not automatically cover dependencies, model weights, datasets, native binaries, fonts or bundled assets. Audit each separately and keep THIRD_PARTY_NOTICES and upstream copyright headers.
2. MIT and Apache-2.0 sources are generally suitable candidates when their notice/attribution and Apache NOTICE/patent requirements are preserved. Verify the exact file and its dependency tree before copying.
3. AGPL-3.0 is not an automatic source for code reuse in OGAM; use it as an architectural/test reference unless the project explicitly chooses the corresponding copyleft obligations.
4. A public GitHub repository is not automatically open-licensed. Do not copy code from repositories without a confirmed licence.
5. Prefer small, behavior-focused ports over importing an entire assistant application. Preserve OGAM's React Native architecture unless a specific native Android module is justified.
6. Before integrating any candidate, record the exact commit SHA, file paths, licence, notices, transitive dependencies, and the OGAM tests that prove the behavior. Add regression tests before removing the old import path.

### Next execution order

1. Finish a full OGAM importer/consumer map for all nine `@offgrid/*` packages and `@offgrid/automation`, with call sites and runtime paths.
2. Inspect the exact candidate source files and tests in OfflineMate, Vesta and ToolNeuron (not just README claims), starting with model registry, RAG, memory and tool dispatch.
3. Select the smallest useful MIT/Apache implementation for the first missing contract; record provenance and notices.
4. Port one vertical slice into OGAM, update package aliases/lockfile only for that slice, and run focused tests plus a clean install/build.
5. Repeat package-by-package. Do not skip feature tests or claim independence until the clean OGAM-only build and APK gates pass.


## Candidate source inspection — model, RAG, memory and Android tools (2026-11-22)

This pass opened implementation files and tests, not only project landing pages.

### Vesta — implementation details verified

Repository: [RisorseArtificiali/vesta](https://github.com/RisorseArtificiali/vesta), MIT.

- `apps/mobile/lib/models/model-registry.ts`: SQLite-backed installed-model registry with typed CRUD, active-model invariant, state transitions, resume token, SHA-256 and one-time legacy path migration. This is a useful design reference, but OGAM already has a richer model lifecycle and should not replace its model manager with this smaller registry.
- `apps/mobile/lib/orchestrator/tool-dispatcher.ts`: validates required parameters/types/formats before dispatch, normalizes model-emitted ISO datetimes where a date-only value is expected, catches execution errors and routes to explicit Android bridges. The dispatcher includes alarms, calendar, reminders, timers, navigation, contacts, calls/SMS and document queries.
- `apps/mobile/lib/tools/tool-registry.ts`: tool schema carries category, confirmation requirement, localized descriptions and a `returnsData` flag so query results can be fed back to the model instead of treating the model's first response as final.
- `apps/mobile/lib/native/system-actions.ts`: uses Android intents and checks native-module availability. It correctly reports that opening the calendar editor is not the same as saving an event, and documents that Android's alarm intent ignores a requested date.
- `apps/mobile/lib/orchestrator/memory-manager.ts`: asynchronous extraction, concurrency guard, cancellation when a new user turn begins, timeout that stops native generation, context-window budget check and stable-prefix/KV-cache awareness.
- Tests inspected: `memory-gate.test.ts` covers skipping tool-call confirmations and short acknowledgements; `memory-order.test.ts` locks deterministic prompt ordering; `session-cache.test.ts` covers prefix cache persistence/restore and corruption/staleness policy; `download-manager.test.ts` covers truncated downloads, commit atomicity and resume/pause behavior.

**OGAM implication:** borrow the tested behavioral patterns (tool validation, confirmation/returns-data semantics, cancellable background memory extraction, deterministic prompt memory ordering and resumable download invariants). Do not transplant Vesta's complete application or downgrade OGAM's existing capabilities.

### OfflineMate — implementation details verified

Repository: [KingPegasus/OfflineMate](https://github.com/KingPegasus/OfflineMate), MIT terms are present in `LICENSE.md` (GitHub's metadata did not classify the licence, so preserve and verify the actual file).

- `src/ai/rag-pipeline.ts`: selects retrieval top-K and similarity thresholds by model tier, diversifies by source, deduplicates normalized snippets and surfaces a warning when embeddings are in fallback mode.
- `src/ai/tool-action-schema.ts`: parses constrained JSON decisions, rejects malformed/placeholder values, validates supported tool names, and has a cautious lenient fallback that refuses reasoning/structured fragments as direct answers.
- `src/context/memory-manager.ts`: implements a simple tier-dependent sliding history window. This is not a full persistent memory engine; treat it only as a context-window policy example.
- Its README/tree also expose a model registry, tool schemas, long-term memory, voice hooks and RAG grounding. Those files still require targeted review before any code reuse.

**OGAM implication:** source-diversified retrieval and explicit embedding-fallback warnings are useful RAG behaviors to compare with OGAM's document engine. The tool parser is a useful robustness reference, but OGAM must keep its own supported tool registry and parameter schemas.

### ToolNeuron — implementation details verified

Repository: [vapordude/ToolNeuron-cai](https://github.com/vapordude/ToolNeuron-cai), Apache-2.0.

- `EmbeddingEngine.kt`: serializes initialization with a coroutine Mutex, checks model existence/readability, validates the native engine with a test embedding, records vector dimension and closes the native handle on failed validation.
- `RagDao.kt`: Room DAO provides explicit CRUD and observable installed/loaded/enabled RAG state.
- `GGUFEngine.kt`: Kotlin wrapper around a native GGUF engine, supports loading by path or file descriptor, applies model-specific sampling/template settings, and catches OutOfMemoryError to unload native state.
- These files import `com.dark.gguf_lib`; that library is a separate provenance/licence/dependency boundary and must be inspected before adopting the engine wrapper.

**OGAM implication:** valuable patterns for native model lifecycle, SAF/file-descriptor loading, embedding validation and failure cleanup. Do not copy the wrapper until its native library and transitive notices are verified.

### First migration decision

No source code was copied in this pass. These projects are architecture/behavior references; the existing OGAM services and test contracts remain the source of truth for compatibility. Before the first implementation PR:
1. finish locating every OGAM import/call site for each missing package;
2. inspect the exact source and licence of the candidate implementation and every non-platform dependency it pulls in;
3. map old behavior to OGAM tests and add missing regression tests;
4. port the smallest independent vertical slice, then run focused Jest/TypeScript checks and a clean install.


## OGAM consumer-side compatibility map — direct source review (2026-11-22)

Opened the following current OGAM files on `feature/jarvis-step-2-storage-privacy`:

### Documents / RAG — `@offgrid/rag/documents`

- `src/services/documents/index.ts` composes `DocumentIngestService` and `DocumentTurnService` with OGAM-owned ports: extractor, persistent store, scheduler, embedder, conversation/project membership, keyword search, progress and warning callbacks.
- `src/services/documents/models.ts` supplies normalized MiniLM-family or user-selected embeddings through OGAM's `embeddingService`.
- `src/services/rag/index.ts` owns project knowledge-base membership and sync identity; actual extraction, indexing, retrieval and citations are delegated to the document engine.
- Therefore, a replacement must preserve the ingest lifecycle, document identity/deduplication, garbage collection, project/conversation scoping, keyword + vector retrieval, citations, progress, scheduler yielding, and error reporting. A generic top-K RAG sample is not a compatible replacement.
- Candidate patterns: OfflineMate source-diversified retrieval and fallback warning; Vesta document retrieval + tool-loop design; ToolNeuron's Room-backed installed-RAG lifecycle and embedding validation. These are references, not yet a complete drop-in implementation.

### Sync — `@offgrid/sync`

- `src/services/sync/engine.ts` composes the platform-neutral `SyncEngine` with `RnTcpTransport`, injected TCP module and byte codec.
- The engine contract includes pairing, passphrase/shared-secret, mesh admission, pairing persistence, membership persistence/revocation, route changes, app messages, transport caps and error callbacks.
- This is security-sensitive networking. Do not replace it with a basic local HTTP/MCP server or copy a superficially similar transport. Need the complete protocol, crypto, replay protection, pairing state machine, version negotiation and sync regression tests before selecting an alternative.

### Speech — `@offgrid/speech`

- `src/services/voiceSession.ts` uses a shared deterministic state machine: `initialVoiceSession`, `nextVoiceSession`, `micShouldBeOpen`, `speechMayPlay`.
- OGAM deliberately has one owner for listening/speaking/stopped state to avoid duplicated locks and races between microphone capture, generation and playback.
- Vesta/OfflineMate voice hooks and native voice activities are candidate references, but any port must preserve the single-owner state machine and OGAM's current voice-mode behavior. Replacing this with independent booleans/hooks would reintroduce known race classes.

### Models — `@offgrid/models`

- `src/stores/modelCatalogStore.ts` owns local state and persistence ports; the shared package supplies the remote catalog URL, parsing, validation, merge/diff and cache helpers.
- Startup loads cached data and does not fetch; the user explicitly taps to check for new models. Bundled lists remain fallback and locally added entries are merged after remote entries.
- Keep the previously documented catalog, recommendation, quantization, GGUF sidecar and model-card contracts. Candidate registries from Vesta/OfflineMate are useful only for installed-model metadata/download lifecycle; they are not substitutes for the catalog behavior.

### First implementation priority — revised

Do not start by replacing the entire RAG package. The source review shows the highest-value safe first slice is likely a **small pure helper contract** from `@offgrid/models` (catalog parsing/merge or model metadata classification) only after its exact consumer and tests are fully mapped. In parallel, build a complete document-engine contract map. Sync and speech remain later slices because they are stateful/security-sensitive and already sit on critical app paths.

No runtime source was changed in this pass. This update records the exact OGAM compatibility boundaries so future reuse of external code cannot silently remove existing features.


## Standalone fork source audit — model-catalog recovery decision (2026-11-22)

A public standalone snapshot was inspected as a possible source for recovering the model package:

- Repository: [wednesday-solutions/off-grid-mobile-ai](https://github.com/wednesday-solutions/off-grid-mobile-ai)
- Exact inspected tree commit: `5ab8ca980ef2798fde7278862200f66f44b65a2f`
- `LICENSE` contains MIT terms and copyright notice for Mohammed Ali Chherawalla (2026). Any reuse must preserve the notice and verify that each selected file belongs to that licensed snapshot.
- `src/constants/models.ts` contains an older mobile curated list (16 text/vision recommendations) and quantization display constants. It is a useful historical behavioral/data reference, not a current replacement for `@offgrid/models`.

### Why this is not a safe wholesale replacement

The current OGAM branch's `catalog/models.json` is explicitly a delta catalog, not the full bundled catalog. Its inspected schema version is 1, updated 2026-11-01, and currently contains 23 `models` entries (text, vision, image and video), one `text` recommendation, one transcription entry, and empty CoreML/LiteRT sections. The catalog README says the app already ships its own full catalog and this file only adds/replaces entries.

The older standalone fork's 16-entry text/vision recommendation list cannot reconstruct the current full catalog. Substituting it for `CATALOG` would drop current image/video catalog metadata and other full-catalog behaviors, so it is rejected as a complete package replacement.

### Decision

- Keep the old standalone MIT snapshot as a compatibility reference only.
- Do not replace `CATALOG` with the old curated list or label the result equivalent.
- A future OGAM-owned model package must combine a provenance-verified complete catalog source with the already documented mobile contracts and the current delta catalog, or independently rebuild and maintain the full catalog with explicit provenance.
- Before porting the pure helpers (`prefersQ4_0`, `modelCardUrl`, `modelCardDeniesReasoning`, GGUF split/companion helpers), add direct parity tests and resolve the current naming/parser edge cases. The helper port can be separated from the full catalog migration only if package imports and all existing runtime behaviors remain intact.

## Global recovery policy

This migration follows the mandatory cross-project rule in [Universal AI Factory — OPEN_SOURCE_GAP_RECOVERY_POLICY.md](https://github.com/sokfrut-tech/Universal-AI-Factory/blob/main/docs/OPEN_SOURCE_GAP_RECOVERY_POLICY.md): search, inspect, compare, verify licensing, adapt/integrate, test and document. An inaccessible original source is not a reason to abandon a required feature; a superficially similar but incomplete replacement is not acceptable either.


## Automated OGAM-only dependency inventory (2026-11-22)

The standalone audit workflow ran on commit `f706b86c9aab9021c8a4409bbf69bd060f8d7193` without checking out either private upstream repository and passed its scanner tests. Its artifact `ogam-import-audit` scanned 1,938 text/source/config files. This is a reference inventory, not proof that dependencies are resolved or that the app builds.

Evidence:
- [Successful audit run](https://github.com/sokfrut-tech/OGAM/actions/runs/45017008291)
- [Audit artifact](https://github.com/sokfrut-tech/OGAM/actions/runs/45017008291)
- [Main CI run for the same head](https://github.com/sokfrut-tech/OGAM/actions/runs/45017008304)

### Measured counts

| Evidence class | Count |
| --- | ---: |
| `@offgrid/*` import references (including tests) | 471 |
| `../shared` workspace-path references | 76 |
| Pro source-path references (including tests) | 787 |
| Private checkout references | 37 |
| Local `file:../shared/packages/*` dependencies in package.json | 9 |

Import references by package (source / tests):
- `@offgrid/models`: 94 / 37
- `@offgrid/sync`: 44 / 104
- `@offgrid/rag`: 19 / 4
- `@offgrid/speech`: 8 / 1
- `@offgrid/ui`: 3 / 0
- `@offgrid/design`: 2 / 0
- `@offgrid/notes`, `@offgrid/notes-editor`, `@offgrid/writing`, and `@offgrid/automation`: no direct package imports detected by this scanner; they still remain local file dependencies and may be referenced indirectly by workspace/build configuration.
- Pro is referenced by two source files and extensively by tests. The two source files are `src/bootstrap/loadProFeatures.ts` and `src/services/demoSeed.ts`; removing Pro therefore needs an explicit supported open-core behavior and test policy, not an unreviewed blanket deletion.

### Migration order derived from the evidence

1. **models** — largest runtime surface (94 source references) and central to catalog, model selection, downloads, modality metadata, device picks, and generation. Build a full OGAM-owned contract and catalog; do not substitute the older 16-entry fork catalog.
2. **sync** — 44 runtime references and security-sensitive pairing/mesh/membership/transport semantics. Preserve the existing OGAM adapters and contract tests; do not replace this with a simple HTTP or MCP transport.
3. **rag** — 19 runtime references across documents, extraction, embeddings, project knowledge bases and retrieval. Port against the OGAM-owned ports and round-trip tests.
4. **speech** — 8 runtime references; the voice session state machine and silence endpoint need race/regression tests.
5. **design/ui** — only five runtime imports combined, but they affect shared palettes and download status/progress presentation. Inspect their actual exports and consumers before implementing small owned equivalents.
6. **notes / notes-editor / writing / automation** — no direct package imports detected; investigate whether they are dead package links or dynamically loaded / indirect build inputs before removing dependencies.
7. **pro** — isolate the two runtime references and determine the open-core behavior; keep Pro-only tests meaningful and do not silently skip tests to obtain green CI.

The inventory shows the migration is not a one-package change: models and sync dominate the runtime surface. The next implementation work should start with exact export/consumer contracts for models, then split pure deterministic helpers from catalog data and native/runtime integrations. The full JSON artifact is the file/line evidence source for this count set.


## Latest upstream cross-check — no public shared-package drop-in found (2026-11-22)

The current public upstream `off-grid-ai/OGAM` main was inspected after the standalone-fork survey:
- Upstream main commit: `ff6abb8babdeb0836bb64d1df61dd90dd39cfd42`
- Current upstream package version: `0.0.125`
- Upstream still declares the same nine `file:../shared/packages/*` dependencies in `package.json`: design, models, notes, notes-editor, rag, speech, sync, ui, writing.
- Its current `rules.md` states that the business logic for shared packages is owned by the shared monorepo, not by the mobile app. The upstream `metro.config.js` and Jest configuration therefore still expect a sibling `../shared` checkout.
- Upstream OGAM's `LICENSE` is MIT, copyright 2026 Mohammed Ali Chherawalla. That licence covers the OGAM files distributed under it; it is not evidence that separately distributed shared packages or private Pro source are MIT-licensed.

References:
- [Upstream OGAM](https://github.com/off-grid-ai/OGAM)
- [Upstream package.json](https://github.com/off-grid-ai/OGAM/blob/main/package.json)
- [Upstream rules.md](https://github.com/off-grid-ai/OGAM/blob/main/rules.md)
- [Upstream license](https://github.com/off-grid-ai/OGAM/blob/main/LICENSE)

Decision: do not copy a fictitious "standalone upstream" branch or assume the current public OGAM tree includes shared packages. The public mobile source is useful as a behavioral and integration reference, but it does not solve the missing sibling workspace. Every replacement package still needs its own source, provenance/licence audit, and consumer-contract tests.


## First runtime package removal — `@offgrid/ui` progress contract (2026-11-22)

A small, fully consumer-scoped part of `@offgrid/ui` was independently reimplemented in OGAM after checking every direct runtime import and the existing mobile regression tests.

OGAM-owned module:
- `src/utils/progressCore.ts`
- Owns `ProgressRateSample`, `sampleProgressRate`, `ProgressLike`, `ProgressPresentation`, and `projectProgress`.
- Handles first-sample baseline, monotonic byte-rate measurement, counter rollback, invalid timestamps, non-finite/negative values, unknown totals, bounded percentages and terminal completion.
- Regression tests: `__tests__/unit/utils/progressCore.test.ts`.
- Existing mobile tests in `__tests__/unit/utils/progressPresentation.test.ts` and `__tests__/unit/stores/downloadStore.test.ts` remain in place as consumer-level compatibility checks.

Updated consumers:
- `src/utils/downloadStatus.ts`
- `src/utils/progressPresentation.ts`
- `src/stores/downloadStore.ts`

Removed the unused `@offgrid/ui` package dependency from `package.json` and `package-lock.json`, plus its Metro watch folder and resolver alias. Lockfile v3 was parsed after editing; the root dependency and package link are both absent. No other UI package behavior was claimed as migrated.

Verification:
- New import audit succeeded on the change sequence; its artifact reports 0 `@offgrid/ui` imports, 8 remaining local `file:../shared/packages/*` dependencies, 468 total `@offgrid/*` import references, 73 shared workspace path references, 787 Pro source-path references, and 37 private checkout references.
- [Latest successful standalone dependency audit](https://github.com/sokfrut-tech/OGAM/actions/runs/45017492595)
- Main CI for the current branch head was queued when this note was written; the progress-core tests and the full CI result must be confirmed before calling this migration step verified.


### Verification update — progress-core slice (2026-11-22)

The dependency-free OGAM-only workflow completed successfully at branch head `15325fcc1737e9930297af3c20e8c16160597579`:
- [Workflow run](https://github.com/sokfrut-tech/OGAM/actions/runs/45017602234)
- The scanner's unit tests passed.
- The standalone progress contract tests passed using Node's native test runner and `--experimental-strip-types`.
- The 1,938-file source/config inventory was generated and uploaded successfully.

The main CI run `45017602205` for the same head remains in GitHub's `pending` state and has not exposed any jobs yet. Therefore Jest, TypeScript, lint, dependency-cruiser, and Android/iOS build results for the integrated app remain **unverified**. The passing standalone tests prove the pure progress contract in isolation only; they do not prove the complete React Native app builds or that the shared progress package's inaccessible implementation is byte-for-byte behaviorally identical.

Next migration target remains `@offgrid/models`, beginning with a complete OGAM-owned export/consumer contract and catalog provenance—not a wholesale replacement with the older 16-entry list.


## Model-package replacement contract — consumer imports and safety gates (2026-11-22)

The current OGAM branch was re-read directly. The model package is consumed by these runtime modules:

| Consumer | Required export(s) | Responsibility |
| --- | --- | --- |
| `src/constants/models.ts` | `CATALOG`, `ModelEntry`, `MobileTextCatalogModel` | Curated catalog, model modality/availability filtering, phone recommendation shape |
| `src/screens/ModelsScreen/useTextModels.ts` | `CATALOG`, `MobileTextCatalogModel` | Curated model detail lookup and display |
| `src/services/modelManager/scan.ts` | `isCompanionFile`, `splitGgufPartNames` | Sidecar classification and multi-part GGUF discovery |
| `src/services/modelManager/index.ts` | `splitGgufPartNames` | Model file grouping |
| `src/services/modelScannerService.ts` | `splitGgufPartNames` | Disk-scan recovery of split models |
| `src/services/modelCardReasoning.ts` | `modelCardUrl`, `modelCardDeniesReasoning` | Revision-aware Hugging Face model-card fetch and conservative reasoning metadata |
| `src/services/modelCatalogFiles.ts` | `prefersQ4_0` | Android CPU/NPU vs Android GPU/iOS quantization order |
| `src/utils/modelHelpers.ts` | `CATALOG` | Video model display names |
| `src/utils/recommendedModels.ts` | `MobileTextCatalogModel` | Typed device-fit recommendations |
| `src/stores/modelCatalogStore.ts` | `MOBILE_CATALOG_URL`, `diffMergedCatalog`, `loadCachedCatalog`, `mergeCatalogEntries`, `mobileCatalogKey`, `parseMobileCatalogSections`, `refreshRemoteCatalog`, `CatalogCache`, `CatalogFetch`, `MobileCatalogSections` | Offline-first remote catalog validation, cache, merge, diff and refresh |
| `src/services/modelDownloadService/types.ts` | `ModelEntry` | Video model download request type |

### Non-negotiable model-catalog invariants

- `CATALOG` is the full bundled source of truth, not just the mobile recommended-text subset. It includes text, vision, image and video entries and the metadata consumed by model loading, download, capability, licensing and UI flows.
- `catalog/models.json` is a remote delta/override, not a replacement bundled catalog. Startup must remain offline and read cached data; network refresh is an explicit user action.
- Remote parsing must reject malformed/unsafe entries without discarding the last known good cache or bundled baseline.
- Merge and diff must be deterministic, key by the existing per-section identity, preserve local additions, and report changes without duplicate IDs.
- Existing installed models remain discoverable even if no longer recommended; recommendation eligibility and runtime loadability are separate decisions.
- Model files must preserve primary/auxiliary roles, size metadata, projector matching, split GGUF part grouping, and companion-file behavior.
- Quantization preference stays Android CPU/NPU: Q4_0 first when available, else Q4_K_M; Android GPU and iOS: Q4_K_M first.
- Model-card fetch failure/offline/missing card must leave reasoning metadata unknown rather than asserting either capability. The explicit "denies reasoning" rule must be tested against representative card text.
- Video model catalog names must remain available; the historical 16-entry standalone fork catalog is not an acceptable full catalog source.

### Required focused tests before replacing imports

1. Catalog schema/type fixtures for every modality and optional field used by consumers; full-catalog uniqueness and valid-file invariants.
2. GGUF split naming: numbered and unnumbered single files, part order, gaps, malformed suffixes, case variants and non-GGUF neighbors.
3. Companion classifier: projector, MTP/auxiliary files, metadata/sidecars, unrelated files and case/extension variants.
4. Quantization preference truth table across Android CPU, Android NPU, Android GPU and iOS.
5. Model-card URL revision encoding, missing revision, HTTP card variants, explicit non-reasoning language, neutral/unknown cards and malformed content.
6. Remote catalog parser/merge/cache: malformed JSON, unsupported schema, duplicate IDs, invalid modality/files, remote deletion/update, local additions, stale cache and failed refresh preserving last known good data.
7. Regression suite: all existing model screen, scanner, download, model selection, device-pick, video, vision/projector, licensing and onboarding tests.

Implementation order: first create independent, fixture-backed tests for the pure helpers and model-catalog contract; then port pure helpers; only after the full catalog provenance is resolved, migrate the catalog and remote cache layer. Do not point the package name at a partial stub or move model screens to an incomplete catalogue.


## Automated repository-wide dependency inventory — 2026-11-22

The new OGAM-only audit workflow was run against a clean checkout at PR head `6a2bdd05690be4bd86bb63c73480550bc8061aa4`.

- Workflow: [OGAM external dependency audit, run 36](https://github.com/sokfrut-tech/OGAM/actions/runs/45017809784) — **success**.
- The job checked out OGAM only; no private upstream checkout or token was used.
- Scanner covered **1,941 files** and recorded **1,365 references** across source, tests and build configuration.
- The workflow artifact [ogam-import-audit](https://github.com/sokfrut-tech/OGAM/actions/runs/45017809784/artifacts/14752273907) contains the full JSON file/line inventory (14-day retention).
- Scanner unit tests: **3 passed, 0 failed**.
- Standalone progress-core Node tests: **7 passed, 0 failed**. Node emitted a non-fatal module-type warning; this is not a full application test.
- The workflow success is limited to the audit and progress-core checks. It does **not** mean the app's Jest/typecheck/Android build passed.

The previous message's link to run 45017758354 is an external-dependency-audit workflow, not the full app CI. The latest full CI at this checkpoint is [run 43](https://github.com/sokfrut-tech/OGAM/actions/runs/45017809822): queued, with all ten main jobs queued and no completed application verification yet. The preceding CI attempts were cancelled during repeated pushes. No APK artifact is present.

### Next safe slice

Use the uploaded JSON inventory as the authoritative per-file/per-line map. Extract the exact `@offgrid/models` imports by scope, then implement only the pure, license-independent model contract functions in an OGAM-owned module, one contract at a time. Keep catalog data, network URL policy, model RAM estimator, GGUF multipart behavior and runtime load gate unchanged until their contracts have dedicated regression coverage. Do not remove the remaining shared dependency links or change Metro/Jest mappings based only on package-level counts.
