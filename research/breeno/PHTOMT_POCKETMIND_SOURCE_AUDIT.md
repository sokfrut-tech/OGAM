# Phtomt + PocketMind Source Audit — Permission Provider and Approval Gate

Date: 2026-11-22
Audited projects:
- https://github.com/xkx121029/Phtomt — tree commit ee5365f2e5f9c29bc29dedb0731afe70670c99e9; root license is AGPL-3.0.
- https://github.com/badhope/pocketmind — tree commit a6246a8f9af3e2d29d531020e4579624d2d3e41a; root license is Apache-2.0.

Important license discrepancy: GitCode's Phtomt mirror description says MIT, while the canonical GitHub repository README badge and LICENSE file say AGPL-3.0. Treat AGPL-3.0 as authoritative for the inspected canonical source. Do not copy Phtomt code into OGAM without an explicit AGPL compliance decision. PocketMind's root LICENSE is Apache-2.0.
Method: read-only source review; no APK downloaded, built, installed or run; no source copied into OGAM.

## 1. Phtomt / Happy Phone Agent

### Confirmed architecture
- Android native app with 14 Gradle modules, minSdk 26 (Android 8), Kotlin + Compose.
- README describes 65 semantic intents in four risk tiers, mapping to 24 action types and three execution channels.
- The model is intended to emit semantic intent/actions; a local translator chooses coordinates, commands and execution channel for ordinary actions.
- Accessibility, embedded Shizuku server and Termux integration are isolated in a separate Provider APK rather than living in the main application.
- Main app binds to Provider through AIDL service IDeviceProvider; binding permission is signature-level and the main app and Provider must share signing identity.
- Provider contract has explicit API version; connection status, API version and errors are observable; bind timeout and Binder death/disconnect handling are implemented.
- Large accessibility tree and screenshot payloads use a token-based chunked transfer rather than a single oversized Binder transaction.
- Provider service is a thin AIDL entry point; Accessibility and shell channel logic is in dedicated bridges.
- Provider installer/version sync is explicit; source fingerprints are checked so stale bundled provider assets cause build failure.

### Action and risk model
- ActionMode separates model authority ("what the agent may request") from execution-channel capability ("what the device can execute").
- Modes: Conservative, Balanced, Free. Risk tiers come from a declarative CapabilityRegistry rather than separate handwritten policy and prompt lists.
- High-risk operations include send/delete/payment-like effects and carry a confirmation marker.
- Free mode adds direct shell and raw Accessibility endpoint calls; the Action model defaults aiAuthored=true so free-form shell requests require confirmation unless a trusted local translator explicitly marks the command as locally generated.
- Tests exist for action mode policy, provider contract, AIDL payload storage and wireless ADB state machine.

### Important caveats
- README's strong statement that the model never writes coordinates or commands applies to the normal semantic translator path. The same Action model also has coordinate fields, shell command, direct A11Y endpoint and raw args for Free mode. OGAM must make the boundary explicit and keep unrestricted/direct mode off by default.
- Main app requires installation of the separate Provider APK; first-run unknown-source installation and signature consistency are additional failure points.
- Shizuku/ADB/Termux paths remain device- and user-authorization-dependent. They are not universal Android capabilities.
- Canonical source is AGPL-3.0, despite the GitCode mirror's MIT label. The mismatch is a supply-chain/licensing warning.

### OGAM decisions
1. Adopt a separate privileged capability process/package as an architecture option: isolate Accessibility, Shizuku/ADB and sensitive system actions behind a narrow IPC contract.
2. Use Binder/AIDL with signature-level caller restriction, contract versioning, typed request/response, Binder-death handling, bounded timeouts and chunked payload transfer.
3. Main app/agent runtime must never select raw shell/coordinates for routine operations; use locale-independent typed semantic intents translated locally.
4. Keep direct shell/Accessibility endpoints in an explicit advanced mode, with additional confirmation and a visible audit trail.
5. Maintain a single declarative capability/risk registry consumed by prompt construction, runtime enforcement and UI.
6. Do not make Shizuku/Termux a required dependency; expose channel availability and fallback.

## 2. PocketMind

### Confirmed approval architecture
Inspected README, agentd/approval.py, agentd/permissions.py, agentd/agent.py, tool registry and checkpoint store.

- Tool registry includes risk metadata per tool: safe, write or danger.
- In approve mode, safe tools run without confirmation; write and danger tools require user approval.
- Approval decision is enforced in the agent execution path before call_tool, not merely described in the system prompt or displayed as a UI dialog.
- If the approval callback is missing, write/danger and unknown tools fail closed rather than silently reverting to auto.
- Unknown model-generated tool names are also approval-gated in approve mode.
- Global deny list short-circuits before any approval card; deny has higher priority than allow.
- Allow decisions can be once, session-scoped or global. A session decision does not silently become a global permission.
- Unanswered approvals time out and are denied (default 120 seconds).
- Approval gates are keyed by session ID and tool-call ID.
- Approval rules persist using atomic JSON replacement.
- Tool results are structured; failures are not reported as success.
- Automatic retry is restricted to safe/read-only tools; write/danger tools are not retried because they may be non-idempotent.
- Checkpoints store pre-operation file backups and SQLite metadata; selected file write/delete operations can be undone after restart.
- Settings include explicit Plan/Act modes, approval timeout, and max tool-chain depth.

### OGAM decisions
1. Add a server/runtime-side ActionApprovalGate. UI confirmation alone is not a security boundary.
2. Every capability has risk tier, user-facing summary, affected target and operation payload preview.
3. Deny rules take precedence over allow rules.
4. Support once / current-session / global decisions with separate storage and clear management.
5. Timeout, missing approval channel, malformed approval state and unknown tool all fail closed.
6. Never auto-retry side-effecting actions; retries only for safe, idempotent reads.
7. Add durable action checkpoints and undo for operations where rollback is technically possible.
8. Use a bounded plan/act mode and task-chain budget; the model cannot expand its own authority.

### Limits
- PocketMind's standalone APK and optional Termux runtime are distinct deployment shapes; the Termux runtime's 41-tool catalogue is not the APK's 37 native tools.
- The full runtime uses a configured LLM endpoint for inference. Its local-first claim means device data/tools are local; it does not mean the model itself is always offline.
- This audit did not execute the project test suite or run its APK.

## OGAM priority updates

### P0
- Execution-time risk gate independent of LLM and UI.
- Fail-closed behavior when approval service is missing or times out.
- Semantic intent contract with a local translator; ordinary model output cannot inject raw shell.
- Separate IPC/provider process for privileged device actions.
- Structured action results and verification states.
- No retries for non-idempotent side effects.

### P1
- Session/global allow and deny policy management.
- Undo/checkpoint service for reversible file and settings operations.
- Provider API version and health diagnostics.
- Bounded payload transfer and Binder death recovery.
- Action mode and channel mode remain orthogonal.

### P2
- Optional advanced shell/Shizuku/ADB route with explicit user enablement and independent approval.
- Third-party extensions only after signature, license and capability-sandbox review.

## Sources
- https://github.com/xkx121029/Phtomt
- https://github.com/xkx121029/Phtomt/blob/main/LICENSE
- https://github.com/xkx121029/Phtomt/blob/main/app/src/main/java/com/phoneagent/device/provider/ProviderManager.kt
- https://github.com/xkx121029/Phtomt/blob/main/provider/src/main/java/com/phoneagent/provider/ProviderService.kt
- https://github.com/xkx121029/Phtomt/blob/main/app/src/main/java/com/phoneagent/engine/execution/ActionMode.kt
- https://gitcode.com/xkx1029/Phtomt
- https://github.com/badhope/pocketmind
- https://github.com/badhope/pocketmind/blob/main/agentd/approval.py
- https://github.com/badhope/pocketmind/blob/main/agentd/permissions.py
- https://github.com/badhope/pocketmind/blob/main/agentd/agent.py
- https://github.com/badhope/pocketmind/blob/main/agentd/checkpoints.py
