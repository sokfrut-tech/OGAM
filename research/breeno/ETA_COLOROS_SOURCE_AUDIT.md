# Eta (Mangi-11) Source Audit — ColorOS System Assistant Reference

Date: 2026-11-22
Repository: https://github.com/Mangi-11/Eta
Inspected main tree commit: 05086d3a615279611ed23d8830b5e83a9d8fa82e
License: GNU GPL-3.0 (root LICENSE). No Eta source copied into OGAM.
Related regional mirror: https://gitcode.com/gh_mirrors/eta9/Eta (commit parity not verified).

Method: read-only source review of Manifest, Gradle config, VoiceInteraction service/session/overlay, screen-context capture, ColorOS hooks, ColorOS memory adapter, runtime policy, technical docs and selected tests. No APK downloaded, built, installed or run. No Find X6 Pro device validation.

## Executive finding

Eta is the closest public reference found so far to OGAM's OPPO system-assistant goal. It has a standards-based Android VoiceInteractionService, an assistant overlay, system-provided Assist/screenshot context, a shared agent runtime, optional LSPosed hooks for ColorOS system routing and a Xiaobu Memory bridge.

It is a reference, not a drop-in dependency. Some OEM and personal-data features require LSPosed and/or root. The license is GPL-3.0; copying or adapting code into a distributed OGAM build would require a deliberate GPL compliance decision. Current plan: independently reimplement public Android API patterns and design our own adapters.

## Build and compatibility facts

Inspected app/build.gradle.kts:
- applicationId io.github.mangi.eta
- minSdk 34 (Android 14), targetSdk 37, compileSdk 37.2
- Java 25 toolchain
- ABI only arm64-v8a
- inspected versionName 3.4.4 / versionCode 2026111302

The English README's broad "Android 13+" statement is stale against current Gradle minSdk 34. Use Gradle as the build fact. The user's phone environment reports Android 16, but exact PGEM10 build fingerprint and ColorOS version still need capture. API compatibility does not prove private hook compatibility.

## 1. Native Android assistant

Inspected Manifest, EtaVoiceInteractionService, EtaVoiceInteractionSessionService, EtaVoiceInteractionSession and AssistantRoleHelperTest.

Confirmed:
- VoiceInteractionService protected by BIND_VOICE_INTERACTION with voice-interaction metadata.
- Separate VoiceInteractionSessionService and RecognitionService.
- Session receives Android Assist data and screenshot, then shows a separate full-screen overlay.
- Assistant-role onboarding opens Android's system assistant selector.
- Session hide/back/system-dialog paths close the overlay and release the invocation context.
- Duplicate invocations are coalesced.
- Tests cover role held/unavailable and assistant identity detection.

OGAM decision:
- implement a native Android assistant module alongside the existing React Native app;
- use VoiceInteractionService + Session + assistant-role onboarding, not only a floating bubble;
- share one invocation/session ID with the OGAM runtime;
- native overlay must support voice/text, streaming, cancel, follow-up and return to the main app;
- never silently change the default assistant.

## 2. Screen context at invocation

Inspected EtaAssistantScreenContext, EtaVoiceInteractionSession, AssistantScreenContextProjection and tests.

Confirmed:
- Android Assist structure and screenshot are captured independently;
- at most four activity contexts are retained;
- password input nodes are excluded;
- capture waits at most two seconds and accepts partial context;
- capture timestamp is explicit; old screen context is not treated as live after actions change the UI;
- a new invocation replaces old context; late callbacks are rejected;
- Bitmap is recycled on all paths;
- screen content is projected into the current model request only, not persistent conversation history or logs;
- tests cover denied screenshots, stale callbacks, password nodes and SDK-specific screen-content flags.

OGAM decision:
- short-lived ScreenContextSnapshot with invocation ID, timestamp, foreground app, Assist text/tree and screenshot reference;
- exclude password and sensitive fields by default;
- no silent long-term memory persistence;
- bound wait, node count, depth, text size, image size and foreground activity count;
- show a privacy indicator when screen context is attached.

## 3. ColorOS power-button routing

Inspected PowerHooks, AssistantManager, AssistantBinding, ModuleConfig and TECHNICAL.md.

Current source targets:
- system_server class com.android.server.policy.PhoneWindowManagerExtImpl$OplusSpeechHandler
- method handleMessage(Message)
- assistant message code 0x3F3
- choices: OEM assistant, Gemini or Eta
- Android voiceinteraction session first, bounded Activity fallback second
- if Eta is unavailable or launch fails, original OEM handler is allowed to proceed
- duplicate events use a one-second dedupe window
- role and secure-setting changes are serialized to avoid races.

Compatibility caution:
This is a private ColorOS implementation detail and can vary by ROM build, region and vendor update. The source author's comment says this path was device-tested, but does not prove compatibility with the user's exact PGEM10 firmware. LSPosed and system scope are required for this type of hook. Root/LSPosed must not be required by Jarvis core.

OGAM decision:
- public Android assistant role first;
- optional ColorOS adapter only after exact firmware fingerprint and verified fallback;
- record hook state as INSTALLED / MISSING / FAILED / SKIPPED;
- never swallow the original system handler if Jarvis cannot launch.

## 4. ColorDirect / screen-recognition handoff

Inspected ColorDirectHooks and ColorDirectTargets.

Confirmed:
- targets com.coloros.directui.ui.CollectInfoActivity;
- locates an obfuscated Intent handler using class, parameter, return type and diagnostic strings through DexKit;
- validates startInfo.directExt, fingerTrigger and touchInfo.fingerCount == 2;
- only redirects when the feature toggle is enabled and the target is uniquely identified;
- if target is missing or invocation fails, original ColorDirect behavior continues.

OGAM decision:
- semantic/signature/behavioral target discovery with uniqueness checks, not hard-coded obfuscated method names;
- bind profiles to package/version/DEX fingerprints;
- fail open to original OPPO behavior;
- test normal screenshot and search flows before enabling.

## 5. Xiaobu Memory / ColorOS AI Memory bridge

Inspected AgentColorOsMemoryTools, ColorOsMemoryHooks, ColorOsMemoryDatabaseQuery and ColorOsMemoryBridgeProtocol.

Confirmed:
- target package com.oplus.aimemory;
- LSPosed hook intercepts a specific DataShareProvider.call method inside Xiaobu Memory's own process;
- bridge accepts only UID 0 and a fixed operation allowlist (memory search, orders, saved places);
- model does not provide arbitrary SQL; fixed query engine controls tables and fields;
- request and result sizes are bounded and results are marked sensitive;
- encrypted DB versions may use an in-process database connection; fallback root snapshot checks file, symlink and size constraints, copies DB plus WAL/SHM/journal sidecars, opens read-only and deletes the snapshot.

Limits:
- depends on OEM private internals and LSPosed and/or root;
- schema and provider classes are version-specific;
- personal-data access is high sensitivity and must be opt-in;
- no decryption bypass or arbitrary SQL should be copied.

OGAM decision:
- optional ColorOSMemoryAdapter with fixed typed operations, no arbitrary SQL, bounded results and sensitive-data tagging;
- disabled by default, explicit consent and source/time display;
- use standard Android APIs or user-mediated export when no supported adapter exists.

## 6. Runtime policy and permissions

Inspected AgentRuntimePolicy and Manifest.

Confirmed:
- Runtime re-reads local feature preferences and intersects them with requested model configuration; caller-provided booleans do not grant access by themselves.
- Separate switches exist for terminal, browser, direct device actions, sensitive reads and sensitive actions.
- Manifest includes broad permissions such as MANAGE_EXTERNAL_STORAGE, QUERY_ALL_PACKAGES, location/background location, calendar, audio, overlay and local network.

OGAM decision:
- enforce permission policy in the execution runtime, not just UI;
- effective capability = user consent ∩ Android permission ∩ device/ROM support ∩ policy;
- separate read-only, reversible, sensitive-read and sensitive-action capabilities;
- request feature-specific permissions only when needed;
- root and LSPosed remain optional advanced adapters.

## 7. Shared agent runtime and recovery

Inspected docs/AGENT_RUNTIME.md and runtime classes.

Confirmed:
- Hook process is only an entry/return bridge; agent loop runs in Eta runtime process.
- Runtime supports streaming events, steering/cancellation, incremental transcripts and result persistence.
- After interruption, Eta attempts to recover records without automatically replaying actions.
- app chat and system assistant use the same agent loop.

OGAM decision:
- voice, app chat and system summon share one AgentRuntime interface;
- task resume must never blindly replay side effects;
- use correlation IDs across turn, model, tool and TTS; preserve partial results and verification state.

## 8. Test evidence

Source tree includes tests for AssistantRoleHelper, screen-context lifecycle, assistant binding, runtime policy/safety, ColorOS memory query and related state. This audit did not execute tests; no pass result is claimed. Unit tests do not prove PGEM10 compatibility.

## OGAM implementation backlog

### P0 — native assistant
1. VoiceInteractionService and VoiceInteractionSession.
2. Default assistant role selection/status UI.
3. Native overlay with voice + keyboard + streaming + cancel.
4. Invocation ID and short-lived screen-context capture.
5. Safe fallback to ordinary OGAM app if assistant session unavailable.

### P1 — runtime and device capabilities
1. One AgentRuntime shared by app chat and system assistant.
2. Execution-time permission intersection and capability matrix.
3. State-verified Android system action adapters.
4. Screen-context filters, expiry and no-persist defaults.
5. Task persistence with no automatic replay of side effects.

### P2 — optional ColorOS integration lab
1. Capture exact PGEM10 build fingerprint, Android API, ColorOS version and installed OPPO packages.
2. Determine whether OplusSpeechHandler.handleMessage(0x3F3) exists in this exact build.
3. Verify public RoleManager/VoiceInteractionService behavior first.
4. Inspect ColorDirect and Xiaobu Memory only after package/version fingerprints are captured.
5. LSPosed adapter only with explicit user approval, rollback plan and fail-open behavior.

## Required device evidence before OEM hooks
- exact Android API and full build fingerprint;
- ColorOS version/build/region and model code;
- package/versionCode of com.heytap.speechassist;
- package/versionCode of com.oplus.aimemory and com.coloros.directui;
- current default assistant role;
- observed power-key long press and gesture behavior;
- whether root/LSPosed is present and whether the user explicitly wants optional experiments.

## Sources
- https://github.com/Mangi-11/Eta
- https://github.com/Mangi-11/Eta/blob/main/docs/TECHNICAL.md
- https://github.com/Mangi-11/Eta/blob/main/docs/ROOTLESS_SUPPORT.md
- https://github.com/Mangi-11/Eta/blob/main/docs/AGENT_RUNTIME.md
- https://github.com/Mangi-11/Eta/blob/main/app/src/main/kotlin/io/github/mangi/eta/agent/voice/EtaVoiceInteractionService.kt
- https://github.com/Mangi-11/Eta/blob/main/app/src/main/kotlin/io/github/mangi/eta/hook/system/PowerHooks.kt
- https://github.com/Mangi-11/Eta/blob/main/app/src/main/kotlin/io/github/mangi/eta/hook/colordirect/ColorDirectHooks.kt
- https://github.com/Mangi-11/Eta/blob/main/app/src/main/kotlin/io/github/mangi/eta/hook/aimemory/ColorOsMemoryHooks.kt
- https://gitcode.com/gh_mirrors/eta9/Eta
