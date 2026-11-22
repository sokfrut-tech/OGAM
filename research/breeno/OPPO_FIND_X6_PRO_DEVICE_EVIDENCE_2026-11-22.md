# OPPO Find X6 Pro — Device Evidence: Breeno 13.4.3 and Memory 16.11.5

Date recorded: 2026-11-22
Evidence: six user-supplied ColorOS screenshots from the target OPPO device.
Device family from prior project context: OPPO Find X6 Pro / likely PGEM10. Exact build fingerprint and ColorOS version are not visible in these screenshots.

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

Not confirmed:
- Exact ColorOS version currently installed. A ColorOS 16 promotional image is not proof the device itself runs ColorOS 16.
- Android API level, firmware build fingerprint, security patch.
- Breeno and Memory package names, versionCodes, signer certificates, APK hashes.
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

## 5. Next device evidence needed

Do not ask the user to extract APKs yet. First obtain:
- Settings > About device screenshot showing model, ColorOS version and build number.
- Android version/security patch if not included.
- Breeno app permissions page, then Breeno Memory permissions page (only if needed for permission mapping).
- If the user can later provide ADB output, collect package/versionCode/signer metadata read-only; no system modification.

## 6. Evidence handling

This is a screenshot-derived device observation. It is not a reverse-engineering result. No APK was downloaded, decompiled, modified or installed. No OPPO proprietary code/assets were copied. Do not infer package names or private service contracts from app display names.
