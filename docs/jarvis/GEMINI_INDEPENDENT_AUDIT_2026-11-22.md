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


## B1–B3 and B5 source/API triage — 2026-11-22

This section records exact-source/API review after the B4 mitigation. It does not replace required Gradle, manifest-merger, emulator or PGEM10 tests.

### B1 — React Native listener signature: no source-level defect found

- OGAM locks React Native `0.83.1`.
- The official React Native Android native-module documentation demonstrates the Kotlin `BaseActivityEventListener.onActivityResult` override with the same nullable parameter types used by OGAM: `Activity?` and `Intent?`. Therefore Gemini's suspected nullable/non-null override mismatch is not reproduced by the published Kotlin API example.
- OGAM's `currentActivity` access comes from `ReactContextBaseJavaModule.getCurrentActivity()`. It is an available nullable Activity accessor; current React Native changelog treats the API as deprecated/clarifies deprecation, not removed. The existing null check is correct for the documented API shape.
- No speculative signature patch was applied. A real compile against the pinned artifacts remains mandatory before marking B1 build-verified.

Reference: [React Native Android native-module docs — getting Activity results](https://reactnative.dev/docs/legacy/native-modules-android#getting-activity-result-from-startactivityforresult).

### B2 — explicit NEW_TASK flag: not required by these VoiceInteractionSession APIs

- OGAM calls `startAssistantActivity(launchIntent)` on API 26+ and `startVoiceActivity(launchIntent)` on its fallback branch.
- Android's public API reference explicitly states both methods create a new task and set `Intent.FLAG_ACTIVITY_NEW_TASK` automatically. Adding the flag manually is therefore unnecessary for the API contract and may only duplicate platform behaviour.
- The currently configured system assistant is enabled only API 31+, so the legacy branch is defensive rather than the PGEM10 execution path.
- No code change was applied. ColorOS 16 task/lock-screen/background activity-launch behaviour still requires device validation.

Reference: [Android VoiceInteractionSession API — startAssistantActivity and startVoiceActivity](https://developer.android.com/reference/android/service/voice/VoiceInteractionSession#startAssistantActivity(android.content.Intent)).

### B3 — recognitionService metadata and debug applicationId: conditionally safe, with a documented limitation

- The locked Android manifest uses a non-empty `android:recognitionService` string. AOSP's `VoiceInteractionService` attribute definition says the field must be non-empty; on Android 12+ it does nothing. On Android 11 and earlier it must reference a valid `RecognitionService`.
- OGAM's `jarvis_voice_interaction_enabled` is false in `res/values/bools.xml` and true in `res/values-v31/bools.xml`. Thus the current assistant entry point is deliberately unavailable below API 31, and the metadata's placeholder component value is not used by the supported Android 12+ implementation. The debug `.dev` applicationId suffix is not a runtime component-validation failure on API 31+ because AOSP documents the attribute as unused there.
- A legacy RecognitionService has not been implemented. Do not enable the system-assistant entry point below API 31 until OGAM adds a real RecognitionService adapter and changes this metadata to its actual component.
- The AndroidX/AOSP API contract source is strong enough to reject the claim that a wrong component value alone breaks API 31+, but debug/release manifest and device behaviour still need build/runtime verification.

Reference: [AOSP VoiceInteractionService attributes](https://android.googlesource.com/platform/frameworks/base/+/4fd8e1246d9b503f602412021df52e87e418ed1c/core/res/res/values/attrs.xml#8628).

### B5 — service gate consistency fixed in source

- The main `JarvisVoiceInteractionService` already used `android:enabled="@bool/jarvis_voice_interaction_enabled"`.
- The companion `JarvisVoiceInteractionSessionService` did not. The manifest now applies the same gate to it, so both components are disabled below API 31 and enabled together on API 31+.
- The Node source-contract suite now asserts the gate on both services and the true/false resource values.
- Remaining B5 work is runtime-only: PGEM10/ColorOS 16 background activity launch, lock screen, service process death/restart, permission denial, audio focus and PCM playback. Broad manifest permission justification is still open.

### Commits from this triage

- Session service API gate: `a781a873ad1f99c03ba6b3e66578f1b6ba75c2ad`.
- Node contract assertion for both service gates: `9c6863aea09aa66cbc3ed7147dd714098f11f6a1`.

### Verification status

- B4: React Navigation normalization mismatch confirmed from locked-version source and source-level mitigated; Activity-level and device tests still pending.
- B1: no signature incompatibility found in public RN Kotlin API example; exact Gradle compile pending.
- B2: no missing-NEW_TASK defect; Android API sets it automatically; device BAL behaviour pending.
- B3: no API31+ parser/component-validation defect; legacy API<31 support intentionally disabled until a real RecognitionService exists.
- B5: source-level API gate now aligned; Gradle/manifest merge and device lifecycle checks pending.
- The changes above are not merge/release approval. PR #1 remains draft until complete Android verification.


## B1 — exact Gradle compile failure reproduced; corrective patch committed (2026-11-22)

This addendum supersedes the earlier source-only triage paragraph that said no B1 signature defect had been reproduced. The pinned Android build is now the controlling evidence.

### Reproduced failures on the prior PR #1 head

GitHub Actions `CI` run [#45047788945](https://github.com/sokfrut-tech/OGAM/actions/runs/45047788945), tested against commit `df3fdb3fb5113bb9999f40448a443a5cf8d2b56d`, completed the Android setup and reached Gradle task `:app:compileDebugKotlin`. The task failed with these compiler diagnostics:

- `JarvisAssistantRoleModule.kt:35`: `onActivityResult` “overrides nothing”; the compiled React Native interface expected a non-null `Activity` argument (and nullable `Intent?`), while OGAM declared `Activity?`.
- `JarvisAssistantRoleModule.kt:93`: Kotlin could not resolve the synthetic `currentActivity` property from this RN base class.
- `JarvisAssistantRoleModule.kt:117`: `startActivityForResult` became unresolved downstream of the unresolved Activity value.
- `JarvisPcmStreamPlayer.kt:305`: `AudioTrack.setVolume(Float)` returns `Int`, which did not satisfy OGAM's `JarvisPcmTrack.setVolume(Float): Unit` interface.

### Corrective source changes

- `JarvisAssistantRoleModule.onActivityResult` now matches the compiler's resolved API: `activity: Activity`, `data: Intent?`.
- The module retrieves the Activity with explicit `getCurrentActivity()` rather than relying on the unresolved Kotlin synthetic property. The existing null guard remains; the returned Activity is not retained beyond the request.
- The activity's `startActivityForResult` is called on the resolved Activity instance.
- `AndroidJarvisPcmTrack.setVolume` now uses a block body and intentionally returns `Unit` after delegating to AudioTrack.

Commits:
- Role module fix: `53ef299f378a4c070c10a36879dd63cc50cab42b`.
- PCM player fix: `20650c137cb1fe3f66de450d8d1d706a28f2e18f`.

### Fresh verification status

- External dependency/source-contract audit run [#45048605892](https://github.com/sokfrut-tech/OGAM/actions/runs/45048605892) passed on head `20650c137cb1fe3f66de450d8d1d706a28f2e18f`.
- Full CI run [#45048605797](https://github.com/sokfrut-tech/OGAM/actions/runs/45048605797) was queued/pending immediately after the patch; it must be allowed to report the Gradle result. Do not describe the compiler fixes as verified until its Android job finishes.
- On the preceding head, the Android compile stopped before Kotlin/JUnit execution; the 20 current Kotlin test cases (7 launch guard, 5 role snapshot, 8 PCM player) have not yet been proven to run.
- The same preceding full CI run also had unrelated, already-known JS workspace migration failures: unresolved `@offgrid/models`, `@offgrid/sync`, `@offgrid/rag` imports and inaccessible private `pro/*` test modules; the lint/type/architecture job likewise reported missing workspace modules and downstream type errors. These require completion of the OGAM package migration and test-boundary work; they are not evidence that the native assistant tests passed or failed.
- PR #1 remains draft/unmerged. Manifest merge, APK assembly, instrumentation testing, emulator testing and PGEM10 runtime behavior remain outstanding.


## Latest CI result — Gradle dependency rate limit, Kotlin patch not yet recompiled (2026-11-22)

- Latest full CI run [#45049107228](https://github.com/sokfrut-tech/OGAM/actions/runs/45049107228), head `95682ccb2246eb9a2a2cea4521eb137498f43771`, finished with failure.
- Android job reached the Gradle setup/run step but failed resolving `com.google.code.gson:gson:2.9.1`, a transitive dependency of `org.gradle.toolchains:foojay-resolver:0.5.0`. Maven Central returned HTTP `429 Too Many Requests` for `https://repo.maven.apache.org/maven2/com/google/code/gson/gson/2.9.1/gson-2.9.1.pom`. The Gradle Plugin Portal fallback resolved to the same Maven Central URL and was rate-limited too.
- No `:app:compileDebugKotlin` task began and no Kotlin diagnostics were produced on this latest head. Therefore this run neither validates nor falsifies the corrective patches to `JarvisAssistantRoleModule.kt` and `JarvisPcmStreamPlayer.kt`.
- The previous actual compiler diagnostics were on head `df3fdb3`: wrong RN callback signature, unresolved synthetic `currentActivity`, and PCM `setVolume` return-type mismatch. Source fixes were committed as `53ef299f` and `20650c13`.
- External source-contract audit [#45049107229](https://github.com/sokfrut-tech/OGAM/actions/runs/45049107229) succeeded on latest head `95682ccb`. It does not compile Kotlin.
- Full CI's JavaScript lint/type/Jest gates remain red because the ongoing standalone migration still leaves `@offgrid/models`, `@offgrid/sync`, and `@offgrid/rag` consumers unresolved in this branch, as well as test imports from private `pro/*` paths that are not present in the checkout. Continue the exact package-slice migration and test-boundary cleanup rather than masking these imports.
- Required next step: repeat the Android Gradle run after the external Maven rate limit clears, preferably with a populated Gradle dependency cache. The successful build must show `:app:compileDebugKotlin`, `:app:testDebugUnitTest`, and Android manifest merge results on the same commit. Then proceed to APK assembly and instrumentation/PGEM10 testing.

## Android compile confirmation on `a65dbca1` and test-fake JVM signature fix (2026-11-22)

- Inspection of `CI` run [#45052196801](https://github.com/sokfrut-tech/OGAM/actions/runs/45052196801) (`a65dbca1`, job `137300347889`) confirmed `:app:processDebugMainManifest`, `:app:processDebugManifest`, `:app:processDebugResources`, **`:app:compileDebugKotlin`** (validating main-source fixes `53ef299f` & `20650c13`), and `:app:compileDebugJavaWithJavac` all completed successfully.
- `:app:compileDebugUnitTestKotlin` then caught a Kotlin/JVM platform declaration clash in `android/app/src/test/java/ai/offgridmobile/voice/JarvisPcmStreamPlayerTest.kt` (`FakeTrack` property `var volume = 1f` and `override fun setVolume(volume: Float)` shared JVM signature `setVolume(F)V`).
- Renamed `FakeTrack.volume` → `FakeTrack.currentVolume` while keeping all 8 `@Test` signatures intact; re-execution of `:app:testDebugUnitTest` awaits the next CI push.

