# OGAM capability inventory and Jarvis migration matrix

Snapshot: 2026-11-22
Repository: https://github.com/sokfrut-tech/OGAM
Branch: `feature/jarvis-step-2-storage-privacy`

This is a source-tree inventory, not a claim that every capability is production-ready. Counts include nested files. A capability is marked "present" when its source implementation exists; runtime completeness still requires tests and device verification.

## Source footprint

| Area | Tracked files | Notes |
|---|---:|---|
| React Native screens | 122 | Chat, projects, models, knowledge, downloads, media, settings, tools, setup and support |
| Services | 247 | Inference, models, media generation, documents, speech, networking, persistence, sync |
| Components | 146 | Chat composer, message rendering, model controls, settings, sheets and shared UI |
| Hooks | 31 | Voice, generation, downloads, models, permissions, UI lifecycle |
| Stores | 27 | Chat, project, model, download, auth, sync, settings and new task-plan state |
| Android Kotlin source | 59 | Native bridges and services for inference, files, media, sync and device state |
| iOS source | 72 | Native counterparts and platform-specific media/sync functionality |
| Entire tracked tree | 3,358 | Includes docs, workflows, resources, native code and tests |

## OGAM capabilities to preserve

| Capability | Existing source areas | Jarvis migration / verification |
|---|---|---|
| Local LLM chat | `services/llm.ts`, `generationService`, `generationToolLoop`, `providers`, `engines` | Preserve streaming, cancellation, context compaction, tool calling, model routing and conversation state; add unified voice/text sessions |
| Model discovery and lifecycle | `modelManager`, `modelScannerService`, `modelCatalogFiles`, `modelDownloadService`, `activeModelService`, `modelResidency`, `enginePacks` | Preserve import, validation, companion files, download resume, integrity, unload/reload, RAM/thermal selection; add model profile router |
| Model evaluation and routing | `docs/jarvis/model-evaluation/manifest.v1.json`, `cases.ru.v1.json`, `scripts/model-eval/score-run.mjs` | 6 model candidates and 14 fixed Russian scenarios are registered; scorer requires pinned artifacts, license review, same runtime/device, human ratings and hard safety flags. Harness CI is green; actual model/device runs and default selection remain outstanding |
| Voice capture and transcription | Primary ChatInput: `audioRecorderService`, `whisperService`, `qwenAsrEngine`, `useWhisperTranscription`, `ChatInput/Voice`; legacy wrapper: `voiceService` / `useVoiceRecording` | New profiles now default to RU/EN using app/device locale; saved choices are preserved. Language flows to Whisper realtime/file and Qwen language prefill. Qwen RU integration test added but not yet run in Jest/device. Legacy RN Voice wrapper maps RU/EN but has no production call site found. Preserve capture mechanics; migrate private turn/session contracts with exact tests; add VAD/wake-word/TTS |
| Text-to-speech | Existing voice playback/Pro TTS seam | Make local TTS a first-class backend; interruptible output, voice profiles, Russian pronunciation and offline checks |
| Vision and image input | `modelMedia`, `llmImageInput`, image attachment flows, native screenshot bridge | Add opt-in screen/photo understanding with redaction; don't conflate screenshot sync with assistant screen awareness |
| Image generation | `imageGenerationService`, `imageGenerator`, `localDreamGenerator`, `ImageGenScreen`, Android/iOS native backends | Preserve local model selection, prompt enhancement, progress, output gallery, background work and backend routing |
| Video generation | `videoGeneration` native package, video seams, gallery | Preserve Pro seam and queued generation; no fake local backend or no-op replacement |
| Documents and knowledge | `documentService`, `pdfExtractor`, `documents`, `rag`, `KnowledgeBaseScreen` | Preserve PDF extraction, indexing, project isolation, retrieval and citations; add user-approved personal-memory sources |
| Built-in tools | `tools/registry.ts`, `tools/handlers.ts`, `generationToolLoop.ts` | Existing built-ins now adapt to Jarvis skill contracts; remaining work: complete catalogue, approvals, timeouts, cancellation and broker integration |
| MCP / third-party tools | `tools/extensions.ts`, `mcpContextBoost`, private Pro MCP extension | Preserve server discovery, OAuth, schemas, routing and typed errors; private extension path still needs a shared skill contract and approval gate |
| Email and calendar | Pro-gated `EmailCalendarExtension`; Android calendar permissions | Calendar read/write and mail compose exist in private Pro code; port contracts and preview/approval UI to standalone core before treating as Jarvis-native |
| Multi-device and LAN | `sync`, `networkDiscovery`, `MeshResidencyService`, encrypted blob channels | Preserve opt-in peer discovery, pairing, encrypted transfer and model residency; isolate prompt injection and require per-peer permissions |
| Clipboard and selected text | Android `clipboard` module, `scribeEntry`, `PROCESS_TEXT` activities | Existing selected-text and Improve actions are contextual assistant entry points; add explicit preview/return-to-caller semantics |
| Screenshot and files | Android screenshot, directory and downloads modules; iOS equivalents | Existing sync capture/file sharing is not an assistant awareness API; add a separate consented assist-context provider |
| Privacy and access control | `authStore`, `SecuritySettingsScreen`, `storagePermissionService`, storage settings | Preserve app lock, passphrase, scoped permissions and export/delete; add source-level memory consent, retention and per-skill capabilities |
| Background downloads | `backgroundDownloadService`, `downloadPersistence`, WorkManager native integration | Preserve retries, resume, notifications and integrity; don't use a download worker as a general assistant task executor |
| Projects and conversations | `projectStore`, `chatStore`, chat persistence, project RAG | Keep projects and conversation continuity; separate conversation history, indexed knowledge and durable personal memory |

## Siri-like capabilities: current implementation state

| Capability | Current state | Remaining work |
|---|---|---|
| Typed skill contracts | Implemented for explicitly classified built-in tools | Cover extension/MCP/Pro tools and native Android capabilities |
| Tool permission gate | Built-in calls require enabled tool IDs; network permission is separately checked | Native permission broker and per-skill permission persistence |
| Risk/approval model | Contract supports read-only, reversible, external communication, destructive and financial risks; high-risk approval is enforced in validator | Approval queue, UI, expiry, target/recipient summary and audit history |
| Dependency-aware plans | Plan validation, DAG order, run transitions, approval wait, outputs, fail/retry, pause/resume/cancel guards implemented | User plan editor/HUD, scheduler/executor, idempotency, native cancellation and real-world integration tests |
| Local plan persistence | Zustand store persists plans and runs locally; not sent to sync bus | Encryption review, migration/retention/export/delete and recovery after process death |
| Conversation memory | Chat history and project knowledge exist | Distinct user-approved personal memory, retrieval policy, citations and deletion controls |
| On-screen awareness | Native screenshot capability exists for sync workflows | Dedicated VoiceInteractionSession assist data/screenshot path, explicit consent, visible state and sensitive-field redaction |
| Android system assistant | Not present in current manifest/tree | VoiceInteractionService + VoiceInteractionSessionService; user selects Jarvis as default assistant |
| App actions / shortcuts | Process-text actions exist; App Shortcuts/deep-link map not found | Static/dynamic/pinned shortcuts, deep-link routing and safe opaque shortcut metadata |
| Voice turn-taking | In-app voice recorder and hands-free endpoint exist; core session state imports private `@offgrid/speech`; current event/phase behaviour is partly pinned by `recordingController.test.ts` | RU/EN initial transcription default fixed for new profiles. Recover complete transition table, including private Pro replay callers; add capture-session ownership and stale-event guards; then implement wake word, streaming ASR, local TTS, barge-in and duplex verification |
| Proactive suggestions | Not found as a dedicated user-controlled feature | Opt-in local signals, quiet hours, rate limits, source explanation and disable controls |
| Background task plans | Download workers exist | WorkManager-based durable task steps with explicit user-visible progress and cancellation; foreground service only when platform rules require it |
| Iron Man/JARVIS HUD | Existing OGAM chat-first UI and animated components | Original Jarvis home, reactor/HUD, listening/thinking/speaking/executing/approval/error states, task timeline and accessibility |

## Important blockers and release gates

1. Private workspaces `@offgrid/speech`, `@offgrid/pro`, `@offgrid/rag`, `@offgrid/models` and `@offgrid/sync` still appear in runtime imports. The standalone migration must recover contracts and replace dependencies without no-op stubs.
2. The current APK workflow still requires `PRO_SUBMODULE_PAT` and checks out private upstream workspaces. Do not ask the user for this secret as a workaround; remove this dependency only after the standalone tree and dependency audit prove it is no longer needed.
3. The new task-plan store has a Jest test file, but the standalone Node audit does not execute Jest. Do not claim this store test or TypeScript typecheck passed until a test environment that can compile the standalone tree runs it.
4. Do not call the PR ready or publish an APK until clean standalone checkout, dependency closure, Jest, typecheck, lint, Android arm64 build, install/launch and real-device smoke tests pass.

## Official Android platform references

- [VoiceInteractionService](https://developer.android.com/reference/android/service/voice/VoiceInteractionService)
- [Assistant implementation and assist context](https://developer.android.com/training/articles/assistant)
- [App Shortcuts](https://developer.android.com/develop/ui/compose/system/shortcuts)
- [WorkManager / persistent background work](https://developer.android.com/develop/background-work/background-tasks/persistent)
