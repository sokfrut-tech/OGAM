# ZorvAI Source Audit — OGAM Architecture Transfer Notes

Date: 2026-11-22
Repository audited: https://github.com/Quor-a/ZorvAI
Inspected branch: main
Tree commit: baeaf00acddadf2b9877a72702b5e03dbd70e5d3
License inspected: Apache-2.0 (root LICENSE); root NOTICE contains third-party notices.
Mirrors advertised by upstream README: https://gitee.com/ZorvAI/ZorvAI and https://jihulab.com/quor-a-group/ZorvAI. Mirror parity and independent history have not yet been verified.
Method: read-only source and documentation review through public GitHub files. No APK downloaded, built, installed, or run. No source code copied into OGAM.

## Executive finding

ZorvAI is a high-value reference for a modular Android agent runtime, not merely a chat UI. Its most reusable ideas for OGAM are:
1. a typed central tool registry with progressive schema disclosure;
2. an explicit cross-app capability protocol (ACI) using Android Binder/AIDL, with LocalSocket as an optional same-device transport;
3. separate process isolation for crash-prone native ASR;
4. signed APK plugin contracts and explicit extension points;
5. long-horizon plan → execute → delivery-check → replan orchestration;
6. declared permission tiers and user-granted capability boundaries.

OGAM should reproduce the architectural ideas independently and keep its existing React Native/native foundations. Do not transplant the whole app or adopt all of its privilege model.

## Project identity and build baseline

Upstream README states:
- package: com.ai.assistance.quro;
- Kotlin + Jetpack Compose;
- minSdk 26, targetSdk 34, compileSdk 36;
- version 1.2.1 / versionCode 1002001 in the inspected README;
- Apache-2.0 application license, with separate third-party license obligations documented in NOTICE;
- local inference engines MNN and llama.cpp;
- local speech pipeline based on Sherpa-NCNN streaming transducer, plus multiple TTS provider adapters.

These are upstream-declared facts, not independent reproducible-build verification. Version metadata may change; pin the inspected commit when citing these findings.

## Audited modules and mechanics

### 1. Tool registry and progressive disclosure
Files inspected:
- app/src/main/java/com/ai/assistance/quro/core/tools/QuroToolRouter.kt
- README.md and docs/architecture/tool-system/README.md (README section)

Observed:
- tools are represented by typed specs and registered centrally;
- a compact tool-router catalog exposes categories, intent matching, schema lookup and invocation;
- core/high-frequency tools are always available; other tool schemas are disclosed on demand;
- loaded tool names are persisted in SharedPreferences and pruned when tools disappear;
- read-only tools can be scheduled concurrently while side-effecting operations are serialized (upstream architecture description).

Important discrepancy:
- README text describes 235 registered / 151 always-on in one section, while the inspected current QuroToolRouter source comments describe approximately 43 core tools and the actual ALWAYS_ON set is assembled from a smaller explicit list plus unified tool names. Another source comment mentions 265 total tools. Counts are internally inconsistent across README/comments and should not be treated as verified constants. OGAM should benchmark its own registry and test tool coverage rather than copying advertised counts.

OGAM decision:
- adopt typed ToolSpec + category/intent discovery + lazy full schema + persistent schema cache;
- always-on set must be minimal and measured;
- add schema version, capability permission metadata, risk class, offline availability, and evidence/test status to each OGAM tool;
- no model may invoke tools not explicitly present in the current capability snapshot.

### 2. ACI: cross-app capability protocol
Files inspected:
- app/.../core/aidlaci/QuroAidlAciManager.kt
- aidl-aci-core/.../BaseAidlAciService.java
- aidl-aci-core/.../IAidlAciService.aidl
- app/.../core/aidlaci/QuroAciHttpServer.kt
- app/.../core/aidlaci/AciHttpServerManager.kt

Observed:
- service discovery via the ACTION_BIND intent;
- Binder/AIDL service binding, capability discovery and typed request/response envelopes;
- synchronous and asynchronous calls with callback IDs;
- Binder death detection, health monitoring, reconnect/backoff and call tracing;
- same-device LocalSocket fast path with AIDL fallback;
- call IDs, timeout, protocol version and audit trace concepts;
- MCP bridge integration;
- optional HTTP API listens on 127.0.0.1 and routes to the real AIDL manager when available.

Security review / cautions:
- ACI request includes caller package and token validation hooks. The manager comments describe deriving the real caller identity from Binder UID rather than trusting a self-reported package field; verify every transport path retains that invariant.
- BaseAidlAciService has a default onCheckPermission implementation that returns true. The default AciTokenVerifier checks that a token has a recognizable prefix/format; it does not by itself compare the token against a stored expected secret. A separate overload supports expected-token comparison, but the inspected base path calls the default verifier. This is a protocol-level risk unless each concrete controlled service overrides permission/token checks appropriately. OGAM must default-deny and validate the caller UID/package, signing identity where applicable, and a per-peer random secret; never accept a token merely because its string looks valid.
- The loopback HTTP endpoint is bound to 127.0.0.1, which limits network exposure but does not authenticate local apps by itself. OGAM should use authenticated IPC, request-scoped permissions, replay protection and explicit enable/disable state; no unauthenticated LAN server.
- Do not expose terminal/shell or arbitrary file access as default capabilities.

OGAM decision:
- design a smaller Jarvis Capability Bridge using Android Binder/AIDL for local IPC;
- use capability manifests with exact package, service, signing certificate, protocol version, requested scopes and risk;
- require explicit user pairing/approval for every external app;
- default-deny, revoke tokens, rotate credentials, rate-limit, timeout, audit and cancel;
- keep local HTTP diagnostics disabled by default and loopback-only if ever implemented.

### 3. Permission tiers and capability governance
Files inspected:
- PERMISSIONS.md
- app/.../core/privilege/QuroPrivilegeManager.kt
- AndroidManifest.xml

Observed:
- project documents many Android capabilities and their user-facing purpose;
- privilege tiers map from Accessibility through Shizuku, Device Admin and root; in-app proot Linux is separately gated;
- permission manager describes a four-stage flow: Intent → Policy Check → User Confirmation → Audit Log;
- high-sensitivity permissions include notification access, broad media management, overlay, screen capture and debugging channels;
- manifest requests a large set of permissions, including SMS, contacts, calendar, location, camera, Bluetooth, media, package visibility and foreground-service types.

Cautions:
- A large manifest increases review burden and may cause Play distribution/policy issues; OGAM should request permissions only for features actually enabled and eligible for distribution.
- Shizuku/root/Device Admin are not equivalent to ordinary Android permissions and are not guaranteed on OPPO ColorOS.
- Proot is a user-space environment, not a security boundary equivalent to a hardened OS sandbox. Do not promise unrestricted or isolated execution without threat-model and tests.
- The upstream permissions guide is a declared design; it is not independent proof every permission is correctly enforced in all call paths.

OGAM decision:
- define feature-scoped optional permissions;
- separate normal Android permissions, special settings access, user-mediated system intents, OEM/signature privileges and experimental root paths;
- provide permission status, reason, revoke path and graceful fallback;
- never request broad permissions at first launch.

### 4. APK plugin framework
File inspected:
- plugin-engine/.../install/PluginInstaller.kt
- README architecture and plugin docs

Observed:
- plugin APK declares a metadata entry class;
- same-signature check can be required;
- APK is stored under app-private files, copied atomically with rollback;
- extracted native libraries are stored in the private plugin directory;
- host exposes explicit extension points (tool, ACI capability, command, UI surface, provider, RAG source, scheduler task, file handler, code runtime).

Cautions:
- same-signature APK plugins run with host-level trust and are not sandboxed merely because they are a separate APK;
- a third-party developer cannot normally sign with OGAM's release key. Same-signature plugins are suitable for first-party modules, not a general public plugin marketplace;
- dynamic code loading and native libraries require supply-chain review, hash/signature checks, compatibility checks and rollback.

OGAM decision:
- start with built-in modular adapters and signed first-party extension packages;
- later define a restricted declarative plugin format for third parties, with no arbitrary code execution by default;
- maintain an allowlist of capabilities, file/network scopes and model providers.

### 5. Native ASR crash isolation
Files inspected:
- app/.../core/tools/QuroAsrService.kt
- app/.../core/tools/QuroOnDeviceAsr.kt
- voice-media feature documentation

Observed:
- native Sherpa-NCNN recognizer runs in a separate Android process named :asr;
- main process communicates using Messenger IPC;
- a dedicated HandlerThread performs model load/decode rather than blocking the service main thread;
- Binder DeathRecipient detects ASR process crash and marks engine unavailable;
- model layout and file sizes are prevalidated; user receives readable failure reasons;
- model loading releases previous recognizer first to avoid two large models resident simultaneously;
- README lists five bundled model profiles, but these are upstream models and not necessarily Russian-capable.

OGAM decision:
- isolate crash-prone native engines (ASR, image generation, possibly LLM backends) behind process boundaries;
- define a common EngineSupervisor with health, bounded load/unload, memory budget, crash restart limit, telemetry and fallback;
- keep language model compatibility explicit; do not infer Russian support from model size or architecture;
- compare OGAM's existing Whisper/Kokoro pipeline against Sherpa-NCNN and Sherpa-ONNX with Russian test corpus.

### 6. Long-horizon orchestration
File inspected:
- app/.../core/agent/orchestration/LongHorizonOrchestrator.kt

Observed:
- task-level loop: plan → execute a ReAct pass → delivery gate evaluates raw artifact → replan with rejection reason and failed-step memory;
- bounded max iterations and escalation to user when not deliverable;
- pure helper builds planning context from prior gate, failure summaries and external memory.

OGAM decision:
- adopt task state persistence, plan/step/result ledger and verification gate;
- distinguish "tool call returned success" from "desired outcome verified";
- ask user before irreversible or externally visible actions;
- do not loop indefinitely: use budgets, stop conditions and user escalation.

## OGAM transfer plan

### P0 — adopt immediately in OGAM design (no external dependency)
1. Capability registry schema: id, title, description, JSON schema, permission scopes, risk class, online/offline, supported API levels, adapter id, evidence/test status.
2. Progressive tool disclosure with measured minimal always-on set.
3. EngineSupervisor process isolation for native ASR/LLM/image engines.
4. Task ledger and delivery verification gate with bounded replanning.
5. Permission dashboard and per-action consent.
6. Common event/correlation IDs across voice turn, model, tool, IPC and TTS.
7. Local-first model/command router; cloud provider optional and switchable.

### P1 — build after the above
1. Jarvis Capability Bridge over Binder/AIDL, paired peers, signed manifests, default-deny.
2. First-party plugin contracts and extension points.
3. Typed MCP adapter with explicit allowlist.
4. Russian ASR/TTS benchmark and language pack registry.
5. Local RAG/memory provenance and user review.
6. Sandboxed task runner for user-approved scripts; no default unrestricted shell.

### P2 — optional/experimental
1. ColorOS/Breeno adapter profiles after exact device firmware/APK analysis.
2. Shizuku integration if user opts in and device supports it.
3. LAN companion access with authentication, TLS where applicable, CSRF/replay protections and explicit session pairing.
4. Public third-party plugin ecosystem only after sandbox/security review.

## Open questions for continued audit
- Inspect actual ACI token/caller checks in every controlled service, especially default onCheckPermission/onVerifyToken behavior.
- Inspect all ACI HTTP request handlers and authentication enforcement.
- Verify plugin signature requirement is always enabled in production installation call sites.
- Compare Gitee and JiHuLab mirrors against GitHub tree commit and license.
- Inspect actual native model assets and Russian language availability without downloading/running untrusted binaries.
- Run upstream Gradle tests/build only in a disposable environment if available; no such build was run in this audit.

## OGAM source comparison reminder
ZorvAI is a separate Kotlin/Compose application. OGAM is a React Native + Android native project. Transfer interfaces, state machines, safety controls and test patterns, not UI framework assumptions or entire modules. No claim is made that ZorvAI source has been integrated or that any feature works on the OPPO Find X6 Pro.

## Sources
- https://github.com/Quor-a/ZorvAI
- https://github.com/Quor-a/ZorvAI/blob/main/PERMISSIONS.md
- https://github.com/Quor-a/ZorvAI/blob/main/docs/architecture/tool-system/README.md
- https://github.com/Quor-a/ZorvAI/blob/main/docs/architecture/extensibility/README.md
- https://github.com/Quor-a/ZorvAI/blob/main/docs/architecture/terminal-sandbox/README.md
- https://github.com/Quor-a/ZorvAI/blob/main/docs/features/device-control/README.md
- https://github.com/Quor-a/ZorvAI/blob/main/docs/features/voice-media/README.md
- https://gitee.com/ZorvAI/ZorvAI
- https://jihulab.com/quor-a-group/ZorvAI
