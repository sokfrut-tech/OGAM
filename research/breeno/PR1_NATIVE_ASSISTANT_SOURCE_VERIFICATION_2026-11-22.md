# PR #1 Native Assistant Source Verification

Date: 2026-11-22
Repository: sokfrut-tech/OGAM
Inspected branch: feature/jarvis-step-2-storage-privacy
Baseline: main 14b27f7c12c8e6f69b132842534b23a627523956
Purpose: verify the native assistant implementation referenced by the Breeno research.

## Confirmed source files

- android/app/src/main/AndroidManifest.xml
- android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionService.kt
- android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionSessionService.kt
- android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionSession.kt
- android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantBridgeActivity.kt
- android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantLaunchGuard.kt
- android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantRoleModule.kt
- android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantRolePackage.kt
- android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantRoleSnapshot.kt
- android/app/src/main/java/ai/offgridmobile/voice/JarvisPcmStreamPlayer.kt
- android/app/src/main/java/ai/offgridmobile/MainActivity.kt
- android/app/src/main/java/ai/offgridmobile/MainApplication.kt
- android/app/src/main/res/xml/jarvis_voice_interaction.xml
- android/app/src/main/res/values/bools.xml
- android/app/src/main/res/values-v31/bools.xml
- android/app/src/test/java/ai/offgridmobile/voice/JarvisAssistantLaunchGuardTest.kt
- android/app/src/test/java/ai/offgridmobile/voice/JarvisAssistantRoleSnapshotTest.kt
- android/app/src/test/java/ai/offgridmobile/voice/JarvisPcmStreamPlayerTest.kt
- docs/jarvis/ANDROID_SYSTEM_ASSISTANT_INTEGRATION.md

## Confirmed implementation from source

1. Manifest declares JarvisVoiceInteractionService with BIND_VOICE_INTERACTION and the correct VoiceInteractionService intent action.
2. Manifest declares JarvisVoiceInteractionSessionService in a separate :jarvis_voice process, also protected by BIND_VOICE_INTERACTION.
3. JarvisAssistantBridgeActivity is non-exported, no-history and excluded from recents.
4. JarvisVoiceInteractionService disables SHOW_WITH_ASSIST and SHOW_WITH_SCREENSHOT.
5. JarvisVoiceInteractionSession creates a short-lived session, launches the private bridge using startAssistantActivity on Android O+, and finishes the session.
6. The bridge issues a one-use UUID token. MainActivity validates and consumes it before forwarding the assistant deep link to React Native; forged assistant VIEW intents are rejected/stripped.
7. JarvisAssistantRoleModule uses RoleManager.ROLE_ASSISTANT, createRequestRoleIntent(), isRoleHeld(), and VoiceInteractionService.isActiveService(). The request is user-mediated through Android's system confirmation UI; it does not silently change the role.
8. JarvisAssistantRolePackage is registered in MainApplication.
9. JarvisAssistantRoleSnapshot requires supported API, role availability, held role and active service to all be true before reporting ready.
10. System assistant service is disabled below API 31 and enabled from res/values-v31/bools.xml.
11. JarvisPcmStreamPlayer is an engine-neutral AudioTrack/AudioFocus primitive. It is not proof of an integrated TTS model; the integration brief explicitly says no production TTS backend calls it yet.

## RecognitionService metadata — corrected interpretation

The metadata XML sets recognitionService to the VoiceInteractionService component itself. This is not a RecognitionService implementation. However, this is an intentional Android 12+ compatibility value, not automatically a defect on the declared supported range:
- AOSP framework attrs.xml states that recognitionService must be a valid RecognitionService on Android 11 and earlier.
- AOSP states that from Android 12 onward the attribute's component value does nothing, but the field must remain non-empty.
- OGAM disables this VoiceInteractionService below API 31 in values/bools.xml and enables it in values-v31/bools.xml.

Therefore the arrangement is consistent with the stated Android 12+ system-assistant scope, provided the disabled-below-31 resource merge is correct. It does not provide system-assistant support on Android 7–11. Validate merged manifest/resources in a real Gradle build.

AOSP source reference: https://android.googlesource.com/platform/frameworks/base/+/master/core/res/res/values/attrs.xml

## Automated evidence located

The OGAM integration handoff documents open-core workflow run #45039077226:
https://github.com/sokfrut-tech/OGAM/actions/runs/45039077226

I independently inspected its workflow jobs through the GitHub Actions connector:
- One job: "Scan imports and external workspace references".
- Job conclusion: success.
- Steps 1–18 and 36–37 completed successfully.
- Relevant successful static/source-contract steps include Android Jarvis assistant contract, assistant role UI wiring, one-shot Jarvis voice request, assistant URI mapping and PCM playback source contract.

This run is not a Gradle build. The integration handoff itself states that it does not compile Kotlin, execute Kotlin/JUnit tests, run Jest/TypeScript, merge the Android manifest, install an APK, or validate role eligibility/microphone invocation on the OPPO device.

The source branch contains Kotlin/JUnit tests:
- 3 launch-guard tests;
- 5 role-snapshot tests;
- 8 PCM-player tests.

Their presence is confirmed; their execution is not confirmed by run #45039077226.

## Remaining unverified gates

- No successful Gradle Kotlin compile or Android manifest merge is established by the inspected run.
- Kotlin/JUnit tests have not been shown as executed.
- No actual RoleManager dialog or assistant-role activation has been tested on PGEM10 / ColorOS 16.
- No runtime confirmation that the system binds the service and opens the session.
- No target-device confirmation of the cold/warm/locked invocation path or microphone handoff.
- No always-on wakeword or DSP hotword implementation is established by these files.
- PCM player has no production Russian TTS backend connected in the inspected integration handoff.

## Required follow-up

1. Run Gradle compile, manifest merge and Kotlin/JUnit tests in an authorized build environment with the required private dependencies available.
2. Verify the merged manifest on API 31+ and confirm the service is absent/disabled below API 31.
3. Verify Settings UI → RoleManager request → role-held + active service status on an Android 12+ emulator.
4. Install on OPPO Find X6 Pro, test role eligibility and actual assistant gesture, with app cold/warm/locked and after process recreation.
5. Confirm a single recording starts only when a local speech backend is ready; test cancel, empty capture, existing draft preservation and permission denial.
6. Connect a license-cleared Russian TTS backend to JarvisPcmStreamPlayer only after model/runtime license review and device performance tests.

## Status

PARTIAL — native assistant/session/bridge/RoleManager source and static tests are present; one open-core source-contract workflow passed. Gradle build, Kotlin/JUnit execution, runtime invocation and PGEM10 validation remain outstanding.
