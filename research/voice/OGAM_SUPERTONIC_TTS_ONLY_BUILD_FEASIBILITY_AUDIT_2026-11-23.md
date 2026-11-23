# OGAM Supertonic TTS-only build feasibility audit
Date: 2026-11-23
Repository: sokfrut-tech/OGAM
Research branch: docs/research-breeno-coloros-2026-11-22
Upstream: soniqo/speech-core commit 59b9d7902ea62dbbbfb95e139e2bf0e8957f8753
Target: OPPO Find X6 Pro PGEM10 / SM8550 / Android 16 / ColorOS 16.0.5
Mode: pinned-source and build-graph audit. No code copied, no workflow created, no native build or device test performed.

## Executive result
A Supertonic-only integration is technically plausible, and ONNX Runtime is not inherently required by the LiteRT backend. However, the previously proposed "three-source minimal target" is not yet a proven self-contained link target. The C++ model class inherits TTSInterface, whose default synthesize_with_options implementation is out-of-line in tts_synthesis_options.cpp and pulls the post-processing implementation. A clean isolated build must resolve that interface/vtable dependency without accidentally linking the full model matrix.

The upstream Android SDK's build script is also not an Android AAR installer: scripts/fetch_litert.sh downloads Google's Python wheel ai-edge-litert and extracts libLiteRt.so. Its default is 2.1.5. The Android C++ header set is vendored in speech-core/third_party/litert. Do not conflate this with the separate Maven AAR dependency used by Java/Kotlin clients.

## 1. Pinned source facts
Inspected upstream commit: 59b9d7902ea62dbbbfb95e139e2bf0e8957f8753.
Inspected:
- scripts/fetch_litert.sh
- CMakeLists.txt
- src/models/litert/litert_supertonic_tts.cpp
- src/models/litert/supertonic_tokenizer.cpp
- src/util/text_chunker.cpp
- include/speech_core/models/litert_supertonic_tts.h
- include/speech_core/models/litert_engine.h
- include/speech_core/models/supertonic_tokenizer.h
- include/speech_core/interfaces.h
- include/speech_core/tts_synthesis_options.h
- src/tts_synthesis_options.cpp
- include/speech_core/util/json.h

## 2. Runtime acquisition correction
scripts/fetch_litert.sh:
- Default version is ai-edge-litert 2.1.5.
- Uses pip download --no-deps for the Python wheel.
- Unzips the wheel and copies only libLiteRt.so / dylib / dll.
- It does not verify a SHA-256, pin a wheel URL, or fetch a Maven AAR.
- For Android it expects the extracted runtime under LITERT_DIR/<ANDROID_ABI>/libLiteRt.so in the upstream CMake configuration.
- The script does not prove that 2.3.2 is compatible with the speech-core source snapshot; it only accepts a version string and attempts a wheel download.

Google's current Android compatibility matrix identifies LiteRT 2.3.2 as latest, with minimum Android API 24 and NDK r26a. OGAM's audited minSdk 24 / NDK r27.1 / CMake 3.22.1 meet that documented baseline. This is a baseline compatibility fact, not a compiled compatibility result for this upstream source.

## 3. ONNX decoupling — confirmed, with important qualification
At upstream commit:
- SPEECH_CORE_WITH_ONNX defaults OFF.
- The ORT_DIR requirement, imported onnxruntime target, and ONNX model target are inside if(SPEECH_CORE_WITH_ONNX).
- SPEECH_CORE_WITH_HF_DOWNLOAD defaults OFF; enabling it requires LiteRT and adds CURL.
- The generic LiteRT target links speech_core + libLiteRt + utf8proc, not onnxruntime.
- utf8proc fallback is pinned in upstream CMake to JuliaStrings/utf8proc v2.11.0.
Therefore a normal speech-core LiteRT build can omit ONNX Runtime and libcurl.

Qualification: speech_core_models_litert is an aggregate target. It compiles Silero VAD, Parakeet STT, VoxCPM2, Chatterbox, Supertonic, WeSpeaker, Pyannote, Omnilingual, Nemotron and Indic-Mio sources. Avoid using that aggregate target for a TTS-only product module.

## 4. Supertonic class and source dependency map
Direct model class:
- speech_core::LiteRTSupertonicTts
- Header: include/speech_core/models/litert_supertonic_tts.h
- Implementation: src/models/litert/litert_supertonic_tts.cpp
- Tokenizer: src/models/litert/supertonic_tokenizer.cpp
- Text splitting helper: src/util/text_chunker.cpp
- LiteRT C API helper/RAII wrappers: include/speech_core/models/litert_engine.h (inline implementation; no separate litert_engine.cpp in this pinned tree)
- JSON file reader/parser: include/speech_core/util/json.h (header-only)
- Unicode NFKD: utf8proc; upstream CMake uses v2.11.0 if no system package.
- Android logging: android/log through the LiteRT engine header when __ANDROID__ is defined.
- NDK C++ runtime and filesystem support.

The model class emits mono Float32 at 44,100 Hz and exposes sentence/piece callbacks. This is compatible in sample representation with OGAM's JarvisTtsBackend, but the model callback is not autoregressive audio-token streaming.

## 5. Newly discovered link-closure issue
litert_supertonic_tts.h includes speech_core/interfaces.h and inherits TTSInterface.
TTSInterface declares a non-inline virtual synthesize_with_options method.
The implementation is in src/tts_synthesis_options.cpp; it validates options and implements buffered/postprocessed mode. That translation unit references OfflineSpectralDeEsser::process_mono via src/audio/offline_spectral_de_esser.cpp and its DSP dependencies.

Consequences:
- The earlier candidate list of three .cpp files is a source map, not a proven complete link target.
- A standalone CMake harness must inspect the actual linker closure and vtable references.
- Options to evaluate: compile the minimal required TTS interface/options support and its real postprocess dependencies; use the existing static speech_core target and verify link-time dead stripping; or propose a narrowly upstreamable interface split. Do not silently stub a virtual function or edit upstream class semantics merely to get a green link.
- If using full speech_core, it compiles a broad set of orchestration sources even with ONNX disabled. This is still much smaller than importing the aggregate model target, but not a genuinely minimal TTS-only build.

## 6. Cancellation race — confirmed source evidence
At the start of LiteRTSupertonicTts::synthesize(), upstream executes cancelled_.store(false).
cancel() only executes cancelled_.store(true).
A cancel issued before synthesize enters can therefore be cleared by the method's initial store. The C++ class alone does not provide a durable pre-entry cancellation token.

Required adapter contract:
1. Assign a monotonically increasing request generation before dispatching work.
2. Track requested/cancelled generation in the Kotlin/JNI adapter independently of the model's cancelled_ flag.
3. Do not enter native synthesize for a stale generation.
4. If cancellation races with native entry, use a serialized start handshake so cancel is re-applied after the native reset and before the first graph invocation where possible.
5. Drop all callbacks whose generation is no longer active.
6. Keep the native object alive until the worker has exited; destroy only after join/completion.
7. Test cancel-before-submit, cancel-while-queued, cancel-at-entry, cancel-during-graph, cancel-between-pieces, and immediate next-request restart.

Do not claim that calling native cancel() alone closes the race.

## 7. Recommended isolated build experiment
Create a separate, manual-only GitHub Actions workflow in the research branch after the harness source is reviewed:
- checkout the exact pinned speech-core commit (not its moving main);
- install pinned Android NDK r27.1.12297006 and CMake 3.22.1;
- pin utf8proc v2.11.0 to an immutable commit and verify its source archive hash;
- fetch the exact ai-edge-litert wheel versions 2.1.5 and 2.3.2 for Linux CPython, extract arm64-v8a libLiteRt.so and record SHA-256;
- configure a dedicated arm64-v8a Android CMake project with ONNX=OFF, HF_DOWNLOAD=OFF and only the Supertonic sources plus the actual interface/link closure;
- build a small shared JNI smoke library, inspect its dynamic dependencies and exported/undefined symbols;
- fail if libonnxruntime.so, libcurl, or unintended speech model objects appear in the link/package;
- upload CMake configure/build logs, runtime hashes, dependency report and native library artifact;
- never build or deploy the production APK in this workflow.

Before writing the workflow, verify that both wheel versions actually exist for the selected runner's Python tag/platform and determine whether the Android ABI runtime is present in the wheel. Do not invent hashes. If 2.3.2 is missing or the runtime packaging layout changes, report that as a real gate rather than falling back silently.

## 8. Current evidence status
| Gate | Status |
|---|---|
| Pinned upstream C++ source inspected | PASS |
| Supertonic API / Float32 callback contract | PASS |
| ONNX optionality in upstream CMake | PASS |
| Aggregate LiteRT target contains unrelated models | PASS |
| Wheel-vs-AAR distinction | PASS |
| utf8proc v2.11.0 pin identified | PASS |
| Minimal source list complete | NOT PROVEN |
| Standalone arm64 CMake configure | NOT RUN |
| LiteRT 2.1.5/2.3.2 wheel existence and ABI layout | NOT VERIFIED |
| Runtime SHA-256 recorded | NOT DONE |
| Native compile/link | NOT RUN |
| ONNX absence in final shared library | NOT VERIFIED |
| Cancellation race fixed/tested | NOT DONE |
| APK / PGEM10 test | NOT DONE |
| Production OGAM source changed | NO |

## 9. Decision
Continue with an isolated build harness, not production integration. Do not import the Soniqo Android wrapper or aggregate speech_core_models_litert target. Do not select 2.3.2 until the exact wheel/runtime layout is verified and the pinned speech-core source compiles against it. Preserve Supertonic as a benchmark candidate only; its OpenRAIL-M model terms remain a separate product-license gate.

## Sources
- Pinned speech-core source: https://github.com/soniqo/speech-core/tree/59b9d7902ea62dbbbfb95e139e2bf0e8957f8753
- LiteRT fetch script: https://github.com/soniqo/speech-core/blob/59b9d7902ea62dbbbfb95e139e2bf0e8957f8753/scripts/fetch_litert.sh
- Google LiteRT Android compatibility matrix: https://developers.google.com/edge/litert/android
- Google LiteRT Android Maven integration: https://developers.google.com/edge/litert/android/development

## 10. Android runtime acquisition correction — pinned speech-android setup.sh
A follow-up inspection of the same pinned `soniqo/speech-android` commit `66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded` changes the Android acquisition path described above:

- `speech-android/setup.sh` downloads the Android Google Maven AAR:
  `com.google.ai.edge.litert:litert:2.1.5`
  from `https://dl.google.com/dl/android/maven2/com/google/ai/edge/litert/litert/2.1.5/litert-2.1.5.aar`.
- It extracts `jni/<ABI>/libLiteRt.so` and places it under `litert/<ABI>/`, which matches the Android CMake expectation `LITERT_DIR/<ANDROID_ABI>/libLiteRt.so`.
- In contrast, `speech-core/scripts/fetch_litert.sh` is the host-platform PyPI wheel route; it is not the Android AAR acquisition route. Do not use a Linux-host wheel's shared library for an Android arm64 cross-build.
- `speech-android/sdk/src/main/cpp/CMakeLists.txt` also forces `SPEECH_CORE_WITH_ONNX=ON` and requires ORT_DIR, so the published wrapper's complete build still imports ONNX. Its optional LiteRT check is based on the extracted Android ABI AAR runtime.
- The pinned Android setup currently pins LiteRT AAR 2.1.5, NDK r29.0.14206865, CMake 4.1.2 and minSdk 26. These are Soniqo wrapper choices, not necessarily requirements of the direct OGAM integration.

Google's Android compatibility table currently lists LiteRT 2.3.2 with min API 24 and NDK r26a. Maven repository version listings also show `com.google.ai.edge.litert:litert:2.3.2` released 26 Oct 2026. This confirms the coordinate/version is published; it does NOT yet confirm the AAR's exact JNI payload, SHA-256, exported C API compatibility with this speech-core commit, or model runtime behavior. The CI harness must download the AAR directly, verify the ZIP structure, calculate SHA-256, extract arm64-v8a/libLiteRt.so, preserve LICENSE and THIRD_PARTY_NOTICE.txt, then compile/link.

This correction supersedes any interpretation that the PyPI wheel is the Android runtime source. Keep both acquisition methods separate in all future scripts and evidence.

## 11. LiteRT 2.3.2 Android AAR contents and redistribution obligations — external corroboration
Research date: 2026-11-23.

Independent current package documentation for `google-ai-edge/flutter_litert` describes its Android runtime as extracted from the official Google Maven AARs:
- `com.google.ai.edge.litert:litert:2.3.2` supplies `jni/arm64-v8a/libLiteRt.so` (and corresponding CPU runtime for other supported ABIs).
- `com.google.ai.edge.litert:litert-gpu:2.3.2` separately supplies `libLiteRtClGlAccelerator.so`; this is not required for a CPU-only Supertonic build.
- The plugin's changelog says the 2.3.2 `litert` and `litert-gpu` AARs each carry `LICENSE` and `THIRD_PARTY_NOTICE.txt`; it preserves these notices unchanged because some bundled third-party licenses require reproducing copyright notices in binary redistributions.
- This is strong external corroboration of artifact structure and notice obligations, but it is not a direct inspection of the downloaded AAR in this audit. No AAR bytes, exact AAR SHA-256, extracted .so SHA-256, ELF metadata, or notice-file bytes have yet been independently captured. Keep those gates OPEN.

Relevant sources:
- Google Maven artifact/version listing: `com.google.ai.edge.litert:litert:2.3.2`, dated 26 Oct 2026.
- Google LiteRT Android compatibility table: 2.3.2 latest; API 24; NDK r26a.
- google-ai-edge/flutter_litert changelog and README: describes official AAR extraction, ABI set and license/notice handling.
- Google's C++ codelab explicitly demonstrates downloading the Android AAR and extracting `jni/arm64-v8a/libLiteRt.so`.

## 12. Qualcomm NPU is a separate dependency and validation track
A current implementation reference for LiteRT 2.3.2's Qualcomm NPU path identifies:
- Android API 31+ and arm64-v8a as NPU-path requirements.
- A matching `com.google.ai.edge.litert:litert-npu-runtime-qualcomm:2.3.2` AAR supplying `libLiteRtCompilerPlugin_Qualcomm.so` and `libLiteRtDispatch_Qualcomm.so`.
- QAIRT 2.50.0.260828 libraries for the target HTP generation.
- Snapdragon 8 Gen 2 / SM8550 corresponds to HTP v73 in the cited device matrix.
- The LiteRT 2.3.2 NPU integration requires the matching 2.3.2 plugin and QAIRT 2.50.0.260828; old 2.47.0 bundles from earlier LiteRT releases must not be reused.
- The reference project documents `useLegacyPackaging = true` for its Qualcomm NPU setup because the runtime scans real filesystem library paths. This is a requirement of that NPU distribution path, not a general CPU-only TTS requirement.
- It reports a Galaxy S23 regression in two image segmentation models on LiteRT 2.3.2. This is not evidence of a Supertonic regression, but it reinforces the need for model/device-specific validation.

Decision for OGAM:
1. First isolate and validate CPU-only Supertonic with just `litert:2.3.2`; do not add GPU or Qualcomm NPU packages to the first build.
2. Only after CPU build and acoustic baseline, open a separate SM8550/v73 NPU feasibility track. Pin exact Qualcomm AAR and QAIRT files, hashes, licenses/notices, ABI, packaging behavior and runtime version together.
3. Never claim that LiteRT 2.3.2 automatically activates Snapdragon NPU. A C++ build linking `libLiteRt.so` is not proof of NPU dispatch. NPU requires matching vendor plugin/dispatch runtime and QAIRT, explicit accelerator selection, supported ops and physical-device proof.
4. Supertonic's actual execution backend (CPU/GPU/NPU) must be measured from runtime logs and device telemetry. No accelerator selection is made in this research phase.

## 13. Evidence status update
| Gate | Status |
|---|---|
| LiteRT 2.3.2 Google Maven publication | CORROBORATED |
| arm64-v8a libLiteRt.so inside 2.3.2 AAR | EXTERNALLY CORROBORATED; NOT DIRECTLY EXTRACTED |
| Separate GPU AAR | CORROBORATED; not needed for CPU-only harness |
| LICENSE and THIRD_PARTY_NOTICE.txt obligations | EXTERNALLY CORROBORATED; exact bytes not captured |
| AAR SHA-256 | NOT CAPTURED |
| arm64 .so SHA-256 / ELF audit | NOT CAPTURED |
| Qualcomm NPU matching runtime + QAIRT pin | SOURCE-LEVEL REFERENCE FOUND; not tested |
| Supertonic on SM8550 NPU | NOT TESTED |
