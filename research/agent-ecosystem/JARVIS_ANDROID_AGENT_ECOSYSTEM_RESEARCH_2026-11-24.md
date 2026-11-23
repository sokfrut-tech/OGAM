# Jarvis AI — Android agent ecosystem research update
Date: 2026-11-24
Repository: `sokfrut-tech/OGAM`
Research branch: `research/jarvis-agent-ecosystem-2026-11-24`
Target: OPPO Find X6 Pro PGEM10 / Snapdragon 8 Gen 2 / Android 16 / ColorOS 16.0.5
Scope: read-only source and product research; no production code changed, no APK built, no device tests run.

## 1. Project state verified before this research

- The active Jarvis implementation is the OGAM fork, not the separate GitLab project `sokfrut-tech/jarvis`.
- GitLab `sokfrut-tech/jarvis` currently contains only `README.md`, one `main` branch and one initial commit (`0e75ec81`). It is a scaffold, not the current implementation.
- OGAM has branches `main`, `feature/jarvis-step-2-storage-privacy`, `feature/jarvis-step-3-model-scanner`, and `docs/research-breeno-coloros-2026-11-22`.
- Draft PR #1, `Jarvis Step 2: privacy and Android storage permission bridge`, remains open and unmerged. Its description includes work for storage privacy, model library/scanner, raw prompt/prefill APIs, voice image generation, Russian localization and a manual arm64 APK workflow.
- PR #1's latest recorded CI diagnosis is not a green end-to-end build: run 45060169581 exposed missing private `off-grid-ai/shared` and `off-grid-ai/mobile-pro` workspaces because `PRO_SUBMODULE_PAT` was empty. A follow-up test-clock fix at commit `4772d58d5f35c927fbb2392406b800039c2bc8c5` had not yet been rerun in the recorded PR description. No Gradle APK build or PGEM10 install test is claimed.
- Draft PR #2, `Research: add Breeno and ColorOS adaptation plan`, is also open and unmerged. It records device evidence and clean-room architecture research, but its APK analysis is static/read-only: full JADX decompilation, runtime tracing and target-device validation were not performed.
- The latest main-branch commits include research-file reverts on 2026-11-23. Keep research deliverables on the research branch / draft PR; do not write them directly to `main`.

## 2. OGAM foundations and actual Jarvis gap

The upstream-derived OGAM codebase already supplies substantial reusable systems: llama.cpp/llama.rn local GGUF inference, OpenAI-compatible remote providers, streaming generation, tool loop, Whisper integration, Qwen ASR research/integration paths, Kokoro-related voice components, image generation, vision, local RAG, model management, document ingestion, and a React Native Android UI.

The audited Jarvis system-assistant path is real but limited:
- `JarvisVoiceInteractionService` and `JarvisVoiceInteractionSession` register the Android assistant entry point.
- The session hands off to the existing Chat UI through a private bridge activity and a one-use launch token.
- Assist/screenshot context is explicitly disabled.
- The session itself does not implement a wake word, DSP hotword detector, continuous microphone capture, neural VAD, or a standalone production Russian TTS engine.
- The current generic `voiceService.ts` delegates to `@react-native-voice/voice`; this does not establish which recognition backend ColorOS selects or prove offline operation.
- `speechEndpoint.ts` is an adaptive RMS/noise-floor silence endpoint heuristic, not Silero/neural VAD.
- `JarvisTtsBackend` is a useful model-neutral PCM interface, not evidence that a production Russian TTS model is wired into it.

Existing detailed evidence:
- `docs/jarvis/OGAM_VOICE_STACK_REALITY_AUDIT_2026-11-22.md`
- `research/voice/README.md`
- `research/breeno/OGAM_CAPABILITY_MAPPING.md`
- `research/breeno/OGAM_NATIVE_ASSISTANT_IMPLEMENTATION_BRIEF.md`

## 3. New Android agent references audited

### A. LocalIntelligence — strongest design reference for small offline models
Repository: https://github.com/riceharvest/LocalIntelligence
License: Apache-2.0 (root LICENSE inspected).
The README describes a small Android-native, auditable agent loop intended for 1–4B on-device models, with deterministic Android tools, explicit per-network-call consent, local storage and no telemetry. It documents what leaves the device per optional network feature and uses a strict opt-in boundary.

Transfer to Jarvis:
- Study the small, auditable agent loop and typed Android tool contracts.
- Use a local-model-first profile and make every network capability visibly opt-in.
- Keep tool execution deterministic and permission-aware rather than relying on model instructions.
- Do not replace OGAM's existing llama.rn runtime without a measured reason. Source-level audit and runtime benchmark are still required before code reuse.

### B. Nyral — useful memory/browser/tool UX, but not an offline inference engine
Repository: https://github.com/aixtin/nyral
License: MIT (root LICENSE inspected).
The README explicitly distinguishes local-first storage from on-device inference: chats, memory and files are local, but model inference uses a user-supplied API key or endpoint. It describes SQLite memory with ONNX embeddings and keyword recall, an agent browser, SSH, accessibility actions, scheduled jobs and a large tool set.

Transfer to Jarvis:
- Study local memory provenance, explicit “remember” behavior, task/session organization, visible tool progress and browser hand-back for CAPTCHA.
- Do not describe Nyral as fully offline or copy its remote-API architecture into Jarvis core.
- Audit its actual Android permission boundaries and source before adopting implementation details.

### C. PalmClaw — strong agent framework concepts, incompatible source-license default
Repository: https://github.com/ModalityDance/PalmClaw
License: AGPL-3.0 (root LICENSE inspected).
Its README describes an Android-native agent runtime with sessions, memory, skills, typed device tools, permission checks, confirmations, workspace boundaries, MCP/provider integration and scheduled/heartbeat automation. Inference is configured through an LLM API rather than being inherently on-device.

Transfer to Jarvis:
- Study session/workspace boundaries, skill loading, cron/heartbeat lifecycle and permission/confirmation contracts.
- Treat as architecture reference only unless AGPL-3.0 obligations are explicitly accepted. Do not copy source into OGAM by default.

### D. Open Jarvis — broad feature checklist; claims need source verification
Repository: https://github.com/tokenarc/open-jarvis
License: MIT (root LICENSE inspected).
Its README claims Accessibility-based actions, app chaining, screen OCR, voice input/TTS, graph memory, local models, skills, MCP, screen watch, automation, risky-action confirmations and self-healing execution.

Transfer to Jarvis:
- Use it as a feature-discovery checklist for app chaining, tutorial mode, action verification, prompt/skill libraries and recovery.
- The README's “Live” labels are maintainer claims, not independent verification. Inspect code, tests, dependencies and real-device behavior before adoption.
- MIT permits reuse subject to notice retention, but third-party model/dependency licenses must be audited separately.

### E. DroidClaw — agent loop and local knowledge graph reference
Repository: https://github.com/dgirard/droidclaw
Its README describes an Android-resident agent loop, iterative tool calls, provider switching, persistent memory/knowledge graph, skills and Android-native tools. The root LICENSE path was not found in this inspection; no source reuse until the repository license is confirmed.
Transfer: inspect its graph recall, session compaction, tool schemas and mobile lifecycle. Treat claimed functionality as unverified until source and tests are reviewed.

### F. Self-hosted JARVIS — strong authorization model, not a mobile/offline drop-in
Repository: https://github.com/harsh-life/JARVIS
The README describes a server-hosted task runtime where the model proposes actions, deterministic policy authorizes them, tools execute, and risky actions pause for user confirmation. It explicitly labels the project pre-release and says several features are off by default. Root LICENSE was not found in this inspection.
Transfer: adopt the model-proposes / deterministic-authorizer / executor separation as a design principle. Do not import code until license and maturity are established; the server is not a replacement for the on-device voice pipeline.

## 4. Kimi, Qwen and Z.ai — what belongs in Jarvis

### Kimi / Moonshot
Official Kimi API documentation describes an OpenAI-compatible Chat Completions API with streaming, multimodal input, file parsing, web search and custom tool calls. Tool calling supports multiple tool calls, including parallel independent calls. API access is pay-as-you-go and separate from Kimi app or membership subscriptions.
- Potential use: optional cloud provider adapter in OGAM's existing OpenAI-compatible remote-provider layer; long-context research and delegated multi-step tasks.
- Not suitable as the offline core: it requires a network API and account/API key.
- Kimi's agent swarm is a remote orchestration concept; do not reproduce hundreds of parallel agents on the phone. If needed, delegate large research tasks to the existing Factory/hive infrastructure.
Sources: https://www.kimi.ai/help/kimi-api/api-overview ; https://www.kimi.ai/help/agent/agent-overview ; https://www.kimi.ai/help/kimi-api/tool-use

### Qwen / Alibaba
Qwen's official model repository lists small open-weight model sizes in the Qwen3.5 family (including 0.8B, 2B, 4B and 9B), and its official Qwen-Agent project supports tool/function calling, ReAct-style agents and parallel function calls. Qwen3-ASR is a separate open model family supporting 52 languages/dialects.
- Potential use: evaluate the smallest Qwen instruction model as a local intent/router model only after GGUF/runtime compatibility, Russian quality, RAM, thermal and latency tests on PGEM10.
- Keep Qwen3-ASR and Qwen3-TTS as separate speech components; do not conflate ASR/TTS models with the dialogue LLM.
- Qwen-Agent is Python-oriented and should be treated as a design/reference implementation, not an Android dependency.
Sources: https://github.com/QwenLM/Qwen-Agent ; https://github.com/QwenLM/Qwen3-ASR ; https://github.com/QwenLM/Qwen3.8

### Z.ai / GLM
The current Z.ai GLM-5.4 announcement says open weights are planned after additional safety hardening; it is not currently an established on-device open-weight choice. Z.ai documents API access through OpenAI-compatible Chat Completions and a separate Anthropic-compatible endpoint for its coding plan.
- Potential use: optional remote provider profile for online fallback or coding/research.
- Not suitable as the offline core until weights, license, mobile runtime and Snapdragon 8 Gen 2 benchmarks are actually available.
- Preserve a clear boundary between the GLM provider API and the local Android tool authorization layer.
Sources: https://z.ai/blog/glm-5.4 ; https://zcode.z.ai/en/docs/configuration

## 5. Consolidated architecture decisions

1. **Local-first, not local-only by accident.** Local inference and local memory are the default. Kimi/GLM/cloud endpoints are explicit optional providers, with clear network disclosure and per-provider credentials.
2. **Model proposes; deterministic code authorizes.** The LLM never receives direct authority over Android. Each tool has a typed schema, permission declaration, risk class, idempotency policy, timeout and audit event. Unknown tool, invalid arguments, missing permission or missing approval fails closed.
3. **One physical microphone owner.** Preserve OGAM AudioRecorderService as the sole capture owner. KWS/VAD/ASR consume a shared PCM stream or coordinate through that owner; never create a competing recorder.
4. **Keep half-duplex until echo cancellation is measured.** Do not enable conversational barge-in/full-duplex until AEC is attached to the actual AudioRecord session and timestamp-aligned playback reference is verified on PGEM10.
5. **Separate summon from voice intelligence.** Android assistant role, ColorOS physical summon, wake-word, VAD, ASR, dialogue, tools and TTS are independent capabilities with separate status and tests.
6. **No always-on claim yet.** Current system-assistant integration is not a wake-word engine and Android third-party microphone restrictions remain a hard platform boundary.
7. **Keep current OGAM runtimes unless measurements justify replacement.** Existing llama.rn, Whisper/Qwen research, TTS PCM interface, RAG and provider abstractions are assets; add adapters, not parallel registries or duplicate model managers.
8. **Research reuse policy.** Prefer Apache-2.0/MIT references after full dependency/model license review. AGPL/GPL projects remain architecture-only unless their obligations are explicitly accepted. No-license/unclear-license projects are not source-reuse candidates.
9. **Do not change ColorOS or privileged behavior speculatively.** Public Android APIs first; no root, LSPosed, Shizuku or private OPPO permission is required for core Jarvis.

## 6. Priority next steps

### P0 — make the current branch buildable and verifiable
- Resolve the private submodule dependency gate (`PRO_SUBMODULE_PAT` read access to `off-grid-ai/mobile-pro` and `off-grid-ai/shared`) or produce a documented, license-safe open-core test/build route.
- Re-run the explicit-clock test fix and all CI gates; separate static source-contract checks from TypeScript/Jest/JVM/Gradle results.
- Run the manual arm64 APK workflow only after its workflow is present on the default branch and private dependency access is available.
- Install on PGEM10 and verify role selection, assistant invocation, one-shot bridge token, launch/cancel behavior and no unintended context capture.

### P1 — voice and action runtime
- Complete concrete Russian TTS backend audit and choose only after PGEM10 benchmark (TTFA, RTF, RAM, temperature, battery, intelligibility, interruption).
- Benchmark Russian KWS candidate and streaming ASR with a fixed corpus; do not promote author-reported figures to device results.
- Implement a deterministic Android tool authorization gate and safe public-API adapters; test permission denial, cancellation, duplicate requests and non-idempotent action confirmation.
- Add source-backed memory with user-visible review/delete/export and provenance, rather than opaque automatic memory.

### P2 — optional provider and ecosystem adapters
- Add Kimi and Z.ai as named configuration presets over the existing OpenAI-compatible provider only after endpoint, model list, auth storage, streaming, tool-call parsing and error handling are tested.
- Evaluate small Qwen local model candidates in a benchmark-only branch; do not switch production model until Russian command/task quality and device resource measurements pass.
- Continue source-level audits of LocalIntelligence, Nyral and Open Jarvis; audit PalmClaw/DroidClaw/JARVIS licenses and dependency trees before considering any code reuse.
- Keep swarm/multi-agent delegation on the remote Factory infrastructure, not as uncontrolled background processes on the phone.

## 7. Evidence boundaries

- Repository READMEs and product documentation describe claimed features; they are not proof of target-device behavior.
- OGAM Kotlin/TypeScript source files were inspected read-only for the assistant handoff, generic speech recognition, RMS endpoint heuristic and TTS interface.
- This update did not build OGAM, run its test suite, download model weights, install any candidate app, access the user's phone or change production code.
- No proprietary OPPO source, APK bytes, model weights, credentials or user audio were added.

## 8. Primary references

- OGAM PR #1: https://github.com/sokfrut-tech/OGAM/pull/1
- OGAM PR #2: https://github.com/sokfrut-tech/OGAM/pull/2
- OGAM voice reality audit: https://github.com/sokfrut-tech/OGAM/blob/docs/research-breeno-coloros-2026-11-22/docs/jarvis/OGAM_VOICE_STACK_REALITY_AUDIT_2026-11-22.md
- OGAM voice research index: https://github.com/sokfrut-tech/OGAM/blob/docs/research-breeno-coloros-2026-11-22/research/voice/README.md
- LocalIntelligence: https://github.com/riceharvest/LocalIntelligence
- Nyral: https://github.com/aixtin/nyral
- PalmClaw: https://github.com/ModalityDance/PalmClaw
- Open Jarvis: https://github.com/tokenarc/open-jarvis
- DroidClaw: https://github.com/dgirard/droidclaw
- Self-hosted JARVIS: https://github.com/harsh-life/JARVIS
