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


## Independent Gemini audit reconciliation — 2026-11-22

Source: `sokfrut-tech/Universal-AI-Factory/coordination/gemini/outbox/REPORT_2026-11-22_OGAM_breeno_dex_audit.md` (status: `completed_with_findings`; inspected PR #1 at `8ad6a6fd`, PR #2 at `a5d5c71d`).

The audit findings were checked against the later OGAM source and CI evidence. The original Gemini report is retained as an independent audit record; dispositions below distinguish source fixes from runtime-only gates.

### B1 — React Native callback / Activity access: source fix compiled

- The earlier Kotlin compiler failure was reproduced in CI: `onActivityResult(Activity?)` did not override the pinned RN 0.83.1 interface, and the synthetic `currentActivity` access was unresolved.
- Corrective commits: `53ef299f378a4c070c10a36879dd63cc50cab42b` (Role module) and `20650c137cb1fe3f66de450d8d1d706a28f2e18f` (PCM `setVolume` return type).
- Later Android CI run [#45052196801](https://github.com/sokfrut-tech/OGAM/actions/runs/45052196801) reached and passed `:app:compileDebugKotlin`, `:app:compileDebugJavaWithJavac`, and manifest processing on commit `a65dbca1`.
- The same run exposed a Kotlin test-fixture JVM signature clash; the fake backing property was renamed to `currentVolume`. Do not claim the Kotlin unit tests passed from the main-source compile alone.

### B2 — `FLAG_ACTIVITY_NEW_TASK`: Gemini hypothesis not reproduced

- OGAM invokes `VoiceInteractionSession.startAssistantActivity()` on API 26+ and `startVoiceActivity()` on the fallback path. Android's public API contract creates the assistant/voice activity in a new task and applies `FLAG_ACTIVITY_NEW_TASK`.
- No redundant flag patch was applied. ColorOS 16 background-activity-launch, lock-screen and task behavior still require PGEM10 testing.

### B3 — recognitionService metadata: supported-range interpretation corrected

- The metadata value remains non-empty. AOSP specifies that the component value is ignored from Android 12 onward; below API 31 OGAM disables both system-assistant services through the versioned boolean resource.
- This is not evidence of a debug `.dev` package failure on the supported API 31+ path. Android 7–11 system-assistant support remains intentionally unavailable until a real legacy `RecognitionService` exists.
- Manifest merge/resource behavior still requires the full Android build and device verification.

### B4 — forged assistant URI: route-normalization bypass mitigated; token expiry remains open

- The native guard now matches the URI route case-insensitively, normalizes repeated/trailing slashes, handles percent-encoded unreserved static characters, and ignores query/fragment when deciding whether an ACTION_VIEW URL targets `assistant/voice`.
- `MainActivity` rejects/strips matching external VIEW intents unless the non-exported bridge supplies the one-use token. This closes the route-spelling mismatch identified by Gemini at source level.
- **Remaining hardening:** the in-process pending token still has no explicit monotonic-clock TTL. Add a short expiry and lifecycle/reset tests before treating stale-token exposure as closed. Adversarial Activity-level tests and PGEM10 invocation tests are also outstanding.

### B5 — service/API and audio lifecycle: partially addressed

- Both `JarvisVoiceInteractionService` and `JarvisVoiceInteractionSessionService` use the same API-level enabled resource; the companion service gate and its source-contract assertion were committed as `a781a873ad1f99c03ba6b3e66578f1b6ba75c2ad` and `9c6863aea09aa66cbc3ed7147dd714098f11f6a1`.
- Remaining: Android audio usage should be reviewed for assistant speech semantics; the PCM write backoff must be bounded without a high-frequency busy loop; production TTS is not connected; lock-screen/background/service-restart/audio-focus behavior and permission-denial matrix remain unverified. Do not change audio policy without focused tests.

### Audit boundary and next gates

- Gemini's workstation did not have JADX/JDK/apksigner/aapt2/apktool/adb; its APK analysis is an independent static cross-check, not method-level DEX or runtime proof.
- The 26 APK inventory remains read-only. No OPPO APK, DEX/Smali, native library, private key or OEM asset is imported into OGAM.
- The successful Android main-source compile is not an APK release or device pass. Require Kotlin/JUnit completion, APK assembly, and PGEM10 checks for role selection, cold/warm/locked invocation, microphone handoff, audio focus and denial paths.
