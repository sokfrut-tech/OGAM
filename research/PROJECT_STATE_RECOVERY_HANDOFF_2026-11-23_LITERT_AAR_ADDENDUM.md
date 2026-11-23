# OGAM recovery handoff addendum — LiteRT AAR acquisition
Date: 2026-11-23
Repository: sokfrut-tech/OGAM
Branch: docs/research-breeno-coloros-2026-11-22
Parent handoff: research/PROJECT_STATE_RECOVERY_HANDOFF_2026-11-23.md

## New work recorded
- Added `research/voice/OGAM_LITERT_232_AAR_ACQUISITION_AND_HASH_GATE_2026-11-23.md`.
- Official Google C++ codelab confirms Google Maven AAR acquisition and extraction of `jni/arm64-v8a/libLiteRt.so`.
- Official LiteRT docs confirm 2.3.2 current release and Android API24 / NDK r26a baseline.
- Re-attempted exact AAR acquisition in this environment. Web open was inaccessible and container DNS resolution failed. No bytes, checksums, ELF metadata or notices were captured.
- No checksum was guessed; no mirror/wheel was substituted.
- No OGAM app source, Gradle dependency, native CMake target, APK or workflow was changed/created.

## Evidence state (updated after direct Google Maven download & ELF/ABI inspection)
| Gate | State |
|---|---|
| Version/publication and Android baseline | CONFIRMED (`litert:2.3.2`, manifest `minSdkVersion="24"`) |
| AAR path and arm64 member path | CONFIRMED (`jni/arm64-v8a/libLiteRt.so`, `5,629,696` bytes) |
| Exact AAR / .so hashes and ELF audit | **CLOSED** (`OGAM_LITERT_232_BINARY_PROVENANCE_AND_ABI_AUDIT_2026-11-23.md`: AAR `4d1f26b4...`, `.so` `6acacb3c...`, `EM_AARCH64`, NDK-only `DT_NEEDED`, 21/21 Supertonic C symbols present in `2.1.5` & `2.3.2`) |
| Exact notice-file bytes | **CLOSED** (`LICENSE` `13,575` B `71c6915d...`, `THIRD_PARTY_NOTICE.txt` `1,960,672` B `db6e1ff4...`) |
| Speech-core interface link closure | **CLOSED** (`TTSInterface::synthesize_with_options` pulls `offline_spectral_de_esser.cpp` + `ooura_fft_engine.cpp` + `fft4g.cpp`; `utf8proc v2.11.0` = `d7bf128df773c2a1a7242eb80e51e91a769fc985`) |
| Native compile/link | PREPARED IN HARNESS (`research/voice/supertonic-smoke/CMakeLists.txt` + `.github/workflows/research-supertonic-litert-arm64-smoke.yml`, `workflow_dispatch` only); NDK execution pending |
| Cancellation race fix/tests | **PATCH VERIFIED (`git apply --check` passed on `59b9d790`)** + C++ harness (`supertonic_cancel_gate.h`, `supertonic_cancel_race_test.cpp`) committed; host C++ run pending |
| OPPO PGEM10 device test | NOT RUN |

## GitHub Actions observation (2026-11-23)
- Repository workflow runs stopped auto-triggering after `2026-11-22T21:38:57Z` (`#45073271250`, after rapid PR `#2` doc commits accumulated 720 CI runs against `ci.yml` without `paths-ignore`). Keep research-only commits tagged `[skip ci]` and verify Actions account quota/triggers before relying on automatic CI checks.

## Next safe sequence
1. ~~Download exact Google Maven AAR, verify hashes, notices, and AArch64 ELF `.dynamic` / `.dynsym` symbols~~ → **DONE** in `research/voice/OGAM_LITERT_232_BINARY_PROVENANCE_AND_ABI_AUDIT_2026-11-23.md`.
2. ~~Author verified cancellation-epoch patch (`git apply --check` on `59b9d790`), isolated CMake/JNI smoke harness, C++ race stress test, and manual-only workflow~~ → **DONE** in `research/voice/supertonic-smoke/` + `.github/workflows/research-supertonic-litert-arm64-smoke.yml`.
3. Trigger `workflow_dispatch` on `Research Supertonic LiteRT ARM64 Smoke` once GitHub Actions runners are active (confirm host `supertonic_cancel_race_test` + NDK arm64 build + `readelf` zero ORT/curl + notice artifact).
4. Only after CPU proof on `PGEM10`, consider a separate Qualcomm NPU feasibility track for `SM8550` / HTP v73.
5. Keep all changes in the research branch and PR #2 Draft. Do not merge or modify production app code.

## Repository state after this addendum
The research branch head and main branch must be checked from GitHub before any subsequent writes; this addendum is not a production implementation or device validation.
