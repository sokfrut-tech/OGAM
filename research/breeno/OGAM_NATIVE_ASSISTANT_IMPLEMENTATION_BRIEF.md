# OGAM Native Android System Assistant — Implementation Brief

Date: 2026-11-22
Target repository: sokfrut-tech/OGAM
Source baseline inspected: main @ 14b27f7c12c8e6f69b132842534b23a627523956
Related research: README.md, REFERENCE_PROJECTS.md, OGAM_CAPABILITY_MAPPING.md, ETA_COLOROS_SOURCE_AUDIT.md, ZORVAI_SOURCE_AUDIT.md, PHTOMT_POCKETMIND_SOURCE_AUDIT.md.

## Goal

Turn OGAM from a React Native app with user-started voice capture into a standards-based Android digital assistant that can be selected as the system default assistant and opened through supported Android assistant entry points. Preserve the existing OGAM app, local model catalog, Whisper/Qwen ASR, Kokoro TTS, tool loop and model runtime.

This brief is an implementation contract, not a claim that code has been written or tested.

## Current source baseline findings

Inspected:
- android/app/src/main/AndroidManifest.xml
- android/app/build.gradle
- package.json
- src/services/voiceService.ts
- src/services/audioRecorderService.ts
- src/services/whisperService.ts

Observed:
- OGAM is React Native 0.83.1 with Android native Kotlin modules and NDK/C++ components.
- Android manifest requests RECORD_AUDIO and foreground-service capabilities but currently does not declare VoiceInteractionService, VoiceInteractionSessionService, AccessibilityService or NotificationListenerService in the inspected main branch.
- The JS voiceService uses @react-native-voice/voice and starts recognition with hard-coded locale en-US. It depends on the installed Android recognition service and its available language packs; it is not a self-contained Russian offline ASR path.
- audioRecorderService exposes microphone level and PCM sample streams and has an audio session manager; echo cancellation is currently reported false because capture/playback do not share a true voice-processing engine.
- whisperService has a native lane to serialize native inference, Whisper model lifecycle, Qwen3-ASR selection/fallback and realtime transcription support.
- Existing model and tool infrastructure is substantial and should be reused; do not create a second LLM stack for the assistant entry point.

## Architecture

### Android entry layer
Add a native package under android/app/src/main/java/ai/offgridmobile/assistant/:
- OgamVoiceInteractionService
- OgamVoiceInteractionSessionService
- OgamVoiceInteractionSession
- AssistantRoleGateway / AssistantRoleHelper
- AssistantInvocationStore
- AssistantSessionController

Responsibilities:
- register the standard Android VoiceInteractionService contract with BIND_VOICE_INTERACTION and metadata;
- expose a clear user-driven "Set as default assistant" action through system settings/RoleManager where available;
- accept onShow/onPrepareShow/onHandleAssist/onHandleScreenshot/onHide lifecycle events;
- create a new invocation UUID and pass only that ID to the app/runtime;
- release invocation state and all resources on hide, back, system dialog, process death and replacement invocation;
- never modify secure assistant settings directly from the ordinary app process.

### Assistant UI
First release should use a native Android overlay/window owned by an explicit foreground service or a supported VoiceInteractionSession window, with a documented lifecycle. It must not rely on an exported unauthenticated Activity or a floating window alone to claim system-assistant integration.

Required UI states:
- idle/ready;
- listening with live level and partial transcript;
- thinking/streaming;
- tool running with safe progress summary;
- awaiting user confirmation;
- speaking;
- paused/cancelled;
- recoverable error with keyboard fallback.

Jarvis visual theme can be layered onto this shell later; correctness, accessibility, privacy and one-handed usability come first.

### Runtime bridge
Use one assistant entry contract to call the existing OGAM runtime:
- invocationId
- source = system_assistant
- locale
- userText or audio reference
- optional short-lived screenContext reference
- cancellation token
- foreground/background policy

Preferred path: a typed native module/event bridge to React Native while the app/runtime is alive. If a separate runtime service is needed, use explicit Binder/AIDL with signature-level binding, protocol version, bounded payloads, request IDs, timeouts and Binder-death recovery. Do not introduce an unauthenticated 127.0.0.1 HTTP server.

The assistant must reuse existing model routing and tool loop; no duplicate model provider or independent memory database.

### Screen context
Implement a short-lived ScreenContextSnapshot:
- invocationId, capturedAt, foreground package/component;
- optional Android Assist structure;
- optional screenshot handle;
- bounded text/tree size and image dimensions;
- password/sensitive node exclusion;
- user-visible context indicator;
- explicit no-persist default.

Screen context is a snapshot at wake time, not live state. After an action changes the screen, capture again only through an explicit permitted mechanism. Do not silently add screen text or screenshots to long-term memory or analytics.

### Audio and Russian locale
Separate four engines:
1. wake-word detection;
2. command/conversation ASR;
3. dialogue/model;
4. TTS.

First milestone should be push-to-talk/system-summon voice, not always-on hotword. Use existing Whisper/Qwen ASR and Kokoro where supported. Do not assume Android SpeechRecognizer has Russian offline language data. Remove hard-coded en-US by passing locale from a user-configured language setting and selecting a verified provider/model.

Wake word "Джарвис" is a later feature. It requires a real keyword model, foreground-service/mic disclosure, explicit opt-in, power budget and false-accept/false-reject testing. Do not use acoustic energy bursts as a substitute.

### Permissions and action policy
No new permissions at first launch. Request microphone only when voice is enabled; request other device permissions when a feature is invoked. Assistant role is separate from microphone permission.

Before tool execution, intersect:
- user-approved capability;
- Android runtime/special permission;
- device/ROM support;
- risk policy.

Write/danger operations require runtime-side approval. Missing approval callback, timeout and unknown tool fail closed. Never rely only on model prompt or UI. Non-idempotent actions must not be automatically retried.

### ColorOS adapter
Not part of P0. After public Android assistant role works:
- collect exact PGEM10 build fingerprint and ColorOS version;
- check whether ColorOS power-key dispatch routes to default assistant role;
- only if required, evaluate a separate, disabled-by-default adapter;
- any private hook must be version/build fingerprinted, uniquely resolve targets, log INSTALLED/MISSING/FAILED/SKIPPED and fail open to native OPPO behavior;
- LSPosed/root must not be a Jarvis core requirement.

## Implementation phases

### Phase 0 — source and build preparation
- inspect existing MainApplication package registration and Android Gradle plugin/SDK versions;
- add native assistant package and manifest metadata;
- add unit-testable role gateway and invocation lifecycle helpers;
- ensure Android 14+ foreground microphone service rules are respected for any microphone capture service;
- do not modify iOS or shared model code.

### Phase 1 — text-only system assistant
- register VoiceInteractionService and Session;
- implement role onboarding/status;
- show native assistant surface with keyboard input;
- pass user text into existing OGAM conversation/tool runtime;
- stream response and tool status;
- support cancel, back, hide, repeated summon and fallback to main app;
- test on emulator and physical Android device before enabling voice.

### Phase 2 — voice input/output
- connect microphone lifecycle and audio focus;
- locale-aware Russian ASR with Whisper/Qwen selection;
- Kokoro TTS playback, stop, interruption and audio route changes;
- test screen on/off and lock screen restrictions;
- do not advertise always-on wake word.

### Phase 3 — Assist context
- capture bounded Assist tree and screenshot on invocation;
- exclude password nodes and redact sensitive content;
- show attached context status;
- expiry/replacement/cancellation tests;
- ensure no persistence to memory or logs.

### Phase 4 — Android actions and verification
- add public-API action adapters (launch app, settings panel, alarms/calendar/media where supported);
- add capability registry and runtime approval gate;
- verify state after each write action;
- add checkpoints/undo only for operations with a reliable rollback path.

### Phase 5 — optional ColorOS integration
- exact device baseline;
- power key / gesture observation;
- compatibility profile only after evidence;
- optional LSPosed research adapter with explicit approval and rollback.

## Acceptance criteria

- System settings can select OGAM as default assistant and report current assistant owner correctly.
- Assistant summon opens the OGAM surface without requiring the main Activity to be manually opened first, where Android/ColorOS permits.
- OEM assistant remains the fallback if OGAM service is unavailable.
- Session cancellation always stops active microphone capture, model generation, tool execution where cancellable and TTS.
- Repeated summons do not create duplicate sessions or lose the first invocation's context.
- Russian speech locale is selected explicitly; no hard-coded en-US in assistant path.
- Offline test clearly identifies which ASR/model/TTS components work without network.
- No microphone recording remains after stop/hide/crash.
- Screen context is temporary, bounded, password-filtered and never persisted by default.
- High-risk tool actions are gated by runtime approval; timeout/missing approval fails closed.
- No action is reported successful until the postcondition is verified.
- No ColorOS private hook is enabled without exact firmware evidence.
- Tests distinguish source/unit coverage, emulator validation and real PGEM10 device validation.

## Non-goals for this phase

- No root or LSPosed requirement.
- No bypass of OEM signature/privileged permission controls.
- No Breeno APK injection or proprietary OPPO code/assets.
- No always-on microphone/wake-word until a separate privacy/power design is approved.
- No replacement of the existing React Native UI or model stack.
- No automatic SMS, payment, purchase, delete or account/security action without confirmation.

## Source references used

- OGAM current manifest: https://github.com/sokfrut-tech/OGAM/blob/main/android/app/src/main/AndroidManifest.xml
- OGAM voice service: https://github.com/sokfrut-tech/OGAM/blob/main/src/services/voiceService.ts
- OGAM audio recorder: https://github.com/sokfrut-tech/OGAM/blob/main/src/services/audioRecorderService.ts
- OGAM Whisper/Qwen ASR: https://github.com/sokfrut-tech/OGAM/blob/main/src/services/whisperService.ts
- Android VoiceInteractionService: https://developer.android.com/reference/android/service/voice/VoiceInteractionService
- Android VoiceInteractionSession: https://developer.android.com/reference/android/service/voice/VoiceInteractionSession
- Eta source audit: https://github.com/Mangi-11/Eta
- ZorvAI source audit: https://github.com/Quor-a/ZorvAI
- PocketMind approval source: https://github.com/badhope/pocketmind/blob/main/agentd/approval.py

## Status

Research-backed implementation brief only. No runtime code has been changed in this step. Build compatibility, current Android SDK baseline and test commands must be checked against the active OGAM branch before implementation.
