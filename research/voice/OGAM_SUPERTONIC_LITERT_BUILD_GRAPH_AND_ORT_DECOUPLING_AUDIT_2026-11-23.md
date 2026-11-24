# Supertonic LiteRT build graph and ONNX Runtime decoupling audit (2026-11-23)

## Scope and pinned upstream source

This is a source/CMake audit, not a build or device test.

- `soniqo/speech-core` commit: `59b9d7902ea62dbbbfb95e139e2bf0e8957f8753`
- `soniqo/speech-android` commit: `66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded`
- OGAM research branch at audit start: `89dc9c84ca719a2b5c4ad04e42c1cd2d933e9bfc`
- PR #2 remains open, Draft and unmerged.

Pinned upstream source files inspected:
- `speech-core/CMakeLists.txt`
- `speech-core/scripts/fetch_litert.sh`
- `speech-core/include/speech_core/models/litert_engine.h`
- `speech-core/include/speech_core/models/litert_supertonic_tts.h`
- `speech-core/include/speech_core/supertonic_c.h`
- `speech-core/src/models/litert/litert_supertonic_tts.cpp`
- `speech-core/src/models/litert/supertonic_c.cpp`
- `speech-core/src/models/litert/supertonic_tokenizer.cpp`
- `speech-android/sdk/build.gradle.kts`
- `speech-android/sdk/src/main/cpp/CMakeLists.txt`

## Important correction: ORT is required by the Soniqo Android wrapper, not by the Supertonic LiteRT target itself

The earlier broad statement that speech-core unconditionally requires `ORT_DIR` was too broad and is corrected here.

Evidence from the pinned source:
1. In `speech-core/CMakeLists.txt`, `SPEECH_CORE_WITH_ONNX` defaults to `OFF`.
2. The `ORT_DIR` fatal check and imported `onnxruntime` library are inside `if(SPEECH_CORE_WITH_ONNX)`.
3. `SPEECH_CORE_WITH_LITERT` is a separate option and has its own `LITERT_DIR` requirement.
4. The Supertonic implementation is compiled in `speech_core_models_litert` from `litert_supertonic_tts.cpp`, `supertonic_tokenizer.cpp` and `supertonic_c.cpp`.
5. The LiteRT target links `speech_core`, imported `litert` and `utf8proc`; its CMake block does not link `onnxruntime`.

However, the Soniqo Android wrapper's own `sdk/src/main/cpp/CMakeLists.txt` explicitly:
- fails configuration if `ORT_DIR` is absent;
- forces `SPEECH_CORE_WITH_ONNX=ON`;
- then adds speech-core as a subdirectory.

Its Gradle module passes `-DORT_DIR=...` unconditionally. Therefore copying the Soniqo Android SDK build verbatim does pull ONNX Runtime and the ONNX model target even when the immediate feature being evaluated is Supertonic. This is a wrapper/build-graph decision, not a dependency intrinsic to Supertonic's LiteRT implementation.

## Feasible build isolation

A direct OGAM native integration can avoid ONNX Runtime by not importing the Soniqo Android SDK wrapper and configuring speech-core with:
- `SPEECH_CORE_WITH_ONNX=OFF`
- `SPEECH_CORE_WITH_LITERT=ON`
- `SPEECH_CORE_BUILD_TESTS=OFF`
- `SPEECH_CORE_BUILD_EXAMPLES=OFF`
- `LITERT_DIR` pointing to the matching Android arm64 runtime library.

This would avoid the `ORT_DIR` check and ONNX model target. It is not yet a minimal Supertonic-only build: the current speech-core LiteRT target is one aggregate library containing VAD, Parakeet, VoxCPM2, Chatterbox, Supertonic, WeSpeaker, Pyannote, Omnilingual and Nemotron sources. A strict TTS-only binary should instead define a small OGAM-owned CMake target around the Supertonic source files and only their actual transitive dependencies. Before doing that, confirm all symbols and header-only/source dependencies with a real link build.

Likely direct source seam:
- `src/models/litert/litert_supertonic_tts.cpp`
- `src/models/litert/supertonic_tokenizer.cpp`
- `src/models/litert/supertonic_c.cpp`
- `include/speech_core/models/litert_supertonic_tts.h`
- `include/speech_core/models/litert_engine.h`
- `include/speech_core/models/supertonic_tokenizer.h`
- `include/speech_core/supertonic_c.h`
- the relevant public TTS interfaces/utilities from speech-core
- utf8proc (MIT) for Unicode NFKD
- LiteRT C headers/runtime and Android log library.

Do not vendor the entire speech-core library into OGAM without a dependency review. Do not include ONNX Runtime, VAD, ASR or Soniqo's Kotlin mic/audio pipeline in the first TTS-only prototype.

## LiteRT runtime pin and compatibility status

The pinned speech-core bootstrap script `scripts/fetch_litert.sh` defaults to `ai-edge-litert==2.1.5`. Its LiteRT engine comments specifically describe behavior/workarounds against LiteRT v2.1.x / v2.1.5. The source's vendored `third_party/litert` C headers are committed in the same speech-core revision; the repo does not expose a clear generated runtime-version macro in the inspected header surface.

Google's current Android documentation lists LiteRT 2.3.2 as latest (published 2026-10-26), with API 24 and NDK r26a baseline. Its quickstart code snippet still shows Maven 2.3.0, so do not blindly treat the quickstart coordinate as the latest patch. Maven version listings show `com.google.ai.edge.litert:litert:2.3.2` is published, but this audit has not downloaded the AAR, extracted its `libLiteRt.so`, compared exported symbols, or compiled speech-core against it.

Sources:
- Google Android version matrix and quickstart: https://developers.google.com/edge/litert/android
- Google LiteRT release v2.3.2: https://github.com/google-ai-edge/LiteRT/releases/tag/v2.3.2
- Google Android prebuilt C++ SDK guide: https://developers.google.com/edge/litert/next/cpp_sdk
- Google Maven artifact/version listing: https://mvnrepository.com/artifact/com.google.ai.edge.litert/litert/versions
- Soniqo runtime fetch script: https://github.com/soniqo/speech-core/blob/59b9d7902ea62dbbbfb95e139e2bf0e8957f8753/scripts/fetch_litert.sh

Runtime decision:
- **Known source baseline:** Soniqo speech-core fetch script defaults to LiteRT 2.1.5.
- **Current Google candidate:** LiteRT 2.3.2 is published and meets OGAM's documented API/NDK floor.
- **Not proven:** binary/API compatibility of this pinned Soniqo source with LiteRT 2.3.2.
- **No hash recorded:** no AAR or runtime binary was downloaded, so no SHA-256 is claimed.
- **No NPU claim:** first prototype remains CPU-only until provider selection and device logs prove an accelerator path.

## Source-level integration constraints retained

- Supertonic class uses LiteRT C API and four model graph groups; its own source resets `cancelled_` at the start of `synthesize()`. The previously documented pre-entry cancellation race remains a release blocker.
- Supertonic tokenizer uses utf8proc for NFKD and text chunking/JSON helpers from speech-core.
- Native C ABI already exposes chunk callbacks and `sc_supertonic_cancel()`; this is a better integration seam than importing the full Kotlin SDK. Its raw handle still needs an OGAM-side lifecycle guard so destroy cannot race active synthesis.
- Soniqo wrapper's minSdk 26 / NDK r29 / CMake 4.1.2 are not requirements of the speech-core Supertonic target itself. OGAM can attempt its own CMake 3.22.1 / NDK r27.1 build after dependency isolation and runtime pinning.

## Next verification sequence

1. Create a temporary, isolated Android arm64 build harness (not the production OGAM app) that configures speech-core with ONNX OFF and LiteRT ON.
2. First compile against the upstream default 2.1.5 runtime to reproduce the source's declared baseline.
3. Then compile the same pinned sources against Google LiteRT 2.3.2; capture compiler/linker output, ABI symbols and APK native packaging.
4. If the aggregate target is too broad, create a minimal TTS-only target and prove all transitive symbols are resolved without ORT or unrelated model sources.
5. Fix cancellation start handshake/generation semantics before enabling cancellation in the Kotlin adapter.
6. Add JNI streaming callback and native/Kotlin lifecycle tests; then build arm64 APK.
7. Only after these gates, benchmark on OPPO Find X6 Pro (SM8550): TTFA, RTF, memory, CPU, thermals, battery, Russian intelligibility and offline behavior.

## Explicit status

- Source/CMake graph inspected at pinned commits: **yes**.
- ORT decoupling path identified: **yes, source-level only**.
- Minimal Supertonic-only target proven to link: **no**.
- LiteRT 2.3.2 AAR downloaded/hash-pinned: **no**.
- speech-core built against LiteRT 2.1.5 or 2.3.2 in this audit: **no**.
- OGAM application code/build files changed: **no**.
- APK/device test: **no**.
