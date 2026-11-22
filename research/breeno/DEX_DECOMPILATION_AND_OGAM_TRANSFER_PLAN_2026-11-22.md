# Breeno DEX Deep-Analysis and OGAM Transfer Plan

Date: 2026-11-22
Target: OPPO Find X6 Pro (PGEM10), ColorOS 16.0.5, Android 16
Research branch: docs/research-breeno-coloros-2026-11-22
Related PR: https://github.com/sokfrut-tech/OGAM/pull/2

## 1. Verified evidence boundary

The 26 owner-supplied APKs were inspected offline and read-only. The current inventory supports APK SHA-256 and ZIP integrity inventory; extracted signer certificate fingerprints (not full apksigner body verification); decoded binary manifests, permissions, components, providers and exported status; DEX structural inventory (class descriptors/namespaces, AIDL Stub names, URI/database strings, HTTPS hostnames and framework markers); and native library, asset and resource inventories.

It does NOT establish method-level control flow or runtime behavior. Full JADX Java/Smali decompilation, JDK apksigner full-body verification, installation, execution, dynamic tracing and target-device tests were not performed. Claims about what a method actually does remain hypotheses until supported by decompiled method evidence or runtime tests.

Exact target matches:
- Breeno com.heytap.speechassist: 13.4.3, build metadata 08c04e4_261110 — exact screenshot build match.
- Breeno Memory com.oplus.aimemory: 16.11.5, build 008719b_260901 — exact screenshot build match.
- SearchService com.oplus.dmp: 16.16.80, build 2f5f245_260902.
- Breeno Instructions com.coloros.shortcuts: analyzed 17.2.4 only; device screenshot is 17.7.2 (91aa93e_261102). Do not generalize the older APK's component inventory to the installed build.

## 2. Required toolchain and artifact handling

On the workstation holding the 26 APKs:
1. Preserve originals read-only; record file size and SHA-256 before and after analysis.
2. Install a pinned JADX release in an isolated analysis environment; record version and archive checksum.
3. Run JADX against exact Breeno 13.4.3, Memory 16.11.5, SearchService 16.16.80, AIUnit 16.1.33 and ColorDirect 16.12.2 APKs. Obtain exact Instructions 17.7.2 before analyzing it.
4. Export only a local class/method index and evidence notes to the research workspace. Do not commit APKs, proprietary DEX, decompiled source, native binaries, private endpoints with credentials, AUTH_CODE/API_KEY values or OPPO assets.
5. Verify signer/body integrity with Android build-tools apksigner verify --verbose --print-certs; distinguish catalog hashes from local artifact hashes and installed-package signatures.
6. For every conclusion, record APK SHA-256, package/build, class descriptor, method signature, relevant decompiler location and confidence. Strings and class names alone are not proof of behavior.

## 3. DEX investigation targets

### A. Breeno 13.4.3 (com.heytap.speechassist)
- SpeechService: intent dispatch, foreground lifecycle, audio ownership, cancellation and handoff.
- OmniMind namespace/classes: determine whether this is planning, tool orchestration or merely a model/API wrapper; identify call graph and data contracts.
- AnalogSkillService: screen/context actions, permission gates, semantic vs coordinate interaction, user-visible confirmation.
- Wake/KWS, VAD, AEC and TTS JNI callers: native entry points, initialization, model/config dependencies and fallback paths.
- Offline command/entity/NER configuration: schema, locale coverage, routing precedence and cloud fallback.
- FluidCardNotificationActivity/receiver: inspect only if useful to Jarvis UI; never port proprietary assets.

### B. Breeno Memory 16.11.5 (com.oplus.aimemory)
- Capture-to-record path, consent, normalization, edit/delete/export.
- Room entities/DAO/repository boundaries and encryption assumptions.
- DataShareProvider request/response contract and caller permission checks.
- CloudKit sync conflict handling, offline queue, retries and account boundary.
- MemoryPluginService authorization. OEM signature-protected services are not callable by ordinary OGAM; reproduce only public user-facing behavior.

### C. SearchService 16.16.80 (com.oplus.dmp)
- Indexing: ingestion, chunking, metadata, embeddings, vector lookup and deletion propagation.
- SearchProvider / IndexProvider / PersonaAICommandProvider URI routing and permission enforcement.
- SQLCipher key lifecycle and DB schema boundaries; never reuse OEM encryption keys.
- Persona prompt assembly, data masking, retrieval provenance and cloud-vs-local routing.
- PDF, Office, notes, gallery and calendar parser behavior.

### D. AIUnit 16.1.33 and ColorDirect 16.12.2
- AIUnit client SDK contracts, model lifecycle, worker isolation, request limits and cancellation; do not bind to signature-protected OEM endpoints.
- ColorDirect accessibility capture boundaries, text extraction, OCR fallback and explicit invocation path.
- Identify portable public algorithmic patterns only; do not copy native libraries or proprietary model assets.

### E. Breeno Instructions
Obtain exact installed com.coloros.shortcuts 17.7.2_91aa93e_261102. Compare triggers, TaskMonitorService, rule schema, scheduler, SceneService client and action registry against 17.2.4. Mark differences as observed only after exact-build inspection.

## 4. OGAM clean-room transfer sequence

1. P0 Native assistant entry/session: PR #1 source now confirms VoiceInteractionService/Session, non-exported token-gated bridge, and user-mediated RoleManager. Static source-contract CI passed; Gradle/Kotlin/JUnit and PGEM10 runtime validation remain open. Public Android APIs only; optional ColorOS summon adapter remains separate.
2. P0 Voice session controller: one turn ID across capture → VAD/ASR → dialogue → tools → TTS; cancellation, audio focus, barge-in and lifecycle recovery.
3. P0 Safe action runtime: typed capability registry, risk tiers, permission checks, just-in-time approval immediately before execution, audit ledger and truthful delivery verification.
4. P1 Local-first router: deterministic Russian commands first; local LLM planning for ambiguous/multi-step tasks; cloud fallback optional and explicit.
5. P1 Memory/RAG: OGAM-owned encrypted storage, user-controlled capture/edit/delete/export, source provenance, document chunking and vector retrieval. No dependency on Oplus DMP providers or keys.
6. P1 Context capture: user-triggered screen/OCR/accessibility snapshot, short-lived by default, exclude password/secure fields, never silently harvest unrelated app content.
7. P1 Engine supervisor: independent ASR/LLM/vision/TTS lifecycle, memory/thermal budgets, timeouts, crash recovery and cancellation.
8. P2 Breeno compatibility: separate disabled-by-default adapter, exact build fingerprint, authenticated IPC, strict version profile and safe fallback. Not required for core Jarvis.

## 5. Acceptance gates

- Source evidence: exact class + method + call path for each behavior.
- License/security: no copied proprietary code, assets, native libraries, keys or protected service contracts.
- Build: clean OGAM build and relevant automated tests.
- Device: actual PGEM10 tests for foreground/background, screen-off, airplane mode, audio interruption, denied permissions, thermal/battery and recovery.
- Safety: consequential actions require runtime approval; denied/timeout/malformed policy fails closed.
- Offline: feature-by-feature airplane-mode test; bundled library names do not prove offline capability.

## 6. Immediate blockers

- Exact Instructions 17.7.2 APK is not present in the analyzed set. Obtain it from the device or existing local APK archive.
- JADX and apksigner are not installed in the workstation environment used for the 26-APK inventory. Install pinned tools or run analysis on a dedicated workstation.
- PR #1 source review: RoleManager.ROLE_ASSISTANT request and active-service status checks are present. See PR1_NATIVE_ASSISTANT_SOURCE_VERIFICATION_2026-11-22.md; CI run #45039077226 is static/source-contract only, not Gradle or device validation.
- APK bytes are not in GitHub and are intentionally not committed. A remote agent without access to the local workstation cannot perform true DEX decompilation.
- Keep the research PR description consistent: local APKs were acquired and structurally inspected; full JADX and runtime analysis remain outstanding.

## 7. Status

PARTIAL — 26 APK structural inventory completed; method-level decompilation, exact Instructions 17.7.2 analysis, runtime tests and OGAM implementation are not completed by this research step.
