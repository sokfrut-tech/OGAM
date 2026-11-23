# Supertonic minimal C++ TTS target: source map (2026-11-23)

## Purpose

Refine the Supertonic Android prototype to avoid importing the Soniqo Android wrapper, ONNX Runtime, the aggregate speech-core LiteRT model target, and optional C ABI synthesis post-processing when OGAM only needs mono Float32 PCM chunks.

This is a source-level dependency map. It is not a compiled target or tested Android integration.

Pinned source:
- `soniqo/speech-core` `59b9d7902ea62dbbbfb95e139e2bf0e8957f8753`
- `soniqo/speech-android` `66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded`

## Key simplification: use the C++ class directly

The direct class is `speech_core::LiteRTSupertonicTts`, declared in:
- `include/speech_core/models/litert_supertonic_tts.h`

It derives from `speech_core::TTSInterface` and exposes:
- `synthesize(text, language, TTSChunkCallback)`
- `set_voice()`
- `set_total_step()` (5 / 8 / 12)
- `set_speed()`
- `set_seed()`
- `voices()`
- `output_sample_rate()` (44,100 Hz)
- `cancel()`

Its callback already supplies mono Float32 samples, length and final-chunk flag. This matches OGAM's `JarvisTtsBackend` PCM contract more closely than the Soniqo Kotlin wrapper's batch `SpeechSynthesisResult`.

Using this class directly avoids:
- `src/models/litert/supertonic_c.cpp` C ABI handle wrapper;
- `src/models/litert/tts_c_options.h` option conversion;
- the `TTSInterface::synthesize_with_options()` path and its `src/tts_synthesis_options.cpp` postprocessing implementation;
- the wrapper's forced ONNX Runtime requirement and Soniqo Kotlin audio pipeline.

The class still inherits `TTSInterface`; the interface header is needed, but direct invocation of its virtual `synthesize()` does not require calling the base `synthesize_with_options()` helper.

## Candidate source list for a minimal target

Required implementation sources identified by include/call graph:
1. `src/models/litert/litert_supertonic_tts.cpp`
2. `src/models/litert/supertonic_tokenizer.cpp`
3. `src/util/text_chunker.cpp`

Required headers:
- `include/speech_core/models/litert_supertonic_tts.h`
- `include/speech_core/models/litert_engine.h`
- `include/speech_core/models/supertonic_tokenizer.h`
- `include/speech_core/interfaces.h`
- `include/speech_core/tts_synthesis_options.h` (pulled by interfaces header; declarations only)
- `include/speech_core/util/json.h`
- `include/speech_core/util/text_chunker.h`
- vendored `third_party/litert/litert/c/*` C headers.

External link dependencies:
- Google's matching `libLiteRt.so` for `arm64-v8a`.
- `utf8proc` (Supertonic tokenizer NFKD).
- Android `log` library (LiteRT engine logging).
- C++ standard library / Android NDK runtime.

No evidence in this source inspection requires ONNX Runtime, libcurl, VAD, ASR, Kokoro, VoxCPM2, Chatterbox, Nemotron, or the Soniqo Kotlin audio module for this direct class.

Potential build-system caveat:
- `utf8proc` can be found with `find_package(utf8proc)` or fetched by the upstream CMake. For a reproducible production build, pin its exact commit/release and SHA-256 rather than fetching an unpinned default branch.
- The source list is a candidate based on includes and call sites; only a real Android compile+link proves there are no hidden transitive symbols or platform-specific issues.

## Why not build speech_core_models_litert wholesale?

The upstream aggregate `speech_core_models_litert` includes unrelated VAD, Parakeet, VoxCPM2, Chatterbox, WeSpeaker, Pyannote, Omnilingual, Nemotron and Indic-Mio source files. It links LiteRT and utf8proc and can be built without ONNX Runtime, but it is not TTS-only and adds unnecessary compilation surface.

The direct class target should instead be a separate static/shared target such as `ogam_supertonic_tts`, with only the three implementation files above plus the pinned dependencies. The target name is a proposal, not an existing target.

## JNI adapter boundary

A small OGAM-owned JNI layer should:
- own one `LiteRTSupertonicTts` instance per model session;
- expose explicit create / synthesize-start / cancel / destroy operations;
- forward each Float32 chunk synchronously into a bounded JNI callback;
- copy or consume samples before native callback returns; never retain the temporary pointer;
- use a per-request generation ID and native start handshake;
- prevent destroy while synthesis is active;
- avoid holding a mutex across a blocking LiteRT graph run if cancellation needs that mutex;
- preserve one physical mic owner (OGAM AudioRecorderService) and never create AudioRecord/AudioTrack inside this TTS adapter.

The known cancellation race remains: `LiteRTSupertonicTts::synthesize()` resets `cancelled_` at method entry. A cancel before that reset can be lost. The native start handshake/generation fix is mandatory before claiming reliable cancellation.

## Test gates

### Build gate
- Build a standalone Android arm64 CMake harness outside the production app.
- Use OGAM's C++17, NDK r27.1.12297006 and CMake 3.22.1 baseline.
- First reproduce with LiteRT 2.1.5 (the pinned upstream fetch-script default).
- Then compare LiteRT 2.3.2 only after obtaining and hashing the exact AAR/runtime binary and matching headers.
- Confirm final link has no `libonnxruntime.so`, no unrelated model libraries, and exactly one LiteRT runtime copy.
- Inspect APK/AAB native library packaging and dependency loading.

### Functional gate
- tokenizer unit tests for Russian Unicode, punctuation, numbers and chunk boundaries;
- deterministic seeded synthesis test and callback ordering/final flag;
- PCM sample-rate / channel / length validation;
- callback backpressure and bounded memory;
- cancel before entry, immediately after start handshake, during graph run and between chunks;
- repeated create / synthesize / cancel / destroy with no use-after-free;
- no network access after verified model assets are installed.

### Device gate
On OPPO Find X6 Pro (SM8550):
- cold/warm model load;
- time to first audio chunk;
- real-time factor and total duration;
- 5/8/12 ODE-step quality/latency tradeoff;
- PSS/RSS peak, CPU, temperature, battery;
- offline mode;
- intelligibility and pronunciation on the Russian corpus.

## Status

- Direct C++ API and source dependencies inspected: **yes**.
- Minimal source list identified: **yes, candidate only**.
- Standalone Android target compiled and linked: **no**.
- LiteRT runtime binary SHA-256 pinned: **no**.
- Cancellation race fixed: **no**.
- OGAM application code changed: **no**.
- APK built / OPPO device tested: **no**.

Next step: prepare a throwaway arm64 build harness and compile the candidate target first against the upstream-pinned LiteRT 2.1.5 runtime. Do not wire it into the OGAM application until this harness links and cancellation semantics are corrected.
