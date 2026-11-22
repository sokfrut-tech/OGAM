# Siri / Apple Intelligence Clean-Room Parity Blueprint (2026-11-22)

Target: independent, offline-first, Russian-speaking **OGAM / Jarvis** on **Android 16 (OPPO Find X6 Pro, PGEM10, Snapdragon 8 Gen 2, 12 GB RAM)** with original Iron Man / Stark-inspired HUD.

- **Strict clean-room rule:** Zero Apple code, frameworks, private APIs, or visual/audio assets. Only public Apple product/developer documentation is used as architectural reference alongside our verified OPPO Breeno ColorOS 16 static findings (`docs/jarvis/BREENO_COLOROS16_REFERENCE_SUMMARY_2026-11-22.md`) and current `sokfrut-tech/OGAM` PR #1 source.
- **Public Apple references:**
  - Apple Developer — Apple Intelligence & App Intents: <https://developer.apple.com/apple-intelligence/>
  - App Intents documentation & updates: <https://developer.apple.com/documentation/appintents>, <https://developer.apple.com/documentation/updates/appintents>
  - Foundation Models & tool calling: <https://developer.apple.com/documentation/updates/foundationmodels>
  - Apple Newsroom (June & Sept 2026 Siri AI announcements): <https://www.apple.com/newsroom/2026/06/apple-unveils-next-generation-of-apple-intelligence-siri-ai-and-more/>, <https://www.apple.com/newsroom/2026/09/siri-ai-a-profoundly-more-capable-and-personal-assistant-is-here/>
  - Apple Support (regional/language note: initial Apple Intelligence Siri AI rollouts exclude EU/Russian localization and lock to Apple Silicon hardware): <https://support.apple.com/guide/iphone/get-started-with-siri-ai-iphv6zwrg8jvfgr/27/ios/27>
  - Apple HIG (Siri): <https://developer.apple.com/design/human-interface-guidelines/siri>

---

## 1. Three-Way Architectural Matrix: Siri AI vs Breeno ColorOS 16 vs OGAM / Jarvis

| # | Subsystem | Apple Siri / Apple Intelligence (Public Docs) | OPPO Breeno ColorOS 16 (26-APK Static Facts) | OGAM / Jarvis on Android 16 (Clean-Room Target & Status) |
|---|---|---|---|---|
| **1** | **System invocation & role binding** | System-owned Siri button/hotword, Type to Siri, Spotlight & Shortcuts integration, system overlay session. | Does NOT declare `VoiceInteractionService`; invoked by SystemUI via `SpeechAssistAccessProvider` & OEM `ACTIVATE_SPEECH_ASSIST`. | **BUILT (untested on device):** `VoiceInteractionService` + `VoiceInteractionSessionService` + `RoleManager.ROLE_ASSISTANT` picker + non-exported token-authorized Activity bridge into `ChatScreen`. *(Legacy Android 7–11 `RecognitionService` not built.)* |
| **2** | **Voice front-end & duplex pipeline** | Hardware voice trigger (`Hey Siri` / `Siri`), studio/hardware AEC, barge-in interruption, Type-to-Siri continuity in one thread. | `Breeno 13.4.3`: MNN runtime, dual VAD (`breeno-oai-vad`), NN-AEC (`libOplusAEC`, `libnnaec`), KWS (`libkws`), offline TTS (`libttsoff`), Opus. | **PARTIAL:** OGAM-owned `SpeechEndpointTimer` + `voiceTurnSettings` + `wavTrimPlan` migrated; `useWhisperStore` + Qwen3-ASR RU default; `JarvisPcmStreamPlayer` Kotlin primitive built. **GAP:** `voiceSession` + RU `transcriptionLanguages` still in `@offgrid/speech`; Android AEC + local RU TTS (`tiny-voca-ru` / sherpa) + KWS missing. |
| **3** | **Personal Context & semantic index** | On-device semantic index across Mail, Messages, Photos, Calendar, Files; model reads retrieved snippets with entity grounding, never dumps raw DBs blindly. | Clean split: capture UI (`com.oplus.aimemory`) queries separate encrypted store (`com.oplus.dmp`: `libsqlcipher.so`, `libvector_utils.so`, Office/PDF chunking configs, Persona DB). | **PARTIAL / BLOCKED BY SHARED:** Chat docs & KB use private `@offgrid/rag/documents` (`estimateTokens`, `DocumentIngestService`, `DocumentTurnService`) + OP-SQLite FTS5. **TARGET:** Migrate MIT `src/services/rag/*` (`6ba7d5cb`) + encrypted SQLCipher/SQLite personal-context connectors (calendar, notes, local files, explicit user memories) with per-source consent, retention, and delete/export. |
| **4** | **On-Screen Awareness** | System inspects visible app UI structure/app entities via `AppEntity` / visual view context when user refers to "this/that/here". | Dual AccessibilityServices in `ColorDirect` + `AnalogSkillService` + `InvokeEntranceService` + OCR Scanner (`libaiboost.so` + TFLite). | **SAFE PRIVACY FOUNDATION:** `AndroidManifest` + `JarvisVoiceInteractionSessionService` explicitly disable silent `assistStructure` & `assistContent` screenshots by default. `nativeClipboard.ts` (`PROCESS_TEXT`) & `nativeScreenshot.ts` exist. **TARGET:** Opt-in, visible, redacted `ScreenContextSnapshot` (never silent always-on scraping). |
| **5** | **Typed App Actions (`AppIntents`)** | `@AppEntity`, `@AppParameter`, `@ParameterSummary`, `ProgressReportingIntent`, `UndoableIntent`, entity queries so model operates on typed contracts rather than UI clicking. | `com.coloros.shortcuts` rule/scene chains + `OmniMind` providers + internal `AnalogSkillService` UI clicker (`BIND_ACCESSIBILITY_SERVICE`). | **IN PROGRESS:** `src/services/tools/skillContract.ts` validates JSON schemas, tool enablement, and risk classes; core tool switch still covers video/web/calc/time/device/KB/URL. **TARGET:** Unified typed Jarvis Skill Catalogue (`SkillContract v1` with Android permissions, idempotency, progress, cancel, undo/compensation) replacing hardcoded switch. |
| **6** | **Multi-step planning & execution** | Apple Shortcuts + Siri orchestration: chain typed Intents across apps, pass entity outputs, pause for missing params, show live progress. | `Shortcuts 17.2.4` (`shortcut.db` + `SceneService` AIDL + WorkManager) + `Pantanal UMS` ORT/TFLite/SMU rules. | **PARTIAL:** `src/services/planner/taskPlan.ts`, `taskPlanRun.ts`, and Zustand persistence validate DAG dependencies/cycles and approval transitions (tested in Node CI). **GAP:** No end-to-end deterministic plan executor wired to `SkillContract v1` yet; no user-facing plan editor UI yet. |
| **7** | **Local model profiles & constrained decoding** | On-device ~3B foundation model + adapter LoRAs for summarization/tone/tools; Foundation Models `@Generable` structured guided generation. | `com.oplus.aiunit` shared multi-process daemon (`201` worker slots, tokenizers, DMA-BUFzero-copy), plus on-device ONNX/MNN/TFLite in `UMS` & `Statistics`. | **SOLID ENGINE BASE + EVAL HARNESS:** `llama.rn` (`@ogai/llama.rn` b12560) + LiteRT-LM + GBNF tool/reasoning grammars + RU eval suite (6 candidates: Qwen3.5-4B, Uncensored-v2, Huihui abliterated, Aurum 4B, Gemma 4 E2B/E4B). **GAP:** Pin weights/SHA-256, benchmark on Find X6 Pro, add model-routing profiles (fast chat / deep planner / vision) preserving one Jarvis identity. |
| **8** | **Cloud boundary & privacy** | Default on-device; overflows ONLY to Private Cloud Compute (verifiable stateless Apple Silicon containers, zero retention) when explicitly needed. | Deep HeyTap/Baidu/Allawn cloud coupling + third-party Pangle ads (`SpeechAssist` & `com.opos.ads`) + local fallbacks. | **STRICT OFFLINE-FIRST:** Zero PostHog/telemetry, zero mandatory cloud, zero ad SDKs. Optional remote OpenAI-compatible LAN/PC server only with explicit user configuration, visible endpoint disclosure, and keychain-stored credentials. |
| **9** | **Communication safety & Approval Broker** | Distinct UI confirmation card before external side effects (sending Mail/Messages, calendar invites, payments); model cannot silently dispatch. | Mixed: newer `Breeno 13.4.3` added `AppAuthorizationActivity` + Alipay flow, alongside silent `Metis`/`SceneService` triggers. | **ARCHITECTURAL RULE (PARTIALLY WIRED):** Model stays outside authority boundary; `SkillContract` classifies `external_communication`, `destructive`, and `financial` as mandatory approval. **TARGET:** Draft-first Email/Message/Calendar Android flows + blocking fail-closed Approval Preview modal (model claims of success rejected unless executor confirms). |
| **10** | **Multi-device continuity** | Handoff + iCloud/Continuity across iPhone/iPad/Mac (`dedicated Siri history` across devices). | `com.oplus.linker` (`Подключение к устройствам`) + HeyTap `CloudKit` (`Aimemory` `cloud_kit_*.db`). | **IN PROGRESS (HALF-PRIVATE):** `Personal Mesh` (`@offgrid/sync`: encrypted NaCl/HKDF over TCP + mDNS discovery) is already integrated in PR #1, though half of `@offgrid/sync` lives in `../shared`. **TARGET:** Migrate pure chat helpers out of `@offgrid/sync`, then port/preserve encrypted LAN device mesh behind security audit. |
| **11** | **Local proactivity & triggers** | Siri Suggestions & App Shortcuts surfaced contextually from local Mail/Calendar/focus signals without cloud profiling. | `com.oplus.pantanal.ums` (`NotificationListenerService` + local ORT/TFLite/SMU/regex parsing of SMS/travel/bills) + `Fluid Cloud` / `Seedling`. | **PLANNED (OPT-IN ONLY):** Only local, user-enabled triggers (e.g., quiet hours, rate-limited reminders, explicit notification/calendar rules) with inspectable "Why did Jarvis suggest this?" explanation. Never background adware or silent notification scraping. |
| **12** | **Visual HUD & state machine** | Edge-glow Siri aura + compact snippet/confirmation pills layered cleanly over current screen, readable one-handed. | `FloatSpeechActivity` / `PantanalRouterActivity` transparent CUI overlay + `FluidCardNotificationActivity`. | **BACKLOG (CORE DESIGN TOKENS RESTORED):** `@offgrid/design` tokens (`COLORS_*`, `FONTS`, `LIVING_FIELD`, `ALIVE`) are now OGAM-owned in `src/theme/designTokens.ts`. **TARGET:** Original Stark/Jarvis animated core HUD (`idle`, `listening`, `thinking`, `speaking`, `executing`, `awaiting_approval`, `error`) with live waveform, cancel, timeline, and approval sheet — after core stability gates pass. |

---

## 2. TypeScript Interface Targets for Next Siri-Parity Slices

```ts
/** Consent-gated personal context entry stored strictly on-device (AES/SQLCipher target). */
export interface PersonalContextRecord {
  id: string;
  source: 'notes' | 'calendar' | 'documents' | 'explicit_memory' | 'screen_snapshot';
  sourceUriOrId: string;
  createdAtMs: number;
  expiresAtMs: number | null; // null = durable until user deletes; ephemeral screen snapshots expire quickly
  title: string;
  excerpt: string;
  redactedFields: string[];   // e.g. ['password_input', 'otp_code']
}

/** Explicit opt-in snapshot produced by AssistStructure or user-triggered screen capture. */
export interface ScreenContextSnapshot {
  capturedAtMs: number;
  foregroundPackage: string;
  captureMethod: 'assist_structure' | 'explicit_share_intent' | 'user_screenshot';
  persistPolicy: 'turn_only' | 'user_saved_memory';
  redactedTextBlocks: string[];
}

/** Deterministic fail-closed execution gate separating LLM proposals from OS side effects. */
export interface ApprovalDecision {
  proposalId: string;
  skillId: string;
  riskClass: 'read_only' | 'reversible_write' | 'external_communication' | 'destructive' | 'financial';
  previewSummaryRu: string;
  requiresUserConfirmation: boolean; // Always true for external_communication / destructive / financial
  decision: 'approved' | 'rejected' | 'expired';
  decidedAtMs: number;
}

export type JarvisHudState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'executing'
  | 'awaiting_approval'
  | 'error';
```

---

## 3. Ordered Implementation Path Beyond Current Voice/Design Migration

1. **Finish Self-Contained Core (`../shared` & `pro/` independence):** Complete `@offgrid/speech` (`voiceSession` + RU `transcriptionLanguages`), `@offgrid/rag/documents` (using MIT `6ba7d5cb`), `@offgrid/sync` Half A pure parsers, and `@offgrid/models` slices `M2`–`M7` so OGAM builds & runs Jest without external workspaces.
2. **Deterministic Skill + Plan Executor + Approval Broker:** Connect `taskPlan.ts` / `taskPlanRun.ts` + `skillContract.ts` to real Android executors (Calendar read/draft create, Email/SMS draft-only `ACTION_SENDTO`, Timer/Alarm, Knowledge search) behind a non-bypassable Approval Preview UI.
3. **Encrypted Local Personal Context Store:** Implement consent-per-source SQLite/SQLCipher + vector/FTS index inspired cleanly by `com.oplus.dmp`'s DB/index separation, starting with `explicit_memory`, local imported docs, and optional Calendar read.
4. **Full Duplex Russian Voice Loop:** Pin/benchmark `tiny-voca-ru` (or Apache sherpa-onnx RU voice), wire synthesized Float32 PCM directly to `JarvisPcmStreamPlayer`, solve Android AEC / speaker drain for safe hands-free barge-in, and verify end-to-end on OPPO Find X6 Pro via `VoiceInteractionService`.
5. **Original Stark/Jarvis Interactive HUD:** Build the layered HUD (`JarvisHudState`) over OGAM's restored `designTokens` palette (`COLORS_DARK` / `COLORS_LIGHT`), keeping one-handed reachability, explicit cancel controls, and truthful progress reporting.
