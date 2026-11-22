# OPPO / Breeno APK acquisition and static-analysis plan

Date: 2026-11-22
Target device: OPPO Find X6 Pro / PGEM10 / ColorOS 16.0.5 / Android 16.
Purpose: obtain exact or closest verifiable public APK artifacts for offline static analysis. Do not install them on the user's phone.

## 1. Candidate artifacts and source evidence

| Component | Device-observed version | Public listing candidate | Package / versionCode | Reported size / ABI | Status |
|---|---|---|---|---|---|
| Breeno / 小布助手 | 13.4.3_08c04e4_261110 | AppShare (sharess.cn) | com.heytap.speechassist / 130403 | 124.77 MB / arm64-v8a | Version and package match; build suffix not independently matched |
| Breeno Memory / 小布记忆 | 16.11.5_008719b_260901 | AppShare + APKMirror | com.oplus.aimemory / 16011005 | 60.69 MB / arm64-v8a | Version, package and versionCode candidate match; build suffix not independently matched |
| Breeno Instructions / 小布指令 | 17.7.2_91aa93e_261102 | AppShare | com.coloros.shortcuts / 17007002 | 13.27 MB / arm64-v8a | Version candidate; exact device build suffix not independently matched |

Sources:
- Breeno AppShare listing: https://sharess.cn/page/app/detail?id=2aj8ABv8Akt9KwjiVt6rkxktdOoy3VJ0lY8rYsiMOZ1Yyg%3D%3D
- Breeno Memory AppShare listing: https://sharess.app/page/app/detail?id=tJjVUuZ_nf6PJt622PJG-2hOR1Z0DDqOkw7vhfy1Ztc3Sg%3D%3D
- Breeno Memory APKMirror listing: https://www.apkmirror.com/apk/oneplus-ltd/breeno-memory/breeno-memory-16-11-5-release/
- Breeno Instructions AppShare listing: https://sharess.cn/page/app/detail?id=__gFZsXbXO7KeaamrgfZ5LodDeoyQXewp20CboWJZaqW

Search evidence:
- AppShare reports Breeno 13.4.3, versionCode 130403, 124.77 MB, arm64-v8a and package com.heytap.speechassist.
- AppShare reports Instructions 17.7.2, versionCode 17007002, 13.27 MB, arm64-v8a and package com.coloros.shortcuts.
- AppShare reports Memory 16.11.5, versionCode 16011005, 60.69 MB, arm64-v8a.
- APKMirror reports Memory package com.oplus.aimemory, min API 35, target API 36, arm64-v8a, 45 permissions, and signer SHA-256 b0a9bbfc05eee5e7d0a2c97c030586e15bb3301152078f54473bb82df6d8c818. This is third-party catalog metadata, not a verified local artifact.

## 2. Acquisition status and limitation

Public listing pages are discoverable, but a direct binary download was not completed in this research session: the available page fetch/download route failed before returning APK bytes. Therefore:
- No APK has yet been acquired into the analysis workspace.
- No APK hash, signature, manifest, DEX, resource or native-library inspection has yet been performed for these target builds.
- Do not claim source-level findings from these binaries until the exact artifacts are locally available and analyzed.

## 3. Exact-build matching gate

The version labels visible on the user's phone include build suffixes:
- Breeno 13.4.3_08c04e4_261110
- Memory 16.11.5_008719b_260901
- Instructions 17.7.2_91aa93e_261102

Public listings generally expose versionName/versionCode, not necessarily these internal build suffixes. On acquisition:
1. Record source URL, acquisition timestamp and original filename.
2. Calculate SHA-256 locally.
3. Verify APK signing certificate with apksigner or equivalent.
4. Extract package name, versionName, versionCode, minSdk, targetSdk, ABI and split/base structure.
5. Compare extracted package/version/signature metadata with any available on-device read-only package metadata.
6. Treat any mismatch as a related reference build, not the exact installed artifact.

## 4. Static analysis sequence

For each APK, use an isolated analysis workspace; never install on the user's daily device:
1. File type, ZIP integrity, SHA-256 and signing certificate.
2. AndroidManifest.xml: permissions, exported activities/services/receivers/providers, intent filters, metadata, shared UID, foreground service types, queries, network security config.
3. DEX inventory and JADX decompilation: package/class map, entry points, dispatch paths, Binder/AIDL interfaces, reflection, WebView/JS bridges, network clients, model loading, persistence.
4. Resources: strings, layouts, navigation, assets, protobuf/JSON schemas, service/action identifiers.
5. Native libraries: ABI, JNI entry points, imported symbols, bundled models/engines; do not execute extracted binaries.
6. Cross-app graph: explicit intents, content providers, signature permissions, Binder service bindings, broadcasts, deep links, shared storage and account dependencies.
7. Network review: endpoints/domains/certificate pinning/configuration only; do not intercept personal account traffic or access user data.
8. Produce evidence-backed component map, capability map, security/privacy findings and OGAM reimplementation brief.

## 5. Legal and safety boundary

- Treat APKs as proprietary binaries for interoperability/security research; do not copy OPPO source/assets into OGAM.
- Reimplement behavior independently using public Android APIs and original code.
- Do not bypass account access controls, signature permissions, DRM, encryption or service authentication.
- Do not run extracted code or install unknown APKs on the user's phone.
- Do not harvest private data, tokens, credentials or personal memory contents.
- Check distribution terms and local law before redistribution; analysis does not grant redistribution rights.

## 6. Priority questions the binary audit must answer

### Breeno
- Which exported/native components handle assistant entry, voice session, summon and request dispatch?
- Which services and permissions are privileged vs ordinary?
- How is streaming response, cancellation and TTS coordinated?
- How does screen context enter the request path?
- Which dependencies are cloud-only vs locally executed?

### Breeno Memory
- What local databases/files and schemas are used?
- Which APIs connect memory to Breeno and system apps?
- Is memory processing local, cloud, or hybrid according to code/config evidence?
- What data categories, retention/deletion/export interfaces and account boundaries exist?
- Which services/receivers/providers expose integration surfaces?

### Breeno Instructions
- How are trigger conditions represented?
- Which action types are built in and which are supplied by system providers?
- How are actions executed (intents, providers, Binder, accessibility, privileged framework)?
- Is there a plugin/action registry and versioned schema?
- What permission and confirmation gates protect consequential actions?

## 7. Next step

Acquire the three APK binaries from the candidate Chinese listings (or obtain exact installed APK copies via owner-authorized read-only extraction). Once bytes are available, begin with metadata/signature/manifest inspection before DEX decompilation. Do not ask the user for more permission screenshots unless binary metadata cannot answer a specific question.
