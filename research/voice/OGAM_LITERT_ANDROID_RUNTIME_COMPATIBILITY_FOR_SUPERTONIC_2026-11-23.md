# LiteRT Android runtime compatibility for Supertonic / OGAM (2026-11-23)

## New official documentation finding

Google's current LiteRT Android documentation lists LiteRT v2.3.2 (released 2026-10-26) with the CompiledModel API and minimum Android SDK 24; the stated minimum NDK for native use is r26a. The Android installation example uses Maven artifact com.google.ai.edge.litert:litert:2.3.0 (the docs table separately identifies 2.3.2 as latest). Google also documents a C++ prebuilt SDK route: obtain the LiteRT C++ SDK headers/CMake package and the matching libLiteRt.so from the Android AAR.

Sources: https://developers.google.com/edge/litert/android and https://developers.google.com/edge/litert/overview

## OGAM compatibility re-check

Verified from OGAM feature branch feature/jarvis-step-2-storage-privacy, android/build.gradle:
- minSdkVersion = 24.
- ndkVersion = 27.1.12297006.
- App CMake path uses CMake 3.22.1.
- OGAM already has LiteRT-LM 0.19.1, but that does not itself prove the standalone LiteRT CompiledModel C++ runtime is linked.

These OGAM values meet the documented LiteRT v2.3.2 baseline (API 24, NDK r26a+, CMake 3.19+ as stated in the current overview). Therefore **LiteRT itself is not a minSdk blocker for OGAM**. The earlier implementation brief's concern must be narrowed: the third-party Soniqo Android AAR pins minSdk 26, NDK r29 and CMake 4.1.2 in its Gradle module, but those are packaging/build choices of that wrapper, not a hard requirement of the LiteRT runtime or Supertonic C++ model. Avoid importing the entire SDK; build only the needed speech-core LiteRT model code into an isolated native target.

## Soniqo pinned runtime details

At speech-android commit 66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded, setup.sh downloads LiteRT 2.1.5 and extracts libLiteRt.so per ABI. Its sdk/src/main/cpp/CMakeLists.txt requires SPEECH_CORE_DIR and ORT_DIR unconditionally, then enables SPEECH_CORE_WITH_LITERT when LITERT_DIR/<abi>/libLiteRt.so exists. This build setup pulls ONNX Runtime even when the immediate target is Supertonic, so it should not be copied wholesale into OGAM. The Soniqo SDK's minSdk 26 / NDK r29 / CMake 4.1.2 should not be inherited automatically.

## Revised implementation path

1. Keep OGAM's minSdk 24 and NDK 27.1.12297006 unchanged.
2. Prototype with LiteRT v2.3.2 (or the exact matching release selected after source compatibility checks), pin the AAR, C++ SDK archive, runtime .so and SHA-256 values.
3. Extract/package only arm64-v8a runtime initially; retain CPU-only fallback first. Do not claim HTP/NPU until provider selection and runtime logs prove it on PGEM10.
4. Build a small CMake subdirectory/target for the Supertonic LiteRT C++ wrapper and JNI bridge. Reuse OGAM's CMake 3.22.1 and NDK 27.1.12297006 if the pinned LiteRT C++ SDK compiles cleanly. Keep it isolated from the existing Stable Diffusion/ggml native target.
5. Inspect speech-core's third_party/litert headers and API calls against LiteRT 2.3.2 before compiling; Soniqo's setup currently pins 2.1.5, so source compatibility with 2.3.2 is not yet established.
6. Do not link ONNX Runtime, STT, VAD or the full Soniqo AAR unless the selected Supertonic target proves it needs them.
7. Keep Android API 24 support as a hard acceptance criterion; if a dependency forces API 26, gate the experimental backend at runtime while preserving the rest of OGAM on API 24–25.

## Corrected blocker status

- LiteRT runtime minSdk: **not a blocker** for OGAM API 24 according to current Google docs.
- OGAM NDK version: **meets documented minimum** (r27.1 > r26a).
- OGAM CMake version: **meets documented minimum** (3.22.1; verify exact C++ SDK package configuration).
- Soniqo wrapper AAR minSdk/build pins: **avoidable** if using direct native source integration; still a blocker to importing the whole AAR unchanged.
- Soniqo speech-core compatibility with LiteRT 2.3.2: **unverified**; current Soniqo bootstrap pins 2.1.5.
- Existing OGAM LiteRT-LM dependency providing standalone libLiteRt: **not proven**; inspect APK/AAR contents before assuming runtime reuse.

No OGAM application code or build configuration was changed. This is a source/documentation audit only.
