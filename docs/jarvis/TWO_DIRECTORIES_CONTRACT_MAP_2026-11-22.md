# Two-Directory Migration Contract Map (`pro/` and `../shared`) — 2026-11-22

This document resolves the core blocker in `sokfrut-tech/OGAM` PR #1 (`feature/jarvis-step-2-storage-privacy`): **what lived inside the two external/private directories (`pro/` and `../shared/packages/*`), what open-source MIT source already exists in OGAM's own git history, what must be ported vs kept gated/dropped, and exact consumer-pinned TypeScript contracts.**

Evidence base:
- Automated audit JSONs (`ogam-import-audit.json` baseline `1,976` files / `1,354` refs → post-Slice 3A–3D `1,983` files / `1,339` refs → post-`@offgrid/speech` `1,987` files / `1,335` refs → post-`@offgrid/sync` Half A `1,996` files / `1,320` refs → post-`@offgrid/rag` `2,008` files / `1,283` refs → post-Slice 6 `2,015` files / `1,264` refs → post-Slice 7 `2,021` files / `1,259` refs → post-Slice 8 `2,027` files / `1,241` refs).
- Full AST/regex symbol parse of all **240** importing `src/` and `__tests__/` files on PR #1.
- `package.json`, `package-lock.json`, `metro.config.js`, `jest.config.js`, `tsconfig.json`, `.dependency-cruiser.js`, and `docs/SYNC_INTEGRATION_PLAN.md`.
- Local git history of `sokfrut-tech/OGAM` (`LICENSE`: **MIT License**).

> **Licensing note:** In `package-lock.json`, the external `../shared/packages/*` workspaces declare `"license": "AGPL-3.0-only"`, whereas `sokfrut-tech/OGAM` itself is MIT-licensed. Any code restored from `sokfrut-tech/OGAM`'s commits *prior* to extraction (`d300dbb0`, `908af16a`, `767e0b91`, `6ba7d5cb`, `aaf68870`, `efc85a70`, `25276231^`) comes from OGAM's MIT history. Unseen `../shared` / `pro/` source must be re-implemented cleanly in OGAM from consumer contracts and MIT/Apache references, never copied blindly.

---

## 1. Measured Audit Delta After Slice 8 (`@offgrid/models` `51 → 35` `src/`, 2026-11-23)

| Metric | Baseline (`b7c06988`) | After Slice 7 (`@offgrid/models` M4/Video/Naming) | After Slice 8 (`@offgrid/models` M2/M5 Policy & Fit) | Total Change |
|---|---:|---:|---:|---|
| Files scanned | 1,976 | 2,021 | **2,027** | `+51` (`+3` OGAM TS modules + `3` Node test suites since Slice 7) |
| `localFileDependencies` (`package.json`) | 8 | 2 | **2** | **`-6`** (`design`, `notes`, `notes-editor`, `writing`, `speech`, `rag` removed) |
| Total external refs | 1,354 | 1,259 | **1,241** | **`-113`** |
| `packageImports` | 457 | 371 | **353** | **`-104`** |
| `sharedWorkspacePaths` | 73 | 63 | **63** | **`-10`** |
| `@offgrid/design` imports | 2 | 0 | **0** | **100% eliminated** (`src/theme/designTokens.ts`) |
| `@offgrid/speech` imports | 9 | 1 | **1** *(0 `src/`, 1 test fixture)* | **100% eliminated from `src/`, `package.json`, `metro.config.js`** |
| `@offgrid/rag` (`+ /documents`) imports (`src/` / `__tests__/`) | 19 / 4 | 0 / 0 | **0 / 0** | **100% eliminated** (`remoteComputerSearch.ts` + `ragDocumentsCore.ts`, `package.json`, `metro.config.js`) |
| `@offgrid/models` imports (`src/` / total) | 87 / 118 | 51 / 82 | **35 / 64** | **Slice 8 `-16 src/` across `35` remaining files (`+3` modules + `reasoningBudget` cleared `15` `src/` files + `2` tests completely, `2` catalog files keep `CATALOG`/picks)** |
| `@offgrid/sync` imports (`src/` / total) | 44 / 148 | 29 / 133 | **29 / 133** | **`-15` source imports across `14` files (Half A 100% DONE; Half B Personal Mesh only left)** |
| `@offgrid/notes`, `@offgrid/notes-editor`, `@offgrid/writing` | 0 / 0 / 0 | 0 / 0 / 0 | **0 / 0 / 0** | Removed from `package.json`, `metro.config.js`, `jest.config.js` |
| Remaining `localFileDependencies` | — | 2 | **2** (`@offgrid/models`, `@offgrid/sync`) | Remaining migration targets mapped below |

---

## 2. Directory 1: `pro/` (`off-grid-ai/mobile-pro` Submodule)

### 2.1 Why `src/` Already Works Without `pro/`
- Core `src/` has **ONLY 2** `@offgrid/pro` runtime `require(...)` sites:
  1. `src/bootstrap/loadProFeatures.ts:18`
  2. `src/services/demoSeed.ts:240`
- Enforced by `.dependency-cruiser.js:56-60` (`core-not-to-pro-code`): core never imports `pro/` directly; `metro.config.js:107` and `jest.config.js:61-62` map `@offgrid/pro` → `src/bootstrap/proStub.js` (`module.exports = null;` — note `loadProFeatures.ts` checks for `null` and cleanly skips activation).
- Core integrates Pro via **hook/slot/screen registries** (`src/bootstrap/hookRegistry.ts`, `src/bootstrap/slotRegistry.ts`, `src/navigation/screenRegistry.ts`).
- All **153** remaining `@offgrid/pro/*` imports (`155` total minus `2` in `src/`) and **626** `pro-source-path` references live in `__tests__/` (ignored automatically by `jest.config.js` `proDependentTestPaths` when `pro/package.json` is absent) and **139** in `scripts/`.
- The remaining **5** `pro-source-path` hits in `src/` + **1** in `android/app/src/main/AndroidManifest.xml` are merely `offgrid://pro/unlock` and `https://getoffgridai.co/pro/app/` deep-link strings in `src/services/proCheckout.ts` and `src/utils/proPricing.ts`.

### 2.2 Complete Decoded Internal Structure of `pro/` (56 Imported Subpaths + Domains)

| Domain in `pro/` | Exact Subpaths Observed in `__tests__/` | Purpose | Jarvis / OGAM Core Parity Decision |
|---|---|---|---|
| **Audio / TTS Engine & UI** (`25` subpaths) | `pro/audio/audioFilePlayer`, `pro/audio/engine` (+ `EngineRegistry`, `OnDeviceEngineEmitter`), `pro/audio/engine/tts/engines/{kokoro/KokoroEngine, outetts/{OuteTTSEngine,models}, qwen3/{Qwen3TTSEngine,models}}`, `pro/audio/engine/types`, `pro/audio/streamPlaybackClock`, `pro/audio/streamingSpeech`, `pro/audio/ttsEngineSubscription`, `pro/audio/ttsLog`, `pro/audio/ttsStore`, `pro/audio/ui/{AudioEmptyState, AudioMessageBubble, AudioModeLayout, EngineBridge, MessageAudioMode, QuickSettingsAudioRow, TTSButton, TTSSection, VoicePickerPopover}` | Local TTS engines (Kokoro/OuteTTS/Qwen3), streaming playback, Voice/Audio chat UI slots | **REPLACE WITH JARVIS-OWNED RUSSIAN AUDIO STACK.** Also check MIT pre-Pro TTS commits in OGAM history (`908af16a` and `767e0b91`, prior to `d300dbb0`) for original hook/UI structure, and pair with PR #1's native `JarvisPcmStreamPlayer` + `tiny-voca-ru` / sherpa-onnx. |
| **MCP & OAuth Tools** (`19` subpaths) | `pro/mcp/{McpToolExtension, mcpClient, mcpService, mcpStore, schemaTrim, types}`, `pro/mcp/oauth/{index, adapters, metadata, oauthClient, pkce, tokenStore, types}`, `pro/ui/{McpGuideScreen, McpServersScreen, McpSettingsSection, McpToolPickerSheet, McpToolsScreen}` | Remote MCP server tools + OAuth 2.0 PKCE + Pro Email/Calendar extension hooks | **DEFER / REPLACE CORE SKILLS.** Build OGAM-owned local Android Calendar & Draft Email/Message skills (`SkillContract v1`) without paid MCP upsell; add MIT open MCP client later if needed via `toolContracts`. |
| **Sync UI & Orchestration** (`12` subpaths) | `pro/sync/{fileCompletionNotificationService, sharedFileSyncService, stateSyncService, syncControlCenterData, syncService, syncStore}`, `pro/ui/{ModelTransferSheet, SyncNotificationsScreen, SyncScreen/{ReceivingSection, SharedFilePreview, TransferActivitySection, styles, useExplicitFileShare}}` | Sync settings UI, notifications, file/model share sheets (wrapping `@offgrid/sync` engine) | **DEFER OPTIONAL.** Core engine is `@offgrid/sync`; Pro UI sheets stay cleanly gated behind `slotRegistry` / `hookRegistry` until Personal Mesh migration is scheduled. |
| **Video Studio** (`3` subpaths) | `pro/video/videoGenerationService`, `pro/video/studio/startPictureOffer`, `pro/video/ui/VideoGenerationSection` | On-device video studio UI & offer hooks | **DEFER OPTIONAL.** Keep free `mediaStudio` image generation working independently. |
| **Licensing & Demo** (`2` subpaths) | `pro/licensing/keygenClient`, `pro/demo/demoMode` | Paid license key validation & demo fixtures | **DROP / KEEP FREE-CORE.** Jarvis is offline-first free/open core; never prompt users for licenses or checkout. |
| **Notes & Scribe** (`comments in __tests__/pro/{notes,scribe}/`) | Backed by `@offgrid/notes`, `@offgrid/notes-editor`, `@offgrid/writing` | Rich WebView Tiptap notes page & Scribe spelling/rewrite | **DEFER / DROP WORKSPACE DEPS.** Zero `src/` imports in core OGAM. Local Jarvis notes can use plain Markdown/SQLite later without external AGPL workspaces. |

---

## 3. Directory 2: `../shared/packages/*` (`off-grid-ai/shared` Monorepo)

All packages below carry `"license": "AGPL-3.0-only"` in `package-lock.json`. Commits listed under **MIT Pre-Extraction Source** are **inside `sokfrut-tech/OGAM` itself** prior to monorepo extraction.

### 3.1 Master 10-Package Inventory & Migration Matrix

| Package | `package.json` Now? | Transitive Deps (`package-lock.json`) | `src/` Refs → Now | `__tests__/` Refs | MIT Pre-Extraction Commit in `OGAM` | Classification & Status |
|---|---|---|---:|---:|---|---|
| **`@offgrid/ui`** | Removed (`340c80e2`) | *(none)* | `0 → 0` | `0` | — | **DONE** (pure progress migrated by GPT in `src/utils/progressCore.ts`) |
| **`@offgrid/design`** | **Removed (this PR)** | *(none)* | `2 → 0` | `0` | `efc85a70` (`e2c0d3e3^`) | **DONE** (`src/theme/designTokens.ts` + `design-tokens.node.test.mjs`) |
| **`@offgrid/notes`** | **Removed (this PR)** | `tsup`, `typescript` (dev) | `0 → 0` | `0` | — | **PRO-ONLY / REMOVED** |
| **`@offgrid/notes-editor`** | **Removed (this PR)** | `@tiptap/*`, `marked 17.0.6`, `esbuild` (dev) | `0 → 0` | `0` | — | **PRO-ONLY / REMOVED** |
| **`@offgrid/writing`** | **Removed (this PR)** | `tsup`, `typescript` (dev) | `0 → 0` | `0` | — | **PRO-ONLY / REMOVED** |
| **`@offgrid/automation`** | Not in `package.json` | Used internally by `@offgrid/sync` | `0 → 0` | `0` | Added in `8741abb5` (Metro-only) | **TRANSITIVE OF `@offgrid/sync`** (keep Metro alias until `@offgrid/sync` Half B is migrated/removed) |
| **`@offgrid/speech`** | **Removed (this PR)** | *(cleared from `package.json` & `metro.config.js`; `package-lock.json` left untouched per `340c80e2`)* | `8 → 0` | `0` *(+1 synthetic fixture in audit test)* | `aaf68870:src/services/speechEndpoint.ts` (`94f8f714^`); `9fc50207` / `a6cd8033` Qwen3-ASR language map | **DONE (100% eliminated)**: `wavTrimPlan.ts`, `speechEndpoint.ts`, `voiceTurnSettings.ts`, `transcriptionLanguages.ts`, `voiceSessionMachine.ts` |
| **`@offgrid/rag`** (`+ /documents`) | **Removed (this PR)** | *(cleared from `package.json` & `metro.config.js`; `package-lock.json` left untouched)* | `19 → 0` | `4 → 0` | `6ba7d5cb:src/services/rag/{chunking,retrieval,vectorMath}.ts` (`5c12cc2f^`) | **DONE (100% eliminated)**: `src/utils/remoteComputerSearch.ts` + `src/utils/ragDocumentsCore.ts` (`8/8` Node tests pass) |
| **`@offgrid/models`** | Remains (`file:../shared/packages/models`) | `minisearch ^7.2.0` (dev) | `87 → 35` | `29` *(incl. scripts)* | Partial (`ggufSplitFiles`, `modelCompanionFiles`, `formatFileSize`, `toolResultBudget`, `reasoningBudget`, `toolLoopBudget`, `mediaStyles`, `boostPromo`, `imageParameterCore`, `modelCapabilityRules`, `videoIntent`, `mmprojMatcher`, `modelNamingCore`, `modelResidencyPolicy`, `mobileRuntimePolicy`, `modelFitBudget`) | **KEEP & PORT REMAINING SLICES** (`Guide`, `mtpHeads`, `huggingface` browser/resolution, `CATALOG` / `video` packs / `whisper` entries) |
| **`@offgrid/sync`** (`+ /rn, /rn-discovery, /portable`) | Remains (`file:../shared/packages/sync`) | `@noble/hashes 1.8.0`, `@offgrid/automation`, `@offgrid/models`, `bonjour-service`, `js-sha512`, `tweetnacl` | `44 → 29` | `104` | `25276231^:src/utils/messageContent.ts` + `src/components/MarkdownText.tsx`; `docs/SYNC_INTEGRATION_PLAN.md` (`c06b2211`) | **HALF A 100% DONE** (`14` `src/` files cleared via `messageContent.ts`, `chatMarkdown.ts`, `chatThreadCore.ts`, `chatQueue.ts`, `chatStreamHelpers.ts`, `chatSyncPrimitives.ts`); **HALF B (Personal Mesh) REMAINS** |

---

### 3.2 Package Detail: `@offgrid/speech` — **100% Eliminated (`8` of `8` `src/` Consumers Cleared)**

- `WAV_HEADER_BYTES`, `WAV_HEADER_SCAN_BYTES`, `planWavTrim` → `src/utils/wavTrimPlan.ts` (`src/services/wavTrimmer.ts`, tested by `scripts/__tests__/wav-trim-plan.node.test.mjs`, 4/4 pass)
- `SpeechEndpointTimer` → `src/utils/speechEndpoint.ts` (`src/components/ChatInput/useSilenceEndpoint.ts`, tested by `scripts/__tests__/speech-endpoint.node.test.mjs`, 4/4 pass)
- `VoiceTurnMode`, `DEFAULT_SILENCE_AFTER_SPEECH_MS`, `DEFAULT_SPEAKER_DRAIN_MS`, `SPEECH_ONSET_LOOKBACK_MS`, `SILENCE_AFTER_SPEECH_CHOICES_MS`, `SPEAKER_DRAIN_CHOICES_MS`, `VOICE_TURN_LABELS`, `VOICE_DELAY_LABELS`, `secondsLabel` → `src/utils/voiceTurnSettings.ts` (`voiceSections.tsx`, `appStore.ts`, `types/index.ts`, `useSilenceEndpoint.ts`)
- `isEnglishOnlyWhisperModel`, `transcriptionLanguages`, `TranscriptionEngine`, `TranscriptionLanguage` → `src/utils/transcriptionLanguages.ts` (`src/components/TranscriptionLanguageSelect.tsx` & `src/services/qwenAsrEngine.ts`, tested by `scripts/__tests__/transcription-languages.node.test.mjs`, 4/4 pass)
- `MAX_EMPTY_TURNS`, `initialVoiceSession`, `nextVoiceSession`, `micShouldBeOpen`, `speechMayPlay`, `VoiceSession`, `VoiceSessionEvent`, `VoiceSessionState`, `VoiceSessionPhase`, `VoiceReplayReturnState` → `src/utils/voiceSessionMachine.ts` (`src/services/voiceSession.ts`, tested by `scripts/__tests__/voice-session-machine.node.test.mjs`, 7/7 pass)
- `@offgrid/speech` dependency removed from `package.json`, and `speechPackagePath` / `watchFolders` / `extraNodeModules['@offgrid/speech']` removed from `metro.config.js`. Only the intentional synthetic test fixture in `scripts/__tests__/audit-offgrid-imports.test.mjs` remains (`1` test hit, `0` source hits).

---

### 3.3 Package Detail: `@offgrid/rag` and `@offgrid/rag/documents` — **100% Eliminated (`19/19` `src/` + `4/4` `__tests__/`)**

**Self-Contained Implementations:**
- **`src/utils/remoteComputerSearch.ts`** (`@offgrid/rag`, tested by `scripts/__tests__/remote-computer-search.node.test.mjs`, `4/4` pass): `searchRemoteComputer`, `withoutChatsOnDevice`, `RemoteSearchOutcome`, `RemoteSearchResult`, `SearchRemoteComputerOptions`. Migrated `src/services/pairedComputerSearch.ts`, `src/components/PairedComputerResults.tsx`, `src/hooks/usePairedComputerSearch.ts`.
- **`src/utils/ragDocumentsCore.ts`** (`@offgrid/rag/documents`, tested by `scripts/__tests__/rag-documents-core.node.test.mjs`, `4/4` pass): `DOCUMENT_SCHEMA_VERSION`, `CHUNK_CHARS`, `estimateTokens`, `textParts`, `pageNeedsOcr`, `cleanPages`, `splitPages`, `indexedText`, `contentTerms`, `documentMap`, `splitCitations`, `searchBlock`, `parseSearchBlock`, `describeTurnStatus`, `DocumentIngestService`, `DocumentTurnService`, plus all 18 TypeScript port/store contracts (`CitedSource`, `ConversationDocumentsPort`, `DocumentChunk`, `DocumentIndexStore`, `DocumentPage`, `DocumentProgress`, `DocumentScope`, `DocumentSource`, `DocumentTurnStatus`, `EmbedPort`, `ExtractPort`, `FoundPassage`, `KeywordHit`, `KeywordSearchPort`, `ProjectDocumentsPort`, `Scheduler`, `StoredDocument`). Migrated all `16` `src/` files + all `4` `__tests__/` files; removed `@offgrid/rag` from `package.json` and `metro.config.js` (`package-lock.json` kept untouched per `340c80e2`).

---

### 3.4 Package Detail: `@offgrid/models` (`148` Symbols → 7 Vertical Slices)

*Already migrated by GPT (Slice M1):* `formatFileSize`, `isCompanionFile` (partial `modelCompanionFiles`), `splitGgufPartNames` (`ggufSplitFiles`).

| Slice | Symbols & Scope | Primary Importers | Migration Readiness |
|---|---|---|---|
| **M2: Reasoning & Tool-Loop Budgets** | `REASONING_BUDGET_AUTO` (`0`), `REASONING_BUDGET_OPTIONS`, `reasoningBudgetLabel`, `reasoningBudgetPayload`, `thinkingBudgetPayload`, `openRouterReasoningPayload`, `DEFAULT_MAX_TOOL_CALLS`, `MIN_MAX_TOOL_CALLS`, `MAX_MAX_TOOL_CALLS`, `normalizeMaxToolCalls`, `MAX_TOOL_RESULT_CHARS`, `boundToolResult`, `callsWithinToolBudget`, `finalResponseFromToolResults`, `toolLimitFinalAnswerInstruction`, `toolPromptChars`, `toolResultCharBudget` | `appStore.ts`, `llmHelpers.ts`, `openAICompatibleProvider.ts`, `generationToolLoop.ts`, `toolResult.ts`, `useTextGenerationSettings.ts`, `textGenAdvancedSections.tsx` | **HIGH — pure math/payload rules.** Pin exact behavior against `remoteOpenRouterReasoning.rendered.test.tsx`, `remoteReasoningLevels.rendered.test.tsx`, `openAICompatibleStream.test.ts`, and `toolResult.test.ts`. |
| **M3: Media Styles & SD/Video Defaults** | `IMAGE_STYLES`, `VIDEO_STYLES`, `mediaStyle`, `MediaStyle`, `MediaStyleKind`, `SD_CHECKPOINT_HEADER_BYTES`, `isCompleteSDCheckpointHeader`, `isSDImageWeight`, `isImageWeightAvailableOn`, `QWEN_IMAGE_21_WEIGHT`, `imageEngineSettings`, `sdImagePackFor`, `standardImageModelDefaults`, `effectiveImageParameter`, `setImageParameterOverride`, `resolveImageParameters`, `ImageParameterStore`, `VIDEO_SETTING_KEYS`, `acceptsVideoSetting`, `isVideoRequest`, `isVideoWeightAvailableOn`, `videoArchitecture`, `videoModelDefaults`, `videoModelInfo`, `videoPackError`, `videoTakesStartImage`, `VideoGenerationRequestContract` | `mediaStyles.ts`, `huggingFaceModelBrowser.ts`, `phoneVideoPacks.ts`, `imageParameterPolicy.ts`, `ImageModelsTab.tsx`, `intentClassifier.ts`, `MediaStyles/*` | **MEDIUM-HIGH — pure rules + safetensors header check** (check `__tests__/unit/services/huggingFace*` and video/image parameter tests). |
| **M4: Model Naming, Capabilities & Classification** | `modelDisplayName`, `splitGgufModelName`, `isRawModelName`, `cleanModelName`, `extractQuantization`, `parseMoeParams`, `collapseSplitGgufParts`, `getModelFiles`, `getModelType`, `baseModelKey`, `modelIdentityStem`, `projectorsFor`, `mtpHeadForModel`, `mtpHeadForPrimaryFile`, `MOBILE_MTP_DRAFT_TOKENS` (`3`), `isOffGridHfRepo`, `modelCardUrl`, `modelCardDeniesReasoning`, `determineCredibility`, `transcriptionEngineOf`, `isTranscriptionEngineAvailableOn`, `prefersQ4_0`, `resolveHuggingFaceModel`, `searchHuggingFace`, `ModelEntry`, `ModelFileVariant`, `MtpHeadFile`, `HFSearchResult` | `ModelCard.tsx`, `DownloadManagerScreen/items.tsx`, `huggingface.ts`, `mmproj.ts`, `mtpHeads.ts`, `modelCardReasoning.ts`, `qwenAsrModel.ts` | **MEDIUM — inspect all `__tests__/` for filename/MoE/credibility expectations before writing.** |
| **M5: Device Fit, Memory Residency & Backends** | `PHONE_FIT_BUDGET`, `phoneFitBudget`, `fitTier`, `fitLabel`, `isLoadableOnDevice`, `pickModelsForDevice`, `mobileUseMmap`, `stateCacheBudgetMb`, `admissionBudgetMB`, `dirtyHeadroomMB`, `exceedsDirtyCeiling`, `fitsWithoutEviction`, `hasDirtyPressure`, `memoryWarningVictims`, `planEviction`, `freesIdleSpeechForGeneration`, `IPHONE_INFERENCE_THREADS`, `androidInferenceThreads`, `MOBILE_BACKEND_ROWS`, `MOBILE_DEVICE_ROWS`, `classifyMobileDevice`, `fastestBenchedBackend`, `planMobileFastestSettings`, `FitBudget`, `FitTier`, `Resident`, `ResidentType`, `PickCandidate`, `MobileBackend`, `MobileDevice`, `BackendBenchResult`, `ModalityPlacement` | `memoryBudget.ts`, `devicePicks.ts`, `modelResidency/*`, `fastestSettings.ts`, `hardware.ts`, `cpuTopologyReader.ts`, `llmSafetyChecks.ts`, `activeModelService/memory.ts` | **CRITICAL CARE — pinned by `budgetRedflow.test.ts` & memory tests.** Verify against all existing tests before touching thresholds. |
| **M6: Catalog Schema & Remote Refresh** | `CATALOG`, `MOBILE_CATALOG_URL`, `mobileCatalogKey`, `parseMobileCatalogSections`, `mergeCatalogEntries`, `diffMergedCatalog`, `loadCachedCatalog`, `refreshRemoteCatalog`, `MobileTextCatalogModel`, `MobileWhisperCatalogModel`, `MobileLiteRTCatalogEntry`, `MobileCoreMLCatalogRepo`, `MobileCatalogSections`, `CatalogCache`, `CatalogFetch` | `src/constants/models.ts`, `modelCatalogStore.ts`, `ModelsScreen/*` | **MEDIUM — note PR #1 must verify model-catalog invariants before changing catalog rows.** |

### M3 Media style catalog — first standalone slice (2026-11-22)

- Added `src/constants/mediaStyles.ts` with OGAM-owned image/video style records and a lookup helper.
- Existing persisted IDs were aligned to the OGAM preview asset map in `src/services/mediaStyles.ts`: 16 image IDs and 6 video IDs. UI, store, RestyleButton, generation routing and media-kind types now import the local catalog.
- Added `scripts/__tests__/media-style-catalog.node.test.mjs`: unique IDs, non-empty fields, expected ID sets, correct image/video lookup and existence of every local preview asset.
- Added the suite to `.github/workflows/ogam-external-dependency-audit.yml`.
- Independent OGAM-only audit passed on commit `9ff1eebc7101d5cfc783a0338026d778e62fb2fa`, run [#45051946914](https://github.com/sokfrut-tech/OGAM/actions/runs/45051946914).
- **Important evidence boundary:** the original `@offgrid/models` style catalog source is not present in the OGAM-only checkout, so the new prompt words are OGAM-authored replacements, not verified byte-for-byte upstream text. IDs and preview asset paths are verified locally; exact parity of original prompt wording and any additional upstream fields still needs comparison when the shared source is available. Do not claim full catalog parity yet.
- The full RN CI run `#45051946894` is not green: Jest shards fail largely because `@offgrid/models`, `@offgrid/rag` and private `pro/` checkouts are absent in the no-private-token CI environment (83/105 suites failed in one shard, 22 passed; other shards show the same dependency issue). Lint architecture reports 112 remaining workspace dependency violations. Type-check errors also include missing workspace module declarations and downstream implicit-any fallout. Android test job was still running at the last inspection; no APK/device pass is claimed.

### M2 Clean-Room Port Checkpoint — 2026-11-22

**Status: substantial partial port; all three independent contracts pass.**

- Tool output sizing: `src/utils/toolResultBudget.ts` owns `MAX_TOOL_RESULT_CHARS = 24,000` and `boundToolResult`. `src/services/tools/toolResult.ts` now uses this local helper.
- Reasoning policy: `src/utils/reasoningBudget.ts` owns `REASONING_BUDGET_AUTO`, fixed budget options, labels, local llama.rn payload and OpenRouter payload. Consumers migrated: `textGenAdvancedSections.tsx`, `llmHelpers.ts`, `appStore.ts`, and OpenRouter request construction in `openAICompatibleProvider.ts`.
- Tool-loop policy: `src/utils/toolLoopBudget.ts` owns default/min/max call counts, normalizer, per-turn call slicing, prompt character estimate, conservative result-budget calculation, tool-limit instruction, and completed-result recovery formatter. Consumers migrated: `generationToolLoop.ts`, `useTextGenerationSettings.ts`, and `appStore.ts`.
- The only remaining M2 symbol still imported from `@offgrid/models` is `reasoningBudgetPayload` in `openAICompatibleProvider.ts`; it is a separate remote-vision wire-format contract and needs a verified consumer contract before porting.
- Standalone suites: `tool-result-budget.node.test.mjs`, `reasoning-budget.node.test.mjs`, and `tool-loop-budget.node.test.mjs`. All passed in [OGAM external dependency audit #45051550585](https://github.com/sokfrut-tech/OGAM/actions/runs/45051550585) on head `3d88e21792dcf2c764cebf98c6006f5339c9b127`.
- This does **not** mean `@offgrid/models` has been removed: M3–M7 model imports and the RAG/sync workstreams remain. Keep package/workspace declarations until the final importer is migrated.

| **M7: Guide & Boost Copy** | ~~`BOOST_PROMO`, `BoostPromoSurface`, `boostPromoCopy`, `boostPromoLink`, `boostPromoVisible`~~ (**DONE via `src/utils/boostPromo.ts`**); Remaining Guide: `GUIDE_FIRST_LOOK`, `GUIDE_STARTERS`, `GUIDE_LINKS`, `GUIDE_KB_VECTOR_MODEL`, `MOBILE_GUIDE_GROUPS`, `GUIDE_FLOWS`, `GUIDE_NOT_SUPPORTED`, `GuideAnswerBlock`, `GuideTopicFacts`, `guide*` helpers, `templateStoryboard` | `GuideScreen/*` *(Boost callers `7 src/` + `1 test` migrated in Slice 6B)* | **PARTIAL DONE (`boostPromo.node.test.mjs`, `4/4`).** Only `GuideScreen/*` + `guideVector.ts` remain. |

---

### 3.5 Package Detail: `@offgrid/sync` (`171` Imported Symbols — Two Totally Different Halves!)

A critical discovery from AST analysis of all `33` `src/` consumers + `rn`/`rn-discovery` adapters: **nearly half of `@offgrid/sync` is pure chat-formatting/queue logic with ZERO cryptography or networking**, placed in `@offgrid/sync` only for desktop-mobile sharing.

#### Half A: Pure Chat / Reasoning / Markdown / Queue Utilities — **100% DONE (`14` `src/` Files, `-15` `@offgrid/sync` Imports)**
Zero TCP/NaCl/mDNS dependency; migrated into OGAM-owned self-contained modules and verified by 4 standalone Node test suites:
- `src/utils/messageContent.ts` (MIT `25276231^` + `withoutReasoning`, `2` `@offgrid/sync` imports eliminated, tested by `scripts/__tests__/message-content.node.test.mjs`, 4/4 pass): `REASONING_DELIMITERS`, `ReasoningDelimiter`, `TOOL_CALL_OPENERS`, `TOOL_CALL_CLOSERS`, `XML_TOOL_CALL_FUNCTION_MARKER`, `XML_TOOL_CALL_PARAMETER_MARKER`, `parseModelOutput`, `parseThinkingContent`, `partialTagSuffix`, `maxPartialTagSuffix`, `stripControlTokens`, `stripStreamingControlTokens`, `prepareMessageForSpeech`, `templateEmitsReasoning`, `withoutReasoning`.
- `src/utils/chatMarkdown.ts` (`src/components/MarkdownText.tsx`, tested by `chat-markdown-and-sync-primitives.node.test.mjs`): `preprocessChatMarkdown`, `safeChatExternalUrl`.
- `src/utils/chatThreadCore.ts` (`src/utils/chatThread.ts`, tested by `scripts/__tests__/chat-thread-core.node.test.mjs`, 4/4 pass): `CHAT_THREAD_ROOT`, `chatThread`, `appendPlace`, `neighbourVersion`, `parentOfVersion`.
- `src/utils/chatQueue.ts` (`src/services/generationService.ts`, `src/components/ChatInput/Toolbar.tsx`, tested by `scripts/__tests__/chat-queue-and-stream.node.test.mjs`): `ChatQueueHold`, `ChatQueueSignal`, `chatQueueHeld`, `chatQueueHoldAfter`, `markQueuedSendNow`, `takeNextQueued`.
- `src/utils/chatStreamHelpers.ts` (`src/services/sync/chatStreamTools.ts`, `src/components/ChatMessage/index.tsx`, `src/screens/ChatScreen/types.ts`, `useRemoteChatStreamPreviews.ts`, `src/stores/remoteChatStreamStore.ts`, tested by `chat-queue-and-stream.node.test.mjs`): `startChatStreamTool`, `completeChatStreamTool`, `ChatStreamTool`, `splitInlineReasoning`, `isSupportingChatContext`, `chatStreamPhaseLabel`, `chatStreamPhaseIsStatus`, `chatStreamPreviewHasMessageBody`, `chatStreamPreviewRows`, `ChatStreamPreview`, `ChatStreamPreviewRow`.
- `src/utils/chatSyncPrimitives.ts` (`src/utils/visibleMessages.ts`, `src/services/imageGenerationHelpers.ts`, `src/services/imagePromptEnhancement.ts`, `src/services/networkDiscovery.ts`, tested by `chat-markdown-and-sync-primitives.node.test.mjs`): `PROMPT_ENHANCEMENT_REASONING_LABEL`, `PROMPT_ENHANCEMENT_STATUS`, `isRuntimeOnlyMessage`, `chatListPreviewLine`, `readGatewayComputerId`.

#### Half B: Personal Mesh Protocol, NaCl Crypto, Blobs, & State Sync (`~20` Remaining `src/` Files, `29` Imports + `@offgrid/sync/rn` & `/rn-discovery`)
- Real encrypted device-to-device Personal Mesh (`SyncEngine`, `MultiTransportBridge`, `CompositeDiscoveryService`, `DiscoveryOrchestrator`, `BlobChannelHost`, `IncrementalChecksum`, `blobKeyBase64`, `createBlobMaterial`, `OFFGRID_SYNC_PORT`, `CHUNK_SIZE`, `BLOB_FRAME_BYTES`, `RnTcpTransport`, `RnDiscovery`, `hasProAccess`, OpLog LWW state entities `KNOWLEDGE_DOCUMENT_ENTITY`, `SHARED_FILE_ENTITY`, `TASK_*_ENTITY`, etc.).
- **Decision:** Keep intact during initial core standalone unblocking, then migrate deliberately using `docs/SYNC_INTEGRATION_PLAN.md` + `tweetnacl` + `@noble/hashes` (or decide whether Personal Mesh stays core or optional module after Android APK & Jarvis voice/skill MVP ship).

---

## 4. Recommended Next Execution Sequence for GPT

1. ~~Finish `@offgrid/speech` (`transcriptionLanguages` + `voiceSession` state machine)~~ → **DONE (`4 → 3` `localFileDependencies`, `0` `@offgrid/speech` imports in `src/`).**
2. ~~Extract `@offgrid/sync` **Half A** pure chat/reasoning/markdown/queue helpers into `src/utils/`~~ → **DONE (`44 → 29` `@offgrid/sync` `src/` imports across `14` files).**
3. ~~Port `@offgrid/rag/documents` + `@offgrid/rag` starting from MIT commit `6ba7d5cb:src/services/rag/*`~~ → **DONE (`3 → 2` `localFileDependencies`, `0` `@offgrid/rag` imports in `src/`, `__tests__/`, or build config).**
4. Finish `@offgrid/models` slices (`M2` remote-vision `reasoningBudgetPayload` → `M3` → `M4` → `M5` → `M6` → `M7`) with strict parity against Jest specs → removes `@offgrid/models` (`2 → 1`).
5. Port or scope `@offgrid/sync` **Half B** (Personal Mesh) + `@offgrid/automation` → reaches **`0` `localFileDependencies` and clean standalone Android/Jest/TSC builds without `../shared` or `pro/`**.

---

## 5. Slice 7, PR #2 Supertonic Smoke & CI Diagnosis (`2026-11-23`)

- **Slice 7 audit (`OGAM_PR1`):** `2,021` files scanned, `1,259` refs (`packageImports: 371`, `localFileDependencies: 2`, `@offgrid/models`: `57 → 51` `src/` hits across `50` files, `31` `test` hits, `82` total; `0` `build-config`).
- **Extracted modules (`src/utils/`):** `videoIntent.ts` (`isVideoRequest`), `mmprojMatcher.ts` (`modelIdentityStem`, `projectorsFor`), `modelNamingCore.ts` (`isOffGridHfRepo`, `determineCredibility`, `splitGgufModelName`, `isRawModelName`, `modelDisplayName`, `parseMoeParams`, `baseModelKey`).
- **Migrated `src/` callers (`10` total, `6` cleared to `0` `@offgrid/models` imports):** `intentClassifier.ts`, `mmproj.ts`, `ModelCard.tsx`, `DownloadManagerScreen/items.tsx`, `ImageModelsTab.tsx`, `ImagePicksRow.tsx`; plus `DevicePicksRow.tsx`, `TextModelsTab.tsx`, `useDownloadedSpeedBadges.ts`, `llamaEngineSupport.ts` (these `4` keep non-naming `@offgrid/models` symbols for M4 follow-up).
- **Verified locally:** All **36** suites (`157/157` tests, `0` failed, `0` skipped) in `.github/workflows/ogam-external-dependency-audit.yml` pass after wiring `video-intent.node.test.mjs`, `mmproj-matcher.node.test.mjs`, and `model-naming-core.node.test.mjs`. TypeScript `tsc`, RN Jest, Gradle after `4772d58d`, APK build, and `PGEM10` device runtime are not executed here.
- **PR #2 (`4449f9da`, `docs/research-breeno-coloros-2026-11-22`):** Clean-applying `supertonic-generation-cancel.patch` on `soniqo/speech-core@59b9d7902ea62dbbbfb95e139e2bf0e8957f8753`, 7-file `arm64-v8a` JNI/CMake smoke harness + host race test, and manual `workflow_dispatch` `.github/workflows/research-supertonic-litert-arm64-smoke.yml` (`yaml.safe_load` valid; NDK/C++ compilation pending CI runner execution).
- **GitHub Actions auto-trigger halt:** `sokfrut-tech/OGAM` reached `720` runs ending at `#45073271250` (`2026-11-22T21:38:57Z`), after which `github-actions` stopped spawning check-suites on new PR pushes.

---

## 6. Slice 8 Update — Residency, Mobile Runtime, Fit Budget & Reasoning Payload (`2026-11-23`)

- **Slice 8 audit (`OGAM_PR1`):** `2,027` files scanned, `1,241` refs (`packageImports: 353`, `sharedWorkspacePaths: 63`, `proSourcePaths: 788`, `privateCheckoutReferences: 37`, `localFileDependencies: 2`, `@offgrid/models`: `51 → 35` `src/` hits across `35` files, `31 → 29` `test` hits, `64` total; `0` `build-config`).
- **Extracted/extended modules (`src/utils/`):** `modelResidencyPolicy.ts`, `mobileRuntimePolicy.ts`, `modelFitBudget.ts`, and `reasoningBudget.ts` (`reasoningBudgetPayload`).
- **Migrated callers (`17` `src/` files + `2` `__tests__/` files):** Cleared `15` `src/` files completely (`16` import statements: `modelResidency/{index,residents,logging}.ts`, `useResidentRows.ts`, `hardware.ts`, `cpuTopologyReader.ts`, `activeModelService/memory.ts`, `modalityBackends.ts`, `modalityPlacement.ts`, `llmHelpers.ts`, `llm.ts`, `fastestSettings.ts`, `openAICompatibleProvider.ts`, `memoryBudget.ts`, `llmSafetyChecks.ts`), plus `2` `src/` files (`TextModelsTab.tsx`, `devicePicks.ts`) keeping `CATALOG`/picks and `2` test files (`modelResidency.test.ts`, `detailFilesFitHintUsesOwnedBudget.rendered.test.tsx`).
- **Verified locally:** All **39** suites (**167/167** tests, `0` failed, `0` skipped) in `.github/workflows/ogam-external-dependency-audit.yml` (`42` steps, YAML valid) pass after wiring `model-residency-policy.node.test.mjs`, `mobile-runtime-policy.node.test.mjs`, and `model-fit-budget.node.test.mjs`. TypeScript `tsc`, RN Jest, Gradle after `4772d58d`, APK assembly, and `PGEM10` runtime were not executed here.
- **Cross-PR PR #2 update (`85a9326f`):** Host C++ cancel-race tests (`5/5` normal + ASan/UBSan + TSan, `seq_cst` Dekker ordering) and NDK `r27d` Android API 24 `arm64-v8a` `libjarvis_supertonic_smoke.so` build (`0x4000` 16 KB `PT_LOAD`, zero ORT/curl) passed locally in WSL2 `Ubuntu 26.04`.

---

## 7. Slice 9 Update — Canonical Types, MTP Heads, Video/ASR Policies & Remote Catalog (`2026-11-25`)

- **Slice 9 audit (`OGAM_PR1`):** `2,036` files scanned, `1,223` refs (`packageImports: 335`, `sharedWorkspacePaths: 63`, `proSourcePaths: 788`, `privateCheckoutReferences: 37`, `localFileDependencies: 2`, `@offgrid/models`: `35 → 17` `src/` hits across `17` files, `29` `test` hits, `46` total; `0` `build-config`).
- **Added OGAM-owned modules:** `src/types/modelCatalog.ts`, `src/utils/mtpHeadsCore.ts` (Gemma 4 E2B/E4B/26B-A4B/31B Q8_0 heads with verified Hugging Face LFS SHA-256 checksums), `src/utils/videoPackPolicy.ts`, `src/utils/transcriptionEnginePolicy.ts`, and `src/utils/remoteCatalogCore.ts` (keeping `MOBILE_CATALOG_URL` compatible with `checkForNewModels.rendered.test.tsx`).
- **Migrated callers (`21` `src/` files):** Cleared `18` `src/` files to `0` `@offgrid/models` imports (`ModelsScreen/{TranscriptionModelsTab.tsx, index.tsx, utils.ts}`, `autoSetupPlan.ts`, `coreMLModelBrowser.ts`, `curatedLiteRTRegistry.ts`, `llamaEngineSupport.ts`, `modelDownloadService/types.ts`, `modelManager/downloadHelpers.ts`, `mtpHeads.ts`, `startModelDownload.ts`, `videoModelFiles.ts`, `whisperModelDownloads.ts`, `whisperModels.ts`, `recommendedModels.ts`, `appStore.ts`, `sync/mutation.ts`, `modelCatalogStore.ts`), plus cleared non-`CATALOG` imports from `3` `src/` files (`useDownloadedSpeedBadges.ts`, `phoneVideoPacks.ts`, `qwenAsrModel.ts`).
- **Verified locally (Node `v26.13.1` + `tsc --strict --noEmit` on new modules):** All **43** `.mjs` suites in `scripts/__tests__/` (**180/180** test cases, `0` failed, `0` skipped) and `.github/workflows/ogam-external-dependency-audit.yml` (`46` steps, PyYAML valid) pass locally, and `tsc --noEmit --strict` passes on all 5 new `.ts` modules. Full RN Jest, Gradle/APK assembly, and device runtime were not executed on PR #1 in this slice.
- **Remaining `@offgrid/models` scope (Slice 10):** `17` `src/` files (`DevicePicksRow.tsx`, `useDownloadedSpeedBadges.ts`, `constants/models.ts`, `Guide*`, `guideVector.ts`, `TextModelsTab.tsx`, `useTextModels.ts`, `devicePicks.ts`, `huggingface.ts`, `huggingFaceModelBrowser.ts`, `storage.ts`, `phoneVideoPacks.ts`, `qwenAsrModel.ts`, `modelHelpers.ts`) + `29` test hits + `package.json`/`metro.config.js` removal.

---

## 8. Slice 10 Update — Hugging Face Client, SD Image Packs & Grounded Guide KB (`2026-11-25`)

- **Slice 10 audit (`OGAM_PR1`):** `2,042` files scanned, `1,214` refs (`packageImports: 323`, `sharedWorkspacePaths: 63`, `proSourcePaths: 791`, `privateCheckoutReferences: 37`, `localFileDependencies: 2`, `@offgrid/models`: `17 → 11` `src/` hits across `11` files, `29 → 23` `test` hits, `34` total; `0` `build-config`). Live Audit CI `#45568112618` passed on preceding Slice 9 commit `ceb53a73b`.
- **Added / extended OGAM-owned modules:** `src/utils/sdImagePackPolicy.ts` (`QWEN_IMAGE_21_WEIGHT`, `SD_CHECKPOINT_HEADER_BYTES`, `sdImagePackFor`, `isSDImageWeight`, `isImageWeightAvailableOn`, `imageEngineSettings`, portable `Uint8Array` `isCompleteSDCheckpointHeader`), `src/utils/ggufSplitFiles.ts` (extended with `collapseSplitGgufParts`), `src/utils/huggingFaceCore.ts` (`searchHuggingFace`, `getModelFiles`, `resolveHuggingFaceModel`, `getModelType`, `extractQuantization`, `cleanModelName`), and `src/utils/guideCore.ts` (`GUIDE_KB_VECTOR_MODEL`, `MOBILE_GUIDE_GROUPS`, `GUIDE_LINKS`, `GUIDE_FIRST_LOOK`, `GUIDE_STARTERS`, `guideTopicsFor`, progressive `guideAnswer*`, `guideFlowAnswer*`, `guideGrounding`, `GUIDE_FLOWS`, `GUIDE_NOT_SUPPORTED`, `guideFlowLabels`).
- **Migrated callers (`7` `src/` files + `6` `__tests__/` files):** Cleared `6` `src/` files completely to `0` `@offgrid/models` imports (`huggingface.ts`, `GuideScreen/{guideTopics.ts, GuideTopicScreen.tsx, index.tsx, useGuideAction.ts}`, `guideVector.ts`), cleared `13/14` symbols in `huggingFaceModelBrowser.ts` keeping only `CATALOG`, and cleared `6` test files (`guideFlows.contract.test.ts`, `filmOnPhone.test.ts`, `filmWaitsForStills.rendered.test.tsx`, `imageStyles.rendered.test.tsx`, `videoStyles.rendered.test.tsx`, `residencyMatrix.modes.test.ts`).
- **Verified locally (Node `v26.13.1` + `tsc --strict --noEmit` on Slice 10 modules):** All **46** `.mjs` suites in `scripts/__tests__/` (**193/193** test cases, `0` failed, `0` skipped), `.github/workflows/ogam-external-dependency-audit.yml` (`49` steps, PyYAML valid), and `tsc --noEmit --strict` on the 5 Slice 10 `.ts` files pass locally. Full RN Jest, whole-workspace `tsc`, Gradle/APK assembly, and device runtime were not executed on PR #1 in this slice.
- **Remaining `@offgrid/models` scope (Slice 11):** Final `11` `src/` files (each importing `CATALOG`, plus `pickModelsForDevice` in `devicePicks.ts`) + `23` test hits + removal of `@offgrid/models` from `package.json` and `metro.config.js`.

---

## 9. Slice 11 Update — `@offgrid/models` 100% Eliminated (`11 → 0` `src/`, `2 → 1` local deps, `2026-11-25`)

- **Slice 11 audit (`OGAM_PR1`):** `2,044` files scanned, `1,181` refs (`packageImports: 291`, `sharedWorkspacePaths: 62`, `proSourcePaths: 791`, `privateCheckoutReferences: 37`, `localFileDependencies: 1` (`@offgrid/sync` only), `@offgrid/models`: **`11 → 0`** `src/` hits, **`0`** `build-config`, `23 → 2` `test` hits keeping only synthetic fixture literals inside `scripts/__tests__/audit-offgrid-imports.test.mjs`). Live Audit CI `#45571102536` / `#45571109845` passed on preceding Slice 10 commit `9079ef5f2`.
- **Added / extended OGAM-owned modules:** `src/utils/modelCatalogCore.ts` (`CATALOG` containing curated text/vision, Qwen3-ASR 0.6B, all 18 `catalog/models.json` image models + Qwen Image 2.1, and 6 Wan video packs with verified Hugging Face LFS SHA-256 digests, plus `pickModelsForDevice`), extended `src/types/modelCatalog.ts` (`imageModes`), and extended `src/utils/videoPackPolicy.ts` (`templateStoryboard`, `videoModelInfo`).
- **Migrated callers (`11` `src/` files + `19` test files / `21` test hits + build config):** Cleared every remaining `@offgrid/models` import across `src/` (`DevicePicksRow.tsx`, `useDownloadedSpeedBadges.ts`, `constants/models.ts`, `TextModelsTab.tsx`, `useTextModels.ts`, `devicePicks.ts`, `huggingFaceModelBrowser.ts`, `modelManager/storage.ts`, `phoneVideoPacks.ts`, `qwenAsrModel.ts`, `modelHelpers.ts`) and across all real `__tests__/` harnesses, video suites, and integration specs (`desktopModelPulls.ts`, `desktopVideoServer.ts`, `phoneVideoServices.ts`, `qwen3AsrTranscription`, `devicePicks`, `recommendedDetailsFailKeepCatalogFacts`, `searchHidesUnrunnableModels`, `searchHidesUploadsNeedingNewerEngine`, `phoneVideoPacks.test.ts`, and `10` video rendered/engine tests), and removed `@offgrid/models` from `package.json` and `metro.config.js` (`package-lock.json` kept untouched per workspace convention).
- **Verified locally (Node `v26.13.1` + `tsc --strict --noEmit` on Slice 11 modules):** All **47** `.mjs` suites in `scripts/__tests__/` (**197/197** test cases, `0` failed, `0` skipped, including `model-catalog-core.node.test.mjs`), `.github/workflows/ogam-external-dependency-audit.yml` (`50` steps, PyYAML valid), and `tsc --noEmit --strict` on `src/types/modelCatalog.ts`, `src/utils/modelCatalogCore.ts`, and `src/utils/videoPackPolicy.ts` pass locally. Full RN Jest, whole-workspace `tsc`, Gradle/APK assembly, and device runtime were not executed on PR #1 in this slice.
- **Remaining private workspace scope (Slice 12+):** Only **`@offgrid/sync`** Half B (`29` `src/` hits + `104` test hits + `package.json`/`metro.config.js`/`jest.config.js`) and `pro/` decoupling remain for full open-core standalone builds without `PRO_SUBMODULE_PAT`.

---

## 10. Slice 12 Update — `@offgrid/sync` Half B Contracts, Entities, Checksum & Blob Material (`29 → 9` `source`, `2026-11-25`)

- **Slice 12 audit (`OGAM_PR1`):** `2,053` files scanned, `1,159` refs (`packageImports: 268`, `sharedWorkspacePaths: 62`, `proSourcePaths: 791`, `privateCheckoutReferences: 38`, `localFileDependencies: 1` (`@offgrid/sync` only), `@offgrid/sync` `source`: **`29 → 9`** across `3` remaining files — `src/services/sync/discovery.ts` (4), `src/services/sync/engine.ts` (4), `scripts/blob-e2e/bundle-desktop-host.sh` (1); `test`: **`104 → 101`**; `build-config`: `6`).
- **Added OGAM-owned pure TypeScript modules:**
  - `src/types/syncContracts.ts` — canonical zero-runtime TypeScript types covering devices, provenance, timelines/tool artifacts/metrics/turns, model transfer manifests, Pro admission & activation failures, knowledge/shared-file/writing entities, native directory copy, health snapshots, transport/discovery bridges, pairing/revocation persistence, `SyncEngineOptions`, `BlobChannelHost`/`BlobEndpoint`, `RnTcpModule`, and `RnZeroconf`.
  - `src/utils/proEntitlementCore.ts` — `hasProAccess` and `projectPersonalMeshActivationFailure`.
  - `src/utils/syncEntityCore.ts` — `OFFGRID_SYNC_PORT` (`37878`), all `9` `*_ENTITY` constants, `createKnowledgeDocumentStateFields`, `createSharedFileStateFields`, `writingLearnedEntityId`, `createWritingLearnedFields`, `parseWritingLearned`, and `ogamModelTransferBlocker`.
  - `src/utils/syncMessageContextCore.ts` — `serializeSyncedMessageContext` and `projectSyncedMessageTurn`.
  - `src/utils/syncChecksumCore.ts` — `CHUNK_SIZE` (`262_144`), `BLOB_FRAME_BYTES` (`4_194_304`), `BLOB_TOKEN_TTL_MS` (`300_000`), `checksumFromSha512Hex`, portable `BigInt` streaming FIPS 180-4 SHA-512 `IncrementalChecksum`, pure SHA-256 / HMAC-SHA256 / RFC 5869 HKDF-SHA256, `blobKeyBase64`, and `createBlobMaterial`. Because upstream `off-grid-ai/shared` is unavailable (404), `blobKeyBase64` uses an OGAM-owned HKDF domain string (`offgrid-sync-blob-v1` / `offgrid-sync-blob-key-v1:<requestId>`) self-consistent across OGAM senders/receivers and native `BlobFrameCipher` adapters.
- **Migrated callers (`17` `src/` files / `20` imports cleared + `3` matching unit tests):** Cleared `src/types/index.ts`, `src/stores/{appStore.ts, proAccessSlice.ts}`, `src/screens/ProDetailScreen/ProUnlockModal.tsx`, `src/services/proLicenseService.ts`, `src/services/modelManager/{index.ts, imageTransfer.ts, transferAdmission.ts}`, and `src/services/sync/{knowledgeDocument.ts, localDevice.ts, nativeDirectorySource.ts, nativeProximity.ts, nativeSync.ts, messageContext.ts, mutation.ts, fileChecksum.ts, nativeBlobChannel.ts}`, plus `__tests__/unit/sync/{fileChecksum.test.ts, nativeBlobChannel.test.ts}` and `__tests__/rntl/screens/ProDetailScreen.test.tsx`.
- **Tests & CI:** Added `scripts/__tests__/pro-entitlement-core.node.test.mjs`, `sync-entity-core.node.test.mjs`, `sync-message-context-core.node.test.mjs`, and `sync-checksum-core.node.test.mjs`, wired into `.github/workflows/ogam-external-dependency-audit.yml` (`54` steps, PyYAML valid).
- **Verified locally (Node `v26.13.1` + `tsc --noEmit --strict` on all 5 new `.ts` modules):** All **51** `.mjs` suites in `scripts/__tests__/` (**214/214** test cases: `3/3` plain + `211/211` `--experimental-strip-types --test`, `0` failed, `0` skipped) pass locally, with `IncrementalChecksum` cross-verified byte-for-byte against `node:crypto` SHA-512 and `hkdfSha256` cross-verified against RFC 5869 + `node:crypto.hkdfSync`. Verification boundary: full RN Jest, whole-workspace `tsc`, Gradle/APK assembly, and physical device runtime were not executed on PR #1 in this slice.
- **Remaining `@offgrid/sync` scope (Slice 13):** `discovery.ts` (`4` hits), `engine.ts` (`4` hits), `scripts/blob-e2e/bundle-desktop-host.sh` (`1` hit), `101` test hits, and removal of `@offgrid/sync` from `package.json`, `metro.config.js`, and `jest.config.js`.

---

## 11. Slice 13 Update — `@offgrid/sync` 100% Eliminated from `src/` & Build Config (`9 → 0` `source`, `1 → 0` `localFileDependencies`, `2026-11-25`)

- **Slice 13 audit (`OGAM_PR1`):** `2,057` files scanned, `1,137` refs (`packageImports: 248`, `sharedWorkspacePaths: 59`, `proSourcePaths: 791`, `privateCheckoutReferences: 39`, `localFileDependencies: 0` — down from **`9` (`@offgrid/design`, `@offgrid/models`, `@offgrid/notes`, `@offgrid/notes-editor`, `@offgrid/rag`, `@offgrid/speech`, `@offgrid/sync`, `@offgrid/ui`, `@offgrid/writing`) → `0`**!), **`@offgrid/sync` `source`: `9 → 0`**, **`build-config`: `0`**, **`test`: `101 → 90`** (`89` Pro-dependent suites + `1` synthetic string fixture in `scripts/__tests__/audit-offgrid-imports.test.mjs`). ALL 10 `@offgrid/*` sibling packages now have **`0` hits in `source`** and **`0` hits in `build-config`**; only the two safely-stubbed dynamic `require('@offgrid/pro')` sites remain in `src/`.
- **Added / updated OGAM-owned pure ES2022 modules (zero runtime relative imports, zero npm deps):**
  - `src/utils/syncDiscoveryCore.ts` — `PAIRING_CODE_ALPHABET`, `PAIRING_CODE_LENGTH`, `normalizePairingCode`, `isDialableAddress`, `createTxtRecord`, `parseTxtRecord`, `RnDiscovery`, `CompositeDiscoveryService`, and `DiscoveryOrchestrator`.
  - `src/utils/syncEngineCore.ts` — pure portable FIPS 180-4 SHA-256 / HMAC-SHA256 / RFC 5869 HKDF-SHA256, RFC 7748 X25519 key agreement, RFC 8439 ChaCha20-Poly1305 AEAD, 4-byte length-prefixed framing (`LengthPrefixedFrameDecoder`), `RnTcpTransport`, `MultiTransportBridge`, and `SyncEngine` (pairing, encrypted `send`/`sendApp`, reconnect, disconnect, and membership revocation). Because upstream `off-grid-ai/shared` is unavailable (404), this protocol is OGAM-owned and self-consistent across all OGAM sender/receiver builds.
  - Updated `src/types/syncContracts.ts` (`PairedDevice`, pairing entitlement, revocation persistence, `SyncByteCodec`, `SyncEngineLike`) and `src/utils/chatStreamHelpers.ts` (`ChatStreamPreview.seq` / `complete`).
- **Migrated callers & build configuration:**
  - Cleared final `3` `source` files (`src/services/sync/discovery.ts`, `src/services/sync/engine.ts`, `scripts/blob-e2e/bundle-desktop-host.sh` now bundling `src/utils/syncChecksumCore.ts` directly) + all `8` open-core test files (`__tests__/harness/peerEntitlement.ts`, `__tests__/integration/sync/{rnDiscovery.test.ts, rnTransportPairing.test.ts}`, `__tests__/unit/stores/remoteChatStreamStore.test.ts`, `__tests__/unit/sync/nativeProximity.test.ts`, `__tests__/utils/{membershipPersistenceBoundary.ts, nativeSyncBoundaries.ts, pairFromPeer.ts}`).
  - Removed `@offgrid/sync` from `package.json` (`localFileDependencies: 1 → 0`) and stripped all `../shared` workspace paths/aliases from `metro.config.js` and `jest.config.js` (`package-lock.json` kept untouched per workspace convention).
- **Tests & CI:** Added `scripts/__tests__/sync-discovery-core.node.test.mjs` and `scripts/__tests__/sync-engine-core.node.test.mjs` (verifying RFC 7748 X25519 vectors, RFC 8439 ChaCha20-Poly1305 vectors + `node:crypto` parity + tamper rejection, full two-engine pairing/app-messaging/reconnect/forget over base64 TCP sockets, and `0` `localFileDependencies`), wired into `.github/workflows/ogam-external-dependency-audit.yml` (`56` steps, PyYAML valid).
- **Verified locally (Node `v26.13.1` + strict module `tsc`):** All **53** `.mjs` suites in `scripts/__tests__/` (**223/223** test cases: `3/3` plain + `220/220` `--experimental-strip-types --test`, `0` failed, `0` skipped), `tsc --noEmit --strict` on `syncContracts.ts`, `chatStreamHelpers.ts`, `syncDiscoveryCore.ts`, `syncEngineCore.ts` (`exit 0`), PyYAML (`56` steps), and `audit-offgrid-imports.mjs` pass cleanly. Verification boundary: full RN Jest, whole-workspace `tsc`, Gradle/APK build, and physical device runtime were not executed on PR #1 in this slice.
- **Next standalone milestone:** Decouple remaining `pro/` submodule & `.github/actions/setup-mobile/action.yml` / Pro-gated suite paths cleanly so open-core APK builds + full Jest/whole-repo `tsc` run without `PRO_SUBMODULE_PAT`.
