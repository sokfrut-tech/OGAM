# OGAM / Jarvis — Nemotron LiteRT Streaming Integration Audit
Date: 2026-11-23
Target: OPPO Find X6 Pro PGEM10 / SM8550 / Android 16 / ColorOS 16.0.5
Status: source-level audit of public Soniqo speech-android / speech-core and Goodnotes LiteRT exports. No source copied, no model weights downloaded, no OGAM code changed, no APK built, no device benchmark.

## Executive result

The Soniqo Android SDK has a valuable standalone streaming transcriber API that accepts caller-provided 16 kHz mono Float32 PCM. This is the right architectural shape for OGAM because OGAM can remain the sole microphone owner and feed the recognizer from its existing AudioRecorderService/shared PCM stream.

However, the current public LiteRT runtime implementation does not activate Qualcomm AOT/NPU acceleration:
- LiteRTEngine::load explicitly ignores its hw_accel argument;
- it always sets kLiteRtHwAcceleratorCpu;
- its own comments say GPU/NPU delegates are not shipped with the desktop wheel and CPU is used;
- the JNI/Kotlin hardwareAcceleration setting is passed through but has no effect in this LiteRT engine path.

Therefore the Goodnotes SM8550 AOT encoder found in the previous audit is not a drop-in accelerator upgrade for this SDK. It needs a deliberate runtime/loader integration and model-pack layout change, plus exact runtime/compiler matching and device validation.

## 1. Source revisions inspected

### Soniqo speech-android
- Repository: https://github.com/soniqo/speech-android
- Main tree commit: 66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded
- README blob: 93bbca79eb76b318dcae5664ef84f6cdc2ee9f6d
- SDK SpeechConfig.kt: 8c9271625b8396c099fc15d0bb70ff2c3e0abe66
- SDK SpeechPipeline.kt: c65efb78bea393ec8219bbc1c07ee6b2da1fc39b
- SDK StreamingTranscriber.kt: e1013fc271ce690341f792d1c653f428d562d822
- SDK ModelManager.kt: 2b0f426cb4aca823dfd99e620d28dec8d4d776f6
- JNI bridge: faa3a6071abff3d6606c86983c56ada344d365be
- Android Nemotron instrumentation test: 4820616787bfc7c3b28d958663076c5737687932
- SDK CMake: 35f77921dbfcd4f1942fe72fb41939f51d704824
- Android demo app minSdk 26, targetSdk 35, compileSdk 37. This is demo-app metadata, not a compatibility guarantee for OGAM.

### Soniqo speech-core
- Repository: https://github.com/soniqo/speech-core
- Main tree commit: 59b9d7902ea62dbbbfb95e139e2bf0e8957f8753
- LiteRT Nemotron implementation: src/models/litert/litert_nemotron_multilingual_stt.cpp, blob 52c2ce0fabdb38e6a3c19107610d3955da442f1c
- LiteRT Nemotron header: include/speech_core/models/litert_nemotron_multilingual_stt.h, blob c2d2ab1a250896889c1b7843774122c433920907
- LiteRT engine: include/speech_core/models/litert_engine.h, blob 6d03281c595334925aa0c429d7e40ee478ed07d2
- Voice pipeline header: include/speech_core/pipeline/voice_pipeline.h, blob e259cb9e144cb75d2ca78f6f405843bff2386e47

## 2. The correct OGAM integration surface: StreamingTranscriber

StreamingTranscriber is explicitly documented as Nemotron multilingual STT without VAD, TTS or a voice-agent pipeline:
- beginStream()
- pushAudio(FloatArray, count) — 16 kHz mono Float32, returns text so far
- endStream() — flushes final frames and closes the stream
- cancelStream() — discards unfinished audio
- setLanguage("ru-RU") — prompt selection from the bundle's languages.json
- word-level timestamps and a wrapper confidence field are exposed.

The native bridge feeds STTInterface begin_stream / push_chunk / end_stream and returns partial text. This lets OGAM keep its own VAD, session state, conversation/LLM/TTS, permissions and action policy. Do not transplant Soniqo's whole demo app or VoicePipeline into OGAM.

Microphone ownership rule: OGAM's existing AudioRecorderService remains the only AudioRecord owner. The adapter subscribes to existing shared 16 kHz PCM and forwards bounded chunks to the recognizer. Never instantiate Soniqo's demo microphone capture, SpeechPipeline app capture, or another AudioRecord in the adapter.

## 3. Streaming geometry and state that must be preserved

The LiteRT multilingual wrapper is a cache-aware 3-graph RNN-T:
1. 128-bin mel frontend: 16 kHz, FFT 512, hop 160 (10 ms), window 400, pre-emphasis 0.97, Slaney mel, log floor 2^-24, centered zero padding.
2. 320 ms windows (32 mel frames) with right-context samples before decode.
3. Four encoder frames per window at 80 ms/frame, with per-stream pre_cache, Conformer attention KV cache, convolution cache and valid-cache length.
4. Prompt-conditioned one-hot language_mask; ru-RU must resolve through languages.json. The implementation defaults to English if not changed, so OGAM must explicitly set and verify ru-RU before opening each stream.
5. RNN-T greedy decoder state (h, c, last token) is persisted across windows; blank terminates each encoder-frame expansion.
6. Partial text is emitted only when another complete 320 ms window is ready; a pushAudio call may return unchanged text. End-of-stream pads/decodes remaining mel windows.
7. One native model instance is one stream and is not thread-safe; serialize calls and do not share one instance across simultaneous capture sources.

The 320 ms model window is not the full end-to-end latency. Audio frontend right context, capture scheduling, encoder execution, decoder/joint loop and UI dispatch must be measured separately.

## 4. Critical blocker: hardwareAcceleration currently does not enable NPU

The Kotlin TranscriberConfig.hardwareAcceleration property defaults to false and is passed through JNI. JNI passes the bool into LiteRTNemotronMultilingualStt(..., hw).

But LiteRTEngine::load(path, bool /*hw_accel*/, ...) explicitly discards that argument and unconditionally calls LiteRtSetOptionsHardwareAccelerators(opts, kLiteRtHwAcceleratorCpu).

The engine's own comment says GPU/NPU delegates are not shipped with its desktop wheel and CPU is the portable path. Thus:
- setting hardwareAcceleration = true does not currently prove or enable QNN/HTP;
- the current LiteRT wrapper is a CPU path, not a Qualcomm AOT path;
- the Goodnotes AOT encoder cannot be used merely by replacing the encoder file in the current SDK bundle;
- a successful model load or transcription on this path must not be reported as NPU acceleration.

A separate Android-specific LiteRT engine implementation is needed to register/load the Qualcomm AI Engine Direct/QNN accelerator, choose the exact SM8550 AOT graph, and verify actual compiled-model accelerator assignment. The portable graph must remain available as explicit fallback. Failure to initialize the delegate or validate SoC/compiler compatibility must select CPU fallback with a visible diagnostic, never a silent NPU success claim.

## 5. Model pack mismatch: Goodnotes vs current Soniqo loader

Current Soniqo ModelManager pins its own model repositories/revisions and expects:
- nemotron-multilingual-encoder.tflite
- nemotron-multilingual-decoder.tflite
- nemotron-multilingual-joint.tflite
- vocab.json
- languages.json
- io_map.json
- config.json

The FP16 revision currently pinned by that code is 1503a9a1eb75b813b83ba65bf5e9fecea4a46091; INT8 uses v1.0.0.

The Goodnotes export is a separate repository and revision. It publishes portable graphs and aot/qualcomm/SM8550/encoder.tflite, with its own release-manifest.json and checksum inventory. Its file names, model card and distribution assumptions do not automatically match Soniqo's model directory layout. Goodnotes also documents Google Play AI pack delivery for exact-SoC AOT selection; OGAM does not currently have that delivery flow.

Before adapter work, make a manifest-based model pack that pins:
- immutable source repository and commit;
- exact portable and SM8550 AOT file names, byte sizes and SHA-256 values;
- vocab.json, languages.json, config.json, and all I/O contracts;
- exporter/compiler and Android runtime/QNN versions;
- license and NOTICE files;
- explicit fallback order and validation results.

Never rename or substitute graph files without checking tensor names, ranks, dimensions, element types, canonical signature role mapping, cache shapes and output ordering.

## 6. Existing Android test coverage is not Russian or SM8550 proof

The inspected NemotronMultilingualSttTest:
- expects a pre-pushed model bundle and fixture;
- skips when the bundle is absent;
- defaults to English (language = en-US);
- validates non-empty transcription and one or more expected English words;
- does not exercise ru-RU, the Goodnotes AOT file, SM8550 delegate initialization, Russian WER/CER, or OPPO ColorOS.

A separate test fixture and instrumentation suite are required for Russian. It should include a known-good Russian WAV/PCM corpus, fixed expected transcripts, WER/CER, names/numbers/dates/technical vocabulary, 320 ms chunk boundaries, final flush, cancellation, language selection, CPU fallback and AOT-vs-portable parity. Run on a physical SM8550 Android device; an emulator or host LiteRT test is not enough.

## 7. Recommended OGAM implementation sequence

1. Do not copy the Soniqo whole application. Keep OGAM's existing recorder, VAD/session driver, state machine, LLM, TTS, tools and action permission layer.
2. Build a narrow StreamingAsrBackend interface and a single-threaded adapter that accepts OGAM shared PCM only.
3. First prove the current portable CPU LiteRT graph with ru-RU using a fixed offline test corpus; log exact model revision and hashes.
4. Add Russian instrumentation tests and measure partial/final latency, RTF, peak RSS, CPU, thermal and battery.
5. Only after CPU correctness, design a separate Android QNN/AOT engine for Goodnotes SM8550; pin the matching LiteRT/QNN toolchain and verify actual accelerator assignment.
6. Compare portable FP16, portable W8A16/dynamic INT8 and SM8550 AOT with the same Russian corpus.
7. Preserve CPU fallback and a hard half-duplex policy until OGAM's AEC has independent physical-device validation.

## 8. Decision

Approved as an architecture/reference: Soniqo's standalone streaming transcriber API and its caller-fed PCM pattern.

Not approved as a drop-in dependency: Soniqo's full speech-android SDK or current LiteRT hardware path.

Not yet approved for device use: Goodnotes SM8550 AOT encoder. It is a promising exact-SoC artifact, but the inspected SDK loader currently hardcodes CPU and its model pack is a different export contract.

No OGAM code, dependencies or model weights were changed in this audit.