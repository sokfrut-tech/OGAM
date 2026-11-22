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
