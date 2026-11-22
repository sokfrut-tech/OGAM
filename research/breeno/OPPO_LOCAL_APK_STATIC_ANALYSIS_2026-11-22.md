# Offline Static Analysis of 26 Local OPPO / Breeno / ColorOS 16 APKs

Date: 2026-11-22  
Target device context: OPPO Find X6 Pro (`PGEM10`) / ColorOS 16.0.5 (`PGEM10_16.0.5.1201(CN01C20P01)`) / Android 16  
Branch: `docs/research-breeno-coloros-2026-11-22`  
Related plan: [OPPO APK Acquisition and Static Analysis Plan](OPPO_APK_ACQUISITION_AND_STATIC_ANALYSIS_PLAN_2026-11-22.md)  
Machine-readable companion: [OPPO_APK_MANIFEST_AND_NATIVE_INVENTORY_2026-11-22.json](OPPO_APK_MANIFEST_AND_NATIVE_INVENTORY_2026-11-22.json)

---

## 1. Scope, Method & Honesty Boundaries

This document records **offline, read-only static analysis** of **26 owner-supplied local APK files** stored outside the git tree (`c:\Users\user\Desktop\codex\*.apk`).

- **Inspected artifacts & methods (Python 3.12 + `cryptography`):**
  - Streaming SHA-256 and exact byte sizes for all 26 APKs.
  - ZIP container integrity and `classes*.dex`, `lib/`, `assets/`, and `res/xml/` inventories.
  - X.509 signing certificate SHA-256 fingerprints extracted from APK Signature Scheme v2/v3/v3.1 blocks and v1 PKCS#7 blocks (`META-INF/*.RSA|DSA|EC`).
  - Binary `AndroidManifest.xml` (AXML) decoding: package, versionName/versionCode, min/target/compile SDK, `<uses-permission>`, `<permission>`, `<queries>`, `<application>` metadata, and exported/internal activities, services, receivers, and ContentProviders.
  - DEX structural header/table extraction (`class_defs`, package namespaces, AIDL `$Stub` interfaces, `content://` URI strings, `.db` filename strings, HTTPS hostnames, and framework markers) on 19 OPPO/ColorOS/Breeno core-system APKs plus the separately classified third-party `reactivephone.msearch` APK; class/manifest/native inventory was also collected for the 6 other companion/third-party APKs.
- **Evidence interpretation:** Manifest fields prove what an APK declares, not whether a component is actually invoked at runtime. DEX class/package names, AIDL stub names, provider URI strings, database filename strings, hostnames, assets and native-library filenames are structural indicators only; they do not prove a working call path, data flow, cloud use, model execution or user-visible feature. Descriptions below use “suggests”, “consistent with” or “candidate subsystem” where method/call-graph or runtime evidence is absent. Runtime claims require JADX method tracing/call graphs and, where relevant, controlled device traces.
- **Size units:** JSON `apks[].size_bytes` is the exact compressed APK archive length in bytes. JSON `notable_native_libs[].size` is the exact uncompressed ZIP-entry length in bytes for that `.so` file. Human-readable MB values in this report use decimal MB (1 MB = 1,000,000 bytes); do not compare an APK archive size directly with an uncompressed library-entry size. No MiB values are implied unless explicitly labeled MiB.
- **Explicit limitations (not performed / not claimed):**
  - JDK `apksigner` full-body cryptographic signature verification and full JADX Java/Smali decompilation were **not** run because JDK, `apksigner`, `aapt2`, and `jadx` are not installed in this workstation environment.
  - No APK was installed, launched, executed on Android/Find X6 Pro, or dynamically instrumented. No native `.so` binary was executed.
  - No proprietary OPPO code, native binaries, `.dex` files, assets, signing secrets, `AUTH_CODE` blobs, or `API_KEY` strings are copied into this repository.

---

## 2. Exact-Build Verification Gate (Section 3 Check)

Manifest `<meta-data>` embeds `versionCommit` and `versionDate` fields in several local ColorOS/HeyTap APKs. These can be compared with the version strings visible in screenshots, but a screenshot does not prove that the local APK file has the same hash or signer as the installed package. The Breeno and Memory screenshot records are in `OPPO_FIND_X6_PRO_DEVICE_EVIDENCE_2026-11-22.md`; the Instructions 17.7.2 record is separately in `OPPO_BREENO_INSTRUCTIONS_PERMISSIONS_2026-11-22.md`.

| Component | Package | Device screenshot version evidence | Analyzed local APK | Decoded manifest `versionName` (`versionCode`) + `versionCommit_versionDate` | Local APK SHA-256 / extracted cert fingerprints | Evidence conclusion |
|---|---|---|---|---|---|---|
| **Breeno / 小布助手** | `com.heytap.speechassist` | `13.4.3_08c04e4_261110` | `Breeno-13.4.3.apk` | `13.4.3` (`130403`), metadata `commit=08c04e4`, `date=261110` | APK SHA-256 `cf547e47328383823caacb28f8abd634260b783453fd93848e98d7d5d79c4940`; extracted v2 cert `4b9095b0b71b...`, v3.1 cert `a7e23cceb52c...` | Screenshot version string and local APK build metadata match; installed APK hash/signer not independently verified. |
| **Breeno (older reference)** | `com.heytap.speechassist` | No; comparison baseline only | `Breeno-13.3.2.apk` | `13.3.2` (`130302`), metadata `commit=c9e44b3`, `date=260923` | APK SHA-256 `d4df69617da25ba8b87b1ea400d1c5cb32ab6dca3eabf123b46b81d8d5ffeda6`; extracted v2 cert `4b9095b0b71b...` | Older diff baseline only; not the target-device version. |
| **Breeno Memory / 小布记忆** | `com.oplus.aimemory` | `16.11.5_008719b_260901` | `Breeno Memory-16.11.5.apk` | `16.11.5` (`16011005`), metadata `commit=008719b`, `date=260901` | APK SHA-256 `b9646e41186717bf0d59e6d8815d587f547fa503900978731d670454f9ae3e7e` (also listed by APKMirror); extracted cert `b0a9bbfc05eee5e7d0a2c97c030586e15bb3301152078f54473bb82df6d8c818` | Screenshot version string and local APK build metadata match; installed APK hash/signer not independently verified. |
| **Breeno Instructions / 小布指令** | `com.coloros.shortcuts` | `17.7.2_91aa93e_261102` (separate screenshot evidence; see [Instructions permissions](OPPO_BREENO_INSTRUCTIONS_PERMISSIONS_2026-11-22.md)) | `Инструкции Breeno-17.2.4.apk` | `17.2.4` (`17002004`), metadata `commit=468698a`, `date=260701` | APK SHA-256 `fb26a5990a067156e7c456d956a8586a002f4a41cc77fea7e1cdb6c9beda9304`; extracted v2 cert `64aafaf1d5bc...`, v3.1 cert `159e6f37c336...` | Local 17.2.4 APK is an older reference only; installed 17.7.2 APK is not in the analyzed set. |
| **SearchService (`com.oplus.dmp`)** | `com.oplus.dmp` | Not visible in supplied device screenshots | `SearchService-16.16.80_2f5f245_260902.apk` | `16.16.80_2f5f245_260902` (`16016080`) | APK SHA-256 `6a14874985e1ea6ea69827c41908e6abb5b4a8ccda19b5100b0e9fcf0bdd15b2`; extracted cert `b0a9bbfc05ee...` | Local APK filename and manifest metadata agree; installed device version is unverified. |

> Note: Signing certificate comparison against the live phone still requires read-only on-device package dump (`pm list packages -f` / `apksigner` or PackageInfo signatures) if exact device-installed verification is needed for system apps.

---

## 3. Complete 26-APK Inventory Summary

### 3.1 Core Breeno Suite (5 APKs)

| File | Package | Version (Code) | SDK min→target | Cert cluster (prefix) | DEX Classes | Native `.so` | Assets | Role in stack |
|---|---|---|---|---|---:|---:|---:|---|
| `Breeno-13.4.3.apk` | `com.heytap.speechassist` | `13.4.3` (`130403`) | `29→31` | HeyTap `4b9095b0b71b` | 110,152 | 72 | 959 | Voice/chat assistant, OmniMind plans, Accessibility clicker, local wake/VAD/TTS |
| `Breeno-13.3.2.apk` | `com.heytap.speechassist` | `13.3.2` (`130302`) | `29→31` | HeyTap `4b9095b0b71b` | 107,206 | 68 | 958 | Previous Breeno release (diff baseline) |
| `Breeno Memory-16.11.5.apk` | `com.oplus.aimemory` | `16.11.5` (`16011005`) | `35→36` | Oplus OS `b0a9bbfc05ee` | 41,978 | 11 | 325 | Flash capture, collections, receipts/bills, TFLite crop/scan, CloudKit sync |
| `Инструкции Breeno-17.2.4.apk` | `com.coloros.shortcuts` | `17.2.4` (`17002004`) | `31→37` | OPPO ColorOS `64aafaf1d5bc` | 19,034 | 2 | 48 | Shortcut rules/triggers/chains, `shortcut.db`, SceneService AIDL consumer |
| `Быстрый поиск Breeno-16.12.2.apk` | `com.coloros.colordirectservice` | `16.12.2` (`161202`) | `29→36` | OPPO ColorOS `64aafaf1d5bc` | 40,074 | 22 | 713 | Screen reading, Flash Notes, Copywriting/Smart Sidebar, NCNN text classifier |

### 3.2 ColorOS 16 AI Engine, Search, Suggestions & SystemUI Ecosystem (14 APKs)

| File | Package | Version (Code) | SDK min→target | Cert cluster (prefix) | DEX Classes | Native `.so` | Primary observed capability |
|---|---|---|---|---|---:|---:|---|
| `Сканирование Breeno-16.3.15.apk` | `com.coloros.ocrscanner` | `16.3.15` (`160315`) | `33→36` | OPPO ColorOS `64aafaf1d5bc` | 18,205 | 16 | Camera OCR, document rectification, TFLite + OpenCV + `libaiboost.so`, barcode |
| `Сервисный модуль ИИ-16.1.33_spshop.apk` | `com.oplus.aiunit` | `16.1.33_spshop` (`1601033`) | `34→36` | Oplus OS `b0a9bbfc05ee` | 24,090 | 9 | Shared on-device AI daemon (`AIUnitService`, 201 worker slots, tokenizers, DMA-BUF, dynamic model download) |
| `SearchService-16.16.80_2f5f245_260902.apk` | `com.oplus.dmp` | `16.16.80_2f5f245_260902` (`16016080`) | `34→36` | Oplus OS `b0a9bbfc05ee` | 55,008 | 10 | Device semantic search & AI Ask index, SQLCipher DB, vector utils, Office/PDF parsers, Persona engine |
| `Сервис умных предложений-17.24.2.apk` | `com.oplus.pantanal.ums` | `17.24.2` (`17024002`) | `31→36` | OPPO ColorOS `64aafaf1d5bc` | 46,373 | 20 | Pantanal UMS: AI Brief, NotificationListener, ORT + TFLite + SMU + regex parsers, Seedling/Fluid cards |
| `Сервис умных предложений-17.22.4.apk` | `com.oplus.pantanal.ums` | `17.22.4` (`17022004`) | `31→36` | OPPO ColorOS `64aafaf1d5bc` | 45,608 | 20 | Prior Pantanal UMS baseline (`+16.0.x` before KeyguardStyle/AIBrief external activity additions) |
| `Расшифровка голоса с ИИ-16.1.40.apk` | `com.coloros.accessibilityassistant` | `16.1.40` (`160140`) | `35→35` | Oplus Platform `fc98dae63ad3` | 19,550 | 7 | Live captions/RTASR AIDL, call/meeting summary kit, AccessibilityService & QS tile |
| `Помощник по вызовамс ИИ-15.7.3.apk` | `com.oplus.aicall` | `15.7.3` (`15007003`) | `35→35` | Oplus Platform `fc98dae63ad3` | 9,788 | 3 | Live call translation/summary via AIUnit & `ICallTransService`, `aicall.db`, `libopus.so` |
| `ИИ-автор-16.0.124.apk` | `com.oplus.aiwriter` | `16.0.124` (`16000124`) | `33→35` | Oplus Platform `fc98dae63ad3` | 21,225 | 2 | AI Writer (`PROCESS_TEXT` + AccessibilityService + IME), PPT/typesetting/mindmap subkits |
| `ВиджетыИИ-15.0.9.apk` | `com.oplus.aiwidgets` | `15.0.9` (`1501009`) | `34→35` | Oplus Platform `fc98dae63ad3` | 2,594 | 1 | `AIWidgetProviderService` + `app_aiwidgets_rules_rus_config.json` |
| `Интерфейс системы-16.00.14.apk` | `com.android.systemui` | `16.00.14` (`160014`) | `36→36` | Oplus Platform `fc98dae63ad3` (`sharedUserId=android.uid.systemui`) | 65,767 | 8 | ColorOS SystemUI: `SpeechAssistAccessProvider`, FlashViews/Fluid Cloud, KeyMagic, AON attention, Compose UI |
| `Подключение к устройствам-16.25.6.apk` | `com.oplus.linker` | `16.25.6` (`160250006`) | `34→35` | Oplus Platform `fc98dae63ad3` | 25,480 | 2 | Multi-device synergy (PC/Mac/Pad/TV/iPhone), clipboard sync, cross-file, fluid capsules, Metis |
| `Глоб.поиск-11.64.3.20.apk` | `com.heytap.quicksearchbox` | `11.64.3.20` (`1164003`) | `26→34` | HeyTap `ee7e8a883d03` | 51,750 | 37 | Global/Dock search, 142 MB custom WebView, FFmpeg media, `GlobalSearchProvider` |
| `Базовые сервисы на основе данных-5.9.17.01.apk` | `com.oplus.statistics.rom` | `5.9.17.01` (`530901701`) | `29→37` | Oplus OS `b0a9bbfc05ee` | 19,439 | 15 | DCS analytics (`DcsContentProvider`, `TrackContentProvider`) + local ML (`libcpythonapp.so` + `libMNN.so` + `libpredictor.so`) |
| `Сервис умных рекомендаций-5.5.6.apk` | `com.opos.ads` | `5.5.6` (`556`) | `22→31` | HeyTap `3e02e48baf4a` | 18,872 | 11 | **Advertising / commercial coupon & app-preload service** (`MobAdService`, desk widgets for commercial apps, `adx.ads.heytapmobi.com`) |

### 3.3 Companion, OEM-adjacent & Third-Party APKs (7 APKs; lighter inspection)

- `Browser-40.10.25.2.apk` (`com.heytap.browser`, v`40.10.25.2` / `10250200`, SDK `29→33`, cert `aff8a749cf0e`, 132,982 classes, 88 `.so`)
- `阅读-9.17.0.apk` (`com.heytap.reader`, v`9.17.0` / `91700`, SDK `24→33`, cert `ad51ac3a0a38`, 33 stub/wrapper DEX classes, 39 `.so`)
- `高德地图-17.02.0.2010.apk` (`com.autonavi.minimap`, v`17.02.0.2010` / `170200`, SDK `21→35`, cert `b36c0b80cb24`, 73,638 classes, 73 `.so`)
- `百度地图-22.1.20.apk` (`com.baidu.BaiduMap`, v`22.1.20` / `1665`, SDK `24→33`, cert `a6ef817bfd6c`, 141,242 classes, 101 `.so`)
- `文件随心开WPS定制版-2.8.2.apk` (`cn.wps.moffice.lite`, v`2.8.2` / `282`, SDK `24→30`, cert `643990878d3c`, 26,519 classes, 2 `.so`)
- `签变时光-v1.1.2-20260725-8fc53dd.apk` (`io.github.bszapp.dzjq42`, v`v1.1.2-20260725-8fc53dd` / `6`, SDK `24→37`, cert `e62740c10d88`, 6,784 classes, 3 `.so`)
- `Поиск-6.0.apk` (`reactivephone.msearch`, v`6.0` / `221`, SDK `23→36`, Reactive Phone RU cert `53d2a5e09c30`, 9,113 classes, 4 `.so` across ABIs) — third-party Russian search companion, not an OPPO system package.

---

## 4. Certificate Trust Clusters & Privilege Boundary

Across 26 APK files, the inventory contains 21 OPPO/Oplus/ColorOS/HeyTap-supplied APK records (including non-core Browser and Reader companions) and 5 unrelated third-party app records. Within these, 19 records belong to the core Breeno/ColorOS/AI system analysis set; Browser and Reader are classified as OEM-adjacent companions rather than core assistant/system services. Four main OEM trust groupings are listed below. This is a grouping of extracted signing metadata, not a claim that all packages share one signing identity. A package can expose different certificate fingerprints for different APK signature schemes or signing-lineage records; these are not counted as separate apps or assumed to prove separate organizational owners. Full `apksigner` verification and installed-device signer comparison were not performed:

1. **Oplus Platform / SystemUI trust group (`fc98dae63ad3...`, `CN=AndroidTeam, OU=OSTeam, O=Oplus`):**
   - `com.android.systemui` (`sharedUserId=android.uid.systemui`), `com.oplus.linker`, `com.oplus.aiwriter`, `com.oplus.aicall`, `com.coloros.accessibilityassistant`, `com.oplus.aiwidgets`.
2. **Oplus Core Data & AI trust group (`b0a9bbfc05ee...`, `CN=AndroidTeam, OU=OSTeam, O=Oplus`):**
   - `com.oplus.aimemory`, `com.oplus.aiunit`, `com.oplus.dmp`, `com.oplus.statistics.rom`.
3. **OPPO ColorOS UX trust group (`64aafaf1d5bc...`, `OU=ColorOS, O=OPPO`):**
   - `com.coloros.colordirectservice`, `com.coloros.shortcuts`, `com.coloros.ocrscanner`, `com.oplus.pantanal.ums`.
4. **HeyTap SpeechAssist trust group (v2 cert `4b9095b0b71b...`; v3.1 cert `a7e23cceb52c...`):**
   - `com.heytap.speechassist` (`13.3.2` & `13.4.3`). Its manifest also includes a signed `OplusPermissionKey` and OCS `AUTH_CODE` entries explicitly bound to `com.heytap.speechassist` + its certificate digests, authorizing Epona/Tingle IPC and `com.oplus.permission.safe.*` / `oppo.permission.OPPO_COMPONENT_SAFE` permissions even without sharing the SystemUI platform key.

Additional OEM-adjacent HeyTap products have separate extracted fingerprints: Browser (`aff8a749cf0e...`, `b29aa0bbdc9f...`), Reader (`ad51ac3a0a38...`, `dce1bd1f38d5...`), Global Search (`ee7e8a883d03...`, `5adde71a3a8c...`) and Ads (`3e02e48baf4a...`, `d9a36156a72a...`). These are product-specific certificate records, including multiple signing-scheme/lineage entries in the supplied APKs; do not infer that every fingerprint is a separate company or trust root. The third-party apps also have their own fingerprints (Reactive Phone RU, AMap, Baidu Maps, WPS and the Dzjq app).

**Critical implication for OGAM / Jarvis:** Inter-app ContentProviders and services across Breeno, Memory, AIUnit, DMP, Pantanal UMS, and SystemUI are protected by OEM `signature` / `signatureOrSystem` permissions (`com.oplus.permission.safe.ASSISTANT`, `PRIVATE`, `PROTECT`, `SECURITY`, `AI_APP`, `PHONE`, `SETTINGS`, `oplus.permission.OPLUS_COMPONENT_SAFE`, `oppo.permission.OPPO_COMPONENT_SAFE`) and Epona/Tingle permission tokens. An unprivileged third-party app (OGAM/Jarvis) **cannot and must not attempt** to bind to these OEM internal IPC endpoints.

---

## 5. Priority Research Answers (Section 6 Checklist)

### 5.1 Breeno (`com.heytap.speechassist` — `13.4.3_08c04e4_261110` & Diff vs `13.3.2`)

1. **Assistant Entry, Summon & Request Dispatch:**
   - **No standard `VoiceInteractionService`:** Notably, **none** of the 26 inspected APKs — including `com.heytap.speechassist` — declares `android.permission.BIND_VOICE_INTERACTION` or a `VoiceInteractionService` in `AndroidManifest.xml`.
   - **Instead**, SystemUI (`com.android.systemui`) consumes OEM permission `heytap.speechassist.permission.ACTIVATE_SPEECH_ASSIST` and exposes `SpeechAssistAccessProvider` (`com.oplus.systemui.speechassistaccess`, `com.oplus.permission.safe.ASSISTANT`) plus gesture provider `com.oplus.gesture.actionbuttonkey.ActionRemoteStartContentProvider`. In SystemUI's DEX, references point directly to `com.heytap.speechassist.core.SpeechService`, `SpeechAssistMainActivity`, and `com.oplus.gesture.actionbuttonkey`.
   - **Breeno's primary entry services/activities:**
     - `SpeechService` (`exported=true`, `foregroundServiceType=[location, microphone]`): handles `android.intent.action.ASSIST`, `android.intent.action.VOICE_COMMAND`, `android.speech.action.WEB_SEARCH`, `android.speech.action.VOICE_SEARCH_HANDS_FREE`, `heytap.intent.action.ACTIVATE_SPEECH_ASSIST`, `heytap.intent.action.OCAR_SPEECH_ASSIST`, `coloros.speech.action.THIRD_PARTY_MESSAGE`, `com.heytap.speechassist.action.ENGINE_API`.
     - `SpeechAssistAgentService` (`BIND_SPEECH_ASSIST`, `OPLUS_COMPONENT_SAFE`), `SpeechAssistPreloadService` (`PRELOAD_SPEECH_ASSIST`), `BackgroundTaskService` (`location|microphone`), `MessengerService` (`TEXT_DIRECTIVE`), `DragStartService` (`DragStart`), `SpeechTileService` (QS Tile).
     - `FloatSpeechActivity` (`LOCK_SCREEN_UI`, `VOICE_COMMAND`, `ASSIST`/`VOICE_SEARCH_HANDS_FREE`), `PantanalRouterActivity` (`EXTERNAL_TASK`, `SPEECH_NEW_CUI_TRANSPARENT_OVERLAY`), `DeepLinkActivity` (`breenovoice://`), `SpeechAssistMainActivity` (`aichat://`), `AIChatShareReceiveActivity` (`SEND`, `SEND_MULTIPLE`, `PROCESS_TEXT`), `BootstrapWakeUpWordActivity` (`signatureOrSystem` gated).
   - **UI Automation Hook Inside Breeno:** `AnalogSkillService` declares standard `android.permission.BIND_ACCESSIBILITY_SERVICE` alongside an internal (unexported) `AutofillInputMethodService` (`kanalogclick` / `kanalogskill`) and `OmniMind` plan execution/providers (`PlanReceiverProvider`, `OmniMindDataProvider`, `ReminderNextProvider`, `MetisExecTaskProvider`).

2. **Privileged vs Ordinary Permissions:**
   - 165 total permissions (78 `android.permission.*`, 87 OEM/custom). High-privilege dependencies include `com.oplus.permission.safe.ASSISTANT`, `VOICE`, `WINDOW`, `PHONE`, `PRIVATE`, `SECURITY`, `SETTINGS`, `APP_MANAGER`, `ACCOUNTS`, `CONNECTIVITY`, `IOT`, `AI_APP`, `BACKUP`, `CAPTURE_PREVIEW`, `KEYGUARD`, `GET_INSTALLED_APPS`, and `OPLUS_COMPONENT_SAFE`.

3. **Local Voice / Audio / TTS Coordination vs Cloud:**
   - **Rich local audio frontend bundled in Breeno (`72` `.so` libs):** MNN (`libMNN.so`, `libMNN_Express.so`), voiceprint/wakeword (`libBreenoWakeupVprint.so` 1.08 MB, `libkws.so` 1.56 MB, `libwakeup.so` 1.02 MB), dual VAD (`libbreeno-oai-vad-lib.so` 3.01 MB, `libbreeno_vad.so`), AEC (`libOplusAEC.so`, `libnnaec.so`, `liboppo_*_laec_debug.so`), Opus audio codecs (`libSlpOpus.so`, `libbreeno_opus.so`, `libopus.so`), offline TTS (`libttsoff.so` 4.39 MB, `libSlpTts.so`), ACRCloud (`libACRCloudUniversalEngine.so`), vehicle 2-mic beamforming (`libcae2micvehicle.so`), plus offline command/entity/parameter configs (`assets/aichat_offline_command_config.json`, `assets/heytapaec/*`, `assets/oplusaec/parameter/opai_param.bin`, `assets/ner/*`).
   - **Cloud & Commercial Services:** DEX network markers include Netty + SSE (`text/event-stream`) + WebSocket + HeyTap/Baidu/Amap/Alipay/Bytedance Pangle hosts (`i.bot.heytapmobi.com`, `openapi-slp.heytapmobi.com`, `xiaobu.heytapimage.com`, `alarmclock.bot.heytapmobi.com`, `adx.ads.heytapmobi.com`, `mobilegw.alipay.com`, `pangolin-sdk-toutiao.com`). Note also embedded ad/push/Pangle SDK components inside Breeno itself.

4. **How Screen Context Enters Breeno:**
   - Via ContentProvider queries and IPC to ColorDirect (`com.coloros.colordirectservice`), SceneService/Metis (`com.coloros.sceneservice.scenesprovider`, `IMetis`), OCR Service (`com.coloros.ocrservice.authority.open`), Breeno Memory (`DataShareProvider`), Shortcuts (`com.coloros.shortcuts.provider`), and SystemUI/Accessibility (`AnalogSkillService`).

5. **Exact Diff: `Breeno-13.3.2.apk` → `Breeno-13.4.3.apk`:**
   - **Versions:** `13.3.2` (`130302`, `c9e44b3_260923`) → `13.4.3` (`130403`, `08c04e4_261110`), targetSdk still `31`.
   - **Permissions:** `+com.android.permission.GET_INSTALLED_APPS`, `-android.permission.READ_WALLPAPER_INTERNAL`.
   - **New Agent Payment & Map GenUI Modules (+4 `.so`, +10 activities, +3 providers):**
     - Native libs added: `libagentpay.so` (4.58 MB), `libpgsdk.so` (437 KB), `libamap_AGenUI.so` (1.72 MB), `libyoga.so` (407 KB).
     - Activities added: `Alipay` SDK flow + `AIPayH5WebActivity`, **`FluidCardNotificationActivity`** (`+FluidCardNotificationReceiver`), `AppAuthorizationActivity`, `QuickAppFullWebActivity`.
     - Providers added: `AIPayHostContentProvider`, `QuickAppCardContentProvider`, `PicassoProvider`.
     - AIDL changes: `+IAlixPay`, `+ISpeechAssistBusinessCallback`, while direct legacy `com.oplus.aiunit.core.IService/IUnit` AIDL stubs disappeared from Breeno's DEX (moving toward newer SDK / `aiunit_sdk_core`).

---

### 5.2 Breeno Memory (`com.oplus.aimemory` — `16.11.5_008719b_260901`)

- **Role split hypothesis from static indicators:** `com.oplus.aimemory` (`41,978` DEX classes, SDK `35→36`) has the manifest/DEX/assets expected of a UI and capture-oriented companion with local database and CloudKit-related markers. The `com.oplus.dmp` APK separately contains SQLCipher/vector-library names, database strings, provider declarations and RAG-like configuration filenames. This is consistent with a split Memory + search/index architecture, but the exact data flow and division of responsibilities are not proven without method-level tracing:
  - **Local Databases in `aimemory`:** `com.oplus.aimemory.db` (Room), `cloud_kit_private.db`, `cloud_kit_public.db`, `cloud_kit_share.db`, `cloud_kit_ck_special.db`, `com.heytap.cloudkit.libcommon.db`, `net_okhttp_v3.db`, `usetrace.db`.
  - **On-device Native/ML in `aimemory` (11 `.so` libs):** Document/barcode scan & TFLite (`libscan_engine_decode.so` 3.99 MB, `libscan_engine_detect.so` 3.07 MB, `libtensorflowlite.so` 3.14 MB, `CodeEdgeDetect_0324_BCHW.tflite`, `Codet_Nano_20230101.tflite`, `Deblurring_0209_BCHW.tflite`), QUIC (`libquiche.so`), AIUnit SDK stub (`libaiunit_sdk_core.so`), Senz (`libsenz.so`), TapConnect cipher.
  - **Local vs Cloud indicators:** Room-related class/DB strings, scan-model assets, AIUnit/DMP provider URI strings, CloudKit-related database names, HTTP hostnames and SSE/WebSocket markers appear in the inspected artifacts. These markers indicate a hybrid-capable dependency surface; they do not prove which individual operation uses local vs cloud execution or that every flow reaches those endpoints.
  - **Cross-app manifest/DEX indicators:** Component declarations, provider authority/path strings, action names and permission labels are present for the named integration surfaces. They describe declared interfaces and static references; successful calls, direction of data transfer and actual invocation paths remain unverified.

---

### 5.3 Deep Discovery: `com.oplus.dmp` (`SearchService-16.16.80_2f5f245_260902`)

Static inspection found indicators consistent with a **candidate on-device search/personal-knowledge subsystem** in `com.oplus.dmp`: SQLCipher/vector native-library names, database filename strings, document-parser namespaces, RAG-like chunk/index configuration files, provider declarations, and Persona-related strings. These are consistent with search/RAG and document-indexing responsibilities associated with Memory/Global Search/AI Ask, but do not prove a complete runtime pipeline, exact feature ownership or use by each client.
- **Native Libraries:** **`libsqlcipher.so` (3.53 MB — encrypted storage)**, **`libvector_utils.so` (250 KB — vector embeddings math)**, `libdalib.so` (2.61 MB), `libaiunit_sdk_core.so`, `libmmkv.so`, `libclaw_jni.so`.
- **Document extraction and chunking indicators in DEX/assets:** Apache POI / XMLBeans namespaces (`org.openxmlformats.schemas`, `org.apache.poi`) and PDFBox resources occur alongside structured RAG-like chunking/index configuration filenames (`assets/file/100/ChunkConfig.json`, `IndexConfig.json`, `com.oplus.aimemory#donate_aimemory/0/ChunkConfig.json`, `com.oplus.deepthinker#donate_lifelogging/...`, `gallery/100/ChunkConfig.json`, `calendar/100/ChunkConfig.json`, `assets/config/persona_config.json`, `assets/bypass#*#picture/LLMRequest.json`).
- **Database/provider/host indicators:** Strings include `donate_AIMemory-mini-search.db`, `gallery-mini-search.db`, `note-mini-search.db`, `album_mining.db`, `memory_impress.db`, `dt_chat.db`, `persona_data_mask.db`; manifest declarations include `SearchProvider`, `IndexProvider`, `PersonaAICommandProvider` (`content://com.oplus.persona.command`), `ControlSwitchProvider` and `PersonalizationProvider` with OEM-protected permissions; static hostname strings include `odin-inference-cn.allawntech.com` and `xiaobu.heytapimage.com`. Provider invocation, DB usage and actual cloud requests remain unverified.

---

### 5.4 Breeno Instructions (`com.coloros.shortcuts` — `17.2.4` baseline vs device `17.7.2`)

- **Databases & Storage:** Room / SQLite databases `shortcut.db`, `com.coloros.shortcuts.framework.db`, `collector.db`, `card.db`, plus WorkManager (`androidx.work.impl`).
- **Triggers & Actions:**
  - Consumes `com.coloros.sceneservice.aidl.ISceneService` (`com.coloros.sceneservice`, `com.oplus.metis`) and queries `content://com.coloros.sceneservice.scenesprovider` (`/Settings/accessibilitys_service_enable`, `/final_user_profile`), configured via `assets/app_metis_rules_dynamic_config_list.xml` and `assets/app_shortcut_config_list.xml`.
  - Exports `TaskMonitorService` (`oplus.shortcuts.service.TASK_MONITOR`, perm `ASSISTANT`), `NewsPlayerService` (`PLAY_TTS`, `mediaPlayback`), `AppDataProvider` (`com.coloros.shortcuts.provider`), `ShortcutLabProvider`, and numerous `Seedling`/`Widget` providers.
  - Registers `AccessibilityService` capability? **No** in `17.2.4` — Breeno Instructions `17.2.4` declares **no** `AccessibilityService` of its own; it requests `com.oplus.permission.safe.ACCESSIBILITY` / `ASSISTANT` / `SETTINGS` and relies on `SceneService` / system intents / `Breeno`'s `AnalogSkillService`.
  - Note cloud config hosts (`breeno-fs.coloros.com`, `cmd-cdnfs-cn.allawnfs.com`, `i-bot-*.wanyol.com`).

---

### 5.5 ColorOS 16 Supporting AI Platform Modules

1. **`Сервисный модуль ИИ` (`com.oplus.aiunit` `16.1.33_spshop`, `260920`):**
   - Central shared AI daemon on ColorOS 16: declares `com.oplus.aiunit.large.model = true` and `ai::meta::enable_local_llm_settings_ui = true`.
   - Exposes `AIUnitService` (`oplus.intent.action.AIUNIT_SERVICE`) + `AIUnitProvider` (`com.oplus.aiunit.authority.open`) + `AIUnitDownloadService` (`BIND_DOWNLOAD_SERVICE`) + **201 sandboxed `ServiceProcess0..200` worker processes**.
   - Bundles `libaiunit_framework.so` (1.24 MB), **`libcore_tokenizers.so` (7.66 MB)**, `libopencv_java4.so` (17.82 MB), **`libdmabufheap.so` (96 KB, zero-copy NPU/DSP buffers)**, `mediatek.permission.ACCESS_APU_SYS`, and dynamic model CDN endpoints (`acdp-download-cn.allawntech.com`, `odin.allawntech.com`). Client apps (`SpeechService`, `Memory`, `Scanner`, `AccessibilityAssistant`, `AiCall`, `AiWriter`) bind via tiny `libaiunit_sdk_core.so` (12–14 KB) stubs.
2. **`Быстрый поиск Breeno` (`com.coloros.colordirectservice` `16.12.2`, `261019`):**
   - Dual `AccessibilityService`s (`ColorTextAccessibilityService`, `FlashNotesAccessibilityService`), `InvokeEntranceService` (`SPEECHASSIST_WAKEUP_DIRECTSERVICE`, `INFO_COLLECTION`, `TRANSLATE`, `BREENO_SHOPPING`), NCNN classifier (`TextCNN_Attention.ncnn.bin` 2.65 MB), `libsmart_read_engine.so` (4.16 MB), `libCutoutEffect.so`, `libimage-crop.so`, `libpaint.so` (6.86 MB), ACRCloud audio ID, and feeds Flash Notes / Bills into `aimemory` (`DataShareProvider/datacollectmemory`).
3. **`Сканирование Breeno` (`com.coloros.ocrscanner` `16.3.15`, `260608`):**
   - Offline vision pipeline: `libopencv_java4.so` (29.77 MB), `libaiboost.so` (9.02 MB), `libDocRectification.so` (6.12 MB), `libtensorflowlite.so` (3.14 MB + edge/deblur TFLite models), barcode + cloud OCR fallback (`aitool-cuiocr-cn.heytapmobi.com`).
4. **`Расшифровка голоса с ИИ` (`com.coloros.accessibilityassistant` `16.1.40`), `Помощник по вызовамс ИИ` (`com.oplus.aicall` `15.7.3`), `ИИ-автор` (`com.oplus.aiwriter` `16.0.124`):**
   - Platform-signed accessibility/overlay/ASR/writing tools (`ISummaryKitServiceInterface`, `IRtasrEngine`, `ICallTransService`, `PROCESS_TEXT`, `KitExtractorAccessibilityService`). Cloud transcription/summary hosts in `accessibilityassistant` include `compass-translate.apps.coloros.com`, `www.volcengine.com`, `www.stepfun.com`, `yuewen.cn`.
5. **`Сервис умных предложений` (`com.oplus.pantanal.ums` `17.22.4` → `17.24.2`, `261102`):**
   - Pantanal UMS (`91` providers in `17.24.2`): combines `NotificationListenerService` (`AppNotificationListenerAndroidService`) with **on-device ONNX Runtime (`libonnxruntime.so` 3.41 MB) + TFLite (`libtensorflowlite_jni.so` 3.55 MB) + SMU (`libsmu.so` 5.18 MB) + `libted_regex.so` (1.08 MB)** for parsing SMS/notifications/flights/trains/addresses (`advice2.db`), driving Fluid Cloud / Seedling cards and AI Brief (`brief://com.pantanal.aiflow`).
   - `17.22.4 → 17.24.2` adds `com.oplus.permission.safe.KEYGUARD`, `AIBriefSettingExternalActivity`, `NewsDailyWelcomeActivity`, `AppFreezeProvider`, `BannerProvider`, and `IOplusKeyguardStyleService` AIDL.
6. **`Базовые сервисы на основе данных` (`com.oplus.statistics.rom` `5.9.17.01`, `261015`):**
   - Combines DCS telemetry (`TrackContentProvider`) with an **embedded Python + MNN on-device ML runtime** (`libcpythonapp.so`, `libpycomponent.so`, `libMNN.so` 7.11 MB, `libpredictor.so` 2.75 MB, `PooledInferContentProvider1..6`) for local ranking/prediction.
7. **`Сервис умных рекомендаций` (`com.opos.ads` `5.5.6`, `261030`):**
   - Note for clean-room design: this APK is HeyTap's advertising, splash/preload, and commercial coupon widget service (`MobAdService`, Meituan/KFC/Didi/Ctrip quick-app widgets, `adx.ads.heytapmobi.com`). Zero utility to port into Jarvis.

---

## 6. Clean-Room Architectural Takeaways for `OGAM / Jarvis`

The 26 APKs confirm why `OGAM`'s current standalone roadmap aligns closely with modern ColorOS engineering while avoiding OPPO's privileged lock-in:

1. **System Assistant Entry — Public Android Standard Over OEM Bridges:**
   - ColorOS SystemUI routes Breeno through private `SpeechAssistAccessProvider` + `ACTIVATE_SPEECH_ASSIST` (`signatureOrSystem`), because `Breeno` (`targetSdk=31`) does not even declare `VoiceInteractionService`.
   - **Action for OGAM:** Keep PR #1's public `VoiceInteractionService` / `VoiceInteractionSessionService` + `RoleManager` (`ROLE_ASSISTANT`) + non-exported token-gated Activity bridge. Treat ColorOS power-button routing (`com.oplus.gesture.actionbuttonkey`) strictly as an optional documented research topic for PGEM10, never a core dependency.
2. **Adopt OPPO's Clean Separation Between UI Client, Vector/SQLCipher RAG Index, and Shared Runtime:**
   - OPPO cleanly isolates: **(a)** Voice/Wake/VAD frontend (`Breeno`), **(b)** Encrypted SQLCipher + Vector + Document/PDF RAG index (`com.oplus.dmp`), **(c)** Shared multi-process model runner (`com.oplus.aiunit` with tokenizers + DMA-BUF), **(d)** Explicit memory capture UI (`com.oplus.aimemory`), and **(e)** Deterministic rule/intent executor (`com.coloros.shortcuts`).
   - **Action for OGAM:** Map cleanly onto OGAM's existing standalone slices: SQLite/SQLCipher + vector/RAG retrieval in OGAM-owned TypeScript/native storage (replacing private `@offgrid/rag`), unified `llama.rn`/Whisper/MNN/QNN runtime lifecycle, explicit consented `ScreenContextSnapshot` (never silent background Accessibility harvesting across unrelated apps unless user explicitly opts into UI automation), and typed `Jarvis` task plans/approvals (`shortcuts`-style trigger/action DAG).
3. **Skip Commercial/Telemetry SDK Bloat:**
   - Breeno (`130` MB) and Global Search (`110` MB) carry heavy custom WebViews (`142` MB in QSB), ad SDKs (Pangle/`com.opos.ads`), Alipay agent-pay, and multi-cloud telemetry. Keeping OGAM offline-first and zero-telemetry preserves huge RAM headroom on the 12 GB OPPO Find X6 Pro.
4. **Audio Pipeline Parity Checklist for Jarvis:**
   - Breeno's native audio stack proves the need for dedicated **VAD (`breeno-oai-vad`)**, **NN Echo Cancellation (`libOplusAEC`/`libnnaec`)** for barge-in during TTS playback, **wakeword KWS**, and **offline TTS (`libttsoff`)**. This directly validates PR #1's decision to prioritize real AEC/barge-in, VAD turn detection, and native `JarvisPcmStreamPlayer` before always-on hotword.

---

## 7. Attestation

All findings above were derived strictly from read-only static inspection of the 26 local APK files. No proprietary OPPO binaries, DEX classes, resources, assets, signing keys, or decompiled code were committed or copied into `sokfrut-tech/OGAM`.
