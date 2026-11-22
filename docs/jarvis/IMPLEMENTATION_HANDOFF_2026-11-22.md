# OGAM / Jarvis — execution handoff (2026-11-22)

This file is the durable continuation point for the current OGAM fork work. It records only facts verified from the current open PR and its source tree; it is not a release-readiness claim.

## Repository snapshot

- Repository: `sokfrut-tech/OGAM`
- Active branch: `feature/jarvis-step-2-storage-privacy`
- PR: [#1 — Jarvis Step 2: privacy and Android storage permission bridge](https://github.com/sokfrut-tech/OGAM/pull/1)
- PR state: open, draft, not merged; base `main`
- PR head observed before this pass: `59dd17e604e7fba2cc721ae8406804c3a251c548`; `main` conflict resolved in merge commit `b7c06988`.
- Companion research PR (26-APK Breeno / ColorOS 16 static analysis): [#2 (`docs/research-breeno-coloros-2026-11-22`)](https://github.com/sokfrut-tech/OGAM/pull/2) at `e4ef6016`.
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
