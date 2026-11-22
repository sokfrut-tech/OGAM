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

## Acquisition status — unchanged

The catalog pages are directly accessible, but the actual binary download control is dynamically rendered and no APK byte stream has been retrieved into the analysis workspace in this pass. No APK has been hashed, signature-verified, opened as ZIP, decoded, decompiled or executed. No binary-derived code findings are claimed.

## Next acquisition paths

1. Prefer owner-authorized read-only extraction from the target device because it guarantees the exact installed build. On a computer with ADB:
   - `adb shell pm path com.heytap.speechassist`
   - `adb shell pm path com.oplus.aimemory`
   - `adb shell pm path com.coloros.shortcuts`
   - Pull every returned `base.apk` and split path with `adb pull`; do not assume a single APK.
2. If using AppShare, resolve the actual historical-version download action and preserve original filename, source URL and retrieval timestamp. Do not install it.
3. For every acquired artifact, compute SHA-256, inspect ZIP integrity, verify APK signer with apksigner, record package/version/minSdk/targetSdk/ABI/splits, then decode manifest/resources/DEX in an isolated workspace.
4. Compare APKMirror's catalog hashes only after acquisition; never accept a hash match without locally calculating it.

## Security and legal boundary

- No APK installed on the user's phone.
- No bypass of account authentication, OEM signature permissions, DRM, encryption or server authorization.
- No extraction or disclosure of personal memory contents, credentials or tokens.
- No proprietary code/assets copied into OGAM; implement independent equivalents using public APIs.
- Treat catalog descriptions as unverified claims until confirmed in the binary or on a test device.
