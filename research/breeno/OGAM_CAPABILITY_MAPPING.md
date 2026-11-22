# Breeno-to-OGAM Capability Mapping and Integration Backlog

Date: 2026-11-22
Baseline inspected: OGAM main at 14b27f7c12c8e6f69b132842534b23a627523956 and branch feature/jarvis-step-3-model-scanner at 932160927a94828734c72fdd2ecbcf36735c907c.

## Purpose
Translate Breeno/AndesGPT observations and open-source adapter research into a staged OGAM implementation backlog. This document distinguishes existing OGAM foundations from missing Android system-assistant integration and unverified device behavior.

## Existing OGAM foundations observed on main
The main branch already has a substantial React Native / Android native foundation:
- Android manifest requests RECORD_AUDIO and includes camera, calendar, storage/media and foreground-service declarations.
- Existing voice-related JS modules/tests include audioRecorderService, voiceService, Whisper model/service management, Kokoro TTS engine and voice UI integration tests.
- Native Android modules include LiteRT, LocalDream, device-memory, file/directory access, screenshot, media sharing, downloads, and QNN/OpenCL library assets.
- Android manifest declares optional native libraries libOpenCL.so and libcdsprpc.so for Qualcomm environments.
- Existing tests cover transcription model lifecycle, Kokoro speech, voice note/chat flows, stopping generation, tool loops, streaming and model routing.

These are reusable foundations, not proof of a fully operational always-on voice assistant on the Find X6 Pro.

## Current system-assistant integration gap
A read of android/app/src/main/AndroidManifest.xml on main found no declared VoiceInteractionService, VoiceInteractionSession service, assistant role request flow, AccessibilityService or NotificationListenerService. The feature/jarvis-step-3-model-scanner branch tree also had no filenames matching VoiceInteractionService, AssistantService, AccessibilityService or Breeno. This is a source-tree observation, not proof no indirect/JS implementation exists, but it identifies the major native integration gap to verify.

Consequences:
- RECORD_AUDIO enables user-initiated recording only; it does not create a privileged always-listening hotword service.
- Whisper transcription is not equivalent to low-power DSP hotword detection.
- A React Native screen is not a replacement for Android's VoiceInteractionService contract.
- App launch and UI-based assistant operation can work even if China-ROM physical summon entry points cannot be redirected.

## Capability mapping

| Breeno / AndesGPT capability | Existing OGAM foundation | Missing or unverified | Proposed OGAM destination | Priority |
|---|---|---|---|---|
| Natural voice conversation | voiceService, audioRecorderService, Whisper, Kokoro | persistent assistant session, barge-in and audio focus on target device | voice session controller | P0 |
| Streaming answer cards | existing generation/streaming UI and tests | Android assistant surface/session integration | AssistantSurfaceRenderer contract | P0 |
| Local knowledge | local LLM/model management, embeddings/model files | unified retrieval/indexing behavior parity with target | Knowledge/RAG service | P1 |
| Persistent memory | app persistence exists; memory-related tests present | assistant-level long-term memory, user control and provenance audit | Memory service | P1 |
| Tool execution | tool loop and MCP-related project foundations | Android system action permission model and confirmations | Tool router + action registry | P0 |
| System settings control | no direct equivalent confirmed | public API/Settings panel coverage and OEM limits | AndroidActionAdapter | P0 |
| Calls / contacts / messages | calendar permissions present | explicit call/contact/SMS permission and confirmation flows | Android communication adapters | P1 |
| Screen/context understanding | screenshot and OCR-related modules exist | accessibility tree integration and secure user-triggered context capture | ScreenContextAdapter | P1 |
| Routines / schedules | calendar APIs declared | event/routine planner and background scheduling | Routine engine | P1 |
| Image/visual creation | LocalDream and image-generation pipeline | unified voice-to-image orchestration | multimodal task router | P1 |
| TTS ownership | Kokoro | unified audio focus, interruption, route selection and wake response | Jarvis audio session manager | P0 |
| Power-button / gesture summon | no system dispatch service confirmed | exact ColorOS 13.x/updated firmware behavior | optional OEM dispatch adapter | P2 |
| Offline fallback | local models and local engines | feature-by-feature offline guarantee and no-network test suite | offline capability policy | P0 |

## Proposed native architecture

1. Android entry layer: normal app launch first; later implement a standards-based assistant role / VoiceInteractionService only after confirming SDK and OGAM native module architecture.
2. Session manager: one turn ID across microphone capture, ASR, dialogue, tools, generation and TTS; supports cancel, barge-in, lock-screen policy and lifecycle recovery.
3. Language layer: Russian-first command parsing, intent/entity resolution, clarification and locale-specific speech settings.
4. Orchestrator: route user request to local LLM, knowledge, memory, tools or image/audio engines; preserve OGAM raw prompt/prefill semantics.
5. Permission-aware action adapters: each action declares required runtime permission, user setting, OEM privilege, confirmation level, offline support and fallback.
6. Renderer: native OGAM UI and notifications are authoritative. Breeno card injection is a separate optional research experiment and never required for Jarvis operation.
7. Audio: independent ASR and TTS pipelines; manage microphone ownership, Android AudioFocus, audio routing, playback queue and interruption.
8. Optional ColorOS adapter: device-build fingerprint + tested dispatch profile; never assume ColorOS 16 findings apply to the PGEM10's current ColorOS build.

## P0 implementation/test backlog
- Add read-only device capability diagnostics (model, build fingerprint, API level, assistant role, available voice interaction services, microphone/background restrictions).
- Define turn/session state machine and cancellation contract across ASR → model → tools → TTS.
- Add a native assistant capability report distinguishing normal microphone permission from privileged hotword/DSP capability.
- Implement safe public Android action adapters for launching apps, opening settings panels, alarms/calendar and media controls; consequential actions require confirmation.
- Build offline voice conversation test on actual PGEM10: airplane mode, app foreground/background, screen locked/unlocked, interruption, audio route changes and thermal/battery observations.
- Keep system summon tests separate from voice pipeline tests so one failure does not hide the other.

## P2 experimental backlog: Breeno interoperability
- Only after exact APK/version capture and legal/security review, test whether a separate LSPosed adapter can bridge Breeno's chat UI to Jarvis.
- Use a signed, authenticated, loopback-only IPC protocol with request IDs and cancellation; do not adopt unauthenticated HTTP/JWT-off examples.
- Verify native answer fallback before suppressing any Breeno response.
- Require a strict host-version fingerprint and disable bridge on mismatch.
- Never require root, Shizuku or LSPosed for Jarvis core.

## Device test checklist
- [ ] Exact model code and firmware build captured from Settings.
- [ ] ColorOS/Android version and security patch recorded.
- [ ] Breeno package/version/versionCode and signer captured from installed package.
- [ ] Default assistant role state queried.
- [ ] Power-button long-press behavior observed without modification.
- [ ] Gesture handle long-press behavior observed without modification.
- [ ] Bottom-corner swipe behavior observed without modification.
- [ ] Breeno offline/online behavior compared without intercepting traffic or bypassing access controls.
- [ ] OGAM voice input works offline with selected Whisper model.
- [ ] Kokoro TTS speaks, stops and resumes correctly under audio focus changes.
- [ ] Tool action confirmation and permission denial paths tested.
- [ ] No microphone recording continues after user stop, session end or app crash.

## Sources
- OGAM main manifest: https://github.com/sokfrut-tech/OGAM/blob/main/android/app/src/main/AndroidManifest.xml
- OGAM voice service: https://github.com/sokfrut-tech/OGAM/tree/main/src/services
- Zafiro README and architecture: https://github.com/niki914/zafiro
- Zafiro Breeno guide: https://github.com/niki914/zafiro/blob/main/.agents/skills/assistant-add-support/docs/BREENO.md
- OPPO Find X6 Pro official specifications: https://www.oppo.com/cn/smartphones/series-find-x/find-x6-pro/specs/
- OPPO AndesGPT/Breeno announcement: https://www.oppo.com/en/newsroom/press/2023-oppo-developers-conference-odc23/

## Status
This is a source-tree and public-documentation comparison only. No changes to OGAM runtime code, no APK analysis on the phone and no device validation were performed in this step.


## Cross-ecosystem architecture additions (China + India survey, 2026-11-22)

### New design patterns to evaluate for OGAM
- **Tool runtime / plugin framework (GitCode ZorvAI):** investigate its separation of core agent, 235-tool registry, extension APK points, MCP and local model runtimes. OGAM should expose a stable Tool API and signed capability manifests rather than bundling arbitrary third-party extensions by default.
- **System assistant contract (mathanroot/nova-ai):** source-audit its VoiceInteractionService, session lifecycle, default assistant role and screen-off wake path. Compare with official Android API requirements; do not assume README claims are verified.
- **Deterministic local-first routing (Naomi/JarvisAI):** resolve known commands locally before invoking an LLM; keep LLM for ambiguous language and multi-step planning. This reduces latency, model size and accidental tool calls.
- **Offline multilingual ASR (Uktam):** assess Sherpa-ONNX / AI4Bharat IndicConformer pipeline design, model-pack management and JNI lifecycle. For OGAM, compare Russian-capable models and do not transplant Indic-specific weights as Russian ASR.
- **Low-memory model scheduling (ProjectCharlie):** consider unloading ASR before loading LLM and serializing heavy model inference on memory-constrained devices. Benchmark on Find X6 Pro before deciding; its hardware is stronger than the project's 2 GB target, but thermals and battery still matter.
- **Screen automation safety (Mobile Agent / Sanna / OAssist):** use semantic Accessibility nodes first and visual coordinates only as fallback; classify actions as read-only, reversible or consequential; require confirmation for messages, purchases, deletion, payments, calls and account/security changes.
- **Local knowledge + MCP (ZorvAI / yojana-sahayak):** define typed tool schemas and retrieval provenance; MCP is an adapter protocol, not a reason to expose every local tool to every model.
- **Offline outbox (OffHand):** consider a durable queue for user-approved actions that require network, with idempotency keys, explicit pending state and cancellation. Never send queued content without prior user authorization.

### Revised implementation sequence
1. **P0 — Native assistant foundation:** VoiceInteractionService/Session, assistant-role onboarding, turn/session state machine, mic ownership, audio focus, cancellation and TTS interruption.
2. **P0 — Tool safety and permissions:** capability registry, permission state probe, risk tiers, confirmation UI, audit trail and rollback where supported.
3. **P0 — Local-first command router:** deterministic intents for common system actions, then local LLM planner for ambiguous/multi-step tasks; cloud fallback strictly optional.
4. **P1 — Local agent runtime:** typed tool registry, MCP bridge, sandboxed extension contract, process/resource limits and signed plugin manifests.
5. **P1 — Multimodal context:** user-triggered screen/camera/document capture, Accessibility semantic tree, OCR and provenance-aware context injection.
6. **P1 — Model scheduler:** ASR/LLM/TTS lifecycle coordinator with memory budget, thermal/battery policy, streaming and cancellation.
7. **P2 — ColorOS summon compatibility:** exact PGEM10 firmware inspection; public API first; OEM dispatch adapter only if a safe supported route exists. LSPosed/Shizuku remains optional lab-only.
8. **P2 — Optional Breeno UI bridge:** separate module, disabled by default, version-fingerprinted and authenticated. Not required for Jarvis to be complete.

### Russian language acceptance criteria
- Russian ASR must be tested on device with quiet speech, noise, names, addresses, mixed Russian/English technical terms and natural pauses.
- Wake word "Джарвис" must be tested separately from general ASR; no always-on claim until background/screen-off behavior, power use and privacy indicators are measured.
- Russian TTS must support interruption, sentence streaming, speaking rate and voice selection independent of the underlying system TTS engine where possible.
- Command aliases and entity resolution must support Russian morphology and colloquial forms while internal action schemas remain locale-independent.

### Evidence gate
All projects found through a README or platform search remain candidates until source audit verifies the relevant implementation, license, dependency notices, buildability and tests. Hardware features require target-device validation. Never label a project or feature "integrated" based only on a repository description.


## ZorvAI deep-audit transfer decisions (2026-11-22)

ZorvAI is now a P0/P1 architecture reference. Its most useful patterns are typed tool registry + progressive disclosure, AIDL/ Binder capability bridge, separate process for native ASR, signed first-party APK extension contract, and bounded task-level delivery verification.

### New OGAM modules to specify
- `CapabilityRegistry`: typed manifest with id, schema version, permission scopes, risk tier, online/offline flag, supported Android API/ABI, adapter, owner, signature and test evidence.
- `ToolDiscoveryRouter`: categories + intent matching + schema-on-demand + persistent cache. Keep the always-on schema set minimal and measured; do not copy ZorvAI README tool counts because source comments and README counts conflict.
- `EngineSupervisor`: ASR/LLM/vision/TTS engine processes with bounded startup/shutdown, memory/thermal budget, health, crash count, timeout, cancellation and graceful fallback.
- `JarvisCapabilityBridge`: local Binder/AIDL protocol, paired peer identity, signing certificate, request IDs, typed payloads, permission scopes, consent, revocation, timeout, replay protection and audit.
- `TaskLedger`: plan/step/result/verification records, bounded replan, stop conditions and escalation to user.
- `PluginContract`: built-in modules first; first-party signed packages only initially; declarative restricted third-party manifests later.

### Security requirements added
- Default-deny for all cross-app capabilities. Never accept a token based only on a prefix or non-empty string; bind token to authenticated peer identity and compare against stored high-entropy secret or use platform-backed key agreement.
- Never expose a local HTTP/LAN control endpoint without explicit enablement, authenticated pairing, scoped authorization, replay protection and audit. Prefer Binder for same-device IPC.
- Same-signature APK plugins are trusted code with host-level privileges, not sandboxed third-party plugins. Keep third-party plugins declarative/restricted until a real sandbox exists.
- Do not request all Android permissions at startup. Feature-gate SMS, contacts, notification access, media management, location, camera, overlay, screen capture and package visibility.
- Treat proot as convenience user-space, not a security boundary. Shell/script tools require allowlists, process limits, no secrets by default and explicit user confirmation.

### Updated priorities
P0: typed capability metadata; progressive tool discovery; task ledger + delivery verification; native engine supervisor; per-action risk and permission checks.
P1: paired Binder capability bridge; first-party plugin framework; restricted MCP adapter; Russian ASR/TTS benchmark; local memory/RAG provenance.
P2: optional ColorOS/Breeno bridge and LAN companion, only after device evidence and security review.


## Eta / Phtomt / PocketMind additions (2026-11-22)

### Native assistant entry and context
From Eta: add a real VoiceInteractionService/Session and system role selection. Treat screen context as a short-lived invocation snapshot, exclude password fields, attach only to the current request, and never silently persist it. Optional ColorOS hooks must be build-fingerprinted, fail-open and nonessential to core Jarvis.

### Privilege boundary
From Phtomt: consider a separate privileged Provider APK/process. Use signature-restricted AIDL, versioned contracts, Binder death recovery, bounded timeouts and chunked screen payloads. Keep main AI runtime free of direct privileged service implementations. Use semantic intent translation; raw shell and raw Accessibility endpoints are advanced capabilities only.

### Runtime approval gate
From PocketMind: action approval must execute inside the runtime immediately before tool execution. UI prompts and system instructions are not sufficient. Missing approval callback, timeout, unknown tool and malformed policy all fail closed. Global deny outranks allow; session approvals do not silently become global. Safe reads may retry; writes and dangerous side effects must not auto-retry.

### Undo and verification
Add a durable TaskLedger/CheckpointStore with tool-call IDs, affected target, before-state backup where possible, completion verification and undo state. Distinguish delivered, executed and verified outcomes. Do not claim rollback for operations that cannot be reversed.

### Updated priority order
P0: Native VoiceInteractionService; short-lived Assist snapshot; runtime-enforced approval; typed semantic action contract; risk registry; structured result + verification.
P1: Privileged AIDL Provider boundary; session/global permission policy; checkpoint/undo; tool idempotency metadata; provider health/version diagnostics.
P2: ColorOS/Breeno hook and OEM personal memory bridge; advanced Shizuku/root/ADB; external plugin ecosystem after licensing and sandbox review.

### License gate
Eta is GPL-3.0 and Phtomt is AGPL-3.0 in the canonical GitHub repositories. PocketMind is Apache-2.0. OGAM should prefer independent reimplementation of ideas. Any code reuse requires file-level license review and a conscious decision about OGAM distribution obligations. A mirror's displayed license must not override the canonical upstream LICENSE.
