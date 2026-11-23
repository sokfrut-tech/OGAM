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
- `OGAM_EXISTING_TTS_PCM_AND_MICROPHONE_CONTRACT_AUDIT_2026-11-23.md` — exact Kotlin/TypeScript source audit of TTS PCM contract, single playback and mic owners, and missing monotonic AEC timestamps.
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
- Head checked during initial recovery: `f4dd7ea793a1b522db46fb19d25bbf4ec12ed71c`; after this handoff and the TTS/PCM audit were committed, the latest branch/PR #2 head is `8147fca287853df5c1b846241464edbbac8cb444`.
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
