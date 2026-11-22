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
