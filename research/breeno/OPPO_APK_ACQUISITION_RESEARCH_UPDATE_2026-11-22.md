# APK Acquisition Research Update — AppShare and APKMirror

Date: 2026-11-22
Target: OPPO Find X6 Pro / PGEM10 / ColorOS 16.0.5 / Android 16.
Branch: docs/research-breeno-coloros-2026-11-22

## New primary-source observations

The AppShare historical-version pages were opened directly, not inferred from search snippets.

### Breeno / 小布助手
- Package: com.heytap.speechassist
- Listed version: 13.4.3
- Listed versionCode: 130403
- Listed size: 124.77 MB
- ABI: arm64-v8a
- AppShare describes the version as a formal release and says that a no-native-library variant can fail to generate conversations.
- AppShare listing: https://sharess.app/page/app/detail?id=VDv9ClSv0mL6DaTUZl4oPL-tz_lznKZqukvFAG38TDciZQ%3D%3D
- Historical page states the release update includes improvements to image-question answering, voice variants/headphone wake, trip planning and task organization, but says those functions were open only on some ColorOS 17 models at that time. This is catalog release-note text, not proof those features work on PGEM10 / ColorOS 16.0.5.

### Breeno Memory / 小布记忆
- Package: com.oplus.aimemory
- Listed version: 16.11.5
- Listed versionCode: 16011005
- Listed size: 60.69 MB
- ABI: arm64-v8a
- AppShare page describes flash capture via shortcut or three-finger swipe, extraction of schedule/todo/contact information, AI summaries/tags, search, smart collections and collection-based Q&A (the listing mentions DeepSeek-R1). Treat as advertised product behavior, not binary-verified implementation.
- AppShare listing: https://sharess.app/page/app/detail?id=zp7W_Jk5T33y8QW660v5frFxKd9a6mxmOz2Veip-JkREmg%3D%3D
- APKMirror independently lists the same package/version, 60.69 MB, arm64-v8a, min API 35 / target API 36, 45 permissions and 4 libraries.
- APKMirror catalog reports signer certificate SHA-256 fingerprint: b0a9bbfc05eee5e7d0a2c97c030586e15bb3301152078f54473bb82df6d8c818.
- APKMirror reports downloaded-file SHA-256: b9646e41186717bf0d59e6d8815d587f547fa503900978731d670454f9ae3e7e.
- These are third-party catalog values only. They are NOT independently verified against a locally acquired APK and must not be treated as the installed device's signer/hash.
- Sources: https://sharess.app/page/app/detail?id=zp7W_Jk5T33y8QW660v5frFxKd9a6mxmOz2Veip-JkREmg%3D%3D ; https://www.apkmirror.com/apk/oneplus-ltd/breeno-memory/breeno-memory-16-11-5-release/breeno-memory-16-11-5-android-apk-download/

### Breeno Instructions / 小布指令
- Package: com.coloros.shortcuts
- Listed version: 17.7.2
- Listed versionCode: 17007002
- Listed size: 13.27 MB
- ABI: arm64-v8a
- AppShare describes one-tap commands, condition-triggered automation, discovery of commands, user-defined triggers/actions and action chaining.
- AppShare listing: https://sharess.app/page/app/detail?id=s9xIqsBRlOZDiyY_kHYtIUaiIauobPlf0UnVFha5nPfc3g%3D%3D

## Important version/build distinction

The user's Settings screenshots show these installed version strings:
- Breeno: 13.4.3_08c04e4_261110
- Memory: 16.11.5_008719b_260901
- Instructions: 17.7.2_91aa93e_261102

The catalog pages expose public versionName/versionCode, not the internal build suffixes above. The matching versionName/versionCode makes them candidate artifacts, not exact-build matches. Verify package/version/signing certificate/hash from the actual APK and, if possible, read-only package metadata from the target device before calling them exact.

## Acquisition & local static-analysis update (2026-11-22)

Twenty-six owner-supplied local APK files (kept strictly outside version control) were acquired offline and inspected read-only using Python 3.12 + `cryptography` (streaming SHA-256, ZIP entry scan, v1/v2/v3/v3.1 X.509 signing certificates, AXML `AndroidManifest.xml`, native `.so` / asset inventories, and DEX structural tables).

Verified exact-build / catalog matches from the local set:
- `Breeno-13.4.3.apk` (`com.heytap.speechassist`, `versionCode=130403`, SHA-256 `cf547e47328383823caacb28f8abd634260b783453fd93848e98d7d5d79c4940`): manifest metadata records `versionCommit=08c04e4` and `versionDate=261110`, matching screenshot build `13.4.3_08c04e4_261110`.
- `Breeno Memory-16.11.5.apk` (`com.oplus.aimemory`, `versionCode=16011005`, SHA-256 `b9646e41186717bf0d59e6d8815d587f547fa503900978731d670454f9ae3e7e`, v2/v3 cert `b0a9bbfc05eee5e7d0a2c97c030586e15bb3301152078f54473bb82df6d8c818`): matches APKMirror's catalog file hash and signer fingerprint byte-for-byte, and manifest metadata records `versionCommit=008719b` / `versionDate=260901` (`16.11.5_008719b_260901`).
- `Инструкции Breeno-17.2.4.apk` (`com.coloros.shortcuts`, `versionCode=17002004`, SHA-256 `fb26a5990a067156e7c456d956a8586a002f4a41cc77fea7e1cdb6c9beda9304`, metadata `468698a_260701`): valid older reference build; differs from screenshot `17.7.2_91aa93e_261102`.

Additional 23 local APKs also inspected (`Breeno-13.3.2.apk` diff baseline, `com.oplus.aiunit` 16.1.33, `com.oplus.dmp` 16.16.80, `com.oplus.pantanal.ums` 17.22.4 & 17.24.2, `com.coloros.colordirectservice` 16.12.2, `com.coloros.ocrscanner` 16.3.15, `com.coloros.accessibilityassistant` 16.1.40, `com.oplus.aicall` 15.7.3, `com.oplus.aiwriter` 16.0.124, `com.oplus.aiwidgets` 15.0.9, `com.oplus.statistics.rom` 5.9.17.01, `com.oplus.linker` 16.25.6, `com.android.systemui` 16.00.14, `com.heytap.quicksearchbox` 11.64.3.20, `com.opos.ads` 5.5.6, plus 6 companion/third-party APKs).

Full findings and structured metadata deliverables:
- [Offline Static Analysis of 26 Local OPPO / Breeno / ColorOS 16 APKs](OPPO_LOCAL_APK_STATIC_ANALYSIS_2026-11-22.md)
- [Machine-readable 26-APK manifest & native inventory JSON](OPPO_APK_MANIFEST_AND_NATIVE_INVENTORY_2026-11-22.json)

Remaining verification limits:
- Full-body JDK `apksigner` checks and full JADX Java decompilation were not run (JDK/`apksigner`/`jadx` unavailable here).
- Live on-device signer comparison on `PGEM10` (`adb shell pm path ...` / PackageInfo digest) remains optional if exact system-image verification for `SystemUI`/`AIUnit`/`Shortcuts 17.7.2` is later needed.

## Security and legal boundary

- No APK installed on the user's phone.
- No bypass of account authentication, OEM signature permissions, DRM, encryption or server authorization.
- No extraction or disclosure of personal memory contents, credentials or tokens.
- No proprietary code/assets/DEX/secrets copied into OGAM; implement independent equivalents using public APIs.
- Treat catalog descriptions and unexecuted native internals strictly within static-observation bounds.
