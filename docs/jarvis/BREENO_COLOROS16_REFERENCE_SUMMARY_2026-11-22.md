# OPPO / ColorOS 16 Breeno 26-APK Reference Summary (2026-11-22)

This summary brings the offline static analysis of the 26 owner-supplied OPPO / ColorOS 16 APKs onto PR #1 (`feature/jarvis-step-2-storage-privacy`) so continuing engineering sessions have full context without switching branches.

- **Full technical report & machine-readable inventory (PR #2):**
  - Pull Request: [`#2 — Research: Breeno / ColorOS 16 offline APK static analysis`](https://github.com/sokfrut-tech/OGAM/pull/2) (`docs/research-breeno-coloros-2026-11-22`, head `e4ef6016329c791377bd448f9bc96c328812edfe`)
  - Detailed analysis: `research/breeno/OPPO_LOCAL_APK_STATIC_ANALYSIS_2026-11-22.md`
  - Manifest & native inventory JSON (`332,178` bytes, sanitized, zero secrets): `research/breeno/OPPO_APK_MANIFEST_AND_NATIVE_INVENTORY_2026-11-22.json`
- **Target hardware & OS context:** OPPO Find X6 Pro (`PGEM10`), ColorOS `16.0.5`, build `PGEM10_16.0.5.1201(CN01C20P01)`, Android 16, Snapdragon 8 Gen 2, 12 GB RAM.
- **Safety boundary:** Read-only offline inspection only. Zero proprietary OPPO binaries, DEX classes, assets, signing keys, `AUTH_CODE`s, or `API_KEY`s are copied or depended upon in OGAM.

---

## 1. Exact Phone-Build Verification

| Component | Package | Phone Build Evidence | Analyzed Local APK | SHA-256 Prefix & Match |
|---|---|---|---|---|
| **Breeno / 小布助手** | `com.heytap.speechassist` | `13.4.3_08c04e4_261110` | `Breeno-13.4.3.apk` (`130403`, metadata `08c04e4`, `261110`) | `cf547e473283...` (**exact build match**) |
| **Breeno Memory / 小布记忆** | `com.oplus.aimemory` | `16.11.5_008719b_260901` | `Breeno Memory-16.11.5.apk` (`16011005`, metadata `008719b`, `260901`) | `b9646e411867...` (**exact build match**; matches APKMirror SHA-256 & cert `b0a9bbfc05ee...`) |
| **SearchService** | `com.oplus.dmp` | `16.16.80_2f5f245_260902` | `SearchService-16.16.80_2f5f245_260902.apk` (`16016080`) | `6a14874985e1...` (exact filename/version match) |
| **Breeno Instructions** | `com.coloros.shortcuts` | `17.7.2_91aa93e_261102` | `Инструкции Breeno-17.2.4.apk` (`17002004`, `468698a_260701`) | `fb26a5990a06...` (older reference baseline) |
| **AIUnit** | `com.oplus.aiunit` | — | `Сервисный модуль ИИ-16.1.33_spshop.apk` (`1601033`) | Shared on-device AI daemon baseline |

*(Plus `Breeno-13.3.2.apk` diff baseline, `Быстрый поиск Breeno-16.12.2.apk`, `Сканирование Breeno-16.3.15.apk`, `Сервис умных предложений-17.24.2.apk` / `17.22.4.apk`, `Расшифровка голоса с ИИ-16.1.40.apk`, `Помощник по вызовамс ИИ-15.7.3.apk`, `ИИ-автор-16.0.124.apk`, `ВиджетыИИ-15.0.9.apk`, `Интерфейс системы-16.00.14.apk`, `Подключение к устройствам-16.25.6.apk`, `Глоб.поиск-11.64.3.20.apk`, `Базовые сервисы на основе данных-5.9.17.01.apk`, `Сервис умных рекомендаций-5.5.6.apk`, `Поиск-6.0.apk`, and 6 third-party companion APKs.)*

---

## 2. Actionable Engineering Conclusions for PR #1 (`OGAM / Jarvis`)

1. **System Assistant Entry — Standard Android `RoleManager` + `VoiceInteractionService` Is Mandatory & Correct:**
   - **Finding:** None of the 26 ColorOS APKs — including `com.heytap.speechassist` (`13.4.3`) — declares `android.permission.BIND_VOICE_INTERACTION` or a `VoiceInteractionService`. ColorOS SystemUI (`com.android.systemui`) triggers Breeno through private OEM bridges (`heytap.speechassist.permission.ACTIVATE_SPEECH_ASSIST`, `SpeechAssistAccessProvider`, `com.oplus.gesture.actionbuttonkey.ActionRemoteStartContentProvider`).
   - **Decision for PR #1:** Continue with OGAM's public Android 16 architecture (`VoiceInteractionService` / `VoiceInteractionSessionService`, explicit `RoleManager.ROLE_ASSISTANT` picker, non-exported token-authorized bridge Activity). Never rely on private ColorOS OEM IPC. Power-button remapping notes remain reference-only.

2. **Privilege Boundary — Four OEM Certificate Clusters Lock Out Private Providers:**
   - Inter-app providers and AIDL services across Breeno, Memory, AIUnit, DMP, Pantanal UMS, and SystemUI require `signature`/`signatureOrSystem` permissions across four signing certificate clusters (`Oplus Platform fc98dae63ad3`, `Oplus OS b0a9bbfc05ee`, `OPPO ColorOS 64aafaf1d5bc`, `HeyTap SpeechAssist 4b9095b0b71b` + signed `OplusPermissionKey` / `AUTH_CODE`s).
   - OGAM must exclusively use public Android APIs (SAF, `MediaStore`, `RoleManager`, `CalendarContract`, user-consented `VoiceInteractionSession.onHandleAssist` / explicit snapshots, foreground services).

3. **Adopt OPPO's Clean Four-Subsystem Separation (Reproduced Clean-Room in OGAM):**
   - **Voice & Echo-Cancellation Frontend (`com.heytap.speechassist`):** Bundles MNN inference (`libMNN.so`), dedicated dual VAD (`libbreeno-oai-vad-lib.so`), neural AEC (`libOplusAEC.so`, `libnnaec.so`) for safe barge-in, KWS (`libkws.so`), and offline TTS (`libttsoff.so`). Validates PR #1's focus on real VAD/endpointing, AEC-safe barge-in, and the native `JarvisPcmStreamPlayer` before always-on hotword.
   - **Encrypted Personal Knowledge & Vector Index (`com.oplus.dmp`):** Separates the capture UI (`com.oplus.aimemory`) from the encrypted RAG store (`libsqlcipher.so` + `libvector_utils.so` + Office/PDF chunked indexing + Persona DB). Directly guides OGAM's migration away from private `@offgrid/rag/documents` toward an OGAM-owned local encrypted SQLite/SQLCipher + vector/FTS knowledge engine.
   - **Unified Multi-Model Inference Daemon / Lifecycle (`com.oplus.aiunit`):** Centralizes model loading, tokenizers (`libcore_tokenizers.so`), DMA-BUF memory management (`libdmabufheap.so`), and GPU/NPU/CPU fallback. Maps to OGAM's `modelResidency` + `activeModelService` + `llama.rn`/`LiteRT` abstraction.
   - **Explicit Capture (`aimemory`) + Deterministic Rules (`shortcuts`):** Cleanly separates capture/collections from deterministic workflow/trigger DAGs (`shortcut.db`, WorkManager). Maps directly to PR #1's `taskPlan` / `taskPlanRun` + `SkillContract v1`.

4. **Explicit Exclusions (`com.opos.ads` & Bloat):**
   - `Сервис умных рекомендаций` (`com.opos.ads`, `5.5.6`) is purely an advertising, app-preload, and commercial coupon engine (`MobAdService`, `adx.ads.heytapmobi.com`). Out of scope and must not be emulated.
   - Skip Breeno's 130+ MB commercial/WebView/payment/Pangle footprint (`142` MB WebView in Global Search, Alipay agent pay, Pangle ads) to preserve RAM headroom for local 4B LLMs + vision + voice on the 12 GB Find X6 Pro.
