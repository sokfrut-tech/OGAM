# LiteRT 2.3.2 Android AAR acquisition and hash gate
Date: 2026-11-23
Repository: sokfrut-tech/OGAM
Research branch: docs/research-breeno-coloros-2026-11-22
Target: OPPO Find X6 Pro PGEM10 / SM8550 / Android 16
Scope: artifact provenance and acquisition only; no app integration.

## Result
The official Google Android C++ codelab independently confirms the Android runtime acquisition mechanism: download the Google Maven AAR, extract `jni/arm64-v8a/libLiteRt.so`, and pass that exact shared library into an NDK/CMake build. The official LiteRT release page identifies v2.3.2 (2026-10-26), and Google's Android compatibility table lists it as latest with API 24 / NDK r26a baseline.

This strengthens the source-level acquisition plan, but does not close the binary provenance gate. The AAR and its contents were not obtained in this research runtime.

## Exact target artifact
- Maven coordinate: `com.google.ai.edge.litert:litert:2.3.2`
- Expected Google Maven path: `https://dl.google.com/dl/android/maven2/com/google/ai/edge/litert/litert/2.3.2/litert-2.3.2.aar`
- Expected runtime member: `jni/arm64-v8a/libLiteRt.so`
- CPU-only Supertonic harness does not need the separate `litert-gpu` AAR.
- Preserve the AAR's `LICENSE` and `THIRD_PARTY_NOTICE.txt` in any redistribution package.

## Acquisition attempts in this pass
1. Opened the exact Google Maven AAR URL through the available web retrieval path; the host returned an internal inaccessible response.
2. Retried the exact URL using the container download helper after opening it; the helper rejected it because the web source had not been successfully viewed.
3. Tried direct HTTPS retrieval from the build container; DNS resolution failed (`Temporary failure in name resolution`).
4. Did not substitute a mirror, guessed checksum, or unrelated host wheel. No artifact bytes were captured.

This is an environment/network limitation, not evidence that the artifact is missing from Google Maven.

## What is confirmed vs still open
| Item | Evidence status |
|---|---|
| LiteRT 2.3.2 is published | Confirmed by official release page and Google Android compatibility docs |
| Google Maven AAR is the Android distribution path | Confirmed by official Google C++ codelab and pinned Soniqo setup script |
| Expected arm64 runtime member path | Confirmed by official Google codelab |
| External corroboration of 2.3.2 AAR notices | Present in google-ai-edge/flutter_litert docs |
| Exact AAR bytes and SHA-256 | OPEN |
| Extracted arm64 .so bytes and SHA-256 | OPEN |
| ELF architecture / SONAME / dynamic dependencies | OPEN |
| Exact LICENSE and THIRD_PARTY_NOTICE.txt bytes | OPEN |
| ABI/runtime compatibility with pinned speech-core commit | OPEN until native compile/link |
| Supertonic PGEM10 execution | NOT TESTED |

## Required reproducible CI acquisition step
A future manual-only research workflow should:
1. Download the exact Google Maven AAR URL with curl/wget and fail on HTTP errors.
2. Save the original AAR as a workflow artifact (or record its SHA-256 and retain it in a controlled artifact store).
3. Verify the ZIP contains `jni/arm64-v8a/libLiteRt.so`, `LICENSE`, and `THIRD_PARTY_NOTICE.txt`.
4. Compute SHA-256 for the AAR, extracted .so, and notice files; record byte sizes.
5. Run `file`, `readelf -h`, `readelf -d`, and `readelf -Ws` on the extracted .so; retain outputs.
6. Compare required C API symbols against the pinned speech-core source and compile the isolated TTS-only harness.
7. Fail if the ABI is not AArch64, required symbols are absent, or unexpected ONNX/libcurl dependencies appear.
8. Keep CPU-only and Qualcomm NPU artifacts/workflows separate. Do not add the NPU AAR or QAIRT to this first acquisition.

No checksum is to be entered into the repository until computed from downloaded bytes. No production app source or Gradle dependency is to change during this experiment.

## Sources
- Google LiteRT Android C++ codelab (Maven AAR download and arm64 runtime extraction): https://developers.google.com/codelabs/litert-image-segmentation-cpp
- Google LiteRT Android compatibility matrix: https://developers.google.com/edge/litert/android
- Google LiteRT v2.3.2 release: https://github.com/google-ai-edge/LiteRT/releases
- Pinned Soniqo Android setup script: https://github.com/soniqo/speech-android/blob/66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded/setup.sh
- Independent AAR notice corroboration: https://github.com/google-ai-edge/flutter_litert
