# OGAM / Jarvis — Qwen3-TTS Android Integration and Build-Isolation Plan
Date: 2026-11-22
Target: OPPO Find X6 Pro PGEM10 / Snapdragon 8 Gen 2 (SM8550) / ColorOS 16.0.5 / Android 16
Status: source-level integration plan only. No code, build files, dependencies, model catalogue or APK changed.

## Executive recommendation

Qwen3-TTS 0.6B Q4_K_M is the strongest near-term Russian TTS prototype candidate. The Apache-2.0 model family supports Russian; an MIT Kotlin/JNI Android reference exists; the pinned C++ runtime already implements PCM chunk streaming and callback cancellation. The Android Kotlin wrapper does not expose that native stream method. OGAM already has a model-neutral TTS contract and PCM playback owner.

Keep this benchmark-only. Do not change the production voice path until native packaging, model loading, Russian quality, latency, RAM, thermals and battery are measured on PGEM10.

## 1. Exact OGAM native build baseline

Inspected PR #1 branch \`feature/jarvis-step-2-storage-privacy\`:
- \`android/app/src/main/cpp/CMakeLists.txt\` SHA \`88504efc1658737baed2b17b9275c587ffa866c3\`
- \`android/app/build.gradle\` SHA \`9d6ffadb557794c5533567054be7d5c61a993ef6\`
- \`android/build.gradle\` SHA \`ac9050e4f00209dfdfcf68d0a52bc2ca501a4909\`
- \`scripts/prepare-video-runtime.sh\` and \`scripts/video/revision\`.

Current build baseline:
- NDK \`27.1.12297006\`, CMake \`3.22.1\`, C++17.
- minSdk 24, target/compileSdk 36.
- App CMake builds \`offgrid_video\` and links \`stable-diffusion.cpp\`.
- Stable Diffusion source revision: \`5dcfa79801213f23e27b3e83617350ebb8ea93aa\`.
- Its GGML submodule pin: \`eeda9ec48fc84a3df0bb9dcc19ae9053075a2539\` (2026-11-14 merge on the SD fork).
- Existing build config enables Vulkan/Hexagon and enables OpenCL for arm64 where available.

## 2. Qwen Android reference build baseline

Inspected:
- Android app tree commit \`35738304b31c425cc08fb5405372fedfd6531b3b\`.
- Android app CMake blob \`eda0ed2849a917f03663ed6e31373b101e3585fd\`.
- Kotlin engine blob \`2a931bcb8585b49f9b51a83279d554fd1d8b7126\`.
- \`external/qwen3-tts.cpp\` submodule pin \`4562731dc612cb87b4cd1eedac275a17d1078773\`.
- The C++ repo pins GGML to \`eced84c86f8b012c752c016f7fe789adea168e1e\` (2026-06-26, GGML 0.15.3).

Reference Android config:
- API 31+, arm64-v8a only, CMake 3.22, C++17, shared Android STL.
- CPU baseline: Qwen OpenMP, Vulkan and OpenCL options default OFF.
- Qwen's desktop/root CMakeLists sets \`-march=native\` in Release, but the Android app does not use that root CMakeLists; it uses a dedicated Android CMake file that explicitly defines the targets. Do not blindly include the desktop root project in OGAM.

## 3. Confirmed GGML/CMake collision risk

OGAM's app CMake adds Stable Diffusion as a child project. Stable Diffusion's \`cmake/ggml.cmake\` adds its GGML source when target \`ggml\`/ \`ggml::ggml\` is not already present, creating targets such as \`ggml\`, \`ggml-base\` and \`ggml-cpu\`.

The Qwen Android CMakeLists independently and unconditionally runs:
\`add_subdirectory("\${GGML_DIR}" "\${CMAKE_CURRENT_BINARY_DIR}/ggml")\`
and links its libraries to \`ggml\`, \`ggml-base\` and \`ggml-cpu\`.

The two pinned GGML revisions are different:
- OGAM video: \`eeda9ec48fc84a3df0bb9dcc19ae9053075a2539\` (2026-11-14).
- Qwen TTS: \`eced84c86f8b012c752c016f7fe789adea168e1e\` (2026-06-26).

**Do not paste the Qwen Android CMakeLists into OGAM's existing app CMake.** It risks duplicate CMake target definitions and a mismatched GGML API. Sharing OGAM's newer GGML is also unproven and may cause source/API incompatibilities. Neither approach has been compiled here.

## 4. Safer prototype integration options

### Option A — isolated Android library module (preferred)

Create a separate Android library module, e.g. \`:jarvis-qwen3tts\`, with its own:
- \`externalNativeBuild.cmake\` project scope and Qwen-specific pinned source tree;
- Qwen JNI shared library \`libqwen3_tts_jni.so\`;
- small Kotlin facade for load, streaming synthesis, cancel, unload and result/error metrics;
- no AudioTrack/AudioFocus owner.

This avoids inserting a second GGML subproject into OGAM's existing video CMake scope. Before packaging both libraries into the same APK, verify:
- only one compatible \`libc++_shared.so\` is packaged;
- Qwen internal GGML symbols are hidden/non-interposing;
- ELF dependencies and exported symbols do not collide with \`liboffgrid_video.so\` or llama.rn native libraries;
- arm64 native loading succeeds on a clean PGEM10 install.

The TTS module should feed the existing \`JarvisPcmStreamPlayer\`. If Gradle visibility prevents reuse of the current internal player, first design a shared voice-core Android library; do not create a second production AudioTrack owner.

### Option B — separate native build and imported shared library

Build Qwen JNI in a separate NDK/CMake configure step and package the resulting \`.so\` under generated \`jniLibs/arm64-v8a\`. This avoids CMake target collisions but increases build orchestration and native artifact provenance work. Keep the Qwen GGML implementation isolated and hide internal symbols.

### Option C — share OGAM GGML

Do not choose this unless a controlled build proves Qwen compiles and passes smoke/inference tests against the exact Stable Diffusion GGML pin \`eeda9ec...\`. Verify model load, tokenizer, audio encoder, decoder/vocoder correctness and numerical output. A compile alone is insufficient.

No option should change the production voice path before the benchmark is complete.

## 5. Kotlin/JNI backend contract

Reuse OGAM's existing abstractions:
- \`JarvisTtsBackend\`: model inference and cancellation contract.
- \`JarvisPcmStreamPlayer\`: sole Android AudioTrack/AudioFocus owner.

Recommended adapter flow:
1. Load the verified Q4_K_M talker + matching tokenizer bundle from app-private storage. Verify lengths and SHA-256 before native load.
2. Set Qwen params explicitly: Russian \`languageId = 2069\` (reference default is 2050 English), bounded max-audio-token limit, bounded CPU thread count, validated voice/instruction parameters.
3. Expose the existing JNI \`nativeSynthesizeStreaming\` function through Kotlin. Its native code already forwards PCM chunks, sample rate and text alignment to a Kotlin callback and maps callback false to native cancellation.
4. Invoke native synthesis on a dedicated worker thread. JNI callback is synchronous during the native method; consume/copy callback FloatArray data in order. Do not retain native pointers or JNI references asynchronously.
5. Use \`collect_audio=false\` to avoid accumulating the full final waveform. Acoustic-code frames and model memory still remain resident.
6. Validate sample rate, chunk order, monotonic sample offsets and chunk lengths before forwarding to \`JarvisPcmStreamPlayer.write(generationId, samples)\`.
7. On user cancellation, stale generation or player refusal, return false from callback. Report whether native inference actually stopped.
8. Do not return a second complete FloatArray when \`collect_audio=false\`; callback chunks are the audio transport.
9. Release native contexts/model mappings on unload. Do not keep the large TTS model resident alongside ASR/LLM unless memory testing proves safe.

## 6. Model/runtime constraints

Reference Q4_K_M pair:
- \`qwen-talker-0.6b-base-Q4_K_M.gguf\`: 628,905,056 bytes.
- \`qwen-tokenizer-12hz-Q4_K_M.gguf\`: 254,974,752 bytes.
- Combined approximately 884 MB decimal, before temporary files and caches.

Use the matching compatible model pair and record exact source, revision, model/tokenizer hash and license. Do not commit weights.

CPU-only is the first baseline. Optional Vulkan/OpenCL are separate experiments. No QNN/Hexagon backend was found in the pinned Qwen Android CMake. OGAM's QNN/Hexagon assets do not automatically accelerate GGML Qwen TTS.

## 7. Prototype acceptance gates

### Build and packaging
- ARM64 debug JNI library compiles with pinned NDK 27.1.12297006 and CMake 3.22.1.
- Qwen JNI and OGAM video/llama.rn libraries package and load together with no duplicate-symbol or STL conflicts.
- JNI method names/signatures match Kotlin declarations; load failures produce a visible error state, not a crash.
- Retain OGAM minSdk 24; verify Qwen native code does not call unavailable platform APIs before claiming compatibility.

### Streaming correctness
- First PCM callback occurs before complete synthesis finishes.
- Sample rate is valid and consistent.
- Chunk ordering/offsets are monotonic; gaps or overlap are detected.
- No full output waveform is accumulated when collect_audio=false.
- Callback false stops generation.
- No stale audio plays after cancellation.
- Existing PCM player remains the only AudioTrack/AudioFocus owner.

### PGEM10 measurements
Use \`JARVIS_RUSSIAN_AUDIO_EVALUATION_CORPUS_V1_2026-11-22.md\`:
- cold/warm model load;
- first PCM chunk latency (TTFA);
- total generation time, output duration and RTF;
- peak Java + native RSS;
- CPU thread count/utilization and backend;
- battery delta, temperature and thermal throttling;
- Russian stress, names, numbers, abbreviations, long answers and intelligibility;
- three cold and five warm runs initially; report median and p95.

Do not call the voice real-time until TTFA/RTF and memory pass under sustained thermal load, not one short sentence.

## 8. Not performed

No JNI wrapper changed; no CMake/Gradle file modified; no model weights downloaded; no external source copied; no Android build/APK produced; no PGEM10 test run; no production voice backend selected.

## Source pins
OGAM:
- CMake \`88504efc1658737baed2b17b9275c587ffa866c3\`.
- NDK/build baseline \`android/build.gradle\` SHA \`ac9050e4f00209dfdfcf68d0a52bc2ca501a4909\`.
- Stable Diffusion revision \`5dcfa79801213f23e27b3e83617350ebb8ea93aa\`.
- Stable Diffusion GGML \`eeda9ec48fc84a3df0bb9dcc19ae9053075a2539\`.

Qwen:
- Android app \`35738304b31c425cc08fb5405372fedfd6531b3b\`.
- Android app CMake blob \`eda0ed2849a917f03663ed6e31373b101e3585fd\`.
- Kotlin QwenEngine blob \`2a931bcb8585b49f9b51a83279d554fd1d8b7126\`.
- qwen3-tts.cpp \`4562731dc612cb87b4cd1eedac275a17d1078773\`.
- Qwen GGML \`eced84c86f8b012c752c016f7fe789adea168e1e\`.
- Model card: https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF

This is an evidence-based integration plan, not an implementation. The preferred first step is an isolated Kotlin/JNI benchmark module, not a production merge.
