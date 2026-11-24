# OGAM / Jarvis — Wake-word and Background Microphone Research
Date: 2026-11-22
Target: OPPO Find X6 Pro PGEM10, Snapdragon 8 Gen 2 / SM8550, ColorOS 16.0.5, Android 16
Status: source/documentation research only; no wake-word implementation selected or tested on PGEM10.

## Executive conclusion
A new, directly relevant Android wake-word lead was found: openWakeWord-compatible Kotlin/ONNX implementations exist, including a small Android port and a second-stage VAD/verifier design. These are worth a controlled prototype, but the pretrained model licenses and Russian phrase support must be checked separately from wrapper-code licenses.

The critical platform constraint is now explicit: Android 12+ restricts background foreground-service starts, and Android 14+ applies while-in-use microphone checks to microphone foreground services. The public Android documentation lists an app providing VoiceInteractionService as an exception to the while-in-use background-start restriction. This makes OGAM's existing native VoiceInteractionService a strategically important foundation, but it does NOT guarantee ColorOS will keep the service or microphone alive indefinitely. Device validation is mandatory.

Do not implement hidden, silent or privacy-bypassing recording. Wake-word mode must be opt-in, visibly indicated, stoppable, and fail closed when microphone access is unavailable.

## 1. New Android wake-word source leads

### A. msnilsen/openwakeword-android
Repository: https://github.com/msnilsen/openwakeword-android
License declared by repository: Apache-2.0 for code.
Inspected public README/source result: Kotlin Android wrapper around openWakeWord using ONNX Runtime.

Observed:
- Entire 3-stage pipeline runs locally: mel spectrogram → speech embedding → wake-word classifier.
- Audio capture uses AudioRecord, 16 kHz mono, dedicated background thread.
- Built-in phrase includes "Hey Jarvis"; custom ONNX model bytes/assets are supported.
- Runtime API exposes threshold, debounce, start/stop/release.
- Declared minimum API 26 and RECORD_AUDIO permission.
- Pretrained openWakeWord models are separately licensed CC BY-NC-SA 4.0 according to the repository result; do not assume the model is commercially reusable or compatible with OGAM distribution merely because the wrapper is Apache-2.0.

OGAM decision:
- High-priority code reference for a minimal Kotlin KWS module and lifecycle API.
- Do not ship the built-in model until its exact model card/license and derivative obligations are verified.
- "Hey Jarvis" is not the Russian hotword "Джарвис"; test phonetic mismatch and train/obtain a Russian phrase model with a clear license.

### B. Suxsem/AndroidWakeWord
Repository: https://github.com/Suxsem/AndroidWakeWord
License declared: Apache-2.0 for wrapper code.

Observed README claims:
- Android API 24+.
- OpenWakeWord-compatible ONNX classifier.
- Dual-stage VAD: lightweight Speex front-end, Silero VAD confirmation.
- Optional second verifier model to reduce false accepts.
- Batched ONNX inference, direct/preallocated buffers and coroutine API.
- Optional NNAPI/XNNPACK/QNN acceleration claims.
- Pause/resume and resource release methods.

OGAM decision:
- Strong architecture reference for low-cost first-stage detection + more expensive confirmation.
- QNN/NNAPI acceleration is an upstream feature claim, not proof of execution on Snapdragon 8 Gen 2 / ColorOS 16. Verify actual delegate selection and fallback.
- Verify each ONNX model's independent license, provenance, input/output contract and Russian-language suitability.
- Compare CPU-only first; add hardware delegates only after stable baseline.

### C. sherpa-onnx Android
Repository/docs: https://github.com/k2-fsa/sherpa-onnx
Android docs: https://github.com/k2-fsa/sherpa-onnx/blob/master/docs/source/onnx/android/index.rst

Observed:
- Android real-time speech recognition is documented as fully local/offline.
- Android QNN/Qualcomm documentation exists.
- Useful common runtime candidate for VAD/ASR/TTS experiments, but no claim is made here that the current OGAM build has a compatible sherpa KWS model or that a QNN model runs on PGEM10.

OGAM decision:
- Keep as a comparison/runtime candidate, not an automatic replacement for existing Whisper/Qwen paths.
- Audit exact wake-word model support, JNI/AAR ABI, license and Qualcomm delegate path before integration.

### D. VoxRT wake-word Android
Repository: https://github.com/VoxRT/voxrt-wake-word-android

Observed README claims:
- Kotlin wrapper Apache-2.0, but native runtime and wake phrase weights are proprietary under separate licenses.
- Custom phrases are part of a commercial SDK tier.
- Ships "Hey Assistant", not "Джарвис".
- Vendor reports test-set metrics and performance on Snapdragon 662-class hardware; these are vendor-reported, not independently reproduced and not evidence for PGEM10.
- The wrapper is not sufficient to establish that model/runtime redistribution is unrestricted.

OGAM decision:
- Benchmark reference only; do not adopt as default due proprietary runtime/weights and custom-phrase licensing dependency.

## 2. Android 12–16 microphone and background restrictions

Primary Android documentation:
- https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
- https://developer.android.com/develop/background-work/services/fgs/service-types
- https://developer.android.com/develop/background-work/services/fgs/launch
- https://developer.android.com/about/versions/15/behavior-changes-15

Verified platform rules:
1. Apps targeting API 31+ generally cannot start a foreground service from the background except defined exemptions.
2. Microphone is a while-in-use permission. On API 34+, a microphone foreground service must satisfy its declared service type and permission prerequisites.
3. A background app normally cannot create a microphone FGS merely because RECORD_AUDIO reports granted; the permission may only be active while the app is in use.
4. Android's documented while-in-use exceptions include a service started by an app that provides VoiceInteractionService.
5. Android 15 adds restrictions to starting microphone foreground services from BOOT_COMPLETED receivers; do not rely on boot receiver autostart for always-on listening.
6. The VoiceInteractionService exception is a platform rule, not a guarantee against OEM battery management, process killing, firmware-specific policy, microphone contention, or lock-screen UX restrictions.

OGAM implications:
- Keep the native VoiceInteractionService as the public Android integration route.
- Treat hotword listening as a separately consented capability, not an assumed property of VoiceInteractionService.
- Add explicit states: disabled, permission-needed, assistant-role-needed, starting, listening, hotword-detected, capturing, suspended-by-system, microphone-busy, error.
- Always expose a visible indicator/notification and a clear stop control when a microphone foreground service is active.
- Never auto-start a hidden microphone loop on boot.
- On permission denial, system suspension, role loss or audio-recording error, stop capture and return to a safe inactive state.
- Test foreground/background/locked/reboot scenarios on PGEM10; Android documentation alone cannot prove ColorOS behavior.

## 3. Proposed prototype matrix (no winner selected)

| Candidate | Code license signal | Model/license concern | Russian "Джарвис" | Target role |
|---|---|---|---|---|
| openwakeword-android | Apache-2.0 wrapper | pretrained model CC BY-NC-SA 4.0 per repo result | Not established; "Hey Jarvis" English model only | Minimal Kotlin/ONNX prototype |
| AndroidWakeWord | Apache-2.0 wrapper | classifier/verifier model licenses must be checked individually | Custom compatible ONNX required | Preferred architecture comparison |
| sherpa-onnx | inspect exact pinned LICENSE/notices | model/runtime pairing and KWS support must be verified | Model-dependent | Shared speech runtime comparison |
| VoxRT | Apache wrapper; proprietary runtime/weights | commercial/proprietary terms | custom phrase is commercial tier | Benchmark reference only |

Measure identical audio corpus and device conditions:
- Russian male/female voices, near/far field, quiet room, TV/music, car/road noise, whispering and competing speech.
- Hard negatives: "Джарвис" spoken in ordinary conversation, similar-sounding Russian words, English "Hey Jarvis", TV dialogue and Jarvis TTS playback.
- False accepts per hour/day, false rejects, detection latency, CPU %, memory, battery drain per hour, temperature and effect of screen-off/locked state.
- Test at least two thresholds and a debounce/cooldown policy; never optimize only for recall while ignoring false activation.
- Test microphone handoff from wake-word capture to ASR and prevent Jarvis TTS from retriggering the detector (AEC/echo control).

## 4. Next technical steps
1. Inspect OGAM PR #1 source for existing VAD, audio capture, foreground service and microphone lifecycle before adding any KWS dependency.
2. Pin one wrapper commit and inspect Gradle dependencies, native ABIs, model file formats and full license notices.
3. Select a legally distributable Russian hotword model or train a new model from licensed/consented data; do not reuse English weights as if they understand Russian.
4. Build a separate benchmark-only Kotlin module with AudioRecord ownership, bounded PCM buffers, cancellation and state reporting.
5. First run CPU-only tests; only then compare NNAPI/QNN with explicit runtime logs proving actual delegate selection.
6. Integrate with VoiceInteractionService only after microphone policy, user consent, notification and lifecycle tests pass.
7. Record PGEM10 battery/thermal/noise results before enabling any default or persistent wake-word mode.

## 5. Related OGAM evidence already present
- PR #1 contains native VoiceInteractionService, VoiceInteractionSessionService, one-use bridge and RoleManager onboarding.
- Current native assistant source does not implement a wake-word detector or DSP hotword path.
- Existing Qwen3-ASR path is whole-recording/offline transcription, not a demonstrated always-on wake-word or streaming ASR implementation.
- The Qwen3-ASR LiteRT SM8550 AOT route is a separate ASR candidate and must not be conflated with a KWS detector.
- No KWS code, ONNX model, proprietary SDK or wake-word weights have been added to OGAM by this research.

## 6. Source references
- openwakeword-android: https://github.com/msnilsen/openwakeword-android
- AndroidWakeWord: https://github.com/Suxsem/AndroidWakeWord
- sherpa-onnx Android: https://github.com/k2-fsa/sherpa-onnx/blob/master/docs/source/onnx/android/index.rst
- VoxRT wake word Android: https://github.com/VoxRT/voxrt-wake-word-android
- Android FGS background restrictions: https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
- Android FGS types: https://developer.android.com/develop/background-work/services/fgs/service-types
- Android FGS launch: https://developer.android.com/develop/background-work/services/fgs/launch
- Android 15 behavior changes: https://developer.android.com/about/versions/15/behavior-changes-15

## Evidence boundary
This is a research and design note. Repository READMEs and vendor performance tables are not independent benchmarks. No model was downloaded, built, executed or measured on OPPO Find X6 Pro. No OGAM source code or production dependency was changed. No always-on listening capability is claimed.


## 7. Follow-up correction and stronger Russian candidate

The MIT trainer interkelstar/microwakeword-trainer now provides a much stronger candidate for a custom Russian «Джарвис» model than a pretrained English wake word. Its source-reported 47/50 real activations, 1/140 mined hard negatives and 82.5 KB TFLite output are only a small author-run evaluation; no model binary was found in the trainer repository and OGAM has not reproduced any result. See [the detailed microWakeWord Android audit](OGAM_RUSSIAN_MICROWAKEWORD_ANDROID_AUDIT_2026-11-22.md).

**Clarification:** the VoiceInteractionService exception applies to the while-in-use microphone restriction. It does not waive all general background foreground-service start restrictions and does not grant hidden DSP hotword permissions. The selected service is system-kept alive, but public Android APIs do not give ordinary apps the privileged AlwaysOnHotwordDetector/SystemApi path. Android 15+ also blocks microphone FGS startup from BOOT_COMPLETED for target API 35+. Start the user-approved microphone session from a visible interaction unless another explicit current exemption is verified, and validate ColorOS 16 on PGEM10.
