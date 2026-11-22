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
