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
| Native compile/link | **CLOSED IN WSL2 + NDK r27d** (`libjarvis_supertonic_smoke.so`, `6,302,928` B unstripped, SHA-256 `b3c45ff2...`, `EM_AARCH64`, Android API 24, `0x4000` 16 KB `PT_LOAD`, `DT_NEEDED=[libLiteRt.so, liblog.so, libm.so, libdl.so, libc.so]`, 5/5 JNI exports, 20 `LiteRt*@VERS_1.0` imports, zero ORT/curl) |
| Cancellation race fix/tests | **CLOSED ON HOST (`g++ 15.2.0` + TSan/ASan/UBSan)** (`seq_cst` Dekker `cancel_epoch_` patch verified cleanly on `59b9d790` + `SupertonicCancelGate` + `supertonic_cancel_race_test`: 5/5 normal + ASan/UBSan + TSan pass) |
| OPPO PGEM10 device test | NOT RUN (real Supertonic-3 weights on-device smoke & Russian corpus benchmark still open) |

## GitHub Actions observation & local verification update (2026-11-23)
- Repository workflow runs stopped after `2026-11-22T21:38:57Z` (`#45073271250`, `720` total runs) because the `sokfrut-tech` account reached 100% of its GitHub Free Actions compute (`$12.00 / $12.00`) and storage (`0.5 GB / 0.5 GB`) with a `$0.00` spending budget (`Included usage limits reset in 8 days` on December 1, 2026; manual `workflow_dispatch` currently returns `HTTP 422: Actions has been disabled for this repository`).
- Cleanup freed `1,231` old `OGAM` test artifacts (`659.83 MB`), all `260` `OGAM` caches (`9.79 GiB`), and `275` duplicate `Gemeni` APKs (`21.02 GiB`) while preserving all research/factory artifacts. Keep research-only commits tagged `[skip ci]`.
- To unblock without waiting for December 1, host stress tests (`5/5`, ASan+UBSan, TSan) and full Android API 24 `arm64-v8a` cross-compilation/ELF inspection (`Android NDK r27d`) were executed locally in WSL2 `Ubuntu 26.04` (see `research/voice/supertonic-smoke/README.md`), also correcting a two-digit typo in the `THIRD_PARTY_NOTICE.txt` SHA-256 (`db6e1ff4b16c11eb01c45f135928527a50a05282739054686793ec70f442f119`).

## Next safe sequence
1. ~~Download exact Google Maven AAR, verify hashes, notices, and AArch64 ELF `.dynamic` / `.dynsym` symbols~~ → **DONE** in `research/voice/OGAM_LITERT_232_BINARY_PROVENANCE_AND_ABI_AUDIT_2026-11-23.md`.
2. ~~Author verified cancellation-epoch patch (`git apply --check` on `59b9d790`), isolated CMake/JNI smoke harness, C++ race stress test, and manual-only workflow~~ → **DONE** in `research/voice/supertonic-smoke/` + `.github/workflows/research-supertonic-litert-arm64-smoke.yml`.
3. ~~Run `supertonic_cancel_race_test` + NDK `arm64-v8a` cross-compile/link & `readelf`/`llvm-nm` verification~~ → **DONE LOCALLY IN WSL2 + NDK r27d** (`5/5` + ASan/UBSan + TSan; `libjarvis_supertonic_smoke.so` `0x4000` 16 KB aligned, zero ORT/curl). Remaining optional CI check: run `workflow_dispatch` on `Research Supertonic LiteRT ARM64 Smoke` once GitHub Actions resets on December 1, 2026.
4. Next technical milestone before production integration: benchmark the compiled `.so` + `libLiteRt.so` `2.3.2` with real Supertonic-3 weights on `PGEM10` (CPU first, then evaluate Qualcomm NPU `SM8550` / HTP v73 separately).
5. Keep all changes in the research branch and PR #2 Draft. Do not merge or modify production app code.

## Repository state after this addendum
The research branch head and main branch must be checked from GitHub before any subsequent writes; this addendum is not a production implementation or device validation.
