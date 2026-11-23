# Jarvis AI — Russian and adjacent AI ecosystem reconnaissance

Date: 2026-11-24  
Target: sokfrut-tech/OGAM, Android-first local assistant for OPPO Find X6 Pro / Snapdragon 8 Gen 2.  
Status: research only; no third-party code copied and no dependencies added.

## Executive decision

The strongest immediate learning sources are:

1. AI-forever/GigaAgent + GigaChain — agent orchestration, subagents, tools/MCP, persistent sessions, RAG, scheduling, channels, migration discipline, sandbox separation. Russian-origin and open-source; GigaAgent reports MIT.
2. GitVerse/GigaCode documentation — useful operational model for Plan vs Build, read-only explore subagents, scoped tool permissions, repository skills, CI workflows and MCP allowlists. GigaCode itself is a hosted/proprietary product, not a library to embed in Jarvis.
3. sherpa-onnx — strongest technical reference for offline Android speech stack: streaming ASR, TTS, VAD, keyword spotting, speaker tools and Android Kotlin/C++ APIs. Apache-2.0.
4. Vosk — mature offline Russian ASR and Android integration reference; Apache-2.0.
5. Impeccable — high-value design skill for the Jarvis interface: native Android/Compose-aware critique, animation guidance, UX audit and polish. Apache-2.0; adopt selectively, not its unsafe live automation path.
6. OpenMAIC — strong reference for durable agent sessions, replayable event streams, validated tool schemas, provider-neutral routing and interactive output. MIT root license in current upstream; verify package-level licenses. It is a classroom platform, not an Android assistant.
7. MiniMind — educational/training reference for tool calling, small-model architecture, distillation and Agentic RL; not a ready-to-use production model for PGEM10.
8. OpenCloud — hosted app-building/deployment/MCP ecosystem. Useful for optional companion dashboards or external app workflows, not the local Jarvis brain; not a Russian-origin open-source runtime.

## 1. User-named projects

### OpenCloud — opencloud-ai
- Repositories found: opencloud-ai/agent-plugins, opencloud-ai/cli, opencloud-ai/sprout-plugins.
- Plugin packages a shared workflow skill with hosted MCP endpoint and OAuth; intended for ChatGPT/Codex/Claude clients to create, preview, deploy and operate OpenCloud apps.
- The public plugin repository lists MIT, but the hosted service and MCP backend are not thereby open-source.
- Jarvis use: optional web dashboard or app-deployment integration, if later needed. Do not make memory, voice, command execution or device control depend on this cloud service.
- Classification: adjacent hosted platform, not a Russian Android AI repository.
- Links: https://github.com/opencloud-ai/agent-plugins ; https://docs.opencloud.ai/getting-started/agents

### MiniMind — jingyaogong/minimind / hjhnuaa/MiniMind
- Apache-2.0 training/education project implementing a tiny LLM and a complete training pipeline: tokenizer, pretraining, SFT, LoRA, DPO, PPO/GRPO/CISPO, tool calling, Agentic RL, adaptive thinking and distillation.
- The project reports small parameter-count experiments and RTX 3090 training examples. These are training demonstrations, not evidence that a tiny model is a competent general assistant on a phone.
- Jarvis use: study tool-call formatting, training/evaluation methodology and distillation. Potentially benchmark a small Russian-tuned model only after comparing quality, memory, latency and thermal behavior on the target device.
- Do not replace the current local inference runtime with MiniMind or assume a 64M-class model can safely plan complex Android actions.
- Classification: Chinese-origin research/education repository, not Russian-origin.
- Link: https://github.com/jingyaogong/minimind

### OpenMAIC — THU-MAIC/OpenMAIC
- Multi-agent interactive classroom with plan/outline → scenes pipeline, validated tool operations, durable database-backed sessions, leases/heartbeats, crash resume, replayable event history, steering/cancellation, user skills, provider-neutral model routing and offline HTML/resource export.
- Current upstream README reports MIT; root LICENSE is MIT. At least one bundled package (packages/mathml2omml) has LGPL-3.0-or-later terms, so package-level provenance must be respected.
- OpenMAIC-RU is a Russian-language fork; its README states AGPL-3.0. Do not copy its fork-specific changes into OGAM without reviewing the exact files and AGPL implications.
- Jarvis use: architectural reference for durable task sessions, state/event logs, cancellation/resume, explicit validated tools, multimodal output cards and interactive explanations.
- Do not import its Next.js/PostgreSQL classroom stack into the Android app. Extract only narrow, platform-neutral concepts.
- Classification: Chinese-origin upstream; Russian localization fork exists.
- Links: https://github.com/THU-MAIC/OpenMAIC ; https://github.com/artem1024/OpenMAIC-RU ; https://github.com/thu-maic/openmaic-project

### GitVerse / GigaCode
- GitVerse is a Russian-hosted source platform. GigaCode provides assistant, repository agent sessions and AI workflow integration; product access may be limited/early-access depending on feature.
- Docs describe separate Plan and Build modes, repository-aware sessions, read-only explore subagent, skills in .agents/skills, custom agents with per-tool allow/ask/deny permissions, path-specific rules, and CI workflows with external MCP include_tools allowlists and secrets.
- AI workflow docs describe a runner with shell/compiler/build environment and repository task/PR integration.
- Jarvis/Factory use: adopt these patterns in our agent contract: Plan is read-only; Build is explicitly authorized; explore subagents have read-only tools; every agent has a narrow allowlist; secrets are injected only at execution time; workflow jobs have explicit evidence and PR output. This aligns with the existing Universal-AI-Factory direction.
- Do not assume GigaCode's implementation is open source or bundle its proprietary runtime.
- GigaAgent mirror exists on GitVerse as GigaTeam/giga_agent, but canonical upstream is ai-forever/giga_agent.
- Links: https://gitverse.ru/docs/ai/ai-development/ ; https://gitverse.ru/docs/ai/ai-development/agents ; https://gitverse.ru/docs/ai/ai-development/tools ; https://gitverse.ru/docs/ai/ai-workflow-scenarios ; https://gitverse.ru/GigaTeam/giga_agent

## 2. Strong Russian-origin open-source references

### ai-forever/giga_agent — MIT
- General-purpose ReAct + REPL agent, 30+ tools/subagents, connectors/MCP, multiple LLM providers, document RAG, scheduled tasks, Telegram channels, image/presentation/landing generation.
- Uses LangGraph, FastAPI, SQLAlchemy/Alembic, SQLite/PostgreSQL, Qdrant, Docker/E2B sandbox options and React UI with Framer Motion.
- It explicitly documents sandbox requirements for code execution. The default initial admin credentials in README are a deployment risk if not rotated/disabled; never copy defaults into production.
- Jarvis use: study tool registry, subgraph/subagent isolation, model-provider abstraction, durable task orchestration, migration management, sandbox boundary, observability and interactive result widgets.
- Do not transplant Python server stack into the Android core; never allow arbitrary REPL execution on the phone. Android actions remain typed, permission-gated native APIs.
- Links: https://github.com/ai-forever/giga_agent ; https://github.com/ai-forever/giga_agent/blob/main/SUBAGENTS.md

### ai-forever/gigachain — MIT
- Russian-language integration/toolkit for LangChain, LangGraph and LangChain4j, with GigaChat integrations, agent examples, utilities and MCP servers.
- Jarvis use: optional cloud provider adapter and patterns for Russian-language tools. Keep it behind the existing provider interface; never require GigaChat to use Jarvis offline.
- Link: https://github.com/ai-forever/gigachain

### sberdevices/golos — dataset
- Russian speech corpus of roughly 1,240 hours, with acoustic/language model resources; repository is archived.
- Jarvis use: evaluation/training-data provenance reference for Russian ASR. The full corpus is large; not a runtime dependency. Read the dataset license PDF before redistributing any dataset/model artifacts.
- Links: https://github.com/sberdevices/golos ; https://www.openslr.org/114/

### alphacep/vosk-api — Apache-2.0
- Offline speech recognition toolkit with Android bindings, Russian language support, streaming API and small models.
- Jarvis use: baseline ASR comparator and Android integration fallback. Benchmark Russian accuracy, latency, partial-result stability and memory against Sherpa-ONNX before selecting one.
- Related Android service: https://github.com/alphacep/vosk-android-service
- Link: https://github.com/alphacep/vosk-api

### snakers4/silero-models — CC BY-NC 4.0 for model repository
- Russian-capable TTS models with naturalness and stress/homograph handling; model repository advertises non-commercial license.
- Jarvis use: voice-quality research only until commercial-use rights and exact model-specific licenses are resolved. Do not assume permissive licensing.
- Link: https://github.com/snakers4/silero-models

## 3. Cross-platform voice engine: Sherpa-ONNX

### k2-fsa/sherpa-onnx — Apache-2.0
- Offline ASR (streaming/non-streaming), TTS, VAD, keyword spotting, speaker identification/diarization, speech enhancement and source separation.
- Android and WearOS support, Kotlin/Java/C/C++ APIs, arm64 support and ready-made Android demo applications, including streaming ASR, KWS and TTS engine.
- Jarvis use: highest-priority technical evaluation for the voice stage. Compare candidate Russian ASR/TTS models and wake-word pipeline on PGEM10; verify model licenses individually. It may let us consolidate components, but only after benchmarking against current Sherpa/Silero/Piper plan.
- Important: library license does not automatically cover each downloaded model or voice.
- Links: https://github.com/k2-fsa/sherpa-onnx ; https://github.com/k2-fsa/sherpa-onnx/tree/master/android

## 4. Impeccable — UI craft, taste and motion

### pbakaus/impeccable — Apache-2.0
- A cross-agent design skill system with commands for critique, audit, polish, adapt, animate, delight, overdrive, typeset, layout, accessibility/performance/theming review and design-system capture.
- Explicitly supports native Android and Compose source for audit/adapt; design guidance can follow Material 3. The deterministic detector/live browser overlay are web-only, not native Compose.
- Jarvis use: create a project-local design skill and use its principles for Compose screen review: visual hierarchy, typography, density, contrast, responsive layouts, motion restraint, meaningful transitions and accessibility. Add a design review gate to UI PRs.
- Safety caveat: do not run the Live Apply automation or install unattended hooks blindly. README warns that one live apply fallback may launch a coding agent with approvals and sandbox disabled; hooks can execute outside normal model approval. Prefer importing/reviewing the skill text and invoking critique/audit manually. Telemetry behavior should be reviewed/disabled before use.
- Animation direction for Jarvis: motion should explain state and provide feedback, not decorate every surface. Use short spring/settle transitions for assistant state, listening waveform and task progress; honor Android reduced-motion/accessibility settings; avoid continuous GPU-heavy shaders on an always-on screen.
- Link: https://github.com/pbakaus/impeccable

## 5. Fit against OGAM architecture and priorities

| Project/reference | Jarvis area | Priority | Adopt |
|---|---|---:|---|
| GitVerse agent permissions/workflows | Factory + tool authorization | P0 | Plan/Build separation, allow/ask/deny, read-only explorer, MCP allowlists |
| GigaAgent | Scheduler/tools/subagents | P1 | state graph, typed tools, sandbox design, durable sessions, migrations |
| Sherpa-ONNX | Voice stage | P1 | benchmark Android streaming ASR/KWS/VAD/TTS |
| Vosk | Russian ASR baseline | P1 | compare accuracy and latency on-device |
| Impeccable | Compose UI/animation | P1 | manual design skill, critique/audit checklist, motion principles |
| OpenMAIC | Long-running task sessions | P2 | event log, leases, resume, cancel, steering, validated tools |
| GigaChain | Provider integration | P2 | optional Russian cloud adapter, MCP patterns |
| Golos dataset | ASR evaluation | P2 | test-set/data reference; license review |
| MiniMind | Model research | P3 | study distillation/tool-use training; benchmark only |
| OpenCloud | External dashboard/app hosting | P3 | optional separate companion UI; not core dependency |
| Silero TTS | Russian voice quality | P3 | license-first voice comparison; non-commercial constraint |

## 6. Architecture rules retained for Jarvis

- Local-first core; cloud providers are optional and never required for core device control.
- LLM proposes actions; deterministic policy/typed command router validates and authorizes.
- No unrestricted shell/REPL in Android app. If a developer sandbox is ever offered, isolate it from device-control privileges and require explicit user consent.
- One physical microphone owner at a time; no always-on wake-word claim until measured on ColorOS.
- Voice pipeline stages remain replaceable: wake word → VAD → ASR → planner/LLM → authorization → native executor → TTS.
- Every long task has persistent state, progress events, cancellation and safe resume; actions must be idempotent or have deduplication keys.
- Memory is separate from chat history and RAG, with explicit user confirmation and hard scope boundaries.
- UI design and animation review are release gates, but never at the expense of battery, thermal limits, readability or accessibility.
- License checks apply to code, models, datasets, voices, fonts and bundled packages separately.

## 7. Next research/engineering actions

1. Finish current Step 1 memory M1 gates; do not divert implementation effort from the active acceptance criteria.
2. Prepare a read-only comparative benchmark plan for Sherpa-ONNX vs Vosk on the target OPPO device using Russian speech clips and fixed metrics.
3. Audit GigaAgent tool registry, subagent boundaries, scheduler, session persistence, migrations and sandbox; extract patterns, not backend dependencies.
4. Build a small Impeccable-derived Jarvis Compose design skill (Apache-2.0 attribution preserved), then manually audit the existing OGAM UI; no automated live apply.
5. Review OpenMAIC session/event model and validated tool schemas as input to the later scheduler step.
6. Revisit MiniMind only if model research becomes a bottleneck; do not train or package a new model before baseline device benchmarks.

## 8. Evidence and limitations

- Sources inspected: upstream GitHub READMEs/licenses/docs, GitVerse official documentation and public GitVerse repository pages.
- No repositories were cloned or executed; no APKs were built; no model was downloaded or benchmarked.
- GitLab search surfaced no clearly superior Russian-origin Android assistant codebase during this pass. This is not proof that none exists; further targeted GitLab project/code search is warranted.
- The exact user phrase “Open Cloud” was mapped to the public opencloud-ai organization; if a different repository/service was intended, its exact URL/name should be added to a later pass.
