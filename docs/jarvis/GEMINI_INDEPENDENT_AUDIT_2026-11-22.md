# Gemini independent audit — OGAM / Breeno / native assistant

- Date: 2026-11-22 UTC
- Task ID: `OGAM-BREENO-DEX-AUDIT-2026-11-22`
- Reviewer: Gemini (Antigravity)
- Status: completed_with_findings
- Original report: https://github.com/sokfrut-tech/Universal-AI-Factory/blob/main/coordination/gemini/outbox/REPORT_2026-11-22_OGAM_breeno_dex_audit.md
- Acceptance: https://github.com/sokfrut-tech/Universal-AI-Factory/blob/main/coordination/gemini/outbox/ACCEPTED_2026-11-22_OGAM_breeno_dex_audit.md
- Reviewed OGAM PR #2 at `a5d5c71d`; PR #1 at `8ad6a6fd` (merge `b7c06988`); CI run `#45045542937` success (17 Node suites / 68 local cases).
- Gemini's report is the authoritative full issue list; this file preserves the actionable summary in OGAM's own handoff.

## Key conclusion

The independent review is substantive and confirms that the 26-APK inventory and Markdown/JSON metrics agree, while maintaining the correct boundary: no JADX method decompilation, full-body apksigner verification, Gradle/Kotlin/JUnit run or PGEM10 runtime test was performed. The report does not claim to have reverse-engineered method behaviour. Gemini says APKs and extracted static artifacts are present on the owner's Windows workstation, but JADX/JDK/apksigner/aapt2/apktool/adb are not installed there.

## PR #2 research-document corrections proposed

- A1 MEDIUM: SearchService build metadata was incorrectly presented as a phone screenshot build; it is only a local APK filename/manifest match. Instructions 17.7.2 screenshot evidence should cite the Instructions permissions/device evidence document, not the general device evidence file.
- A2 MEDIUM: package grouping and signing-certificate cluster counts are internally inconsistent. Gemini recommends moving `reactivephone.msearch` to third-party/companion, deciding the HeyTap Browser/Reader grouping explicitly, and reconciling the counts (21 OPPO/Oplus/ColorOS/HeyTap/SystemUI family entries, or 19 excluding Browser/Reader; four signer groupings are listed, not two).
- A3 MEDIUM: `com.oplus.aiunit` has 201 non-exported `:worker0..200` processes, but the inspected manifest has `isolatedProcess=false` for all 201. Do not call these Android isolated sandboxes; use worker processes / app-UID process isolation.
- A4 MEDIUM: add epistemic labels where manifest, DEX identifiers, native-library filenames, provider URIs and host strings are being used to infer runtime behaviour. Keep runtime claims marked inferred pending JADX method tracing and device/offline traces. Normalize compressed APK sizes vs uncompressed library sizes and distinguish MB/MiB.
- A5 LOW-MEDIUM: remove stale device-evidence statements contradicted by later screenshots; update PR #1 commit and CI run references from superseded `45039077226` to reviewed `8ad6a6fd` / `45045542937`.

## PR #1 source findings — must be triaged before build/device claims

- B1 HIGH — `JarvisAssistantRoleModule.kt`: possible React Native 0.83.1 `BaseActivityEventListener.onActivityResult` nullable/non-null signature mismatch; `currentActivity` access differs from other modules. Must compile against exact RN 0.83.1 artifacts; do not assume compile failure without build proof.
- B2 HIGH — `JarvisVoiceInteractionSession.kt`: assistant session launches bridge activity without explicit `FLAG_ACTIVITY_NEW_TASK`. Confirm against Android API behaviour and test invocation from the session process; add if required.
- B3 HIGH — `jarvis_voice_interaction.xml`: hard-coded recognitionService component/package string may be invalid or fail with debug `.dev` applicationId. Validate against AOSP parser and both debug/release manifest packages; do not change blindly without source/API verification.
- B4 MEDIUM-HIGH — `MainActivity.kt` and launch guard: assistant URI matching is exact-case and exact-path, while exported MainActivity can receive external intents. Test uppercase scheme/host, trailing slash, query, encoded path and initial/new-intent cases to prove whether React Navigation can reach the voice route without a bridge token. Also add bounded TTL/cleanup to the pending token if stale-token window is confirmed.
- B5 MEDIUM — session service lacks the API<31 enabled gate used by the main service; ColorOS 16 BAL/lock-screen/background restrictions have not been tested; PCM player uses MEDIA attributes and 100µs backoff; wide manifest permissions need per-feature justification and denial tests.

## Evidence and interpretation

Gemini independently read the PR #1 source and listed exact files, symbols, tests and commits. The report's B1–B5 are reviewer findings, not yet reproduced defects. B1/B2/B3 require actual build/platform verification; B4 is a security-sensitive hypothesis that deserves immediate adversarial intent tests; B5 contains both code observations and device test gaps. Do not patch runtime code solely from an unverified assertion.

Gemini confirms:
- 3 Kotlin test files / 16 test cases exist in source (3 launch guard + 5 role snapshot + 8 PCM player), but were not run under Gradle.
- CI run `#45045542937` is Node/static contract evidence (17 suites / 68 local cases), not Android compilation or runtime proof.
- Android system-assistant source exists for API 31+; this is not equivalent to a working default assistant on OPPO.
- The inspected Instructions APK is 17.2.4; installed 17.7.2 remains unavailable in the local 26-APK set.
- No JADX, apksigner, aapt2, apktool, adb or Java/JDK was installed at the reviewed workstation. The exact local APKs and prior static extraction artifacts were available read-only.

## Prioritized next actions

1. P0: add tests for forged/malformed assistant intents and ensure every URI that can reach the React Navigation assistant route is token-gated. Validate cold start and onNewIntent separately.
2. P0: install pinned JDK/JADX/build-tools and verify Kotlin compile + manifest merge. Resolve B1/B2/B3 only from exact toolchain/platform evidence.
3. P1: gate both VoiceInteractionService and VoiceInteractionSessionService consistently below API 31; test RoleManager, lock screen, BAL, process death, background restrictions and permission denial on PGEM10.
4. P1: revise PR #2 documentation for A1–A5, retaining manifest/structural/method/runtime evidence separation.
5. P1: pull exact installed `com.coloros.shortcuts` 17.7.2 from PGEM10; hash and certificate-check, then JADX only in an out-of-repository scratch directory.
6. Continue the clean-room OGAM transfer plan after assistant security/build blockers are resolved. No proprietary OPPO code/assets are to be copied.



## B4 follow-up — reproduced at source level and mitigated in OGAM (2026-11-22)

This follow-up supersedes the B4 wording above that called it only an unverified hypothesis.

- OGAM's lockfile pins the actual resolved packages to `@react-navigation/native 7.5.1` and `@react-navigation/core 7.24.0`. Their corresponding source at upstream revision `379552a` confirms that URL extraction collapses repeated slashes, while the core path parser accepts a final slash and percent-encoded static path characters.
- The former native matcher required `Uri.path == "/voice"`. That did not match the native path `/voice/` from `offgrid://assistant/voice/?startVoice=1`, although the JS router resolves it to the configured `assistant/voice` Chat route. This confirms the exact normalizer mismatch from primary source; the external-intent flow has not been executed on a device.
- OGAM now uses `JarvisAssistantLaunchGuard.matchesAssistantVoiceRoute(intent.dataString)` in MainActivity before forwarding ACTION_VIEW intents to React Native. The matcher normalizes slash variants and percent-encoded unreserved static characters, then the existing one-use in-process token remains mandatory.
- Added JUnit vectors for canonical, trailing/repeated slash, single-/triple-slash prefix, encoded route characters, and unrelated links. Added Node source-contract coverage to keep native wiring and test vectors present.
- Commits on `feature/jarvis-step-2-storage-privacy`: `72abc73c` (matcher), `557a8d27` (MainActivity), `d60a3e14` (JUnit), `681aea5e` (Node contract), followed by handoff documentation commit `87ca14a3`.
- GitHub Actions run [#45047342804](https://github.com/sokfrut-tech/OGAM/actions/runs/45047342804) passed the open-core Node contract job, including `Verify Android Jarvis assistant contract`.

**Still not proven:** Android/Kotlin compilation, Gradle/JUnit execution, actual cold-start/onNewIntent activity tests, and emulator/PGEM10 runtime security. The next required evidence remains `./gradlew :app:testDebugUnitTest` plus Activity-level intent tests and device checks. B4 is source-level reproduced and code-mitigated, not fully runtime-closed.
