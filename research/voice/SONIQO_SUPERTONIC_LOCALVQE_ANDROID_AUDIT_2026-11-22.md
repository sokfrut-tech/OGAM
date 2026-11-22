# OGAM / Jarvis — Soniqo Speech Android, Supertonic-3 Russian TTS and LocalVQE AEC Audit
Date: 2026-11-22
Target: OPPO Find X6 Pro PGEM10 / Snapdragon 8 Gen 2 / Android 16 / ColorOS 16.0.5
Status: source and model-card audit only. No Soniqo APK, model bundle or ONNX/LiteRT runtime was downloaded, built or run on PGEM10.

## Executive findings

A new project family is a particularly strong architecture reference for OGAM:
- soniqo/speech-core — Apache-2.0 C++17 local speech engine;
- soniqo/speech-android — Apache-2.0 Kotlin/JNI Android SDK and demo app.

Two components stand out:
1. Supertonic-3 LiteRT — 99M multilingual TTS with Russian among 31 languages, preset voices, G2P-free Unicode input processing, 44.1 kHz output. Soniqo reports 0.34 RTF, about 1.1 s time-to-first-audio and 832 MB peak memory on Galaxy S23 Ultra. This is a strong near-term Russian TTS benchmark candidate, but not a production winner: the model weights are OpenRAIL-M, not MIT/Apache, and no Russian PGEM10 acoustic test is published.
2. LocalVQE v1.4-AEC — 16 kHz explicit-reference acoustic echo cancellation using a small neural residual mask plus adaptive DSP. speech-core also has a timestamp-aligned, bounded, fail-closed microphone/reference stream. It is a promising route to real barge-in, but the current speech-android Kotlin SDK does not expose LocalVQE AEC, and no PGEM10 Android integration/benchmark has been done.

## 1. Exact repository revisions and licensing

### speech-core
Repository: https://github.com/soniqo/speech-core
Inspected main commit: 59b9d7902ea62dbbbfb95e139e2bf0e8957f8753
Commit date: 2026-11-10
Root LICENSE: Apache-2.0
Inspected source blobs:
- docs/models.md: 20001cff4ddd538bd3fddf9e9ad75d0193c3d3e6
- include/speech_core/models/litert_supertonic_tts.h: a085a2cff36b3569c0a0f10e171974fc5796ba71
- include/speech_core/models/onnx_localvqe_echo_canceller.h: 083ebd1897104421ffe02d081bf04e1bcceb2e1b
- include/speech_core/pipeline/timestamped_echo_cancellation_stream.h: e28fdcf42d2fed7bb534dec710df2f36fc6d893b
- src/pipeline/timestamped_echo_cancellation_stream.cpp: b6b17dbd7dbd820931893dd07e050cb0197f3fb4
- src/models/localvqe/onnx_localvqe_echo_canceller.cpp: f26590f342940f1390a382ebf4d08d73eb612d0f
- tests/test_onnx_localvqe_model.cpp: 79256cf53f8c374065a6d1d1485078584042403b
- CMakeLists.txt: bc3d486b0025f5416215e91014b3f8b4a9c615f1

### speech-android
Repository: https://github.com/soniqo/speech-android
Inspected main commit: 66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded
Commit date: 2026-11-10
Root LICENSE: Apache-2.0
Inspected source blobs:
- README.md: 93bbca79eb76b318dcae5664ef84f6cdc2ee9f6d
- sdk/src/main/kotlin/audio/soniqo/speech/SpeechSynthesizer.kt: f9e5a4767120f0af53ed1f03319c6f43520f934f
- sdk/src/main/kotlin/audio/soniqo/speech/SpeechPipeline.kt: c65efb78bea393ec8219bbc1c07ee6b2da1fc39b
- sdk/src/main/kotlin/audio/soniqo/speech/NativeBridge.kt: 465f19e4cd168b8cc4c3ff28abe073e5db06d4f1
- sdk/src/main/cpp/jni_bridge.cpp: faa3a6071abff3d6606c86983c56ada344d365be
- sdk/src/main/cpp/CMakeLists.txt: 35f77921dbfcd4f1942fe72fb41939f51d704824
- sdk/src/main/kotlin/audio/soniqo/speech/service/SpeechTextToSpeechService.kt: 3d39a90b694168e0730b762653197476179c337e

The source licenses do not relicense the model weights:
- speech-core and speech-android wrapper/runtime code: Apache-2.0.
- Supertonic-3 and its Soniqo LiteRT derivative: OpenRAIL-M; the use-based restrictions of the base model carry over. This is not an unrestricted permissive model license.
- LocalVQE's upstream code/weights are Apache-2.0 according to the LocalAI-io/LocalVQE repository/model card. The exact Soniqo ONNX-converted bundle's file notices and checksums must still be independently inspected before OGAM redistributes that specific bundle.

## 2. Supertonic-3 — strongest new Russian TTS candidate

### 2.1 Language, architecture and voice controls

Official Supertone model card lists 31 languages including Russian (language code ru). Soniqo's speech-core implements the corresponding SupertonicTTS-3 LiteRT bundle:
- 99M parameters, four non-autoregressive flow-matching graphs;
- duration predictor → text encoder → vector estimator repeated for the configured ODE steps → vocoder;
- output is mono Float32 PCM at 44.1 kHz;
- G2P-free front end: NFKD normalization, Unicode indexer and language tag; no espeak, phonemizer or lexicon;
- 10 preset voice styles: F1–F5 and M1–M5;
- preset selection can be per synthesis call;
- no on-device voice cloning in this release because the style extractor is not released.

This is valuable for OGAM because Russian input does not require the phonemizer pipeline that some VITS/Piper models require. However, the quality of Russian stress, ё, numbers, abbreviations and Jarvis-specific technical vocabulary must be measured using the repository's Russian evaluation corpus. The existence of a ru language tag is not a Russian pronunciation benchmark.

### 2.2 Bundle size and fixed-window behavior

The Soniqo Android README reports:
- about 380 MB model download;
- 832 MB peak memory;
- base LiteRT graphs at fixed T=128 text tokens and L=64 latent frames, around 4.5 seconds of audio per base piece.

An optional L=128 pair, vector_estimator_L128.tflite + vocoder_L128.tflite, adds about 341 MB of downloads and about 360 MB of peak memory on first use. It allows longer sentences to fit into a single coherent generation window; this optional pair is not suitable for the first low-memory benchmark.

speech-core splits longer texts into bounded pieces, runs a duration preflight, and bisects only at sentence/clause/word boundaries when the predicted duration exceeds the graph window. It can tempo-fit an overrun of up to 10%, inserts 0.3 seconds between actual sentence boundaries and trims artificial split seams. A long sentence forced into separate model calls can still restart sentence-initial prosody; the optional L=128 graph pair improves that case.

### 2.3 Android API and streaming nuance

The audited Android SDK contains:
- TtsModel.SUPERTONIC and Kotlin configuration for selecting the LiteRT model;
- SpeechSynthesizer as a TTS-only Kotlin wrapper, but its direct synthesize() returns one complete PCM16 ByteArray;
- SpeechPipeline.synthesizeStreaming(), which calls a native JNI streaming path and passes safe PCM chunks to a Kotlin callback;
- the C++ LiteRTSupertonicTts implements TTSInterface with a TTSChunkCallback.

Important distinction:
- Supertonic is non-autoregressive flow matching, not Qwen-style autoregressive audio-token streaming.
- Its callbacks represent completed synthesis pieces, not every denoising step or a continuous audio-token stream.
- The published Android benchmark reports about 1.1 seconds time-to-first-audio. That is meaningful, but not instant wake-word latency.
- The generic SpeechPipeline streaming method is available, but its JNI PipelineHandle also owns the chosen speech pipeline models. The direct SpeechSynthesizer API is simpler but batch-oriented.

For OGAM, the cleaner adaptation would be a small TTS-only Kotlin/JNI wrapper around speech-core's LiteRTSupertonicTts that forwards piece callbacks directly into the existing JarvisPcmStreamPlayer. Do not import the full voice-agent pipeline just to access TTS if that unnecessarily loads ASR/VAD components. Keep AudioTrack and AudioFocus exclusively in JarvisPcmStreamPlayer.

### 2.4 Benchmark evidence and limitations

Soniqo's README reports measurements on a Galaxy S23 Ultra (SM-S918B), CPU-only unless noted:
- Supertonic-3 LiteRT RTF: 0.34;
- time-to-first-audio: about 1.1 seconds;
- peak memory: 832 MB.

This is an author-reported Android device benchmark, not a reproduced OGAM test. It is a useful hardware-class reference for Snapdragon 8 Gen 2, but not proof of exact speed, temperature or battery behavior on OPPO PGEM10 / ColorOS. The cited TTS round-trip intelligibility set is not established as a Russian evaluation in the audited docs. No Russian phone-quality test, Russian MOS, Russian WER/CER or PGEM10 temperature test is published in the inspected materials.

### 2.5 License decision

The Supertonic-3 base card and the Soniqo LiteRT card both identify OpenRAIL-M. The LiteRT card explicitly says the exported weights are derived from Supertone/supertonic-3 and inherit OpenRAIL-M use-based restrictions.

This is not a non-commercial-only license, but it is also not an unrestricted MIT/Apache model license. Distribution requires the OpenRAIL-M terms and downstream use restrictions to be carried through. The license has restrictions relevant to misuse, including non-consensual impersonation/deepfakes and some deceptive/harmful use cases. It therefore does not satisfy a requirement for a model with no use-based restrictions.

Decision: benchmark candidate only after the product accepts the OpenRAIL-M model terms. Do not silently describe it as unrestricted open source.

## 3. Current Android system-TTS support is narrower than the speech SDK

A critical implementation detail:
- The Android demo exposes SpeechTextToSpeechService as a platform TextToSpeechService.
- The inspected service advertises only English en-US and German de-DE voices.
- It constructs TtsModel.KOKORO_SHORT_TURN and calls the batch SpeechSynthesizer.synthesize(), then streams the already-completed PCM16 buffer to Android's SynthesisCallback in byte chunks.
- It does not currently expose Russian or Supertonic-3 through Android system TTS.

Therefore, do not assume that installing the public Soniqo demo automatically makes the system-wide Android TTS engine Russian-capable. The standalone SDK has a Supertonic option and pipeline-level chunk callback, but its framework TextToSpeechService currently remains Kokoro-only for English/German.

OGAM would need its own Russian system TTS service or a dedicated Jarvis TTS backend. Keep the two APIs distinct:
- system TextToSpeechService is an OS-facing voice engine;
- JarvisTtsBackend is the internal assistant-response synthesizer.

## 4. LocalVQE v1.4-AEC — strong explicit-reference echo-cancellation candidate

### 4.1 What it does

speech-core has a full OnnxLocalVQEEchoCanceller implementation:
- input: synchronized 16 kHz microphone PCM and separate playback-reference PCM;
- frame size: 256 samples = 16 ms;
- algorithmic latency: one 256-sample frame (16 ms);
- hybrid algorithm: gated delay estimation, partitioned adaptive filter/controller, 512/256 square-root-Hann STFT/overlap-add and a recurrent neural residual mask;
- API exposes current delay, delay confidence, priming, profile timings and reset.

The v1.4-AEC model is explicitly echo-only: it aims to remove far-end playback while preserving the near-end voice, room and background noise. It is not a complete noise suppressor. If background noise still needs reduction, OGAM can evaluate a separate denoiser after AEC, but that adds more CPU and latency.

Upstream LocalVQE model card reports about 203K parameters, roughly 3 MB FP32 and 0.83 ms per 16 ms hop on a Ryzen 9 7900 4-thread benchmark (about 19× real time). This is desktop/CPU evidence, not Android Snapdragon performance.

### 4.2 TimestampedEchoCancellationStream safety behavior

speech-core provides a separate TimestampedEchoCancellationStream for cases where microphone and playback are captured independently:
- accepts timestamped microphone PCM and timestamped playback-reference PCM;
- default sample rate 16 kHz and frame size 256;
- uses a bounded queue and a private worker for AEC inference;
- default reference wait window is 100 ms;
- default playback priming and re-priming periods are 2 seconds;
- publishes the cleaned microphone frame with matching raw-mic and reference frames for diagnostics;
- requires both streams to use the same monotonic timestamp epoch;
- backwards timestamps, missing timestamps, large discontinuities, bounded-queue overrun or inference failure stop the stream;
- it is fail-closed: raw microphone PCM is not published as a fallback after an AEC failure.

This is the right conceptual contract for Jarvis full-duplex capture. It makes synchronization failures explicit instead of silently passing the assistant's own playback into ASR.

### 4.3 Android integration gap

The AEC class is present in speech-core source and in its ONNX CMake source list. However, the inspected speech-android Kotlin/JNI SDK bridge:
- imports and exposes Silero VAD, DeepFilterNet3, ASR/TTS, etc.;
- does not include OnnxLocalVQEEchoCanceller in its JNI bridge;
- does not expose TimestampedEchoCancellationStream to Kotlin.

The Android build does set SPEECH_CORE_WITH_ONNX=ON and compiles the speech_core_models target, but the SDK bridge itself does not create the LocalVQE object or provide microphone/reference timestamp callbacks. OGAM should not assume that depending on the public speech Android AAR exposes a ready-made AEC API.

The native C++ model test uses synthetic mic/reference signals, validates finite output, delay/profile state, reset reproducibility and fail-closed reference underrun. This is useful source-level evidence, but not an Android microphone/speaker benchmark. The test does not prove acoustic echo suppression on an OPPO handset.

### 4.4 OGAM-specific integration design

Keep OGAM's existing single physical microphone owner. Do not add a second AudioRecord or AudioRecorder:
1. Extend the existing native capture bridge only enough to provide actual 16 kHz Float32 microphone frames and monotonic AudioRecord timestamps to the AEC worker.
2. Extend JarvisPcmStreamPlayer with an optional reference-tap callback for the exact PCM samples submitted to AudioTrack. Do not make the AEC module create or own AudioTrack.
3. Establish a common monotonic time mapping between AudioTrack presentation timestamps and microphone capture timestamps. Time-of-write alone is not guaranteed to be the actual speaker presentation time.
4. Feed matching microphone and playback-reference streams to TimestampedEchoCancellationStream.
5. Send only cleaned frames to VAD/ASR. Keep raw mic/reference buffers in a short-lived diagnostic path only, never persist them by default.
6. On AudioTrack route change, AudioFocus interruption, dropped frame, Bluetooth transition, capture restart or clock discontinuity, reset/re-prime AEC. Do not carry stale adaptive state across routes.
7. If timestamps/reference frames are unavailable, AEC reports failure, or near-end speech is damaged, return to explicit half-duplex mode and report the reason.

The user's current OGAM AudioRecorderService records 16 kHz mono and currently reports echo cancellation as false. Its audio player already owns AudioTrack and generation-aware PCM playback. This gives a plausible integration boundary, but its current sources do not yet provide the timestamp pairing required by LocalVQE.

## 5. Build-isolation implications for OGAM

Soniqo's projects use C++17, Android NDK and separate ONNX Runtime/LiteRT integrations. They do not use the same GGML CMake targets as the Qwen TTS module, so they do not create the specific dual-GGML target collision identified in the Qwen integration plan.

However:
- the ONNX AEC route requires an Android arm64 ONNX Runtime library and matching headers;
- the Supertonic route requires the LiteRT C API runtime and compatible TFLite bundles;
- OGAM's current LiteRT-LM Kotlin dependency is not proof that libLiteRt.so / LiteRT C API is already packaged;
- OGAM's existing app CMake builds Stable Diffusion/Video and its GGML submodule; use a separate Android library/native build module for speech-core experiments rather than inserting a second unrelated source tree into the current app CMake.
- verify JNI symbol visibility, native STL packaging, one copy of shared runtimes, ABI, and APK size before combining modules.

The Soniqo Android SDK is Apache-2.0 code, but importing its complete SDK also imports a broad set of STT/VAD/TTS components and native requirements. For OGAM, an isolated TTS-only Supertonic adapter and an isolated AEC adapter are more suitable than adopting the entire assistant pipeline.

## 6. New benchmark plan for PGEM10

### Supertonic TTS
Compare against Qwen3-TTS 0.6B Q4_K_M and the legally cleared Silero CIS/Sherpa alternatives using the same Russian corpus:
- Russian text coverage: stress/homographs, ё, numbers, dates, currency, units, abbreviations, English brand names and assistant dialogue;
- cold/warm model load;
- first PCM piece latency (TTFA);
- total synthesis wall time, audio duration and RTF;
- chunk count and chunk duration; confirm whether output is piece-level or finer;
- peak Java/native RSS, model file size, disk cache and OOM behavior;
- CPU utilization, thermal throttling, battery delta and output quality;
- verify the actual LiteRT delegate. The Soniqo README benchmark is CPU; Qualcomm QNN/HTP acceleration is a separate possible experiment, not an existing proof for the OPPO build.

Start with the base L=64 bundle; do not download the optional L=128 pair until the memory budget is established.

### LocalVQE AEC
- First validate timestamps and queue continuity with generated reference PCM; do not use a raw mic fallback.
- Test known far-end playback plus a consenting near-end speaker, then compare with and without AEC.
- Measure residual echo/ERLE, ASR WER on the near-end voice, clipped/missed speech, VAD false activations, algorithmic latency and CPU cost.
- Repeat on loudspeaker, earpiece and Bluetooth routes; change route during playback and confirm reset/re-prime.
- Test silence/reference-only, near-end-only, double-talk and reference underrun; fail closed if synchronization is lost.
- Keep half-duplex until actual PGEM10 acoustic tests pass.

## 7. Decisions

1. Add Supertonic-3 to the benchmark candidate list for Russian TTS. It is the strongest new small-model candidate found in this pass.
2. Keep Qwen3-TTS as a parallel candidate: larger model, potentially different voice quality, and an existing native callback path. Do not discard it without a same-corpus benchmark.
3. Do not call Supertonic unrestricted: model weights are OpenRAIL-M. The runtime code is Apache-2.0.
4. Do not call the current Soniqo system TTS service Russian-capable: it offers only English and German Kokoro voices. Use its SDK C++/JNI API as an implementation reference, not as a drop-in system assistant.
5. Add LocalVQE explicit-reference AEC to OGAM's high-priority prototype research. It fits the 16 kHz mono capture target and solves the actual echo-reference problem conceptually.
6. Keep half-duplex on current OGAM code until LocalVQE has a synchronized playback-reference adapter and measured PGEM10 results.
7. No source code or model weights have been copied. No APK/build/test/device validation has been performed in this pass.

## Sources

- speech-core Apache-2.0 source: https://github.com/soniqo/speech-core/tree/59b9d7902ea62dbbbfb95e139e2bf0e8957f8753
- speech-android Apache-2.0 source: https://github.com/soniqo/speech-android/tree/66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded
- Supertonic-3 source model card and 31 languages: https://huggingface.co/Supertone/supertonic-3
- Soniqo Supertonic LiteRT bundle and OpenRAIL-M provenance: https://huggingface.co/soniqo/Supertonic-3-LiteRT
- Supertonic Android benchmark and SDK integration: https://github.com/soniqo/speech-android/blob/66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded/README.md
- LocalVQE Apache-2.0 upstream and AEC model evidence: https://huggingface.co/LocalAI-io/LocalVQE
- LocalVQE Soniqo ONNX model bundle: https://huggingface.co/soniqo/LocalVQE-v1.4-AEC-200K-ONNX-FP32
- Timestamped AEC stream source: https://github.com/soniqo/speech-core/blob/59b9d7902ea62dbbbfb95e139e2bf0e8957f8753/include/speech_core/pipeline/timestamped_echo_cancellation_stream.h
- LocalVQE AEC source: https://github.com/soniqo/speech-core/blob/59b9d7902ea62dbbbfb95e139e2bf0e8957f8753/src/models/localvqe/onnx_localvqe_echo_canceller.cpp
- Android TTS service source: https://github.com/soniqo/speech-android/blob/66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded/sdk/src/main/kotlin/audio/soniqo/speech/service/SpeechTextToSpeechService.kt
