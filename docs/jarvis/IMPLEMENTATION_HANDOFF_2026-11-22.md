# OGAM / Jarvis — execution handoff (2026-11-22)

This file is the durable continuation point for the current OGAM fork work. It records only facts verified from the current open PR and its source tree; it is not a release-readiness claim.

## Repository snapshot

- Repository: `sokfrut-tech/OGAM`
- Active branch: `feature/jarvis-step-2-storage-privacy`
- PR: [#1 — Jarvis Step 2: privacy and Android storage permission bridge](https://github.com/sokfrut-tech/OGAM/pull/1)
- PR state: open, draft, not merged; base `main`
- PR head observed during this audit: `4cb872bbff38b94b83c13be85624c75c001e6cef`
- PR metadata reports 212 commits, 94 changed files, +5,446/-382 lines.
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
- Task-plan validation (DAG/dependency/cycle checks), run state transitions, approval wait, completion/failure/retry/pause/resume/cancel guards, and local Zustand persistence.
- Built-in tool skill contracts validate schemas and enabled-tool capabilities; high-risk skill types have an approval rule.
- OGAM-owned pure progress helpers and file-size/split-GGUF/companion-file utilities.
- Android APK workflow is manual-only, arm64 debug, SHA-256 + 14-day artifact; it currently cannot build standalone because setup still requires private workspaces.
- External dependency audit workflow and scanner tests are included.

## Model research decisions

- Reproducible on-device baseline candidate: Qwen3.5-4B (Apache-2.0 declared by the official model card; verify exact pinned revision and runtime compatibility before packaging).
- Low-refusal experiment: Aurum 4B Uncensored (community derivative). Treat publisher claims as hypotheses; keep opt-in until independent Russian quality, hallucination, prompt-injection, tool-use and device tests pass.
- Mobile multimodal comparison: Gemma 4 E2B/E4B. Vendor memory figures are not OGAM measurements.
- No single production default selected yet. Compare exact revision, quantization, license, hashes, Russian quality, refusal behaviour, tool reliability, RAM, thermal behaviour and battery on OPPO Find X6 Pro.
- Keep an ordinary non-abliterated control model in all refusal evaluations. “Uncensored” is not a technical standard and never disables the Android permission/approval broker.

## Russian voice research decisions

- Preserve existing OGAM Whisper realtime path first; migrate the private speech-turn contract without dropping tap/silence/hands-free settings.
- T-one is a candidate for low-latency Russian streaming, not a replacement before OPPO measurements; its alphabet limitations require a correction path.
- GigaAM-v3 is a batch correction/transcription candidate, not the duplex streaming default.
- Silero VAD is a candidate; Smart Turn is deferred until a labelled Russian dialogue benchmark exists.
- sherpa-onnx Android is a promising Apache-2.0 runtime candidate for local VAD/TTS, but full AAR size/ABI/thermal/APK impact must be measured before dependency addition.
- Do not package a Russian voice until the exact model revision, model card, training-data chain, license, hashes and pronunciation quality are verified. Do not bundle GPL-3.0 Piper runtime as if it were the archived MIT code.
- Target pipeline: audio capture → sample-rate conversion → VAD/turn detection → streaming ASR → one conversation turn → streamed LLM → sentence chunking → local TTS → ordered playback; barge-in cancels speech and active generation. No raw audio logging by default.

## Siri-like capability parity still required

- Android system assistant integration: `VoiceInteractionService` / `VoiceInteractionSessionService`, explicit user selection as default assistant, assist context and visible capture state.
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
8. **Complete voice stack** in order: migrate turn contract → measure existing Whisper → benchmark VAD/T-one/GigaAM → verify TTS license and voice quality → integrate one local Russian TTS engine → barge-in/duplex → wake word → system assistant service.
9. **Release gate**: clean OGAM-only checkout, lockfile/install, TypeScript, ESLint, Jest, dependency-cruiser/knip, actionlint, Android unit tests, arm64 APK + SHA-256, install/launch and OPPO Find X6 Pro smoke tests. Every failure must be classified; skipped private-dependent suites do not count as success.

## Current verified status at handoff

- PR #1 remains open/draft/unmerged.
- PR metadata currently reports `mergeable: false`; investigate fresh GitHub status before any merge consideration.
- No APK artifact, clean standalone install, or OPPO device verification has been demonstrated.
- Continue from the active branch and current source, not by replaying the already completed steps above.
