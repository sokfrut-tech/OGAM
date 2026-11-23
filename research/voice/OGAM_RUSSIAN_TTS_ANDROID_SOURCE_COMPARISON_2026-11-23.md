# OGAM Russian TTS Android source comparison — 2026-11-23

## Scope and evidence rules

Read-only source audit of Qwen3-TTS Android, official Qwen3-TTS, Soniqo speech-android / speech-core, Supertonic-3, CosyVoice3, VoxCPM2 and the Soniqo Indic-Mio path. This is not a model-quality benchmark and does not claim OPPO PGEM10 runtime validation.

Inspected source revisions:
- `Danmoreng/qwen3-tts-android`: `35738304b31c425cc08fb5405372fedfd6531b3b`
- `QwenLM/Qwen3-TTS`: official source repository; Apache-2.0 LICENSE inspected.
- `soniqo/speech-android`: `66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded`
- `soniqo/speech-core`: `59b9d7902ea62dbbbfb95e139e2bf0e8957f8753`

## Findings

### 1. Supertonic-3 via Soniqo — strongest first Android benchmark candidate, not yet selected

Confirmed from source:
- The Android SDK has a `TtsModel.SUPERTONIC` LiteRT backend and a TTS-only `SpeechSynthesizer` API.
- Model implementation: `LiteRTSupertonicTts`, 99M parameters, 44.1 kHz output, 31 languages including Russian, G2P-free Unicode tokenizer.
- It is non-autoregressive flow matching, not token-by-token autoregressive speech generation: duration predictor + text encoder + vector-estimator ODE loop + vocoder. Default eight flow steps.
- Published base graph uses fixed text window T=128 and latent window L=64 (~4.5 s). The C++ host splits text at sentence/clause/word boundaries only when predicted audio exceeds the window; generated pieces are passed through `TTSChunkCallback`.
- The TTS core exposes thread-safe `cancel()`. The Android JNI bridge converts each Float32 callback chunk to PCM16 and delivers it through a Kotlin callback.
- The Android SDK's direct TTS-only `SpeechSynthesizer.synthesize()` returns one complete PCM16 buffer. Its streaming method is on `SpeechPipeline.synthesizeStreaming()`, not on the TTS-only synthesizer. The pipeline constructor also creates the STT/VAD pipeline, which is an unnecessary weight/runtime dependency for Jarvis TTS alone.
- Therefore, the practical integration seam is a narrow TTS-only streaming API/JNI wrapper around the existing Supertonic backend, not adoption of the whole third-party pipeline.
- The chunk callback is **sentence/clause chunked synthesis**, not true autoregressive/model-streaming. It can start playback after the first completed piece, while later pieces are still being synthesized.
- Existing Soniqo Android README reports ~380 MB download, ~832 MB peak RAM and a separate S23 Ultra CPU measurement around 0.34 RTF / ~1.1 s TTFA. These are upstream-reported measurements on another phone, not PGEM10 results.
- Source-level acceleration options and the SDK's LiteRT path do not prove Snapdragon HTP/NPU execution. The existing Supertonic class defaults `hw_accel=false`; any NPU claim requires provider logs and device measurements.

License:
- Soniqo Android and speech-core source repositories are Apache-2.0.
- Supertonic-3 weights are OpenRAIL-M. Use-based restrictions and redistribution obligations must be carried through; this is not an unrestricted Apache/MIT model license.
- Runtime/delegate and any separately packaged model conversion artifacts require their own pinned notices and hashes.

OGAM adapter requirements:
1. Keep JarvisTtsBackend as the model-only boundary; no AudioRecord, AudioTrack, AudioFocus or turn ownership in the engine.
2. Convert Soniqo PCM16 callback chunks back to normalized Float32 (or add a direct Float32 JNI callback) and pass sample rate 44,100 Hz to the existing player.
3. Preserve ordering and generation IDs; discard late chunks after cancellation.
4. Invoke native synthesis off the main thread. The Kotlin streaming call is blocking.
5. Test cancellation while the first and later chunks are being produced; test callback exception, model load failure, process teardown and queue bounds.
6. Measure cold/warm TTFA, RTF, RSS, sustained temperature, battery and Russian pronunciation on PGEM10.

### 2. Qwen3-TTS Android — valuable quality/voice-design challenger, current Android wrapper is batch

Confirmed from source:
- Official Qwen3-TTS lists Russian among ten languages and provides voice design, custom voice and cloning. The official repository license is Apache-2.0.
- The inspected Android app is MIT-licensed, arm64-v8a only, minSdk 31 / Android 12+, C++17 / GGML / qwen3-tts.cpp.
- Its bundled path uses 0.6B Base Q4_K_M talker plus 12Hz Q4_K_M tokenizer GGUF assets downloaded from a third-party Hugging Face repository. The actual asset revision, hashes and individual model/voice licensing still need pinning before distribution.
- Kotlin `QwenEngine.synthesize()` calls a synchronous JNI `nativeSynthesize()` and returns a full `FloatArray`. Its progress callback reports generated token counts, not PCM chunks. The Kotlin API does not expose audio streaming or a cancellation method.
- CMake defaults OpenMP, Vulkan and OpenCL OFF. Optional Vulkan/OpenCL build flags exist, but there is no demonstrated Snapdragon Hexagon/HTP NPU path.
- This specific Android port therefore does not implement streaming playback despite the official model family's streaming capability. Do not label the current Android wrapper model-streaming.

Recommendation:
- Keep Qwen as a second benchmark candidate for naturalness, Russian pronunciation, voice cloning and voice design.
- Before considering it for Jarvis, pin model artifacts and their licenses, inspect the qwen3-tts.cpp native implementation, and expose a bounded PCM callback + cancellation path in a separate benchmark-only wrapper. Do not merge this into the production voice path yet.

### 3. CosyVoice3 — Chinese-origin multilingual challenger; source exists, Android API wiring and Russian quality remain gaps

Confirmed:
- Official FunAudioLLM CosyVoice3 0.5B model card lists Russian among nine languages, multilingual/cross-lingual cloning and bi-streaming; model card declares Apache-2.0.
- Soniqo speech-core contains a C++ ONNX Runtime `OnnxCosyVoice3Tts` implementation with a chunk callback and cancellation. The ONNX model target's CMake source list includes this implementation, including in Android builds when the ONNX target is enabled.
- The Android Kotlin SDK's `TtsModel` enum and public `SpeechSynthesizer` factory do not expose CosyVoice3. The in-repo CosyVoice CLI is desktop-only. So this is not a ready-to-use Android TTS option; a dedicated JNI/model-manager path is needed.
- CosyVoice3's zero-shot cloning requires precomputed conditioning tensors (prompt text IDs, speech tokens, mel features and speaker embedding). The C++ wrapper exposes these explicitly; a complete Android voice-profile pipeline is not demonstrated.
- A Russian speech-benchmark project records a third-party report of Chinese-sounding Russian output, but no reproduced Russian test result. Treat pronunciation quality as unproven, not as a confirmed defect or a confirmed success.

Recommendation:
- Retain as a future source-level challenger after Supertonic/Qwen. First reproduce Russian intelligibility and pronunciation on desktop with a fixed corpus, then estimate Android model footprint and only then implement an Android adapter.

### 4. VoxCPM2 — Russian-capable, but too large to lead the first OPPO test

- Official OpenBMB model card lists 30 languages including Russian and Apache-2.0; supports voice design, cloning and streaming claims.
- Soniqo speech-core contains ONNX and LiteRT C++ wrappers, but the current Android Kotlin TTS enum does not expose VoxCPM2. Desktop ONNX CLI is not an Android proof.
- Another on-device integration publishes GGUF sizes around 956 MB for the Q4 BaseLM plus ~1.74 GB acoustic model (about 2.7 GB total before runtime memory). This is a substantial storage/RAM risk for the first Jarvis voice milestone.
- Keep as a later high-quality challenger only if the 0.6B/99M candidates fail quality gates and memory measurements permit it.

### 5. Indian TTS research

The inspected Soniqo speech-core also contains an Indic-Mio LiteRT TTS implementation. It is relevant to Hindi and supported Indic-language coverage, but it is not a Russian voice candidate. Do not select it for Jarvis's primary Russian speech path merely because it is an advanced Indian model. Keep it as a future multilingual extension only after exact language and voice-pack licensing are checked.

## Comparative decision matrix

| Candidate | Russian evidence | Android source status | Output behavior | Size / memory evidence | License status | Current disposition |
|---|---|---|---|---|---|---|
| Supertonic-3 / Soniqo | Explicit ru among 31 | TTS model exists; TTS-only API is batch; streaming requires pipeline or narrow JNI addition | Non-AR sentence/clause chunks; cancellable | ~380 MB / ~832 MB upstream; other-phone result only | OpenRAIL-M weights; Apache-2.0 code | **First PGEM10 benchmark candidate** |
| Qwen3-TTS 0.6B Q4 | Official ru; model family reports strong multilingual generation | Third-party Android arm64 app, API 31+, GGUF/JNI | Current Kotlin wrapper returns whole FloatArray; token progress only | Exact packaged artifact sizes and peak RSS not independently pinned | Official repo Apache-2.0; third-party GGUF asset provenance still to pin | **Second quality/voice-design challenger** |
| CosyVoice3 0.5B | Official ru; third-party report raises pronunciation question | C++ ONNX implementation exists; no Android Kotlin model selection/API | Native chunk callback; conditioning required for zero-shot cloning | Android RSS/latency unknown | Model card Apache-2.0; verify complete dependency/data provenance | **Research challenger; quality first** |
| VoxCPM2 2B | Official 30 languages incl. ru | C++ ONNX/LiteRT source; no Android Kotlin API | Streaming claim; mobile path not proven | ~2.7 GB GGUF files before runtime | Apache-2.0 model card | **Defer; footprint risk** |
| Indic-Mio | Indic languages, not Russian target | LiteRT C++ implementation in speech-core; no Jarvis need yet | Backend-specific | Not assessed here | Verify model pack | **Not primary Russian candidate** |
| Piper/sherpa-onnx Russian voice | Russian voice catalog exists; per-voice provenance varies | Mature Android runtime route | Usually utterance/batch waveform; verify selected voice callback | Smaller voice packs possible; per-model exact values needed | Per-voice model license; runtime/code separate | **Fallback baseline, not winner** |

## Recommended next execution step

Create a benchmark-only, TTS-only Supertonic adapter against the existing JarvisTtsBackend / JarvisPcmStreamPlayer contract. Do not use the full Soniqo SpeechPipeline just to obtain streaming because it also instantiates VAD/STT. Keep Qwen as a batch baseline until its JNI audio callback/cancellation are implemented in an isolated harness. Add CosyVoice3 only after a Russian corpus result justifies its Android porting cost.

Required shared Russian corpus: short commands, conversational sentences, names/brands, addresses, dates, times, decimals, currency, abbreviations, punctuation and long paragraphs. Report WER from an independent Russian ASR as a diagnostic only (not as a substitute for human listening), pronunciation errors, naturalness, TTFA, RTF, peak RSS, thermal throttling and battery drain. Use identical text, voice style, playback rate and device thermal state.

## Source references

- https://github.com/Danmoreng/qwen3-tts-android/tree/35738304b31c425cc08fb5405372fedfd6531b3b
- https://github.com/QwenLM/Qwen3-TTS
- https://github.com/soniqo/speech-android/tree/66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded
- https://github.com/soniqo/speech-core/tree/59b9d7902ea62dbbbfb95e139e2bf0e8957f8753
- https://huggingface.co/Supertone/supertonic-3
- https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512
- https://huggingface.co/openbmb/VoxCPM2
- https://github.com/meshокlv/ru-speech-bench
