# Two-Directory Migration Contract Map (`pro/` and `../shared`) — 2026-11-22

This document resolves the core blocker in `sokfrut-tech/OGAM` PR #1 (`feature/jarvis-step-2-storage-privacy`): **what lived inside the two external/private directories (`pro/` and `../shared/packages/*`), what open-source MIT source already exists in OGAM's own git history, what must be ported vs kept gated/dropped, and exact consumer-pinned TypeScript contracts.**

Evidence base:
- Automated audit JSONs (`ogam-import-audit.json` baseline `1,976` files / `1,354` refs → post-Slice 3A–3D `1,983` files / `1,339` refs → post-`@offgrid/speech` completion `1,987` files / `1,335` refs).
- Full AST/regex symbol parse of all **240** importing `src/` and `__tests__/` files on PR #1.
- `package.json`, `package-lock.json`, `metro.config.js`, `jest.config.js`, `tsconfig.json`, `.dependency-cruiser.js`, and `docs/SYNC_INTEGRATION_PLAN.md`.
- Local git history of `sokfrut-tech/OGAM` (`LICENSE`: **MIT License**).

> **Licensing note:** In `package-lock.json`, the external `../shared/packages/*` workspaces declare `"license": "AGPL-3.0-only"`, whereas `sokfrut-tech/OGAM` itself is MIT-licensed. Any code restored from `sokfrut-tech/OGAM`'s commits *prior* to extraction (`d300dbb0`, `908af16a`, `767e0b91`, `6ba7d5cb`, `aaf68870`, `efc85a70`) comes from OGAM's MIT history. Unseen `../shared` / `pro/` source must be re-implemented cleanly in OGAM from consumer contracts and MIT/Apache references, never copied blindly.

---

## 1. Measured Audit Delta After `@offgrid/speech` Completion (2026-11-22)

| Metric | Baseline (`b7c06988`) | After Slices 3A–3D | After `@offgrid/speech` 100% | Total Change |
|---|---:|---:|---:|---|
| Files scanned | 1,976 | 1,983 | **1,987** | `+11` (`6` OGAM TS modules + `5` Node test suites) |
| `localFileDependencies` (`package.json`) | 8 | 4 | **3** | **`-5`** (`design`, `notes`, `notes-editor`, `writing`, `speech` removed) |
| Total external refs | 1,354 | 1,339 | **1,335** | **`-19`** |
| `packageImports` | 457 | 450 | **447** | **`-10`** |
| `sharedWorkspacePaths` | 73 | 65 | **64** | **`-9`** |
| `@offgrid/design` imports | 2 | 0 | **0** | **100% eliminated** (`src/theme/designTokens.ts`) |
| `@offgrid/speech` imports | 9 | 4 | **1** *(0 in `src/`, 1 test fixture)* | **100% eliminated from `src/` & `package.json` & `metro.config.js`** (`scripts/__tests__/audit-offgrid-imports.test.mjs` fixture only) |
| `@offgrid/notes`, `@offgrid/notes-editor`, `@offgrid/writing` | 0 / 0 / 0 | 0 / 0 / 0 | **0 / 0 / 0** | Removed from `package.json`, `metro.config.js`, `jest.config.js` |
| Remaining `localFileDependencies` | — | 4 | **3** (`@offgrid/models`, `@offgrid/rag`, `@offgrid/sync`) | Remaining migration targets mapped below |

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
| **`@offgrid/rag`** (`+ /documents`) | Remains (`file:../shared/packages/rag`) | `@langchain/textsplitters ^1.0.2` (dev) | `19` | `4` | `6ba7d5cb:src/services/rag/{chunking,retrieval,vectorMath}.ts` (`5c12cc2f^`) | **KEEP & PORT NEXT** (19 `src/` + 4 `__tests__/`, 31 unique symbols) |
| **`@offgrid/models`** | Remains (`file:../shared/packages/models`) | `minisearch ^7.2.0` (dev) | `87` | `31` *(+2 scripts)* | Partial (`ggufSplitFiles`, `modelCompanionFiles`, `formatFileSize` already ported in PR #1) | **KEEP & PORT BY SLICES `M2..M7`** (`148` unique symbols across `src/` & `__tests__/`) |
| **`@offgrid/sync`** (`+ /rn, /rn-discovery, /portable`) | Remains (`file:../shared/packages/sync`) | `@noble/hashes 1.8.0`, `@offgrid/automation`, `@offgrid/models`, `bonjour-service`, `js-sha512`, `tweetnacl` | `43` | `103` *(+2 scripts)* | `docs/SYNC_INTEGRATION_PLAN.md` (`c06b2211`) | **SPLIT INTO HALF A (PURE CHAT HELPERS) + HALF B (PERSONAL MESH)** (`171` symbols) |

---

### 3.2 Package Detail: `@offgrid/speech` — **100% Eliminated (`8` of `8` `src/` Consumers Cleared)**

- `WAV_HEADER_BYTES`, `WAV_HEADER_SCAN_BYTES`, `planWavTrim` → `src/utils/wavTrimPlan.ts` (`src/services/wavTrimmer.ts`, tested by `scripts/__tests__/wav-trim-plan.node.test.mjs`, 4/4 pass)
- `SpeechEndpointTimer` → `src/utils/speechEndpoint.ts` (`src/components/ChatInput/useSilenceEndpoint.ts`, tested by `scripts/__tests__/speech-endpoint.node.test.mjs`, 4/4 pass)
- `VoiceTurnMode`, `DEFAULT_SILENCE_AFTER_SPEECH_MS`, `DEFAULT_SPEAKER_DRAIN_MS`, `SPEECH_ONSET_LOOKBACK_MS`, `SILENCE_AFTER_SPEECH_CHOICES_MS`, `SPEAKER_DRAIN_CHOICES_MS`, `VOICE_TURN_LABELS`, `VOICE_DELAY_LABELS`, `secondsLabel` → `src/utils/voiceTurnSettings.ts` (`voiceSections.tsx`, `appStore.ts`, `types/index.ts`, `useSilenceEndpoint.ts`)
- `isEnglishOnlyWhisperModel`, `transcriptionLanguages`, `TranscriptionEngine`, `TranscriptionLanguage` → `src/utils/transcriptionLanguages.ts` (`src/components/TranscriptionLanguageSelect.tsx` & `src/services/qwenAsrEngine.ts`, tested by `scripts/__tests__/transcription-languages.node.test.mjs`, 4/4 pass)
- `MAX_EMPTY_TURNS`, `initialVoiceSession`, `nextVoiceSession`, `micShouldBeOpen`, `speechMayPlay`, `VoiceSession`, `VoiceSessionEvent`, `VoiceSessionState`, `VoiceSessionPhase`, `VoiceReplayReturnState` → `src/utils/voiceSessionMachine.ts` (`src/services/voiceSession.ts`, tested by `scripts/__tests__/voice-session-machine.node.test.mjs`, 7/7 pass)
- `@offgrid/speech` dependency removed from `package.json`, and `speechPackagePath` / `watchFolders` / `extraNodeModules['@offgrid/speech']` removed from `metro.config.js`. Only the intentional synthetic test fixture in `scripts/__tests__/audit-offgrid-imports.test.mjs` remains (`1` test hit, `0` source hits).

---

### 3.3 Package Detail: `@offgrid/rag` and `@offgrid/rag/documents` (`31` Unique Symbols)

**MIT Reference Commit Inside OGAM:** `6ba7d5cb:src/services/rag/{chunking.ts,retrieval.ts,vectorMath.ts}` (deleted in `5c12cc2f`).

- **`@offgrid/rag` (`4` symbols — Remote Desktop Search):**
  - `src/services/pairedComputerSearch.ts`: `searchRemoteComputer`, `RemoteSearchOutcome`
  - `src/components/PairedComputerResults.tsx`: `withoutChatsOnDevice`, `RemoteSearchOutcome`, `RemoteSearchResult`
  - `src/hooks/usePairedComputerSearch.ts`: `RemoteSearchOutcome`
- **`@offgrid/rag/documents` (`27` symbols — Local Document Ingest & Retrieval):**
  - **Services/Classes (`2`):** `DocumentIngestService`, `DocumentTurnService` (`src/services/documents/index.ts`)
  - **Pure Functions (`6`):** `estimateTokens`, `textParts`, `contentTerms`, `indexedText`, `describeTurnStatus`, `parseSearchBlock`, `splitCitations` *(plus `searchBlock` in `ChatMessageCitations.test.tsx`)*
  - **Types/Ports (`18`):** `CitedSource`, `ConversationDocumentsPort`, `DocumentChunk`, `DocumentIndexStore`, `DocumentPage`, `DocumentProgress`, `DocumentScope`, `DocumentSource`, `DocumentTurnStatus`, `EmbedPort`, `ExtractPort`, `FoundPassage`, `KeywordHit`, `KeywordSearchPort`, `ProjectDocumentsPort`, `Scheduler`, `StoredDocument`
  - *Recommended order:* First extract pure helpers (`estimateTokens`, `textParts`, `contentTerms`, `indexedText`, `splitCitations`, `parseSearchBlock`) + interfaces, then implement `DocumentIngestService` & `DocumentTurnService` using `6ba7d5cb` MIT chunking/vector math.

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
| **M7: Guide & Boost Copy** | `BOOST_PROMO`, `BoostPromoSurface`, `boostPromoCopy`, `boostPromoLink`, `boostPromoVisible`, `GUIDE_FIRST_LOOK`, `GUIDE_STARTERS`, `GUIDE_LINKS`, `GUIDE_KB_VECTOR_MODEL`, `MOBILE_GUIDE_GROUPS`, `GUIDE_FLOWS`, `GUIDE_NOT_SUPPORTED`, `GuideAnswerBlock`, `GuideTopicFacts`, `guide*` helpers, `templateStoryboard` | `GuideScreen/*`, `BoostPromoCard.tsx`, `src/constants/index.ts`, `FeatureShowcase.tsx`, `ProTabScreen.tsx` | **LOW PRIORITY / JARVIS OVERRIDE.** Boost/Pro promos can simplify or hide cleanly in standalone Jarvis. |

---

### 3.5 Package Detail: `@offgrid/sync` (`171` Imported Symbols — Two Totally Different Halves!)

A critical discovery from AST analysis of all `33` `src/` consumers + `rn`/`rn-discovery` adapters: **nearly half of `@offgrid/sync` is pure chat-formatting/queue logic with ZERO cryptography or networking**, placed in `@offgrid/sync` only for desktop-mobile sharing.

#### Half A: Pure Chat / Reasoning / Markdown / Queue Utilities (`~9` `src/` files — Fast Standalone Extraction)
Zero TCP/NaCl/mDNS dependency; extract into `src/utils/` & `src/services/chat/` with Node tests:
- `src/utils/messageContent.ts`: `REASONING_DELIMITERS`, `ReasoningDelimiter`, `TOOL_CALL_OPENERS`, `TOOL_CALL_CLOSERS`, `XML_TOOL_CALL_FUNCTION_MARKER`, `XML_TOOL_CALL_PARAMETER_MARKER`, `parseChatModelOutput`, `parseChatThinkingContent`, `partialTagSuffix`, `maxPartialTagSuffix`, `stripChatControlTokens`
- `src/components/MarkdownText.tsx`: `preprocessChatMarkdown`, `safeChatExternalUrl`
- `src/screens/ChatScreen/types.ts` & `useRemoteChatStreamPreviews.ts`: `ChatStreamPreviewRow`, `splitInlineReasoning`, `isSupportingChatContext`, `chatStreamPhaseLabel`, `chatStreamPhaseIsStatus`, `chatStreamPreviewHasMessageBody`, `chatStreamPreviewRows`
- `src/services/generationService.ts` & `Toolbar.tsx`: `ChatQueueHold`, `ChatQueueSignal`, `chatQueueHeld`, `chatQueueHoldAfter`, `markQueuedSendNow`, `takeNextQueued`
- `src/utils/chatThread.ts` & `visibleMessages.ts`: `chatThread`, `appendPlace`, `neighbourVersion`, `parentOfVersion`, `chatListPreviewLine`
- `src/services/sync/chatStreamTools.ts` & `imageGenerationHelpers.ts` & `imagePromptEnhancement.ts`: `startChatStreamTool`, `completeChatStreamTool`, `ChatStreamTool`, `PROMPT_ENHANCEMENT_REASONING_LABEL`, `PROMPT_ENHANCEMENT_STATUS`, `isRuntimeOnlyMessage`
- `src/services/networkDiscovery.ts`: `readGatewayComputerId`

#### Half B: Personal Mesh Protocol, NaCl Crypto, Blobs, & State Sync (`~24` `src/` files + `@offgrid/sync/rn` & `/rn-discovery`)
- Real encrypted device-to-device Personal Mesh (`SyncEngine`, `MultiTransportBridge`, `CompositeDiscoveryService`, `DiscoveryOrchestrator`, `BlobChannelHost`, `IncrementalChecksum`, `blobKeyBase64`, `createBlobMaterial`, `OFFGRID_SYNC_PORT`, `CHUNK_SIZE`, `BLOB_FRAME_BYTES`, `RnTcpTransport`, `RnDiscovery`, OpLog LWW state entities `KNOWLEDGE_DOCUMENT_ENTITY`, `SHARED_FILE_ENTITY`, `TASK_*_ENTITY`, etc.).
- **Decision:** Keep intact during initial core standalone unblocking, then migrate deliberately using `docs/SYNC_INTEGRATION_PLAN.md` + `tweetnacl` + `@noble/hashes` (or decide whether Personal Mesh stays core or optional module after Android APK & Jarvis voice/skill MVP ship).

---

## 4. Recommended Next Execution Sequence for GPT

1. ~~Finish `@offgrid/speech` (`transcriptionLanguages` + `voiceSession` state machine)~~ → **DONE (`4 → 3` `localFileDependencies`, `0` `@offgrid/speech` imports in `src/`).**
2. Extract `@offgrid/sync` **Half A** pure chat/reasoning/markdown/queue helpers into `src/utils/`.
3. Port `@offgrid/rag/documents` + `@offgrid/rag` starting from MIT commit `6ba7d5cb:src/services/rag/*` → removes `@offgrid/rag` (`3 → 2`).
4. Port `@offgrid/models` slices `M2` → `M3` → `M4` → `M5` → `M6` → `M7` with strict parity against Jest specs → removes `@offgrid/models` (`2 → 1`).
5. Port or scope `@offgrid/sync` **Half B** (Personal Mesh) + `@offgrid/automation` → reaches **`0` `localFileDependencies` and clean standalone Android/Jest/TSC builds without `../shared` or `pro/`**.
