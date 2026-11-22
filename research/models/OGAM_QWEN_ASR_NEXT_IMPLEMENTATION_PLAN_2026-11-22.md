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
3. Official Hugging Face Transformers docs now confirm Qwen3-ASR accepts free-form context/hotwords through a system-role text message (e.g. a Vocabulary prompt) alongside the user audio message. Prototype the same message shape through llama.rn getFormattedChat/completion, preserving the current forced-language assistant prefill. Verify the exact rendered prompt and native multimodal behavior in tests before relying on it: https://huggingface.co/docs/transformers/main/model_doc/qwen3_asr#context--hotwords.
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


## 8. Fresh source audit — pinned llama.cpp build and streaming reference (2026-11-22)

### Exact OGAM llama.cpp pin
- OGAM's package manifest pins llama.rn as npm alias @ogai/llama.rn@0.13.0-b12560.
- The official off-grid-ai/llama.rn-evergreen versioning contract says the suffix maps to the exact llama.cpp tag. Its package metadata at the inspected release confirms 0.13.0-b12560.
- The llama.cpp tag b12560 points to commit 2d8d003937b4ad42c1ada09dcdb0236eb3290a8f, dated 2026-11-20 07:36 UTC.
- The Qwen3-ASR chat-template converter correction PR #32571 is commit 919794500475862f6768c353255469dc661cb734, dated 2026-11-20 20:54 UTC, and is included in later tag b12597, not in b12560.
- Important distinction: PR #32571 changes GGUF conversion/template behavior, putting language ... in the thinking block and reading the canonical Qwen3-ASR template from the shared model template file. It is not proof that Qwen3-ASR model execution was absent from b12560. A llama.cpp issue reproducer ran Qwen3-ASR on build 12490, so model architecture support predates the converter correction.
- Action: do not blindly upgrade the native bridge. First inspect the exact catalog GGUF's conversion/template metadata and run the existing forced-language + auto-detect contract against that exact file. Then compare b12560 with a candidate b12597+ bridge build in a controlled Android smoke test. Keep package/engine pack compatibility and signed artifact validation intact.
- Sources: https://github.com/off-grid-ai/llama.rn-evergreen; https://github.com/ggml-org/llama.cpp/commit/2d8d003937b4ad42c1ada09dcdb0236eb3290a8f; https://github.com/ggml-org/llama.cpp/commit/919794500475862f6768c353255469dc661cb734; https://github.com/ggml-org/llama.cpp/releases/tag/b12597

### New open-source streaming reference: leehack/llamadart
- Repository: https://github.com/leehack/llamadart — MIT license, inspected current main tree and implementation; current package metadata says 0.20.5. It is a Dart/Flutter package, not a drop-in React Native dependency for OGAM.
- It has a typed SpeechToTextEngine boundary separate from ordinary chat generation, explicit capabilities/input modes, cancellation, bounded streaming sessions and tests. The separation is a useful architecture reference for OGAM's future ASR interface.
- Its Qwen3WindowedAsrAdapter is a particularly relevant proof-of-concept: accepts mono 16 kHz normalized Float32 PCM; keeps an 8-second/128,000-sample ring buffer; re-decodes 2/4/6-second prefixes for replaceable pending text; at 8 seconds commits at a detected quiet boundary or hard-cuts; emits stable confirmed text plus replaceable pending text.
- It includes extensive unit/lifecycle tests and opt-in real-model E2E tests. However, its own support matrix currently reports English-only real-model evidence on macOS arm64 CPU for Qwen3 windowed ASR; that is not evidence for Russian, Android, Snapdragon 8 Gen 2 or ColorOS.
- Important limitation: the documented Qwen3 windowed adapter does not support context prompts or language hints. That conflicts with Jarvis's Russian vocabulary/hotword requirement. Treat it as an algorithm reference, not as a direct solution or dependency.
- Its own docs disclose meaningful edge cases: first window commits only after 8 seconds plus inference; subsequent windows need 6.05–8 seconds plus inference; continuous speech/noise can force a hard cut across a word; quiet/whispered/robotic/low-pitched speech may be suppressed by its false-positive filter; it may perform extra decodes to validate quiet noise.
- Port only the minimal, well-tested state-machine concepts into OGAM's existing recorder/ASR boundary if benchmarks justify it. Do not copy its full DSP/noise-suppression policy without Russian speech evaluation. Preserve a mode that does not suppress quiet speech.
- Sources: https://github.com/leehack/llamadart; https://github.com/leehack/llamadart/blob/main/lib/src/core/speech/qwen_windowed_asr.dart; https://github.com/leehack/llamadart/blob/main/test/unit/core/speech/qwen_windowed_asr_test.dart; https://llamadart.leehack.com/docs/guides/speech-to-text

### Updated immediate sequence
1. Verify the exact GGUF chat-template revision and the current llama.rn b12560 behavior (auto language, pinned Russian, context/hotwords).
2. Add bounded local vocabulary context to the current whole-file Qwen path first; test no-context compatibility, system vocabulary message, language prefill, and prompt privacy.
3. Design an optional Qwen windowed streaming experiment behind an ASR-specific capability interface. Start with raw 2/4/6-second partials and bounded memory; evaluate quiet-boundary segmentation separately. Do not port the Dart project's suppression heuristics by default.
4. Benchmark Russian first on recorded WAVs and only then test windowed live PCM on Android. Record partial latency, final WER/CER, dropped-word rate at window cuts, false partials, quiet speech retention, memory, battery and heat.
5. Keep the current whole-file Qwen + Whisper fallback as the safe path until the windowed path passes Russian/PGEM10 acceptance gates.


### Exact upstream Qwen3-ASR GGUF artifact caution
- The official ggml-org/Qwen3-ASR-0.6B-GGUF card currently advertises Q8_0 weights (805 MB) plus a separate mmproj. The public mmproj file card identifies commit 928ab95 and reports 214 MB / SHA-256 41a342b5e4c514e968cb756de6cd1b7be39eff43c44c57a2ef5fc6522e36603d.
- The public model card says the GGUF was converted with convert_hf_to_gguf.py. PR #32571 explicitly says existing GGUFs need re-conversion to get the corrected Qwen3-ASR chat template. The currently indexed public files were uploaded before that correction (the mmproj page shows 3 weeks ago, while the converter correction is 2026-11-20), so do not assume the current main branch artifacts contain the corrected template.
- Before changing the OGAM catalog, compare its exact primary and mmproj sizes/SHA-256 to the upstream files, pin a model repository revision/commit rather than mutable main, and inspect the GGUF metadata/chat template. The mmproj hash above is upstream evidence only; it is not asserted to be the catalog hash until compared.
- Sources: https://huggingface.co/ggml-org/Qwen3-ASR-0.6B-GGUF; https://huggingface.co/ggml-org/Qwen3-ASR-0.6B-GGUF/blob/main/mmproj-Qwen3-ASR-0.6B-Q8_0.gguf; https://github.com/ggml-org/llama.cpp/commit/919794500475862f6768c353255469dc661cb734


## 9. Follow-up source audit — shared catalog boundary and upstream mobile implementation (2026-11-22)

### Repositories and exact source inspected
- The public organization contains separate repositories `off-grid-ai/OGAM` (mobile), `off-grid-ai/OGAD` (desktop) and `off-grid-ai/OGAC` (server/control plane). The organization-wide repository search did not reveal a public repository named `shared` or a public `packages/models` source repository.
- Recursive Git tree inspection of OGAM, OGAD and OGAC found no tracked `shared/packages/models` directory. OGAM's `package.json` still declares `@offgrid/models` as `file:../shared/packages/models`, alongside sibling local workspaces such as `@offgrid/speech`, `@offgrid/design`, `@offgrid/rag` and `@offgrid/ui`. The public `off-grid-ai/mobile-pro` URL returned 404 to the repository-content API in this audit; do not treat it as a verified public source.
- Therefore the exact shared package source and its full `CATALOG` entry remain unavailable through the inspected public repository trees. The earlier catalog audit blocker is confirmed, not resolved. Do not reconstruct or guess missing catalog fields.

### What the public mobile repository does expose
- The current public `off-grid-ai/OGAM` main tree was inspected at tree commit `ff6abb8babdeb0836bb64d1df61dd90dd39cfd42`. Its `src/services/qwenAsrModel.ts` is available and explicitly identifies `ggml-org/Qwen3-ASR-0.6B-GGUF` as the phone-sized 0.6B model (1.7B is desktop's).
- That adapter resolves the entry from the imported shared `CATALOG`, then selects `primary` and `mmproj` roles. It requires both files to have a nonzero `sizeBytes`; it passes through the catalog URL, filename, byte size and optional SHA-256. The shared catalog remains the single source of truth for the actual artifacts.
- The public mobile app's tracked `catalog/models.json` is not that shared model catalog. It has top-level `schemaVersion`, `updatedAt`, and `sections`; its `sections.transcription` currently contains only a Whisper large-v3-turbo entry. It has no Qwen3-ASR artifact entry. This explains why inspecting the mobile JSON cannot recover Qwen filenames, URLs, sizes or hashes.
- The same current public upstream `src/services/qwenAsrEngine.ts` still uses llama.rn `initLlama`, 4096 context, 1024 output cap, a paired mmproj and CPU-only Android configuration. For a pinned language it formats the audio chat and appends `language <Name><asr_text>`; for auto language it sends the audio message directly. It logs transcript length and duration, not transcript content.
- This public source does not add vocabulary/hotword context to the Qwen request. The current source audit therefore does not change WP-A: optional bounded system-role vocabulary remains a proposed improvement, not an already implemented upstream feature.
- Current public upstream `src/services/qwenAsrModel.ts` now imports `transcriptionEngineOf` and engine-availability checks from `@offgrid/models`, and checks platform, engine build compatibility, catalog `minRamGb`, and `loadsOnPhone`. This reinforces that the missing shared workspace is operationally important; the mobile adapter alone cannot define a valid artifact.

### Exact conclusions / no overclaim
1. Qwen3-ASR 0.6B is still the mobile target in the public upstream source; the 1.7B model is explicitly reserved for desktop.
2. The mobile source confirms the two-file GGUF + mmproj contract and catalog-driven integrity metadata, but this audit cannot verify the exact file names, URLs, byte sizes, SHA-256 values or immutable model revision because those values are in the unavailable shared package.
3. The current public app catalog JSON is a different, narrower catalog and must not be substituted for `@offgrid/models`.
4. No model weights were downloaded, no GGUF metadata was inspected, no native inference was run, and no APK/device test was performed in this follow-up.
5. Next viable route: continue with source/test design that does not depend on unknown catalog values; in parallel, inspect any user-provided checkout/archive of the shared workspace if it becomes available, or obtain the package through an authorized project workspace. Do not bypass the catalog by hardcoding guessed URLs or checksums.

### Source links
- https://github.com/off-grid-ai/OGAM/tree/ff6abb8babdeb0836bb64d1df61dd90dd39cfd42
- https://github.com/off-grid-ai/OGAM/blob/ff6abb8babdeb0836bb64d1df61dd90dd39cfd42/src/services/qwenAsrModel.ts
- https://github.com/off-grid-ai/OGAM/blob/ff6abb8babdeb0836bb64d1df61dd90dd39cfd42/src/services/qwenAsrEngine.ts
- https://github.com/off-grid-ai/OGAM/blob/ff6abb8babdeb0836bb64d1df61dd90dd39cfd42/catalog/models.json
- https://github.com/off-grid-ai/OGAM/blob/ff6abb8babdeb0836bb64d1df61dd90dd39cfd42/package.json
- https://github.com/off-grid-ai/OGAD/tree/69768e90b5f7485b645f65ad4ad1f895831a46d7
- https://github.com/off-grid-ai/OGAC/tree/97afc9cc6ff298a2d6d17dcefff9e576c05ae35e


## 10. New Breeno takeover reference — Zafiro 2.1.0 source audit (2026-11-22)

A dedicated report was added at `research/breeno/ZAFIRO_BREENO_HOOK_COMPATIBILITY_AUDIT_2026-11-22.md`.

Key result:
- Found `niki914/zafiro`, MIT-licensed Kotlin/Compose Android agent with LSPosed/Xposed system-assistant takeover.
- Inspected main commit `bd3767ef1849f12d7aa7e302d7f10342871a52d8`; latest release at audit time was 2.1.0, published 2026-11-22 14:57 UTC.
- Zafiro has a concrete Breeno host profile for package `com.heytap.speechassist`, `version_code: 130302`, `is_beta:false`. This numerically matches the user's reported Breeno 13.3.2 naming/version-code convention and is now the strongest public compatibility lead. The installed PGEM10 versionCode/variant is still not verified.
- It also has profile 130305. Structural diff between 130302 and 130305 configs found only two changed values: reset method `p` → `q`, and DataCenter update method `f1` → `g1`. Do not infer other builds are identical without exact verification.
- The 130302 profile identifies capture input/response at `AIChatDataCenter.s(AIChatViewBean)`, session reset at `AIChatRoomIdManager.p(String,String)`, lifecycle targets `NewCuiFloatWindowRootView.onDetachedFromWindow` and `SpeechAssistMainActivity.onResume`, inbound directive processor `com.heytap.speech.engine.connect.core.manager.i.C(String,String)`, cleanup factory `ke.e.c(...)`, and card insert/update through `AIChatDataCenter.s` / `f1`.
- Zafiro architecture separates orchestration (`BreenoHook`), version config (`BreenoConfigProvider`), small subhooks, and native card rendering (`BreenoCardRenderer`). It sends semantic frames across IPC instead of host reflection objects. These boundaries are strong clean-room design references for OGAM.
- Zafiro takeover explicitly uses LSPosed/Xposed and README marks root as required. Its BYOK Agent, Phone-Use and tools are not proof of OGAM's offline-first model pipeline.
- Its directive filter suppresses selected Breeno namespaces/actions and cleanup behavior. Do not copy these broad suppressions as defaults: OGAM must preserve native fallback and use typed, permission-gated deterministic Android tools.
- MIT license permits reuse subject to notice requirements, but clean-room architecture adaptation is preferred. No proprietary Breeno APK content may be copied.

Evidence limits: no Breeno APK was decompiled, no device versionCode was read, no Zafiro APK installed, no Jarvis source changed, and no runtime hook/device test performed. Zafiro's own assistant-add-support skill requires REA for APK analysis and says to ask the user to deploy it if unavailable; do not silently install or bypass this gate.

Source report:
https://github.com/sokfrut-tech/OGAM/blob/docs/research-breeno-coloros-2026-11-22/research/breeno/ZAFIRO_BREENO_HOOK_COMPATIBILITY_AUDIT_2026-11-22.md


## 11. Cross-audit: OGAM's existing Android system-assistant path vs Breeno-internal takeover (2026-11-22)

The PR #1 source branch already contains a standard Android `VoiceInteractionService` / `RoleManager.ROLE_ASSISTANT` implementation. This was confirmed by inspecting the Android manifest, Kotlin services/session, role module, bridge Activity, launch guard, XML metadata, and source/JUnit tests at HEAD `67159e2f821b14616eebcaf0e6da997633cd7aa4`.

Confirmed behavior:
- System role request is user-mediated through Android's own confirmation UI; no silent role change.
- Actual readiness requires both the role to be held and the VoiceInteractionService to be active.
- Service is enabled only on Android 12 / API 31+; below that the resource disables it pending a local legacy RecognitionService.
- Voice session hands off to the normal Chat screen through a non-exported bridge Activity and one-use, 10-second launch token.
- The session disables/does not request assist/screenshot context; foreground app text, hierarchy, screenshot and audio context are not collected by this path.
- Contract tests cover protected BIND permission, private bridge, token anti-replay/expiry/URI normalization, RoleManager state combinations, Android 12 gate and shared recorder handoff.

Important product distinction:
- OGAM's RoleManager path is the no-root Android system-assistant tier. OEM-specific ColorOS behavior still needs real PGEM10 verification.
- Zafiro's Breeno-internal takeover hooks `com.heytap.speechassist` through LSPosed/Xposed and requires root. It is a separate, advanced integration tier, not a replacement for OGAM's existing role flow.
- Keep OGAM's current standard assistant path as primary. Consider optional Breeno-internal hook adapter only if ColorOS invocation gaps remain after device testing and the user explicitly chooses the root/LSPosed route.
- Existing RoleManager entrypoint only hands off to Chat; it does not establish always-on wake word, lock-screen operation, foreground-app context or full Siri-like background behavior.

Detailed comparison and source links:
https://github.com/sokfrut-tech/OGAM/blob/docs/research-breeno-coloros-2026-11-22/research/breeno/ZAFIRO_BREENO_HOOK_COMPATIBILITY_AUDIT_2026-11-22.md
