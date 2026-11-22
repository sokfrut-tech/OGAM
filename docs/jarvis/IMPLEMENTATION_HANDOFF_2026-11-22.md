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
- **`../shared/packages/*` (reduced `8 → 3` `package.json` deps):**
  - **MIT pre-extraction source exists inside `sokfrut-tech/OGAM` git history:** `@offgrid/design` (`efc85a70`), `@offgrid/speech` `speechEndpoint.ts` (`aaf68870`) & Qwen3-ASR language map (`9fc50207`/`a6cd8033`), `@offgrid/sync` Half A `messageContent.ts` & `preprocessMarkdown` (`25276231^`), `@offgrid/rag` chunking/retrieval/vectorMath (`6ba7d5cb`), plus pre-Pro TTS wiring (`908af16a`, `767e0b91`).
  - **Completed & tested in OGAM-owned source (2026-11-22):**
    - `@offgrid/design` **100% eliminated** (`2 → 0` imports) via MIT tokens restored in `src/theme/designTokens.ts` (`scripts/__tests__/design-tokens.node.test.mjs`, 4/4 pass).
    - Pro-only zero-importer shared entries (`@offgrid/notes`, `@offgrid/notes-editor`, `@offgrid/writing`) removed from `package.json`, `metro.config.js`, and `jest.config.js`.
    - `@offgrid/speech` **100% eliminated** (`9 → 1` hits = `0` in `src/`, `0` in `package.json`/`metro.config.js`, only `1` synthetic scanner test fixture remaining): `src/utils/wavTrimPlan.ts`, `src/utils/voiceTurnSettings.ts`, `src/utils/speechEndpoint.ts`, `src/utils/transcriptionLanguages.ts`, and `src/utils/voiceSessionMachine.ts`.
    - `@offgrid/sync` **Half A 100% eliminated** (`44 → 29` `src/` imports, `14` pure chat/markdown/thread/queue/stream files cleared via MIT-restored `src/utils/messageContent.ts` + `chatMarkdown.ts`, `chatThreadCore.ts`, `chatQueue.ts`, `chatStreamHelpers.ts`, `chatSyncPrimitives.ts`).
  - **Remaining 3 `file:../shared/packages/*` dependencies:** `@offgrid/rag` (`31` symbols), `@offgrid/models` (`148` symbols in slices `M2..M7`), and `@offgrid/sync` **Half B** (Personal Mesh TCP/NaCl/mDNS only, `29` `src/` imports left).

Do not ask the user for `PRO_SUBMODULE_PAT` or add fake no-op stubs. Continue porting real vertical slices from `TWO_DIRECTORIES_CONTRACT_MAP_2026-11-22.md`.

## Research additions (2026-11-22): Breeno ColorOS 16 & Siri / Apple Intelligence parity

- **OPPO / ColorOS 16 Breeno static analysis summary:** See [`docs/jarvis/BREENO_COLOROS16_REFERENCE_SUMMARY_2026-11-22.md`](BREENO_COLOROS16_REFERENCE_SUMMARY_2026-11-22.md), cross-linked to PR #2 (`docs/research-breeno-coloros-2026-11-22`, commit `e4ef6016`, `research/breeno/OPPO_LOCAL_APK_STATIC_ANALYSIS_2026-11-22.md` & `research/breeno/OPPO_APK_MANIFEST_AND_NATIVE_INVENTORY_2026-11-22.json`). Key proof: none of the 26 ColorOS APKs (including exact phone build `Breeno 13.4.3_08c04e4_261110`) declares `VoiceInteractionService`; OEM `signature` certs lock private providers; OPPO's clean separation (`Voice` / encrypted SQLCipher+vector `com.oplus.dmp` / shared `com.oplus.aiunit` / `aimemory` / `shortcuts`) validates OGAM's public Android 16 architecture while keeping `com.opos.ads` adware and commercial bloat out.
- **Siri / Apple Intelligence clean-room 3-way blueprint:** See [`docs/jarvis/SIRI_APPLE_INTELLIGENCE_PARITY_BLUEPRINT_2026-11-22.md`](SIRI_APPLE_INTELLIGENCE_PARITY_BLUEPRINT_2026-11-22.md) comparing Apple Siri / Apple Intelligence vs Breeno ColorOS 16 vs OGAM / Jarvis across all 12 subsystems, with TypeScript contract targets (`PersonalContextRecord`, `ScreenContextSnapshot`, `ApprovalDecision`, `JarvisHudState`) and no proprietary Apple code/assets.

## Ordered next work

1. ~~**Finish `@offgrid/speech` (`3` remaining `src/` files → removes dep `4 → 3`):**~~ **DONE:** `src/utils/transcriptionLanguages.ts` + `src/utils/voiceSessionMachine.ts` implemented, all `src/` imports rewired, and `@offgrid/speech` removed from `package.json` & `metro.config.js`.
2. ~~**Extract `@offgrid/sync` Half A pure chat/markdown/queue helpers (`14` `src/` files → `44 → 29` imports):**~~ **DONE:** `src/utils/messageContent.ts`, `chatMarkdown.ts`, `chatThreadCore.ts`, `chatQueue.ts`, `chatStreamHelpers.ts`, and `chatSyncPrimitives.ts` implemented and tested without touching Personal Mesh Half B.
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
- **Updated local Node audit & test verification (Slice 4: `@offgrid/sync` Half A complete):**
  - Executed all **23** open-core Node test suites (**99** test cases total, incl. B1–B5 checks and the 4 new Half A suites) locally on Node `v26.13.1` → **99/99 passed, 0 failed, 0 skipped**.
  - Local `node scripts/audit-offgrid-imports.mjs` measured: `filesScanned: 1996`, `localFileDependencies: 3` (`@offgrid/models`, `@offgrid/rag`, `@offgrid/sync`), total external hits `1,320` (`1,354 → 1,339 → 1,335 → 1,320`), `packageImports: 432` (`@offgrid/sync` `src/`: `44 → 29`, total: `148 → 133`), `sharedWorkspacePaths: 64`, `0` external package imports in newly added files.
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

### Open-source ecosystems and reference projects surveyed today

These are research references, not claims that their code has been integrated into OGAM. Each reuse requires its own source, license, provenance, build and security review.

- **Chinese Android / agent references:** GitCode `exepc/ZorvAI` (typed tools, local models, MCP, Binder/plugin architecture); GitCode `2401_88872702/Aiassistant` (offline command assistant); `niki914/zafiro` (Breeno adapters and version-specific profiles); `timetetng/breeno-rikkahub` (Breeno chat forwarding patterns and security caveats); `KYRIE66nb/mobile-agent` (semantic Accessibility + visual fallback); `UgOrange/gui_agent_skill` (ADB/UI agent patterns). Public source platforms include GitCode, Gitee, AtomGit and Jihu/GitLab; ModelScope/OpenI/Hugging Face are relevant for model discovery.
- **Indian / Indic and voice-agent references:** `mukeshchandu/Personal-AI-Assistant` (Naomi; deterministic local commands and Vosk wake path); `mathanroot/nova-ai` (native VoiceInteractionService pattern); `Uktam-ai/uktam` (sherpa-onnx/llama.cpp/JNI Indic voice stack); `naveen-anon/JarvisAI`, `sannabotdev/sannabotapp`, `Subh24ai/yojana-sahayak-assistant`, `cld2labs/VaaniSahayak`, `Saanvirajput/Dhwani` and related Indic projects. Indic-specific model weights are not Russian models; only architecture and pipeline patterns may transfer.
- **Cross-ecosystem Android agent/security references:** Eta, Phtomt, PocketMind, AzCode and Aries AI; use the saved source-audit documents in `research/breeno/` for license and implementation caveats.
- **Russian voice pipeline references:** `meshoklv/ru-voice-agent` and `ru-speech-bench`, plus T-one, GigaAM-v3, Silero VAD, sherpa-onnx and tiny-voca-ru. These are candidates for benchmarking, not production integrations.
- **Transfer principle:** reuse behaviours/contracts, not proprietary source. Prefer an OGAM-owned implementation and keep the user's local/offline requirement intact.

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

## Gemini independent audit received — 2026-11-22 16:56 UTC

Substantive independent report is now available; this supersedes the earlier statement that Gemini had not yet produced a report.

- Full report: [Universal-AI-Factory Gemini outbox report](https://github.com/sokfrut-tech/Universal-AI-Factory/blob/main/coordination/gemini/outbox/REPORT_2026-11-22_OGAM_breeno_dex_audit.md) (commit `99bac606` on `sokfrut-tech/Universal-AI-Factory` `main`)
- Acceptance record: [Gemini acceptance](https://github.com/sokfrut-tech/Universal-AI-Factory/blob/main/coordination/gemini/outbox/ACCEPTED_2026-11-22_OGAM_breeno_dex_audit.md) (commit `3536746b`)
- OGAM summary and action list: [GEMINI_INDEPENDENT_AUDIT_2026-11-22.md](GEMINI_INDEPENDENT_AUDIT_2026-11-22.md)
- Reviewed PR #2 at `a5d5c71d`, PR #1 at `8ad6a6fd`, CI run `#45045542937` (17 Node suites / 68 local cases; not Gradle).
- Gemini independently confirmed the 26 APK Markdown/JSON metrics, exact Breeno and Memory build metadata, and evidence boundaries. No JADX, apksigner, Android build or device execution occurred; those tools were absent from the reviewed Windows workstation.

### New P0/P1 gates from Gemini

1. **P0 security test:** adversarial external intents to exported MainActivity may evade the exact URI matcher via scheme/host case variants, trailing slash or alternate URI encoding, then be interpreted by React Navigation. This is a reported security hypothesis, not yet reproduced. Add cold-start and onNewIntent tests proving that every route to the assistant voice screen requires the bridge's one-use token.
2. **P0 build/API verification:** B1–B3 are reported compile/component risks: RN 0.83.1 activity-result override/currentActivity signature; assistant session activity launch flags; hard-coded recognitionService component/package and debug applicationId suffix. Verify against exact dependencies, AOSP parser and debug/release manifest merge before patching.
3. **P1 lifecycle/security:** gate VoiceInteractionSessionService below API 31 consistently; validate ColorOS 16 background activity launch, lock screen, service process death, audio focus, PCM backoff and permission-denial behaviour on PGEM10.
4. **P1 research correction:** apply A1–A5 document corrections to PR #2: SearchService screenshot attribution, package/certificate grouping counts, AIUnit worker process terminology, inferred-vs-confirmed labels/size units, stale device evidence and CI references.
5. Obtain exact Instructions 17.7.2 APK from the device; run pinned JADX/apksigner/aapt2 only in an out-of-repository scratch directory. Do not commit raw proprietary output.

Gemini's B1–B5 findings are reviewer findings, not all reproduced defects. No runtime code has been changed from these claims. Reproduce/verify each finding, then implement and test the smallest safe fix. Preserve the original offline-first and clean-room requirements.

## B4 security finding reproduced and mitigated — 2026-11-22

This section supersedes the earlier status above that described B4 only as an unverified hypothesis.

### Root cause confirmed against the locked React Navigation versions

- OGAM's `package-lock.json` resolves `@react-navigation/native 7.5.1` and `@react-navigation/core 7.24.0`.
- At the corresponding upstream source revision `379552a`, `extractPathFromURL.tsx` collapses repeated slashes before passing the path to the core router; `getStateFromPath.tsx` ensures a trailing slash and its static-path matcher accepts percent-encoded path characters.
- Therefore the pre-fix native predicate (`scheme == offgrid && host == assistant && path == /voice`) did not cover every spelling the JS router could resolve to the same Chat route.
- Concrete bypass spelling: `offgrid://assistant/voice/?startVoice=1`. Android exposes `/voice/` as the path, so the old equality check against `/voice` did not classify it as the protected assistant intent, while React Navigation's route pattern accepts the trailing slash. This is a confirmed source-level parser mismatch; no live device exploit was executed.

Upstream source references:
- [React Navigation 7.5.1 URL extraction](https://github.com/react-navigation/react-navigation/blob/379552a/packages/native/src/extractPathFromURL.tsx)
- [React Navigation 7.24.0 route parser](https://github.com/react-navigation/react-navigation/blob/379552a/packages/core/src/getStateFromPath.tsx)
- [OGAM locked dependency versions](https://github.com/sokfrut-tech/OGAM/blob/feature/jarvis-step-2-storage-privacy/package-lock.json)

### OGAM mitigation committed to PR #1 branch

- `JarvisAssistantLaunchGuard.matchesAssistantVoiceRoute(uri)` now normalizes repeated/leading/trailing slashes, recognises percent-encoded unreserved static characters, and conservatively matches case variants of the protected route.
- `MainActivity.isJarvisAssistantIntent` now delegates to that matcher for ACTION_VIEW intents. Both cold-start (`onCreate`) and warm-start (`onNewIntent`) continue to pass through the same one-use-token consumer before React Native receives the assistant URL.
- Non-assistant routes such as `offgrid://oauth/callback` and `offgrid://pro/unlock` remain outside this route guard.
- Kotlin/JUnit regression vectors cover the canonical URL, trailing and repeated slashes, one-/three-slash authority forms, percent-encoded static characters, unrelated routes and malformed schemes. Existing one-use, forged-token and token-replacement tests remain intact.
- The open-core Node source-contract test checks that the route matcher stays wired into MainActivity and that these regression vectors remain in the Kotlin suite.

Files changed:
- `android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantLaunchGuard.kt`
- `android/app/src/main/java/ai/offgridmobile/MainActivity.kt`
- `android/app/src/test/java/ai/offgridmobile/voice/JarvisAssistantLaunchGuardTest.kt`
- `scripts/__tests__/android-assistant-contract.node.test.mjs`

Commits:
- Guard normalizer: `72abc73c68a72439f4bb80b4ea4559daf3ce0a3e`
- MainActivity wiring: `557a8d279ab2435685881610aab04e7f40d17a93`
- Kotlin/JUnit regression cases: `d60a3e143961bd72ac8f118359300d1340e1a070`
- Node contract coverage: `681aea5e7bb74accbaeabf54f0ce9f776e51f2b8`

### Fresh verification and limits

- GitHub Actions `OGAM external dependency audit` run [#45047342804](https://github.com/sokfrut-tech/OGAM/actions/runs/45047342804) completed successfully. Its `Verify Android Jarvis assistant contract` step passed with the new source wiring checks.
- This run is an open-core Node/source-contract workflow. It did **not** run the Kotlin/JUnit suite, Gradle compilation, Android manifest merge, APK assembly, or an on-device adversarial intent test.
- The Kotlin test additions are committed but remain unexecuted in the available evidence. Do not mark the full Android security acceptance criterion as passed yet.
- PR #1 remains open/draft/unmerged. No APK release or PGEM10 validation is claimed.

### Next security verification steps

1. Run `./gradlew :app:testDebugUnitTest` and the Kotlin compile against the exact RN 0.83.1 / pinned Android toolchain.
2. Add/execute Activity-level cold-start and `onNewIntent` instrumentation tests that submit the adversarial URLs and confirm the voice route is not delivered without a valid token.
3. Verify a valid private-bridge-issued token still opens the Chat voice route exactly once.
4. Test the same flows on an Android emulator and OPPO PGEM10 / ColorOS 16, including task already running and process recreation.
5. Then continue B1–B3 build/API verification and A1–A5 PR #2 documentation corrections; do not merge either draft PR merely because the Node contract workflow is green.

## Latest completed slice — `@offgrid/speech` 100% eliminated (`4 → 3` local deps)

- Migrated the remaining 3 `src/` consumers off `@offgrid/speech` into OGAM-owned self-contained TypeScript modules:
  - `src/utils/transcriptionLanguages.ts` (`isEnglishOnlyWhisperModel`, `transcriptionLanguages`) → wired into `src/components/TranscriptionLanguageSelect.tsx` and `src/services/qwenAsrEngine.ts`.
  - `src/utils/voiceSessionMachine.ts` (`MAX_EMPTY_TURNS`, `initialVoiceSession`, `nextVoiceSession`, `micShouldBeOpen`, `speechMayPlay`, `VoiceSession`, `VoiceSessionEvent`) → wired into `src/services/voiceSession.ts`.
- Removed `"@offgrid/speech": "file:../shared/packages/speech"` from `package.json` and removed `speechPackagePath` / `watchFolders` / `extraNodeModules['@offgrid/speech']` from `metro.config.js` (`package-lock.json` left untouched per `340c80e2`; synthetic scanner fixture in `scripts/__tests__/audit-offgrid-imports.test.mjs` kept).
- Added Node tests `scripts/__tests__/transcription-languages.node.test.mjs` (4/4) and `scripts/__tests__/voice-session-machine.node.test.mjs` (7/7) and wired both into `.github/workflows/ogam-external-dependency-audit.yml`.
- **Next continuation step starts at item 2:** extract `@offgrid/sync` **Half A** pure chat/reasoning/markdown/queue helpers into `src/utils/` (see `TWO_DIRECTORIES_CONTRACT_MAP_2026-11-22.md` Section 3.5), while keeping PR #1 as `Draft` and verifying `OGAM external dependency audit` CI.


## B1–B3 and B5 source/API triage — 2026-11-22

This section records exact-source/API review after the B4 mitigation. It does not replace required Gradle, manifest-merger, emulator or PGEM10 tests.

### B1 — React Native listener signature: no source-level defect found

- OGAM locks React Native `0.83.1`.
- The official React Native Android native-module documentation demonstrates the Kotlin `BaseActivityEventListener.onActivityResult` override with the same nullable parameter types used by OGAM: `Activity?` and `Intent?`. Therefore Gemini's suspected nullable/non-null override mismatch is not reproduced by the published Kotlin API example.
- OGAM's `currentActivity` access comes from `ReactContextBaseJavaModule.getCurrentActivity()`. It is an available nullable Activity accessor; current React Native changelog treats the API as deprecated/clarifies deprecation, not removed. The existing null check is correct for the documented API shape.
- No speculative signature patch was applied. A real compile against the pinned artifacts remains mandatory before marking B1 build-verified.

Reference: [React Native Android native-module docs — getting Activity results](https://reactnative.dev/docs/legacy/native-modules-android#getting-activity-result-from-startactivityforresult).

### B2 — explicit NEW_TASK flag: not required by these VoiceInteractionSession APIs

- OGAM calls `startAssistantActivity(launchIntent)` on API 26+ and `startVoiceActivity(launchIntent)` on its fallback branch.
- Android's public API reference explicitly states both methods create a new task and set `Intent.FLAG_ACTIVITY_NEW_TASK` automatically. Adding the flag manually is therefore unnecessary for the API contract and may only duplicate platform behaviour.
- The currently configured system assistant is enabled only API 31+, so the legacy branch is defensive rather than the PGEM10 execution path.
- No code change was applied. ColorOS 16 task/lock-screen/background activity-launch behaviour still requires device validation.

Reference: [Android VoiceInteractionSession API — startAssistantActivity and startVoiceActivity](https://developer.android.com/reference/android/service/voice/VoiceInteractionSession#startAssistantActivity(android.content.Intent)).

### B3 — recognitionService metadata and debug applicationId: conditionally safe, with a documented limitation

- The locked Android manifest uses a non-empty `android:recognitionService` string. AOSP's `VoiceInteractionService` attribute definition says the field must be non-empty; on Android 12+ it does nothing. On Android 11 and earlier it must reference a valid `RecognitionService`.
- OGAM's `jarvis_voice_interaction_enabled` is false in `res/values/bools.xml` and true in `res/values-v31/bools.xml`. Thus the current assistant entry point is deliberately unavailable below API 31, and the metadata's placeholder component value is not used by the supported Android 12+ implementation. The debug `.dev` applicationId suffix is not a runtime component-validation failure on API 31+ because AOSP documents the attribute as unused there.
- A legacy RecognitionService has not been implemented. Do not enable the system-assistant entry point below API 31 until OGAM adds a real RecognitionService adapter and changes this metadata to its actual component.
- The AndroidX/AOSP API contract source is strong enough to reject the claim that a wrong component value alone breaks API 31+, but debug/release manifest and device behaviour still need build/runtime verification.

Reference: [AOSP VoiceInteractionService attributes](https://android.googlesource.com/platform/frameworks/base/+/4fd8e1246d9b503f602412021df52e87e418ed1c/core/res/res/values/attrs.xml#8628).

### B5 — service gate consistency fixed in source

- The main `JarvisVoiceInteractionService` already used `android:enabled="@bool/jarvis_voice_interaction_enabled"`.
- The companion `JarvisVoiceInteractionSessionService` did not. The manifest now applies the same gate to it, so both components are disabled below API 31 and enabled together on API 31+.
- The Node source-contract suite now asserts the gate on both services and the true/false resource values.
- Remaining B5 work is runtime-only: PGEM10/ColorOS 16 background activity launch, lock screen, service process death/restart, permission denial, audio focus and PCM playback. Broad manifest permission justification is still open.

### Commits from this triage

- Session service API gate: `a781a873ad1f99c03ba6b3e66578f1b6ba75c2ad`.
- Node contract assertion for both service gates: `9c6863aea09aa66cbc3ed7147dd714098f11f6a1`.

### Verification status

- B4: React Navigation normalization mismatch confirmed from locked-version source and source-level mitigated; Activity-level and device tests still pending.
- B1: no signature incompatibility found in public RN Kotlin API example; exact Gradle compile pending.
- B2: no missing-NEW_TASK defect; Android API sets it automatically; device BAL behaviour pending.
- B3: no API31+ parser/component-validation defect; legacy API<31 support intentionally disabled until a real RecognitionService exists.
- B5: source-level API gate now aligned; Gradle/manifest merge and device lifecycle checks pending.
- The changes above are not merge/release approval. PR #1 remains draft until complete Android verification.

## B1 — exact Gradle compile failure reproduced; corrective patch committed (2026-11-22)

This addendum supersedes the earlier source-only triage paragraph that said no B1 signature defect had been reproduced. The pinned Android build is now the controlling evidence.

### Reproduced failures on the prior PR #1 head

GitHub Actions `CI` run [#45047788945](https://github.com/sokfrut-tech/OGAM/actions/runs/45047788945), tested against commit `df3fdb3fb5113bb9999f40448a443a5cf8d2b56d`, completed the Android setup and reached Gradle task `:app:compileDebugKotlin`. The task failed with these compiler diagnostics:

- `JarvisAssistantRoleModule.kt:35`: `onActivityResult` “overrides nothing”; the compiled React Native interface expected a non-null `Activity` argument (and nullable `Intent?`), while OGAM declared `Activity?`.
- `JarvisAssistantRoleModule.kt:93`: Kotlin could not resolve the synthetic `currentActivity` property from this RN base class.
- `JarvisAssistantRoleModule.kt:117`: `startActivityForResult` became unresolved downstream of the unresolved Activity value.
- `JarvisPcmStreamPlayer.kt:305`: `AudioTrack.setVolume(Float)` returns `Int`, which did not satisfy OGAM's `JarvisPcmTrack.setVolume(Float): Unit` interface.

### Corrective source changes

- `JarvisAssistantRoleModule.onActivityResult` now matches the compiler's resolved API: `activity: Activity`, `data: Intent?`.
- The module retrieves the Activity with explicit `getCurrentActivity()` rather than relying on the unresolved Kotlin synthetic property. The existing null guard remains; the returned Activity is not retained beyond the request.
- The activity's `startActivityForResult` is called on the resolved Activity instance.
- `AndroidJarvisPcmTrack.setVolume` now uses a block body and intentionally returns `Unit` after delegating to AudioTrack.

Commits:
- Role module fix: `53ef299f378a4c070c10a36879dd63cc50cab42b`.
- PCM player fix: `20650c137cb1fe3f66de450d8d1d706a28f2e18f`.

### Fresh verification status

- External dependency/source-contract audit run [#45048605892](https://github.com/sokfrut-tech/OGAM/actions/runs/45048605892) passed on head `20650c137cb1fe3f66de450d8d1d706a28f2e18f`.
- Full CI run [#45048605797](https://github.com/sokfrut-tech/OGAM/actions/runs/45048605797) was queued/pending immediately after the patch; it must be allowed to report the Gradle result. Do not describe the compiler fixes as verified until its Android job finishes.
- On the preceding head, the Android compile stopped before Kotlin/JUnit execution; the 20 current Kotlin test cases (7 launch guard, 5 role snapshot, 8 PCM player) have not yet been proven to run.
- The same preceding full CI run also had unrelated, already-known JS workspace migration failures: unresolved `@offgrid/models`, `@offgrid/sync`, `@offgrid/rag` imports and inaccessible private `pro/*` test modules; the lint/type/architecture job likewise reported missing workspace modules and downstream type errors. These require completion of the OGAM package migration and test-boundary work; they are not evidence that the native assistant tests passed or failed.
- PR #1 remains draft/unmerged. Manifest merge, APK assembly, instrumentation testing, emulator testing and PGEM10 runtime behavior remain outstanding.

## Slice 4 completed — `@offgrid/sync` Half A pure utilities migrated (`44 → 29` `src/` imports)

- Restored MIT pre-extraction `src/utils/messageContent.ts` (`25276231^`) + `withoutReasoning`, removing both `@offgrid/sync` imports while preserving all 9 `parseModelOutput` anti-leak contract invariants.
- Implemented self-contained OGAM modules with zero external runtime deps: `src/utils/chatMarkdown.ts` (`MarkdownText.tsx`), `src/utils/chatThreadCore.ts` (`src/utils/chatThread.ts`), `src/utils/chatQueue.ts` (`generationService.ts`, `Toolbar.tsx`), `src/utils/chatStreamHelpers.ts` (`chatStreamTools.ts`, `ChatMessage/index.tsx`, `ChatScreen/types.ts`, `useRemoteChatStreamPreviews.ts`, `remoteChatStreamStore.ts`), and `src/utils/chatSyncPrimitives.ts` (`visibleMessages.ts`, `imagePromptEnhancement.ts`, `imageGenerationHelpers.ts`, `networkDiscovery.ts`).
- Added 4 standalone Node test suites wired into `.github/workflows/ogam-external-dependency-audit.yml` (`message-content.node.test.mjs`, `chat-markdown-and-sync-primitives.node.test.mjs`, `chat-thread-core.node.test.mjs`, `chat-queue-and-stream.node.test.mjs`).
- **`@offgrid/sync` Half B (Personal Mesh TCP/NaCl/mDNS) was deliberately untouched**; `package.json` and `metro.config.js` retain `@offgrid/sync` until Half B is scheduled.
- **Next continuation step starts at item 3:** port `@offgrid/rag` & `@offgrid/rag/documents` starting from OGAM's own MIT pre-extraction commit (`6ba7d5cb:src/services/rag/{chunking,retrieval,vectorMath}.ts`) to reduce `localFileDependencies` from `3 → 2`.


## Latest CI result — Gradle dependency rate limit, Kotlin patch not yet recompiled (2026-11-22)

- Latest full CI run [#45049107228](https://github.com/sokfrut-tech/OGAM/actions/runs/45049107228), head `95682ccb2246eb9a2a2cea4521eb137498f43771`, finished with failure.
- Android job reached the Gradle setup/run step but failed resolving `com.google.code.gson:gson:2.9.1`, a transitive dependency of `org.gradle.toolchains:foojay-resolver:0.5.0`. Maven Central returned HTTP `429 Too Many Requests` for `https://repo.maven.apache.org/maven2/com/google/code/gson/gson/2.9.1/gson-2.9.1.pom`. The Gradle Plugin Portal fallback resolved to the same Maven Central URL and was rate-limited too.
- No `:app:compileDebugKotlin` task began and no Kotlin diagnostics were produced on this latest head. Therefore this run neither validates nor falsifies the corrective patches to `JarvisAssistantRoleModule.kt` and `JarvisPcmStreamPlayer.kt`.
- The previous actual compiler diagnostics were on head `df3fdb3`: wrong RN callback signature, unresolved synthetic `currentActivity`, and PCM `setVolume` return-type mismatch. Source fixes were committed as `53ef299f` and `20650c13`.
- External source-contract audit [#45049107229](https://github.com/sokfrut-tech/OGAM/actions/runs/45049107229) succeeded on latest head `95682ccb`. It does not compile Kotlin.
- Full CI's JavaScript lint/type/Jest gates remain red because the ongoing standalone migration still leaves `@offgrid/models`, `@offgrid/sync`, and `@offgrid/rag` consumers unresolved in this branch, as well as test imports from private `pro/*` paths that are not present in the checkout. Continue the exact package-slice migration and test-boundary cleanup rather than masking these imports.
- Required next step: repeat the Android Gradle run after the external Maven rate limit clears, preferably with a populated Gradle dependency cache. The successful build must show `:app:compileDebugKotlin`, `:app:testDebugUnitTest`, and Android manifest merge results on the same commit. Then proceed to APK assembly and instrumentation/PGEM10 testing.

## Standalone workspace migration — first M2 helper port and CI checkout diagnosis (2026-11-22)

### Why the previous PR CI could not see shared packages

- The setup-mobile composite action only checks out off-grid-ai/shared and off-grid-ai/mobile-pro when PRO_SUBMODULE_PAT is present.
- The inspected PR #1 Actions logs show the branch selection, shared checkout and shared placement steps skipped. Jest/TypeScript then report missing @offgrid/models, @offgrid/rag, @offgrid/sync, and absent pro/* test paths.
- This is a repository architecture dependency, not a Jarvis runtime bug. OGAM must be independently buildable; do not make adding a private token the permanent solution. Continue the clean-room package migration using consumer contracts and OGAM's own MIT pre-extraction history.

### First M2 helper completed in source

- Added src/utils/toolResultBudget.ts with OGAM-owned MAX_TOOL_RESULT_CHARS = 24,000 and boundToolResult().
- Updated src/services/tools/toolResult.ts to import/re-export the local helper. This removes one source import from @offgrid/models while preserving the 24k cap and explicit truncation notice (retained count + original count).
- Added scripts/__tests__/tool-result-budget.node.test.mjs covering default cap, unmodified in-budget content, head-preserving truncation, caller-supplied smaller budget, negative and non-finite limits.
- Added this test to .github/workflows/ogam-external-dependency-audit.yml so the pure contract can be tested without the external shared checkout.
- Changes are intentionally narrow; M2 is not complete and package.json still correctly declares the remaining model workspace dependency until every import and transitive contract is migrated.

Next model-migration slices:
1. M2 reasoning payload + tool-call count policy + prompt/result budget helpers.
2. M3/M4 model styles, model naming/classification and associated types.
3. M5 device fit, model residency and backend tables — high-risk, must preserve existing performance thresholds.
4. M6 catalog parser/cache/merge with parity checks.
5. M7 guide/promo copy can be simplified for the Jarvis standalone product.

The @offgrid/rag and @offgrid/sync migrations remain separate workstreams. No shared/private package source was copied into OGAM.

## M2 clean-room migration checkpoint — reasoning and tool-loop budgets (2026-11-22)

### OGAM-owned modules added
- `src/utils/toolResultBudget.ts` — 24k hard cap, head-preserving truncation notice.
- `src/utils/reasoningBudget.ts` — automatic/explicit reasoning budgets, labels, native llama.rn token-limit payload and OpenRouter `reasoning` config.
- `src/utils/toolLoopBudget.ts` — per-turn max tool calls, prompt-size estimate, conservative remaining-context result cap, tool-limit instruction, recovery result formatter.

### Consumers migrated
- `src/services/tools/toolResult.ts`
- `src/services/llmHelpers.ts`
- `src/components/settings/textGenAdvancedSections.tsx`
- `src/services/providers/openAICompatibleProvider.ts` (OpenRouter request payload only)
- `src/services/generationToolLoop.ts`
- `src/hooks/useTextGenerationSettings.ts`
- `src/stores/appStore.ts`

The single remaining M2 symbol still imported from `@offgrid/models` is `reasoningBudgetPayload` in the remote-vision branch of `openAICompatibleProvider.ts`. Preserve that wire contract until the exact remote-vision server consumer is found or an OGAM-owned explicit contract is added; do not silently map it to OpenRouter semantics.

### Standalone verification
- `scripts/__tests__/tool-result-budget.node.test.mjs`
- `scripts/__tests__/reasoning-budget.node.test.mjs`
- `scripts/__tests__/tool-loop-budget.node.test.mjs`
- All three are wired into `.github/workflows/ogam-external-dependency-audit.yml`.
- External dependency audit [#45051550585](https://github.com/sokfrut-tech/OGAM/actions/runs/45051550585) passed all steps on commit `3d88e21792dcf2c764cebf98c6006f5339c9b127`.
- The full React Native CI is a separate gate; it continues to report missing workspace imports because the shared/pro checkouts are skipped when the private token is absent. Android Gradle verification was cancelled by the workflow's latest-commit concurrency and remains pending; the earlier valid Kotlin compiler run was the one that found the four source errors recorded above.

### Next
1. Trace/define the remaining remote-vision `reasoningBudgetPayload` without changing the OpenAI-compatible wire contract.
2. Continue M3 media styles/defaults, then M4 naming/classification.
3. M5 device/backend/residency contracts require strict test parity and no threshold changes without evidence.
4. Complete M6 catalog and M7 Jarvis standalone simplification before removing the final `@offgrid/models` package declaration.


## M3 media style catalog — first standalone slice (2026-11-22)

- Added `src/constants/mediaStyles.ts`; 16 image and 6 video style IDs are aligned to the local preview map and the existing persisted chat-style ID contract.
- Updated `src/services/mediaStyles.ts`, `src/components/MediaStyles/{StyleRow,StyleGrid,ChatStyleSetting,RestyleButton}.tsx`, `src/stores/mediaStyleStore.ts`, `src/screens/ChatScreen/useChatGenerationActions.ts`, and `src/services/generationService.ts` to use OGAM-owned types/catalog.
- Added and wired `scripts/__tests__/media-style-catalog.node.test.mjs` including preview-file existence checks.
- OGAM-only audit passed on `9ff1eebc7101d5cfc783a0338026d778e62fb2fa`: [run #45051946914](https://github.com/sokfrut-tech/OGAM/actions/runs/45051946914).
- Evidence caveat: prompt words in the new catalog are OGAM-authored clean-room defaults because original `@offgrid/models` catalog source is absent from this checkout. The style IDs and asset mapping are locally verified, but exact original prompt-word parity is not yet established.
- Full RN CI `#45051946894` remains red due to missing shared workspace modules/private `pro/` checkout in CI without the private token. Jest shards and lint report missing-module / 112 workspace-boundary errors; this is not a successful app build. Android job status was not yet final at last inspection.

### Next steps
1. Obtain/inspect the exact shared `@offgrid/models` source (authorized local workspace or repo history) and reconcile style catalog wording/metadata without guessing.
2. Continue M3 through image/video model settings and image parameter policy only after locating the real consumer contracts and tests.
3. Do not change trained-resolution / RAM admission thresholds while migrating M5.
4. Restore full workspace dependencies in CI or provide a reproducible public OGAM-only workspace build before treating the main RN Jest/type/lint gates as meaningful.

---

## Slice 5 completed — `@offgrid/rag` + `@offgrid/rag/documents` 100% eliminated (`3 → 2` local deps, 2026-11-22)

- **Added self-contained modules (zero external deps, Node `--experimental-strip-types` clean):**
  - `src/utils/remoteComputerSearch.ts`: `searchRemoteComputer`, `withoutChatsOnDevice`, `RemoteSearchOutcome`, `RemoteSearchResult`, `SearchRemoteComputerOptions`. Migrated all `3` `src/` consumers (`pairedComputerSearch.ts`, `PairedComputerResults.tsx`, `usePairedComputerSearch.ts`).
  - `src/utils/ragDocumentsCore.ts`: `DOCUMENT_SCHEMA_VERSION`, `CHUNK_CHARS`, `estimateTokens`, `textParts`, `pageNeedsOcr`, `cleanPages`, `splitPages`, `indexedText`, `contentTerms`, `documentMap`, `splitCitations`, `searchBlock`, `parseSearchBlock`, `describeTurnStatus`, `DocumentIngestService`, `DocumentTurnService`, and all 18 typed port interfaces (`DocumentIndexStore`, `KeywordSearchPort`, `ExtractPort`, `EmbedPort`, `ConversationDocumentsPort`, `ProjectDocumentsPort`, `Scheduler`, etc.). Migrated all `16` `src/` files + all `4` `__tests__/` files (`ChatMessageCitations.test.tsx`, `turnDocuments.integration.test.ts`, `searchKnowledgeBaseRoundtrip.test.ts`, `upgradeFromV0119.rendered.test.tsx`).
- **Build config & CI:** Removed `@offgrid/rag` from `package.json` and removed `ragPackagePath`, its `watchFolders` entry, stale RAG comments, and `@offgrid/rag` + `@offgrid/rag/documents` aliases from `metro.config.js` (`package-lock.json` kept untouched). Added `scripts/__tests__/remote-computer-search.node.test.mjs` (`4/4`) and `scripts/__tests__/rag-documents-core.node.test.mjs` (`4/4`) and wired both into `.github/workflows/ogam-external-dependency-audit.yml`.
- **Local Node verification (`v26.13.1`):** All **29** workflow Node test suites (**131/131** test cases: `13/13` plain Node + `118/118` `--experimental-strip-types`) passed; `node scripts/audit-offgrid-imports.mjs` measured `2,008` files scanned, `1,283` total refs (`packageImports: 396`, `@offgrid/rag` `src/`: `0`, `test`: `0`, `build-config`: `0`), `localFileDependencies: 2` (`@offgrid/models`, `@offgrid/sync`).
- **Honest verification limits:** Local checks cover pure contracts via Node only; TypeScript `tsc`, full Jest suite, APK assembly, and OPPO Find X6 Pro PGEM10 runtime tests remain unexecuted here.

## Android CI verification milestone & test clash fix (2026-11-22)

- Inspection of GitHub Actions `CI` run [#45052196801](https://github.com/sokfrut-tech/OGAM/actions/runs/45052196801) (`a65dbca1`, job `137300347889`) confirmed `:app:processDebugMainManifest`, `:app:processDebugManifest`, `:app:processDebugResources`, **`:app:compileDebugKotlin`** (validating B1 main-source fixes `53ef299f` & `20650c13`), and `:app:compileDebugJavaWithJavac` all **succeeded**.
- `:app:compileDebugUnitTestKotlin` failed strictly on a JVM signature clash inside test fake `JarvisPcmStreamPlayerTest.FakeTrack` (`var volume = 1f` + `override fun setVolume(volume: Float)` both compile to `setVolume(F)V`). Renamed the fake backing field to `currentVolume` so `:app:compileDebugUnitTestKotlin` and `:app:testDebugUnitTest` can proceed cleanly on the next CI run.

## Reconciled technical caveats across today's 7 ChatGPT sessions (do not regress)

- **Silero VAD/TTS license split:** `v5_5_ru` carries non-commercial terms whereas `v5_cis_base` is **MIT** — keep license provenance explicit before any default bundling.
- **`k2-fsa/sherpa-onnx` Android AAR (~52 MB):** Verify slim arm64-v8a-only packaging before adding to APK size budget.
- **`egnch/tiny-voca-ru` (~21.4 MB ONNX, Apache 2.0):** Requires Python-to-Kotlin phonetics/stress frontend port + ONNX Runtime Android + PGEM10 real-device latency benchmark.
- **Breeno APK inventory:** `26` ColorOS/Breeno local APKs have been audited (`research/breeno/`, PR #2 `3c4bf87c`), including `Breeno 13.4.3`, `Breeno Memory 16.11.5`, and `Инструкции Breeno 17.2.4`; `Breeno Instructions 17.7.2` remained unavailable due to external Chinese catalog download failures.



## Gemini audit follow-through — bridge-token expiry hardening (2026-11-22 evening)

- Independent Gemini report reviewed from `sokfrut-tech/Universal-AI-Factory/coordination/gemini/outbox/REPORT_2026-11-22_OGAM_breeno_dex_audit.md`.
- PR #2's native-source verification document now contains an explicit B1–B5 disposition, distinguishing fixed source issues, rejected API hypotheses and remaining runtime gates: [audit reconciliation](https://github.com/sokfrut-tech/OGAM/blob/docs/research-breeno-coloros-2026-11-22/research/breeno/PR1_NATIVE_ASSISTANT_SOURCE_VERIFICATION_2026-11-22.md), commit `1e7b0131b71ad258d06fbd26005c41363eeb1780`.
- Gemini's B4 route-normalization bypass had already been mitigated in `JarvisAssistantLaunchGuard.matchesAssistantVoiceRoute` and `MainActivity`; a further weakness remained: the one-use bridge token had no expiry.
- Added a monotonic-clock TTL to `JarvisAssistantLaunchGuard`: pending bridge authorization expires after **10 seconds**, expired or clock-rollback tokens fail closed, successful consumption clears token and timestamp, and a newer issue replaces the prior pending token.
- Added deterministic unit coverage for expiry after the TTL, exact TTL boundary acceptance, clock rollback rejection and one-use behavior.
- Commits on `feature/jarvis-step-2-storage-privacy`: `794bdadf327beee7925755b43fb28395ad1f59bb` (guard) and `da23c21ba5d76eedbaae99973635d183e8587d6d` (tests).
- **Verification not yet established for this slice:** commit-triggered workflow lookup returned no PR workflow runs for the test commit at the time of this update. Do not claim Kotlin/JUnit passed. Require a fresh Android CI run to execute `:app:compileDebugKotlin`, `:app:compileDebugUnitTestKotlin` and `:app:testDebugUnitTest`.
- Remaining Android audit items: PGEM10 background/lock-screen/service restart and audio-focus tests; PCM assistant-usage/backoff review; production Russian TTS integration; explicit permission-denial/airplane-mode matrix.


## PCM assistant-audio follow-through — 2026-11-22 evening

- Updated both the streamed `AudioTrack` and `AudioFocusRequest` attributes from `USAGE_MEDIA` to `USAGE_ASSISTANT`, retaining `CONTENT_TYPE_SPEECH`. This makes the intent of the native PCM path assistant speech rather than music playback.
- Increased the non-blocking `AudioTrack.write()` zero-progress retry park from 100 microseconds to 5 milliseconds. The previous interval could wake the synthesis thread up to 10,000 times/second while the buffer was full; the new interval bounds polling to about 200 attempts/second while continuing to check the generation token and cancellation.
- Source commit: `ab9ef929df6d4223b9faf82c4201cacc177ba186`.
- This remains a low-level player only: no production TTS backend is connected, and audio routing/ducking/latency must be measured on PGEM10. No performance claim is made from source inspection alone.
- No workflow run was returned for this commit at the time of this handoff update. Require Android compile + unit tests before considering this slice verified; then test assistant routing, ducking, focus loss, barge-in and sustained streaming on the target device.


## Latest continuation — Gemini audit hardening and PCM source-contract coverage (2026-11-22)

- Gemini's independent B1–B5 findings are reconciled in the PR #2 research branch document. B4 route normalization was already fixed; this continuation adds the missing 10-second monotonic-clock expiry to the one-use private bridge token, with deterministic Kotlin tests for expired tokens, exact expiry boundary, clock rollback and one-use semantics.
- PCM assistant playback now uses `AudioAttributes.USAGE_ASSISTANT` for both AudioTrack and AudioFocusRequest, with `CONTENT_TYPE_SPEECH`. A zero-progress non-blocking write parks for 5 ms rather than 100 μs to avoid a tight wake-up loop.
- Added a source-contract test to `scripts/__tests__/jarvis-pcm-playback.node.test.mjs` pinning both assistant usage attributes and the 5 ms retry backoff. The pre-existing source-contract suite still checks mono Float32 stream ordering, focus handling and generation cancellation.
- Latest commits on PR #1 branch: `794bdadf327beee7925755b43fb28395ad1f59bb`, `da23c21ba5d76eedbaae99973635d183e8587d6d`, `ab9ef929df6d4223b9faf82c4201cacc177ba186`, `88413302d962297ee9b53d6624f3987c0e48e056`, followed by this handoff update.
- Verification status: no PR-triggered workflow run was returned for the latest test commit at lookup time; neither Kotlin/JUnit nor the new Node assertion is claimed green. Recheck Actions on the PR head and run Android unit tests before accepting these changes.
- The correct dependency-migration order remains: (1) M2 remote-vision `reasoningBudgetPayload` only after its exact wire contract is recovered; (2) M3 SD/video policy only after exact source and consumer contracts; (3) M4 naming/classification; then M5–M7. The private sibling workspace `../shared/packages/models` is not readable through the current GitHub integration, so no guessed payload, SD threshold, checkpoint rule or video/RAM policy may be substituted.
- The prior `@offgrid/sync` Half A and `@offgrid/rag` work is already completed and documented; do not repeat it. `@offgrid/sync` Half B is the separate Personal Mesh/crypto/networking workstream and remains deferred until the Android Jarvis MVP and safety gates.
- PR #1 remains open/draft; PR #2 remains open/draft. No merge, APK release or PGEM10 runtime pass is claimed.


## New Qwen3-ASR runtime alternative — sherpa-onnx audit (2026-11-22)

- Discovered official sherpa-onnx support for Qwen3-ASR 0.6B, with Android arm64-v8a and iOS arm64 support listed in upstream docs.
- Read upstream Kotlin example `kotlin-api-examples/test_offline_qwen3_asr.kt`, Java model config `OfflineQwen3AsrModelConfig.java`, Swift example `swift-api-examples/qwen3-asr.swift`, and C++ Qwen3 ASR example.
- Published INT8 ONNX model: `sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25`; package directory reports 1,954,552,000 bytes (~1.82 GiB): conv frontend ~42 MB, encoder.int8 ~174 MB, decoder.int8 ~721 MB, tokenizer files ~4.2 MB, plus tests.
- Russian is explicitly listed. Kotlin/Swift APIs are available. Android examples use CPU provider and optional Silero VAD.
- Important: Qwen3-ASR is an offline recognizer. sherpa's microphone "simulated streaming" is VAD/chunked use; do not promise native incremental token streaming.
- OGAM already integrates the GGUF+mmproj variant through llama.rn. The sherpa ONNX model is a distinct artifact set and must never share catalog files/checksums/IDs with the GGUF variant.
- Next engineering step: a separate opt-in benchmark only; no duplicate model in normal app install. Compare on identical Russian clips, measure cold/warm load, RTF, peak RSS, CPU/thermal, WER/CER, noisy speech and cancellation on PGEM10. Avoid simultaneous residency and preserve Whisper fallback.
- Before adding sherpa native dependency, confirm official Kotlin AAR coordinates/version, arm64-only packaging, exact transitive ONNX Runtime license notices and APK-size impact; use Swift XCFramework separately for iOS.
- Generic ONNX support is not Qualcomm NPU proof; upstream Qwen3 sherpa examples specify CPU provider. No SM8550 hardware test is yet established.
- Research details: [Chinese model evaluation](https://github.com/sokfrut-tech/OGAM/blob/docs/research-breeno-coloros-2026-11-22/research/china/CHINESE_OPEN_MODELS_EVALUATION_2026-11-22.md).


## React Native sherpa-onnx TurboModule candidate (2026-11-22)

- New candidate: `XDcobra/react-native-sherpa-onnx`, a React Native TurboModule with Android + iOS support and explicit `qwen3_asr` model type. Current main package.json says SDK 0.4.4; pinned prebuilt tag files in main say sherpa-onnx 1.12.35-1 and Android ONNX Runtime QNN build 1.24.4-qnn2.43.1.260218-1. The README still describes SDK 0.3.0 / bundled 1.12.35, so pin a real release/tag and reconcile this version drift before use.
- This is a closer fit than writing a new Kotlin bridge: OGAM is React Native and already uses native TurboModules. However no package added and no build attempted.
- SDK docs list QNN on SM8550, but QNN needs QNN-compatible model files or a QNN context. A generic Qwen3-ASR INT8 ONNX model is not proven QNN-compatible. A default `getQnnSupport()` validates only a small test model; use the actual Qwen model for model-specific initialization and run a full decode.
- SDK's Qwen3 TypeScript options expose hotwords/decode limits but no language hint; current OGAM llama.rn implementation supports a language-prefill prompt. Qwen can auto-detect, but this difference should be measured.
- Qwen3-ASR is offline/utterance-level. SDK streaming STT uses streaming-capable model types; do not label Qwen3-ASR as token-streaming.
- License review: wrapper MIT; sherpa-onnx Apache-2.0; ONNX Runtime MIT; SDK inventory also contains LGPL FFmpeg/Shine and BSD components. Review actual flags/notices; test disabling unused FFmpeg to reduce binary/licensing scope.
- Android ABI filters currently include arm64, armeabi-v7a, x86, x86_64. iOS XCFramework downloaded during pod install. Audit package size and reproducibility.
- Existing OGAM QNN runtime assets may collide with wrapper's QNN/ORT native libs; audit names, versions, load paths, packaging and existing asset-copy logic before QNN enablement.
- Next: isolated dependency spike on a throwaway branch, pin exact release, include only STT/Qwen, CPU/XNNPACK baseline, then compare with existing llama.rn Qwen on PGEM10. No production dependency, model or code changed by this note.


## TTS candidates added — Qwen3-TTS Android and Supertonic 3 (2026-11-22)

- Found `Danmoreng/qwen3-tts-android`: Kotlin/Compose + JNI + C++/GGML Android app; Q4_K_M 0.6B Base talker + 12Hz tokenizer; local speaker profile / embedding, generation history, stop/export/progress; Android 12+, arm64 only. App README provides no PGEM10 or other handset performance/memory benchmark. Do not call it device-validated.
- Native submodule `Danmoreng/qwen3-tts.cpp` supports Russian among its 10 language IDs, voice cloning, speaker embedding and 0.6B/1.7B model families. Its own benchmark table is Windows RTX 5080 CUDA, not mobile evidence.
- 0.6B Q4 package estimate from model index: talker ~629 MB + tokenizer ~255 MB = ~884 MB. 1.7B voice-design is not a default phone candidate.
- Found Supertonic 3 INT8 through sherpa-onnx: 31 languages including Russian, 10 fixed speakers, 24 kHz, Android Kotlin TTS engine APK. Good low-memory fallback candidate; not a voice-cloning or free-form voice-design system. Model license OpenRAIL-M, not Apache-2.0.
- Updated candidate order for experiments: Supertonic 3 INT8 as lightweight fallback; Qwen3-TTS 0.6B Q4 as possible expressive/clone voice; CosyVoice3-MNN as high-quality reference. Keep Piper baseline until measured.
- All candidates require real PGEM10 tests: same Russian prompts, pronunciation, cold/warm latency, RTF, peak RSS, thermal throttling, cancellation and airplane mode. Desktop/SM8850 numbers are not extrapolated to SM8550.
- Research note: [Chinese model evaluation](https://github.com/sokfrut-tech/OGAM/blob/docs/research-breeno-coloros-2026-11-22/research/china/CHINESE_OPEN_MODELS_EVALUATION_2026-11-22.md).


- Additional maturity evidence for `Danmoreng/qwen3-tts-android`: public v0.1.0 arm64 APK release (49,955,560 bytes; model downloaded separately), GitHub Actions release workflow uses JDK 17 / NDK 27.2.12479018 / API 36 / CMake 3.22.1. No dedicated unit/instrumentation tests were found in the reviewed tree. Treat as a smoke-test artifact/reference, not a production-ready proof.


- TTS API caveat: source-level Qwen3-TTS Android `QwenEngine.synthesize()` returns a complete FloatArray; progress callback is token progress, not PCM chunks. CosyVoice3-MNN `CosyVoiceRuntime.synthesize()` writes a completed file and returns a report. The original models advertise streaming, but these Android wrappers do not expose incremental PCM in the inspected API. Do not promise low first-audio latency.
- OGAM `JarvisPcmStreamPlayer` already accepts Float32 chunks and supports generation-token cancellation; backend must actually emit chunks. Keep a capability flag for batch vs streaming and never simulate streaming by chunking a completed waveform after the fact.
- RN sherpa SDK has `createStreamingTTS()` PCM chunk callbacks, but voice cloning in streaming mode is documented for Pocket only; Zipvoice cloning is batch-only. Supertonic incremental generation is not established. Verify model-specific behavior before selecting.

## Reconciliation of Chinese TTS research with existing Russian TTS decision (2026-11-22)

- Read `docs/jarvis/LOCAL_RUSSIAN_TTS_RUNTIME_EVALUATION.md` before changing candidate order. It already selected tiny-voca-ru as compact Russian prototype and sherpa-onnx 2.0.3 + Supertonic-3 as the streaming-oriented Kotlin prototype, subject to model license and OPPO tests.
- Qwen3-TTS Android and CosyVoice3-MNN Android wrappers are batch APIs in the inspected source: Qwen returns a complete FloatArray; CosyVoice writes a completed file. Keep them as quality A/B candidates, not as the first streaming backend.
- New critical source finding: sherpa-onnx v2.0.3 declares callback return 0=stop / 1=continue, but Supertonic's `ProcessChunksAndConcatenate()` ignores that return. OGAM prepared `patches/sherpa-onnx/v2.0.3-supertonic-callback-stop.patch` (commit 6043dda5) to stop after the current chunk. Patch is documentation/source artifact only; it has NOT been applied to a compiled AAR or tested.
- v2.0.3 Android JNI callback wrapper captures JNIEnv/local jobject. C++ callback appears synchronous in the inspected Supertonic generation loop, but no explicit thread-attach/global-ref safety exists. There is an upstream reported Android SIGABRT issue #3492; smoke-test on device and patch if thread-crossing is observed.
- Immediate audio barge-in is already supported by JarvisPcmStreamPlayer. Native compute cancellation is not yet proven; do not overlap a new TTS generation with an old Supertonic generation unless the old worker is actually stopped/released.
- Updated priority: tiny-voca-ru compact prototype; Supertonic-3 streaming-oriented after patch/license/device gates; Qwen3-TTS/CosyVoice batch quality comparisons.


## Engine-neutral TTS contract and incremental speech chunker added (2026-11-22)

Added source-only implementation on this branch:
- `android/app/src/main/java/ai/offgridmobile/voice/JarvisTtsBackend.kt`
  - Defines a model-neutral blocking backend contract, called only on worker threads.
  - Keeps model inference separate from AudioTrack, AudioFocus, microphone capture and conversation lifecycle.
  - Explicit capabilities distinguish `BATCH`, `SENTENCE_CHUNKED`, and `MODEL_STREAMING`; includes native cancellation, voice cloning, instruction control, language hints and supported language tags.
  - Defines validated request/result types and duration calculation from PCM samples.
- `android/app/src/main/java/ai/offgridmobile/voice/JarvisSpeechChunker.kt`
  - Incremental Russian/English sentence chunker for token-streamed assistant text.
  - Preserves punctuation, avoids splitting decimal numbers, common abbreviations and initials, handles fragment boundaries and limits chunk length without breaking words.
  - Supports `flush()` at end of turn and `reset()` on barge-in/new turn.
- Tests:
  - `JarvisSpeechChunkerTest.kt` (6 tests)
  - `JarvisTtsBackendContractTest.kt` (3 tests)
  - Existing `JarvisPcmStreamPlayerTest.kt` (8 tests)
- Important: these tests have been added but no Gradle/JUnit run has been confirmed. The manual Android APK workflow remains default-branch-only; no APK/device verification.
- No Sherpa, Qwen, CosyVoice, Supertonic or other TTS dependency/model has been added yet. The new contract is intentionally model-neutral and keeps the selected model decision separate.
- The Supertonic callback-stop patch remains a proposed patch file and has not been applied to a compiled AAR.


## CI source-contract verification after TTS groundwork

- Added `scripts/__tests__/jarvis-tts-backend.node.test.mjs` and wired it into `.github/workflows/ogam-external-dependency-audit.yml`.
- The external dependency audit completed successfully on commit `a8113ac77c35108dc9f2a88da9f990923e9bbd08`, workflow run 423: https://github.com/sokfrut-tech/OGAM/actions/runs/45058086277
- This success covers the repository's Node source-contract suite, including assistant bridge, PCM playback source contract, TTS backend boundary, speech chunker structure and Supertonic patch contract. It does NOT compile Kotlin, run the JUnit tests, build the APK or test PGEM10.
- A separate duplicate audit run was still in progress at the last check. The primary completed run 423 is success.
- The full CI run 181 remained pending at the last check. Do not report Gradle/JUnit success.
