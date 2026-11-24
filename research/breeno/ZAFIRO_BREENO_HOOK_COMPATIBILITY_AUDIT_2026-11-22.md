# OGAM / Jarvis — Zafiro Breeno takeover source audit
**Date:** 2026-11-22  
**Status:** public-source audit; no Zafiro code copied, no Breeno APK inspected, no device test  
**Target under investigation:** OPPO Find X6 Pro / PGEM10, ColorOS 16.0.5; user-reported Breeno 13.3.2

## 1. Why this source matters

A newly discovered public Android project, [niki914/zafiro](https://github.com/niki914/zafiro), implements a real Breeno takeover adapter using Kotlin, LSPosed and Xposed hooks. This is much closer to OGAM/Jarvis's ColorOS integration problem than a generic assistant app.

Repository facts at the inspected snapshot:
- Repository: `niki914/zafiro`
- Inspected main commit: `bd3767ef1849f12d7aa7e302d7f10342871a52d8`
- Latest release at audit time: `v21-2.1.0`, published 2026-11-22 14:57 UTC
- Repository license: MIT (LICENSE inspected)
- Latest release assets listed by GitHub: `zafiro-release.apk` (31,198,712 bytes) and `mapping.zip` (7,750,689 bytes). No asset downloaded or inspected in this audit.
- README explicitly says system voice assistant takeover uses LSPosed and requires root. A separate built-in app UI remains available without takeover.
- README describes Zafiro as a BYOK Android agent with Phone-Use, Skills, MCP, Shell/Python and remote model providers. This is not evidence of an offline-first Russian Jarvis engine.

## 2. Direct version match: Breeno versionCode 130302

Zafiro tracks raw host configs:
- `app/src/main/res/raw/com_heytap_speechassist_130302_config.json`
- `app/src/main/res/raw/com_heytap_speechassist_130305_config.json`
- version list `com_heytap_speechassist_versions.json` contains `[120803, 120906, 120909, 130302, 130305]`.

The 130302 configuration explicitly declares:
- package: `com.heytap.speechassist`
- `version_code: 130302`
- `is_beta: false`.

The numeric version code 130302 matches the user's reported Breeno 13.3.2 naming convention and is a strong candidate for the exact target. However, the actual installed APK's package versionCode and variant have not been read from the user's PGEM10 in this audit. Therefore compatibility is a high-value lead, not a confirmed device match.

### 130302 vs 130305 config diff

A structural JSON comparison of the two checked-in configs found exactly two differing values:
1. `actions.reset_conversation_signal.target.method_name`: `p` (130302) → `q` (130305).
2. `actions.render_card.business.data_center_update_message_method`: `f1` (130302) → `g1` (130305).

All other JSON values compared equal in these two files. This is a useful narrow change map, but it does not prove that all vendor APK builds with those version codes have identical internals.

## 3. Breeno hook map in Zafiro 2.1.0

| Purpose | Host target in 130302 config | Zafiro behavior |
|---|---|---|
| Capture user query | `AIChatDataCenter.s(AIChatViewBean)`, before | Reads chatType, roomId and content; only handles query chatType |
| Distinguish host response | Same `AIChatDataCenter.s(AIChatViewBean)`, before | Checks answer chatType and self-injected local-data marker |
| Detect conversation reset | `AIChatRoomIdManager.p(String,String)`, after | Clears assistant turn/session |
| Detect floating-window lifecycle | `NewCuiFloatWindowRootView.onDetachedFromWindow()`; `SpeechAssistMainActivity.onResume()` | Detects session reset with a grace window |
| Filter native response directives | `com.heytap.speech.engine.connect.core.manager.i.C(String,String)`, before | Parses directive JSON and filters selected native directives only in injected-LLM mode |
| Suppress cleanup operation | `ke.e.c(Directive,List,List,String,ConversationInfo)`, after | Replaces a specific CleanOperation with DoNothingOperation in injected-LLM mode |
| Insert/update assistant card | `AIChatViewBean`; insert `AIChatDataCenter.s`; update `f1` | Builds native Breeno answer card and updates it incrementally |

The 130305 config changes only the reset method to `q` and update method to `g1`.

### Architecture worth learning from

- `BreenoHook` is a thin orchestration layer; host reflection is isolated in `BreenoCardRenderer` and small subhooks.
- Configuration is data-driven: package version → raw JSON → class/method/argument metadata. The host adapter is not a pile of hardcoded reflection calls.
- Input capture deduplicates identical room/query pairs.
- A turn state explicitly distinguishes `InjectedLLM` from `NativeTakeover`. Native Breeno behavior is passed through when the user-selected routing decision says to keep native takeover.
- The renderer maintains a per-turn session, inserts one card and then updates it. It populates native fields for reasoning/thinking, final/first-slice flags, local-data markers and feedback controls.
- IPC sends semantic frames (Thinking, Tools, Content), not Breeno-specific reflection objects. This is a good boundary for OGAM: model/runtime remains independent of ColorOS host details.

## 4. Important behavioral and safety caveats

Zafiro's directive filter suppresses selected native namespaces/actions in injected mode, including recommendations, native speech synthesis, some system/app/phone/storage actions, native assistant cards, feedback and an `ExpectSpeech` directive. Its cleanup hook also replaces a matched cleanup operation.

These are not safe defaults to copy wholesale into Jarvis. For OGAM:
- Keep native Breeno behavior intact unless the user explicitly selected Jarvis takeover for that turn.
- Never suppress an Android/system action merely because an LLM requested it. Map actions to typed tools, check permissions, classify risk, and ask for confirmation for consequential operations.
- Keep voice output single-owner per turn to prevent overlapping TTS, but preserve an explicit native fallback path.
- Treat Accessibility/Phone-Use and Xposed as separate capabilities with visible permission state and revocation.
- Do not expose unrestricted shell, root, or Accessibility control to the model. Deterministic policy enforcement must sit outside the LLM.
- Do not log transcripts, contact names, raw audio or personal hotwords.

## 5. Licensing and reuse decision

Zafiro's repository declares MIT. That permits reuse subject to the MIT notice/attribution requirements, but does not grant rights to OPPO/Breeno proprietary code or assets.

For OGAM, prefer:
1. clean-room architecture adaptation (versioned host adapter, typed semantic IPC, turn routing, lifecycle-aware card renderer);
2. if a code fragment is later copied, preserve its MIT copyright and license notice and record exact file/commit provenance;
3. never copy proprietary Breeno APK code, resources, signatures or user data into OGAM.

## 6. Source files inspected

- `.agents/skills/assistant-add-support/docs/BREENO.md` — host classes and adaptation checklist.
- `.agents/skills/assistant-add-support/SKILL.md` — reverse-engineering tool gate and version workflow.
- `app/src/main/res/raw/com_heytap_speechassist_130302_config.json`
- `app/src/main/res/raw/com_heytap_speechassist_130305_config.json`
- `app/src/main/res/raw/com_heytap_speechassist_versions.json`
- `app/src/main/java/a0/a0/a0/a0/a0/a0/Entrance.kt`
- `app/src/main/java/com/niki914/zafiro/mod/feat/oppo/BreenoHook.kt`
- `app/src/main/java/com/niki914/zafiro/mod/feat/oppo/BreenoConfigProvider.kt`
- `app/src/main/java/com/niki914/zafiro/mod/feat/oppo/BreenoCardRenderer.kt`
- `app/src/main/java/com/niki914/zafiro/mod/feat/oppo/BreenoFeedbackAssembler.kt`
- `app/src/main/java/com/niki914/zafiro/mod/feat/oppo/subhooks/CaptureInputHook.kt`
- `app/src/main/java/com/niki914/zafiro/mod/feat/oppo/subhooks/BlockNativeCardHook.kt`
- `app/src/main/java/com/niki914/zafiro/mod/feat/oppo/subhooks/FilterNativeDirectivesHook.kt`
- `app/src/main/java/com/niki914/zafiro/mod/feat/oppo/subhooks/ResetConversationSignalHook.kt`
- `app/src/main/java/com/niki914/zafiro/mod/feat/oppo/subhooks/SuppressCleanupHook.kt`
- `app/src/main/java/com/niki914/zafiro/mod/feat/AbstractAssistantHook.kt`
- `app/src/main/java/com/niki914/zafiro/mod/feat/SubHook.kt`
- `app/src/main/AndroidManifest.xml`
- `AGENTS.md` and `README.md`.

### Key upstream links (pinned to inspected commit where possible)

- Repository: https://github.com/niki914/zafiro
- Commit: https://github.com/niki914/zafiro/commit/bd3767ef1849f12d7aa7e302d7f10342871a52d8
- Release 2.1.0: https://github.com/niki914/zafiro/releases/tag/v21-2.1.0
- MIT license: https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/LICENSE
- Breeno support guide: https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/.agents/skills/assistant-add-support/docs/BREENO.md
- 130302 config: https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/app/src/main/res/raw/com_heytap_speechassist_130302_config.json
- 130305 config: https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/app/src/main/res/raw/com_heytap_speechassist_130305_config.json
- Hook entry: https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/app/src/main/java/a0/a0/a0/a0/a0/a0/Entrance.kt
- Breeno adapter: https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/app/src/main/java/com/niki914/zafiro/mod/feat/oppo/BreenoHook.kt
- Card renderer: https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/app/src/main/java/com/niki914/zafiro/mod/feat/oppo/BreenoCardRenderer.kt

## 7. What this changes for OGAM

Recommended next sequence:
1. Treat `130302` as the primary compatibility candidate, but verify the installed PGEM10 package versionCode before applying any hook config.
2. Build an OGAM host-adapter design note: `BreenoHostAdapter` → versioned `BreenoHookProfile` → typed input/session/response events → renderer port. Do not copy Zafiro's broad directive suppression.
3. Audit OGAM's existing Android assistant entry point and permission model; decide whether the product has an optional LSPosed/root integration tier and a no-root fallback tier.
4. Keep root/Xposed takeover optional. It is not a prerequisite for the offline Jarvis core.
5. For exact APK class/method verification, follow the Zafiro skill's explicit REA gate: its instructions say use REA first and, if unavailable, ask the user to deploy it; do not silently install/configure REA or bypass that project-specific gate.
6. Only after source profile and exact installed version are verified should a minimal compatibility prototype be written and tested.

## 8. Evidence limitations

- This is a source-code/config audit, not a reverse engineering report of the user's installed APK.
- No Breeno APK was downloaded, unpacked, decompiled or inspected.
- No PGEM10 shell/ADB access or installed package versionCode was read.
- No Xposed module was installed or activated.
- No Zafiro APK was downloaded or installed.
- No Jarvis source code was changed and no build/device test was run.
- No dedicated Breeno hook test file was found in the inspected repository tree; the source search did not establish runtime compatibility by tests.


## 9. Important cross-check: OGAM already has the standard Android assistant role

A separate source audit of OGAM PR #1 branch `feature/jarvis-step-2-storage-privacy`, inspected HEAD `67159e2f821b14616eebcaf0e6da997633cd7aa4`, found that OGAM already implements a no-root Android system-assistant entry point:

- `JarvisVoiceInteractionService` is registered with `BIND_VOICE_INTERACTION`.
- `JarvisVoiceInteractionSessionService` runs in a separate `:jarvis_voice` process.
- `JarvisVoiceInteractionSession` hands off the invocation to the normal app Chat screen via a private, non-exported bridge Activity and one-shot launch token.
- `JarvisAssistantRoleModule` asks Android's `RoleManager` to show the system-owned `ROLE_ASSISTANT` confirmation UI. It does not silently change the role.
- Status is considered ready only when the role is held AND the VoiceInteractionService is actually active; a successful activity result alone is not trusted.
- Android 12 / API 31+ enables the service. The base resource disables it below API 31 because a local legacy RecognitionService path is not implemented.
- The service disables both `SHOW_WITH_ASSIST` and `SHOW_WITH_SCREENSHOT`; the session explicitly avoids foreground-app text, hierarchy, screenshots and audio context at this stage. It relies on the app's normal visible microphone permission/recording path.
- Existing tests include one-use/TTL/forged-token/URI-normalization tests and role-state tests. The source-contract suite also asserts the private bridge, BIND permission, Android 12 gate, no assist/screenshot collection, explicit RoleManager flow and reuse of the shared recorder.

This is distinct from Zafiro's Breeno takeover:
- **Android RoleManager path (already in OGAM):** asks the OS to make Jarvis the default assistant; no root or LSPosed is required by this integration design. ColorOS/OEM may still refuse or fail to activate it, so verify actual `ready` state on the phone.
- **Breeno-internal takeover (Zafiro reference):** injects hooks into `com.heytap.speechassist` and replaces/filters Breeno's internal conversation pipeline; Zafiro README explicitly requires root + LSPosed.

### Consequence for Jarvis architecture

Do not replace OGAM's existing RoleManager implementation with Xposed. Keep the standard system assistant as the primary no-root integration tier. Treat a Breeno-internal adapter as an optional, separately permissioned/advanced compatibility tier only if the standard assistant role cannot deliver the desired ColorOS invocation behavior and the user explicitly chooses the root/LSPosed route.

The existing session currently hands off to the normal Chat screen; it is not yet proof of a complete always-on wake-word, lock-screen, foreground-app context or Siri-like background conversation implementation. Those are separate product capabilities and must be benchmarked/tested independently.

### OGAM source links pinned to inspected PR #1 HEAD

- Android manifest: https://github.com/sokfrut-tech/OGAM/blob/67159e2f821b14616eebcaf0e6da997633cd7aa4/android/app/src/main/AndroidManifest.xml
- VoiceInteractionService: https://github.com/sokfrut-tech/OGAM/blob/67159e2f821b14616eebcaf0e6da997633cd7aa4/android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionService.kt
- Voice session: https://github.com/sokfrut-tech/OGAM/blob/67159e2f821b14616eebcaf0e6da997633cd7aa4/android/app/src/main/java/ai/offgridmobile/voice/JarvisVoiceInteractionSession.kt
- RoleManager bridge: https://github.com/sokfrut-tech/OGAM/blob/67159e2f821b14616eebcaf0e6da997633cd7aa4/android/app/src/main/java/ai/offgridmobile/voice/JarvisAssistantRoleModule.kt
- Role-state tests: https://github.com/sokfrut-tech/OGAM/blob/67159e2f821b14616eebcaf0e6da997633cd7aa4/android/app/src/test/java/ai/offgridmobile/voice/JarvisAssistantRoleSnapshotTest.kt
- Source-contract tests: https://github.com/sokfrut-tech/OGAM/blob/67159e2f821b14616eebcaf0e6da997633cd7aa4/scripts/__tests__/android-assistant-contract.node.test.mjs


## 10. Deeper Zafiro 2.1.0 hook and test-harness audit

Inspected the actual hook implementation at Zafiro commit `bd3767ef1849f12d7aa7e302d7f10342871a52d8`, not only its README/config. Also inspected its Breeno adaptation guide at `.agents/skills/assistant-add-support/docs/BREENO.md`.

### Confirmed implementation details

- `BreenoHook` is an orchestration layer: it initializes the renderer and installs separate session, response and input subhooks. The concrete host reflection is mostly isolated in `BreenoConfigProvider`, the subhooks and `BreenoCardRenderer`.
- `CaptureInputHook` runs before the configured DataCenter method, extracts the configured bean argument, calls configured getters for chat type / room ID / content, accepts only the configured query chat type and suppresses only an immediately repeated identical (roomId, query) pair. This is a useful boundary, but not a durable request ID or a complete replay/deduplication protocol.
- `FilterNativeDirectivesHook` is active only for `InjectedLLM`; `NativeTakeover` and missing turn state pass native directives through. It parses the directives JSON, preserves unknown/unrecognized entries, and removes a hard-coded set of namespaces/actions. If all directives are removed it sets the hooked method result to null; otherwise it replaces the JSON argument.
- The suppression list is broad and includes system/app, SMS, phone-call, storage and other action families. This is a technical implementation detail, not evidence that the replacement agent has safe equivalents or user permission for those operations. OGAM must not reproduce this broad interception policy.
- `BlockNativeCardHook` blocks only non-self-injected answer cards while the active turn is `InjectedLLM`; no active turn or `NativeTakeover` passes through. The local-data marker is the self-injection escape hatch.
- `SuppressCleanupHook` replaces a configured `CleanOperation` with `DoNothingOperation` only during `InjectedLLM`; otherwise it passes through.
- `ResetConversationSignalHook` forwards the configured host reset event to session reset. The high-level hook also watches floating-window detach / main-activity resume lifecycle signals.
- `BreenoCardRenderer` resolves the host bean and DataCenter methods reflectively, creates one render bean per turn, inserts it once and updates it on later frames. It fills native reasoning/thinking fields, tool status text, content, first/final flags and feedback metadata. This demonstrates a host-specific presentation adapter, not a general Android assistant API.

### Reverse-engineering gate clarified

The Zafiro adaptation guide says its config + implementation are the single source of truth, and instructs maintainers to start from the closest supported config, then verify the host's core classes and obfuscated method names in the new APK. The repository's `assistant-add-support` skill explicitly requires its REA workflow first; if REA is unavailable, the maintainer must ask the user to deploy it. This is a project-specific gate. OGAM must not silently install/configure REA or bypass it.

### Test evidence: important negative finding

The recursive source tree at the inspected Zafiro commit contains extensive unit tests for agent runtime, permissions, IPC, UI and other modules. However, the inspected tree contains **no dedicated Breeno hook/config/renderer test suite** (no test paths matching the Breeno implementation or its subhooks). Therefore:
- Generic Zafiro unit-test volume does not validate the Breeno adapter.
- The 130302 config match and source implementation remain static evidence only.
- We have no test evidence that these reflection targets resolve or behave correctly on the user's installed Breeno build.
- Do not describe Zafiro's Breeno takeover as device-verified or production-compatible with PGEM10.

### OGAM design decision refined

Keep the existing no-root `RoleManager` + `VoiceInteractionService` implementation as the primary integration. If a separate Breeno adapter is ever justified, design it as a narrow host adapter with these OGAM-owned contracts:

1. Read-only capture of a user-submitted query and stable host session identifier.
2. Explicit ownership state per turn; default to native passthrough on unknown state, hook failure, timeout or unsupported host version.
3. No blanket directive suppression. Map only explicitly supported intents to OGAM typed tools; require tool-level permissions, risk tiers and confirmation for consequential actions.
4. Preserve native Breeno behavior for unsupported actions and provide a safe fallback if Jarvis is unavailable.
5. Treat card rendering as optional presentation. Failure to render a native card must not lose the assistant response or execute an action twice.
6. Add contract tests for config parsing, hook target resolution against controlled fixtures, turn ownership, duplicate/replay handling, native passthrough, self-injected markers, and failure recovery before any real-device trial.
7. Keep the adapter behind a separately documented root/LSPosed opt-in; do not make root a prerequisite for Jarvis core.

### Exact source references

- [BreenoHook.kt](https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/app/src/main/java/com/niki914/zafiro/mod/feat/oppo/BreenoHook.kt)
- [BreenoConfigProvider.kt](https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/app/src/main/java/com/niki914/zafiro/mod/feat/oppo/BreenoConfigProvider.kt)
- [CaptureInputHook.kt](https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/app/src/main/java/com/niki914/zafiro/mod/feat/oppo/subhooks/CaptureInputHook.kt)
- [FilterNativeDirectivesHook.kt](https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/app/src/main/java/com/niki914/zafiro/mod/feat/oppo/subhooks/FilterNativeDirectivesHook.kt)
- [BlockNativeCardHook.kt](https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/app/src/main/java/com/niki914/zafiro/mod/feat/oppo/subhooks/BlockNativeCardHook.kt)
- [SuppressCleanupHook.kt](https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/app/src/main/java/com/niki914/zafiro/mod/feat/oppo/subhooks/SuppressCleanupHook.kt)
- [BreenoCardRenderer.kt](https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/app/src/main/java/com/niki914/zafiro/mod/feat/oppo/BreenoCardRenderer.kt)
- [Breeno adaptation guide](https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/.agents/skills/assistant-add-support/docs/BREENO.md)
- [Assistant support skill / REA gate](https://github.com/niki914/zafiro/blob/bd3767ef1849f12d7aa7e302d7f10342871a52d8/.agents/skills/assistant-add-support/SKILL.md)


## 11. Deeper Android VoiceInteraction lifecycle and metadata review

Inspected the PR #1 source files at commit `67159e2f821b14616eebcaf0e6da997633cd7aa4`:
- `JarvisVoiceInteractionService.kt`
- `JarvisVoiceInteractionSessionService.kt`
- `JarvisVoiceInteractionSession.kt`
- `JarvisAssistantBridgeActivity.kt`
- `JarvisAssistantLaunchGuard.kt`
- `JarvisAssistantRoleModule.kt`
- `JarvisAssistantRoleSnapshot.kt`
- `android/app/src/main/res/xml/jarvis_voice_interaction.xml`
- `scripts/__tests__/android-assistant-contract.node.test.mjs`
- `JarvisAssistantRoleSnapshotTest.kt`

### Confirmed lifecycle

1. The system-selected `JarvisVoiceInteractionService` is intentionally lightweight. Its current `onReady()` only disables assist-data and screenshot context.
2. A separate `:jarvis_voice` process hosts `JarvisVoiceInteractionSessionService`; each new session constructs a short-lived `JarvisVoiceInteractionSession`.
3. On invocation, the session starts the private bridge Activity via `startAssistantActivity()` on Android O+ and then immediately calls `finish()`.
4. The bridge Activity mints a random one-use token with a 10-second TTL and starts MainActivity using the protected assistant URI.
5. MainActivity consumes the token through `JarvisAssistantLaunchGuard`; URL normalization checks are deliberately aligned with the React Navigation route parser to prevent alternate URI spellings bypassing the native gate.
6. ChatScreen then requests the existing shared recording controller. Recording is allowed only if a compatible transcription backend is available; otherwise the user is directed to speech-model setup.

### Important capability boundary

Android's official VoiceInteractionService reference says the selected service is kept running by the system to support features including background hotword listening. OGAM's current service does not implement a hotword detector, keyphrase enrollment, DSP/hardware trigger handling, or a persistent local wake-word state machine. It only disables assist/screenshot context in `onReady()` and hands an explicit system invocation to the app.

Therefore the code proves a system-assistant invocation/handoff path, **not** an always-listening wake-word assistant. It also does not prove that voice capture starts on the lock screen or continues without showing the app's visible Chat UI. Those require separate design, Android/OEM policy review, explicit user consent and real-device tests.

### Metadata compatibility issue to track

The current `jarvis_voice_interaction.xml` declares:

```xml
android:recognitionService="ai.offgridmobile/ai.offgridmobile.voice.JarvisVoiceInteractionService"
```

Android's platform `VoiceInteractionService` metadata documentation states:
- On Android 11 and earlier, `recognitionService` must identify a valid `RecognitionService`.
- From Android 12 onward, this attribute does nothing, but the XML field is still required to be set; an unspecified value can cause the system to reset the selected assistant.
- OGAM currently disables this VoiceInteractionService below API 31 via `values/bools.xml`, so the present configuration is not evidence of a current Android 12+ failure.
- However, the configured component is a `VoiceInteractionService`, not a `RecognitionService`. If OGAM ever enables this integration on Android 11 or earlier, it must add/register a real compatible `RecognitionService` and point the metadata to it before enabling the component. Do not merely lower the API gate.

This is a **forward-compatibility blocker**, not a claim that current Android 16 devices fail because of this field.

### Lock-screen affordance metadata

The platform metadata schema includes `supportsLaunchVoiceAssistFromKeyguard`, distinct from `supportsAssist`. OGAM currently sets `supportsAssist=true`, but does not declare `supportsLaunchVoiceAssistFromKeyguard` or override `onLaunchVoiceAssistFromKeyguard()`. This is not proof of a bug: the current product path deliberately avoids requesting screen context and does not yet promise lock-screen operation. If lock-screen invocation is added, evaluate this capability explicitly and test it on ColorOS; do not infer it from holding `ROLE_ASSISTANT`.

### Test coverage confirmed

- The JS/Node source-contract suite verifies manifest protection, non-exported bridge, one-shot token path, API 31 enablement, disabled assist/screenshot context, RoleManager flow and shared recorder preconditions.
- `JarvisAssistantRoleSnapshotTest` verifies the readiness conjunction: supported API + available role + held role + active service. It also covers false-ready combinations.
- No dedicated `JarvisVoiceInteractionSessionTest.kt` was found at the inspected path. The session/handoff is therefore covered mainly by source-contract assertions and the launch-guard unit tests, not by a full Android framework lifecycle instrumentation test.
- These are repository test sources inspected at a pinned commit. This audit did not execute Gradle/Node tests and did not validate Android framework behavior on ColorOS.

### ColorOS evidence and limits

A public issue for the third-party MiCTS project documents an OPPO Pad Mini running ColorOS V16.1 / Android 16 where the selected Google VoiceInteractionService is active, and discusses invocation latency/launch behavior. This is useful evidence that the Android voice-assistant pathway is present on at least one ColorOS 16 device. It is **not** evidence that OGAM's implementation works on the OPPO Find X6 Pro / PGEM10, nor that the same behavior applies across regions/firmware variants.

### Recommended next implementation gates

1. Preserve the API 31+ gate until a genuine legacy `RecognitionService` exists and is tested.
2. Add a static metadata contract test that checks the pre-31 recognition service is real before any future gate change.
3. Treat wake word as its own subsystem: local VAD + wake-word model/runtime + microphone/foreground-service policy + battery/thermal measurement + explicit opt-in + lock-screen UX.
4. Keep system invocation, wake-word detection, transcription, conversation, and device-action execution as independently observable states; never report "always listening" just because `ROLE_ASSISTANT` is held.
5. Before claiming ColorOS compatibility, run a signed debug/release build on PGEM10 and capture: assistant role availability/held/active status, actual invocation path, lock/unlock behavior, microphone start, cancellation, process recreation, battery/thermal impact and native fallback behavior.

### Android platform references

- [Android VoiceInteractionService API](https://developer.android.com/reference/android/service/voice/VoiceInteractionService)
- [AOSP VoiceInteractionService XML metadata schema](https://android.googlesource.com/platform/frameworks/base/+/master/core/res/res/values/attrs.xml) — documents the Android 11-and-earlier requirement and Android 12+ ignored-but-required metadata behavior.
- [ColorOS 16 third-party assistant invocation report (OPPO Pad Mini)](https://github.com/parallelcc/MiCTS/issues/139) — anecdotal device evidence only; not an OGAM test.
