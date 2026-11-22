# AzCode + Aries AI Source Audit — Local Android Automation and Virtual Display

Date: 2026-11-22
Audited projects:
- https://github.com/Azapp888/AzCode — inspected tree commit 3020231a6eeafbfafbdb19662eff7dc61aa01221; root LICENSE MIT.
- https://github.com/ZG0704666/Aries-AI — inspected tree commit abf6e971cbc0049ad35f1fb01930e38e2a821c79; root LICENSE AGPL-3.0.

Read-only source review. No APK downloaded, built, installed or run. No code copied into OGAM.

## 1. AzCode

### Confirmed architecture
- Android-local natural-language automation assistant with a multi-step AgentRunner and tool/event UI.
- README describes multiple model protocols/providers, session history, local memory, skills, GitHub integration, image generation, document generation and voice input.
- Screen control uses an AccessibilityService for visible node traversal, text/coordinate click, swipe and global navigation.
- Voice input can use the Android system recognizer or iFlytek online ASR; the project advertises offline-priority system recognition but actual offline availability depends on installed Android recognition provider/language packs.
- An AssistActivity declares android.intent.action.ASSIST and VOICE_COMMAND, then displays an overlay. The inspected manifest does not declare a VoiceInteractionService, so do not treat this as equivalent to a complete Android VoiceInteractionService implementation.
- Optional capability bridge binds a raw HTTP server to 127.0.0.1:8848 for local CLI/ADB-forward access.
- Project license is MIT; LICENSE notes portions adapted from Deepseek-Harness-Local-Android, also MIT.

### Security caveat
The inspected AgentBridge binds to loopback, but the visible request handler routes /screen, /tap, /swipe, /global, /shell, /notify and /agent without an evident authentication check in the inspected route path. Loopback binding is not equivalent to authentication: another local app may be able to connect. Do not adopt this bridge unchanged. OGAM's local bridge must use authenticated pairing, scoped capability tokens, replay protection and per-action approval.

### OGAM decision
- Reuse the multi-step event contract: thinking, assistant text, tool start/result, user question, failure, cancellation.
- Treat AssistActivity as an overlay-entry reference only; OGAM's real system-assistant implementation remains VoiceInteractionService.
- Reuse node-first Accessibility semantics, but bound tree traversal and exclude password fields.
- If a local HTTP companion bridge is ever added, default it off and authenticate every request; prefer Binder for same-device IPC.
- Keep provider adapters independent so Russian ASR can be selected without relying on iFlytek or the system provider.

## 2. Aries AI

### Confirmed architecture
- Android 11+ (minSdk 30), targetSdk 36, ARM64 and x86_64 ABI as declared in Gradle; README describes third-party OpenAI-compatible API, Aries API and local MNN inference.
- README identifies local Qwen3.5-9B MNN model and sherpa-onnx X-ASR-zh-en speech recognition; these are not evidence of Russian speech quality.
- Accessibility + Shizuku + virtual display execution routes are coordinated through ActionExecutor.
- VirtualDisplayController delegates creation/capture/input to ShizukuVirtualDisplayEngine, validates Shizuku Binder and permission, tracks displayId, and returns failure when the Shizuku channel is unavailable.
- Screenshot pipeline has non-black-frame detection, cache/throttle and overlay hiding/restoration guard.
- Automation task state is explicit (RUNNING, PAUSE_REQUESTED, PAUSED, SUCCEEDED, FAILED, CANCELLED).
- AutomationDispatchAuthenticator generates a process-local 256-bit random token and uses constant-time comparison to protect exported MainActivity automation Intent fields.
- PathGuard rejects parent traversal and canonical paths outside trusted roots.

### Limits and cautions
- Virtual display requires Shizuku authorization and compatible device/ROM behavior; the README explicitly says isolation and focus/input routing must be validated on the target device.
- VirtualDisplayController uses best-effort paths; a successful display creation does not prove every app supports background input or focus routing.
- Project is AGPL-3.0. Do not copy its implementation into OGAM without a deliberate AGPL compliance decision.
- The advertised Qwen3.5 and X-ASR-zh-en model profiles are not substitutes for Russian ASR/LLM evaluation.

### OGAM decision
- Consider optional background automation only after the foreground accessibility path is stable.
- Reuse design patterns: display capability probe, explicit task state, focus ownership, non-black screenshot wait, screenshot throttling, overlay hide/restore, authenticated automation dispatch, canonical path guard.
- Virtual display must be optional and fall back to foreground interaction; never claim isolation on a device before testing.
- Add Russian model and voice benchmark; do not reuse Chinese-only speech weights as Russian.
- Keep external model providers configurable and local model fallback independent.

## OGAM priorities added

P0:
- event-driven AgentRunner interface with cancellation and user questions;
- authenticated local IPC, not unauthenticated loopback HTTP;
- explicit task lifecycle and structured result states;
- node-first Accessibility with bounds and password exclusion;
- canonical file-path guard.

P1:
- screenshot cache/throttle and overlay hide/restore guard;
- provider-independent ASR with Russian model packs;
- process-local or platform-backed authentication for internal automation dispatch.

P2:
- optional Shizuku virtual-display execution with capability probe, fallback and real-device acceptance matrix.

## Sources
- https://github.com/Azapp888/AzCode
- https://github.com/Azapp888/AzCode/blob/main/LICENSE
- https://github.com/Azapp888/AzCode/blob/main/app/src/main/AndroidManifest.xml
- https://github.com/Azapp888/AzCode/blob/main/app/src/main/java/app/azcode/bridge/AgentBridge.kt
- https://github.com/Azapp888/AzCode/blob/main/app/src/main/java/app/azcode/bridge/AgentRunner.kt
- https://github.com/Azapp888/AzCode/blob/main/app/src/main/java/app/azcode/bridge/AzAccessibilityService.kt
- https://github.com/ZG0704666/Aries-AI
- https://github.com/ZG0704666/Aries-AI/blob/main/LICENSE
- https://github.com/ZG0704666/Aries-AI/blob/main/app/src/main/java/com/ai/phoneagent/VirtualDisplayController.kt
- https://github.com/ZG0704666/Aries-AI/blob/main/app/src/main/java/com/ai/phoneagent/core/automation/AutomationDispatchAuthenticator.kt
- https://github.com/ZG0704666/Aries-AI/blob/main/app/src/main/java/com/ai/phoneagent/core/security/PathGuard.kt
