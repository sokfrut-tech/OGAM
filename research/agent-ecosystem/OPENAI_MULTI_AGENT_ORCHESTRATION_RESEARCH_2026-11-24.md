# Jarvis — OpenAI Multi-Agent / Multitasking Architecture Research
Date: 2026-11-24
Project: `sokfrut-tech/OGAM`
Status: research and architecture proposal; documentation only. No production code, API credentials, cloud services, or device settings changed.
Target: OPPO Find X6 Pro PGEM10; Android/ColorOS; Russian-first, local-first assistant.

## Executive finding

OpenAI's recent progress is not merely "run several prompts at once". The important shift is a managed agent harness:
- a root/manager agent delegates bounded work to specialist subagents in parallel;
- each subagent has a focused context and reports back;
- the manager can send follow-up work, wait, interrupt, and synthesize;
- tools can be discovered progressively and called/chained/filtered programmatically;
- long-running work is supported through context compaction, durable state, isolated workspaces, retries, and observable task lifecycles;
- orchestration can be task-centric rather than tied to one interactive chat session.

This maps closely to Jarvis's planned TaskLedger, CapabilityRegistry, ToolDiscoveryRouter, EngineSupervisor, and local-first planner. It should extend those designs, not replace them.

## OpenAI primary-source findings (checked 2026-11-24)

### 1. Responses API Multi-agent (official API guide)
URL: https://developers.openai.com/api/docs/guides/responses-multi-agent

The guide describes a root agent that can spawn and coordinate parallel subagents. Each subagent has bounded context. The root can spawn, message, follow up, wait, interrupt, and collect results. The guide lists research, codebase exploration, comparing proposals, independent implementation and diagnosis as good parallelization candidates. It warns that parallel agents increase token usage and are not useful when work is sequential, shares mutable state, or is dominated by one slow external dependency.

The guide documents a default concurrency of three active subagent turns and availability in beta for selected GPT-6.x and GPT-5.6 models. Model eligibility and API access must be checked at integration time; do not hardcode availability.

### 2. OpenAI Agents API (official announcement, 2026-09-10)
URL: https://openai.com/index/introducing-the-agents-api/

OpenAI describes a managed harness for long-running cloud agents. Notable capabilities:
- context compaction across long sessions;
- tool search to load only relevant tool definitions;
- programmatic tool calling to run calls in parallel, chain them, and filter/combine results in code;
- multi-agent delegation with isolated specialist contexts;
- managed execution infrastructure for work that can run for extended periods.

Relevance: Jarvis should use progressive tool discovery, bounded task contexts, explicit result contracts and context compaction/checkpointing. The hosted Agents API is an optional cloud provider, not a required dependency for an offline Android assistant.

### 3. Agents SDK orchestration patterns (official guide)
URL: https://developers.openai.com/api/docs/guides/agents/orchestration

Two patterns are distinguished:
- **Manager / agents-as-tools:** manager remains responsible for the user-facing answer and calls specialists as bounded helpers. Best default for Jarvis.
- **Handoffs:** a specialist takes ownership of a branch of the conversation. Use only when the user should explicitly move into a specialist workflow.

The guide recommends narrow specialist roles and adding specialists only when instructions, tools, policy or context genuinely differ. Avoid spawning agents just to create activity.

### 4. Symphony: task-centric persistent orchestration (OpenAI, 2026-04-27)
URL: https://openai.com/index/open-source-codex-orchestration-symphony/
Spec repository: https://github.com/openai/symphony

Symphony treats an issue/task tracker as the control plane. Each eligible task gets an isolated workspace and agent run. Dependencies block downstream work; independent tasks run in parallel. The orchestrator handles bounded concurrency, retries/backoff, restart recovery, workspace lifecycle and structured observability. Tasks can represent research and analysis as well as code changes. The article also highlights the need for guardrails, end-to-end verification and human review; not every ambiguous/high-judgment task should be fully automated.

Relevance: Jarvis should become task-centric. A task must survive app/process death and resume from a checkpoint, rather than existing only inside one chat turn.

### 5. Agents SDK / sandbox and long-horizon work
URLs:
- https://openai.com/index/the-next-evolution-of-the-agents-sdk/
- https://developers.openai.com/blog/run-long-horizon-tasks-with-codex

OpenAI's engineering pattern combines plan → act → tool feedback → repair → verify → update durable project state. Sandboxed workspaces, snapshot/rehydration and isolated execution reduce cross-task interference. This is a useful engineering pattern, but Android app sandboxing and local model resource constraints require a separate implementation.

## Existing OGAM architecture — avoid duplicate work

Existing research/design already specifies:
- `TaskLedger`: plan/step/result/verification records, bounded replanning and stop conditions.
- `CapabilityRegistry`: typed capability manifests with schema version, permission scopes, risk tier, online/offline flags, adapter, owner and test evidence.
- `ToolDiscoveryRouter`: category/intent routing, schema-on-demand and a small always-on tool set.
- `EngineSupervisor`: bounded engine startup/shutdown, memory/thermal budgets, health, crash count, timeout, cancellation and graceful fallback.
- Runtime approval immediately before consequential tool execution; missing approval or timeout fails closed.
- Durable checkpoints, idempotency metadata, undo state where possible, and explicit distinction between delivered, executed and verified.
- Single owner per write surface; parallelize independent work only.
- User-approved durable memory and exact project-scope retrieval.
- User's accepted stage order: memory → planner/multistep → safe Android actions → voice → models/agents → ColorOS testing.

The current memory M1-M4 work is a prerequisite. Do not skip ahead and claim a production multi-agent runtime exists.

## Proposed Jarvis design: Local-first Multi-Task Orchestrator

### A. Roles

1. **Jarvis Manager (root)** — owns the user request, classifies risk, creates a task graph, decides which branches can run concurrently, and owns the final response.
2. **Planner** — converts a request into typed steps, dependencies, deadlines, stop conditions and acceptance criteria. It does not execute Android side effects.
3. **Research specialists** — independent read-only branches (web/local knowledge/files/repository), each with a narrow question and source/provenance contract.
4. **Tool specialists** — call only explicitly granted capabilities; one specialist per domain (calendar, settings, files, media, communications, etc.).
5. **Verifier** — independently checks outputs against acceptance criteria, source evidence and action receipts. It must not merely repeat the executor's claim.
6. **Memory curator** — proposes durable memory candidates only; existing explicit confirmation and privacy policy remain authoritative.

Start with Manager + Planner + Verifier. Add specialist agents only when there is a demonstrated benefit.

### B. Task graph and scheduling

Represent each user request as a DAG:
- task_id, parent_task_id, project_id, user_request_id;
- title, objective, input_refs, output_schema;
- dependencies, priority, risk_tier, required_capabilities;
- state: queued / ready / running / waiting_approval / paused / succeeded / failed / cancelled;
- attempt, idempotency_key, deadline, cancellation_generation;
- created_at, updated_at, checkpoint_ref, result_ref;
- verification_status and evidence_refs.

Scheduler rules:
- dispatch only tasks whose dependencies are succeeded/verified as required;
- bounded concurrency; initial local default: one heavy model inference at a time, while lightweight I/O/retrieval tasks may overlap;
- do not run two writers against the same file/database/device/action target;
- reserve memory/thermal budget before model start;
- enforce per-task timeout, cancellation and exponential backoff for safe idempotent reads;
- never automatically retry non-idempotent side effects;
- pause when approval is required or the app/device lifecycle makes safe execution impossible;
- reconcile task state after process restart from durable ledger/checkpoint, not from in-memory flags.

### C. Context isolation and result contracts

Each specialist receives only:
- the minimum user-approved context needed;
- project scope and source commit/version;
- allowed tools and permissions;
- explicit objective, non-goals and time/resource budget;
- structured output schema.

Each specialist returns:
- outcome: complete / partial / blocked / failed;
- concise findings;
- source/evidence references and exact versions;
- assumptions and unknowns;
- files/artifacts changed (if authorized);
- tests/verification with command, exit status and evidence;
- suggested follow-up tasks, never self-authorized scope expansion.

Manager validates schema and provenance before merging results. Conflicting results trigger another read-only verification task or a user question; do not silently average contradictions.

### D. Android execution and safety

- Parallelize planning, independent research, local search and read-only diagnostics.
- Serialize microphone ownership, heavy model inference, SQLite writes/migrations, UI automation and actions against the same Android target.
- A task can prepare an action, but a runtime policy gate checks permission, risk, freshness and user approval immediately before execution.
- Messages, calls, purchases, deletion, payments, account/security changes and external sharing require explicit confirmation.
- Use semantic Accessibility nodes before visual coordinates; screenshots/context are short-lived and excluded from memory unless explicitly approved.
- Use Binder/AIDL for same-device IPC where appropriate; never expose an unauthenticated local HTTP endpoint.
- A cancelled task must not later emit TTS or execute a delayed side effect. Cancellation propagates through ASR, model, tools and TTS using a generation/request ID.
- The user must be able to see active tasks, pause/cancel them, and inspect what each one is doing.

### E. Provider abstraction

Define a provider-neutral `AgentBackend` contract:
- `runTask(input, context, capabilities, budget)`
- `streamEvents(runId)`
- `cancel(runId)`
- `resume(checkpointRef)`
- `health()`

Backends:
1. **Local backend** — OGAM's existing local models and typed tools; offline default.
2. **Optional OpenAI backend** — Responses API / Agents API multi-agent where network, user consent, eligible model and credentials exist.
3. Future providers (Gemini/Qwen/others) through the same contract, with provider-specific adapters.

Never require an OpenAI API key for core Jarvis. Do not embed secrets in the APK or expose them to model-generated code/subagents. Cloud fallback must be visible and user-configurable; no private context is sent without explicit policy/consent.

### F. Observability and user experience

Provide a compact task panel:
- task name and current phase;
- queued/running/waiting/paused/verified status;
- progress based on completed steps, not invented percentage;
- current specialist and safe summary of its activity;
- resource use (model, estimated memory, network/local);
- pause/cancel controls;
- final result with evidence and unresolved items.

Do not show fake "thinking" progress. A task is complete only when its output contract and required verification pass.

## Phased implementation proposal

Respect the existing Jarvis stage order; this research does not authorize skipping memory/device safety gates.

### Stage 1 — Finish and device-validate memory foundation
Complete current M1-M4 acceptance and the remaining M5 security/resilience gates. Preserve scope isolation and explicit consent.

### Stage 2 — Single-agent Planner + TaskLedger (next)
- typed task/step schemas and deterministic state machine;
- DAG dependency validation and cycle rejection;
- pause/resume/cancel with generation IDs;
- durable checkpoint and restart recovery;
- bounded replan count and stop conditions;
- deterministic local routing for known intents;
- tests for duplicate delivery, stale updates, cancellation races, crash recovery and blocked dependencies.
No multi-agent fan-out yet.

### Stage 3 — Safe Android actions
Implement capability registry, permission probe, risk tiers, just-in-time approval, idempotency and independent post-action verification.

### Stage 4 — Bounded parallel specialists
Add two read-only specialists first (e.g. research + verifier), with independent context and strict structured outputs. Benchmark quality/latency/RAM/battery versus sequential execution. Expand concurrency only from evidence.

### Stage 5 — Optional cloud multi-agent adapter
Integrate OpenAI Responses API multi-agent / Agents API behind a feature flag and explicit user consent. Verify current model eligibility, pricing, data controls, API availability and failure fallback before enabling. Core must continue offline.

### Stage 6 — Voice and ColorOS
Only after the earlier gates: expose task controls through voice, interrupt/cancel correctly, and test actual PGEM10/ColorOS behavior.

## Acceptance tests for the multitasking foundation

- independent read-only tasks overlap; dependent tasks wait;
- same-resource writes are serialized;
- task DAG cycles and unknown dependencies are rejected;
- one specialist cannot access another task's private context or tools;
- malformed or provenance-free specialist result is rejected;
- manager detects conflicting outputs and does not fabricate consensus;
- app process death resumes only from a valid durable checkpoint;
- cancellation prevents later TTS and side effects;
- duplicate dispatch is idempotent;
- non-idempotent actions are never auto-retried;
- missing approval, stale permission state or timeout fails closed;
- memory/thermal budget blocks unsafe concurrent model loading;
- offline mode completes supported local tasks without cloud credentials;
- cloud mode is opt-in and clearly indicates what context leaves the device.

## Risks and non-goals

- OpenAI's hosted multi-agent API is not an Android-local runtime and does not make local models parallel.
- Multiple local LLMs running concurrently may degrade latency, RAM, thermal behavior and battery on a phone; start with serialized heavy inference and parallelize I/O.
- More agents do not guarantee better answers; they increase cost, tool exposure and coordination complexity.
- Symphony is an orchestration reference/spec, not an Android library to embed directly.
- Do not copy proprietary code or assume an OpenAI API entitlement.
- No production code, build, APK, device test, deployment, secret, API call or billing setup is included in this research update.

## Source status

- OpenAI official product/API/engineering documentation: primary sources for the described capabilities.
- API beta/model eligibility, pricing, regional access and terms can change; re-check immediately before implementation.
- Android/OGAM feasibility remains a design proposal until implemented and tested on PGEM10.

## Sources

1. OpenAI, Introducing the Agents API (2026-09-10): https://openai.com/index/introducing-the-agents-api/
2. OpenAI API docs, Responses API Multi-agent: https://developers.openai.com/api/docs/guides/responses-multi-agent
3. OpenAI API docs, Orchestration and handoffs: https://developers.openai.com/api/docs/guides/agents/orchestration
4. OpenAI, An open-source spec for Codex orchestration: Symphony (2026-04-27): https://openai.com/index/open-source-codex-orchestration-symphony/
5. OpenAI Symphony spec: https://github.com/openai/symphony
6. OpenAI, The next evolution of the Agents SDK (2026-04-15): https://openai.com/index/the-next-evolution-of-the-agents-sdk/
7. OpenAI Developers, Run long-horizon tasks with Codex: https://developers.openai.com/blog/run-long-horizon-tasks-with-codex
8. Existing OGAM architecture research: `research/breeno/OGAM_CAPABILITY_MAPPING.md`
9. Existing Jarvis memory design: `research/agent-ecosystem/JARVIS_STEP_1_MEMORY_DESIGN_2026-11-24.md`
