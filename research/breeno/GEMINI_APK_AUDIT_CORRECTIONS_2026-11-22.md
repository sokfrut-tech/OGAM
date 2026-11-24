# Gemini APK Audit Findings — Corrections and Evidence Reconciliation

Date: 2026-11-22  
Repository: `sokfrut-tech/OGAM`  
Branch: `docs/research-breeno-coloros-2026-11-22`  
Input review: `sokfrut-tech/Universal-AI-Factory/coordination/gemini/outbox/REPORT_2026-11-22_OGAM_breeno_dex_audit.md`

This record tracks the corrective work for Gemini findings A1–A5. It deliberately separates completed documentation corrections from evidence that still requires a device, a full APK verifier, or a reproducible build.

## A1 — Screenshot build evidence versus local APK metadata

**Status: corrected in the inventory report.**

- The exact-build table now labels the screenshot column as **device screenshot version evidence**, not as though every row is a screenshot-observed build.
- Breeno 13.4.3 and Breeno Memory 16.11.5 have screenshot version strings that match the local APK manifest build metadata. This is a version/build-metadata correlation only: the screenshots do not prove the local APK file's SHA-256 or signer is identical to the installed binary.
- Breeno Instructions 17.7.2 remains separate screenshot evidence, documented in `OPPO_BREENO_INSTRUCTIONS_PERMISSIONS_2026-11-22.md`. The analyzed local APK is 17.2.4 and remains only an older reference build.
- SearchService `com.oplus.dmp` is **not visible in supplied device screenshots**. Its version is sourced only from the local APK filename and decoded manifest metadata; whether that exact build is installed on the phone is not verified.

## A2 — Package grouping and signing-certificate counts

**Status: corrected in Markdown and JSON.**

- The inventory now distinguishes 26 APK file records from 24 unique package names.
- JSON `role_group` now contains 19 `oppo_coloros_breeno_ecosystem` core-stack records and 7 `third_party_or_companion` records.
- `reactivephone.msearch` is reclassified as a third-party Russian search app, not an OPPO/ColorOS system package.
- HeyTap Browser and Reader remain in the companion group for role analysis, but are counted as OEM-adjacent products when describing the broader OEM supplier family. This yields 21 OEM-family APK records (including Browser/Reader) and 5 unrelated third-party apps; 19 records are in the core assistant/OS/AI stack.
- The signing section now names four main OEM trust groupings: Oplus Platform/SystemUI, Oplus Core Data & AI, OPPO ColorOS UX, and HeyTap SpeechAssist. Browser, Reader, Global Search and Ads have additional product-specific certificate fingerprints. Multiple v2/v3/v3.1 fingerprints are treated as signature-scheme/lineage records, not as separate apps or separate companies.
- The extracted certs have not been revalidated with full `apksigner` and have not been compared with installed phone packages. No stronger signing-identity claim is made.

## A3 — AIUnit worker process interpretation

**Status: corrected in Markdown and machine-readable JSON.**

- The AIUnit manifest declares 201 non-exported worker service/process entries using process names `:worker0` through `:worker200`.
- The corresponding manifest attributes have `isolatedProcess=false`. These are therefore ordinary worker processes under the app's UID, **not Android isolated-process sandboxes**.
- JSON now records `service_declarations: 201`, `exported: false`, `isolated_process: false`, and `runtime_behavior_verified: false`.
- Runtime concurrency, scheduling, actual execution and any additional sandboxing outside the Android `isolatedProcess` mechanism were not traced.

## A4 — Evidence labels and APK/library size units

**Status: corrected in the inventory report and JSON.**

- The report now states that manifest declarations establish what an APK declares, not what the OS invokes at runtime.
- DEX class names, AIDL markers, provider URI strings, database names, asset names, hostnames and native-library filenames are labeled as structural indicators. They do not independently establish method execution, data flow, reachable endpoints, offline behaviour or ownership of a complete feature.
- SearchService and Breeno Memory role descriptions are qualified as static indicators/hypotheses pending JADX method/call-graph or runtime evidence.
- JSON distinguishes total APK archive length from uncompressed native-library ZIP-entry length:
  - `apks[].size_bytes`: compressed APK archive length, bytes.
  - `apks[].notable_native_libs[].size`: uncompressed native library ZIP-entry length, bytes.
  - Human-readable MB values in Markdown are decimal MB (1 MB = 1,000,000 bytes); MiB is not implied.
- Full JADX decompilation and dynamic execution remain unperformed.

## A5 — Stale device evidence and PR #1 status pointers

**Status: device-evidence contradictions corrected; PR #1 CI pointer refresh pending the current run's final result.**

- `OPPO_FIND_X6_PRO_DEVICE_EVIDENCE_2026-11-22.md` no longer says the installed ColorOS version, Android release or security patch are unconfirmed. Its earlier uncertainty is now explicitly reconciled with the later Settings > Version screenshot.
- Confirmed device baseline: OPPO Find X6 Pro / PGEM10, ColorOS 16.0.5, build `PGEM10_16.0.5.1201(CN01C20P01)`, Android 16, firmware `Q_V1_P14,Q_V1_P14`, security update 1 August 2026. Full `ro.build.fingerprint` and exact numeric SDK level remain unverified.
- The separate Instructions 17.7.2 screenshot remains referenced only from its dedicated evidence document.
- PR #1's earlier source-contract run references will be replaced in `PR1_NATIVE_ASSISTANT_SOURCE_VERIFICATION_2026-11-22.md` after the newer CI run finishes, so a still-running or failed Gradle result is not recorded as successful.

## Changed research artifacts

- `OPPO_LOCAL_APK_STATIC_ANALYSIS_2026-11-22.md`
- `OPPO_APK_MANIFEST_AND_NATIVE_INVENTORY_2026-11-22.json`
- `OPPO_FIND_X6_PRO_DEVICE_EVIDENCE_2026-11-22.md`
- `README.md`

PR #2 remains a draft. These changes correct analysis and documentation; they do not establish that OGAM can call OEM-private endpoints, that the installed APK hashes match the local files, or that the un-decompiled runtime flows work as inferred.
