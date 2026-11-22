# OGAM / Jarvis — execution handoff (2026-11-22)

This file is the durable continuation point for the current OGAM fork work. It records only facts verified from the current open PR and its source tree; it is not a release-readiness claim.

## Repository snapshot

- Repository: `sokfrut-tech/OGAM`
- Active branch: `feature/jarvis-step-2-storage-privacy`
- PR: [#1 — Jarvis Step 2: privacy and Android storage permission bridge](https://github.com/sokfrut-tech/OGAM/pull/1)
- PR state: open, draft, not merged; base `main`
- PR head observed before this handoff refresh: `5d46865a1ec8ba9120e83bb6d232ba8b1bad0f61`
- PR metadata at that snapshot: 357 commits, 143 changed files, +8,614/-399 lines.
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

## Self-contained migration blocker — do not bypass

The open PR still depends on private upstream source:
- Git submodule `pro` → `off-grid-ai/mobile-pro`.
- Nine `file:../shared/packages/*` dependencies: design, models, notes, notes-editor, rag, speech, sync, ui, writing.
- Metro/Jest and setup scripts resolve/build the sibling `../shared` workspace.
- APK workflow currently requires `PRO_SUBMODULE_PAT`.

The connected GitHub integration cannot read the private upstream repositories (404). Do not ask the user for a private upstream token as a shortcut. Do not add empty directories, fake packages, or no-op implementations. A previous CI run (run 18, head `1c271e3b97d5d65b922732aa25d7fb5b6d004b25`) was cancelled; its recorded failures were caused by unresolved shared/Pro imports after private checkout steps were skipped. This is not green evidence and not a clean standalone build.

A public fork survey found:
- `wednesday-solutions/off-grid-mobile-ai`: older standalone open-core snapshot `0.0.81`, no current Pro/shared split; useful as a historical reference, not parity.
- `cristiannegru/off-grid-mobile-ai`: retains private Pro submodule and sibling shared dependencies; optional CI skip is only a contributor fallback, not independence.

## Ordered next work

1. **Finish the real dependency inventory from the active branch.** Run `scripts/audit-offgrid-imports.mjs` in CI and preserve the JSON artifact. Include exact importer paths, source/test/build-config scope, direct/transitive package dependencies, native/build references and the `@offgrid/automation` Metro-only package. Do not rely on default-branch code search to prove absence.
2. **Classify each package API** as free-runtime essential, optional feature, Pro-only, or build/test tooling. Prioritise small pure helpers already characterized by tests; do not remove a package wholesale.
3. **Migrate one vertical slice at a time** into OGAM-owned source, with behaviour-level tests. First-party implementations must preserve contracts and existing tests. For inaccessible source, inspect multiple public implementations and independently specify/test equivalent behaviour; record source links and licenses.
4. **Resolve shared core boundaries**: document/RAG, sync engine + RN adapter, speech-turn state machine, models/runtime policies, design tokens, writing/Scribe, notes/editor and automation. These are real features, not disposable build scaffolding.
5. **Separate Pro-only code safely** while preserving free-core functionality. Remove the Pro gitlink and private-token checkout only after all imports, tests, native hooks and runtime entry points have been replaced or deliberately removed with documented parity decisions.
6. **Complete Siri/Jarvis execution layer**: skill catalogue → permission/capability broker → approval preview → deterministic executor → progress/cancel/result ledger → plan editor/HUD. Keep the model outside the authority boundary.
7. **Build a versioned Russian/tool-use model benchmark** and compare Qwen3.5-4B, Aurum 4B and Gemma 4 E2B/E4B on identical prompts and the actual OPPO device. Do not select a default from model-card claims alone.
8. **Complete voice stack** in order: migrate turn contract → measure existing Whisper → benchmark VAD/T-one/GigaAM → verify TTS license and voice quality → integrate one local Russian TTS engine with the OGAM-owned PCM player → barge-in/duplex → wake word → OPPO system-assistant validation. The system-assistant source handoff is already implemented; it is not yet a device-verified release feature.
9. **Release gate**: clean OGAM-only checkout, lockfile/install, TypeScript, ESLint, Jest, dependency-cruiser/knip, actionlint, Android unit tests, arm64 APK + SHA-256, install/launch and OPPO Find X6 Pro smoke tests. Every failure must be classified; skipped private-dependent suites do not count as success.

## Current verified status at handoff

- PR #1 remains open/draft/unmerged; do not merge to bypass the private-source blocker.
- At the source snapshot reviewed before this documentation refresh, PR head was `316981b3e16270b825079297a57feeb3f693817f`; metadata reported 337 commits, 140 changed files, +8,364/-399 lines. The documentation refresh itself will advance the head.
- Latest completed open-core audit run for that source snapshot: [run #45039159486](https://github.com/sokfrut-tech/OGAM/actions/runs/45039159486), conclusion success. It ran 6 Android-assistant/security contract tests, 3 system-role tests, 2 one-shot voice tests (including failed-start cleanup), 1 URI mapping test, 4 PCM source-contract tests and existing open-core Node suites; the import audit scanned 1,976 files and reported 1,354 external dependency references. Artifact `ogam-import-audit`, ID `14761275690`.
- The PCM playback static test now also asserts the corrected Kotlin test declarations. Two malformed declarations in `JarvisPcmStreamPlayerTest.kt` were found and corrected: the stale-generation test now stores the first token as a `Long`, and the async test writes its result through `AtomicReference.set()`.
- New Android source now includes the in-app RoleManager picker/status bridge, a non-exported assistant bridge with one-time in-process launch authorization, one-shot ChatScreen invocation, preservation of existing drafts/attachments, and an engine-neutral mono Float32 AudioTrack player with AudioFocus, generation tokens, cancellation and eight Kotlin/JUnit cases. Whisper startup/model-load failures now return the voice-session state to idle and clear Jarvis's one-shot flag.
- The system-assistant URI is no longer externally BROWSABLE. The VoiceInteractionSession launches a non-exported bridge Activity; it mints an in-process one-time token, and MainActivity rejects forged/externally supplied assistant VIEW intents before React Native Linking can consume them. Kotlin/JUnit token tests are present but not yet run in Gradle.
- New compact Russian TTS candidate: `tiny-voca-ru` (4.53M parameters, ~21.4 MB ONNX, 24 kHz mono, two synthetic voices) is now the top compact prototype candidate. Code/weights Apache-2.0, bundled ruaccent assets MIT, dataset CC BY 4.0 with attribution. Its frontend is Python-only today and must be ported to Kotlin with 61-symbol parity fixtures; model/runtime has not been added or measured on OPPO. See `docs/jarvis/VOICE_STACK_RESEARCH_RU_2026-11-22.md` section 12 and `docs/jarvis/LOCAL_RUSSIAN_TTS_RUNTIME_EVALUATION.md`.
- The PCM player is currently a standalone native primitive. No Sherpa/Vosk/Supertonic/Piper TTS runtime or voice model is wired to it; the TTS evaluation document is research only and license review/model profiling remain open.
- The successful open-core Node audit does **not** compile Kotlin, execute Gradle/JUnit, merge the manifest, build an APK, run Jest/TypeScript, or verify the assistant picker/microphone on OPPO Find X6 Pro.
- The manual arm64 APK workflow still requires the private `PRO_SUBMODULE_PAT` and upstream `mobile-pro`/shared workspace. Do not ask the user for a private upstream token or create fake package stubs. Continue the self-contained migration plan.
- PR mergeability remains false at the reviewed snapshot. No APK artifact, clean standalone install, or OPPO device verification has been demonstrated.
- Continue from the active branch and current source, not by replaying completed work above.
