# OGAM / Jarvis — Qwen3-ASR and LiteRT next implementation plan
**Date:** 2026-11-22  
**Status:** source-audited plan; no new runtime code merged or device-tested  
**Target device:** OPPO Find X6 Pro (PGEM10), Snapdragon 8 Gen 2 / SM8550, Android 16 / ColorOS 16.0.5

## 1. Executive decision

Do not start a second ASR implementation from scratch. The current OGAM feature branch already contains a Qwen3-ASR 0.6B implementation using llama.cpp through llama.rn, plus Whisper fallback, checksummed model downloads, model residency/memory gates, Russian language selection and UI-level integration tests.

The next implementation increment should first improve and benchmark this existing path. LiteRT-LM should be a parallel experimental backend evaluation, not an immediate replacement. The Qwen3-ASR LiteRT Omni package, the general LiteRT-LM Kotlin Engine API, and the standalone AOT NPU .tflite artifact are three distinct integration targets and must not be conflated.

## 2. Exact OGAM baseline verified in source

**Repository/branch:** sokfrut-tech/OGAM, PR #1 branch feature/jarvis-step-2-storage-privacy, inspected HEAD 67159e2f821b14616eebcaf0e6da997633cd7aa4. PR #1 remains open/draft and is not merged.

### Existing Qwen3-ASR path
- src/services/qwenAsrModel.ts maps catalog entry ggml-org/Qwen3-ASR-0.6B-GGUF into the transcription model UI.
- The runtime expects two files: primary GGUF weights and matching audio projector (mmproj). Catalog size and SHA-256 values are used by the downloader.
- Model visibility is gated by engine availability, model compatibility and a minimum RAM threshold from the shared catalog. The existing UI test describes the 3 GB catalog floor; this is not a measured PGEM10 runtime result.
- src/services/qwenAsrEngine.ts loads the model using llama.rn initLlama, initializes the audio projector, uses a 4096-token context, and caps transcript output at 1024 tokens.
- In the inspected Android path, the engine explicitly selects CPU (devices: ['CPU'], n_gpu_layers: 0). iOS uses Metal. This is not an Android GPU or NPU implementation.
- Language pinning is already supported. For a selected language, the engine formats the audio user turn and prefills the language label plus <asr_text>; Russian is covered in the existing UI integration test.
- Qwen3-ASR currently records a WAV file and transcribes after the user stops recording. It does not provide the live partial transcript path that the Whisper realtime transcriber provides.
- If Qwen3-ASR fails, whisperService.ts unloads it and uses the smallest downloaded compatible Whisper model. The two model contexts are not intended to stay resident together.
- whisperService.ts serializes native work and protects context teardown to avoid overlapping native inference/release crashes.

### Existing tests and what they prove
- __tests__/integration/audio/qwen3AsrTranscription.rendered.test.tsx covers model visibility, paired-file download, checksum forwarding, RAM guard, Russian language prefix, composer output and fallback behavior.
- The test harness fakes the native llama.rn boundary and scripts transcript text. It proves UI/service wiring and contract behavior, not acoustic recognition accuracy, model runtime success, speed, NPU/GPU execution or behavior on PGEM10.
- __tests__/integration/memory/textWhisperCoresident.rendered.happy.test.tsx covers intended memory residency behavior for the Whisper sidecar; Qwen3-ASR's own fallback path unloads it before loading Whisper.

### Existing LiteRT-LM path
- android/app/build.gradle already pins com.google.ai.edge.litertlm:litertlm-android:0.19.1; do not add a second dependency or use latest.release.
- android/app/src/main/java/ai/offgridmobile/litert/LiteRTModule.kt wraps the official Kotlin Engine/Conversation API and already accepts audio-file URIs, reads complete WAV container bytes and creates Content.AudioBytes.
- The native module selects CPU for the audio submodel (audioBackend = Backend.CPU()); the text/decoder engine has CPU/GPU/NPU backend paths.
- The JS service src/services/litert.ts currently downgrades a requested NPU selection to GPU then CPU in this release. Native NPU fallback code exists, but the JS path does not expose it as an active production route.
- This proves OGAM has a general LiteRT-LM Kotlin audio-input route. It does not prove that the Qwen3-ASR Omni .litertlm bundle can be loaded by the ordinary Engine/Conversation API or that this route implements streaming ASR. That compatibility must be proven with a minimal sample before any production routing change.

## 3. New external findings that change the plan

### Google LiteRT-LM Android API
Official Android documentation shows a Kotlin API with Engine/Conversation lifecycle, streaming text generation, GPU/NPU configuration and tool registration. The model load/close lifecycle must be explicit, and initialization belongs on a background coroutine. Official guide: https://developers.google.com/edge/litert-lm/android

### Qwen3-ASR LiteRT artifact variants
The current LiteRT Community model card lists:
- 960 MB INT8 .litertlm for LiteRT-LM Omni CPU/GPU.
- 794 MB INT8 standalone .tflite for direct LiteRT SDK integration.
- 1.88–2.19 GB SoC-specific FP32 AOT NPU .tflite variants, including Qualcomm_SM8550.
- Russian among advertised supported languages.
Model card: https://huggingface.co/litert-community/Qwen3-ASR-0.6B

These are not interchangeable files. In particular, do not assume the 960 MB Omni package runs on the NPU, and do not assume the standalone graph includes all audio preprocessing/tokenizer logic.

### Context / hotwords issue
LiteRT-LM issue #4360 reports that the current Qwen3-ASR Omni path does not expose a context/hotwords input. The reporter's synthetic English alphanumeric-code test showed exact-code recognition improving from 13/31 to 21/31 with a local context-prefill patch; later numbers in the issue include additional export changes and must not be treated as an independent benchmark. The issue is open and its patch is not an upstream supported API.
Issue: https://github.com/google-ai-edge/LiteRT-LM/issues/4360

Jarvis needs a first-class context mechanism for local vocabulary: names, application names, place names, device names and user-approved custom terms. Context must be optional, bounded, local-only and redacted from logs.

## 4. Implementation work packages

### WP-A — Extend the existing llama.rn Qwen3-ASR path first
1. Add an optional typed ASR context object to the Qwen ASR service boundary, separate from the UI and from raw prompt strings. Include a bounded list of hotwords/phrases and a maximum character/token budget.
2. Preserve the existing language prefix and audio chat template exactly when no context is provided.
3. Determine the Qwen3-ASR GGUF chat-template semantics before implementing context injection. Test system-role context and safe prefix insertion; do not assume a template variant without verifying generated prompt tokens.
4. Add tests for: no-context compatibility; Russian language + hotwords; names with ё/й and declensions; Latin/number mixed codes; duplicate/oversized terms; empty/invalid Unicode; context never logged; cancellation/release while transcribing.
5. Add deterministic normalization only for grading (case/spacing/punctuation); never silently rewrite the actual transcript shown to the user.
6. Keep current Whisper fallback and memory-release behavior.

### WP-B — Create a real Russian ASR benchmark harness
Build a versioned, consent-safe, local benchmark set. Initial target: at least 100 short commands and 30 longer utterances, with reference transcripts and category labels:
- everyday assistant commands;
- app and setting names;
- personal-name placeholders / synthetic contacts;
- Russian place names and addresses;
- digits, dates, times, serials and mixed Latin/Cyrillic codes;
- noise, far-field, fast speech, pauses, accents and speech overlap.

Compare identical WAVs and language/context conditions across:
- current Qwen3-ASR 0.6B GGUF + mmproj via llama.cpp CPU;
- Whisper baseline(s) already supported by OGAM;
- LiteRT Omni Qwen3-ASR INT8 CPU;
- LiteRT Omni Qwen3-ASR INT8 GPU (only if stable on target);
- SM8550 AOT NPU .tflite path only after delegate/driver compatibility is verified.

Report WER, CER, exact entity/code accuracy, command intent accuracy, false activation, median/p95 latency, first-result latency, real-time factor, cold/warm load time, peak RSS, CPU/GPU/NPU load where observable, battery delta and thermal throttling. Record phone build, runtime version, model revision, file SHA-256, backend and test-set revision for every run.

### WP-C — LiteRT compatibility spike, not production migration
1. Reuse the existing pinned LiteRT-LM 0.19.1 Kotlin module and existing audio WAV bridge; do not duplicate Engine lifecycle or introduce another model manager.
2. Verify whether the Qwen3-ASR 960 MB Omni .litertlm bundle is accepted by the ordinary Kotlin Engine API. If it is rejected or produces no ASR transcript, stop that route; do not label it supported just because both use the .litertlm extension.
3. If ordinary Kotlin API cannot run the Omni ASR bundle, build a small isolated ARM64 JNI/Bazel omni_runner proof-of-concept behind an internal AsrEngine interface. Keep experimental code separate from the production app.
4. Verify context/hotwords support. Track upstream issue #4360 and do not ship an unreviewed local patch without an explicit maintained fork, tests and version pin.
5. Test CPU and GPU separately. The current LiteRT module's audio encoder is configured CPU-only even when the main decoder uses GPU/NPU.
6. Only attempt the SM8550 AOT NPU artifact after confirming OPPO firmware, Qualcomm QNN/LiteRT delegate libraries and the exact artifact's supported runtime. NPU artifact is a separate direct-LiteRT track.

### WP-D — Integrate only behind a replaceable interface
Keep an internal interface such as AsrEngine with capabilities/metadata, load, transcribe, cancel and release operations. Providers:
- current llama.rn Qwen3-ASR;
- existing whisper.rn;
- experimental LiteRT Omni provider;
- later SM8550 NPU provider.

The Jarvis planner and action layer must not depend on any vendor runtime. Deterministic command parsing, permission checks and confirmations remain outside the ASR model.

## 5. Acceptance gates
- [ ] Existing Qwen3-ASR path still passes all existing UI/service tests with no context.
- [ ] New hotwords/context tests pass for Russian and mixed-script commands.
- [ ] Real audio benchmark results are collected; mocked tests are clearly labelled as contract tests.
- [ ] Every downloaded model file is pinned to exact URL/revision, expected byte size and SHA-256; interrupted/corrupt downloads fail closed.
- [ ] No transcript, personal contact, hotword list or raw audio is sent to analytics or written to logs.
- [ ] ASR context is cleared on user sign-out / explicit clear and never synchronized by default.
- [ ] LiteRT model-format compatibility is demonstrated by a real inference, not extension matching.
- [ ] Backend telemetry records actual backend, including fallback; never report requested NPU when actual backend was CPU/GPU.
- [ ] Build/CI evidence, model hashes, benchmark dataset version and PGEM10 hardware/software details are committed.
- [ ] Device testing is performed only after APK/runner build, storage check and user consent.

## 6. Current blockers / honest status
- PR #1 is open/draft. Its branch has Qwen3-ASR and LiteRT work but is not merged.
- The inspected Qwen3-ASR UI tests use mocked native inference; no real audio quality benchmark was found in this pass.
- No new APK, LiteRT Omni runner or model weights were built/downloaded/run in this pass.
- No PGEM10 GPU/NPU compatibility, Qwen ASR latency, WER/CER, thermal or battery results exist yet.
- The exact Breeno Instructions 17.7.2 APK and other PR #2 outstanding gates remain separate work.

## 7. Immediate next actions
1. Audit the exact Qwen3-ASR GGUF model card/chat template and catalog artifact hashes/revisions.
2. Implement WP-A context/hotwords as a small, test-first change on the PR #1 feature branch, after checking the current service/test ownership boundaries.
3. Add a deterministic Russian benchmark manifest and audio-capture instructions; use synthetic contact names/codes first.
4. Prototype LiteRT model-format compatibility separately using the existing 0.19.1 dependency.
5. Return to PGEM10 only with a reproducible debug APK/runner and a signed-off test plan.
