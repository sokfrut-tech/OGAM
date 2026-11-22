# Breeno / ColorOS Research and Jarvis Adaptation Plan
Date: 2026-11-22
Repository: sokfrut-tech/OGAM
Status: research plan; no Breeno code or APK has been imported into OGAM.

## Decision
Treat OPPO Breeno (Xiao Bu / HeyTap Speech Assistant) and the China-region ColorOS stack as a first-class reference alongside Apple Siri/Apple Intelligence and open Android agents. The target device is OPPO Find X6 Pro. The goal is a Russian-language, locally capable Jarvis that uses supported Android/ColorOS interfaces and does not depend on Breeno cloud services or proprietary OPPO privileges.

Do not replace OGAM with Breeno, install modified system packages, or assume privileged OEM permissions are available to a normal third-party app. Reimplement useful behavior in OGAM and integrate through public Android APIs wherever possible. Keep OEM-specific adapters isolated and optional.

## Verified research findings (web research, 2026-11-22)
- OPPO's official Find X6 Pro specifications list ColorOS 13.1 for the original device software.
- OPPO's 2023 developer conference material says ColorOS 14 China combined Pantanal with AndesGPT; upgraded Breeno covered more than 400 frequently used system settings, natural conversational control, AI content generation and schedule management. AndesGPT capability areas include knowledge, memory, tools and creation, with cloud-device collaboration.
- A current third-party APK catalog lists Breeno package com.heytap.speechassist; version 13.3.2 is arm64-v8a, Android 10+, target Android 12, about 120.57 MB, with 165 permissions. The listing also shows a later 13.3.5 upload dated 2026-10-28. These are catalog claims, not proof that either build is compatible with this exact Find X6 Pro firmware.
- The 13.3.2 permission listing contains numerous privileged OPPO/ColorOS permissions (assistant, voice, settings, phone, window, connectivity, IoT, accessibility and others). A third-party app cannot assume it can obtain these permissions.
- Public project Andrea-lyz/ColorOS-Assistant-Restore documents China-ROM assistant dispatch differences: power-button long press and gesture entry points can explicitly route to com.heytap.speechassist, bypassing standard AOSP assistant dispatch. Its notes are for a different/newer ColorOS device/build and must not be applied blindly to Find X6 Pro.
- Public project niki914/zafiro describes an Android agent with screen reading, tap/swipe/type/app launch, memory, MCP/tools and optional LSPosed takeover of Breeno on supported devices. Treat this as a research reference, not a dependency or guaranteed compatibility path.
- OPPO AI white-paper material describes a broader agent/service ecosystem: native service components, device control, user-generated agents, AI text/image/voice/video, and Breeno as a customized agent powered by AndesGPT.

## Required research work
### A. Capture the exact target device baseline
Record from the actual phone:
- model/product code and region;
- ColorOS version, Android API level, full build fingerprint and security patch;
- Breeno app version, package name, versionCode, installer/source and signing certificate;
- installed related packages/services (speech wakeup, voice trigger, Pantanal/Metis, smart data service, assistant providers);
- available assistant role/dispatch settings and relevant permissions.
Never infer the installed version from online listings.

### B. APK and system-component lab
Create an isolated, reproducible archive. For every APK/APKS/XAPK:
- preserve original filename and source URL;
- record SHA-256, signing certificate, package/version, min/target SDK, ABI, manifest permissions, exported components, services, receivers, providers, intent filters, native libraries and assets;
- inspect DEX/resources/native libraries statically; do not execute unknown APKs on the daily-use phone;
- compare at least the installed Breeno version, 13.3.2 and 13.3.5 only if legally obtainable and compatible for static analysis;
- inspect related voice-wakeup and system-dispatch components separately;
- document cloud endpoints only from lawful observable metadata; do not bypass authentication or access controls.
Do not redistribute proprietary OPPO APKs or extracted proprietary assets in the public repo. Store hashes, metadata, links, analysis notes and legally redistributable test fixtures. Keep local binaries outside version control unless licensing permits.

### C. Functional parity matrix
Map each capability to: observed behavior, source evidence, required Android/OEM API, privilege level, network dependency, offline fallback, OGAM module, test and status.
Include:
1. wake word / hotword, DSP/voice trigger, microphone ownership and audio focus;
2. speech capture, VAD, ASR, streaming partial results, barge-in/interruption;
3. dialogue context, intent detection, entity resolution, memory and personalization;
4. command routing and tool execution;
5. device settings (only supported public APIs or explicit user-mediated Settings intents);
6. calls, contacts, messages, alarms, calendar and notifications with permission boundaries;
7. screen/context understanding, OCR, accessibility and user confirmation for consequential actions;
8. app launching and cross-app workflows;
9. routines, smart scenes, schedules and proactive cards;
10. translation, camera/image understanding, document scanning and multimodal input;
11. TTS, voice selection, playback queue, interruption and audio routing;
12. offline/online model routing, cloud fallback disclosure and privacy controls.

### D. OPPO/ColorOS integration strategy
- Prefer Android RoleManager.ROLE_ASSISTANT, VoiceInteractionService, VoiceInteractionSession, SpeechRecognizer, TextToSpeech, AccessibilityService (only user-enabled), NotificationListenerService (only user-enabled), MediaSession, intents, SAF and supported settings panels.
- Investigate exact Find X6 Pro firmware behavior before implementing power-button/gesture takeover. Do not promise replacement of hardwired OEM entry points without proof.
- Keep Shizuku/ADB/root/LSPosed paths optional, clearly labeled experimental and never required for core Jarvis.
- Do not request or spoof signature/privileged OPPO permissions.
- Provide graceful degradation when ColorOS blocks background microphone, autostart, overlay or assistant dispatch.

### E. Russian adaptation
- Translate all user-facing strings and voice prompts.
- Preserve Chinese system action names and package/component identifiers in the adapter registry; map them to Russian semantic aliases.
- Add Russian command/entity dictionaries, disambiguation and confirmation.
- Separate locale-independent intent schemas from locale-specific language packs.
- Do not assume Chinese cloud speech/LLM endpoints support Russian or can be used outside China.

## Proposed repository structure
research/breeno/
  README.md
  device-baseline/
  apk-lab/
    manifests/
    signatures/
    hashes/
    versions/
  system-dispatch/
  permission-map/
  feature-matrix/
  cloud-vs-local/
  russian-adaptation/
  compatibility/
  findings/
  test-plans/

Large/proprietary APK binaries stay out of Git. Use an encrypted local archive or legally authorized source storage; commit only metadata and reproducible analysis.

## Acceptance criteria
- Exact target firmware and installed Breeno version are recorded from device evidence.
- Feature matrix covers all major Breeno voice-assistant flows and marks confirmed/unknown/unavailable.
- Every claimed API/permission is tested on the actual device or clearly marked unverified.
- No proprietary APK/code/assets are copied into OGAM without redistribution rights.
- Every adopted capability has an OGAM implementation, documented permission boundary, offline behavior and automated/manual test.
- Core Jarvis remains functional if Breeno, AndesGPT, Pantanal cloud or China-region services are unavailable.
- No destructive system modification or default-assistant takeover is attempted without explicit user approval and a recovery path.

## Source references
- OPPO Find X6 Pro official specs: https://www.oppo.com/cn/smartphones/series-find-x/find-x6-pro/specs/
- OPPO 2023 Developer Conference / Pantanal / AndesGPT / Breeno: https://www.oppo.com/en/newsroom/press/2023-oppo-developers-conference-odc23/
- OPPO AI Smartphone White Paper: https://www.oppo.com/content/dam/oppo/common/mkt/footer/OPPO-AI-white-paper-EN.pdf
- Breeno 13.3.2 catalog metadata (third-party; verify independently): https://www.apkmirror.com/apk/heytap/breeno/breeno-13-3-2-release/breeno-13-3-2-android-apk-download/
- ColorOS assistant dispatch research: https://github.com/Andrea-lyz/ColorOS-Assistant-Restore
- Zafiro Android agent / optional Breeno integration: https://github.com/niki914/zafiro

## Current status
This document records the research direction and initial public-source findings only. It does not claim that Breeno has been downloaded, decompiled, fully analyzed, ported or tested on the target phone. Next action is to capture the phone's exact firmware and installed package inventory, then compare the actual installed Breeno APK against available version metadata.


## Research update 2 — architecture and dispatch details (2026-11-22)

### Confirmed target hardware/software baseline from OPPO
The official China Find X6 Pro product page identifies model code PGEM10 and lists Snapdragon 8 Gen 2 (8 cores, up to 3.187 GHz), MariSilicon X imaging NPU, LPDDR5X RAM (12/16 GB), UFS 4.0 storage and original ColorOS 13.1. These are factory specifications, not proof of the user's current OTA build. Capture the live build from Settings before selecting native runtimes or firmware hooks. Do not assume MariSilicon X is a general-purpose LLM NPU exposed to third-party apps; public product material describes it as imaging-oriented.

### AndesGPT architecture clues
OPPO's 2023 sustainability report describes AndesGPT as a model/agent family with four capability domains: Knowledge, Memory, Tools and Creation. Named tiers are AndesGPT-Tiny (knowledge), AndesGPT-Turbo (memory and tools) and AndesGPT-Titan (creation). Data categories include general, dialogue, instruction and security data; infrastructure includes storage, compute and framework. OPPO describes parameter scale as billions and potentially more than one hundred billion. This is a company-level architecture description, not a downloadable model card. Use it as a functional decomposition for Jarvis, not as a dependency on closed AndesGPT weights or APIs. Build independent local services for retrieval/knowledge, persistent memory, tool orchestration and multimodal creation; cloud adapters remain optional.

### More precise ColorOS dispatch evidence
Public AssistRestore technical notes describe read-only analysis of ColorOS 16 / V16.1.0 / PJZ110. The author reports that framework PhoneWindowManagerExtImpl.startSpeech in oplus-services.jar explicitly starts Breeno when feature flag oplus.software.speech_assist_for_breeno is active; SystemUI has separate paths for gesture-handle long-press and corner-swipe; AssistManager.startAssist has a China-region gate; and the default Android assistant role can be correctly configured while OEM entry points still bypass it. This establishes a real integration risk and a useful investigation map. It is NOT evidence that Find X6 Pro PGEM10 has the same class names, signatures, flags or behavior. Do not copy hooks or binary patches across ColorOS versions. First inspect the exact PGEM10 firmware read-only and compare framework/SystemUI hashes.

### Permission and trust boundary
Third-party catalog metadata for Breeno 13.3.2 shows a broad manifest permission set, including Android privileged/signature permissions and OPPO/HeyTap private permissions (examples include privileged phone state, secure settings, power, audio routing, assistant/voice, settings and IoT permissions). Manifest declaration does not mean a sideloaded app is granted them. Jarvis must use runtime-granted public permissions and user-mediated system panels; OEM-level actions are unavailable unless actual device evidence proves otherwise.

### Newly added reference candidates
- MindTriggerAssist: https://github.com/evokermc098-coder/MindTriggerAssist — Shizuku-assisted alternative for changing ColorOS long-press behavior on newer Find X7 / ColorOS 16 China builds. Requires Google/Gemini; not a Jarvis dependency. Study only its dispatch/UX pattern and compatibility boundaries.
- AssistRestore releases: https://github.com/Andrea-lyz/ColorOS-Assistant-Restore/releases — release notes state a known validation baseline of ColorOS 16 / V16.1.0 / PJZ110 and root + LSPosed-class framework requirements. Not a safe universal recommendation for PGEM10.

## Updated implementation implications for OGAM
1. Introduce a DeviceAssistantAdapter boundary: AssistantEntryPoint, AssistantRoleStatus, OemDispatchCapabilities, PermissionCapability and DeviceBuildFingerprint. Keep public Android API implementation separate from optional ColorOS adapters.
2. Add a capability probe that reports supported, user_grant_required, oem_privileged, blocked_by_firmware or unknown. Never equate manifest declaration with granted permission.
3. Keep voice pipeline independent from summon mechanism: hotword/audio capture → ASR/VAD → dialogue orchestrator → intent/tool router → execution/confirmation → TTS. Jarvis must remain usable from its app UI even if hardware entry points cannot be redirected.
4. Model AndesGPT's four domains as independent Jarvis subsystems: Knowledge/RAG, Memory, Tools/Planner and Creation (image/audio/text). Use local engines first; never hardwire an AndesGPT endpoint.
5. Add a Chinese-ROM test matrix: app launch, default assistant role, power long-press, gesture-handle long-press, bottom-corner swipe, lock-screen summon, screen recognition, background wake, microphone interruption, reboot/autostart and offline mode.
6. No root/LSPosed/Shizuku path in core acceptance criteria. Optional experiments require device backup/recovery, explicit approval and exact firmware compatibility.

## Updated source references
- Official OPPO Find X6 Pro specifications (PGEM10, Snapdragon 8 Gen 2, MariSilicon X, LPDDR5X, UFS 4.0, ColorOS 13.1): https://www.oppo.com/cn/smartphones/series-find-x/find-x6-pro/specs/
- OPPO 2023 Sustainability Report, AndesGPT architecture diagram and capability/model tiers: https://www.oppo.com/content/dam/oppo/common/mkt/footer/2023-OPPO-Sustainability-Report-EN.pdf
- AssistRestore technical notes (specific ColorOS 16 PJZ110 baseline): https://github.com/Andrea-lyz/ColorOS-Assistant-Restore/blob/main/docs/technical-notes.zh.md
- AssistRestore releases and compatibility requirements: https://github.com/Andrea-lyz/ColorOS-Assistant-Restore/releases
- MindTriggerAssist (Find X7 / ColorOS 16 China, Shizuku-assisted): https://github.com/evokermc098-coder/MindTriggerAssist
- Breeno 13.3.2 package and permission catalog: https://www.apkmirror.com/apk/heytap/breeno/breeno-13-3-2-release/breeno-13-3-2-android-apk-download/

## Evidence status update
- Verified from OPPO public product specifications: PGEM10 model code, Snapdragon 8 Gen 2, MariSilicon X, memory/storage technology and original ColorOS 13.1.
- Verified from OPPO corporate materials: AndesGPT capability domains and named tiers; Breeno's announced integration and feature scope.
- Verified only for a different device/build from third-party technical notes: ColorOS 16 assistant dispatch internals.
- Catalog-only metadata, not device-verified: Breeno 13.3.2/13.3.5 package variants and permissions.
- Not yet done: download or extract Breeno APK, verify signature/hash, decompile, enumerate services/receivers, inspect voice trigger services, capture PGEM10 firmware, test on user's phone, or implement a Breeno-derived runtime feature.


## Open-source survey update
A separate reference register now exists at research/breeno/REFERENCE_PROJECTS.md. The most actionable newly discovered repository is timetetng/breeno-rikkahub: it documents an experimental bridge that intercepts Breeno chat input, forwards it to a local RikkaHub conversation API and streams the generated answer back into Breeno's UI. Its README states MIT, but the full LICENSE/dependency tree and source implementation still need review. It requires LSPosed and the README's no-JWT configuration is not acceptable for Jarvis; do not copy that security choice. Its TTS remains Breeno-owned, demonstrating why Jarvis must keep its own speech lifecycle.

Additional references reviewed: MindTriggerAssist (Find X7 / ColorOS 16 long-press rerouting through Shizuku); BreenoNext_Bypass (beta-verification bypass, explicitly excluded from implementation); Xiaobu Memory to Obsidian (memory export/OCR workflow); and the owner's sokfrut-tech/breeno-apks repository, whose README is only an empty-project placeholder, not a verified APK archive.


## Research documents
- [Open-source reference project register and source-level audits](REFERENCE_PROJECTS.md)
- [Breeno-to-OGAM capability mapping and implementation backlog](OGAM_CAPABILITY_MAPPING.md)
