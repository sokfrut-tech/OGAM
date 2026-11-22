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
