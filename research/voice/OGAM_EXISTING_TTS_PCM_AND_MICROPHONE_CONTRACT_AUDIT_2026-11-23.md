# OGAM existing PCM/TTS/microphone contract — source audit
Date: 2026-11-23
Repository: sokfrut-tech/OGAM
Implementation ref inspected: `feature/jarvis-step-2-storage-privacy`
Status: source-level audit only; no code changed, no build/device test.

## Inspected source revisions
- `android/app/src/main/java/ai/offgridmobile/voice/JarvisTtsBackend.kt` — blob `fd71270cc0ecf8ca58056bfd533aa4cb76452e73`
- `android/app/src/main/java/ai/offgridmobile/voice/JarvisPcmStreamPlayer.kt` — blob `024e1af4a1ff09beb3d338ba72e1fa702d24e6eb`
- `android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionService.kt` — blob `2f7c489e1563bf60f990f58f44a1c9fd0895d215`
- `src/services/audioRecorderService.ts` — blob `1646210d412f96522be3398f6503eff4fee0f55e`
- `src/services/recorderAudioStream.ts` — blob `0c6932a342be348abbbc4c9bab6819f0037e696c`
- `docs/jarvis/LOCAL_RUSSIAN_TTS_RUNTIME_EVALUATION.md` — blob `cb1305ebec295a679f75f78330ce9a4bd3f743e2`
- `docs/design/AUDIO_PLAYBACK_SERVICE.md` — blob `9ecf5a390a7b5ab30d443fe9fbd8a9064809ce8f`

## Confirmed architecture
### TTS inference and playback are separate
`JarvisTtsBackend` is a model-neutral Kotlin interface. A backend loads a model from app-private storage and emits ordered mono Float32 PCM chunks with a sample rate. It must not:
- create AudioTrack or acquire AudioFocus;
- capture microphone audio;
- start or own a conversation turn.

It advertises three distinct output modes: complete batch waveform, sentence-chunked requests, and true model streaming. This distinction is important when evaluating Supertonic, Qwen3-TTS, tiny-voca-ru or other candidates: sentence-by-sentence orchestration must not be mislabeled as native model streaming.

The callback returning false tells a backend to stop forwarding audio. The interface explicitly warns that native inference cancellation may not be supported; cancellation claims must match the actual engine API.

### One Android Jarvis PCM playback owner
`JarvisPcmStreamPlayer` owns the Android AudioTrack/AudioFocus path for the native Jarvis voice interaction. It:
- accepts mono Float32 chunks;
- issues generation tokens so stale synthesis chunks cannot leak into a newer answer;
- retries non-blocking writes while checking cancellation;
- invalidates the active generation immediately on cancel;
- releases AudioTrack and AudioFocus on finish/cancel.

This is a good adapter boundary for a new local TTS engine. New engines should feed this player and must not introduce another AudioTrack or AudioFocus owner.

### One existing app microphone owner
`AudioRecorderService` owns the physical microphone capture and provides a shared buffer callback for audio levels and Float32 samples. The same capture can feed recording and realtime preview. `RecorderAudioStream` subscribes to those samples and converts them to PCM16 for whisper.rn; starting/stopping the stream does not start/stop the physical recorder.

Therefore any VAD/KWS/ASR experiment must subscribe to this capture or a coordinated native stream. Do not copy an Android demo's AudioRecord into OGAM.

### Current echo-cancellation state is deliberately false
`AudioRecorderService.isEchoCancelled()` returns false. Its source comments explain why: platform voice-processing presets alone do not provide the playback reference when TTS is played through a separate output path. The current safe behavior is half-duplex: wait for assistant playback to finish before listening again.

## Critical integration gaps found
1. **No playback-reference tap in the inspected Jarvis player.** `JarvisPcmStreamPlayer` writes Float32 samples to AudioTrack but the inspected source has no callback exposing the exact PCM plus presentation timestamps to an AEC engine.
2. **No synchronized monotonic capture/reference clock contract.** `RecorderAudioStream` currently labels PCM with `Date.now()`, a wall-clock timestamp. That value is not sufficient evidence of a shared monotonic hardware presentation/capture clock for timestamped AEC. An AEC prototype must use actual monotonic capture timestamps and a calibrated AudioTrack presentation timeline, not merely callback arrival or wall-clock time.
3. **Two playback paths must not be conflated.** The native Jarvis VoiceInteraction PCM player is separate from the broader React Native audio playback architecture described in `docs/design/AUDIO_PLAYBACK_SERVICE.md`. The latter document is explicitly proposed, not a proof that all app playback is already unified under one service. A TTS adapter must target the intended playback owner and avoid duplicating the ordinary app playback stack.
4. **The microphone stream is a subscription, not an independent recorder.** This is an architectural invariant; tests must verify subscriber lifecycle and no leaked recorder on cancel/navigation.
5. **Backend capability declarations need truthful mapping.** For every model, record whether it is BATCH, SENTENCE_CHUNKED or MODEL_STREAMING, whether native cancellation exists, and whether language hint/voice controls are genuinely implemented.
6. **The system assistant entry is not an always-on wake-word engine.** The inspected `JarvisVoiceInteractionService` is a lightweight system entry point and explicitly disables assist/screenshot context. It does not itself implement Russian KWS or prove background hotword operation.

## Implications for model selection
- tiny-voca-ru can be evaluated as sentence-level synthesis if its Python frontend is ported faithfully and native ONNX inference can emit/cancel safely. Do not call it streaming if each sentence is a separate completed waveform.
- Supertonic-3/Soniqo can be evaluated through a TTS-only adapter that forwards completed synthesis pieces to the existing PCM player. Its piece callback must be classified accurately; model weights retain OpenRAIL-M terms.
- Qwen3-TTS remains a parallel candidate. Inspect the exact JNI callback path and Kotlin wrapper before claiming streaming; the existing plan already flags a native callback not exposed by the Kotlin engine.
- Piper/sherpa-onnx remains subject to per-voice data/model license review and the GPL boundary of Piper phonemization/runtime components.

## Required acceptance tests before enabling full-duplex
1. Assert a single microphone owner during app voice input, system-assistant invocation, KWS, VAD and ASR subscriptions.
2. Assert a single AudioTrack/AudioFocus owner for the Jarvis response stream.
3. Feed synthetic PCM to the player and verify generation-token cancellation stops stale chunks and releases resources.
4. Define and test monotonic capture timestamps and actual playback-presentation timestamps with bounded drift/queue behavior.
5. Add a reference-tap path and a fail-closed AEC worker; never fall back to unprocessed mic frames after reference underrun or clock discontinuity.
6. Only after acoustic tests on PGEM10 pass should full-duplex/barge-in be enabled. Until then retain half-duplex.

## Next source files to inspect
- Native JNI bridge and concrete `JarvisTtsBackend` implementations (if any) to determine whether the interface is currently a contract only.
- `JarvisVoiceInteractionSession` and `JarvisVoiceInteractionSessionService` to trace turn lifecycle, cancellation, lockscreen and system invocation.
- Kotlin unit tests for `JarvisPcmStreamPlayer` and `JarvisTtsBackend` to map existing regression coverage.
- Native/React Native recorder bridge timestamp source to replace wall-clock timestamps only if the underlying capture API can provide a trustworthy monotonic clock.

## Decision
The current architecture already provides the right high-level seams: model-only TTS backend, one native Jarvis PCM player, one shared microphone owner. Do not replace them with a third-party assistant's whole audio stack. The next implementation should be an isolated adapter and test harness, not a second recorder/player. No candidate is approved as the production winner and no device validation is claimed.

## Source links
- https://github.com/sokfrut-tech/OGAM/blob/feature/jarvis-step-2-storage-privacy/android/app/src/main/java/ai/offgridmobile/voice/JarvisTtsBackend.kt
- https://github.com/sokfrut-tech/OGAM/blob/feature/jarvis-step-2-storage-privacy/android/app/src/main/java/ai/offgridmobile/voice/JarvisPcmStreamPlayer.kt
- https://github.com/sokfrut-tech/OGAM/blob/feature/jarvis-step-2-storage-privacy/src/services/audioRecorderService.ts
- https://github.com/sokfrut-tech/OGAM/blob/feature/jarvis-step-2-storage-privacy/src/services/recorderAudioStream.ts
- https://github.com/sokfrut-tech/OGAM/blob/feature/jarvis-step-2-storage-privacy/docs/jarvis/LOCAL_RUSSIAN_TTS_RUNTIME_EVALUATION.md
