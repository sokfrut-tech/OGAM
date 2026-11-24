# China & India model landscape — Jarvis / OGAM
Date: 2026-11-22
Status: preliminary research register; not a completed benchmark or a claim that all weights have been downloaded/tested.

## Why this file exists
The project must look beyond US-centric sources. Search Chinese and Indian model labs, model hubs, code forges, Android runtimes and complete assistant projects. Reuse useful ideas and compatible open-source components; do not assume an unavailable dependency is mandatory. If a source is inaccessible, find an accessible implementation or equivalent and record the substitution.

## Sources and discovery surfaces
- GitHub, GitLab
- China: GitCode, Gitee, AtomGit, ModelScope, OpenI
- Hugging Face model cards and organization feeds
- Official model/lab release notes and license files
- Android implementation repositories and runtime documentation

## China — candidate model families to verify
These are research candidates, not yet approved dependencies:
- Alibaba Qwen: Qwen3.8 family and smaller Qwen variants; investigate the smallest downloadable checkpoints and quantized Android-compatible formats first. Qwen4-Max is described in current secondary coverage as hosted/API-only, so do not treat it as an offline model without an actual downloadable weight artifact.
- DeepSeek: V4 Flash family; likely too large for direct phone deployment in flagship form. Investigate smaller distilled checkpoints and compatible quantizations, not just the flagship.
- Z.ai / Zhipu: GLM-5.3-Flash and smaller releases; check exact license, architecture and runtime support.
- Moonshot: Kimi K3 family; flagship-scale models are not phone candidates absent a small distilled checkpoint.
- MiniMax: M3.1 Flash and earlier smaller/distilled variants; verify actual weights, license and mobile inference support.
- ModelBest: MiniCPM5-1B and MiniCPM-V 4.x family are high-priority phone/edge candidates because of their smaller footprint; inspect Android demos, vision/audio support, quantization and licenses.
- Tencent Hunyuan / WeVisOne-VL small 2B/4B variants: investigate on-device vision and multimodal UI understanding.
- Baidu ERNIE OCR / small vision models: investigate document/screen OCR as a separate specialist capability.
- Ant Group Ling family: inspect small/open checkpoints and tool-use relevance.
- Xiaomi MiMo and Meituan LongCat: track for open-weight reasoning/code capability, but verify whether a practical mobile-sized checkpoint exists.

## India — candidate model families to verify
- Sarvam 30B and 105B: official March 2026 release states open weights and Transformers/vLLM/SGLang paths. These are not direct OPPO-phone targets; assess as optional self-hosted/cloud reasoning backends and for distillation/evaluation.
- Sarvam-105B-1711 (announced 2026-11-22): official release describes a voice-agent/agentic oriented checkpoint, tool use and BF16/NVFP4 weights. Treat as workstation/server class, not mobile-local, until a real mobile footprint is demonstrated.
- Sarvam speech stack: separately evaluate ASR, TTS, translation and Indic-language datasets/models for architecture ideas; Jarvis needs Russian ASR/TTS, so Indic-only quality does not establish Russian suitability.
- Search Indian GitHub authors/projects for Android voice assistants, local inference, wake-word/VAD, accessibility automation and device-control code. Do not equate an Indian author's location with model origin or quality.

## Initial relevance to OGAM / Jarvis
1. Prioritize phone-local models by measured RAM, storage, first-token latency, tokens/sec, thermal throttling and battery use on OPPO Find X6 Pro / PGEM10.
2. Separate model capability from runtime integration. A model card saying "open weights" does not prove llama.cpp/MLC/MNN/QNN/ExecuTorch compatibility.
3. Keep a tiered design: small local model for intent/routing and routine commands; larger optional model for complex reasoning only when available; deterministic Android services for device actions.
4. Voice pipeline remains modular: wake word -> VAD -> ASR -> intent/planner -> permission-gated tool/action -> TTS. Evaluate Russian quality independently.
5. Vision/screen understanding should be an optional specialist path, not a requirement for every request.
6. Never grant an LLM direct unrestricted Accessibility/device-control authority. Use typed tools, explicit permissions, risk tiers, confirmation, timeouts and audit logs.

## Evidence status on 2026-11-22
- Official Sarvam announcement confirms Sarvam 30B/105B open weights and supported server inference stacks: https://www.sarvam.ai/blogs/sarvam-30b-105b
- Official Sarvam announcement dated 2026-11-22 confirms Sarvam-105B-1711, BF16 and NVFP4 variants and voice-agent/tool-use positioning: https://www.sarvam.ai/blogs/sarvam-105b-1711
- Sarvam Hugging Face organization currently lists model artifacts including 30B, 105B and GGUF/FP8 variants: https://huggingface.co/sarvamai/models
- Current secondary Chinese model trackers list Qwen, DeepSeek, GLM, Kimi, MiniMax, MiniCPM, Tencent and other families; every candidate still requires primary model-card/license verification before adoption:
  - https://insidechinaai.com/model-tracker/
  - https://infro.io/blog/chinese-open-weight-models-guide-2026
  - https://gptx.io/guides/chinese-ai-models/

## Required next research steps (do not mark complete until evidenced)
- [ ] Build a candidate matrix with official model card, exact checkpoint, parameter/active parameter count, quantizations, license, context, languages, modalities and download size.
- [ ] Search ModelScope, OpenI, GitCode, Gitee and AtomGit directly, not only GitHub/Hugging Face.
- [ ] For each phone candidate, inspect Android sample/app, runtime backend, JNI/native dependencies, ABI, minimum Android API, RAM and storage requirements.
- [ ] Download only license-cleared candidate artifacts; hash and scan them; do not commit model weights to Git.
- [ ] Run reproducible OPPO Find X6 Pro benchmarks: load success, peak RSS, TTFT, tokens/sec, thermal/battery and Russian command accuracy.
- [ ] Compare small local model against deterministic intent routing for latency/reliability.
- [ ] Evaluate Sarvam-105B-1711 only as server/workstation reference or teacher candidate, not as an assumed mobile runtime.
- [ ] Add findings and source hashes to the project research index and handoff after each verified batch.

## Guardrails
- "Open weights" is not synonymous with OSI open source or unrestricted use. Read each license.
- Do not rely on vendor benchmark claims alone; reproduce task-specific tests.
- Do not call any model "uncensored" or unrestricted without checking its license, behavior and applicable law.
- No proprietary OPPO/Breeno code porting; OGAM remains a clean-room implementation.
- This register is a starting point. It does not claim that the listed models have been downloaded, run, benchmarked or integrated.


## Expanded global scan — 2026-11-22 (new findings)
This section records a fresh web scan. It is a discovery snapshot, not independent validation of vendor claims.

### New/updated model and infrastructure signals
- Qwen official site lists Qwen4-Max announced 2026-11-16, with a 2.4T-parameter backbone, native vision and 1M context. Treat as hosted/flagship research reference until downloadable weights and a small mobile checkpoint are verified: https://qwen.ai/
- Qwen Cloud changelog lists Qwen3.8-Flash with EU Frankfurt deployment, vision, function calling and 1M context; qwen-audio-3.1-realtime-flash supports duplex speech input/output and function calling; qwen-audio-3.1-tts-next unifies speech and sound generation. These are service endpoints, not proof of local weights: https://docs.qwencloud.com/changelog/models
- The same changelog describes DeepSeek V4 Flash as 284B total / 13B active with 1M context. Active parameter count does not equal phone RAM requirement; expert weights still need to be present or streamed.
- Sarvam-105B-1711 official release dated 2026-11-22 reports 160K context, BF16 and 65GB NVFP4 weights, plus improvements on its own conversational-agent benchmarks. This is server/workstation class, not an OPPO local model: https://www.sarvam.ai/blogs/sarvam-105b-1711
- Sarvam Token Factory announcement (2026-11-16) describes India-hosted inference and reports its own latency/throughput comparisons for Gemma 4, GLM 5.3 and DeepSeek V4.1 Flash. Treat these as provider-reported benchmarks, not independent evidence: https://www.sarvam.ai/blogs/sarvam-token-factory
- Google LiteRT production-stack announcement (2026-01-28) describes hardware acceleration, supported model families including Gemma/Qwen/Phi/FastVLM, and an example Galaxy S25 Ultra comparison against llama.cpp. Must reproduce on OPPO hardware before selecting a backend: https://developers.googleblog.com/en/litert-the-universal-framework-for-on-device-ai/
- Tencent WeMM-Video-4B surfaced in a 2026-11-20 report as an audio-visual model. Investigate only if an official model card and usable weights can be verified; not yet an approved Jarvis dependency.
- Autumn 2026 open-weight release tracker reports Kimi K3.1 Pro weights, Arete-27B, Ripple-65B-Preview and LFM3 small models. Secondary source only; verify each candidate against its canonical Hugging Face/org model card, exact revision and license before use: https://gpuwerk.com/blog/open-weight-llm-releases-autumn-2026/

### Comparative testing protocol — mandatory
Never choose a model from release date, parameter count or vendor benchmark alone. Maintain a reproducible scorecard with:
1. Russian task quality: command understanding, ambiguity resolution, multi-turn follow-through, names/addresses, colloquial speech and noisy ASR transcripts.
2. Agent quality: correct tool selection, valid structured arguments, plan completion, recovery after tool errors, refusal to take unauthorized actions.
3. Reliability: 30 repeated runs per critical task, success rate, variance, timeout and crash rate.
4. Speed: cold start, model load, time-to-first-token, prefill, decode tokens/sec, end-to-end voice response latency.
5. Device cost: peak RSS, storage, thermal throttling after 10/30 minutes, battery drain per 100 interactions, offline operation.
6. Multimodal: screen/UI understanding, screenshot grounding, OCR, image/audio input if supported.
7. Runtime compatibility: exact Android API, arm64 ABI, llama.cpp / LiteRT / MNN / QNN / ExecuTorch support, quantization and operator coverage.
8. License and supply chain: weight license, code license, commercial/redistribution terms, source revision, artifact SHA-256, dependency and model provenance.

### Benchmark design
- Use one frozen Russian task set and identical system/tool prompts across candidates.
- Separate local-only tests from cloud/API tests; never compare their latency or privacy as if equivalent.
- Run a first-stage desktop/emulator smoke test, then an OPPO Find X6 Pro (PGEM10, Android 16 / ColorOS 16.0.5) device test.
- Compare model families at matched memory budgets (e.g. 1–2B, 3–4B, 7–8B quantized) and include a larger cloud reference.
- Include deterministic intent/rule baseline. A model must beat the baseline on quality without unacceptable latency or unsafe tool calls.
- Report mean, median, p95, success percentage and hardware/software configuration. Keep raw logs with secrets and personal data redacted.
- Do not promote a candidate to production based on a single successful demo.

### Current assessment
- Best next local candidates to investigate: small Qwen checkpoints, MiniCPM small checkpoints, Gemma small checkpoints and other verified 1–4B multilingual-capable models. No winner selected.
- Best cloud/reference candidates: Qwen3.8-Flash, DeepSeek V4 Flash, GLM 5.3 and Sarvam-105B-1711, subject to region, cost, privacy and API terms.
- Voice research must separately compare Russian ASR and TTS; an impressive Indic-language model is not evidence of Russian speech quality.
- LiteRT is now a first-class backend candidate alongside llama.cpp, MNN and Qualcomm QNN. Backend selection remains open until PGEM10 benchmarks.

### Search coverage and limitations
This scan included official Qwen and Sarvam release pages, Qwen Cloud changelog, Google Developers, and secondary model trackers. It is not literally every internet source. Direct crawling of all China/India code forges (GitCode, Gitee, AtomGit, ModelScope, OpenI) and full source audits of newly discovered projects remain outstanding. Continue in batches, record source URLs/revisions and avoid claiming exhaustive coverage.


## Android implementation audit — 2026-11-22

This batch inspected repository READMEs, selected source files and license files through GitHub. It is a source audit, not a local build or device test.

### 1) PocketWisdom / pocketpal-ai-zh (Chinese PocketPal fork)
- Repository: https://github.com/yzfly/pocketpal-ai-zh (branch observed: chinese).
- License file declares MIT, but the README says the project derives from PocketPal; audit upstream notices and all bundled dependencies before copying code. The fork's package manifest identifies React Native 0.87.1, llama.rn 0.13.0-rc.9, ONNX Runtime React Native 1.23.2, local speech packages, WatermelonDB and local model management.
- README describes offline GGUF inference, vision, Whisper-based speech input, local TTS, tools, local OpenAI-compatible API, benchmark UI, hardware acceleration and update manifest with SHA-256 verification. These are maintainer claims; feature-by-feature source audit and runtime verification remain outstanding.
- Strategic value: use as a feature inventory and architecture reference, especially model library UX, model recommendation, offline speech, benchmark UX and resilient update flow. Do not import its whole React Native stack into OGAM (Kotlin/Compose); port requirements and independently implement/adapt compatible modules.
- Model catalogue includes claimed Qwen3.5, MiniCPM5, Ling 3.0 Tiny and specialist models. Every exact weight artifact, upstream card, hash, license and Russian performance must be checked independently.

### 2) Native-LLM-for-Android
- Repository: https://github.com/DakeQQ/Native-LLM-for-Android.
- Repository LICENSE file is Apache-2.0.
- README lists Qwen3.5/Qwen3/Qwen-VL, MiniCPM, Gemma, Phi, Llama, InternVL, Seed-X and Tencent Hunyuan families, with ONNX export/quantization workflow and device throughput tables.
- The published measurements are author-reported on named devices and CPU backends; they are not transferable to OPPO Find X6 Pro. README shows useful architecture and benchmark patterns, but this pass did not build the app, download weights or validate the numbers.
- Strategic value: compare ONNX Runtime path against llama.cpp and LiteRT, particularly model export, dynamic quantization, low-memory mode and small multimodal models. Before reuse, inspect source-level operator coverage, model conversion scripts, dependencies, ABI and runtime license notices.

### 3) SmolChat-Android
- Repository: https://github.com/shubham0204/SmolChat-Android.
- README describes a Kotlin Android app using llama.cpp through C++ JNI, GGUF model files, chat/task flows and local model management. The inspected SmolLM.kt carries Apache-2.0 header.
- Inspected CMakeLists.txt: builds native llama.cpp targets for ARM variants and selects CPU-specialized shared libraries; includes CPU feature detection for FP16, dot-product, SVE and I8MM in Kotlin loader code. This is a concrete implementation pattern worth adapting for robust CPU dispatch, with careful validation of supported instructions on target hardware.
- Strategic value: strongest immediately reusable reference for a native Kotlin/JNI architecture aligned with OGAM. Do not copy blindly: check current llama.cpp submodule revision, CMake flags, NDK/AGP versions, ABI filters, model lifecycle, cancellation, streaming and memory cleanup.

### 4) Google LiteRT-LM — current backend and speech candidate
- Repository: https://github.com/google-ai-edge/LiteRT-LM; inspected README and Apache-2.0 LICENSE.
- Current README reports v0.19.0 with Kotlin/Android support, multimodal audio/image input, tool use, GPU/NPU acceleration and speech-model integration including Qwen3-ASR, Kokoro and Qwen3-TTS. The release note also flags a breaking C API 1.0.0 change; pin a tested version rather than tracking main.
- Official repository mirror/source page: https://chromium.googlesource.com/external/github.com/google-ai-edge/LiteRT-LM/
- LiteRT community Qwen3-ASR-1.7B card describes a 2.69 GB .litertlm package, 30-language recognition including Russian, and GPU-oriented graph changes dated 2026-11-17. Reported phone performance is on Galaxy S26 / Pixel 11 Pro, not OPPO; the listed evaluation languages for the particular performance table are English, Mandarin and Japanese, so Russian accuracy remains unproven.
- Qwen3-TTS 0.6B LiteRT card reports a 2.24–2.44 GB package and recommends devices with at least 4 GB memory. This is likely too large to bundle with the main Jarvis app and a local LLM on many configurations; test memory coexistence and consider on-demand download/unload.
- Strategic value: promote LiteRT-LM from a backend candidate to a required prototype track for speech + on-device agent/tool use. Keep llama.cpp as a parallel baseline. Do not switch production backend before testing on PGEM10.

### 5) Qwen3-ASR and Russian voice
- Official Qwen3-ASR repository lists Russian among supported languages for 0.6B and 1.7B variants and documents offline/streaming modes: https://github.com/QwenLM/Qwen3-ASR
- This is a high-priority Russian ASR candidate. Need compare 0.6B vs 1.7B on a frozen Russian speech set with accents, noisy environment, names, commands and latency. A language being listed as supported is not a quality benchmark.
- Candidate LiteRT conversion: https://huggingface.co/litert-community/Qwen3-ASR-1.7B
- Candidate Qwen3-TTS LiteRT conversion: https://huggingface.co/litert-community/Qwen3-TTS-12Hz-0.6B-Base

### Decision update
- No model or runtime is selected as the winner.
- Immediate prototype shortlist: (A) Kotlin/JNI + llama.cpp using SmolChat's CPU-dispatch pattern; (B) LiteRT-LM Kotlin runtime for local agent + Qwen3-ASR/TTS; (C) ONNX Runtime as a comparison path for selected vision/speech specialists.
- PocketWisdom is a feature/UX reference, not the preferred app framework for OGAM.
- Next source-audit batch: inspect official LiteRT-LM Android sample APIs and model loading lifecycle; inspect Qwen3-ASR 0.6B and Russian evaluation setup; inspect Qwen3-TTS Android repository; audit PocketPal upstream and dependency licenses; inspect DakeQQ export scripts and runtime integration.
- Required device gates: verify PGEM10 ABI/SoC and available memory; build minimal sample APKs; measure load/TTFT/tokens-per-second/ASR real-time factor/TTS generation speed/peak RSS/thermal/battery; run offline and permission-safety tests. No APK build, download, installation or PGEM10 benchmark was performed in this batch.


## Android voice implementation audit — additional batch 2026-11-22

### Qwen3-TTS Android reference
- Repository: https://github.com/Danmoreng/qwen3-tts-android
- Repository LICENSE declares MIT. README describes a Jetpack Compose app using qwen3-tts.cpp through JNI, app-private model storage, voice profiles, local generation history, playback/stop/delete and WAV export.
- Inspected app/build.gradle.kts: compileSdk/targetSdk 36, minSdk 31, JDK 17, arm64-v8a only, optional OpenMP/Vulkan/OpenCL build flags.
- Inspected app/src/main/cpp/CMakeLists.txt: builds native GGML components and a qwen3_tts_jni shared library; optional Vulkan and OpenCL paths are wired as build options, defaulting OFF. This is a practical small reference for separating TTS from the main Jarvis application and exposing runtime acceleration choices.
- Limitations: CPU path is the documented default; optional GPU paths need device-specific validation. The README lists Q4_K_M model artifacts but this audit did not fetch weights or compile the project. The app targets API 31+, so it is compatible in principle with Android 16 but not proof of ColorOS/OPPO compatibility.
- Jarvis decision: retain as a standalone TTS prototype reference; do not merge as a full application. Compare its CPU Q4 path with LiteRT-LM Qwen3-TTS and Piper/Kokoro on Russian pronunciation, streaming latency, voice naturalness, memory, thermal and license.

### Qwen3-ASR official source correction
- Official repository: https://github.com/QwenLM/Qwen3-ASR
- README states the family comprises 0.6B and 1.7B ASR models and lists Russian in the supported language table. It describes both offline and streaming inference and links official Hugging Face and ModelScope collections.
- The README contains two different language-count descriptions: its overview says 52 languages/dialects, while the detailed table lists 30 named languages plus 22 Chinese dialects. Record this wording discrepancy; Russian is explicitly named in the table.
- Vendor claims about accuracy/throughput are not independent benchmarks. The model card and local Android conversion must be checked separately; Python/vLLM support does not imply a native Android runtime.
- Jarvis decision: add Qwen3-ASR-0.6B and 1.7B as high-priority Russian ASR candidates. First prototype should measure streaming partial transcript latency and Russian command WER/CER under controlled noise, then compare against existing Whisper/Sherpa candidates.

### Fresh LiteRT model artifact signals
- LiteRT community Qwen3-ASR-1.7B card: https://huggingface.co/litert-community/Qwen3-ASR-1.7B. The card reports a 2.69 GB bundle, 30-language card metadata, Russian included, and GPU graph changes dated 2026-11-17. Device performance examples are on Galaxy S26/Pixel 11 Pro, not PGEM10.
- LiteRT community Qwen3-TTS 0.6B card: https://huggingface.co/litert-community/Qwen3-TTS-12Hz-0.6B-Base. It reports a 2.24–2.44 GB package and recommends at least 4 GB device memory. Treat as on-demand speech model; measure memory contention with Jarvis LLM before selecting it.
- Qwen3.5 9B GGUF surfaced on ModelScope as Apache-2.0, llama.cpp-compatible and around 5.29 GiB for Q4_K_M plus a separate vision projector. This is a large reference model, not a default phone candidate. Prefer smaller exact checkpoints and verify upstream canonical artifacts/hashes.

### Updated next-step priorities
1. Prototype the Qwen3-ASR 0.6B path first; compare LiteRT conversion availability and native runtime support with Sherpa/Whisper.
2. Prototype Qwen3-TTS Android separately, with model download only on demand and guaranteed unload when memory pressure rises.
3. Compare LiteRT-LM vs llama.cpp on the same exact model/task set, with CPU and GPU paths separated.
4. Inspect the exact LiteRT-LM Kotlin sample API, Android packaging, model metadata and lifecycle before changing OGAM dependencies.
5. Keep all voice modules replaceable behind internal ASR/TTS interfaces; do not bind the assistant core to one vendor runtime.
6. Do not mark any of these as integrated or device-tested until a reproducible build and PGEM10 run are recorded.

## OPPO Snapdragon 8 Gen 2-specific speech path — source audit 2026-11-22

### Exact Qwen3-ASR artifact split
Official LiteRT-LM Omni source and model card now provide a much clearer integration picture:
- The 960 MB INT8 qwen3_asr_0.6b_5s_i8.litertlm package is the easiest complete ASR prototype for CPU/GPU via LiteRT-LM Omni. It includes audio front-end, Qwen3 decoder, tokenizer and metadata; the model card describes 5-second sliding windows, overlap, early partial hypotheses and seam reconciliation.
- A separate 794 MB .tflite INT8 graph is provided for direct LiteRT SDK integration.
- The SoC-specific AOT NPU artifacts are .tflite, not .litertlm, and use FP32 variants listed at 1.88–2.19 GB. The card lists Qualcomm_SM8550 (Snapdragon 8 Gen 2) explicitly. Therefore do not assume the 960 MB INT8 bundle automatically runs on NPU; NPU is a separate direct-LiteRT integration track with a much larger artifact and device delegate/plugin requirements.
- Russian is explicitly listed among supported languages. This establishes advertised language support, not Russian command accuracy.
- Official card: https://huggingface.co/litert-community/Qwen3-ASR-0.6B
- Official Omni implementation guide: https://github.com/google-ai-edge/LiteRT-LM/blob/main/omni/docs/Qwen3-ASR-0.6B.README.md

### LiteRT-LM Omni code architecture
- Current LiteRT-LM source version.bzl reports in-development VERSION 0.20.0 and LiteRT 2.4.0. This is a source-tree version, not a guarantee that Maven artifacts of that version are already published. Pin a published Maven release for an Android build.
- omni/README.md explicitly labels LiteRT Omni an EXPERIMENTAL effort. It exposes a C++ OmniEngine/OmniSession interface and supports ASR, TTS, text-to-image and multimodal Any-to-Any models.
- The documented Android route in Omni README is a Bazel-built ARM64 command-line runner plus native shared libraries and model files pushed to /data/local/tmp; it is not a ready-made stable Kotlin Android SDK integration.
- OmniSession supports push-based streaming input, ProcessAsync callbacks, ProcessNext, Flush, and explicit end-of-input. ASR outputs separate confirmed_text and unconfirmed_text, which maps well to live captions and low-latency command capture.
- AudioInputMetadata defaults to 16 kHz mono; audio samples are float PCM. App integration must handle microphone capture, resampling, lifecycle, cancellation and conversion to PCM correctly.
- OmniEngine::Settings supports CPU/GPU/NPU, thread count, model/cache paths, remote model URLs, and NPU dispatch library directory. Model/cache files should be stored app-private and model downloads hash-verified.
- omni/speech2text/qwen3_asr.cc registers Qwen3-ASR 0.6B and 1.7B names and builds the audio encoder, tokenizer and LM decoder as a multi-stage streaming pipeline.
- Official source references:
  - https://github.com/google-ai-edge/LiteRT-LM/blob/main/omni/README.md
  - https://github.com/google-ai-edge/LiteRT-LM/blob/main/omni/omni_engine.h
  - https://github.com/google-ai-edge/LiteRT-LM/blob/main/omni/omni_session.h
  - https://github.com/google-ai-edge/LiteRT-LM/blob/main/omni/base/io_types.h
  - https://github.com/google-ai-edge/LiteRT-LM/blob/main/omni/speech2text/qwen3_asr.cc

### Qwen3-TTS revised size and Russian evidence
- The current LiteRT community card lists qwen3_tts_int8_v2.litertlm at 2.44 GB and INT4 at 2.24 GB. Both include Talker, MTP drafter, codec decoder, tokenizer and speaker embedding. Russian is explicitly supported.
- The card reports near-real-time RTF on Galaxy S26 (GPU 1.24, CPU 1.29) and peak memory around 1.44 GB GPU / 1.90 GB CPU. These are vendor/community card figures for a different phone; do not extrapolate to PGEM10.
- The v2 bundle requires a runtime supporting the newer per-head MTP signatures; the card says v1 bundles remain for older runtimes. Pin matching model/runtime versions.
- TTS language config is BCP-47 (ru-RU); the official Omni proto exposes language, voice and streaming text chunk config.
- Card: https://huggingface.co/litert-community/Qwen3-TTS-12Hz-0.6B-Base
- Runtime config: https://github.com/google-ai-edge/LiteRT-LM/blob/main/runtime/proto/text2speech_session_config.proto

### Revised OGAM decision
1. First build the 960 MB Qwen3-ASR INT8 LiteRT-LM Omni CPU/GPU prototype. It has the clearest single-file streaming ASR path and avoids premature NPU complexity.
2. In parallel, test a separate SM8550 AOT NPU .tflite prototype only after verifying the OPPO firmware's LiteRT/QNN/Qualcomm delegate compatibility and available NPU dispatch libraries. It is not a drop-in replacement for the .litertlm package.
3. Treat Omni as an experimental C++ subsystem wrapped behind OGAM's internal ASR interface; keep Sherpa/Whisper fallback and do not couple the main Jarvis planner to LiteRT-specific types.
4. Evaluate Qwen3-TTS only as an on-demand optional voice package; its 2.24–2.44 GB storage size and ~1.4–1.9 GB reported peak memory make it unsuitable for unconditional preloading alongside a local LLM until PGEM10 measurements prove otherwise.
5. Do not use a latest.release dependency in reproducible builds. Resolve and pin an actually published Maven version and compatible Kotlin metadata; record Gradle/AGP/Kotlin/NDK/Bazel/LiteRT versions together.
6. Benchmark three distinct routes: (A) Qwen3-ASR INT8 Omni CPU; (B) Qwen3-ASR INT8 Omni GPU; (C) SM8550 AOT NPU .tflite. Record cold/warm load, first partial transcript, stable transcript latency, Russian WER/CER, peak RSS, CPU/GPU/NPU utilization if available, thermal throttling, battery and offline behavior.
7. Before any model download/build on the user's device, build a small reproducible APK/runner and confirm storage headroom, model hashes, network-resume behavior and explicit user consent.

### Current limitations
- This was a GitHub source/model-card audit only. No weights were downloaded, no Android binary was built, no model was run, no NPU delegate was loaded and no OPPO Find X6 Pro measurement was performed.
- omni/README.md labels Omni experimental. The Android command-line runner instructions prove an ARM64 route, not a production-ready Kotlin embedding API.
- NPU availability is not established merely by the Snapdragon model suffix: actual OPPO firmware, driver versions, vendor dispatch libraries, delegate support and permissions must be checked.

## Additional Android local-agent code audit — India-oriented search batch 2026-11-22

### KarthikeyaSuppa/fini — Kotlin + llama.cpp reference
- Repository: https://github.com/KarthikeyaSuppa/fini
- Repository README describes a privacy-first Android finance app with Qwen3-0.6B local inference, llama.cpp JNI, Jetpack Compose, Room/SQLCipher, background work, and typed domain tools. The author appears in India-oriented repository discovery, but this does not establish that the model or technology originated in India.
- Important licensing caveat: README says MIT, but the inspected repository path did not contain a LICENSE file. Treat source reuse as NOT CLEARED until a canonical license file and upstream notices are confirmed. Use this as a read-only architecture reference only for now.
- Inspected Kotlin LlamaEngine: singleton lifecycle, coroutine Dispatchers.IO, Mutex serialization around the native context, StateFlow status, initialization timing, warm-up test, and bounded conversation history. These are useful patterns for OGAM's single-model runtime coordinator, but lifecycle gaps (e.g. native context release/reset behavior) need deeper audit before adaptation.
- Inspected LlamaJNI: loads GGML core, attempts CPU backend libraries in descending ARM ISA order, loads llama and JNI bridge, and exposes backend registration separately. CMake links prebuilt llama.cpp b9482 libraries and vendored matching headers. This is a useful Android linker/CPU-backend lesson: dynamic GGML CPU backend discovery is more subtle than simply packaging .so files.
- Inspected ChatBotAgent / FinancialIntentParser: deterministic intent parsing is kept separate from data mutation operations, and tool contracts are represented as JSON schema plus a registry. This supports Jarvis' hybrid approach: deterministic command routing for known actions, LLM only for ambiguity/planning.
- Safety review: ToolRegistry exposes a password-vault search tool to the LLM, even though its description says it does not reveal passwords. BatchEditTool returns a proposal summary and target IDs rather than directly changing records in its execute method. This proposal/confirmation pattern is worth preserving. OGAM must apply stricter permission checks, user confirmation and audit logs to all high-impact Android actions.
- ModelDownloader audit found resumable Range downloads and temporary-file handling, but the inspected implementation verifies only received length before rename and does not perform SHA-256/signature verification. Do NOT copy this downloader as-is. Jarvis model distribution must require pinned artifact URL, expected size, SHA-256, license metadata, safe redirect policy, partial-file validation and atomic promotion only after hash verification.
- README claims Qwen3-0.6B but downloader constants shown in source include a Qwen2.5-0.5B GGUF default; model metadata/actual selected artifact must be verified instead of trusting the README headline.
- Useful source files:
  - https://github.com/KarthikeyaSuppa/fini/blob/master/app/src/main/kotlin/com/fini/data/llm/LlamaEngine.kt
  - https://github.com/KarthikeyaSuppa/fini/blob/master/app/src/main/kotlin/com/fini/data/llm/LlamaJNI.kt
  - https://github.com/KarthikeyaSuppa/fini/blob/master/app/src/main/kotlin/com/fini/data/llm/ModelDownloader.kt
  - https://github.com/KarthikeyaSuppa/fini/blob/master/app/src/main/kotlin/com/fini/data/chatbot/ChatBotAgent.kt
  - https://github.com/KarthikeyaSuppa/fini/blob/master/app/src/main/kotlin/com/fini/data/chatbot/tools/ToolRegistry.kt

### Adoption decision
- No source code from fini is approved for copying at this stage because the repository license file was not found in this audit.
- Port the architecture lessons only: serialized native inference access, observable model lifecycle state, explicit warm-up, deterministic intent parser before LLM, typed tool registry, proposal/confirmation for destructive operations, and robust model-download integrity.
- Add negative tests for missing hash, mismatched file size, malicious redirect, interrupted resume, corrupt GGUF, unavailable backend, concurrent generation, cancellation and native context cleanup to OGAM's model manager test plan.


## OGAM in-repository source audit — correction and implementation baseline (2026-11-22)

A direct audit of PR #1's actual feature branch changed the next-step priority. OGAM already has Qwen3-ASR and LiteRT-LM integration; this is not a greenfield addition.

### Existing Qwen3-ASR integration in OGAM PR #1
- Branch: feature/jarvis-step-2-storage-privacy; inspected HEAD 67159e2f821b14616eebcaf0e6da997633cd7aa4. PR #1 remains open/draft, not merged.
- src/services/qwenAsrModel.ts selects catalog entry ggml-org/Qwen3-ASR-0.6B-GGUF; it expects a primary GGUF and paired mmproj audio projector.
- src/services/whisperModelDownloads.ts downloads both files, uses exact catalog byte sizes and SHA-256 values, and routes through the shared background download queue.
- src/services/qwenAsrEngine.ts loads via llama.rn initLlama, initializes the audio projector, uses 4096 context tokens and caps transcript output at 1024 tokens. Android explicitly uses CPU (devices: ['CPU'], n_gpu_layers: 0); iOS uses Metal. This is not the SM8550 NPU path.
- The selected language is prefixed before <asr_text>; the existing test covers Russian language selection. No user/domain hotwords/context object was found in this source pass.
- Qwen3-ASR is not live-streaming in the current service: it records a WAV and transcribes after stop. Whisper's realtime path remains separate.
- On Qwen failure, whisperService.ts releases Qwen's context, loads a compatible downloaded Whisper model and reports fallback. Native work is serialized to protect model contexts.
- __tests__/integration/audio/qwen3AsrTranscription.rendered.test.tsx covers model cards, paired downloads, checksum forwarding, memory guard, Russian language prompt, composer output and fallback. The native llama.rn boundary is mocked, so these are integration/contract tests, not real speech-quality or device benchmarks.
- The test comments show a 3 GB catalog admission floor. This is not measured memory usage or proof that the target PGEM10 can sustain Qwen plus the rest of the app.

### Existing LiteRT-LM Android integration in OGAM PR #1
- android/app/build.gradle already pins com.google.ai.edge.litertlm:litertlm-android:0.19.1; do not add another copy or switch to latest.release.
- android/app/src/main/java/ai/offgridmobile/litert/LiteRTModule.kt wraps the official Kotlin Engine/Conversation API and can build Content.AudioBytes from complete WAV container bytes.
- In the inspected native module, the audio submodel is explicitly configured to CPU (audioBackend = Backend.CPU()), while the main model engine supports CPU/GPU/NPU tiers.
- src/services/litert.ts currently downgrades requested NPU selection to GPU and then CPU in this release. Native NPU initialization/fallback code exists, but the JS layer does not expose it as an active production selection.
- Thus OGAM already has a general LiteRT Kotlin audio-input bridge, but this does not prove that the special Qwen3-ASR Omni .litertlm artifact can load in the ordinary Engine/Conversation API or provide streaming ASR. Prove exact artifact/API compatibility with a minimal real inference first.

### Corrected LiteRT integration distinction
- General LiteRT-LM Android Kotlin Engine/Conversation API: official Android documentation provides model lifecycle, streaming text generation, GPU/NPU backend configuration and tool registration. Guide: https://developers.google.com/edge/litert-lm/android
- Qwen3-ASR LiteRT Omni: special self-contained package intended for LiteRT-LM Omni OmniEngine/omni_runner, with separate C++ experimental architecture. Do not assume it is interchangeable with an ordinary chat model .litertlm bundle.
- Qwen3-ASR direct LiteRT graph: standalone .tflite requires host-side preprocessing and tokenization; SoC-specific AOT NPU graphs are separate, larger FP32 artifacts. The model card lists Qualcomm_SM8550 as a target family: https://huggingface.co/litert-community/Qwen3-ASR-0.6B
- Current OGAM Qwen3-ASR GGUF path is a third separate route through llama.cpp/llama.rn.

### Hotwords/context issue — newly identified blocker
- LiteRT-LM issue #4360 is open and reports that Qwen3-ASR Omni does not expose system-context/hotwords input. The reporter's synthetic English alphanumeric-code test showed exact code accuracy increasing from 13/31 to 21/31 after a local context-prefill patch; later numbers in the issue include additional export changes and are not an independent benchmark. Issue: https://github.com/google-ai-edge/LiteRT-LM/issues/4360
- Jarvis needs local context for Russian names, app names, places, device labels and mixed Cyrillic/Latin codes. This should be tested first on the already integrated llama.rn Qwen path; the LiteRT Omni route must be evaluated separately.
- Context terms must be optional, bounded, local-only, excluded from analytics/logs, and never uploaded or synced by default.

### Updated decision and next steps
1. Do not build a second Qwen3-ASR implementation from scratch. First extend the existing llama.rn Qwen3-ASR path with a typed, bounded hotwords/context option after confirming the GGUF chat-template semantics.
2. Keep current Whisper fallback, paired-file SHA-256 validation, memory gate and native lifecycle protections.
3. Add Russian audio benchmark corpus and real acoustic metrics; current mocked tests do not establish WER/CER or actual runtime performance.
4. In parallel, use the existing LiteRT-LM 0.19.1 Kotlin bridge for a compatibility spike. Do not assume Omni .litertlm is accepted by regular Engine/Conversation.
5. If needed, isolate Omni C++ via JNI/ARM64 runner behind a replaceable ASR interface. Keep it experimental until tested.
6. Only test the SM8550 AOT NPU graph after confirming OPPO firmware, driver/delegate and QNN/LiteRT runtime compatibility.
7. Implementation-level detail and acceptance gates are recorded in research/models/OGAM_QWEN_ASR_NEXT_IMPLEMENTATION_PLAN_2026-11-22.md.

### Verification boundary
This was a read-only source audit through GitHub. No model weights were downloaded, no new code was changed in the OGAM application, no APK/runner was built, and no acoustic benchmark or PGEM10 test was performed.


### Official Qwen3-ASR chat-template confirmation — 2026-11-22
- Current Hugging Face Transformers documentation explicitly documents free-form context/hotwords for Qwen3-ASR via a system-role text message (example: Vocabulary: Quilter, apostle, gospel.) preceding the user audio message. It also documents forced-language assistant prefill as language <NAME><asr_text>.
- This is stronger than the earlier inference from LiteRT issue #4360: the base Qwen3-ASR model itself supports contextual vocabulary; the missing feature is specifically an API gap in the current LiteRT Omni implementation.
- This gives OGAM's existing llama.rn Qwen3-ASR path a concrete implementation hypothesis: pass a bounded system text message plus the audio user message, and preserve the existing language prefill. Validate the exact formatted multimodal prompt and runtime behavior in tests before release.
- Official docs: https://huggingface.co/docs/transformers/main/model_doc/qwen3_asr (sections Context / hotwords and Chat template).
- The GGUF conversion model card also notes that this architecture needs a sufficiently recent llama.cpp build with Qwen3-ASR support (references upstream llama.cpp PR #32571). OGAM already has an engine-build compatibility gate in qwenAsrModel.ts; verify the pinned custom llama.rn build actually satisfies it, rather than trusting only the package version.


## Fresh ASR implementation findings — exact llama.rn pin and llamadart streaming reference (2026-11-22)

- OGAM package manifest pins @ogai/llama.rn 0.13.0-b12560, which maps to llama.cpp tag b12560 (commit 2d8d003, 2026-11-20 07:36 UTC). Qwen3-ASR converter/template correction PR #32571 is commit 9197945 (2026-11-20 20:54 UTC), included in b12597 but not b12560. The correction moves the detected-language marker into the thinking block and reads the shared canonical Qwen3-ASR Jinja template. This is a converter/template delta, not proof that the b12560 runtime cannot execute Qwen3-ASR. Test the exact GGUF and prompt on current pin before changing the bridge.
- New MIT reference: leehack/llamadart 0.20.5 (Dart/Flutter, not a drop-in React Native dependency). Its typed SpeechToTextEngine boundary and Qwen3WindowedAsrAdapter provide a valuable pattern: mono 16 kHz normalized float PCM, bounded 8-second ring buffer, re-decode checkpoints at 2/4/6 seconds, replaceable pending text, stable confirmed text, quiet-boundary commit or hard cut at 8 seconds.
- Llamadart's own current docs say Qwen3 windowed ASR does not accept context prompts or language hints. Its support matrix reports only English real-model evidence on macOS arm64 CPU for this adapter; no Android/OPPO/Russian evidence. Its noise/quiet suppression can drop whispered, robotic, low-pitched or otherwise quiet speech; continuous speech/noise can force a hard cut mid-word. Port algorithmic concepts only after testing, not the full DSP policy.
- Jarvis decision: retain OGAM's current whole-file Qwen3-ASR + Whisper fallback as the safe baseline; add bounded Russian hotword context to whole-file Qwen first; investigate windowed streaming as a separate opt-in adapter and require Russian + PGEM10 evidence before production.
- Sources: https://github.com/off-grid-ai/llama.rn-evergreen; https://github.com/ggml-org/llama.cpp/commit/919794500475862f6768c353255469dc661cb734; https://github.com/leehack/llamadart; https://llamadart.leehack.com/docs/guides/speech-to-text


### Qwen3-ASR GGUF template revision caution (2026-11-22)
The currently indexed official ggml-org Qwen3-ASR 0.6B GGUF files predate llama.cpp converter PR #32571 (the public mmproj file page shows upload commit 928ab95 from about three weeks earlier). That PR says existing GGUFs need re-conversion to move the detected-language marker into the thinking block and use the shared canonical template. The public mmproj is 214 MB with SHA-256 41a342b5e4c514e968cb756de6cd1b7be39eff43c44c57a2ef5fc6522e36603d. This hash is not assumed to equal OGAM's catalog entry until compared. Pin the exact model revision and compare primary/projector hashes before updating catalog or runtime. Sources: https://huggingface.co/ggml-org/Qwen3-ASR-0.6B-GGUF/blob/main/mmproj-Qwen3-ASR-0.6B-Q8_0.gguf; https://github.com/ggml-org/llama.cpp/commit/919794500475862f6768c353255469dc661cb734
