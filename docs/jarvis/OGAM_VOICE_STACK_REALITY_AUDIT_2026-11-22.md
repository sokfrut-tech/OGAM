# OGAM Voice Stack Reality Audit — Native Assistant, ASR, VAD, TTS and Hotword Boundaries
Date: 2026-11-22
Repository: sokfrut-tech/OGAM
Audited branch: feature/jarvis-step-2-storage-privacy
Target device: OPPO Find X6 Pro PGEM10 / Snapdragon 8 Gen 2 / Android 16 / ColorOS 16.0.5
Mode: read-only source audit plus public Android API research. No source code changed and no device test performed.

## Executive conclusion

The current OGAM branch has a real Android system-assistant entry point and a substantial voice-turn pipeline, but it is not yet an always-listening Jarvis.

The system assistant invocation currently opens the existing Chat UI through a private bridge. Microphone capture and speech recognition are delegated to the existing app voice path. There is no wake-word detector, no Android DSP/AlwaysOnHotwordDetector integration, and no demonstrated offline-only guarantee for the generic React Native speech-recognition service.

The current JS SpeechEndpointTimer is an adaptive RMS/silence endpoint heuristic. It is not a neural VAD and it does not identify speech phonemes; it estimates speech activity from microphone amplitude and ends a turn after silence. Existing Qwen3-ASR is a separate local whole-recording transcription path, not evidence of streaming wake-word or always-on ASR.

The Android TTS layer has a clean model-neutral interface and PCM playback abstraction, but the audited branch does not establish a production Russian TTS model/backend simply by defining those interfaces.

## 1. Native assistant entry point — what it really does

Audited files and blob SHAs:
- `android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionService.kt` — `2f7c489e1563bf60f990f58f44a1c9fd0895d215`
- `android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionSession.kt` — `37b134dcfc591502a3c20afbef20086f309b6c65`
- `android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionSessionService.kt` — `f1e2d4f81b71fe93ee87d077f52149dfa35dcf50`
- `android/app/src/main/res/xml/jarvis_voice_interaction.xml` — `928a0abe741d04d1d97dbf2337ab8f8e92a07ffd`

Observed behavior:
1. `JarvisVoiceInteractionService.onReady()` disables SHOW_WITH_ASSIST and SHOW_WITH_SCREENSHOT context.
2. The session service creates a short-lived `JarvisVoiceInteractionSession`.
3. `onShow()` launches `JarvisAssistantBridgeActivity` using `startAssistantActivity()` and a fixed internal assistant URI.
4. The session finishes. The app's existing ChatScreen/ChatInput voice flow owns subsequent microphone interaction.
5. The service is gated to Android 12+; a legacy RecognitionService path is not implemented.
6. No code in these classes creates a HotwordDetector, AudioRecord, DSP trigger, microphone foreground service, or persistent wake-word state machine.

Interpretation: the OS can invoke OGAM as the selected assistant, but this code does not itself listen for "Джарвис". Keep these capabilities separate in UI and status reporting.

## 2. Existing generic speech recognition path

Audited file:
- `src/services/voiceService.ts` — `1a584f8b5717fc958e8fba65bb28c73f27e0f535`

Observed:
- Uses `@react-native-voice/voice`.
- Calls `Voice.isAvailable()`, registers start/end/results/partial/error callbacks and calls `Voice.start('ru-RU'|'en-US')`.
- Requests Android `RECORD_AUDIO`.
- Does not select or pin a particular local recognition engine in this file.
- Does not prove that the active system RecognitionService is offline, Russian-local, or even present on a Chinese ColorOS build.

Decision:
- Keep this as the current user-visible push-to-talk compatibility path.
- Do not label it "fully offline" until the actual RecognitionService/backend on PGEM10 is identified and network-disabled tests pass.
- Expose the selected recognition backend and offline status explicitly; fail with a useful setup message when no offline engine is available.

## 3. Existing endpoint detector is not neural VAD

Audited file:
- `src/utils/speechEndpoint.ts` — `2d73b0dfccc15a3cb3516d336aca35ac8d254ae7`

Observed:
- Computes RMS level and compares it to an adaptive noise floor.
- Speech decision uses `rms > floor * 3 + 0.006`.
- Floor adapts faster downward and slowly upward.
- A 1.5 second default quiet tail ends the turn; a no-speech timeout applies to push-to-start mode.
- Hands-free mode can wait indefinitely until speech begins.
- The timer uses setInterval and is a JS endpoint heuristic, not Silero/Speex/neural VAD.

Risks to test:
- Quiet speech, whispers and distant voices may be classified as silence.
- TV/music/impact noise can exceed the amplitude threshold without being speech.
- Noise floor initialization and changing room noise can shift sensitivity.
- Silence endpointing can cut long pauses or fail to end on persistent noise.

Decision:
- Preserve the existing user-configurable silence behavior during migration.
- Compare the current RMS endpoint against Silero VAD on a labelled Russian test corpus.
- Do not call the current timer "Silero VAD" or "speech recognition".
- Add explicit endpoint reason and measured timings to diagnostics without storing raw audio by default.

## 4. Qwen/Whisper ASR boundary

The existing OGAM research and source plan describes:
- Qwen3-ASR 0.6B through llama.rn with paired GGUF model/projector downloads and integrity metadata.
- Android inference currently CPU-only in that path.
- The Qwen path transcribes a recorded WAV after recording stops; it is not the always-on KWS stage and not currently demonstrated as streaming partial ASR.
- Whisper realtime is a separate existing path and must be compared independently.
- LiteRT-LM Omni Qwen3-ASR is a distinct experimental integration path; the existence of a community SM8550 AOT model is not evidence OGAM currently loads it.

Decision:
- Keep wake-word, VAD, ASR and conversational LLM as four separately measurable components.
- Benchmark Qwen3-ASR and Whisper with identical Russian audio; measure WER/CER, first-result latency, total latency, RAM, CPU/GPU/NPU, battery and thermal state.
- Do not keep the large conversational model resident alongside ASR/TTS until actual memory headroom and thermal throttling are measured on PGEM10.

## 5. TTS interface vs implemented voice

Audited file:
- `android/app/src/main/java/ai/offgridmobile/voice/JarvisTtsBackend.kt` — `fd71270cc0ecf8ca58056bfd533aa4cb76452e73`

Observed:
- Defines a model-neutral backend contract, capabilities, request/result types, cancellation and model load/unload.
- Requires model inference to emit Float32 PCM.
- Playback and generation ordering are explicitly delegated to `JarvisPcmStreamPlayer`.
- The interface itself contains no model, tokenizer, phonemizer, JNI binding or synthesis implementation.

Decision:
- Treat this as a sound extension seam, not proof that a Russian local voice is already shipped.
- Next audit should inventory every concrete `JarvisTtsBackend` implementation and its model assets, then select one license-cleared Russian model.
- Verify first-audio latency, RTF, stress/prosody, interruption and audio focus on-device.

## 6. Android hotword APIs: public app KWS vs privileged DSP path

Primary sources:
- Android VoiceInteractionService API: https://developer.android.com/reference/android/service/voice/VoiceInteractionService
- Android AOSP VoiceInteractionService implementation/API annotations: https://android.googlesource.com/platform/frameworks/base/+/515e89f909b17e5befdcac128614264172b899df/core/java/android/service/voice/VoiceInteractionService.java
- AOSP platform manifest permission definitions: https://android.googlesource.com/platform/frameworks/base/+/419475c52973320045a86c20026adf08f9bd27c4/core/res/AndroidManifest.xml
- Android foreground-service restrictions: https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
- Android microphone FGS type: https://developer.android.com/about/versions/14/changes/fgs-types-required
- Android 15 FGS boot restrictions: https://developer.android.com/about/versions/15/changes/foreground-service-types

Important distinction:
- A selected `VoiceInteractionService` is a platform integration point and Android says it should remain lightweight because it is always running.
- Android framework source annotates hotword detector creation with `@SystemApi` and `MANAGE_HOTWORD_DETECTION`; the hotword detection service is bound using a signature-protected permission. These are not ordinary third-party app APIs.
- AOSP manifest marks `BIND_HOTWORD_DETECTION_SERVICE` as signature-protected and @SystemApi. Do not design OGAM around assuming it can register an OEM privileged HotwordDetectionService or access the Qualcomm DSP hotword path.
- A normal app can run its own AudioRecord + ONNX KWS pipeline after user permission, but that is software microphone capture and has real battery/background/ColorOS lifecycle constraints.
- Android's microphone FGS type requires `FOREGROUND_SERVICE_MICROPHONE` on modern targets plus `RECORD_AUDIO`; while-in-use restrictions apply. Android documents a VoiceInteractionService-related exemption, but this is not a guarantee that ColorOS will preserve the process, audio route or microphone access under OEM power management.
- Android 15 prohibits starting microphone foreground services from BOOT_COMPLETED for apps targeting API 34+. Never rely on a boot receiver to silently turn on listening.

Design decision:
- Tier 1: user-visible push-to-talk / system-assistant invocation, no continuous listening.
- Tier 2: opt-in software KWS while a clearly disclosed microphone session is active; visible state, notification where required, stop control, no hidden boot autostart.
- Tier 3: OEM/DSP always-on hotword only if OPPO exposes a supported public contract or the user deliberately accepts a separately designed privileged/root route. Do not assume availability.
- On permission loss, role loss, process suspension, microphone contention or inference failure, transition to inactive/suspended and report why.

## 7. Wake-word libraries worth a bounded prototype

### Suxsem/AndroidWakeWord
Repository: https://github.com/Suxsem/AndroidWakeWord
- Apache-2.0 wrapper code.
- README describes Speex low-cost front end, Silero VAD confirmation, ONNX Runtime, optional verifier and optional NNAPI/XNNPACK/QNN.
- Supports Android API 24+ and runtime RECORD_AUDIO permission.
- Its claimed accelerators are not evidence that the correct delegate is available or used on SM8550. The model's license is independent of the wrapper.
- The project currently has a very small public footprint (six stars in the inspected page); treat it as prototype code, not production-proven software.

### msnilsen/openwakeword-android
Repository: https://github.com/msnilsen/openwakeword-android
- Apache-2.0 wrapper.
- Bundled "Hey Jarvis" is English, not Russian "Джарвис".
- README states pretrained openWakeWord models are CC BY-NC-SA 4.0; do not ship those models in a commercial-capable OGAM build without a compatible license.
- Custom ONNX model support is available, but a Russian model needs its own training data, provenance, validation and license.

### AOSP DSP route
- Not selected: the public AOSP hotword APIs shown in source are @SystemApi/privileged. Hardware DSP/AlwaysOnHotwordDetector availability is OEM/firmware-specific and not proven on this device.

## 8. Exact OGAM gap list

| Capability | Current evidence | Status |
|---|---|---|
| User-selected Android assistant | VoiceInteractionService + RoleManager flow | Implemented in source; device untested |
| Assistant invocation UI handoff | Session -> private bridge -> Chat | Implemented in source; device untested |
| Always-on wake word | No KWS detector in audited classes | Not implemented |
| Russian wake word "Джарвис" | No licensed model/training corpus integrated | Not implemented |
| OEM DSP hotword | No public PGEM10 contract identified | Unverified / do not assume |
| Generic push-to-talk | React Native Voice bridge | Implemented; backend/offline property unverified |
| Local Qwen ASR | Separate WAV transcription path | Implemented in source plan; no acoustic PGEM10 benchmark |
| Neural VAD | Existing JS RMS endpoint heuristic | Not implemented in this path |
| Local Russian TTS | Backend interface and PCM player abstractions | Engine/model implementation not established by this audit |
| Lock-screen wake-word | No device evidence | Untested |
| Battery/thermal profile | No PGEM10 measurements | Not tested |

## 9. Next work sequence

1. Audit the concrete TTS backend implementations and model assets; prove whether any Russian synthesis engine is actually connected.
2. Inspect the existing recording controller and Whisper realtime path for AudioRecord ownership, cancellation, sample rate and lifecycle; avoid two simultaneous microphone owners.
3. Create a small benchmark-only Kotlin KWS module using one pinned Apache-2.0 wrapper and a legally clear Russian phrase model; do not bundle English "Hey Jarvis" weights as Russian.
4. Compare current RMS endpoint with Silero VAD on identical labelled Russian audio.
5. Add state machine contracts: disabled, permission-needed, starting, listening, detected, capturing, suspended, microphone-busy, error.
6. Run CPU-only baseline first, then verify actual ONNX delegate selection before any NNAPI/QNN claim.
7. Test foreground, background, screen-off, lock-screen, reboot, call/audio focus, TTS echo, thermal and battery on PGEM10.
8. Only after those results decide whether opt-in continuous software KWS is acceptable. Do not make it default based on desktop benchmarks or README claims.

## Evidence boundary

This is a source/API audit. It does not establish that the assistant role works on the user's handset, that ColorOS allows sustained microphone capture, that any wake-word model recognizes Russian "Джарвис", or that local ASR/TTS meets latency/quality/battery goals. No code, model or dependency was added. No APK was built or installed.
