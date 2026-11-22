# OGAM / Jarvis — Android system-assistant integration

Status: source-level integration added; Android build and OPPO verification are still outstanding.

## Supported platform scope

- OGAM itself keeps its existing Android 7+ app compatibility target.
- The new Android **system assistant role** is enabled from API 31 (Android 12) through \`res/values-v31/bools.xml\`.
- On Android 7–11 the new VoiceInteractionService stays disabled. We do not yet ship a local legacy \`RecognitionService\`, and will not silently route system dictation through an online recognizer to fake parity.
- Android 12+ ignores the \`recognitionService\` component value, but requires the metadata field to be non-empty. The manifest carries the OGAM service name as that compatibility value. Do not enable the VoiceInteractionService below API 31 until a genuine local legacy RecognitionService has been implemented and tested.

## Android components

- \`JarvisVoiceInteractionService\`: lightweight OS-facing service, protected by \`BIND_VOICE_INTERACTION\`.
- \`JarvisVoiceInteractionSessionService\`: creates the actual session in its own \`:jarvis_voice\` process, also protected by \`BIND_VOICE_INTERACTION\`.
- \`JarvisVoiceInteractionSession\`: receives the system invocation and starts \`MainActivity\` with \`offgrid://assistant/voice?startVoice=1\`.

The session does not run a second recorder, wake-word engine, ASR model or TTS engine. It hands the invocation to the existing app.

## Handoff into the existing voice pipeline

1. \`MainActivity\` forwards the VIEW intent to React Native, including when the activity is already open (\`onNewIntent\` + \`setIntent\`).
2. \`NavigationContainer\` maps the \`offgrid://assistant/voice\` URI to the existing root \`Chat\` route.
3. \`ChatScreen\` consumes \`startVoice\`, preserves first-run onboarding, and calls \`recordingController.start()\`.
4. \`recordingController\` asks the registered \`ChatInput/Voice\` recorder whether a real speech backend is available. If none is available, the session stays idle; the system invocation must not open an empty/phantom microphone session.
5. When Whisper/Qwen, a direct-audio model or an explicitly configured transcription endpoint is available, the same established capture/session/memory flow handles the request. The current Whisper store defaults a fresh Russian profile to Russian, while preserving existing language preferences.
6. If no backend is available, the session stays idle and the composer offers a direct button to Models → Transcription instead of opening the microphone without a recognizer.

The OS still needs the user to grant microphone permission through the existing app permission flow.

## Privacy boundary in this slice

- Both services require \`android.permission.BIND_VOICE_INTERACTION\`.
- \`VoiceInteractionSessionService\` runs in a separate process.
- \`JarvisVoiceInteractionService.onReady()\` disables \`SHOW_WITH_ASSIST\` and \`SHOW_WITH_SCREENSHOT\`.
- The session never asks for assist structure, screen text or screenshots. \`supportsAssist=true\` is retained for Android assistant-role eligibility only; context delivery is explicitly disabled.
- There is no always-on mic or wake-word listener in this change. Invocation is through Android's selected-assistant gesture/button.
- No conversation content is put in the assistant handoff URI.

## User activation

After an APK containing this change is installed on Android 12+:
1. Open OGAM → Settings → **Set Jarvis as assistant**.
2. OGAM calls Android `RoleManager.ROLE_ASSISTANT`; the OS shows its own confirmation screen. Confirm the choice there.
3. Return to OGAM. Settings re-reads both `RoleManager.isRoleHeld()` and `VoiceInteractionService.isActiveService()` and distinguishes the assigned role from an actually active service.
4. Allow microphone access through the existing visible permission flow. A local Whisper/Qwen speech model or supported direct-audio model must be available for automatic capture.

If the Android/ColorOS build reports that the assistant role is unavailable, the row explains this instead of claiming activation. The OS settings path is still available as a manual fallback: Apps → Default apps → Digital assistant app (wording/nesting vary by OEM).

## In-app role selection

`SettingsScreen` now contains an Android-only **Set Jarvis as assistant** row. Its React Native service wrapper calls `JarvisAssistantRoleModule`, registered by `MainApplication`. The native module:
- is active only on API 31+ (the app remains Android 7+ compatible for ordinary voice dictation);
- checks that the assistant role exists before asking for it;
- opens the system-owned `createRequestRoleIntent(RoleManager.ROLE_ASSISTANT)` confirmation;
- handles the activity result with a `BaseActivityEventListener`;
- re-reads role-held and active `VoiceInteractionService` state instead of trusting the result code;
- prevents overlapping requests and rejects a pending promise if the RN module is invalidated.

Android references: [RoleManager](https://developer.android.com/reference/android/app/role/RoleManager), [VoiceInteractionService](https://developer.android.com/reference/android/service/voice/VoiceInteractionService).

## CI evidence and what it does not prove

GitHub Actions run #181:
https://github.com/sokfrut-tech/OGAM/actions/runs/45026969150

Passed:
- 5 static Android-assistant contract tests;
- 2 system-role request/UI wiring tests;
- one no-speech-model path contract that checks the direct transcription-model route;
- 1 assistant URI/route mapping test;
- existing skill, task-plan, Russian model evaluation, locale-default and audit Node suites;
- source/config audit: 1,974 files and 1,354 dependency references;
- audit artifact \`ogam-import-audit\`, ID \`14755439565\`.

These are open-core Node/static checks. They do **not** compile Kotlin, merge the Android manifest, run Gradle, install an APK, prove role eligibility on ColorOS, or validate mic invocation on OPPO Find X6 Pro. No release claim should be based on this run alone.

## Next gates

1. Run Android Gradle compile / manifest merge / unit tests once the private \`shared\` and Pro dependencies are replaced or available in the authorized build environment.
2. Install on OPPO Find X6 Pro, grant microphone permission and confirm Jarvis appears in Android's Digital Assistant App picker.
3. Invoke from the system gesture with the app cold, warm, locked and after process recreation; verify a single recording start and that no assist/screenshot data arrives.
4. Verify the no-model path leaves the microphone closed and provides a useful visible prompt.
5. Add an in-app OEM-compatible role-picker entry and localized instructions.
6. Implement and test a genuinely local legacy RecognitionService only if Android 7–11 system-assistant support remains a product requirement.
7. Separately add opt-in wake word, Russian local TTS, duplex/barge-in and consented on-screen context. None of those is delivered by this system-service slice.
