# OGAM / Jarvis — model research and Siri-like assistant architecture

Date: 2026-11-22  
Status: research baseline; no model is selected as the sole production default yet.  
Target: independent OGAM fork, Android-first, local/offline-first, Russian-speaking Jarvis.  
Visual identity: Iron Man / Stark-style technical HUD. Assistant behaviour: natural, concise, context-aware and proactive like a modern personal assistant, not a command-line chatbot.

## 1. Non-negotiable product decisions

- Prefer downloadable open weights and local inference. No mandatory account, paid API, hosted model, telemetry or network connection.
- "Uncensored" is a model-behaviour descriptor, not a technical standard. Record the exact model revision, quantization, license, provenance and refusal-evaluation evidence. Do not accept a model-card claim as independent proof.
- Keep model freedom separate from device authority. The model may propose tool calls; a deterministic Android capability broker validates permissions, parameters, user consent and execution results.
- The assistant must be useful in Russian. English-only benchmark wins do not qualify a model as the default.
- Preserve a model-provider abstraction so a user can switch between local models and optional external endpoints without changing Jarvis memory, skills, tools or UI.
- Do not silently download large weights or enable remote fallback. Show size, RAM estimate, network destination and ask before optional cloud use.
- Do not copy Apple, Iron Man, or third-party proprietary code/assets. Reproduce product patterns independently and use original Jarvis artwork, sounds and animations.

## 2. Initial local model candidates

### A. First on-device baseline: Qwen3.5-4B

- Official model: https://huggingface.co/Qwen/Qwen3.5-4B
- License declared on the official model page: Apache-2.0.
- The official card documents multimodal input and agentic/tool-calling usage. A first-party GGUF conversion is available from https://huggingface.co/ggml-org/Qwen3.5-4B-GGUF.
- GGUF Q4_K_M is listed at approximately 3.03 GB on the ggml-org distribution; Q8_0 approximately 4.48 GB. Actual runtime memory is larger because of context/KV cache, native buffers and Android.
- Use as the reproducible baseline for Russian dialogue, tool-call correctness, latency, thermal behaviour and memory pressure. This is not an "uncensored" model by default.

### B. Low-refusal experiment: Aurum 4B Uncensored

- Model card: https://huggingface.co/2Beyes/Aurum-4B-Uncensored-GGUF
- The publisher describes it as a Qwen3.5-4B derivative with refusal behaviour removed and publishes Q4_K_M around 2.8 GB, with a matching vision projector.
- The model card's refusal-evaluation numbers are publisher-reported, not an independent benchmark. Treat them as a hypothesis to reproduce, not a guarantee.
- It is the most relevant early candidate for the user's "less restricted / uncensored" requirement, but it must pass the same Russian quality, hallucination, prompt-injection, tool-call and Android stability tests as the baseline.
- Keep it as an opt-in experimental profile until the evaluation is complete. Do not make it the only installed or default model based solely on its name.

### C. Efficient multimodal alternative: Gemma 4 E2B / E4B

- Official overview: https://ai.google.dev/gemma/docs/core
- Official release announcement: https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/
- Google describes E2B/E4B as mobile/edge models, multimodal (text, image, video and native audio on the smaller models), with tool/function calling and Apache-2.0 release.
- Google publishes approximate mobile memory requirements through LiteRT-LM: E2B 1.1 GB, E4B 2.5 GB (text-only figures 0.84/2.2 GB). These are vendor estimates for that runtime, not guaranteed OGAM llama.cpp numbers.
- This is a strong mobile and multimodal comparison candidate, not automatically the least-restricted model. Verify actual Russian behaviour and the original model card/license before distribution.

### D. Larger models are not first-run phone defaults

Families such as Qwen 27B, GLM, DeepSeek and Kimi are worth evaluating for a PC/home-server companion or optional LAN inference, but their weight and memory requirements make them unsuitable as the first on-device target. A local 4B model that actually runs reliably is more useful than a nominally stronger model that constantly swaps, overheats or kills the app.

## 3. Model evaluation gate

Build a reproducible, versioned test set before choosing a default. Run every candidate with the same prompts, context, temperature, tool schemas and hardware state.

Required test groups:
1. Russian conversation: natural spoken phrasing, grammar, names, dates, numbers, code-switching and noisy ASR transcripts.
2. Personal assistant: multi-turn context, remembering user-approved facts, follow-up references and correction of mistaken assumptions.
3. Planning: turn a vague goal into steps, identify missing inputs, preserve constraints, estimate dependencies and update a plan after interruption.
4. Tool calling: valid JSON/schema, correct tool selection, no invented tool success, recovery from tool errors and multi-step execution.
5. Low-refusal behaviour: benign sensitive/controversial topics, technical education, creative tasks and legitimate security research. Measure unnecessary refusals separately from unsafe compliance.
6. Reliability: hallucination rate, unsupported claims, source attribution, uncertainty and consistency over repeated runs.
7. Safety at the action boundary: resist prompt injection in retrieved pages/files; never execute a destructive, financial, communication or privacy-sensitive action without the app's permission/confirmation rules.
8. Android performance: cold load, warm tokens/sec, time-to-first-token, peak RSS/native memory, KV cache growth, battery drain, thermal throttling, background/foreground recovery and crash-free long sessions.

Keep raw benchmark prompts/results and exact model file hashes in the repository. Do not use a model's own self-evaluation as the sole score.

## 4. Siri-like product patterns to study and implement independently

Apple public documentation is useful for product behaviour and integration patterns, not as a source of reusable code or private implementation details.

- Personal context: Siri AI is described as understanding context across messages, mail, photos, calendar and other personal data. Jarvis should implement an explicit local context index with per-source permissions, retention controls and source citations.
- On-screen awareness: Apple documents contextual understanding of what is visible and the ability to follow references such as "this" or "that". Jarvis can provide an opt-in screen-context snapshot through Android-supported APIs/accessibility, with visible capture state and sensitive-field redaction.
- Natural actions: Apple's App Intents expose app actions and entities through schemas so a person can say what they want instead of memorising exact commands. Jarvis should expose its own typed Skill/Tool schemas to the planner and map them to deterministic Android executors.
- Multi-step workflows: Apple Shortcuts can assemble workflows from natural-language descriptions. Jarvis should create an editable plan, show steps/progress, ask only for genuinely missing or risky decisions, and support pause/resume/cancel.
- Conversational continuity: keep one session context across voice and text, support interruption/barge-in, follow-up questions, and a conversation history.
- Multimodal awareness: camera/image and screen input should be optional, permission-gated tools, not hidden always-on capture.
- Model profiles: Apple's Foundation Models documentation describes dynamic profiles and tool-calling controls. Jarvis should support task profiles (fast dialogue, deeper planning, vision, coding) while preserving a single assistant identity and shared permission broker.

### Apple availability caveat (important for a German/Russian user)

Apple's current public Siri AI support page says Siri AI is initially unavailable on iOS in the EU and its listed initial languages do not include Russian. Apple also states that Apple Intelligence requires supported iPhone hardware (iPhone 15 Pro/Pro Max and iPhone 16 or later, depending on feature). This is a product-research reference only; Jarvis must not depend on Apple services or their regional availability.

## 5. Proposed Jarvis architecture

1. **Voice interface** — wake word, VAD, streaming ASR, interruptible TTS, duplex turn-taking and text fallback. Keep ASR/TTS replaceable and local.
2. **Conversation orchestrator** — owns session state, dialogue turns, intent classification, clarification and response streaming.
3. **Planner** — creates typed plans with steps, dependencies, preconditions, risk levels, progress and rollback/compensation where possible. A plan is data, not executable code.
4. **Local model router** — chooses a user-installed model/profile based on task, available RAM/thermal state and modality; no silent cloud fallback.
5. **Memory and context** — SQLite-backed short/long-term memory, FTS/semantic retrieval, explicit user-approved durable memories, source references, per-category permissions and delete/export controls.
6. **Skills/tool registry** — typed JSON schemas, descriptions, capability declarations, required Android permissions, risk classification and result schemas.
7. **Android capability broker** — validates every call, checks permission state, requests confirmation for sensitive operations, executes through supported Android APIs/services and returns a factual result.
8. **Knowledge/research** — opt-in web/local-file retrieval with provenance, untrusted-content isolation and prompt-injection-resistant tool boundaries.
9. **Presentation layer** — original Iron Man-inspired HUD: central animated reactor/assistant presence, compact live status, waveform, task cards, timeline, tool activity and clear permission prompts. Keep the interface readable and usable one-handed; visual effects must never hide task state or actions.

The assistant's personality should be warm, composed, precise and lightly witty when appropriate. It should speak naturally, not announce internal reasoning, and distinguish "I plan to do this", "I am doing this" and "I completed this" accurately.

## 6. Apple research sources

- Apple Siri AI product announcement (2026): https://www.apple.com/newsroom/2026/09/siri-ai-a-profoundly-more-capable-and-personal-assistant-is-here/
- Apple Support — Siri AI on iPhone: https://support.apple.com/guide/iphone/get-started-with-siri-ai-iphv6zwrg8jvfgr/27/ios/27
- Apple Developer — Apple Intelligence, Foundation Models, App Intents, Visual Intelligence and Shortcuts: https://developer.apple.com/apple-intelligence/
- Apple Developer — Foundation Models updates and tool-calling controls: https://developer.apple.com/documentation/updates/foundationmodels
- Apple Human Interface Guidelines — Siri: https://developer.apple.com/design/human-interface-guidelines/siri

## 7. Research references for model candidates

- Qwen3.5-4B official model card: https://huggingface.co/Qwen/Qwen3.5-4B
- ggml-org Qwen3.5-4B GGUF: https://huggingface.co/ggml-org/Qwen3.5-4B-GGUF
- Aurum 4B Uncensored GGUF (community derivative; claims require independent validation): https://huggingface.co/2Beyes/Aurum-4B-Uncensored-GGUF
- Google Gemma 4 overview: https://ai.google.dev/gemma/docs/core
- Google Gemma 4 release and Apache-2.0 announcement: https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/

## 8. Decisions and next steps

- Keep Qwen3.5-4B as the reproducible baseline and Aurum 4B as the low-refusal experiment; add Gemma 4 E2B/E4B as the mobile multimodal comparison.
- Do not hard-code one model into Jarvis identity or planner. The same assistant, memory, skills and HUD must survive model switching.
- Inspect actual OPPO Find X6 Pro RAM, available storage, Android version, llama.rn backend support and thermal behaviour before choosing quantization/default.
- Verify all candidate model licenses and full model cards at the exact pinned revision before packaging or redistributing weights.
- Next engineering slice: build a model-evaluation manifest and a small Russian/tool-use benchmark runner; do not yet replace the existing model catalog or memory-fit policy.
- Separately, the planned splitGgufModelName / modelDisplayName / isRawModelName extraction remains blocked until the full @offgrid/models implementation and tests can be recovered. The public repository search did not expose those helper implementations; do not guess their behaviour.


## 9. Open Android assistant projects inspected

These are architectural references, not dependencies selected for OGAM. Inspect current source and third-party notices again before any reuse.

- Jandal AI — https://github.com/NickMonrad/kernel-ai-assistant — Apache-2.0. Relevant patterns: on-device Gemma via LiteRT, long-term semantic memory, deterministic Android actions, voice and native tool calling. Strong match for the local Brain-Memory-Action split; inspect its permission/action boundary and tests.
- PocketDaemon — https://github.com/HyperCoherence/PocketDaemon — MIT. Relevant patterns: Android-native voice sessions, local memory, skills and telephony integration. Its README explicitly describes it as experimental and its privileged Magisk path as unsuitable for general consumer use; do not import privileged call/SMS behaviour into the default app.
- Hermes Vox — https://github.com/chezgoulet/hermes-vox — GPL-3.0. Relevant patterns: voice call UX, interruption/turn-taking, visible agent activity, local audio path separated from the agent's tools/memory. Treat code reuse as a separate copyleft decision; architecture study only for now.
- Droy — https://github.com/moonoops/Droy — AGPL-3.0-only. Relevant patterns: Android task execution, planner/session handling, companion UX and memory integration. Architecture study only unless the project explicitly accepts AGPL obligations; review its third-party notices before any component reuse.
- Simon — https://github.com/damyan-deshev/simon — README describes local STT/TTS, SQLite FTS memory, Android client and a pre-response reasoning/checking phase. A root LICENSE file was not found in the inspected repository paths; no code copying or dependency until a valid license is confirmed.

Selection rule: MIT/Apache-2.0 projects are candidates for deeper component-level inspection, but the license of every bundled dependency, model, asset and copied file still governs. GPL/AGPL projects remain reference-only unless the project explicitly chooses the corresponding obligations. No license means no copying.


## 10. Additional uncensored/abliterated model comparison (2026-11-22)

A second pass over Hugging Face model cards found two materially different Qwen3.5-4B derivatives. They should not be collapsed into one "uncensored" category:

- **Huihui-Qwen3.5-4B-abliterated** — https://huggingface.co/huihui-ai/Huihui-Qwen3.5-4B-abliterated. The author describes it as a refusal-reduced fine-tune of Qwen3.5-4B, and notes that the text weights were processed, the image side was not, and the MTP head is no longer included. The GGUF packaging page https://huggingface.co/privastudio/qwen3.5-abliterated lists Q4_K_M around 2.71 GB and requires a Hugging Face access/terms acknowledgement at the time inspected. This is a candidate, but the access gate, provenance chain and missing MTP head must be recorded.
- **Qwen3.5-4B-Uncensored-v2** — https://huggingface.co/InterpreticAI/Qwen3.5-4B-Uncensored-v2-GGUF. The card describes a narrower change: political censorship reduction. Its published evaluation reports a political-censorship rate of 13.7% (7/51) versus 92.2% (47/51) for the base model, while its BF16 evaluation reports that 93/100 harmful-request prompts were still refused. These are author-reported results, not independent validation. Q4_K_M is listed around 2.78 GB; a matching vision projector is listed separately. This is a useful "less over-refusal while retaining many harmful-request refusals" comparison profile, not a no-refusal model.
- **Aurum 4B Uncensored** — https://huggingface.co/2Beyes/Aurum-4B-Uncensored-GGUF. Its author claims 0/100 refusals on a harmful-request set and Q4_K_M around 2.8 GB. This is the most unrestricted candidate found in this pass, and therefore requires the strongest adversarial, prompt-injection and tool-boundary tests before any default selection.

Recommended evaluation profiles:
1. Baseline: official Qwen3.5-4B.
2. Reduced-over-refusal: Qwen3.5-4B-Uncensored-v2.
3. Abliterated research: Huihui-Qwen3.5-4B-abliterated.
4. Unrestricted research: Aurum 4B Uncensored.

Do not rank these by "uncensored" labels alone. Evaluate Russian language quality, factual accuracy, reasoning, tool-call validity and refusal behaviour separately. Keep the action broker outside the model so even the unrestricted research profile cannot directly grant itself Android permissions or silently execute privileged actions.

Dynamic discovery sources such as https://abliteratedmodels.org/ and https://aiunzipped.com/models/uncensored are useful for finding candidates, but are indexes, not provenance authorities. Verify each candidate against its upstream model card, exact files, license and checksums.
