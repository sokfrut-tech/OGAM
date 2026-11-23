# Supertonic-3 Isolated Android ARM64 Smoke Harness (Research Only)

This directory contains the clean isolated native TTS-only prototype requested in `PROJECT_STATE_RECOVERY_HANDOFF_2026-11-23_LITERT_AAR_ADDENDUM.md`:

- **`patches/supertonic-generation-cancel.patch`** — Verified against pinned `soniqo/speech-core@59b9d7902ea62dbbbfb95e139e2bf0e8957f8753` (`git apply --check` & `git apply` passed). Replaces mutable `cancelled_{false}` (which `synthesize()` used to overwrite on entry) with monotonic `cancel_epoch_` (`std::memory_order_seq_cst`), `begin_synthesis_epoch()`, and `synthesize_with_epoch(...)`.
- **`supertonic_cancel_gate.h`** — Header-only C++17 lock-free monotonic generation gate (`std::memory_order_seq_cst` Dekker ordering) and callback filter preventing pre-entry cancel races and stale PCM emission without blocking barge-in on audio writes.
- **`supertonic_tts_smoke_jni.cpp`** — Minimal JNI smoke adapter targeting `LiteRTSupertonicTts` + synchronous `jfloatArray` copy.
- **`supertonic_cancel_race_test.cpp`** — Standalone multithreaded C++17 stress test covering 2,000-iteration entry-barrier Dekker races, ODE early abort, stale callback drop, and generation isolation.
- **`CMakeLists.txt`** — Standalone API 24 / `arm64-v8a` target compiling ONLY the 7-file `Supertonic + TTSInterface + Ooura de-esser` link closure with pinned `utf8proc` (`d7bf128d`) and Google Maven `litert:2.3.2` (`jni/arm64-v8a/libLiteRt.so`), `-Wl,-z,max-page-size=16384` (16 KB `PT_LOAD` alignment), and failing in CI if `libonnxruntime` or `libcurl` enters `DT_NEEDED`.

## Verification boundary (updated 2026-11-23 after local WSL2 + Android NDK r27d run)
- **Host C++ stress test (`WSL2 Ubuntu 26.04`, `g++ 15.2.0`, `cmake 4.2.3`, `ninja 1.13.2`):** `supertonic_cancel_race_test` passed **5/5** consecutive runs (`all 4 stress scenarios passed`), plus **ASan + UBSan** (`detect_leaks=1`) and **ThreadSanitizer (`-fsanitize=thread`)** with 0 errors and 0 data races.
- **Google Maven `litert:2.3.2` AAR & notice verification:** Verified `litert-2.3.2.aar` (`7,640,090` B, `4d1f26b4...`), `jni/arm64-v8a/libLiteRt.so` (`5,629,696` B, `6acacb3c...`, `0x4000` LOAD alignment), `LICENSE` (`13,575` B, `71c6915d...`), `THIRD_PARTY_NOTICE.txt` (`1,960,672` B, `db6e1ff4b16c11eb01c45f135928527a50a05282739054686793ec70f442f119`), and `minSdkVersion="24"`.
- **Android API 24 `arm64-v8a` cross-build (`Android NDK r27d` / `Clang 18.0.4`, pinned `speech-core@59b9d790` + `utf8proc@d7bf128d`):**
  - `libjarvis_supertonic_smoke.so` compiled and linked cleanly (`6,302,928` B unstripped, SHA-256 `b3c45ff22d1e0392ca488b18142560eeadb0e90b3988111b6ef3e3e2b41d00a7`).
  - `file` / `readelf -h`: `ELF 64-bit LSB shared object, ARM aarch64, for Android 24, built by NDK r27d`.
  - `readelf -d`: `DT_SONAME=libjarvis_supertonic_smoke.so`; `DT_NEEDED=[libLiteRt.so, liblog.so, libm.so, libdl.so, libc.so]` (**zero `onnxruntime`**, **zero `libcurl`**).
  - `readelf -lW`: all 3 `PT_LOAD` segments aligned to **`0x4000` (16 KB)**.
  - `llvm-nm -D --defined-only` / `--undefined-only`: all **5** `Java_ai_offgridmobile_voice_research_SupertonicSmokeBridge_native*` JNI symbols exported; `191` undefined dynamic symbols (`169` `@LIBC`, `20` `LiteRt*@VERS_1.0`, `__android_log_print`, weak `memfd_create` — zero unresolved `speech-core` / `utf8proc` / `ooura` symbols).
- **Still NOT executed (open gate):** On-device `PGEM10` runtime synthesis benchmark with real Supertonic-3 weights & voice styles; **do not** move into production `android/app/` or mark `PGEM10` runtime verified until on-device Russian corpus tests pass.
