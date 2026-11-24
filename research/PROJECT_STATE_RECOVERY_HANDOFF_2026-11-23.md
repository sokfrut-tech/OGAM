# OGAM / Jarvis — recovery handoff from 2026-11-22
Date: 2026-11-23
Target: OPPO Find X6 Pro PGEM10, Snapdragon 8 Gen 2 (SM8550), Android 16 / ColorOS 16.0.5
Status: consolidated research and implementation handoff. This is not a claim that all candidate projects were built, all model weights downloaded, or the app validated on-device.

## 1. User's operating rule (binding)
Continue the worldwide research loop without stopping at the first promising result:
1. discover new work globally, including China and India and specialist code/model platforms;
2. inspect actual source, manifests, model artifacts and licenses, not just repository descriptions;
3. compare candidates with a repeatable Russian corpus and device measurements;
4. select only after evidence; integrate behind existing architecture;
5. run tests/builds/device checks;
6. record every meaningful result, limitation, commit and next step in GitHub.
Do not claim a source was studied if only a link was found. Do not call a candidate integrated because a plan or adapter interface exists. Do not claim OPPO validation from CI or another handset's benchmark. Work one step at a time, write complete files, and preserve draft PRs; do not merge without explicit approval.

## 2. Reconstructed 22 November timeline

### Morning / early afternoon — OGAM implementation and voice bridge
- Main target is a clean-room Russian, offline-first Jarvis/Breeno replacement for OPPO ColorOS. No proprietary Breeno code or weights are to be copied.
- Storage/privacy work was organized in `feature/jarvis-step-2-storage-privacy`; a separate `feature/jarvis-step-3-model-scanner` branch was also created.
- The voice input path was corrected to follow the app language (`ru-RU` / `en-US`). An explicit-URI Android bridge was added. Android 7–11 integration was not to be treated as complete without a real `RecognitionService`.
- The user asked for a full mechanical audit of OGAM, Siri/Apple, Breeno/ColorOS, Chinese and Indian assistants, APKs and physical device capabilities—not just UI screenshots. Research directories and evidence were to be preserved in the repository.
- Implementation notes covered local models, llama.rn/GGUF, LiteRT, Whisper, SAF, memory, model scanning, image generation, localization and ARM64 build isolation.

### Mid-afternoon — Breeno / APK evidence and Gemini review
- A static inventory of 26 local APKs was reported. The phone-matching Breeno package was identified as `com.heytap.speechassist` 13.4.3, build `08c04e4_261110`.
- The repository records a large inventory for this package: 110,152 DEX classes, 72 native `.so` libraries and 959 resources, plus manifest, permissions, hashes and system relationships. Relevant concepts include Breeno Memory, DMP/RAG, AIUnit, ColorOS Direct, OCR and shortcuts.
- The actual saved audit is `research/breeno/OPPO_LOCAL_APK_STATIC_ANALYSIS_2026-11-22.md`; manifest/native inventory is `research/breeno/OPPO_APK_MANIFEST_AND_NATIVE_INVENTORY_2026-11-22.json`.
- Gemini review corrections and source-level findings were retained in `GEMINI_APK_AUDIT_CORRECTIONS_2026-11-22.md`, `ETA_COLOROS_SOURCE_AUDIT.md`, `AZCODE_ARIES_SOURCE_AUDIT.md`, `ZORVAI_SOURCE_AUDIT.md`, `PHTOMT_POCKETMIND_SOURCE_AUDIT.md`, `ZAFIRO_BREENO_HOOK_COMPATIBILITY_AUDIT_2026-11-22.md` and related reference/transfer plans.
- Important boundary: the static APK pass does not equal JADX deep decompilation or dynamic runtime analysis. Those remain separate follow-ups. OPPO's Instructions 17.7.2 / permission behavior also remained to be fully studied.

### Late afternoon — native assistant implementation and CI
- PR #1 includes Android VoiceInteractionService/SessionService work, RoleManager-based user selection, a one-time token bridge and PCM-related tests. It is not proof of a fully functioning always-on assistant.
- A workflow run passed static checks, but Gradle/JUnit, a distributable APK, installation and runtime behavior on the OPPO were not established by that result.
- Build/test gates were blocked by private OGAM workspace dependencies, notably `off-grid-ai/mobile-pro`, `off-grid-ai/shared`, and packages such as `@offgrid/models` / `@offgrid/rag`. The required `PRO_SUBMODULE_PAT` secret with appropriate read access was absent in the cited failing runs. Missing private modules make the resulting type/test failures inconclusive, not a verified source failure or success.
- Keep PR #1 Draft and unmerged. PostHog/analytics removal and storage/privacy changes must be judged from source and CI evidence; do not silently replace private dependencies with stubs.

### Evening — China/India model and speech research
- The user explicitly adopted the worldwide loop: discover, compare, test, choose, integrate, verify, record; do not stop after one promising model.
- Candidate families tracked include Alibaba Qwen, DeepSeek, Z.ai/GLM, Moonshot/Kimi, MiniMax, ModelBest/MiniCPM, Tencent Hunyuan/WeVisOne-VL, Baidu OCR, Ant Group Ling, Xiaomi MiMo, Meituan LongCat, and Indian Sarvam. Server-sized weights must not be presented as phone-local candidates.
- Speech research included Qwen3-ASR (0.6B/1.7B), Qwen3-TTS, CosyVoice 3, SenseVoice/FunASR, tiny-voca-ru, Supertonic 3, Piper/sherpa-onnx, wake-word/VAD options and LiteRT-LM/llama.cpp/ONNX routes.
- A Russian evaluation corpus and repeatable phone benchmark plan were specified. Compare Russian pronunciation and recognition, first-result latency, RTF, memory, storage, CPU/GPU/NPU delegate, temperature, battery and sustained behavior on PGEM10.
- Commits referenced in the 22 Nov conversation include `5e3142...` (China/India landscape), `39fd71b`, `7ea8d2a`, `c558f8e`, `2fb96bc4`, `84006b06`, plus the handoff/audit commits noted in PR discussions. These abbreviated SHAs are conversation references; consult Git history for full SHAs before using them in automation.
- No winner was declared without same-device tests. Qwen3-ASR/TTS and the other models were candidates/audits, not confirmed OPPO integrations.

## 3. Research artifacts already present in this branch

### Breeno / ColorOS / source projects
- `research/breeno/README.md` — project research index.
- `OPPO_LOCAL_APK_STATIC_ANALYSIS_2026-11-22.md` — static analysis of the 26 APK set and target Breeno package.
- `OPPO_APK_MANIFEST_AND_NATIVE_INVENTORY_2026-11-22.json` — detailed package inventory.
- `OPPO_FIND_X6_PRO_DEVICE_EVIDENCE_2026-11-22.md` — device facts/evidence.
- `OPPO_BREENO_INSTRUCTIONS_PERMISSIONS_2026-11-22.md` — permissions and system integration.
- `DEX_DECOMPILATION_AND_OGAM_TRANSFER_PLAN_2026-11-22.md` — remaining deep-analysis and transfer plan.
- `OGAM_CAPABILITY_MAPPING.md`, `OGAM_NATIVE_ASSISTANT_IMPLEMENTATION_BRIEF.md`, `REFERENCE_PROJECTS.md` — feature mapping, architecture and reference projects.
- Individual audits: ETA ColorOS, AZCode Aries, Zorvai, PocketMind/PHTOMT, Zafiro and Gemini corrections.

### China / India / model research
- `research/models/CHINA_INDIA_MODEL_LANDSCAPE_2026-11-22.md`
- `research/china/CHINESE_OPEN_MODELS_EVALUATION_2026-11-22.md`
- `research/china-india/CHINESE_INDIAN_ON_DEVICE_SPEECH_SCAN_2026-11-22.md`
- `research/models/OGAM_QWEN_ASR_NEXT_IMPLEMENTATION_PLAN_2026-11-22.md`

### Voice research
- `research/voice/JARVIS_RUSSIAN_AUDIO_EVALUATION_CORPUS_V1_2026-11-22.md`
- `OGAM_WAKEWORD_AND_BACKGROUND_MICROPHONE_RESEARCH_2026-11-22.md`
- `OGAM_RUSSIAN_MICROWAKEWORD_ANDROID_AUDIT_2026-11-22.md`
- `OGAM_ALKOVE_VOICUTE_ANDROID_KWS_AUDIT_2026-11-22.md`
- `OGAM_VOICE_INTERACTION_SESSION_LIFECYCLE_AUDIT_2026-11-23.md` — Android VoiceInteraction service/session, non-exported bridge, one-use token and Android lifecycle gaps.
- `OGAM_EXISTING_TTS_PCM_AND_MICROPHONE_CONTRACT_AUDIT_2026-11-23.md` — exact Kotlin/TypeScript source audit of TTS PCM contract, single playback and mic owners, and missing monotonic AEC timestamps.
- `OGAM_RUSSIAN_TTS_ANDROID_SOURCE_COMPARISON_2026-11-23.md` — exact source-level comparison of Supertonic-3/Soniqo, Qwen3-TTS Android, CosyVoice3, VoxCPM2 and Indic-Mio; confirms that the Soniqo TTS-only API is batch while the chunk callback sits on the heavier full pipeline, and recommends a narrow TTS-only JNI adapter for Supertonic as the first PGEM10 benchmark candidate.
- `OGAM_SUPERTONIC_TTS_ONLY_ANDROID_ADAPTER_IMPLEMENTATION_BRIEF_2026-11-23.md` — new source-level finding: Soniqo already has a standalone cancellable TTS handle for Supertonic; only its streaming callback is missing there. Plan adds a TTS-only JNI streaming method, keeps STT/VAD out, maps PCM16 to OGAM Float32, and records LiteRT runtime, NDK/CMake and minSdk 24-vs-26 blockers plus lifecycle/test gates. No implementation code changed.
- `OGAM_RUSSIAN_TTS_ANDROID_BACKEND_AUDIT_2026-11-22.md`
- `OGAM_QWEN3_TTS_ANDROID_INTEGRATION_PLAN_2026-11-22.md`
- `SONIQO_SUPERTONIC_LOCALVQE_ANDROID_AUDIT_2026-11-22.md`
- `COSYVOICE_VOXCPM2_MOBILE_TTS_AUDIT_2026-11-22.md`
- The 23 Nov Nemotron, Qwen3-ASR LiteRT and VAD audits extend this work; they are not evidence that those candidates have been integrated.

## 4. Current PR state checked on 2026-11-23

### PR #1 — Jarvis implementation
- URL: https://github.com/sokfrut-tech/OGAM/pull/1
- Open, Draft, unmerged.
- Current head observed: `4772d58d5f35c927fbb2392406b800039c2bc8c5`.
- The 23 Nov follow-up changes three tests to pass explicit monotonic timestamps after JVM Android stubs failed on `SystemClock.elapsedRealtime()`. No rerun of CI for that follow-up head was confirmed in the PR description at inspection time.
- Private submodule/workspace access remains a hard prerequisite for meaningful full type/lint/test results. No APK artifact, install or PGEM10 runtime check is claimed.

### PR #2 — Breeno / ColorOS research and adaptation
- URL: https://github.com/sokfrut-tech/OGAM/pull/2
- Open, Draft, unmerged.
- Branch: `docs/research-breeno-coloros-2026-11-22`.
- Head checked during initial recovery: `f4dd7ea793a1b522db46fb19d25bbf4ec12ed71c`; after subsequent recovery, TTS/PCM and VoiceInteraction lifecycle audits were committed, the latest branch/PR #2 head is `b24c49e1f7727f2f88e29feaf08b220c5c599bf2`.
- Contains the Breeno/ColorOS research corpus and 22–23 Nov speech/model audits. Keep it Draft and do not merge without user approval.

## 5. Architecture constraints that must survive every candidate integration
- Keep one physical microphone owner: OGAM AudioRecorderService. VAD/KWS/ASR/Whisper consume the same 16 kHz mono stream or a coordinated native stream; never add a competing AudioRecord.
- Preserve existing recorder/player lifecycle. TTS must feed the current Jarvis PCM playback owner; do not create a second AudioTrack/AudioFocus owner.
- Keep half-duplex until timestamped playback-reference AEC is integrated and acoustically verified on PGEM10. A boolean or DSP preset is not proof of echo cancellation.
- Separate wake-word, VAD, ASR, intent/planner, permission-gated action and TTS states. Never give an LLM unrestricted Accessibility/device-control authority.
- Respect Android 12–16 background microphone/foreground-service rules and ColorOS battery restrictions. User-visible mic state and opt-in are required for any always-listening mode.
- Preserve offline-first operation, data minimization, explicit permissions and Russian-language quality. Keep proprietary Breeno binaries/weights out of OGAM.

## 6. Next execution order
1. **Reconcile current source and docs:** inspect the full OGAM voice pipeline and Android bridge on the implementation branch; verify the exact TTS backend/player interface, single mic owner and lifecycle.
2. **Finish the Breeno reverse-engineering gap:** use JADX/decompilation on the acquired target APKs, inspect only relevant classes and native boundaries, compare against saved manifest/inventory, then record exact findings. Do not claim dynamic analysis until performed.
3. **Complete the ColorOS system contract:** read the exact Instructions 17.7.2 material and verify assistant role, lockscreen, background execution, permissions, app launch, shortcuts, OCR and voice interaction constraints on the target OS.
4. **Build a real candidate matrix:** include model revision, source commit, file hash/size, language evidence, license/provenance, runtime, input/output tensor contract, memory and latency evidence. Distinguish source-level, desktop, other-phone and PGEM10 evidence.
5. **Run comparable Russian tests:** use the saved corpus; score ASR WER/CER and command success, TTS intelligibility/pronunciation, KWS false accepts/misses, VAD endpoint latency, TTFA, RTF, RSS, heat and battery.
6. **Resolve private build dependencies:** obtain/configure the required private workspace access, rerun CI against the current PR #1 head, then build the arm64 APK and verify checksum/artifact. Only then arrange installation/device tests.
7. **Implement in small isolated adapters:** no bulk import of another assistant app; preserve OGAM interfaces and use a feature flag for experimental backends. One change, tests, evidence and GitHub checkpoint per step.

## 7. Explicitly not yet proven
- Full independent Gradle build and distributable arm64 APK from current PR #1.
- Successful installation and runtime on OPPO PGEM10 / ColorOS 16.0.5.
- Always-on Russian «Джарвис» wake-word reliability and background battery cost.
- True streaming Russian ASR performance on this phone.
- Russian TTS quality, streaming latency and sustained thermal behavior on this phone.
- Acoustic AEC/barge-in with synchronized playback reference.
- Deep JADX findings and dynamic Breeno runtime behavior, unless a later evidence artifact specifically demonstrates them.
- Any candidate model as a final winner.

## 8. Source-of-truth links
- PR #1: https://github.com/sokfrut-tech/OGAM/pull/1
- PR #2: https://github.com/sokfrut-tech/OGAM/pull/2
- Research branch: https://github.com/sokfrut-tech/OGAM/tree/docs/research-breeno-coloros-2026-11-22
- Breeno research index: https://github.com/sokfrut-tech/OGAM/blob/docs/research-breeno-coloros-2026-11-22/research/breeno/README.md
- China/India model landscape: https://github.com/sokfrut-tech/OGAM/blob/docs/research-breeno-coloros-2026-11-22/research/models/CHINA_INDIA_MODEL_LANDSCAPE_2026-11-22.md
- Voice research index: https://github.com/sokfrut-tech/OGAM/blob/docs/research-breeno-coloros-2026-11-22/research/voice/README.md

- `OGAM_SUPERTONIC_CANCELLATION_ENTRY_RACE_ERRATA_2026-11-23.md` — pinned source confirms synthesize() resets cancelled_ to false on entry, so a cancellation just before native entry can be lost; requires a native start handshake or per-request generation token before claiming reliable native cancellation.

- `OGAM_LITERT_ANDROID_RUNTIME_COMPATIBILITY_FOR_SUPERTONIC_2026-11-23.md` — official Google docs re-check: LiteRT 2.3.2 supports API 24 and NDK r26a+; OGAM's minSdk 24 / NDK r27.1 / CMake 3.22.1 meet the documented baseline. Soniqo's minSdk 26 / NDK r29 / CMake 4.1.2 are wrapper-specific build pins, avoidable by direct native integration. Soniqo currently bootstraps LiteRT 2.1.5; compatibility of its speech-core source with 2.3.2 remains unverified.

## Repository write-safety note (2026-11-23)
- During this session, two GitHub content updates unexpectedly landed on main despite the requested docs branch. The accidental Supertonic adapter brief and recovery-handoff file were removed from main in cleanup commits `ee6041929c37cc99e359ba7ae0753fe4219c7055` and `ea6d81e9941139ecef5b3a49be888ee0c5215c9b`.
- Verified afterward: main tree contains none of the Supertonic/LiteRT research files; the research branch and PR #2 contain the intended documents. Main history has the temporary add/remove commits, but the research artifacts are absent from the current main tree. For future writes, immediately compare branch head, main head and PR head after every operation; if a write lands on main, restore the affected file and verify the tree before continuing.


## Supertonic LiteRT / ONNX build-graph update (2026-11-23)
- New source audit: `research/voice/OGAM_SUPERTONIC_LITERT_BUILD_GRAPH_AND_ORT_DECOUPLING_AUDIT_2026-11-23.md`.
- Pinned Soniqo `speech-core` CMake confirms `SPEECH_CORE_WITH_ONNX` defaults OFF and `ORT_DIR` is required only when ONNX is enabled. `SPEECH_CORE_WITH_LITERT` is independent and the aggregate LiteRT target links `speech_core`, `libLiteRt` and utf8proc, not ONNX Runtime.
- Correction to earlier broad wording: the Soniqo Android SDK wrapper (not the Supertonic LiteRT model itself) unconditionally requires `ORT_DIR` and forces `SPEECH_CORE_WITH_ONNX=ON`. Do not copy that wrapper CMake wholesale into OGAM.
- Direct OGAM integration can avoid ORT by building speech-core with ONNX OFF / LiteRT ON. The upstream aggregate LiteRT library still compiles many unrelated model wrappers; a minimal Supertonic-only target remains to be built and link-verified.
- Soniqo `speech-core/scripts/fetch_litert.sh` defaults to LiteRT 2.1.5. Google lists LiteRT 2.3.2 as latest and it is present in Maven version listings, but the AAR/runtime has not been downloaded or hashed and the pinned Soniqo source has not been compiled against 2.3.2.
- No OGAM application code/build configuration changed; no native build, APK or OPPO device test performed. PR #2 remains Draft/unmerged.


## Supertonic minimal C++ target update (2026-11-23)
- New source map: `research/voice/OGAM_SUPERTONIC_MINIMAL_CPP_TTS_TARGET_SOURCE_MAP_2026-11-23.md`.
- Instead of importing the Soniqo Kotlin SDK/C ABI wrapper, prototype can call `speech_core::LiteRTSupertonicTts` directly. Its `TTSChunkCallback` already emits mono Float32 chunks at 44.1 kHz, matching OGAM's TTS backend seam.
- Candidate minimal source set: `litert_supertonic_tts.cpp`, `supertonic_tokenizer.cpp`, `text_chunker.cpp`; link LiteRT, utf8proc and Android log. This avoids the Soniqo C ABI option conversion/postprocess path and the broad aggregate LiteRT model target. This is a source-level candidate only; must prove with arm64 compile/link.
- JNI design must copy/consume callback buffers synchronously, bound memory, use request generations/start handshake, and protect handle lifetime. Cancellation race at `synthesize()` entry remains unresolved and blocks claiming reliable cancel.
- Next gate: standalone arm64 CMake harness against upstream default LiteRT 2.1.5, then compare 2.3.2 after exact runtime binary/hash pin. No OGAM app source or build config changed; no APK/device tests.

## 9. Supertonic TTS-only build feasibility update — 23 Nov
- New audit: `research/voice/OGAM_SUPERTONIC_TTS_ONLY_BUILD_FEASIBILITY_AUDIT_2026-11-23.md`.
- Upstream `soniqo/speech-core` commit pinned to `59b9d7902ea62dbbbfb95e139e2bf0e8957f8753`; actual sources and CMake were inspected.
- Correction: `scripts/fetch_litert.sh` downloads the Google Python wheel `ai-edge-litert` (default 2.1.5) and extracts `libLiteRt.so`; it does not fetch an Android AAR or verify a checksum. The wheel versions/platform ABI layout and hashes for 2.1.5/2.3.2 still need verification.
- Confirmed: ONNX is optional and OFF by default; the aggregate `speech_core_models_litert` target still compiles many unrelated models. Avoid importing the aggregate target.
- New link-closure caveat: `LiteRTSupertonicTts` inherits `TTSInterface`; its virtual `synthesize_with_options` implementation is out-of-line in `tts_synthesis_options.cpp` and pulls post-processing dependencies. The earlier three-source candidate list is not a proven complete minimal link target. Inspect linker closure and do not stub semantics.
- Cancellation entry race confirmed: `synthesize()` resets `cancelled_` to false at entry, so pre-entry cancellation can be lost. Adapter needs generation IDs, queued-request suppression, serialized start/cancel handshake, stale-callback dropping, worker lifetime protection and explicit race tests.
- Google docs list LiteRT 2.3.2 as current and API 24 / NDK r26a baseline. OGAM API24 / NDK r27.1 / CMake3.22.1 meets the documented baseline, but pinned upstream source compatibility has not been compiled.
- Status: source audit complete; no workflow, harness, native build, runtime hash, APK or PGEM10 test yet. No production source changed. Next: verify wheel artifact availability/layout and utf8proc immutable pin/hash, then create a manual-only isolated arm64 build workflow in this research branch. Do not deploy or merge.

### Android LiteRT acquisition correction
- Follow-up pinned-source inspection of `soniqo/speech-android/setup.sh` shows Android uses Google Maven AAR `com.google.ai.edge.litert:litert:2.1.5`, extracting `jni/<ABI>/libLiteRt.so` to `LITERT_DIR/<ABI>/`. The PyPI wheel script in speech-core is for host-platform runtime acquisition and must not be used as the Android cross-build runtime.
- Published coordinate `com.google.ai.edge.litert:litert:2.3.2` is listed in Google Maven (26 Oct 2026); exact AAR payload/hash/C API compatibility still needs direct verification. Preserve AAR LICENSE and THIRD_PARTY_NOTICE.txt when extracting.
- Soniqo wrapper's NDK r29 / CMake 4.1.2 / minSdk 26 are wrapper pins. Google docs' 2.3.2 baseline is API 24 / NDK r26a; OGAM's API24 / NDK r27.1 / CMake3.22.1 meets that baseline, but no compile evidence exists.
- Corrected audit: `research/voice/OGAM_SUPERTONIC_TTS_ONLY_BUILD_FEASIBILITY_AUDIT_2026-11-23.md`, section 10.

### LiteRT 2.3.2 artifact / NPU findings — follow-up 23 Nov
- Google Maven lists `com.google.ai.edge.litert:litert:2.3.2`; Google compatibility table says API24 / NDK r26a. External current implementation evidence corroborates AAR contains `jni/arm64-v8a/libLiteRt.so`; exact AAR and .so hashes were NOT directly captured in this run.
- Keep `litert-gpu:2.3.2` separate; CPU-only TTS harness does not need GPU accelerator library.
- Preserve Google's AAR `LICENSE` and `THIRD_PARTY_NOTICE.txt` unchanged when redistributing extracted runtime. Their existence/obligations are externally corroborated, but exact files still need direct capture.
- Qualcomm NPU is a separate track: LiteRT 2.3.2 Qualcomm runtime AAR + QAIRT 2.50.0.260828; SM8550 maps to HTP v73 in current reference. Do not reuse QAIRT 2.47 bundles or imply that libLiteRt alone enables NPU. CPU-only harness first; NPU only after matching packages/hashes and PGEM10 proof.
- Updated detailed audit section 11–13 in `research/voice/OGAM_SUPERTONIC_TTS_ONLY_BUILD_FEASIBILITY_AUDIT_2026-11-23.md`.
- Direct AAR download/extraction was attempted but unavailable in this execution environment; no checksum or ELF inspection is claimed.
