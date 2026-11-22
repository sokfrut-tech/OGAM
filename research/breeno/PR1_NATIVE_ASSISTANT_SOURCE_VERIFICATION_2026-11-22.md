# PR #1 Native Assistant Source Verification

Date: 2026-11-22
Repository: sokfrut-tech/OGAM
Inspected branch: feature/jarvis-step-2-storage-privacy
Purpose: verify the native assistant implementation referenced by the Breeno research.

## Confirmed source files

The branch contains the following source files:

- android/app/src/main/AndroidManifest.xml
- android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionService.kt
- android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionSessionService.kt
- android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionSession.kt
- android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantBridgeActivity.kt
- android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantLaunchGuard.kt
- android/app/src/main/java/ai/offgridmobile/MainActivity.kt
- android/app/src/main/res/xml/jarvis_voice_interaction.xml

## What source inspection confirms

1. The manifest declares JarvisVoiceInteractionService with android.permission.BIND_VOICE_INTERACTION and the android.service.voice.VoiceInteractionService action.
2. The manifest declares JarvisVoiceInteractionSessionService, also protected by BIND_VOICE_INTERACTION, in a separate :jarvis_voice process.
3. The manifest declares JarvisAssistantBridgeActivity as non-exported, no-history and excluded from recents.
4. JarvisVoiceInteractionService disables SHOW_WITH_ASSIST and SHOW_WITH_SCREENSHOT.
5. JarvisVoiceInteractionSession creates a short-lived session, launches the private bridge using startAssistantActivity on Android O+, and finishes the session.
6. JarvisAssistantBridgeActivity issues a one-use UUID token and launches MainActivity.
7. MainActivity validates and consumes the token before forwarding the assistant deep link to React Native; untrusted assistant URI launches are rejected/stripped.
8. The XML metadata points to the session service. Its recognitionService attribute points to JarvisVoiceInteractionService; this should be checked against Android's VoiceInteractionService metadata contract and corrected if Android expects a RecognitionService component. Do not assume the metadata is valid solely because the XML parses.
9. The manifest comments state that the service is enabled only on API 31+ because no local legacy RecognitionService is implemented for Android 7–11.

## What is not yet established

- A RoleManager / ROLE_ASSISTANT onboarding flow was not located in the inspected file set. This is not proof it does not exist elsewhere; search the entire branch and React Native code before claiming it.
- No runtime verification of assistant-role selection, VoiceInteractionService binding, session invocation, microphone startup, background/screen-off behavior or ColorOS 16 behavior was performed.
- No always-on wakeword or DSP hotword implementation is established by these files.
- No proof yet that the React Native ChatScreen actually receives and starts the voice session from the URI in all cold/warm launch states.
- No build/test result is asserted in this document.

## Required follow-up

1. Verify the metadata contract against Android 12–16 official SDK/API definitions; correct the recognitionService field if necessary.
2. Locate and test the ROLE_ASSISTANT request/onboarding flow. If absent, implement a clear user-initiated RoleManager request and settings fallback.
3. Add focused Android unit/instrumentation tests for token replay, invalid token, cold start, warm start, process death, duplicate invocation and session cancellation.
4. Build and test on API 31+ emulator, then on the actual PGEM10 / ColorOS 16.
5. Keep ordinary voice chat, system assistant invocation and always-on wakeword as three separate capability claims.

## Status

PARTIAL — source declarations and handoff code were inspected; RoleManager flow, metadata correctness, build, runtime and device behavior remain unverified.
