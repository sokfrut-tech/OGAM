# OPPO Find X6 Pro — Device Evidence: Breeno 13.4.3 and Memory 16.11.5

Date recorded: 2026-11-22
Evidence: six user-supplied ColorOS screenshots from the target OPPO device.
Device: OPPO Find X6 Pro, model code PGEM10. A later user-supplied system-version screenshot confirms ColorOS 16.0.5, build PGEM10_16.0.5.1201(CN01C20P01), Android 16, firmware Q_V1_P14,Q_V1_P14, SOTA C20P01(BRA1CN01), kernel 5.15.180-android13-8-o-01179-g408877dae2c9, Android security update 1 August 2026. The exact build fingerprint (the full ro.build.fingerprint string) remains unknown.

## 1. Installed app versions visible in Settings

### Breeno
- Display name: Breeno
- Version string: 13.4.3_08c04e4_261110
- Settings page shows app storage usage: 622 MB
- Notifications: denied
- App can be opened and force-stopped; Disable control appears unavailable/greyed out.
- Package name, versionCode, signer, permissions list and APK hash are not shown.

### Breeno Memory
- Display name: Breeno Memory
- Version string: 16.11.5_008719b_260901
- Settings page shows app storage usage: 142 MB
- Notifications: allowed
- App can be opened and force-stopped; Disable control appears unavailable/greyed out.
- Package name, versionCode, signer, permissions list and APK hash are not shown.

These are the actual versions shown on the user's device and supersede the previously discussed 13.3.2 catalog assumption for this device. Catalog listings are not a substitute for these device observations.

## 2. OPPO AI feature surfaces visible in the screenshots

The OPPO AI landing page shows:
- Breeno — “Ask anything, anytime” (Russian UI translation shown as “Спрашивайте что угодно и когда угодно”).
- Breeno Memory — organize/manage fragmented information.
- Breeno Quick Search — recognizes content on the screen and suggests corresponding services.
- Breeno Recommendations — personalized service recommendations.

The “Other AI functions” page shows:
- AI Search.
- AI Writer.
- AI Translation.
- AI Voice Transcription (record, summarize and translate).
- AI Automation (“free your hands with AI”).

The “Personalized information and services” section describes managing personal data and data created in apps.
The “AI service module” section describes providing updates and working services for connected AI algorithm modules.
A separate Chinese “popular tips” page shows the OPPO AI slogan “AI一键闪记 / 啥都能记” (one-tap AI flash memory; remember anything) and a ColorOS 16 promotional visual.

## 3. What this proves — and what it does not

Confirmed by screenshots:
- The target device has Breeno 13.4.3_08c04e4_261110 installed.
- The target device has a separately installed Breeno Memory 16.11.5_008719b_260901 app.
- The visible OPPO AI surfaces advertise the feature families listed above.

Not established by the app-info/feature screenshots in Sections 1–2 alone:
- Breeno and Memory package names, versionCodes, signer certificates and APK hashes. Those fields are not shown in the app-info screenshots.
- The exact numeric Android SDK/API level and full `ro.build.fingerprint`; the Android release, firmware/build number and security patch are confirmed separately in Section 7.
- Whether the advertised features are enabled, available in this user's region/account/language, or fully functional on this particular build.
- Whether the features are enabled, available in the user's region/account/language, or fully functional on this particular build.
- Internal APIs, Binder/AIDL contracts, service permissions, or the way screen content is captured.
- Whether Breeno Memory stores data locally, in a cloud account, or both.

## 4. OGAM architecture implications

Update compatibility baseline:
- Do not use Breeno 13.3.2 as the target profile. The first device-specific compatibility profile must target exact version string 13.4.3_08c04e4_261110.
- Treat Breeno Memory as a separate companion app and integration surface, not as a feature guaranteed to be inside the Breeno package.
- Keep optional adapter profiles separate for Breeno core, Breeno Memory, Quick Search, Recommendations and AI service modules.
- Prefer public Android Assist/RoleManager APIs and OGAM-owned memory/services. Never make Jarvis dependent on Breeno being installed or enabled.
- Treat OPPO AI screens as feature discovery evidence, not proof of accessible APIs. Research package metadata and exported components before proposing an integration.
- Reimplement equivalent user-facing capabilities in OGAM with independent storage, model routing and permissions; use OEM integration only as optional enhancement.

Suggested OGAM capability mapping:
1. Conversational assistant — native VoiceInteractionService + existing OGAM model/tool runtime.
2. Personal memory — OGAM-owned typed, consented memory store with import/export and deletion controls.
3. Screen quick search — user-triggered, short-lived Assist snapshot + OCR/Accessibility semantic tree; no password fields and no default persistence.
4. Recommendations — local context/rules first, optional model reasoning, explainable reasons and opt-out.
5. AI search/writer/translation/transcription — independent OGAM tools using selectable local models and explicit network fallback.
6. AI automation — capability registry, preview/confirmation for consequential actions, execute-and-verify.
7. AI service modules — signed/versioned model and skill manifests, compatibility checks, least-privilege capabilities and rollback.

## 5. Remaining device evidence needed

The model, ColorOS release/build number, Android release and security patch are already confirmed in Section 7; do not request those screenshots again.

Remaining optional evidence, only when a later implementation decision depends on it:
- Full `ro.build.fingerprint` and exact numeric SDK level (read-only `getprop` output).
- Read-only package metadata for Breeno and Breeno Memory (package name, versionCode, installed signer digest and installed APK hash) if exact binary-to-device identity is required.
- Separate Breeno and Breeno Memory permission/special-access screenshots if a specific capability mapping requires them.
- No system modification, root, or private OEM API access is required for these evidence items.

## 6. Evidence handling

This is a screenshot-derived device observation. It is not a reverse-engineering result. No APK was downloaded, decompiled, modified or installed. No OPPO proprietary code/assets were copied. Do not infer package names or private service contracts from app display names.


## 7. Confirmed system build — second screenshot set

A separate user-supplied Settings > Version screenshot confirms:
- Version number: PGEM10_16.0.5.1201(CN01C20P01)
- Firmware version: Q_V1_P14,Q_V1_P14
- Kernel: 5.15.180-android13-8-o-01179-g408877dae2c9
- SOTA: C20P01(BRA1CN01)
- Android version: 16
- Android security update: 1 August 2026

This resolves the earlier uncertainty: the Settings version screenshot confirms the installed ColorOS 16.0.5 build, Android 16 release, firmware, kernel and 1 August 2026 security update. The full `ro.build.fingerprint` and the exact numeric SDK level were not visible in the supplied screenshot and remain unverified.

## 8. Updated compatibility implications

- Primary device target is now exact PGEM10 / ColorOS 16.0.5 / build 16.0.5.1201(CN01C20P01) / Android 16.
- Breeno adapter research must target this build family and Breeno 13.4.3_08c04e4_261110, not generic ColorOS 16 or older 13.3.x profiles.
- Breeno Memory must be treated as a distinct app at 16.11.5_008719b_260901.
- Existing projects that target Android 14+ or ColorOS 16 may now be more relevant for architecture comparison, but compatibility still requires checking SDK/ABI and actual service/permission behavior on PGEM10.
- Do not extrapolate Eta's minSdk/targetSdk/LSPosed behavior into a claim that its hooks work on this build.
