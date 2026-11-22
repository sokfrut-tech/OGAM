# Breeno / ColorOS Open-Source Reference Projects

Research date: 2026-11-22
Target: OPPO Find X6 Pro (official model code PGEM10; user target)
Purpose: extract design patterns and reproducible facts for an independent Russian Jarvis implementation. This is a research register, not an endorsement to install modules or use root.

## 1. timetetng/breeno-rikkahub — Breeno UI bridge to an external assistant
URL: https://github.com/timetetng/breeno-rikkahub
License: README declares MIT (verify LICENSE file before copying code).

README-level findings:
- Hooks Breeno's own chat data layer and reroutes user text into a local RikkaHub conversation using its embedded Web API.
- Described flow: ColorOS power-key summon → Breeno SpeechService action → Breeno floating chat activity → intercept query message → POST to local conversation API → consume SSE stream → inject answer message into Breeno's chat view model.
- Breeno continues rendering its UI shell and its own TTS reads the injected answer; current README says text-only bridge and no replacement of speech TTS.
- README identifies Breeno 11.8.3 / versionCode 110803 and obfuscated AIChatDataCenter method signatures; these are version-specific and must not be assumed stable.
- Requires LSPosed and RikkaHub local web service. README recommends binding to 127.0.0.1; its example disables JWT, which is a security trade-off and must NOT be copied. Jarvis must use authenticated IPC or a tightly scoped local transport with authentication and loopback-only binding.
- It explicitly warns that app updates may rename obfuscated methods and silently break hooks.

Jarvis lessons:
1. Breeno can be treated as a possible presentation shell while a different model backend generates answers. This is an experimental interoperability concept, not our core architecture.
2. Keep the model/conversation backend behind a stable adapter and stream partial responses; do not couple the orchestrator to Breeno's obfuscated classes.
3. Prefer a native Jarvis UI/VoiceInteractionSession. A Breeno bridge would be optional only if lawful, compatible, user-approved and maintainable.
4. Add version fingerprint checks and fail-closed behavior to any experimental hook; never inject text into an unknown UI version.
5. Keep TTS independent. The bridge's dependence on Breeno TTS demonstrates why Jarvis must own its ASR/TTS lifecycle and interruption handling.

Not verified yet: source code, actual hook implementation, test coverage, current compatibility, release APK, runtime behavior on PGEM10, or whether its MIT license covers every bundled dependency. Do not claim porting.

## 2. Andrea-lyz/ColorOS-Assistant-Restore — assistant entry-point dispatch
URL: https://github.com/Andrea-lyz/ColorOS-Assistant-Restore

README and technical notes say China-region ColorOS can hard-route assistant summon entry points to the OEM assistant rather than Android's configured assistant role. Notes describe hooks at system_server / SystemUI dispatch points. Known detailed baseline is ColorOS 16 / V16.1.0 / PJZ110, with root and LSPosed-class framework required by releases.

Jarvis lessons:
- Separate Android's assistant role from OEM physical/gesture entry-point routing.
- Verify each entry point separately: power long-press, gesture-handle long-press, corner swipe and screen-recognition path.
- Never port hook signatures or binary patches to PGEM10 without exact firmware analysis.
- Keep root/LSPosed entirely outside core acceptance criteria.

## 3. evokermc098-coder/MindTriggerAssist — Shizuku setup and long-press rerouting
URL: https://github.com/evokermc098-coder/MindTriggerAssist

README targets Find X7 / ColorOS 16 China and uses Shizuku for setup, then runs without root. It routes a ColorOS long-press toward Google/Gemini/Circle to Search. Requires Google/Gemini and user setup. Not directly suitable as a Jarvis dependency.

Jarvis lessons: document setup privileges and runtime requirements clearly; provide a capability check and fallback; do not promise that Shizuku is equivalent to root or that this Find X7 implementation works on Find X6 Pro.

## 4. niki914/zafiro — broader Android agent reference
URL: https://github.com/niki914/zafiro

Previously identified as an Android agent reference with screen understanding, actions, memory, tools/MCP and optional Breeno integration. Detailed source audit remains pending. Treat as a candidate for a separate source review, not an already adopted component.

## 5. JerryTse-OSS/BreenoNext_Bypass — NOT an integration candidate
URL: https://github.com/JerryTse-OSS/BreenoNext_Bypass

README describes an LSPosed module bypassing Xiaobu Next beta verification using runtime DexKit resolution of obfuscated classes. This is an access-control / beta-verification bypass, not a voice-assistant capability. Do not port, reproduce or use it to access restricted beta services. It only demonstrates that Xiaobu Next's internals are obfuscated and version-sensitive; no implementation dependency is accepted.

## 6. bryanbao-lab/xiaobu-memory-obsidian — Breeno Memory export workflow
URL: https://github.com/bryanbao-lab/xiaobu-memory-obsidian

README describes batch OCR of Breeno Memory share images, de-duplication and export to searchable Obsidian Markdown. It is macOS-first and not a mobile assistant runtime.

Jarvis lessons: personal memory needs import/export, provenance, deduplication, OCR and human review. Do not ingest screenshots or personal memory without explicit user action and privacy controls.

## 7. sokfrut-tech/breeno-apks — owner repository inventory
URL: https://github.com/sokfrut-tech/breeno-apks

The repository README is only a project-continuation placeholder and says the repository was empty when inventoried on 2026-11-04. No APK archive or scope has been verified. Do not assume it contains Breeno installers. It may be a future isolated evidence repository only after the user supplies/authorizes artifacts and the scope is documented. Do not upload proprietary APKs to a public repository.

## Prioritized next research actions
1. Audit complete source tree and LICENSE for breeno-rikkahub; identify exact hook entry points, IPC security and test gaps. Do not run the module on the daily-use phone.
2. Inspect Zafiro source and license for architecture reusable without OEM hooks.
3. Capture actual PGEM10 firmware and installed Breeno package metadata from the user's device before selecting APK variants.
4. Build a static APK report (hash, signature, manifest, exported components, services, receivers, providers, native libraries) without distributing proprietary binaries.
5. Create a Breeno parity matrix with observed / inferred / unknown states and map accepted features to OGAM modules.

## Security and licensing policy
- No beta-gate bypass, authentication bypass, proprietary API abuse or permission spoofing.
- No copied OPPO code/assets unless clearly redistributable under verified license.
- Public repo receives only original analysis, source links, hashes, non-sensitive metadata and properly licensed code.
- Any hook or local bridge must be optional, version-gated, loopback-only, authenticated and disabled by default until tested.


## Source-level audit: breeno-rikkahub (2026-11-22)
The repository tree and primary Kotlin files were inspected through GitHub's public source interface: BreenoHook.kt, RikkaClient.kt, Config.kt, Entry.kt, AndroidManifest.xml, Gradle config and build workflow. This is a source reading only; no APK was built or run.

### Confirmed implementation mechanics
- Xposed entry point filters package com.heytap.speechassist and can be disabled by Config.ENABLED.
- It hooks two Breeno data-center variants: pluginAdapter.aichat.AIChatDataCenter (addChatBeanData / notifyUpdateView) and legacy aichat.AIChatDataCenter (obfuscated J / E).
- It reads AIChatViewBean fields through reflection, intercepts TYPE_QUERY, forwards text to RikkaHub POST /api/conversations/{id}/messages, consumes SSE snapshot/node_update events and creates TYPE_ANSWER beans to update the existing UI.
- It cancels an in-flight stream for the same room and posts UI updates on the main thread.
- The manifest requests INTERNET and ACCESS_NETWORK_STATE only; Gradle targets SDK 35, min SDK 26, Java 17, Kotlin 2.0.21, AGP 8.7.3, Gradle 8.11.1. GitHub Actions builds a debug APK artifact.

### Code-level risks and limitations found
1. Transport is plain HTTP and unauthenticated. The README/config rely on 127.0.0.1 and disabling JWT. Loopback reduces exposure but does not provide application-level authentication; do not reuse this transport design as-is.
2. SSE connection accepts any response code before reading inputStream and uses an unbounded read timeout; error handling is minimal. Jarvis needs explicit HTTP status validation, bounded lifecycle, reconnect/backoff, cancellation and structured errors.
3. baselineMessageCount is passed as 0, so the comment about filtering messages created after stream start does not provide meaningful stale-message protection in this integration.
4. Duplicate suppression uses a global lastInputKey composed of roomId and query; identical consecutive utterances may be dropped even when intentional. Use turn/request IDs and bounded idempotency windows instead.
5. Hooking both data-center classes and dynamically tracing constructors/methods is fragile and may create duplicate interception or performance/logging/privacy issues. Debug trace should be off by default and logs must redact user content.
6. Reflection relies on Breeno classes, bean getters/setters, enum/type constants and obfuscated method names. The README itself states compatibility is version-sensitive. Add package version/signature fingerprint checks and fail closed.
7. It suppresses native TYPE_ANSWER events and injects the replacement into Breeno's UI. A hook failure after suppression could leave the user without an answer. A robust bridge needs rollback/fallback to native Breeno or a separate Jarvis UI.
8. Bridge is text-only and sets interceptStreamTTS; README says Breeno TTS remains responsible for speech output. This is not a reusable ASR/TTS stack.
9. Config supports a master switch and dry-run, but no in-app settings or capability health screen. The module is not a normal third-party assistant and requires Xposed injection into Breeno.
10. Build workflow produces debug artifact only; no release signing, unit/instrumentation tests, compatibility matrix or automated device tests were identified in the inspected files.

### OGAM decision
Do not port the Xposed hook into OGAM core. Adopt only general architecture lessons: model-provider adapter, streaming response contract, explicit conversation/session IDs, cancelable generation handles, UI-independent orchestrator, versioned compatibility probes and fail-safe fallback. The preferred OGAM implementation remains its own native voice assistant and UI using public Android APIs. A Breeno UI bridge may be a separate, disabled-by-default experiment only after legal, device, firmware, privacy and security review.


## Source-level audit: niki914/zafiro Breeno adapter (2026-11-22)
Inspected the public MIT LICENSE, README, Breeno integration guide, BreenoConfigProvider.kt, BreenoHook.kt, BreenoCardRenderer.kt, and version-specific JSON configurations 130302 and 130305. This is source inspection only; no APK was downloaded, built or executed.

### Major discovery: explicit version profiles for Breeno 13.3.2 and 13.3.5
Zafiro's version registry lists 130302 and 130305, corresponding to catalog-listed Breeno 13.3.2 and 13.3.5. Its JSON profiles define class/method mappings for:
- input capture from AIChatDataCenter and AIChatViewBean;
- response interception and a self-injected marker;
- conversation reset signal via AIChatRoomIdManager;
- floating-screen detach and SpeechAssistMainActivity resume lifecycle;
- native directive filtering and cleanup suppression;
- response card rendering, streaming update method, reasoning/thinking block fields, client-local data keys and feedback footer/copy/upvote controls.
The 13.3.2 and 13.3.5 profiles differ in obfuscated method names, including conversation-reset and card-update methods. This confirms that adapter profiles must be version-specific; it does not prove compatibility with the user's installed APK or firmware.

### Architecture findings
- Zafiro's BreenoConfigProvider separates host-specific class/method strings and argument indices into data-driven profiles instead of scattering reflection names through code.
- BreenoHook is a high-level orchestration layer that composes input, response, session-reset and cleanup subhooks with a separate card renderer.
- BreenoCardRenderer manages a turn-scoped render session, checks whether a turn is still active, renders incremental assistant frames, adds thinking/reasoning UI metadata, and clears state on final response or reset.
- The wider project advertises an Android agent with Phone-Use/accessibility, Skills, MCP, persistent sessions, memory, Python and shell tools, multilingual UI including Russian, and optional LSPosed voice-assistant takeover. The README explicitly says takeover requires root.
- Project structure separates accessibility, business contracts/agent orchestration, agent runtime, persistence/IPC, Compose UI, Xposed runtime and permission management. This is a strong modularity reference for Jarvis, though not a requirement to copy the entire product.

### Adaptation decisions
1. Adopt the data-driven adapter-profile pattern, not the Xposed code itself: versioned capability profiles, exact package/versionCode/build fingerprint, class/member signatures, required permission level and confidence/evidence.
2. Add a `BreenoProfileRegistry` only as an optional research/compatibility module. Profiles must be generated from the exact target APK's own static analysis and signed/hash-verified artifact, never selected from an online version string alone.
3. Build a generic `AssistantSurfaceRenderer` contract for streaming answer cards, thinking status, tool status, copy/share feedback and finalization. OGAM's native UI is primary; Breeno card rendering remains experimental and optional.
4. Use turn IDs and a single lifecycle state machine across ASR, model generation, tools and TTS. Cancel/clear on session reset, user interruption, app background and device audio-focus loss.
5. Keep any hooks fail-closed and never suppress native answers until the replacement path is proven healthy; if experimental bridge fails, allow native Breeno to continue or display Jarvis separately.
6. Verify MIT license and retain copyright notice if any Zafiro code is later copied. The license of Zafiro does not grant rights to OPPO's proprietary Breeno classes, resources or APK assets.

### Exact public references
- Zafiro MIT license: https://github.com/niki914/zafiro/blob/main/LICENSE
- Breeno integration guide: https://github.com/niki914/zafiro/blob/main/.agents/skills/assistant-add-support/docs/BREENO.md
- Adapter config provider: https://github.com/niki914/zafiro/blob/main/app/src/main/java/com/niki914/zafiro/mod/feat/oppo/BreenoConfigProvider.kt
- Breeno hook: https://github.com/niki914/zafiro/blob/main/app/src/main/java/com/niki914/zafiro/mod/feat/oppo/BreenoHook.kt
- Card renderer: https://github.com/niki914/zafiro/blob/main/app/src/main/java/com/niki914/zafiro/mod/feat/oppo/BreenoCardRenderer.kt
- Breeno 13.3.2 profile: https://github.com/niki914/zafiro/blob/main/app/src/main/res/raw/com_heytap_speechassist_130302_config.json
- Breeno 13.3.5 profile: https://github.com/niki914/zafiro/blob/main/app/src/main/res/raw/com_heytap_speechassist_130305_config.json
- Version registry: https://github.com/niki914/zafiro/blob/main/app/src/main/res/raw/com_heytap_speechassist_versions.json


## Expanded China + India + regional platform survey (2026-11-22)
The research scope now explicitly includes Chinese developer ecosystems (GitCode, AtomGit, Gitee, ModelScope, OpenI) and Indian/open Indic-language projects, not just GitHub. GitCode and AtomGit are being consolidated into a unified developer ecosystem according to AtomGit's own about page. Search-index coverage differs by platform; a missing search result is not evidence that a project does not exist. Search both native platform search and mirrored public sources where available.

### China: GitCode / AtomGit findings

#### exepc/ZorvAI — phone agent runtime (GitCode)
URL: https://gitcode.com/exepc/ZorvAI
- README-level architecture says Kotlin + Jetpack Compose, minSdk 26, MNN / llama.cpp local inference, Accessibility / Shizuku / root action channels, 235 built-in tools, Linux sandbox terminal, MCP, knowledge base, TTS/STT, Feishu/QQ/WeChat access and APK plugin extensions.
- This is a high-priority architecture reference for a modular phone agent and extensible tool runtime.
- Do not assume the 235 tools are all safe, available without privilege, or tested on PGEM10. Need source/license/build/test audit before adoption.

#### 2401_88872702/Aiassistant — offline Android assistant (GitCode)
URL: https://gitcode.com/2401_88872702/Aiassistant
- README describes Android 7.0+ (API 24), MIT, package com.assistant.ai, Vosk small Chinese model embedded for offline speech recognition, speech input/output, weather, alarms, calendar, notes, calculator/conversion, encyclopedia/search fallback and no GMS/API key requirement.
- Candidate for lightweight offline command and no-GMS compatibility patterns; not a Russian LLM assistant by itself.
- Package/version/hash data shown by the project are self-reported; verify artifact signature and source/build reproducibility before testing.

#### GitCode dsh-mobile-apk / DSH Android shell
URL: https://gitcode.com/gh_mirrors/ds/dsh-mobile-apk
- Search result describes a WebView UI + embedded Termux runtime snapshot, with local agent shell/browser and Accessibility-based screen control, no root.
- This is a potential embedded tool-runtime pattern, not a reason to bundle an unrestricted shell in Jarvis. If studied, isolate shell execution in a permissioned sandbox with explicit user approval, allowlists, audit logs and no access to secrets by default.
- The search result is a GitCode mirror; confirm canonical upstream and license before any code reuse.

#### Chinese GUI-agent / mobile-agent references
- KYRIE66nb/mobile-agent: https://github.com/KYRIE66nb/mobile-agent — Android screen agent using Accessibility semantic nodes plus visual coordinates; describes safety gating for external side effects and foreground/background modes. Early-stage; test-device-only warning in its README.
- DU8866-nice/awesome-phone-agents: https://github.com/DU8866-nice/awesome-phone-agents — curated catalogue of phone agents, MCP bridges, ADB frameworks and testing tools; catalog is useful for discovery, not proof that every entry is maintained or safe.
- UgOrange/gui_agent_skill: https://github.com/UgOrange/gui_agent_skill — stateful/stateless ADB GUI automation skill with local Ollama, Qwen and Zhipu/StepFun providers and unified session outputs. Useful for factory-side QA, not a phone-resident assistant runtime.

### India / Indic-language ecosystem findings

#### mukeshchandu/Personal-AI-Assistant (Naomi)
URL: https://github.com/mukeshchandu/Personal-AI-Assistant
- README describes always-on/offline-first Android voice assistant; offline keyword router for common phone actions, Vosk wake word, multi-turn follow-up, optional Groq/Gemini and on-device LLM fallback.
- Useful pattern: deterministic local action router first, LLM only for ambiguous/complex requests; wake-word and multi-turn loop are distinct from command execution.
- Need inspect source, license, Android background restrictions and device tests; do not assume true always-on works on every ROM.

#### Uktam-ai/uktam
URL: https://github.com/Uktam-ai/uktam
- Indic offline speech-to-speech pipeline on Android using Sherpa-ONNX + AI4Bharat IndicConformer ASR, Sarvam Translate via llama.cpp/JNI and native Android TTS; languages include Hindi, Kannada, Tamil, Telugu, Marathi and Malayalam.
- README states min API 34 and recommends 6 GB RAM; not directly a low-API baseline. Strong reference for mobile speech pipeline composition and quantized model selection.

#### Neyam Vaani
URL: https://neyam-opensc.github.io/neyam-vaani/
- Project page states Apache-2.0, Android 7+, nine Indian languages, full on-device ASR/LLM/TTS and target hardware as low as 2 GB RAM; status is Phase 0 of a 90-day roadmap to public beta.
- Treat as design/roadmap evidence, not a mature verified runtime. Important lessons: graceful low-memory design, language-pack separation, offline-first, accessibility and no-account UX.

#### souravanand001/ai-assistant-android
URL: https://github.com/souravanand001/ai-assistant-android
- README describes offline-first Android assistant with screen vision, live camera/voice, encrypted conversation storage, custom OpenAI-compatible endpoints and default assistant role.
- Candidate for reviewing VoiceInteractionService/assistant-role integration and multimodal UX; source-level verification remains pending.

#### Sanna — voice-first phone agent
URL: https://github.com/sannabotdev/sannabotapp
- README describes email, messages, notifications, calendar, scheduler, app-specific UI automation through Accessibility and background sub-agents. It is an agent/action workflow reference, not evidence of a safe unattended executor.
- Jarvis must add action risk tiers, preview/confirmation, undo where possible, and per-app permission scopes.

#### Other useful Indian-origin / offline-first research candidates
- vinaytz/ProjectCharlie: https://github.com/vinaytz/ProjectCharlie — Kotlin/C++ JNI, Porcupine wake word, whisper.cpp, quantized Qwen via llama.cpp, Room memory, one-heavy-model-at-a-time RAM strategy. README targets low-memory devices; verify license and dependency licenses before reuse.
- Subh24ai/yojana-sahayak-assistant: https://github.com/Subh24ai/yojana-sahayak-assistant — Whisper + Qwen2.5 QLoRA + FAISS RAG + MCP, multilingual offline voice agent; primarily a welfare-scheme assistant, useful for RAG/MCP pipeline patterns.
- Saanvirajput/Dhwani and cld2labs/VaaniSahayak: sovereign Indic model stacks using Param-1 and Indic Parler-TTS. Useful for model routing and streaming sentence-by-sentence TTS, but backend/runtime deployment differs from an Android-resident app.
- Precise-Goals/iTantra-Communication-Ecosystem: https://github.com/Precise-Goals/iTantra-Communication-Ecosystem — offline STT/TTS over Wi-Fi Direct/Bluetooth mesh; useful as an optional future local-device communication idea, not core assistant functionality.

### Additional broad Android assistant references
- naveen-anon/JarvisAI: https://github.com/naveen-anon/JarvisAI — offline command router, wake word, Arc Reactor HUD and optional Gemini fallback; inspect as a direct UI/command-flow reference.
- mathanroot/nova-ai: https://github.com/mathanroot/nova-ai — native Android offline voice assistant explicitly advertises VoiceInteractionService, screen-off wake word, streaming partial ASR, follow-up dialogue and lock-screen responses. High priority for native assistant contract study; verify claimed behavior and implementation in source.
- outsidepro-arts/OAssist: https://github.com/outsidepro-arts/OAssist — Android system-assistant gesture, share/chat modes, 55 tools, Accessibility/TalkBack and optional Shizuku/root. Review its permission model and accessibility compliance; root is not core Jarvis.
- x1watt/eva: https://github.com/x1watt/eva — fully offline Android assistant with local LLM, speech, docs, maps, music and Wikipedia; useful for offline multimodal app structure.
- MRDarshan7/OffHand: https://github.com/MRDarshan7/OffHand — on-device llama.cpp + Qwen, grammar-constrained output, explicit user-confirmed actions, durable outbox; README explicitly says physical-device validation is pending, so treat as architecture only.

## New priority ranking
P0 source audits: ZorvAI (tool runtime/plugin architecture), nova-ai (VoiceInteractionService), Naomi (offline wake/command router), Mobile Agent (screen/action safety).
P1 source audits: GitCode AIAssistant (Vosk/no-GMS baseline), Uktam (Sherpa/IndicConformer pipeline), Sanna (multi-step app automation), OAssist (system-assistant integration), ProjectCharlie (memory/RAM scheduling).
P2 design references: Neyam Vaani, Dhwani/VaaniSahayak, iTantra, Eva, OffHand, curated phone-agent catalog.

## Cross-platform search policy for OGAM
Search is not GitHub-only. For each research question, query at least: GitHub, GitLab, GitCode, AtomGit, Gitee, Codeberg and relevant model hubs (ModelScope, OpenI, Hugging Face). Search Chinese-language terms (安卓语音助手, 手机智能体, 离线语音识别, 系统助手, 无障碍自动化, 本地大模型) and English/Hindi/Indic terms. Record canonical upstream, mirror status, license, latest commit/release, build instructions, Android API/ABI, permission requirements, test evidence and compatibility. A project is not accepted merely because its README claims a feature.


## Source-level audit: mathanroot/nova-ai (native VoiceInteractionService) — 2026-11-22
Repository: https://github.com/mathanroot/nova-ai
Inspected public source files: AndroidManifest.xml, NovaVoiceInteractionService.kt, NovaVoiceInteractionSessionService.kt, NovaVoiceInteractionSession.kt, WakeWordForegroundService.kt, AndroidWakeWordEngine.kt, AssistantStateMachine.kt and README.md. Read-only source audit; no build or device run performed.

### Confirmed implementation elements
- Manifest declares a service protected by BIND_VOICE_INTERACTION with android.service.voice.VoiceInteractionService action and android.voice_interaction metadata.
- Separate VoiceInteractionSessionService and VoiceInteractionSession are declared; the session forwards to the app's MainActivity with a voice-trigger extra and then hides itself.
- Separate RecognitionService is declared.
- Wake-word listener runs in a microphone foreground service with a persistent notification, boot receiver, and partial wake lock.
- Wake engine attempts Vosk constrained grammar for "hey nova", with a secondary acoustic-energy/cadence detector.
- State machine defines Idle, WakeDetected, Listening, SpeechPaused, Processing, Speaking and FollowUpListening states.

### Important source-level caveats
1. The secondary acoustic detector does not identify phonemes or the actual phrase; it matches two speech-energy bursts of expected duration. It can false-trigger on unrelated speech and must never be considered a reliable wake-word model.
2. Wake-word parsing accepts any partial/final text containing "nova", which can produce substring false positives.
3. VoiceInteractionSession immediately starts MainActivity and hides the session. This demonstrates the service contract but is not a rich in-session assistant surface implementation.
4. StateMachine logs invalid transitions but then forcibly applies the invalid state. OGAM should reject invalid transitions or route through explicit recovery states.
5. Wake foreground service acquires a partial wake lock in onCreate and keeps it while listening. This can have material battery/thermal cost; OGAM needs measured, scoped wake locks and a power budget.
6. README claims custom ONNX/TFLite wake models, but the inspected AndroidWakeWordEngine code shown here only instantiates Vosk plus the acoustic fallback; the advertised custom model path is not proven by these files.
7. Manifest declares microphone, contacts, call/SMS, camera, exact alarm, Bluetooth and battery optimization permissions. Request only when the matching feature is enabled and explain the need.
8. README's claimed screen-off activation and lock-screen response are not verified on the Find X6 Pro/ColorOS. Android foreground-service rules and OEM power management can block background microphone start.

### OGAM decisions
- Reuse the architectural pattern: standards-based assistant service + separate session service + session state machine + wake engine abstraction.
- Do NOT copy the acoustic-energy fallback as a wake-word detector. Require a real keyword model with false-accept/false-reject measurements and noise testing.
- Make the session UI native/embedded rather than automatically launching an Activity and hiding the session.
- Enforce legal state transitions; never force invalid transitions silently.
- Add wake-listener power telemetry, user-visible mic indicator, pause/stop control, and automatic release of recorder/wake lock on every error/stop path.
- Add separate tests for assistant-role selection, VoiceInteractionService binding, summon UI, screen-off wake, lock-screen privacy and battery use.

## Source-level audit: mukeshchandu/Personal-AI-Assistant (Naomi) — 2026-11-22
Repository: https://github.com/mukeshchandu/Personal-AI-Assistant
Inspected AndroidManifest.xml, WakeService.kt, CommandRouter.kt, AssistantBrain.kt, MemoryStore.kt, VoiceInput.kt and README.md. Read-only source audit; no build or device run performed.

### Confirmed implementation patterns
- Offline-first command router handles common actions before cloud/LLM: timers, alarms, time/date, app launch, calls, messages, media, maps, notes, calendar and settings.
- AssistantBrain escalates unhandled or complex requests to cloud Groq/Gemini or a local Gemma model, with multi-turn follow-up state.
- Wake service owns AudioRecord directly, uses Vosk grammar, AcousticEchoCanceler, NoiseSuppressor, proximity sensor, watchdog and a rolling audio buffer for optional speaker verification.
- MemoryStore is a local JSON key-value fact store with add/get/update/remove and simple fact extraction from speech.
- Accessibility service is used for WhatsApp auto-send, which is a consequential action and must not happen silently in OGAM.

### Risks and adaptation decisions
1. README says VoiceInput is free/on-device capable, but implementation uses Android SpeechRecognizer with en-IN and relies on the installed recognition provider/language pack; offline behavior is provider/device dependent. Wake-word Vosk and command ASR are separate paths. OGAM must explicitly show which ASR engine handles each stage and verify airplane-mode operation.
2. Manifest requests SYSTEM_ALERT_WINDOW and USE_FULL_SCREEN_INTENT to surface UI from background/lock screen. These are sensitive, policy- and OS-constrained permissions; OGAM should prefer VoiceInteractionSession and notifications and avoid overlays/full-screen intents unless demonstrably necessary.
3. Accessibility automation that auto-taps WhatsApp Send creates external side effects. OGAM must draft, preview recipient/content and require explicit user confirmation before send.
4. Local memory is plain JSON in app internal storage, without field-level encryption, schema migration, provenance, consent controls or semantic retrieval in the inspected implementation. Useful as a prototype, insufficient for Jarvis's durable personal memory.
5. Wake service is more sophisticated than a simple audio-energy spotter, but always-on reliability, background start restrictions, watchdog recovery and battery cost remain device-specific and unverified.
6. Wake phrase and grammar are English-centric ("Naomi", en-IN). The command router is regex/keyword-driven and README documents English commands; Russian grammar, inflection and contact-name resolution require a separate locale layer.
7. The router's offline-first pattern is valuable, but external app flows and Accessibility automation are brittle; use Android intents/APIs first, semantic Accessibility second, coordinate tapping only as last resort.

### OGAM decisions
- Adopt local deterministic routing before model inference.
- Keep wake-word detection, command ASR, conversational ASR, and TTS as independently selectable engines.
- Use a typed, encrypted memory store with explicit provenance and user review rather than plain key-value JSON.
- Make action execution transactional: plan → show target/content → confirm → execute → verify result; require explicit confirmation for sending messages and other irreversible actions.
- Treat full-screen overlays, Accessibility and background microphone as optional, separately consented capabilities.
