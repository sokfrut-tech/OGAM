# Chinese open-model and Android implementation review — 2026-11-22

Status: research finding; no third-party code or model weights imported into OGAM.

## Executive finding

A particularly relevant, unusually advanced public Android implementation was found:
- Repository: https://github.com/Nian27/CosyVoice3-MNN
- It ports Alibaba Fun-CosyVoice 3.0 to a fully local Android arm64 app using MNN 3.6.1 and JNI.
- The repository documents an end-to-end LLM → Conditioner → Flow → HiFT synthesis pipeline, model import/export and integrity checks, voice profiles, instruction-controlled delivery, and hardware fallback.
- This is a concrete implementation to study, not merely a model card. It is a strong candidate reference for OGAM's local Russian Jarvis TTS subsystem.

## Critical compatibility caveat for our target device

Target: OPPO Find X6 Pro / PGEM10 (Snapdragon 8 Gen 2, SM8550).

The repository README says its accelerated q_proj route was validated on SM8850 (Honor Magic8 Pro), while other devices use CPU/OpenCL compatibility paths. Its published performance numbers are from SM8850 only:
- warm RTF approximately 0.79–0.96 (one reported FP16 result 0.82);
- process PSS approximately 2.25 GB with all three MNN modules resident;
- model archive approximately 1.3 GiB;
- recommended RAM 8 GB+.
The README explicitly says non-SM8850 devices were not real-device validated; CPU fallback may be materially slower. Therefore do NOT claim Find X6 Pro compatibility/performance until tested on PGEM10. Do not copy the SM8850-specific Hexagon stub/skeleton or NPU route into OGAM.

## Model and speech stack candidates

### 1. TTS: Fun-CosyVoice 3.0 / CosyVoice3-MNN
Official model/runtime project:
- https://github.com/QwenAudio/CosyVoice
- https://github.com/Nian27/CosyVoice3-MNN

Official CosyVoice repository describes Fun-CosyVoice 3.0 open weights (0.5B) and Russian among 9 supported languages; it advertises text-in/audio-out bi-streaming, instruction control (language, dialect, emotion, speed, volume), and cross-lingual voice cloning. Treat the advertised 150 ms latency as a project claim, not a measurement on PGEM10.
The MNN Android port is the most actionable lead: it documents JNI integration, local model packages outside the APK, voice profile management, and measured failure modes. Its own README reports the whole MNN model package at about 1.3 GiB and PSS about 2.25 GiB on the tested SM8850 device.

Decision: prioritize source audit and isolated PGEM10 benchmark before integrating. First test Russian pronunciation, long-form stability, cold/warm latency, memory, thermal behavior, cancellation, and offline operation. Preserve Piper as a lightweight fallback until the candidate passes.

### 2. ASR: Qwen3-ASR
Official repository:
- https://github.com/QwenLM/Qwen3-ASR

The published Qwen3-ASR family has 0.6B and 1.7B variants, supports Russian and German among its listed languages, and describes both offline and streaming inference. This is a promising multilingual ASR candidate for Russian/German voice commands. The official inference paths shown are Python/Transformers/vLLM; native Android arm64 deployment is not established by that repository page. Do not wire it into the Android app until a supported runtime/export path and actual PGEM10 resource profile are proven.

### 3. ASR/audio understanding: SenseVoiceSmall + FunASR
- https://github.com/QwenAudio/SenseVoice
- https://github.com/modelscope/FunASR

SenseVoiceSmall offers ASR, language identification, emotion and acoustic-event tags; official listed checkpoint languages are Mandarin, Cantonese, English, Japanese and Korean. It does NOT list Russian, so it is not the primary Russian ASR for Jarvis. It could be useful for Chinese-language Breeno command research or as an optional Chinese audio route.
FunASR is a broader toolkit with offline/streaming ASR, VAD, punctuation and speaker pipelines. Toolkit license and individual model licenses must be reviewed separately. Python/CUDA-oriented examples are not proof of native Android support.

## Previously identified Chinese/Asian Android assistant projects

Earlier research notes already listed:
- Zorv AI — multi-tool Android assistant, MNN/llama.cpp and Android integration patterns; inspect permission model and real device behavior before borrowing architecture.
- Eta — system-assistant concepts for ColorOS/HyperOS, VoiceInteractionService, power-button activation and screen context.
- Uktam.ai — Sherpa-ONNX, IndicConformer and llama.cpp JNI integration ideas.
- AIAssistant — Vosk offline ASR.
- DSH Mobile — Termux/Accessibility approach.
- PocketMind, AzCode, Aries AI, Phtomt, Naomi and Neyam Vaani as adjacent projects to compare.
These were research leads, not integrated components. The earlier search had not confirmed a production-ready OGAM-compatible app on Gitee/ModelScope/OpenI.

## Breeno reverse-engineering boundary

OGAM separately analyzed 26 user-supplied OPPO/Breeno APKs statically. Findings included KWS/wakeup libraries, VAD/AEC indicators, local TTS, MNN, SpeechService, OmniMind, AnalogSkillService, SQLCipher and local search/RAG indicators. This is structural evidence only: no full JADX method-level analysis or runtime tracing has yet proven the exact behavior of each component. No proprietary APK/DEX/Smali/native binaries/OEM assets are to be copied into OGAM.

## Recommended implementation order

1. Audit Nian27/CosyVoice3-MNN source, license, model provenance, build scripts, JNI interfaces and supply-chain dependencies. Compare with official QwenAudio/CosyVoice source; record exact upstream commits.
2. Build a disposable test APK/flavor only; keep model weights external to the APK and use explicit SHA-256 verification.
3. Test on the actual PGEM10 / SM8550: installation, cold start, Russian speech quality, 5–30 second prompts, repeated synthesis, memory/PSS, CPU/OpenCL backend, thermal throttling, process death/recovery, airplane mode.
4. If acceptable, wrap it behind OGAM's existing deterministic TTS provider interface; do not replace Piper until quality/resource gates pass.
5. Separately investigate Qwen3-ASR 0.6B as an optional ASR experiment. Prove Android arm64 runtime support and benchmark before choosing it over the existing Sherpa-ONNX/Silero path.
6. Keep SenseVoiceSmall as an optional Chinese-language experiment, not the Russian default.
7. Keep all model downloads user-controlled, checksum-verified, license-reviewed, and outside the APK. No mandatory cloud/API/account/telemetry.

## What is integrated in OGAM today?

As of this note, none of CosyVoice3-MNN, Qwen3-ASR, FunASR or SenseVoice has been integrated into OGAM. This note records research and prioritization only. Existing OGAM native work remains separate; do not report the above as implemented or device-tested.

## Primary sources

- https://github.com/Nian27/CosyVoice3-MNN
- https://github.com/QwenAudio/CosyVoice
- https://github.com/QwenLM/Qwen3-ASR
- https://github.com/QwenAudio/SenseVoice
- https://github.com/modelscope/FunASR
- https://github.com/modelscope/FunASR/blob/main/docs/model_selection.md


## 2026-11-22 deeper source audit (CosyVoice3-MNN v1.2.0)

The public repository currently exposes v1.2.0 material (not only the earlier v1.1.0 README context). Audited these source artifacts on its main branch:
- `LICENSE`
- `app/build.gradle.kts`
- `app/src/main/AndroidManifest.xml`
- `CosyVoiceRuntime.kt`, `CosyVoiceStore.kt`, `CosyVoiceModelDownloader.kt`
- `CosyVoiceDesignService.kt`, `CosyVoiceInstruction.kt`, `CosyVoiceVoiceProfile.kt`
- `mnn-jni/CosyVoiceLlmJni.cpp`, `mnn-jni/CosyVoiceFlowJni.cpp`
- `RELEASE_NOTES_v1.2.0.md`, `release-manifest.json`

### Positive implementation details confirmed in source
- Android application source declares Apache-2.0; model card for the converted MNN package says Apache-2.0; official QwenAudio/CosyVoice repository is Apache-2.0. Preserve license/NOTICE and verify the license of each native dependency and prebuilt binary separately before redistribution.
- App uses Android minSdk 26, targetSdk 36, Kotlin/Compose, MNN 3.6.1, arm64-v8a, and external model package with fixed size and SHA-256 checks.
- ZIP import stages files, validates expected names/sizes/hashes and moves them into the model directory. Downloader supports resume and verifies the whole archive before import.
- LLM JNI serializes calls with a native mutex. The Kotlin voice-profile model carries a schema version, model ID, prompt metadata and profile hash.
- Long-text release notes describe a real fix to sampling pipeline: adding repetition penalty (1.15), dynamically sizing maxTokens from prefix+text, tightening EOS/collapse quality checks and clipping trailing idle tokens. This matters for Jarvis long answers.
- Voice-design work is isolated into a separate Android process and foreground service. Source comments document a peak memory footprint around 7 GB for the design task and a 30-minute partial wake lock. This is a high-memory optional feature, NOT appropriate for default Jarvis MVP on PGEM10.
- The service serializes design jobs because parallel runs contend for shared MNN global executor and can exhaust memory. This is a useful concurrency lesson.
- Release manifest currently says v1.2.0, APK ~12.38 MB, and model archive ~1.399 GB; model files are downloaded separately.

### Risks / questions found during source inspection
- README's strongest performance and Hexagon claims are still SM8850-specific. No SM8550/OPPO Find X6 Pro test evidence found. Never import SM8850 Hexagon stub/skeleton or q_proj path into OGAM.
- Source manifest requests INTERNET, foreground service/dataSync, notifications, legacy storage permissions capped by API level, and marks backup enabled. OGAM must not copy these wholesale: model files are private app data, and backup/data-exfiltration implications must be reviewed. INTERNET is only needed for explicit model download; offline inference itself should work with network disabled.
- App has an isolated :design process, but it still shares application files and native libraries; process separation does not make the operation low-memory or sandbox model input. It is an optional experimental capability.
- The README's own performance table is from one SM8850 handset. The project itself lists non-Qualcomm devices and CPU fallback as unverified. On SM8550, MNN CPU/OpenCL support is plausible but not established by source review.
- Prebuilt .so binaries and Hexagon DSP artifacts have a distinct provenance/license chain. Source LICENSE alone does not prove every shipped binary is reproducible or redistributable under the same license.
- Model archive is 1.3 GiB; optional voice enrollment extension is ~998 MB. Keep these as user-triggered, hash-verified downloads outside APK. Do not make them a required Jarvis install dependency.
- v1.2.0 long-text and voice-design fixes were read from release notes/source; they are not independently reproduced by OGAM and not verified on PGEM10.

### New ASR deployment lead: Qualcomm AI Hub
Qualcomm AI Hub currently lists Qwen3-ASR 0.6B and 1.7B as mobile model offerings with Q8_0 GGUF weights and a llama.cpp-based GenieX runtime:
- 0.6B weights are listed at ~0.80 GB (audio encoder excluded); the page lists Galaxy S25/S26 and Snapdragon 8 Elite/Elite Gen 5 support.
- 1.7B weights are listed at ~2.17 GB (audio encoder excluded); the same device generation limitation is shown.
- The model card advertises 30 languages and 22 Chinese dialects; Apache-2.0 model license is listed.
This is stronger evidence of a mobile deployment route than the official Qwen Python package alone, but the listed device support does NOT include Snapdragon 8 Gen 2 / SM8550. It is not yet a candidate for direct integration; first determine if the exported GGUF and audio encoder can run on generic llama.cpp/sherpa-onnx on SM8550.

A separate GitHub project called `rounma/mobile-agent` describes Qwen3-ASR + sherpa-onnx, but its README model installation instructions appear to download a Chinese Zipformer model rather than a verified Qwen3-ASR checkpoint. Treat this as a questionable reference, not proof of Qwen3-ASR Android support.

### Updated decision
- CosyVoice3-MNN v1.2.0 is a high-value reference implementation, but the only safe OGAM step now is a clean-room adapter plan and an isolated benchmark flavor. Do not import binaries or copy the app wholesale.
- TTS first test should use the regular reading pipeline only. Defer VoiceDesign/enrollment (~7 GB peak design memory / ~1 GB extension) until a separate resource study.
- Qwen3-ASR 0.6B is a research candidate only; Qualcomm AI Hub's current listed devices exclude our SM8550. Continue with current Sherpa-ONNX/Silero baseline while exploring portable ONNX/GGUF routes.
- No code or model files were added to OGAM by this audit; this is documentation-only.

### Additional sources
- https://github.com/Nian27/CosyVoice3-MNN/blob/main/RELEASE_NOTES_v1.2.0.md
- https://github.com/Nian27/CosyVoice3-MNN/blob/main/release-manifest.json
- https://github.com/Nian27/CosyVoice3-MNN/blob/main/app/src/main/AndroidManifest.xml
- https://github.com/QwenAudio/CosyVoice
- https://aihub.qualcomm.com/mobile/models/qwen3_asr_0_6b
- https://aihub.qualcomm.com/mobile/models/qwen3_asr_1_7b
- https://github.com/rounma/mobile-agent


## Correction after inspecting the active OGAM implementation branch

The previous section understated OGAM's Qwen3-ASR progress. On branch `feature/jarvis-step-2-storage-privacy` (head `b193ad969dc45e17d1a142fe42bc4fa8e98bf454`), Qwen3-ASR 0.6B is already implemented in the existing transcription service; it is not merely a future candidate.

Verified by reading:
- `src/services/qwenAsrEngine.ts`
- `src/services/qwenAsrModel.ts`
- `src/services/whisperService.ts`
- `src/services/whisperModelFiles.ts`
- `src/services/whisperModelDownloads.ts`
- `__tests__/integration/audio/qwen3AsrTranscription.rendered.test.tsx`

### Existing integration behavior
- Model ID: `ggml-org/Qwen3-ASR-0.6B-GGUF`.
- Two artifacts: `Qwen3-ASR-0.6B-Q8_0.gguf` and `mmproj-Qwen3-ASR-0.6B-Q8_0.gguf`; both are catalog-managed, separately downloaded, and the integration test checks SHA-256 metadata for both.
- Android uses `llama.rn` with explicit CPU device selection (`n_gpu_layers: 0`); iOS has a separate Metal path.
- Audio projector is loaded through llama.cpp multimodal `initMultimodal`; the engine rejects loading if the projector cannot initialize.
- Transcription supports auto language detection and pinned language prompts, including a dedicated Russian prompt test.
- Existing fallback path: if Qwen3-ASR fails and a Whisper model is downloaded, Whisper handles the recording; user sees a one-line notice. If no Whisper model is available, a clear failure notice is shown.
- Device admission is memory-gated. The rendered integration test explicitly says the model's catalog memory requirement is 3 GB and tests that it is not listed on a 2 GB phone.
- The Qwen model uses the same Whisper/transcription model management surface and disk folder, not a separate ad-hoc downloader.

### What the tests do and do not prove
The rendered integration tests fake the native `llama.rn` boundary and its completion output. They verify app wiring, catalog admission, two-file checksummed download orchestration, Russian prompt construction, composer delivery and Whisper fallback. They do NOT prove that the real Qwen3-ASR GGUF + mmproj pair successfully loads, recognizes real Russian speech, or performs acceptably on OPPO Find X6 Pro / SM8550.
No PGEM10-specific native inference evidence was located in the reviewed branch. Do not describe it as device-validated.

### Revised ASR decision
Qwen3-ASR is already integrated in OGAM's React Native app branch. The immediate task is not to add it again. It is to:
1. verify the exact catalog entry and model checksums/URLs from the authorized shared catalog source;
2. confirm the shipped llama.rn Android build has the required `qwen3a` multimodal support and model minimum build;
3. run native Android smoke/load/transcription tests on a real device, prioritizing PGEM10 / SM8550;
4. benchmark Russian speech quality, CPU time, peak RSS, thermal behavior, long audio and cancellation;
5. retain the existing Whisper fallback and memory admission gate until those tests pass.

This correction is important: Qwen3-ASR's integration work is already present in OGAM; only native/device validation remains unproven.


## 2026-11-22 additional breakthrough: Qwen3-ASR through sherpa-onnx (Android + iOS)

This is a second viable runtime route for the Qwen3-ASR model already present in OGAM. Do not duplicate the model in the product without a controlled comparison.

### Confirmed upstream support
- Official sherpa-onnx documentation has a dedicated Qwen3-ASR section and explicitly lists Android `arm64-v8a` and iOS `arm64` as supported platforms.
- The project supplies a Kotlin API example (`kotlin-api-examples/test_offline_qwen3_asr.kt`), Java API model config, C/C++ APIs, and a Swift API example (`swift-api-examples/qwen3-asr.swift`).
- The published model is `sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25`, converted from Qwen3-ASR using Wasser1462/Qwen3-ASR-onnx.
- The documented package contains `conv_frontend.onnx` (~42 MB), `encoder.int8.onnx` (~174 MB), `decoder.int8.onnx` (~721 MB), tokenizer files (~4.2 MB), and test audio; reported total directory size is 1,954,552,000 bytes (~1.82 GiB).
- The model supports Russian, German, English, Chinese and other languages plus the documented Chinese dialect set.
- The Android microphone examples use Qwen3-ASR with CPU provider and optional Silero VAD. The documented "simulated streaming" path is VAD/chunked use of an offline recognizer; do not describe the model itself as a native token-streaming recognizer.
- The upstream sherpa-onnx repository is Apache-2.0. Confirm exact AAR/ONNX Runtime notices and model export provenance before redistributing binaries.

### Relevant primary sources
- https://k2-fsa.github.io/sherpa/onnx/qwen3-asr/index.html
- https://k2-fsa.github.io/sherpa/onnx/qwen3-asr/pretrained.html
- https://github.com/k2-fsa/sherpa-onnx/blob/master/kotlin-api-examples/test_offline_qwen3_asr.kt
- https://github.com/k2-fsa/sherpa-onnx/blob/master/swift-api-examples/qwen3-asr.swift
- https://github.com/Wasser1462/Qwen3-ASR-onnx
- https://github.com/k2-fsa/sherpa-onnx

### What this means for OGAM / Jarvis
OGAM already has Qwen3-ASR 0.6B as GGUF + mmproj via llama.rn. That route has app-level tests for language prompt, Russian language selection, checksummed two-file downloads and Whisper fallback, but native inference on PGEM10 is not proven.

The sherpa-onnx route is a distinct implementation and format:
- GGUF + mmproj + llama.rn (existing)
- ONNX conv frontend + encoder + decoder + tokenizer + sherpa-onnx (alternative)
Do not mix their artifacts, metadata, checksums, or model catalog IDs.

### Proposed experiment (do not replace existing backend yet)
1. Add a separate, opt-in benchmark flavor/branch only after confirming native integration boundaries. Do not silently add a second ~1.9 GB model to the standard install.
2. For Android, use the official sherpa-onnx Kotlin API and the smallest supported arm64-v8a native package; confirm exact AAR artifact, ABI filters, license notices and resulting APK size.
3. For iOS, evaluate the official Swift API / XCFramework and memory budget separately. Do not assume Android packaging works on iOS.
4. Use CPU as the reproducible baseline; do not claim Qualcomm NPU/HTP acceleration from generic ONNX support. The official Qwen3 sherpa examples set provider=cpu.
5. Benchmark both backends with identical Russian audio clips, same sample rate and decoding constraints: cold load, warm load, first-result latency, RTF, peak RSS, sustained thermal behavior, accuracy/WER/CER, punctuation, names/commands, noisy speech, cancellation and airplane mode.
6. Use the same Whisper fallback contract and avoid simultaneous residency of both large ASR engines. Ensure model switching releases the prior native context before loading the next.
7. Test on the actual OPPO Find X6 Pro / PGEM10 (SM8550), not just emulator or a different Snapdragon generation.

### Decision
Keep the existing llama.rn Qwen3-ASR as the production candidate because it is already integrated into OGAM. Promote sherpa-onnx to a controlled alternative benchmark because it has explicit Android/iOS APIs and a documented Qwen3-ASR ONNX model. No code, AAR, model weights or binary artifacts were added in this research update; no PGEM10 performance claim is made.


## 2026-11-22 React Native bridge discovery: an even closer integration route

A public React Native TurboModule exists:
- Repository: https://github.com/XDcobra/react-native-sherpa-onnx
- Current main package.json reports SDK version 0.4.4.
- It exposes offline STT, TTS, and multiple native speech features through TypeScript, with Android and iOS native implementations.
- It explicitly lists Qwen3-ASR ONNX as a supported STT model type (`qwen3_asr`).
- SDK peer requirements include React Native >=0.70; OGAM is already on a recent React Native branch, so the technology stack is compatible in principle. This is not proof that dependency integration/build succeeds in OGAM.
- Its package uses codegen TurboModule (`SherpaOnnxSpec`), Android Gradle native dependencies and iOS XCFramework; no hand-written Kotlin module would be needed if the library integrates cleanly.
- SDK's pinned prebuilt tag files currently report sherpa-onnx Android/iOS 1.12.35-1 and ONNX Runtime Android QNN build `1.24.4-qnn2.43.1.260218-1`. The SDK's own README describes bundled sherpa-onnx 1.12.35.
- The README documents Android/iOS production-ready CI and Qwen3 ASR support; its source/package docs should be version-pinned before relying on this claim.

### QNN / SM8550 caveat
The SDK's execution-provider documentation explicitly lists Qualcomm SM8xxx, including SM8550, as a supported QNN SoC family. However:
- QNN requires QNN-compatible ONNX files or a context binary; the ordinary public INT8 ONNX Qwen model is not demonstrated as QNN-compiled for SM8550.
- `getQnnSupport()` without the actual model only validates a minimal test session; it does not prove the Qwen model graph initializes or accelerates.
- The SDK docs say QNN performance must be measured with the specific model. A maintainer issue asks for external QNN testing because the maintainer cannot test locally.
- Therefore first use CPU/XNNPACK as baseline. Only test QNN after model-specific `canInit`, full graph execution, output parity and thermal/latency measurement on PGEM10.
- The app already has its own QNN runtime asset handling. Adding another SDK's QNN runtime may duplicate or conflict with existing QNN/ORT native libraries. Audit exact .so names, versions, load paths and Gradle packaging before enabling QNN.

### SDK capability gaps / licensing
- The SDK's Qwen3 options expose hotwords and decode limits but currently no per-request language hint in its TypeScript model options. The current OGAM llama.rn backend does have language-prefill prompts. The model can still auto-detect Russian, but this difference must be tested.
- Qwen3-ASR in sherpa is offline. The SDK's streaming STT APIs are for streaming-capable transducer/paraformer/other models; Qwen3-ASR should be treated as utterance/file decode, potentially with VAD segmentation, not token-by-token streaming.
- SDK MIT license; sherpa-onnx Apache-2.0; ONNX Runtime MIT. SDK's third-party inventory also includes FFmpeg and Shine under LGPL, Opus BSD, and libarchive/Zstd BSD-family notices. Review the actual package build flags and notices; if FFmpeg is not needed, investigate `sherpaOnnxDisableFfmpeg` before adding.
- Android SDK Gradle currently supports arm64-v8a, armeabi-v7a, x86, x86_64; OGAM should restrict release packaging to required ABIs if safe, to avoid multiplying native library size.
- iOS XCFramework is downloaded at pod install (SDK README says roughly 80 MB); CI and offline reproducibility must account for that.

### Revised engineering recommendation
This React Native TurboModule is the best integration candidate for a short, isolated spike because it fits OGAM's architecture better than writing a new bridge. Do not add it to production dependencies yet.
1. Pin a specific SDK release/tag and inspect that exact source, not moving main.
2. Check whether SDK 0.4.4 is published and whether the source tag/lockfile pins match the repository's package.json; resolve the documentation/source version mismatch.
3. Build a throwaway branch with only the STT subpath and Qwen3-ASR model, no TTS/VAD extras; disable unused FFmpeg/libarchive features where possible.
4. Compare existing llama.rn Qwen GGUF backend against sherpa ONNX backend on same WAV files and same PGEM10.
5. Check native memory and library collisions, including existing QNN libs/ORT.
6. Test model-specific QNN with the actual Qwen ONNX model only after CPU baseline; do not infer QNN support from SoC detection.
7. Keep Whisper fallback, deterministic unload, and avoid co-resident ASR contexts.

### Source references
- https://github.com/XDcobra/react-native-sherpa-onnx
- https://github.com/XDcobra/react-native-sherpa-onnx/blob/main/package.json
- https://github.com/XDcobra/react-native-sherpa-onnx/blob/main/docs/stt.md
- https://github.com/XDcobra/react-native-sherpa-onnx/blob/main/docs/execution-providers.md
- https://github.com/XDcobra/react-native-sherpa-onnx/blob/main/android/prebuilt-versions.gradle
