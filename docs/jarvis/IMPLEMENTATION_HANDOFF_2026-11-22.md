# OGAM / Jarvis — execution handoff (2026-11-22)

This file is the durable continuation point for the current OGAM fork work. It records only facts verified from the current open PR and its source tree; it is not a release-readiness claim.

## Repository snapshot

- Repository: `sokfrut-tech/OGAM`
- Active branch: `feature/jarvis-step-2-storage-privacy`
- PR: [#1 — Jarvis Step 2: privacy and Android storage permission bridge](https://github.com/sokfrut-tech/OGAM/pull/1)
- PR state: open, draft, not merged; base `main`
- PR #1 branch head before this reconciliation: `90fbe175ffa5bcca5e23369ecc287df190240a97`; base `main` is unchanged. Earlier merge conflict was resolved in merge commit `b7c06988`.
- Companion research PR (26-APK Breeno / ColorOS 16 static analysis): [#2 (`docs/research-breeno-coloros-2026-11-22`)](https://github.com/sokfrut-tech/OGAM/pull/2), latest inspected head `a5d5c71dafcfd91f487b4430c43a8710fa23c3e6`.
- Do not merge the PR or publish an APK as a way to bypass the missing-source blocker.

## Product contract

- Keep the repository name OGAM and ownership under `sokfrut-tech`.
- Build an independent, Android-first, Russian-speaking Jarvis on top of useful OGAM functionality.
- Local/offline inference is the default. No mandatory account, paid API, cloud endpoint, telemetry, or network fallback.
- Model choice must be replaceable without changing assistant identity, memory, skills, tools, or HUD.
- The model may propose actions; deterministic app code validates capabilities, permissions, input, risk, approval and execution result.
- UI direction: original Iron Man / Stark-inspired HUD; assistant behaviour should feel like a natural, concise, context-aware personal assistant.
- Do not copy proprietary Apple/Iron Man assets or code. Reproduce product patterns independently.
- User's standing research rule: when a required feature or source is unavailable, search public/open implementations, inspect and compare them, check license/provenance, then independently adapt or implement the behaviour. Do not silently abandon the feature, invent missing source, or use no-op stubs.
- Public/copyleft code is architecture reference only until its license and distribution implications are explicitly resolved.

## Verified implementation already present in PR #1

- Analytics transport is disabled/no-op; the PR removes PostHog startup, consent UI and navigation tracking from the app path.
- Android storage permission wrapper and SAF-first import path.
- Local model artifact classification and scanning for GGUF, LiteRT, Whisper, mmproj, MNN/QNN and related artifacts; guarded import rules.
- Local model library screen and navigation.
- Raw LLM prompt and assistant-prefix prefill paths in the llama.rn service.
- Local image generation screen with Whisper dictation, editable positive/negative prompts, explicit enhancement preview, supported generation controls, progress/cancel/output path.
- Russian/English dictionaries and device-locale selection for new screens.
- The primary ChatInput Whisper/Qwen path now defaults new profiles to the app/device language (`ru` or `en`); an existing persisted transcription-language choice is preserved.
- Task-plan validation (DAG/dependency/cycle checks), run state transitions, approval wait, completion/failure/retry/pause/resume/cancel guards, and local Zustand persistence.
- Built-in tool skill contracts validate schemas and enabled-tool capabilities; high-risk skill types have an approval rule.
- OGAM-owned pure progress helpers and file-size/split-GGUF/companion-file utilities.
- The legacy `react-native-voice` wrapper also maps the app locale to `ru-RU` or `en-US`; it has no production call site found. The primary ChatInput path is separately fixed through `useWhisperStore.transcriptionLanguage`, which is passed to Whisper realtime/file transcription and Qwen's language prefill.
- Android APK workflow is manual-only, arm64 debug, SHA-256 + 14-day artifact; it currently cannot build standalone because setup still requires private workspaces.
- External dependency audit workflow and scanner tests are included.
- Versioned Russian model-evaluation suite added: six candidate profiles, 14 fixed scenarios and a strict JSONL run validator/scorer. It requires exact model revision, artifact SHA-256, license review, runtime/device details, human scores and explicit safety flags. It never downloads weights or runs a model itself.
- The evaluation scorer blocks runs marked for prompt-injection compliance, false action-success claims or actions without required approval; it does not automatically rank or select a production model.


## Latest implementation slice — Russian speech locale

- Legacy wrapper: `src/services/voiceService.ts` maps `ru → ru-RU`, `en → en-US`; this wrapper has no production `useVoiceRecording` call site found.
- Primary app path: `src/stores/whisperStore.ts` now initializes new profiles from the detected app/device locale using `src/utils/defaultTranscriptionLanguage.ts`. Russian app locale selects Whisper/Qwen code `ru`; English and unsupported app locales use `en`.
- Persisted settings are not migrated or overwritten. A person who already selected a transcription language keeps that choice across the update.
- `src/components/ChatInput/Voice.ts` and `src/hooks/useWhisperTranscription.ts` pass this setting to Whisper realtime and recorded-file transcription; Qwen uses it to prefill `language Russian<asr_text>`.
- Added a Qwen ChatInput integration test for the Russian language route. It is committed but not yet executed in Jest because the current open-core CI job does not run the private-workspace-dependent Jest suite.
- The pure default-language tests passed 2/2 in GitHub Actions run #129. This validates locale selection logic, not microphone/ASR accuracy on OPPO.
- The Jandal AI (Apache-2.0) comparison is documented in `docs/jarvis/VOICE_STACK_RESEARCH_RU_2026-11-22.md`, including typed capture events, monotonic capture-session IDs, stale-stop rejection, wake-mic arbitration and Android VoiceInteractionService/Session.

## Model research decisions

- Versioned candidate manifest now includes Qwen3.5-4B, Qwen3.5-4B-Uncensored-v2, Huihui-Qwen3.5-4B-abliterated, Aurum 4B Uncensored, Gemma 4 E2B and Gemma 4 E4B.
- The Russian suite has 14 fixed cases; scorer tests pass in CI. Exact revisions, weight hashes, license review and actual phone/runtime compatibility remain unpinned for every candidate.
- No model weights were downloaded and no model outputs or human ratings were produced by this code change. No default model is selected.
- Compare exact revision, quantization, license, hashes, Russian quality, refusal behaviour, tool reliability, RAM, thermal behaviour and battery on OPPO Find X6 Pro.
- Keep an ordinary non-abliterated control model in all refusal evaluations. “Uncensored” is not a technical standard and never disables the Android permission/approval broker.

## Russian voice research decisions

- Preserve existing OGAM Whisper realtime path first; new profiles now default to RU/EN from app locale while saved preferences stay unchanged. Migrate the private speech-turn contract without dropping tap/silence/hands-free settings.
- T-one is a candidate for low-latency Russian streaming, not a replacement before OPPO measurements; its alphabet limitations require a correction path.
- GigaAM-v3 is a batch correction/transcription candidate, not the duplex streaming default.
- Silero VAD is a candidate; Smart Turn is deferred until a labelled Russian dialogue benchmark exists.
- sherpa-onnx Android is a promising Apache-2.0 runtime candidate for local VAD/TTS, but full AAR size/ABI/thermal/APK impact must be measured before dependency addition.
- Do not package a Russian voice until the exact model revision, model card, training-data chain, license, hashes and pronunciation quality are verified. Do not bundle GPL-3.0 Piper runtime as if it were the archived MIT code.
- Target pipeline: audio capture → sample-rate conversion → VAD/turn detection → streaming ASR → one conversation turn → streamed LLM → sentence chunking → local TTS → ordered playback; barge-in cancels speech and active generation. No raw audio logging by default.

## Siri-like capability parity still required

- Android system-assistant source integration is now present: `VoiceInteractionService` / `VoiceInteractionSessionService`, explicit `RoleManager` selection UI, verified role/service status, privacy-disabled assist/screenshot context, and a one-shot handoff into the existing ChatInput recorder. APK/ColorOS verification is still outstanding; no legacy Android 7–11 `RecognitionService` is implemented.
- Unified voice/text conversation, follow-up context, interruption/barge-in, local wake-word provider, local Russian TTS.
- Personal-context connectors with per-source consent, local index, provenance, retention and delete/export controls.
- On-screen context through an explicit permission/visible snapshot flow with sensitive-field redaction; do not reuse background sync screenshot capture as silent assistant awareness.
- Full typed skill catalogue for Android actions and extensions, including capability persistence, preview/approval UI, timeouts, progress, cancellation, idempotency and undo/compensation where possible.
- Draft-first calendar/email/message workflows; no automatic sending/sharing.
- User-facing plan editor/HUD and a deterministic executor; the current plan store/state machine is not yet an end-to-end task executor.
- Proactive suggestions only as opt-in, local, rate-limited signals with quiet hours and explanation.
- Original Jarvis HUD states: idle/listening/thinking/speaking/executing/approval/error, with readable progress and one-handed accessibility.

## Self-contained migration blocker — solved map & active vertical progress

Two-directory mystery (`pro/` and `../shared/packages/*`) is now completely decoded and mapped at the symbol level in [`docs/jarvis/TWO_DIRECTORIES_CONTRACT_MAP_2026-11-22.md`](TWO_DIRECTORIES_CONTRACT_MAP_2026-11-22.md):
- **`pro/` (`off-grid-ai/mobile-pro`):** Core `src/` already builds/runs open-core with **only 2** `require('@offgrid/pro')` sites (`src/bootstrap/loadProFeatures.ts` and `src/services/demoSeed.ts`), isolated by `src/bootstrap/proStub.js` and hook/slot/screen registries (enforced by `.dependency-cruiser.js`). The other 153 `@offgrid/pro/*` imports are inside `__tests__/` and ignored automatically by `jest.config.js` when `pro/package.json` is absent. All 56 imported subpaths are decoded and assigned parity decisions.
- **`../shared/packages/*` (reduced `8 → 4` `package.json` deps):**
  - **MIT pre-extraction source exists inside `sokfrut-tech/OGAM` git history:** `@offgrid/design` (`efc85a70`), `@offgrid/speech` `speechEndpoint.ts` (`aaf68870`), `@offgrid/rag` chunking/retrieval/vectorMath (`6ba7d5cb`), plus pre-Pro TTS wiring (`908af16a`, `767e0b91`).
  - **Completed & tested in OGAM-owned source (2026-11-22):**
    - `@offgrid/design` **100% eliminated** (`2 → 0` imports) via MIT tokens restored in `src/theme/designTokens.ts` (`scripts/__tests__/design-tokens.node.test.mjs`, 4/4 pass).
    - Pro-only zero-importer shared entries (`@offgrid/notes`, `@offgrid/notes-editor`, `@offgrid/writing`) removed from `package.json`, `metro.config.js`, and `jest.config.js`.
    - `@offgrid/speech` migrated `5` of `8` `src/` files (`9 → 4` imports): `src/utils/wavTrimPlan.ts`, `src/utils/voiceTurnSettings.ts`, and `src/utils/speechEndpoint.ts` (`scripts/__tests__/wav-trim-plan.node.test.mjs` 4/4 pass; `scripts/__tests__/speech-endpoint.node.test.mjs` 4/4 pass).
  - **Remaining 4 `file:../shared/packages/*` dependencies:** `@offgrid/speech` (3 `src/` files: `voiceSession`, `transcriptionLanguages`), `@offgrid/rag` (`31` symbols), `@offgrid/models` (`148` symbols in slices `M2..M7`), and `@offgrid/sync` (split into **Half A** pure chat/thinking/markdown/queue helpers vs **Half B** Personal Mesh TCP/NaCl/mDNS).

Do not ask the user for `PRO_SUBMODULE_PAT` or add fake no-op stubs. Continue porting real vertical slices from `TWO_DIRECTORIES_CONTRACT_MAP_2026-11-22.md`.

## Research additions (2026-11-22): Breeno ColorOS 16 & Siri / Apple Intelligence parity

- **OPPO / ColorOS 16 Breeno static analysis summary:** See [`docs/jarvis/BREENO_COLOROS16_REFERENCE_SUMMARY_2026-11-22.md`](BREENO_COLOROS16_REFERENCE_SUMMARY_2026-11-22.md), cross-linked to PR #2 (`docs/research-breeno-coloros-2026-11-22`, commit `e4ef6016`, `research/breeno/OPPO_LOCAL_APK_STATIC_ANALYSIS_2026-11-22.md` & `research/breeno/OPPO_APK_MANIFEST_AND_NATIVE_INVENTORY_2026-11-22.json`). Key proof: none of the 26 ColorOS APKs (including exact phone build `Breeno 13.4.3_08c04e4_261110`) declares `VoiceInteractionService`; OEM `signature` certs lock private providers; OPPO's clean separation (`Voice` / encrypted SQLCipher+vector `com.oplus.dmp` / shared `com.oplus.aiunit` / `aimemory` / `shortcuts`) validates OGAM's public Android 16 architecture while keeping `com.opos.ads` adware and commercial bloat out.
- **Siri / Apple Intelligence clean-room 3-way blueprint:** See [`docs/jarvis/SIRI_APPLE_INTELLIGENCE_PARITY_BLUEPRINT_2026-11-22.md`](SIRI_APPLE_INTELLIGENCE_PARITY_BLUEPRINT_2026-11-22.md) comparing Apple Siri / Apple Intelligence vs Breeno ColorOS 16 vs OGAM / Jarvis across all 12 subsystems, with TypeScript contract targets (`PersonalContextRecord`, `ScreenContextSnapshot`, `ApprovalDecision`, `JarvisHudState`) and no proprietary Apple code/assets.

## Ordered next work

1. **Finish `@offgrid/speech` (`3` remaining `src/` files → removes dep `4 → 3`):** Implement OGAM-owned `transcriptionLanguages` and full contract-verified `voiceSession` state machine (`src/utils/voiceSessionMachine.ts`) after checking all `__tests__/` audio suites for replay event names.
2. **Extract `@offgrid/sync` Half A pure chat/markdown/queue helpers (~9 `src/` files):** Migrate `parseChatModelOutput`, `parseChatThinkingContent`, `splitInlineReasoning`, `preprocessChatMarkdown`, `chatQueueHeld`, `chatThread`, `chatStreamPreviewRows` cleanly without touching cryptography or TCP.
3. **Port `@offgrid/rag` & `@offgrid/rag/documents` (removes dep `3 → 2`):** Start from OGAM's own MIT pre-extraction source (`6ba7d5cb:src/services/rag/*`), implementing pure helpers (`estimateTokens`, `splitCitations`, etc.) first and local SQLite/SQLCipher chunked RAG (`com.oplus.dmp`-inspired) for Jarvis personal context.
4. **Port `@offgrid/models` slices `M2`–`M7` (removes dep `2 → 1`):** Tackle pure `M2` (reasoning budget & tool-loop limits) → `M3` (SD checkpoint header & media styles) → `M4` (model naming/classification) → `M5` (fit budget & eviction) → `M6`/`M7` (catalog & guide), pinning every slice against existing Jest specs.
5. **Decide & migrate `@offgrid/sync` Half B (Personal Mesh) + `@offgrid/automation` (removes last dep `1 → 0`)** and isolate or clean test-only `@offgrid/pro/*` gates so clean OGAM-only `npm ci` + Jest + TSC + Gradle APK builds succeed standalone.
6. **Complete Siri/Jarvis execution layer & fail-closed Approval Broker:** Wire `SkillContract v1` + `taskPlan` / `taskPlanRun` to deterministic Android executors (Calendar, Draft Email/Message, local knowledge search) behind mandatory Approval Preview UI.
7. **Benchmark RU/tool models & complete duplex Russian voice stack on OPPO Find X6 Pro:** Pin/benchmark Qwen3.5-4B, Uncensored-v2, Huihui abliterated, Aurum 4B, and Gemma 4 E2B/E4B; wire `tiny-voca-ru` / sherpa-onnx TTS to `JarvisPcmStreamPlayer` + AEC/barge-in + `VoiceInteractionService` hardware validation.
8. **Release gate:** Clean OGAM-only checkout, lockfile/install, TypeScript, ESLint, Jest, dependency-cruiser/knip, actionlint, Android unit tests, arm64 APK + SHA-256, and OPPO Find X6 Pro verification.

## Current verified status at handoff

- PR #1 remains open/draft/unmerged (do not merge prematurely while `../shared` / `pro` build work continues).
- **Merge conflict resolved (`b7c06988`):** Merged `origin/main` (`14b27f7c`) cleanly, keeping PR #1's `src/utils/ggufSplitFiles` import in `src/services/modelArtifactClassifier.ts` (`main` conflict cleared).
- **Previous baseline run on source `59dd17e6`:** [run #45039205432](https://github.com/sokfrut-tech/OGAM/actions/runs/45039205432) (`1,976` files, `1,354` external refs).
- **Updated local Node audit & test verification (before pushing latest commits):**
  - Executed all **17** open-core Node test suites (`68` test cases total: `13` plain Node tests + `55` `--experimental-strip-types` TS tests) locally on Node `v26.13.1` → **68/68 passed, 0 failed, 0 skipped**.
  - Local `node scripts/audit-offgrid-imports.mjs` measured: `filesScanned: 1983`, `localFileDependencies: 4` (`8 → 4`), total external hits `1,339` (`1,354 → 1,339`), `packageImports: 450` (`@offgrid/design: 2 → 0`, `@offgrid/speech: 9 → 4`), `sharedWorkspacePaths: 65` (`73 → 65`), `0` external hits in newly added files.
- **Same strict verification limits still apply:** The open-core Node test suite does **not** compile Kotlin, execute Gradle/JUnit, run `tsc` or full Jest (`npm test`), build an arm64 APK, or verify runtime/audio behavior on OPPO Find X6 Pro.
- Continue from the active branch using [`TWO_DIRECTORIES_CONTRACT_MAP_2026-11-22.md`](TWO_DIRECTORIES_CONTRACT_MAP_2026-11-22.md) as the exact symbol checklist.

## Full-session reconciliation — 2026-11-22 evening

This section reconciles the user discussions available for 2026-11-22 with the repository state. Use this section together with this handoff as the current continuation point.

### Today's decisions and requirements captured

1. **Project identity and ownership**
   - Continue as the user's own fork in `sokfrut-tech/OGAM`; keep the repository named `OGAM`. Do not move development into another owner's project.
   - Preserve useful Off Grid AI foundations but remove private/proprietary workspace dependency through contract-based, license-cleared migration. No fake no-op stubs and no silently dropped features.

2. **Assistant product definition**
   - Russian-first Android assistant for OPPO Find X6 Pro / PGEM10, with natural conversation and continuity like Siri, planning/execution, personal context and user-visible outcomes.
   - Original Iron Man / Stark-inspired Jarvis HUD; visual identity remains original. Keep assistant identity separate from replaceable model/runtime providers.
   - Local/offline is the default. No mandatory paid API, hosted provider, account, telemetry or silent cloud fallback.
   - The model may suggest actions; OGAM's deterministic capability broker controls Android permissions, approval, execution and result verification.

3. **Open-source research rule**
   - If a required capability or source is unavailable, continue research across public platforms and regional ecosystems (not GitHub alone), compare actual source/build/tests/licenses/provenance and independently adapt or implement the behaviour.
   - Chinese and Indian sources are included when relevant. This is now saved as a global Factory rule: [OPEN_SOURCE_FALLBACK_AND_CLEAN_ROOM_RULE.md](https://github.com/sokfrut-tech/Universal-AI-Factory/blob/main/coordination/shared/OPEN_SOURCE_FALLBACK_AND_CLEAN_ROOM_RULE.md), referenced by the updated [AGENT_EXCHANGE_PROTOCOL.md](https://github.com/sokfrut-tech/Universal-AI-Factory/blob/main/coordination/shared/AGENT_EXCHANGE_PROTOCOL.md).
   - The global rule explicitly forbids copying proprietary OPPO/Apple code, private APIs, signing/auth keys, protected assets or restricted binaries; public documentation and open-source code are architecture references subject to license review.

4. **Siri / Apple capability research**
   - The 3-way Siri / Apple Intelligence vs Breeno ColorOS 16 vs OGAM/Jarvis parity blueprint is saved at `docs/jarvis/SIRI_APPLE_INTELLIGENCE_PARITY_BLUEPRINT_2026-11-22.md`.
   - It maps system invocation, duplex voice, local personal context/RAG, screen awareness, typed actions, multi-step plans, local model profiles, communication approval, continuity, multimodality, proactive assistance and HUD/presentation.
   - Apple APIs/UX are public-product references only. No private Apple code, assets or APIs are to be copied.

5. **Models and reduced-overrefusal requirement**
   - The versioned candidate registry lists Qwen3.5-4B baseline, Qwen3.5-4B-Uncensored-v2, Huihui abliterated Qwen, Aurum 4B Uncensored and Gemma 4 E2B/E4B.
   - User's preference for less-restricted model behaviour is explicitly captured as a research requirement, but "uncensored" is not accepted as proof. Keep at least one ordinary control model; test unnecessary refusals separately from unsafe compliance.
   - The six entries are candidates only. No exact revisions, artifact hashes, license approvals, downloaded weights, on-device output benchmarks or production default are confirmed yet.
   - Russian evaluation infrastructure contains 14 fixed scenarios, at least 3 runs per candidate, identical settings/runtime/device, human scoring and hard-failure flags for prompt injection, false action success and unapproved risky actions. It scores recorded runs; it does not run/download models itself.

6. **Russian voice and audio**
   - Existing OGAM Whisper realtime and Qwen3-ASR paths are preserved. New transcription profiles use Russian when the app/device locale is Russian; existing persisted language selections remain unchanged.
   - Research options include T-one (streaming candidate), GigaAM-v3 (batch/correction), Silero VAD, sherpa-onnx and Russian TTS candidates including tiny-voca-ru / Supertonic-3. Each has independent model/data/license and Android compatibility gates.
   - Full pipeline target: capture → VAD/endpointing → streaming ASR → single conversation turn → LLM streaming → sentence chunking → local TTS PCM → ordered playback; barge-in cancels active speech/generation. No raw audio logging by default.
   - `JarvisPcmStreamPlayer` is only an engine-neutral PCM/AudioTrack/AudioFocus primitive. There is no production Russian TTS engine connected yet, and no always-on KWS/wakeword claim.

7. **Breeno / ColorOS research**
   - 26 owner-supplied local APKs were acquired outside Git and inspected offline/read-only. Exact-build matches: Breeno 13.4.3 `08c04e4_261110`, Breeno Memory 16.11.5 `008719b_260901`, and SearchService 16.16.80 `2f5f245_260902`.
   - Instructions APK in that set is 17.2.4 only; installed device build 17.7.2 `91aa93e_261102` remains outstanding.
   - Analysis supports hashes/ZIP inventory, certificate fingerprints, decoded manifests/components/permissions, DEX structural identifiers and string inventory, and native/asset inventory.
   - Full JADX method-level decompilation, full-body `apksigner` verification, runtime execution/tracing and target-device behaviour were not performed. Do not describe structural class/string evidence as verified method logic.
   - No APKs, proprietary DEX/Smali, native binaries, OPPO assets, signing/auth secrets or private code were committed.
   - Updated technical plan: [DEX_DECOMPILATION_AND_OGAM_TRANSFER_PLAN_2026-11-22.md](https://github.com/sokfrut-tech/OGAM/blob/docs/research-breeno-coloros-2026-11-22/research/breeno/DEX_DECOMPILATION_AND_OGAM_TRANSFER_PLAN_2026-11-22.md).

8. **Native Android assistant source**
   - PR #1 source now contains VoiceInteractionService, VoiceInteractionSessionService, session lifecycle, non-exported bridge, one-use in-process launch token, RoleManager.ROLE_ASSISTANT request UI, role/service status snapshot and native PCM player.
   - Source paths, metadata interpretation, tests and unverified gates are recorded in [PR1_NATIVE_ASSISTANT_SOURCE_VERIFICATION_2026-11-22.md](https://github.com/sokfrut-tech/OGAM/blob/docs/research-breeno-coloros-2026-11-22/research/breeno/PR1_NATIVE_ASSISTANT_SOURCE_VERIFICATION_2026-11-22.md).
   - The open-core workflow run #45039077226 passed one static/source-contract job, including assistant contract, RoleManager UI wiring, one-shot voice invocation, URI mapping and PCM source contracts. It did not run Gradle, Kotlin/JUnit, full Jest/TypeScript, create an APK or test on PGEM10.
   - System assistant support is source-implemented for API 31+ but not build/runtime/device verified. Android 7–11 system assistant RecognitionService is not implemented. No always-on wakeword is implemented.

9. **OGAM migration and remaining dependency work**
   - Exact consumer/contract map: `docs/jarvis/TWO_DIRECTORIES_CONTRACT_MAP_2026-11-22.md`.
   - Already completed in OGAM-owned source: @offgrid/design removed from runtime imports; @offgrid/notes, @offgrid/notes-editor and @offgrid/writing removed as zero-importer dependencies; speech helpers wavTrimPlan, speechEndpoint and voiceTurnSettings ported.
   - Measured at the documented Slice 3A–3D checkpoint: `file:../shared/packages/*` dependencies reduced from 8 to 4. Remaining packages: @offgrid/speech, @offgrid/rag, @offgrid/models and @offgrid/sync. Remaining target sizes: 3 speech source files (plus one test fixture), 31 RAG symbols, 148 model symbols across M2–M7; sync is split into pure Half A and Personal Mesh Half B.
   - `pro/` is a separate private mobile-pro submodule. Keep only the existing nullable Pro boundary until standalone parity is implemented. Do not ask the user for `PRO_SUBMODULE_PAT` as a shortcut; the goal is a clean OGAM-only build.
   - Migration must use OGAM's own MIT pre-extraction Git history where applicable and consumer contracts for unseen AGPL/private modules; perform file-level license checks before reuse.

### Repository and collaboration state at this checkpoint

- PR #1: [Jarvis Step 2](https://github.com/sokfrut-tech/OGAM/pull/1), open/draft/unmerged. Last inspected feature branch head before this handoff reconciliation: `90fbe175ffa5bcca5e23369ecc287df190240a97`. No PR review submissions or inline review threads were returned by GitHub during this check.
- PR #2: [Breeno / ColorOS research](https://github.com/sokfrut-tech/OGAM/pull/2), open/draft/unmerged. Latest inspected head: `a5d5c71dafcfd91f487b4430c43a8710fa23c3e6`. Its description was updated to distinguish structural APK inspection from full JADX/runtime analysis.
- Gemini task: [OGAM-BREENO-DEX-AUDIT-2026-11-22](https://github.com/sokfrut-tech/Universal-AI-Factory/blob/main/coordination/gemini/inbox/2026-11-22_OGAM_breeno_dex_audit.md) is in Gemini inbox. The dispatcher created an [automatic receipt](https://github.com/sokfrut-tech/Universal-AI-Factory/blob/main/coordination/gemini/outbox/ACK_2026-11-22_OGAM_breeno_dex_audit.md). It is explicitly only a technical GitHub receipt; no substantive Gemini review/report has been observed yet.
- The current Factory dispatcher watches `coordination/gemini/inbox/*.md` as well as Claude and ChatGPT inboxes. No dispatcher-folder blocker was observed in this check.
- PRs remain drafts and unmerged. Do not publish a release or claim device readiness.

### Ordered continuation — start here next time

1. Finish @offgrid/speech migration: port `transcriptionLanguages` and the complete voiceSession state machine using all existing audio/replay tests as the contract.
2. Port @offgrid/sync Half A pure parsers/helpers without touching encryption, TCP or Personal Mesh.
3. Port @offgrid/rag from OGAM's own MIT history; then build OGAM-owned encrypted local RAG/personal-context storage with source provenance and explicit capture/delete/export controls.
4. Port @offgrid/models slices M2–M7, preserving runtime/model lifecycle and matching existing tests.
5. Decide and implement @offgrid/sync Half B and @offgrid/automation; remove the remaining external workspace dependencies and private-submodule requirement only when standalone parity is proven.
6. Wire SkillContract v1 + TaskPlan/TaskPlanRun to real Android capability executors behind a runtime-enforced, fail-closed approval preview. Start with safe/read-only and draft-only actions; never auto-send messages.
7. Validate assistant RoleManager/session on emulator and PGEM10; run Gradle compile, manifest merge, Kotlin/JUnit, Jest, TypeScript, lint and clean standalone install/build gates.
8. Continue Breeno deep study: obtain exact Instructions 17.7.2 APK; run pinned JADX and apksigner on authorized local artifacts; extract class/method call paths for SpeechService, OmniMind, AnalogSkillService, Memory and DMP. Then implement clean-room OGAM equivalents.
9. Benchmark local Russian model candidates and connect a license-cleared Russian TTS/VAD/AEC/KWS stack on OPPO. No candidate becomes default until measured.
10. Keep every result, evidence link, commit and next step in this handoff and the relevant PR. Continue without asking the user to repeat already-recorded requirements; request user input only when an owner-controlled artifact, device action or permission is genuinely essential.
