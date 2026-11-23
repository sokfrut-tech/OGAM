# OGAM VoiceInteraction session lifecycle and bridge security audit
Date: 2026-11-23
Repository: sokfrut-tech/OGAM
Implementation ref: `feature/jarvis-step-2-storage-privacy`
Status: static source audit plus Android API documentation review; no build, emulator or PGEM10 runtime test.

## Inspected source revisions
- `JarvisVoiceInteractionService.kt` — blob `2f7c489e1563bf60f990f58f44a1c9fd0895d215`
- `JarvisVoiceInteractionSessionService.kt` — blob `f1e2d4f81b71fe93ee87d077f52149dfa35dcf50`
- `JarvisVoiceInteractionSession.kt` — blob `37b134dcfc591502a3c20afbef20086f309b6c65`
- `JarvisAssistantBridgeActivity.kt` — blob `48487cd94982c2cf170d3effaed2b58cf103db72`
- `JarvisAssistantLaunchGuard.kt` — blob `c9d2d09396cd0e811a4af96abc39c9cbb3fbb47b`
- `MainActivity.kt` — blob `365bd2798c08d093ecae2becd6d5b2546c79c8b3`
- `JarvisAssistantLaunchGuardTest.kt` — blob `fc1c3f32696ed3df79fe4921a011f94e2f460a56`
- `JarvisPcmStreamPlayerTest.kt` — blob `aea70a16696d48cb3dbe2b1f28b17780ab74734b`
- `JarvisTtsBackend.kt` — blob `fd71270cc0ecf8ca58056bfd533aa4cb76452e73`
- `JarvisTtsBackendContractTest.kt` — blob `962338decdec038367e082f0a20e329602190f20`
- Manifest — blob `99048ae1c67a95fd5580482b98704be6d2dc315c`
- Voice interaction metadata — blob `928a0abe741d04d1d97dbf2337ab8f8e92a07ffd`
- API 31 enabled bool — blob `6267c97cca704b7d522734f461e8886dfa399384`
- Base disabled bool — blob `6f8c977540b0218327eb6d725c081e875b8a5188`

## Confirmed system invocation path
1. Android binds `JarvisVoiceInteractionService`; `onReady()` disables both assist and screenshot context flags.
2. The separate `:jarvis_voice` process receives a session from `JarvisVoiceInteractionSessionService.onNewSession()`.
3. `JarvisVoiceInteractionSession.onShow()` starts a private `JarvisAssistantBridgeActivity` using `startAssistantActivity()` on API 26+ (or `startVoiceActivity()` fallback), then immediately calls `finish()`.
4. The non-exported bridge Activity issues a one-use token and forwards the fixed `offgrid://assistant/voice?startVoice=1` URI to exported `MainActivity`.
5. MainActivity accepts the assistant route only if the token matches the in-process pending token and is consumed once. It strips the token after acceptance. An untrusted assistant URI is replaced with a normal MAIN intent before React Native reads the initial URL.
6. The guard token expires after 10 seconds, uses `SystemClock.elapsedRealtime()`, invalidates the previous token on a new issue, and rejects forged, reused, expired and clock-rollback tokens.

## What is good and evidenced
- The system service is lightweight; session UI/bridge work is separated into `:jarvis_voice`.
- The bridge Activity is explicitly non-exported and excluded from recents.
- The one-shot token is held in process memory; the separate voice process cannot mint/read it.
- MainActivity guards both initial launch and `onNewIntent`; route matching intentionally follows React Navigation normalization of repeated/trailing slashes and percent-encoded static characters.
- Tests cover token single-use, forgery, expiry boundary, clock rollback, replacement, route normalization and unrelated routes.
- PCM player tests cover partial writes/order, cancellation of stale generations, release/focus cleanup, focus loss/ducking and a concurrent cancelled-start race.
- Manifest disables system-assistant registration below API 31. This is an explicit limitation, not Android 7–11 assistant support.
- System assist/screenshot content is not collected. The actual assistant conversation UI and microphone permission remain in OGAM's normal app flow.

## Gaps / follow-up risks
1. **No real system lifecycle instrumentation test found in the inspected test tree.** Unit tests validate the launch guard and PCM player, but not Android's binding/role-selection/onShow/activity handoff on a real API 31+ device. Add an instrumentation or controlled device test for selecting OGAM as default assistant, invoking it from home/lockscreen and returning to the app.
2. **`setUiEnabled(false)` is called in the session constructor.** Android's API reference specifically describes calling it in `onPrepareShow(Bundle,int)` when using an assistant Activity instead of the session window. Verify behavior on API 31/34/36; consider moving it to `onPrepareShow` so it follows the documented lifecycle.
3. **The fallback branch is currently unreachable by manifest configuration.** API <31 disables the VoiceInteractionService, so `startVoiceActivity()` is defensive code rather than supported legacy integration. Keep Android 7–11 labelled as normal in-app voice only until a real local `RecognitionService` exists and is tested.
4. **Metadata needs a manifest-level compatibility check.** `android:recognitionService` currently names `JarvisVoiceInteractionService`, which extends `VoiceInteractionService`, not `RecognitionService`. The resource comment says Android 12+ ignores the component value. Because the service is disabled below API 31, it is not currently used there; nevertheless validate the metadata against Android 12–16 system behavior and do not enable legacy support with this value.
5. **No foreground microphone/wake-word loop is implemented by this system entry.** It is a handoff into the visible app, not always-on hotword detection. Keep this distinction in UI, product claims and battery expectations.
6. **No concrete production TTS backend was found in the inspected Android source tree.** `JarvisTtsBackend` is a contract; no model adapter implementation appeared in the file inventory. TTS model research therefore remains candidate research until a backend is written and tested.
7. **No Android instrumentation/device evidence was attached to these unit tests.** Passing source-level tests must not be described as OPPO system integration success.

## Recommended next implementation/test sequence
1. Add lifecycle instrumentation coverage for role selection, system binding, `onShow`, bridge handoff, token consumption and route delivery on API 31, 34 and 36.
2. Verify lockscreen invocation policy and behavior with the device's current ColorOS build. Record whether user authentication/unlock is required; never bypass secure lockscreen.
3. Verify the `setUiEnabled(false)` lifecycle placement and metadata parsing on target Android versions before changing source.
4. Implement no always-on KWS in this service. Build KWS as a separate explicit opt-in subsystem consuming the existing shared mic owner, with visible state and battery/thermal acceptance tests.
5. Add the first local TTS backend as an inference-only adapter to `JarvisTtsBackend`; forward PCM only to `JarvisPcmStreamPlayer`. Test batch/sentence/model-streaming mode and cancellation truthfully.
6. Keep Android 7–11 support scoped to the normal in-app voice path until a dedicated local RecognitionService is implemented.

## Decision
The current native assistant path is a guarded system-to-app launcher, not a complete Siri/Breeno-style assistant runtime. Its one-shot handoff security and PCM playback tests are useful foundations. The next proof gate is real Android lifecycle instrumentation on the target OS; do not claim always-on hotword, lockscreen parity, RecognitionService support or OPPO runtime success yet.

## References
- Android VoiceInteractionSession API: https://developer.android.com/reference/android/service/voice/VoiceInteractionSession
- Android VoiceInteractionService API: https://developer.android.com/reference/android/service/voice/VoiceInteractionService
- Android VoiceInteractionSessionService API: https://developer.android.com/reference/android/service/voice/VoiceInteractionSessionService
- OGAM session: https://github.com/sokfrut-tech/OGAM/blob/feature/jarvis-step-2-storage-privacy/android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionSession.kt
- OGAM bridge: https://github.com/sokfrut-tech/OGAM/blob/feature/jarvis-step-2-storage-privacy/android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantBridgeActivity.kt
- OGAM guard: https://github.com/sokfrut-tech/OGAM/blob/feature/jarvis-step-2-storage-privacy/android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantLaunchGuard.kt
