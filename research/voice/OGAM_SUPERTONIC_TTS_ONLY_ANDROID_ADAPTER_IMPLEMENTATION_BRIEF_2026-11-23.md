# OGAM Supertonic TTS-only Android adapter — implementation brief (2026-11-23)

## Decision

Proceed to a **benchmark-only, isolated native adapter prototype** for Supertonic-3. Do not integrate into production assistant routing, do not bundle model weights in the APK, do not merge the research branch, and do not claim device performance until a signed build runs on OPPO Find X6 Pro (PGEM10 / SM8550).

The key new finding is that the Soniqo Android SDK already has a **TTS-only native handle** that constructs Supertonic without instantiating the VAD/STT VoicePipeline. It also has a cancellable TTS-only handle. What is missing is a streaming callback on this TTS-only handle: the existing direct `SpeechSynthesizer.synthesize()` accumulates a complete PCM16 byte array. The existing streaming JNI helper is attached to `PipelineHandle`, not `SynthesizerHandle`.

This means the correct next step is a small upstream-style JNI extension or a forked adapter, not loading the entire VAD/STT pipeline solely to get audio chunks.

## Exact source evidence

Pinned Soniqo revisions:
- `soniqo/speech-android` `66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded`
- `soniqo/speech-core` `59b9d7902ea62dbbbfb95e139e2bf0e8957f8753`

Android SDK:
- `SpeechSynthesizer.kt`: TTS-only interface; `synthesize(text, language, voice)` returns `SpeechSynthesisResult(sampleRate, pcm16)`; `stop()` delegates to `nativeStopSynthesizer`.
- `NativeBridge.kt`: TTS-only methods exist for create/destroy/stop/sample-rate/batch synthesize. Streaming callback exists only for `nativePipelineSynthesizeStreaming`.
- `jni_bridge.cpp`: `SynthesizerHandle` owns `unique_ptr<TTSInterface>` and a mutex. `nativeStopSynthesizer` calls the model's thread-safe `cancel()`. `nativeSynthesize` calls a helper that collects all chunks into a vector and returns one byte array.
- The same JNI file already contains `synthesize_streaming_pcm16()`: it forwards each native TTS callback chunk to Kotlin as PCM16 bytes, with a final flag. It currently accepts `TTSInterface&` + mutex and is reused only by `PipelineHandle`.
- `speech_core::LiteRTSupertonicTts` implements `TTSInterface::synthesize`, emits `TTSChunkCallback` chunks, reports 44,100 Hz, and has thread-safe `cancel()`.
- Supertonic is non-autoregressive flow matching, default 8 ODE steps, fixed T=128 text / L=64 latent base graphs; longer text is split at sentence/clause/word boundaries only when predicted audio overflows the window. Each completed piece is emitted through the callback. This is **sentence/clause chunked synthesis**, not autoregressive streaming.
- The Soniqo Android CMake target conditionally builds `speech_core_models_litert` only if `LITERT_DIR/<abi>/libLiteRt.so` exists. Supertonic requires that LiteRT path. The SDK's Gradle file has minSdk 26, NDK r29, arm64-v8a and x86_64; OGAM's app minSdk is 24 and NDK version is controlled by the root project. Do not import the whole AAR without reconciling these constraints.

OGAM implementation seam (feature branch `feature/jarvis-step-2-storage-privacy`):
- `JarvisTtsBackend.kt` already expects mono Float32 PCM chunks and a Boolean callback return for stale/cancelled generations. It explicitly distinguishes BATCH, SENTENCE_CHUNKED and MODEL_STREAMING.
- `JarvisPcmStreamPlayer.kt` already owns AudioTrack/AudioFocus and generation tokens, accepts Float32 chunks and supports immediate cancellation.
- Player supports 8–96 kHz, so Supertonic's 44.1 kHz is within range.
- Existing OGAM app has `com.google.ai.edge.litertlm:litertlm-android:0.19.1`; this is LiteRT-LM, not proof that standalone LiteRT CompiledModel runtime is present or ABI-compatible. Existing native CMake builds Stable Diffusion/ggml video code and does not yet demonstrate a plain LiteRT runtime integration.
- OGAM Android minSdk 24. The Soniqo SDK minSdk 26 cannot be consumed unchanged if OGAM must retain Android 7 / API 24 support. A direct JNI/CMake adapter must either compile and work at API 24 or be gated with a deliberate API-level capability fallback. Do not silently raise OGAM minSdk.

## Proposed adapter shape

Name: `SupertonicJarvisTtsBackend` (internal benchmark-only implementation).

Kotlin:
1. Implement `JarvisTtsBackend`; load only a verified app-private model directory.
2. Expose capabilities: `SENTENCE_CHUNKED`, native cancellation true, language hint true, voice presets F1–F5/M1–M5, supported language `ru-RU` (map explicitly to model's `ru` code).
3. Use a single-threaded worker/executor for native synthesis. Never call native inference on the UI thread.
4. On each JNI callback, convert signed little-endian PCM16 to Float32 in a bounded reusable buffer (or preferably add a direct Float32 JNI path later). Call `onPcmChunk(samples, 44100)` synchronously so AudioTrack backpressure naturally slows further synthesis.
5. If the callback returns false, call native cancel and stop forwarding all future chunks. Return a cancelled result; do not label this true model-streaming.
6. Preserve requestId/generation mapping. Reject stale chunks before conversion/playback. Ensure `unload/close` cannot free a native handle while synthesis is active; cancellation first, then join worker, then destroy native handle.
7. Use per-call voice selection with scoped restoration to avoid voice state leaking between requests.

Native:
1. Add `nativeSynthesizerSynthesizeStreaming(handle,text,language,voice,callback)` for `SynthesizerHandle`, mirroring the already-existing pipeline streaming helper.
2. Reuse `synthesize_streaming_pcm16` rather than copying its PCM conversion/callback logic. Refactor helper only if needed to return explicit outcome (completed/cancelled/callback-failed).
3. Add a per-handle active-request state / lifecycle guard so concurrent destroy cannot race an in-flight JNI call. A raw `jlong` pointer must not be freed until the Kotlin worker has completed.
4. Ensure callback exceptions trigger `tts.cancel()`, are cleared/translated consistently, and no later chunk is delivered.
5. Native cancellation must remain callable from a separate thread while the synthesis thread holds the synthesis mutex. Do not take that same mutex in cancel(), because that would block cancellation until inference finishes.
6. Check `LiteRTSupertonicTts::synthesize` callback ordering and cancellation checks in the pinned source. Confirm the native engine does not retain the callback buffer after returning; copy PCM before callback returns.
7. **Cancellation-entry race found in pinned source:** `LiteRTSupertonicTts::synthesize()` begins by executing `cancelled_.store(false)`. A cancel arriving after the Kotlin worker marks the request active but immediately before the C++ method reaches that store can be overwritten and lost. Do not rely on a Kotlin-side active flag alone. Add a native start handshake that fires only after the model has cleared the previous cancellation state, or change the model API to use per-request generation/cancellation tokens. Then test cancel both before entry and during the first graph run. A cancellation that arrives before model entry must be latched by the adapter and applied immediately after the start handshake.

PCM path:
- Supertonic native callback currently supplies Float32 samples.
- Existing Soniqo JNI converts Float32 → PCM16 little-endian bytes.
- OGAM player accepts Float32. For first prototype, convert PCM16 back to Float32 using signed little-endian decode / 32768f; record quantization as a prototype limitation. Better follow-up is a Float32 JNI array/direct-buffer callback to avoid the needless quantize/dequantize pass.
- Use 44,100 Hz; no resampling required.
- Do not allocate unbounded accumulated PCM. Per-chunk conversion must be bounded and callback-driven.

## Build and dependency blockers to resolve before coding

1. Obtain and pin the exact LiteRT runtime distribution required by Soniqo `speech-core`, including license, ABI, version and SHA-256. Do not assume `litertlm-android` provides compatible `libLiteRt.so` or CompiledModel APIs.
2. Inspect `speech-core` CMake for Android-specific link dependencies and required LiteRT headers/libs; build only `speech_core` + `speech_core_models_litert` Supertonic dependencies, not the ONNX/STT/VAD/whole Soniqo SDK.
3. Resolve NDK and CMake version compatibility with OGAM's existing native build. Soniqo currently pins NDK 29 and CMake 4.1.2; OGAM's app CMake path is 3.22.1 and root NDK setting. Do not change global NDK/CMake blindly; isolate a subproject or align after a reproducible local build.
4. Audit duplicate native libraries and libc++ packaging: LiteRT runtime, any ONNX Runtime accidentally pulled in, shared C++ runtime, 16 KB page alignment, symbols/visibility and APK size. Do not package ONNX Runtime if the TTS-only Supertonic target does not need it.
5. OGAM's minSdk 24 conflicts with Soniqo SDK minSdk 26. Prefer a direct native build with API 24-compatible code where possible; otherwise gate Supertonic backend on API 26+ and keep current/fallback TTS available on API 24–25.
6. Pin all source revisions and model asset revisions; hash every model graph, tokenizer JSON and voice style file. Model code MIT/Apache does not override the model weights' OpenRAIL-M terms.

## Tests required before an OGAM PR

### Kotlin unit tests
- PCM16 little-endian conversion: -32768, -1, 0, 1, 32767.
- Callback order, final flag, zero-length chunk and invalid sample rate.
- Stale request ID drops audio; callback false triggers native cancel exactly once.
- Native exception and model load failure are surfaced without leaving player active.
- close/unload while synthesis is running: cancel → worker completion → destroy; no use-after-free.
- No model backend owns AudioTrack, AudioFocus or microphone.

### JNI/native tests
- Direct TTS-only stream emits at least two chunks for a sufficiently long Russian test phrase.
- Final flag exactly once; chunk order and sample count match native output.
- cancel during first and later chunks stops additional callbacks promptly.
- Callback throws / Java exception path cancels and releases local JNI references.
- Voice preset is restored after success, cancellation and exception.
- Repeated load/synthesize/cancel/unload cycles do not leak handles or model memory.

### Device benchmark (OPPO Find X6 Pro, SM8550)
- Cold load and warm load time.
- TTFA = time from request accepted to first PCM callback and to first audible sample.
- RTF and total generation time; chunk count and chunk durations.
- Peak PSS/RSS, native heap, APK/model disk footprint.
- CPU utilization, thermal state/throttling, battery delta after 5/15/30 min.
- Russian quality corpus: names, numbers, dates, times, currency, addresses, abbreviations, commands, punctuation, long sentences.
- Offline airplane-mode run; no network calls during synthesis.
- Compare 5/8/12 flow steps, same voice, same corpus. Start at 8; only test 5/12 after correctness is stable.

## Go / no-go gates

- No build until LiteRT runtime/license/hash and NDK compatibility are resolved.
- No production routing until unit + native tests pass.
- No claim of model-streaming: capability is SENTENCE_CHUNKED unless the model implementation is later proven to emit incremental sub-sentence audio.
- No winner until Qwen batch baseline and at least one alternative are tested on identical device/corpus/thermal conditions.
- No PR against production feature branch until implementation is isolated, reviewable and fully test-backed; keep this document and research PR Draft.

## External reference

Official Supertonic-3 model card states local ONNX inference, 31 languages including Russian, approximately 99M parameters, MIT sample code and OpenRAIL-M weights: https://huggingface.co/Supertone/supertonic-3
