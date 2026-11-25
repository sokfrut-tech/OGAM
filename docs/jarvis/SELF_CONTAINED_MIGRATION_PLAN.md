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


### Inventory interpretation — exact package boundaries

The JSON artifact was downloaded and parsed, so the counts below are based on file/line evidence rather than inferred from manifests:

| Package | Source references | Test references | Interpretation |
|---|---:|---:|---|
| `@offgrid/models` | 94 | 37 | Broad cross-cutting contract: catalog, model identity, device fit, GGUF helpers, reasoning, image policy, guide content and settings. Not safe to replace wholesale in one pass. |
| `@offgrid/sync` | 44 | 104 | Core chat/sync/network/security contracts plus Pro entitlement consumers. High-risk boundary; preserve protocol and admission invariants. |
| `@offgrid/rag` | 19 | 4 | Document ingest/retrieval/citations and paired-computer search. Core feature; requires behavior-level replacement. |
| `@offgrid/speech` | 8 | 1 | Voice-turn state, transcription language and WAV trimming contracts. |
| `@offgrid/design` | 2 | 0 | Shared design tokens imported from two source modules. |
| `@offgrid/notes`, `@offgrid/notes-editor`, `@offgrid/ui`, `@offgrid/writing`, `@offgrid/automation` | 0 | 0 | No direct scoped imports detected in source/tests by this scanner. They remain declared file dependencies or Metro/build mappings where applicable; zero imports alone does not authorize removal. |

Additional repository-wide counts: **468 package imports**, **73 `../shared` workspace path references**, **787 Pro source-path references**, and **37 private checkout references**. These include tests and build configuration; do not interpret them as unique files or runtime-only dependencies.

### `@offgrid/models` source import groups confirmed by the artifact

- Model catalogue/types and recommendation: `src/constants/models.ts`, `src/screens/ModelsScreen/*`, `src/services/devicePicks.ts`, `src/utils/recommendedModels.ts`.
- GGUF/model-file handling: `src/services/modelArtifactClassifier.ts`, `src/services/modelManager/*`, `src/services/modelScannerService.ts`, `src/services/mtpHeads.ts`, `src/services/mmproj.ts`.
- Device/RAM/runtime policy: `src/services/memoryBudget.ts`, `src/services/activeModelService/memory.ts`, `src/services/modelResidency/*`, `src/services/llamaEngineSupport.ts`, `src/services/cpuTopologyReader.ts`.
- Model cards/reasoning and catalog refresh: `src/services/modelCardReasoning.ts`, `src/services/modelCatalogFiles.ts`, `src/stores/modelCatalogStore.ts`.
- UI/content/settings policy: model cards, media styles, guide flows, image parameter policy, text generation settings and boost-promo presentation.

Migration order should start with isolated pure functions whose exact outputs are characterized by tests, not with the catalog or runtime estimator. Preserve the shared catalog and RAM-fit invariants until their full test matrix is executable in OGAM-only CI.


### First independent model-contract extraction: split GGUF filename set

Commit `509d3c6ae58a01c5dfa8b5e8523c6176822f108e` adds `src/utils/ggufSplitFiles.ts` and routes both `modelArtifactClassifier.ts` and `modelManager/scan.ts` through the OGAM-owned helper instead of importing `splitGgufPartNames` from `@offgrid/models`.

Contract: standard llama.cpp/ GGUF names use a five-digit, one-based shard index (`-00001-of-00003.gguf`). Given any valid shard, the helper returns the full ordered filename set. Non-split and malformed names are returned unchanged. It does not claim to validate the shard contents; native GGUF metadata and loader checks remain authoritative.

Reference evidence: [GGUF naming convention in ggml documentation](https://github.com/ggml-org/ggml/blob/master/docs/gguf.md) and [Go GGUF package split naming description](https://pkg.go.dev/github.com/zerfoo/zerfoo/model/gguf). No third-party source code was copied; the small filename helper is an independent implementation of the documented convention.

Added Jest tests at `__tests__/unit/utils/ggufSplitFiles.test.ts`. Also add a dependency-free Node test to the OGAM-only audit workflow so the helper is verified even while private shared workspaces remain absent. The existing audit workflow success at [run 39](https://github.com/sokfrut-tech/OGAM/actions/runs/45018191742) predates this standalone test step and therefore does not yet verify the new helper.

Full application CI is still blocked by absent `@offgrid/models`, `@offgrid/sync`, and Pro source/workspace directories. At run [45018030621](https://github.com/sokfrut-tech/OGAM/actions/runs/45018030621), the workspace setup and install completed but Jest reported 87 failed suites / 18 passed and 393 failed tests / 147 passed; the representative failures are module resolution errors for the missing private workspace packages and Pro sources. ESLint and native video helper tests passed; typecheck, dependency-cruiser and knip failed in the same run. This is a pre-existing standalone migration blocker, not evidence that the new helper failed.


### Split GGUF contract: complete consumer migration and isolated verification

After tracing the full audit artifact, five additional source consumers were found and migrated in commit `4548731ffb90bdbfd5d6060b687f8e4f16cf59ac`: `src/services/llm.ts`, `src/services/llmSafetyChecks.ts`, `src/services/modelManager/index.ts`, `src/services/modelManager/storage.ts`, and `src/services/modelScannerService.ts`. Together with the earlier two consumers (`modelArtifactClassifier.ts` and `modelManager/scan.ts`), all seven source import sites now use `src/utils/ggufSplitFiles.ts`. The latest audit JSON contains **zero remaining imports of `splitGgufPartNames` from `@offgrid/models`**.

The isolated OGAM-only workflow at [run 45018308652](https://github.com/sokfrut-tech/OGAM/actions/runs/45018308652) completed successfully: scanner tests, standalone progress-core tests, the new split-GGUF Node contract tests, inventory generation and artifact upload all passed. The artifact [ogam-import-audit](https://github.com/sokfrut-tech/OGAM/actions/runs/45018308652/artifacts/14751764093) reports 1,944 scanned files, 465 package-import references, and 91 remaining `@offgrid/models` source import lines; none of those import lines reference `splitGgufPartNames`.

The Jest test file remains in the application suite as a second layer, but full Jest/typecheck/Android validation is not yet green because the rest of the private shared and Pro workspaces are still absent. The last full CI run [45018030621](https://github.com/sokfrut-tech/OGAM/actions/runs/45018030621) shows the workspace/Jest/typecheck failures documented above; Android and iOS jobs were still running at the time of this update. No installable APK has been produced or verified by this step.


### GGUF companion-artifact classification and import guard

Commit `3f0e74defa41cb6d9cb8f1aeb6c45330348d63d4` adds an OGAM-owned filename classifier at `src/utils/modelCompanionFiles.ts` for MTP heads, speculative draft files (DFlash/DSpark/EAGLE3/draft), and imatrix calibration artifacts. The model scanner now skips all recognized companion files, and `llmSafetyChecks.ts` refuses MTP/draft and imatrix artifacts before they reach the native loader. The isolated audit workflow [45018529203](https://github.com/sokfrut-tech/OGAM/actions/runs/45018529203) completed successfully, including the new standalone Node contract test and artifact upload.

Follow-up commit migrates the local-file import guard away from `@offgrid/models` and explicitly refuses imatrix calibration files as non-model artifacts. This closes a separate path where an imatrix GGUF could previously be imported as if it were a runnable model.

The catalogue-backed `mtpHeadForPrimaryFile` remains intentionally unmigrated for now. It returns a published descriptor (name, URL, size, checksum) for a particular primary model; that mapping is data, not a filename-only rule. The public OGAM integration contract confirms a Gemma 4 E4B head named `mtp-gemma-4-E4B-it-Q8_0.gguf` with size 98,653,248 bytes and a SHA-256 requirement, but does not expose the full mapping. Replacing it with a guessed or one-entry registry would silently remove MTP availability for other catalog models. Keep the upstream dependency until the complete mapping and its tests/fixtures can be recovered, then migrate the data with provenance and checksums.



### File-size formatter extraction and consumer migration

The public upstream implementation and its original unit tests were inspected before replacing `@offgrid/models.formatFileSize`. Its established contract is `0 B` for zero and two decimal places for non-zero values (`500.00 B`, `1.00 KB`, `2.50 MB`, `4.20 GB`). This is intentionally distinct from OGAM's pre-existing `formatBytes` helper, whose precision differs; reusing that helper would alter download-refusal copy.

Added `src/utils/formatFileSize.ts` with an independent implementation preserving the established values while safely normalizing negative/non-finite inputs and supporting larger units. Migrated the runtime consumers `src/services/freeSpace.ts` and `src/components/models/PicksRow.tsx`. Four integration tests now import the local helper instead of requiring it from the shared package. Added Jest and dependency-free Node contract tests and inserted the Node test into the OGAM-only audit workflow.

The new standalone formatting test passed in audit run [45019017951](https://github.com/sokfrut-tech/OGAM/actions/runs/45019017951) for the utility/test/workflow commit. Runtime-consumer and integration-test import changes are in later commits and are being verified by the latest branch audit. This remains a targeted contract check, not a full Jest or Android build.

Upstream evidence inspected: [public OGAM formatter](https://github.com/off-grid-ai/OGAM/blob/ff6abb8babdeb0836bb64d1df61dd90dd39cfd42/src/services/huggingface.ts) and [its formatter tests](https://github.com/off-grid-ai/OGAM/blob/ff6abb8babdeb0836bb64d1df61dd90dd39cfd42/__tests__/unit/services/huggingface.test.ts). No source code was copied.


### Companion classifier and file-size formatter: current audit evidence

The current branch audit [45019110983](https://github.com/sokfrut-tech/OGAM/actions/runs/45019110983) completed successfully on commit `b52aba5cc62d110763ed520cb6a675b9cf9137e6`. All standalone checks passed: import scanner, progress core, local file-size formatter, companion artifact classifier, split-GGUF naming, full inventory generation and artifact upload.

The generated audit artifact [ogam-import-audit](https://github.com/sokfrut-tech/OGAM/actions/runs/45019110983/artifacts/14753390487) was downloaded and inspected. It reports 1,950 files scanned and **zero source imports from `@offgrid/models`** for `formatFileSize`, `isDraftModelFile`, `isMtpHeadFile`, `isImatrixFile`, `isCompanionFile`, and `splitGgufPartNames`. This verifies those six contracts are no longer imported by application source from the unavailable package. It does not imply that all `@offgrid/models` imports or full application CI are resolved.

## Jarvis product-parity expansion: complete OGAM + Siri capability inventory (2026-11-22)

The user explicitly approved expanding the scope from model selection to a full feature study and port: preserve useful OGAM capabilities while adding the product behaviours of modern Siri. This is a product-parity programme, not a promise that every proprietary Apple implementation can be copied. We reproduce user-visible capabilities with original Android-native code and legally usable dependencies.

### Baseline facts from current OGAM branch

- The current standalone branch tree contains 3,349 tracked entries at the time of this inventory.
- It already has substantial native Android functionality: download workers/notifications, device memory bridge, LiteRT bridge, screenshot watcher, clipboard/process-text integration, PDF extraction, image generation, sync/mesh services, and a text-improvement/share target.
- The TypeScript source inventory contains 122 screen files, 244 service files, 146 component files, 31 hook files and 26 store files (counts include nested files and helper modules).
- The current manifest already declares microphone, camera, calendar, notifications, foreground service, media and network permissions. These declarations are not proof that all corresponding capabilities are complete or correctly permission-gated.
- Existing native modules and upstream architecture are evidence of features to preserve, not proof of production readiness. Each feature needs a source audit, permission review, test and runtime verification.
- OGAM currently supports local GGUF inference, optional remote OpenAI-compatible providers, vision, Whisper transcription, Stable Diffusion image generation, document/PDF ingestion, project-scoped RAG, tool calling, model discovery/download, background downloads, device/model diagnostics, and local-network device sync. The exact branch implementation and dependency closure must be checked before each migration.

### Siri capability parity matrix

1. Natural conversation and continuity — one persistent assistant identity across voice/text; multi-turn follow-ups, interruption, correction, resumable sessions, conversation history and optional synced history.
2. Personal context — user-approved local index over selected messages/files/calendar/contacts/media/app data; source attribution, permission per source, retention, deletion/export, private fields redaction. Never silently crawl all personal data.
3. On-screen awareness — explicit user-triggered or clearly enabled screen snapshot/accessibility context; support references like "this", "that", "the button above"; redact passwords/payment/private fields; visible capture indicator and no hidden recording.
4. System and app actions — typed tool/skill registry with discoverable names, parameters, entities, permission declarations, result schemas, foreground/background execution, cancellation, undo/compensation and action history.
5. Planning and workflows — natural-language task breakdown, dependencies, preconditions, time estimates, editable plan, progress, pause/resume/cancel, retry and truthful completion reporting. Use a deterministic execution broker; model output is never executable authority.
6. World knowledge and research — local knowledge base plus optional web search/URL reading; provenance, freshness labels, source summaries and prompt-injection isolation.
7. Multimodal understanding — camera/photos/screenshots, documents/PDFs, voice/audio and supported video; modality-specific local models and optional remote endpoints with explicit consent.
8. Writing and communication — draft/rewrite/summarize/translate, compose email/messages, text selection actions, preview before send/share, recipient confirmation and no silent sending.
9. Scheduling and reminders — calendar read/create/update/delete, natural date parsing, conflict detection, reminders/alarms where Android APIs permit; confirmation before changing/deleting events.
10. Device control and settings — open apps/settings, manage allowed device features, clipboard/text actions, battery/storage/network state, notifications; respect Android permission and background-execution restrictions.
11. Proactive suggestions — opt-in suggestions based on local patterns/context; configurable quiet hours, source transparency, rate limits and no unsolicited external uploads.
12. Assistant interface — original Iron Man/JARVIS HUD: animated core/reactor, live listening/thinking/speaking state, waveform, concise response, task timeline/cards, source chips, permission prompts, model/runtime status and accessible reduced-motion mode.
13. Personalisation — voice/personality/verbosity/language preferences, approved memory, task profiles and model routing without fragmenting the assistant identity.
14. Privacy/security — local-first defaults, encrypted secret storage, app lock, biometric option where available, least privilege, audit log, export/delete, network disclosure, safe backup and explicit opt-in sync.
15. Reliability/accessibility — offline behaviour, wake/voice controls, barge-in, low-memory fallbacks, thermal-aware model routing, background recovery, screen-reader support, large text, one-hand UI and localization.

### OGAM capability preservation inventory

Treat each of the following as a capability to retain, inspect and improve, not remove during Jarvis conversion:

- Local multi-model GGUF inference, streaming generation, context management, KV cache controls, GPU/backend selection, performance metrics and model import/download.
- Remote provider abstraction for user-configured LAN/self-hosted endpoints; never make remote access mandatory.
- Vision model/mmproj handling, camera/photo inputs and multimodal chat.
- Whisper local speech-to-text and voice recording; assess streaming ASR, VAD, wake word and local TTS as extensions.
- Stable Diffusion image generation, platform-specific backends, prompt enhancement, previews, background generation and gallery.
- Embeddings, RAG, project knowledge bases, documents, PDF extraction, search and citations.
- Tool registry, model-aware tool calling, iterative tool loop, calculator, date/time, device info, web search and knowledge retrieval; expand with typed Android skills.
- Conversation/project management, presets, message editing, attachment handling, export/import and history.
- Model catalog, compatibility filtering, hardware/memory-aware selection, download queue, retry/resume, integrity validation, companion files, storage cleanup and orphan detection.
- Device diagnostics, onboarding, auto-setup, guide, security/passphrase controls, settings and analytics only with privacy/consent review.
- Local-network discovery, encrypted blob transfer, clipboard/file/screenshot sharing and multi-device model residency; review attack surface and make sync opt-in.
- Android native utilities: PDF, download worker/notifications, clipboard/process text, screenshot capture, device-memory reporting, LiteRT and image generation bridges.
- iOS code may be used as behavioural reference for Apple platform patterns, but Jarvis Android implementation must not depend on iOS-only frameworks or proprietary Apple code.

### Delivery phases (ordered; no feature deletion)

Phase A — Inventory and architecture (current):
- Build a feature-to-source/test/dependency/license/status matrix for all OGAM screens, services, native modules and iOS parity references.
- Mark each item: already functional / partially functional / blocked by private shared package / missing / obsolete / security-sensitive.
- Identify private @offgrid dependencies and migrate contracts incrementally with tests; never replace with empty stubs.
- Create architecture boundaries for assistant session, planner, memory/context, model router, skills, permission broker and HUD.

Phase B — Assistant foundation:
- Local model evaluation harness and device-specific model profiles.
- Unified conversation session across typed and voice input.
- Local TTS + streaming ASR/VAD/wake-word provider interfaces.
- Structured planner, plan persistence and action progress state.
- Typed skills registry and Android permission/capability broker.

Phase C — Siri-like awareness and actions:
- Opt-in context connectors (calendar, selected files/documents, notifications only where permitted, contacts/media only with explicit permissions).
- User-triggered on-screen awareness with redaction.
- Drafting/writing, calendar scheduling, reminders, app launching and approved Android actions.
- Source-aware research and prompt-injection isolation.
- Interruptible voice conversation and contextual follow-up.

Phase D — OGAM parity and enhancement:
- Preserve and verify all OGAM capabilities in the inventory above.
- Complete local vision/audio/image generation and RAG integration with the Jarvis planner.
- Rebuild model catalogue and hardware-aware selection from verified open metadata.
- Optional LAN/desktop companion and encrypted sync, always opt-in.

Phase E — Iron Man/JARVIS product interface:
- Replace generic chat-first navigation with a coherent assistant home/HUD while retaining access to model lab, projects, knowledge, media, tools and settings.
- Original art and animation; no copied Iron Man/Apple trademarks or assets.
- Listening/thinking/speaking/executing/awaiting-approval/complete/error states are visually distinct.
- One-hand usability, accessibility, reduced motion and Russian-first copy.

Phase F — Verification and release:
- Feature parity tests, contract tests, native Android tests, full Jest/typecheck/lint, clean standalone checkout, release build, install/launch and real-device smoke tests.
- Verify offline operation, no hidden network calls, no paid API dependency, no silent cloud fallback, no accidental private-data capture.
- Do not merge PR or publish APK until the complete required gates pass.

### First implementation slices after inventory

1. Recover full OGAM feature/source map from the upstream architecture and codebase guide; cross-check against the current fork tree and private package imports.
2. Audit the current tool registry and tool loop, then define the shared Jarvis skill schema and capability broker.
3. Audit voiceSession, voiceService, audioRecorderService, permissions and existing audio dependencies; design ASR/VAD/TTS/wake-word pipeline without duplicating current features.
4. Audit project/document/RAG stores for local memory reuse; separate conversational history, searchable knowledge and durable user-approved personal memory.
5. Audit native screenshot/clipboard/calendar/process-text bridges for screen context and app actions; add explicit user consent and tests before exposing them to the model.
6. Keep model helper extraction work (splitGgufModelName, modelDisplayName, isRawModelName) in parallel only when its exact upstream contracts/tests are recovered; no guessed semantics.

### Apple research references (public docs)

- Siri AI product capability overview: https://www.apple.com/newsroom/2026/06/apple-unveils-next-generation-of-apple-intelligence-siri-ai-and-more/
- Siri AI release notes and personal context / onscreen awareness: https://www.apple.com/newsroom/2026/09/siri-ai-a-profoundly-more-capable-and-personal-assistant-is-here/
- App Intents (actions, entities, Shortcuts, Spotlight, widgets, system integrations): https://developer.apple.com/documentation/appintents
- App Intents updates (long-running, cancellable, undoable intents and execution modes): https://developer.apple.com/documentation/updates/appintents
- Apple Intelligence developer platform / Foundation Models: https://developer.apple.com/apple-intelligence/
- Legacy SiriKit guidance points developers to App Intents for modern Siri AI integration: https://developer.apple.com/documentation/sirikit

These are product-behaviour references only. No Apple private implementation, source code, assets, model weights or proprietary interface artwork are to be copied.


### Progress update: full feature scope and first Jarvis skill contract

- Added the full OGAM + Siri parity scope and delivery phases to this plan.
- Added the detailed study and source-audit results to docs/jarvis/MODEL_RESEARCH_AND_SIRI_LIKE_AGENT_ARCHITECTURE_2026-11-22.md.
- Confirmed from upstream Apple developer docs that modern Siri integrations are based on typed App Intents, with long-running, cancellable and undoable actions. Jarvis will use its own platform-neutral skill contract and Android execution layer.
- Audited the current OGAM tool registry, dispatch loop, voice session, audio recorder, screenshot and clipboard boundaries, sync engine and Tools screen.
- Important recovered gaps: email/calendar tools are implemented in the absent private Pro submodule; voiceSession imports an unavailable @offgrid/speech state machine; generationToolLoop still imports shared @offgrid/models budget/prompt helpers. These are migration targets, not reasons to drop those capabilities.
- Voice implementation currently uses a cloud/system recognition provider through react-native-voice and starts with en-US; local Whisper/audio PCM infrastructure also exists. Full hands-free echo cancellation is not currently available on Android. Do not claim wake-word or full-duplex voice until implemented and device-tested.
- Added OGAM-owned first contract at src/services/skills/contract.ts. It describes typed skill metadata, input validation, capability requirements, network declaration, execution mode, cancellation/undo metadata and an approval rule that cannot be disabled for external communication, destructive or financial actions.
- Added __tests__/unit/services/skills/contract.test.ts for valid/invalid inputs, capability denial, network gating and mandatory approval. This is a source/test addition only; it is not yet wired into the existing tool loop or Android executor.
- Latest commit at this progress point: 4382366c943e1a7ffbfd74f209508bcfcb9bfd1e. Audit workflow run 45020177196 was queued at last check. No full Jest/TypeScript/Android build result is claimed.
- Next: wire the skill contract into tool definitions and dispatch in a backwards-compatible manner, then add an explicit approval/progress/cancel execution record. In parallel, design the voice state machine from recovered exact contracts or a newly specified OGAM-owned transition table with tests.


## Progress update — OGAM tool contracts and Siri capability research (2026-11-22)

### Implemented on the current branch

- Added `src/services/skills/toolContracts.ts`. It adapts the existing OGAM built-in tool registry into versioned Jarvis skill contracts; the current tool schema remains the single source of truth for parameters and required fields.
- Added fail-closed tool classification. A built-in tool without an explicit risk classification receives no contract and cannot execute through the guarded core path.
- Wired `executeToolCall` to validate arguments, reject unknown fields, require the corresponding user-enabled tool capability, and require a network capability for enabled tools that declare network use.
- Added a final guard that blocks any tool whose contract reports mandatory approval until an explicit approval path is connected. Existing built-ins are currently read-only or reversible generation actions; this guard is for future external-communication, destructive and financial skills.
- Updated `generationToolLoop.ts` to pass the enabled built-in tool IDs into the execution boundary.
- Added Jest tests at `__tests__/unit/services/skills/toolContracts.test.ts` and a dependency-light Node contract test at `scripts/__tests__/skill-contract.node.test.mjs`; the standalone audit workflow now runs the latter.
- This is not yet a complete capability broker: Pro/MCP extension tools still have their own dispatch path and must be brought under the same contract/approval model before exposing high-impact actions. Timeout metadata is recorded but a central cancellable execution supervisor is not implemented yet.

Latest code commit at this progress point: `db4f005b3293e2c4f3b8030b88599ee1e38e2742`. Workflow run `45020500244` was in progress at last inspection; do not report the new test as passing until the run concludes. Full Jest, TypeScript and Android builds remain unverified.

### Voice subsystem source recovery

The current fork imports these voice primitives from the private sibling workspace package `@offgrid/speech`:
- voice-session transition functions and types (`initialVoiceSession`, `nextVoiceSession`, `micShouldBeOpen`, `speechMayPlay`);
- voice turn settings and labels/defaults;
- `SpeechEndpointTimer` and onset look-back constants;
- WAV header/trim planning helpers;
- transcription language catalogue.

The public upstream OGAM tree at `ff6abb8babdeb0836bb64d1df61dd90dd39cfd42` confirms the consuming contracts but does not include the private package implementation. Recovered observable invariants from upstream source and tests:
- states include listening, speaking and stopped; phases distinguish listening, recording and transcribing;
- mic may open only when the session says listen; speech may play only when it says speak;
- a hands-free arm is edge-triggered, never level-triggered; a phase-only transition must notify surfaces but must not start a second recording;
- `userStart` while already listening is a no-op;
- two `nothingHeard` verdicts end an empty hands-free session; one verdict is not enough in all call paths;
- `turnCaptured` hands the floor from the person to transcription/assistant; chat dictation then dispatches `dictationFinished`;
- user stop in hands-free suspends auto-rearm; replay cancellation is distinct from finishing a spoken turn;
- chat dictation must not auto-end on silence; hands-free waits for speech onset and then ends on the configured silence interval;
- WAV trimming preserves original audio on failure and removes front/tail silence only when the trim is worthwhile.

Do not recreate the missing state machine from assumptions. Next recovery step is to enumerate every event, state and field used by OGAM and its tests, then build an OGAM-owned transition table with exhaustive tests against these observable invariants. Keep the native audio capture, transcription and playback mechanics unchanged during this state-only migration.

### Additional open-source voice research

- `k2-fsa/sherpa-onnx` — Apache-2.0; supports Android arm64, Kotlin/Java, VAD, keyword spotting, ASR, TTS, speech enhancement and speaker functions. Strong candidate for a future optional local speech backend, subject to APK size, Russian model availability, latency, memory, model licences and device tests. Repository: https://github.com/k2-fsa/sherpa-onnx
- `soniqo/speech-android` — Apache-2.0; current Android pipeline combines streaming ASR, VAD, TTS and noise cancellation, with an optional Smart Turn model. It is a useful architecture/benchmark reference; model weights and all transitive assets still require separate license and offline verification. Repository: https://github.com/soniqo/speech-android
- `Wolfpkhan/voice_assistant` — no root LICENSE file found in inspected paths; no code copying. Its README documents a sherpa-onnx + Silero VAD Android pipeline, but the missing license keeps it reference-only.
- `MosetiReagan/Tavi` — Apache-2.0; local Android assistant with typed native tools, clarification persistence, offline memory, speech and confirmation workflows. Strong reference for deterministic request routing and persistent clarification, not a dependency selected yet. Repository: https://github.com/MosetiReagan/Tavi

### Apple Siri research refinement

Apple's public App Intents documentation makes the core integration model clear: typed schemas describe app actions and entities so Siri, Spotlight and Shortcuts can discover and invoke them. Apple also documents associating visible app entities with views for on-screen context, and donating actions/content as signals for suggestions. Siri HIG recommends using familiar user-facing names and surfacing relevant content rather than exposing every internal action.

Android/Jarvis equivalents to implement:
- discoverable skill/action catalogue with stable IDs, localized names, schemas and entities;
- Android App Shortcuts, deep links, share targets and launcher shortcuts for high-frequency skills;
- context references bound to explicit visible app state (selected item/document/message), not indiscriminate screen scraping;
- opt-in, local suggestion signals based on user-approved actions, with quiet hours and rate limits;
- plan previews/snippets that ask for missing details or approval before execution.

References:
- https://developer.apple.com/documentation/appintents
- https://developer.apple.com/documentation/appintents/apple-intelligence-and-siri-ai
- https://developer.apple.com/documentation/appintents/getting-started-with-the-app-intents-framework
- https://developer.apple.com/design/human-interface-guidelines/siri


## Voice, speech and spoken-Siri parity audit (2026-11-22)

### Confirmed OGAM voice functionality in the current tree

- Microphone capture is owned by `audioRecorderService`; it produces WAV/MP3 files and exposes audio-level and mono 16 kHz sample callbacks.
- `RecorderAudioStream` adapts the recorder's samples to the realtime Whisper stream; it does not open a second microphone.
- `whisperService` supports local Whisper file/realtime transcription and a Qwen3-ASR 0.6B path through llama.rn; model downloads, cancellation, language selection and memory coordination exist.
- Voice note trimming removes pre-speech and trailing silence only when the trim is worthwhile; original recording is preserved on failure.
- `recordingController` owns start/stop/cancel intents and derives idle/listening/recording/transcribing from the shared voice session.
- `useSilenceEndpoint` implements audio-level-based VAD/end-of-turn detection; hands-free has speech onset and silence timeout; tap-to-talk is available; chat dictation is intentionally not ended by silence.
- `voiceService` also wraps the Android/iOS system speech-recognition service. It currently starts with hard-coded `en-US`; it is not a suitable local/offline default and must not be mistaken for Whisper.
- The Whisper store currently initializes its transcription language to `en`; user-selected languages persist. Russian-first onboarding/default-language behaviour must be addressed separately without overwriting an existing user's explicit preference.
- Current recorder comments explicitly state echo cancellation is disabled on both platforms because capture and playback do not share a voice-processing engine. The app must not claim reliable barge-in while its own TTS is audible; it waits for playback to finish until a shared AEC path is implemented and verified.
- The core tree does not contain the full TTS engine implementation. Existing TTS tests and architecture documents import `pro/audio` modules: Kokoro streaming TTS and OuteTTS saved-audio generation are currently in the private Pro surface. Qwen3-TTS is documented there as a stub, not a working phone runtime.
- `@offgrid/speech` remains a private sibling dependency supplying the voice-session state machine, silence endpoint timer/constants, language catalogue and WAV trim helpers. Consumers and observable behaviour are available, but the package source is not present in the standalone fork.

### Voice migration blockers and rules

1. Do not replace the missing `@offgrid/speech` state machine with a guessed transition function. Recover every event/state/field from consumers and tests; then create an OGAM-owned transition table and exhaustive tests before switching imports.
2. Do not route default voice input through the platform recognizer or a remote service. The default path must be local Whisper/Qwen ASR; system recognizer and user-configured remote ASR remain optional, visible alternatives.
3. Do not implement always-on wake word until battery, foreground-service, privacy indicator, stop control and offline model behaviour are tested on supported Android versions.
4. Barge-in is gated on a real capture/playback shared AEC implementation. The present `isEchoCancelled() === false` is an intentional safety truth, not a missing boolean to flip.
5. Preserve a single microphone owner, one sample stream, one session state owner, and one TTS playback coordinator. Never create parallel capture sessions.
6. TTS must expose streaming and saved-audio modes, stop/pause/resume, voice selection, progress, model lifecycle, memory admission and cancellation through a platform-neutral interface. Keep the Iron Man HUD's listening/thinking/speaking states synchronized to real engine state.
7. Add Russian ASR/TTS golden tests: numerals, names, dates, addresses, technical terms, mixed Russian/English and long multi-turn commands. Measure WER/latency and voice intelligibility on real OPPO hardware; do not infer Russian quality from multilingual claims.

### TTS replacement research — candidates, not yet selected

- **sherpa-onnx** (`k2-fsa/sherpa-onnx`): Apache-2.0 runtime, Android arm64/iOS support, offline ASR/TTS/VAD and related speech tasks. Best first runtime candidate for an independent native speech backend. Need select a Russian model with a compatible per-model license, verify the exact Android JNI/Kotlin interface, ABI/package size and latency. Runtime license does not grant rights to voice weights. https://github.com/k2-fsa/sherpa-onnx
- **Qwen3-TTS 12Hz 0.6B**: official Hugging Face checkpoint lists Apache-2.0 and 10 languages including Russian; supports streaming synthesis and voice cloning. Its official Python example uses PyTorch/CUDA; no verified Android-native runtime was found in this audit. Keep as a quality/desktop/home-server reference until a quantized Android path is independently demonstrated. https://github.com/QwenLM/Qwen3-TTS and https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base
- **Piper**: Russian voices exist, including official/community options, but runtime and each voice have separate licensing. The actively maintained `OHF-Voice/piper1-gpl` runtime is GPL-3.0; the archived `rhasspy/piper` runtime was MIT but is archived. Voice model cards may carry separate terms. Do not adopt Piper runtime or bundle a voice until the project chooses whether GPL-3.0 is acceptable and the exact voice card/license is checked. Candidate voices must be tested for Russian pronunciation, not assumed interchangeable. https://github.com/OHF-Voice/piper1-gpl ; voice inventory reference: https://piperhub.org/voices/language/ru/
- **Kokoro**: existing Pro design uses React Native ExecuTorch and lists a small streaming engine, but the inspected voice catalog lists English, Hindi and German voices, not Russian. Do not select it as the Russian Jarvis default without an actual supported Russian voice and quality test.
- **OuteTTS**: existing Pro design targets full saved-audio generation and voice cloning, but is documented as slower than interactive Kokoro; no verified Russian quality or standalone core integration in this audit. Retain as a reference, not a selected default.

### Siri spoken-interaction parity backlog

- continuous turn-taking: interruption, cancel, resume, barge-in only when AEC verified;
- streaming ASR partials and sentence-by-sentence TTS, with a shared transcript/audio timeline;
- wake word as opt-in, on-device and visibly controlled;
- spoken follow-ups using the same conversation context as typed chat;
- read-aloud of selected text, notifications and user-approved content with private-content redaction;
- voice actions with confirmation spoken and shown visually before execution;
- offline-first model selection and graceful no-model/no-microphone fallbacks;
- accessibility: captions, transcript replay, voice speed, voice identity, reduced animation and screen-reader labels.

### Tool-extension security gap discovered

- The core tool loop routes built-ins through the new Jarvis skill contract, but Pro/MCP `ToolExtension.execute` currently has a separate execution branch.
- The extension interface currently exposes tool definitions and OpenAI schemas, but no mandatory typed risk/capability/approval descriptor. MCP schemas can validate input shape, but input schema alone does not tell Jarvis whether a remote tool sends a message, deletes data or changes money.
- Do not infer safety from a tool name or from the fact it is enabled. A user enabling an extension is not approval for every external/destructive action.
- Required migration: add a mandatory skill descriptor to extension contracts; classify email send as external communication, calendar read as read-only, calendar write as reversible write requiring per-action approval, and unknown MCP operations as approval-required/blocked until their owner supplies a risk declaration. Add an approval queue/UI before enabling these actions through the planner.
- Pro source files are absent from the current standalone core checkout, so the private extension owners cannot yet be migrated here. Keep this as a release blocker for exposing MCP/Pro actions through Jarvis; do not silently disable or falsely certify them.

### Next voice/agent implementation order

1. Finish and verify the enabled-skill catalogue added to the core contract; expose it to the future planner without granting execution.
2. Define the extension-owned skill descriptor contract in core and write compatibility tests; keep existing Pro extension execution status explicitly marked as a gap until private implementation is available.
3. Build a complete `@offgrid/speech` contract inventory from all imports, event call sites and tests. Only then port the transition machine and endpoint timer.
4. Create the local TTS provider interface in core and a sherpa-onnx Android proof-of-concept on a separate branch; no model bundling until exact license and real-device test.
5. Unify ASR, TTS, turn state and HUD with a single event timeline; keep AEC and wake-word as separate verified milestones.


### Progress update — dependency-aware Jarvis task plans (2026-11-22)

Implemented in the OGAM branch:
- `src/services/planner/taskPlan.ts` defines a versioned, platform-neutral task-plan schema.
- Validation rejects malformed plans, unknown/duplicate/self dependencies, duplicate step IDs, invalid skill references and dependency cycles; it returns a deterministic topological order.
- `getReadyTaskSteps` only exposes steps whose dependencies are completed, and refuses draft, malformed or otherwise non-runnable plans. It is a pure function: reading readiness cannot execute or mutate anything.
- Added Node tests for valid order, dependency gating, missing dependencies, duplicate IDs, cycles, malformed dependency arrays and draft-plan rejection.
- Added the task-plan tests to the standalone audit workflow.

Boundary: this is the declarative plan/graph foundation, not yet a full execution engine. Persistent run history, pause/resume/cancel, retry, per-step approval UI, timeouts, compensation/undo and background scheduling remain future slices. The executor must resolve each `skillId` against the installed skill catalogue and the Android capability broker; model-provided plan JSON never executes directly.

The latest standalone workflow run after this change must be checked before treating the new test as passing.


### Progress update — deterministic plan-run lifecycle (2026-11-22)

Extended `src/services/planner/taskPlan.ts` with a pure run-state transition layer:
- Create a fresh run with all steps pending.
- Claim only the next dependency-ready step, in stable topological order.
- Resolve approval using a callback supplied by the installed skill registry; the plan JSON itself cannot mark an action safe.
- Hold high-risk steps in `awaiting-approval`; rejection cancels the remaining plan rather than silently continuing.
- Record step outputs, failures and bounded error text; retry a failed step without losing already completed dependencies.
- Pause only between steps; resume to ready; cancel only when no native action is still running. The planner refuses to claim cancellation/pause succeeded while an active executor still owns work.

Added tests for approval, rejection, execution-state transitions, output capture, failure/retry, pause/resume and cancellation guards. This is still a pure state layer: no native tool is invoked, no background job is started, and persistence/UI/executor integration are not yet wired. A real executor must cancel native work before confirming pause/cancel, persist state before/after side effects, and use idempotency keys to avoid duplicate writes after process death.

Current Actions run for the newest test commit: `45021671152` (check its final conclusion before calling this slice green).


### Progress update — local persistent plan store (2026-11-22)

Added `src/stores/taskPlanStore.ts` and exported `useTaskPlanStore`:
- Draft plans are validated before storage and receive app-generated IDs/timestamps.
- Draft editing is allowed only before activation; activation creates a run ledger with per-step state.
- The store exposes guarded claim, approval, complete, fail, retry, pause, resume, cancel and delete operations by delegating to the pure planner transitions.
- Plan definitions, step progress, outputs and bounded error text are persisted through OGAM's hydration-gated storage adapter.
- Plan storage is local-only by default and is deliberately not emitted to OGAM's device-sync mutation bus. This is not encryption; OS app-sandbox protection and the device's storage security still apply. Any future cloud/LAN sync needs a separate explicit opt-in and privacy review.
- Added Jest store tests for draft validation/editing, approval-gated execution state, and deletion guards.

Still missing before end-user release: plan editor/HUD, durable recovery after process death during an external side effect, executor idempotency, encrypted-at-rest handling for sensitive plan content, and native approval/cancellation UI. The current store is state persistence only; it does not execute skills itself.


### Android platform parity research — current OGAM native baseline (2026-11-22)

Official Android documentation confirms the native route for Siri-like integration:

- `VoiceInteractionService` is the system-selected global assistant entry point. Android keeps it alive for hotword support; its implementation must stay lightweight, while the heavier `VoiceInteractionSessionService` / session handles an active interaction. The user must select Jarvis as the active assistant; the app cannot silently replace the current assistant.
- A `VoiceInteractionSession` can receive assist data as `AssistStructure` and a screenshot through the documented assist callbacks. This is the supported basis for optional on-screen awareness; access must be explicitly configured, visible and minimized. It is not a licence to record or scrape the screen continuously.
- Android App Shortcuts provide static, dynamic and pinned entry points. Shortcuts can be surfaced by launchers and assistants; pinned shortcuts require user approval. Sensitive personal data must not be placed in shortcut metadata because launchers can access it.
- WorkManager is Android's recommended mechanism for persistent background work, including work that survives app exits/reboots, constraints, retries and chains. Long-running work uses a foreground service/notification and Android 16 introduces job-quota considerations for long-running workers. Voice capture and immediate interactive work must not be moved blindly into WorkManager.
- Foreground services must be noticeable and are restricted when started from background. Jarvis must choose between in-process coroutines, WorkManager, alarms and a foreground service according to the work type and Android version, rather than assuming arbitrary background execution is permitted.

Current OGAM audit:
- `AndroidManifest.xml` declares microphone, camera, calendar, notification, media/storage, network and several foreground-service permissions.
- It already has native modules for download management, local image generation, PDF extraction, LiteRT, device memory, clipboard/process-text, screenshot, directory/download sharing, local-network mesh and engine packs.
- It already has a working Android process-text selection action and a separate "Improve" action; these are useful Siri-like contextual entry points.
- No `VoiceInteractionService`, `VoiceInteractionSessionService`, assist-session implementation, App Shortcuts XML or React Navigation deep-link map was found in the current Android manifest/tree inspection. Therefore system-assistant activation and shortcut routing are not yet implemented.
- Existing microphone recording and React Native voice input are in-app capabilities; they do not by themselves make OGAM a selectable Android system assistant.

Implementation order:
1. Add a dedicated native `VoiceInteractionService` + `VoiceInteractionSessionService` pair with correct bind permission, metadata and lifecycle. Keep the service light; defer model loading until a session is opened.
2. Define a typed, consent-gated bridge from the native session to the React Native Jarvis session. Pass only explicit assist data selected by the user; strip/redact password, payment and private autofill fields. If assist data is unavailable or disabled, continue with voice-only mode.
3. Add deep-link routing to the assistant home, new conversation, voice mode and task-plan detail; then expose static/dynamic/pinned shortcuts that contain opaque IDs, not private content.
4. Use WorkManager only for durable non-interactive plan steps and downloads; use a visible foreground service only for work that must stay active now (e.g. an explicitly started voice interaction or user-visible long task). Respect Android 14+ service types and Android 16 quotas.
5. Test selection as default assistant, wake/session lifecycle, screen-off/locked behavior, cancellation, permission revocation, app process death, Android API 24 minimum and current Android versions. OPPO/ColorOS background policies require device testing; emulator success is not enough.

Official references:
- VoiceInteractionService: https://developer.android.com/reference/android/service/voice/VoiceInteractionService
- Assistant implementation and assist context: https://developer.android.com/training/articles/assistant
- AssistStructure: https://developer.android.com/reference/android/app/assist/AssistStructure
- App Shortcuts overview: https://developer.android.com/develop/ui/compose/system/shortcuts
- Shortcut creation and pinning consent: https://developer.android.com/develop/ui/compose/system/shortcuts/creating-shortcuts
- Shortcut privacy and management: https://developer.android.com/develop/ui/compose/system/shortcuts/managing-shortcuts
- Background work selection: https://developer.android.com/develop/background-work/background-tasks
- Persistent work and chains: https://developer.android.com/develop/background-work/background-tasks/persistent
- Long-running worker limits: https://developer.android.com/develop/background-work/background-tasks/persistent/how-to/long-running

All Android integrations are original OGAM/Jarvis code using public Android APIs. No proprietary Apple code or assets are involved.


### Canonical capability inventory

The current source-derived feature inventory and Siri parity status are maintained in `docs/jarvis/OGAM_FEATURE_PORT_MATRIX.md`. Update that matrix whenever a capability is migrated, blocked, verified or removed. It explicitly distinguishes existing OGAM functionality from new Jarvis parity work and records the remaining private-workspace/APK blockers.


### Russian-first voice stack research

The detailed, license-aware voice study is now in `docs/jarvis/VOICE_STACK_RESEARCH_RU_2026-11-22.md`. It compares MIT/Apache/BSD speech runtimes, Russian ASR/TTS/VAD candidates, measured server results versus unverified mobile performance, the private OGAM Pro audio feature contracts, and the OPPO device test plan. No Russian TTS default is selected until exact model revision/provenance and on-device quality/performance are verified.


### Verification update — planner and voice research (2026-11-22)

- Standalone Node audit run `45022345489` succeeded on commit `bbc12323401f30f278f7af592c46867c4a0d24c7`. It includes the skill-contract tests and task-plan graph/run-transition tests.
- Earlier split-module test runs failed because Node ESM could not resolve an extensionless TypeScript import. The planner was split into `taskPlan.ts` and `taskPlanRun.ts`, the import was corrected to `.ts`, and the latest audit passed.
- The new Zustand task-plan store has Jest tests in the repository, but the standalone audit does not run Jest. Do not treat those store tests, TypeScript typecheck, full Jest suite, Android build or device runtime as verified.
- PR #1 remains open/draft. The APK workflow still depends on private Pro checkout; no APK build or release is claimed.

---

### Two-directory forensic resolution & MIT history recovery (2026-11-22)

- **Main conflict resolved (`b7c06988`):** Merged `origin/main` (`14b27f7c`) keeping PR #1's OGAM-owned `../utils/ggufSplitFiles` import in `src/services/modelArtifactClassifier.ts`.
- **Forensic contract map completed (`docs/jarvis/TWO_DIRECTORIES_CONTRACT_MAP_2026-11-22.md`):**
  - Decoded all **56** `@offgrid/pro/*` subpaths referenced in tests and proved `src/` contains only **2** dynamic `require('@offgrid/pro')` sites (`src/bootstrap/loadProFeatures.ts`, `src/services/demoSeed.ts`), already safely stubbed by `src/bootstrap/proStub.js`.
  - Recovered MIT-licensed pre-extraction commits inside `sokfrut-tech/OGAM` itself: `efc85a70` (`@offgrid/design` palettes & typography/spacing/radius/living-field), `aaf68870` (`SpeechEndpointTimer` prior to `@offgrid/speech`), `6ba7d5cb` (`src/services/rag/{chunking,retrieval,vectorMath}.ts` prior to `@offgrid/rag/documents`), plus pre-Pro TTS history (`908af16a`, `767e0b91`).
  - Split the 171 symbols of `@offgrid/sync` into **Half A** (pure chat/thinking/markdown/queue utilities with zero crypto/networking) vs **Half B** (Personal Mesh TCP/NaCl/HKDF/mDNS).
- **Executed slices (`8 → 4` `package.json` external deps):**
  - `@offgrid/design` completely eliminated via `src/theme/designTokens.ts` (`2 → 0` imports).
  - Zero-importer Pro-only deps (`@offgrid/notes`, `@offgrid/notes-editor`, `@offgrid/writing`) removed from `package.json`, `metro.config.js`, and `jest.config.js`.
  - `@offgrid/speech` migrated `5` of `8` `src/` files (`9 → 4` imports): `src/utils/wavTrimPlan.ts`, `src/utils/voiceTurnSettings.ts`, and `src/utils/speechEndpoint.ts`.
- **Cross-linked research added:** `docs/jarvis/BREENO_COLOROS16_REFERENCE_SUMMARY_2026-11-22.md` (linking PR #2 `e4ef6016`) and `docs/jarvis/SIRI_APPLE_INTELLIGENCE_PARITY_BLUEPRINT_2026-11-22.md`.
- **Verified locally (Node `v26.13.1`):** All **17** open-core Node test suites (`68/68` test cases incl. `design-tokens`, `wav-trim-plan`, and `speech-endpoint`) passed locally; audit delta measured `1,983` files, `1,339` total refs (`1,354 → 1,339`), `4` `localFileDependencies` (`8 → 4`), `0` external hits in newly added files.

### `@offgrid/speech` 100% elimination checkpoint (`4 → 3` local deps, 2026-11-22)

- **Remaining 3 `src/` consumers migrated cleanly:**
  - `src/utils/transcriptionLanguages.ts` replaces `@offgrid/speech` `transcriptionLanguages` for both `src/components/TranscriptionLanguageSelect.tsx` and `src/services/qwenAsrEngine.ts` (preserving English-only `*.en` single-option Whisper models, multilingual Whisper without `fil`/`yue`, and Qwen3-ASR's `auto` + 30 named languages matching `language <Label><asr_text>` prefill).
  - `src/utils/voiceSessionMachine.ts` replaces `@offgrid/speech` `voiceSession` state machine (`initialVoiceSession`, `nextVoiceSession`, `micShouldBeOpen`, `speechMayPlay`, `MAX_EMPTY_TURNS`) for `src/services/voiceSession.ts` with full contract fidelity (`userStart`, `speechHeard`, `turnCaptured`, `dictationFinished`, two-strike `nothingHeard`, `userStop`, `replyStarted`/`replyEnded`, and `replayStarted`/`replayEnded` with `replayReturnsTo`).
- **Build config cleaned:** Removed `"@offgrid/speech"` from `package.json` and removed `speechPackagePath`, its `watchFolders` entry, and its `extraNodeModules['@offgrid/speech']` alias from `metro.config.js` (`package-lock.json` kept untouched per `340c80e2`; synthetic scanner test fixture kept in `scripts/__tests__/audit-offgrid-imports.test.mjs`).
- **Tests & CI updated:** Added `scripts/__tests__/transcription-languages.node.test.mjs` (4/4) and `scripts/__tests__/voice-session-machine.node.test.mjs` (7/7), wired into `.github/workflows/ogam-external-dependency-audit.yml`.
- **Verified locally (Node `v26.13.1`):** All **19** open-core Node test suites (**80/80** test cases) passed locally with 0 failures and 0 skipped; `node scripts/audit-offgrid-imports.mjs` measured `1,987` files scanned, `1,335` total external refs (`1,339 → 1,335`), `3` `localFileDependencies` (`4 → 3`: `@offgrid/models`, `@offgrid/rag`, `@offgrid/sync`), `0` `@offgrid/speech` hits in `src/` and build config (`1` synthetic fixture in `scripts/__tests__/audit-offgrid-imports.test.mjs`). Same strict verification limits still apply: TypeScript `tsc`, full Jest, Gradle/Kotlin, APK build, and OPPO Find X6 Pro runtime/device tests remain unexecuted here.

### Slice 4 checkpoint — `@offgrid/sync` Half A pure utilities migrated (`44 → 29` `src/` imports, 2026-11-22)

- **14 pure `src/` files cleared of `@offgrid/sync` (`15` import statements removed, zero Half B mesh/crypto files modified):**
  - `src/utils/messageContent.ts` restored from MIT `25276231^` + `withoutReasoning`.
  - `src/utils/chatMarkdown.ts` (`preprocessChatMarkdown`, `safeChatExternalUrl`) → `src/components/MarkdownText.tsx`.
  - `src/utils/chatThreadCore.ts` (`CHAT_THREAD_ROOT`, `chatThread`, `appendPlace`, `neighbourVersion`, `parentOfVersion`) → `src/utils/chatThread.ts`.
  - `src/utils/chatQueue.ts` (`chatQueueHeld`, `chatQueueHoldAfter`, `markQueuedSendNow`, `takeNextQueued`) → `src/services/generationService.ts`, `src/components/ChatInput/Toolbar.tsx`.
  - `src/utils/chatStreamHelpers.ts` (`startChatStreamTool`, `completeChatStreamTool`, `splitInlineReasoning`, `isSupportingChatContext`, `chatStreamPhase*`, `chatStreamPreview*`) → `chatStreamTools.ts`, `ChatMessage/index.tsx`, `ChatScreen/types.ts`, `useRemoteChatStreamPreviews.ts`, `remoteChatStreamStore.ts`.
  - `src/utils/chatSyncPrimitives.ts` (`chatListPreviewLine`, `isRuntimeOnlyMessage`, `PROMPT_ENHANCEMENT_*`, `readGatewayComputerId`) → `visibleMessages.ts`, `imagePromptEnhancement.ts`, `imageGenerationHelpers.ts`, `networkDiscovery.ts`.
- **Tests & CI updated:** Added 4 Node suites (`message-content`, `chat-markdown-and-sync-primitives`, `chat-thread-core`, `chat-queue-and-stream`) and wired all 4 into `.github/workflows/ogam-external-dependency-audit.yml`.
- **Verified locally (Node `v26.13.1`):** All **23** open-core Node test suites (**99/99** test cases) passed locally with 0 failures and 0 skipped; `node scripts/audit-offgrid-imports.mjs` measured `1,996` files scanned, `1,320` total external refs (`1,335 → 1,320`), `packageImports: 432` (`@offgrid/sync` `src/`: `44 → 29`, total: `148 → 133`), `localFileDependencies: 3`. TypeScript `tsc`, full Jest, Gradle/Kotlin, APK build, and OPPO Find X6 Pro runtime/device tests remain unexecuted here.

### Slice 5 checkpoint — `@offgrid/rag` + `@offgrid/rag/documents` 100% eliminated (`3 → 2` local deps, 2026-11-22)

- **Self-contained modules added:** `src/utils/remoteComputerSearch.ts` (3 `src/` consumers cleared) and `src/utils/ragDocumentsCore.ts` (16 `src/` consumers + 4 `__tests__/` files cleared).
- **Removed from build config:** Removed `"@offgrid/rag": "file:../shared/packages/rag"` from `package.json`, removed `ragPackagePath`, its `watchFolders` entry, and `@offgrid/rag` / `@offgrid/rag/documents` aliases from `metro.config.js` (`package-lock.json` kept untouched).
- **Tests & CI:** Added `scripts/__tests__/remote-computer-search.node.test.mjs` (`4/4`) and `scripts/__tests__/rag-documents-core.node.test.mjs` (`4/4`), wired into `.github/workflows/ogam-external-dependency-audit.yml`.
- **Verified locally (Node `v26.13.1`):** All **29** workflow Node test suites (**131/131** test cases: `13/13` plain + `118/118` `--experimental-strip-types`) pass with 0 failures and 0 skipped; `node scripts/audit-offgrid-imports.mjs` measured `2,008` files scanned, `1,283` total refs (`packageImports: 396`, `@offgrid/rag`: `0` in `src/`, `0` in `__tests__/`, `0` in `build-config`), `localFileDependencies: 2` (`@offgrid/models`, `@offgrid/sync`). Fixed `JarvisPcmStreamPlayerTest.FakeTrack.currentVolume` JVM signature clash (`setVolume(F)V`) discovered in `CI #45052196801` job `137300347889` (`:app:compileDebugKotlin` & `:app:processDebugManifest` passed). TypeScript `tsc`, full Jest, APK build, and OPPO Find X6 Pro runtime tests remain unexecuted here.

### Slice 6 checkpoint — `@offgrid/models` M3/M4/M7a partial port (`74 → 57` `src/` imports, 2026-11-23)

- **Self-contained modules & rewires:**
  - Cleared 2 remaining M3 `mediaStyles` imports (`ChatMessage/index.tsx`, `restyleStore.ts`) → `src/constants/mediaStyles.ts`.
  - Added `src/utils/boostPromo.ts` (7 `src/` files + `boostPromo.rendered.test.tsx`).
  - Added `src/utils/imageParameterCore.ts` (4 `src/` files + `imageParameterPolicy.test.ts`).
  - Added `src/utils/modelCapabilityRules.ts` (`MOBILE_MTP_DRAFT_TOKENS`, `prefersQ4_0`, `modelCardUrl`, `modelCardDeniesReasoning` across 5 `src/` files, clearing 4 `@offgrid/models` import statements).
- **Tests & CI:** Added `scripts/__tests__/boost-promo.node.test.mjs`, `scripts/__tests__/image-parameter-core.node.test.mjs`, and `scripts/__tests__/model-capability-rules.node.test.mjs` (`12/12`), wired into `.github/workflows/ogam-external-dependency-audit.yml`.
- **Audit delta:** `2,015` files scanned, `1,264` total refs (`packageImports: 377`, `@offgrid/models` `src/`: `74 → 57`, `test`: `33 → 31`, `total: 107 → 88`), `localFileDependencies: 2`. TypeScript `tsc`, full Jest, Gradle after `4772d58d`, APK assembly, and `PGEM10` device tests remain unexecuted here.

### Slice 7 checkpoint — `@offgrid/models` video intent, mmproj matcher, naming/credibility core (`57 → 51` `src/` imports, 2026-11-23)

- **Extracted modules:** `src/utils/videoIntent.ts` (`isVideoRequest`), `src/utils/mmprojMatcher.ts` (`modelIdentityStem`, `projectorsFor`), `src/utils/modelNamingCore.ts` (`ModelCredibilitySource`, `MoeParamCounts`, `isOffGridHfRepo`, `determineCredibility`, `splitGgufModelName`, `isRawModelName`, `modelDisplayName`, `parseMoeParams`, `baseModelKey`).
- **Migrated callers (`10` files):** `intentClassifier.ts`, `mmproj.ts`, `ModelCard.tsx`, `DownloadManagerScreen/items.tsx`, `ImageModelsTab.tsx`, `ImagePicksRow.tsx`, `DevicePicksRow.tsx`, `TextModelsTab.tsx`, `useDownloadedSpeedBadges.ts`, `llamaEngineSupport.ts` (`6` files completely cleared to `0` `@offgrid/models` imports; remaining `4` keep non-naming `@offgrid/models` symbols).
- **Tests & CI:** Added `scripts/__tests__/video-intent.node.test.mjs`, `mmproj-matcher.node.test.mjs`, and `model-naming-core.node.test.mjs` (`9/9` pass), wired into `.github/workflows/ogam-external-dependency-audit.yml`. All **36** workflow Node suites pass locally (**157/157** assertions, `0` fail, `0` skipped).
- **Audit delta:** `2,021` files scanned, `1,259` total refs (`packageImports: 371`, `@offgrid/models` `src/`: `57 → 51` across `50` files, `test`: `31`, `total: 88 → 82`), `localFileDependencies: 2`. TypeScript `tsc`, full Jest, Gradle after `4772d58d`, APK assembly, NDK/C++ smoke build (PR #2 `4449f9da`), and `PGEM10` device tests remain unexecuted here; GitHub Actions did not spawn new check-suites after run `#45073271250` (`720` total runs).

### Slice 8 checkpoint — `@offgrid/models` residency policy, mobile runtime/backends, fit budget & `reasoningBudgetPayload` (`51 → 35` `src/` imports, 2026-11-23)

- **Extracted / extended modules:** `src/utils/modelResidencyPolicy.ts`, `src/utils/mobileRuntimePolicy.ts`, `src/utils/modelFitBudget.ts`, and `reasoningBudgetPayload` in `src/utils/reasoningBudget.ts`.
- **Migrated callers (`17` `src/` + `2` `__tests__/` files):** `15` `src/` files cleared to `0` `@offgrid/models` imports (`modelResidency/{index,residents,logging}.ts`, `useResidentRows.ts`, `hardware.ts`, `cpuTopologyReader.ts`, `activeModelService/memory.ts`, `modalityBackends.ts`, `modalityPlacement.ts`, `llmHelpers.ts`, `llm.ts`, `fastestSettings.ts`, `providers/openAICompatibleProvider.ts`, `memoryBudget.ts`, `llmSafetyChecks.ts`), `TextModelsTab.tsx` and `devicePicks.ts` rewired for fit rules while keeping catalog symbols, and `modelResidency.test.ts` + `detailFilesFitHintUsesOwnedBudget.rendered.test.tsx` cleared of `@offgrid/models`.
- **Tests & CI:** Added `scripts/__tests__/model-residency-policy.node.test.mjs`, `mobile-runtime-policy.node.test.mjs`, and `model-fit-budget.node.test.mjs`, wired into `.github/workflows/ogam-external-dependency-audit.yml` (`42` steps). All **39** workflow Node suites pass locally (**167/167** assertions, `0` fail, `0` skipped).
- **Audit delta:** `2,027` files scanned, `1,241` total refs (`packageImports: 353`, `@offgrid/models` `src/`: `51 → 35` across `35` files, `test`: `31 → 29`, `total: 82 → 64`), `localFileDependencies: 2`. TypeScript `tsc`, full Jest, Gradle after `4772d58d`, APK assembly, and `PGEM10` device tests remain unexecuted here. (Separately on PR #2 `85a9326f`, WSL2 + NDK `r27d` `arm64-v8a` `libjarvis_supertonic_smoke.so` build and host TSan/ASan/UBSan race tests passed locally.)

### Slice 9 checkpoint — canonical types, MTP heads catalog, video/ASR policies & remote catalog (`35 → 17` `src/` imports, 2026-11-25)

- **Extracted OGAM-owned modules:** `src/types/modelCatalog.ts`, `src/utils/mtpHeadsCore.ts` (Gemma 4 E2B/E4B/26B-A4B/31B Q8_0 heads with verified HF LFS sizes and SHA-256 digests, superseding the earlier 2026-11-22 hold note above), `src/utils/videoPackPolicy.ts`, `src/utils/transcriptionEnginePolicy.ts`, and `src/utils/remoteCatalogCore.ts`.
- **Migrated callers (`21` `src/` files):** `18` `src/` files cleared to `0` `@offgrid/models` imports (`ModelsScreen/{TranscriptionModelsTab.tsx, index.tsx, utils.ts}`, `autoSetupPlan.ts`, `coreMLModelBrowser.ts`, `curatedLiteRTRegistry.ts`, `llamaEngineSupport.ts`, `modelDownloadService/types.ts`, `modelManager/downloadHelpers.ts`, `mtpHeads.ts`, `startModelDownload.ts`, `videoModelFiles.ts`, `whisperModelDownloads.ts`, `whisperModels.ts`, `recommendedModels.ts`, `appStore.ts`, `sync/mutation.ts`, `modelCatalogStore.ts`); `3` `src/` files cleared of helper/policy imports while retaining `CATALOG` (`useDownloadedSpeedBadges.ts`, `phoneVideoPacks.ts`, `qwenAsrModel.ts`).
- **Tests & CI:** Added `scripts/__tests__/mtp-heads-core.node.test.mjs`, `video-pack-policy.node.test.mjs`, `transcription-engine-policy.node.test.mjs`, and `remote-catalog-core.node.test.mjs`, wired into `.github/workflows/ogam-external-dependency-audit.yml` (`46` steps). All **43** `.mjs` test suites pass locally (**180/180** cases, `0` failed, `0` skipped), `tsc --noEmit --strict` passes on all 5 new `.ts` files, and PyYAML confirms workflow validity.
- **Audit delta:** `2,036` files scanned, `1,223` total refs (`packageImports: 335`, `@offgrid/models` `src/`: `35 → 17` across `17` files, `test`: `29`, `total: 64 → 46`), `localFileDependencies: 2`. Full RN Jest, Gradle/APK assembly, and device runtime were not executed on PR #1 in this slice. Remaining `17` `src/` files + `29` test hits + `package.json`/`metro.config.js` cleanup belong to **Slice 10 (`17 → 0`)**.

### Slice 10 checkpoint — Hugging Face client, SD image packs & grounded Guide KB (`17 → 11` `src/` imports, 2026-11-25)

- **Extracted / extended OGAM-owned modules:** `src/utils/sdImagePackPolicy.ts`, `src/utils/ggufSplitFiles.ts` (`collapseSplitGgufParts`), `src/utils/huggingFaceCore.ts`, and `src/utils/guideCore.ts` (with >100 mobile entries grounded in existing `src/` screens and UI labels).
- **Migrated callers (`7` `src/` + `6` `__tests__/` files):** `6` `src/` files cleared to `0` `@offgrid/models` imports (`huggingface.ts`, `GuideScreen/{guideTopics.ts, GuideTopicScreen.tsx, index.tsx, useGuideAction.ts}`, `guideVector.ts`); `huggingFaceModelBrowser.ts` cleared of `13/14` imports leaving only `CATALOG`; `6` test files cleared (`guideFlows.contract.test.ts`, `filmOnPhone.test.ts`, `filmWaitsForStills.rendered.test.tsx`, `imageStyles.rendered.test.tsx`, `videoStyles.rendered.test.tsx`, `residencyMatrix.modes.test.ts`).
- **Tests & CI:** Added `scripts/__tests__/sd-image-pack-policy.node.test.mjs`, `hugging-face-core.node.test.mjs`, and `guide-core.node.test.mjs`, wired into `.github/workflows/ogam-external-dependency-audit.yml` (`49` steps). All **46** `.mjs` test suites pass locally (**193/193** cases, `0` failed, `0` skipped), `tsc --noEmit --strict` passes on all 5 Slice 10 `.ts` files, and PyYAML validates workflow syntax.
- **Audit delta:** `2,042` files scanned, `1,214` total refs (`packageImports: 323`, `@offgrid/models` `src/`: `17 → 11` across `11` `CATALOG`/picks files, `test`: `29 → 23`, `total: 46 → 34`), `localFileDependencies: 2`. Live Audit CI `#45568112618` passed on Slice 9 (`ceb53a73b`). Full RN Jest, whole-workspace `tsc`, Gradle/APK build, and device tests were not executed on PR #1 in this slice. Remaining `11` `CATALOG`/picks `src/` files + `23` test hits + `package.json`/`metro.config.js` removal belong to **Slice 11 (`11 → 0`)**.

### Slice 11 checkpoint — `@offgrid/models` 100% eliminated (`11 → 0` `src/`, `2 → 1` local deps, 2026-11-25)

- **Extracted / extended OGAM-owned modules:** `src/utils/modelCatalogCore.ts` (`CATALOG` + `pickModelsForDevice`), `src/types/modelCatalog.ts` (`imageModes`), and `src/utils/videoPackPolicy.ts` (`templateStoryboard`, `videoModelInfo`).
- **Migrated callers (`11` `src/` + `19` test files + build config):** Cleared all remaining `11` `src/` files and all `21` non-fixture `@offgrid/models` test imports to `0`, and removed `@offgrid/models` from `package.json` and `metro.config.js` (`package-lock.json` kept untouched).
- **Tests & CI:** Added `scripts/__tests__/model-catalog-core.node.test.mjs`, wired into `.github/workflows/ogam-external-dependency-audit.yml` (`50` steps). All **47** `.mjs` test suites pass locally (**197/197** cases, `0` failed, `0` skipped), `tsc --noEmit --strict` passes on all 3 Slice 11 `.ts` files, and PyYAML confirms workflow validity.
- **Audit delta:** `2,044` files scanned, `1,181` total refs (`packageImports: 291`, `@offgrid/models` `src/`: `11 → 0`, `build-config`: `0`, `test`: `23 → 2` synthetic fixtures in `audit-offgrid-imports.test.mjs`), `localFileDependencies: 2 → 1` (`@offgrid/sync` only). Live Audit CI `#45571102536`/`#45571109845` passed on Slice 10 (`9079ef5f2`). Full RN Jest, whole-workspace `tsc`, Gradle/APK build, and device tests were not executed on PR #1 in this slice. Remaining external package dependency for **Slice 12+**: **`@offgrid/sync`** Half B (`29` `src/` hits + `104` test hits + `package.json`/`metro.config.js`/`jest.config.js`) and `pro/` decoupling.

### Slice 12 checkpoint — `@offgrid/sync` Half B pure contracts, entities, checksum & blob material (`29 → 9` `source`, 2026-11-25)

- **Extracted OGAM-owned modules:** `src/types/syncContracts.ts`, `src/utils/proEntitlementCore.ts`, `src/utils/syncEntityCore.ts` (`OFFGRID_SYNC_PORT`, entity constants, state field builders, `ogamModelTransferBlocker`), `src/utils/syncMessageContextCore.ts`, and `src/utils/syncChecksumCore.ts` (`CHUNK_SIZE`, `BLOB_FRAME_BYTES`, `BLOB_TOKEN_TTL_MS`, portable `IncrementalChecksum` SHA-512, pure HKDF-SHA256 `blobKeyBase64`/`createBlobMaterial` using OGAM-owned HKDF domain strings).
- **Migrated callers (`17` `src/` files / `20` hits + `3` matching unit tests):** Cleared `src/types/index.ts`, `src/stores/{appStore.ts, proAccessSlice.ts}`, `src/screens/ProDetailScreen/ProUnlockModal.tsx`, `src/services/proLicenseService.ts`, `src/services/modelManager/{index.ts, imageTransfer.ts, transferAdmission.ts}`, `src/services/sync/{knowledgeDocument.ts, localDevice.ts, nativeDirectorySource.ts, nativeProximity.ts, nativeSync.ts, messageContext.ts, mutation.ts, fileChecksum.ts, nativeBlobChannel.ts}`, plus `fileChecksum.test.ts`, `nativeBlobChannel.test.ts`, and `ProDetailScreen.test.tsx`.
- **Tests & CI:** Added 4 Node contract suites (`pro-entitlement-core`, `sync-entity-core`, `sync-message-context-core`, `sync-checksum-core`), wired into `.github/workflows/ogam-external-dependency-audit.yml` (`54` steps). All **51** `.mjs` suites pass locally (**214/214** test cases, `0` failed, `0` skipped), `tsc --noEmit --strict` passes on all 5 new `.ts` files, and PyYAML confirms workflow validity.
- **Audit delta:** `2,053` files scanned, `1,159` total refs (`packageImports: 268`, `@offgrid/sync` `source`: `29 → 9`, `test`: `104 → 101`), `localFileDependencies: 1` (`@offgrid/sync` only). Live Audit CI `#45580501348`/`#45580512539` passed on Slice 11 (`51caa9246`). Verification boundary: full RN Jest, whole-workspace `tsc`, Gradle/APK assembly, and physical device runtime were not executed on PR #1 in this slice. Remaining `@offgrid/sync` scope for **Slice 13**: `discovery.ts` (`4`), `engine.ts` (`4`), `bundle-desktop-host.sh` (`1`), `101` test hits, and `package.json`/`metro.config.js`/`jest.config.js` removal.



