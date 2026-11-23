# Supertonic-3 Isolated Android ARM64 Smoke Harness (Research Only)

This directory contains the clean isolated native TTS-only prototype requested in `PROJECT_STATE_RECOVERY_HANDOFF_2026-11-23_LITERT_AAR_ADDENDUM.md`:

- **`patches/supertonic-generation-cancel.patch`** — Verified against pinned `soniqo/speech-core@59b9d7902ea62dbbbfb95e139e2bf0e8957f8753` (`git apply --check` passed). Replaces mutable `cancelled_{false}` (which `synthesize()` used to overwrite on entry) with monotonic `cancel_epoch_` + `begin_synthesis_epoch()` + `synthesize_with_epoch(...)`.
- **`supertonic_cancel_gate.h`** — Header-only C++17 monotonic generation gate and callback filter preventing pre-entry cancel races and stale PCM emission.
- **`supertonic_tts_smoke_jni.cpp`** — Minimal JNI smoke adapter targeting `LiteRTSupertonicTts` + synchronous `jfloatArray` copy.
- **`supertonic_cancel_race_test.cpp`** — Standalone multithreaded C++17 stress test covering 2,000-iteration entry-barrier races, ODE early abort, stale callback drop, and generation isolation.
- **`CMakeLists.txt`** — Standalone API 24 / `arm64-v8a` target compiling ONLY the 7-file `Supertonic + TTSInterface + Ooura de-esser` link closure with pinned `utf8proc` (`d7bf128d`) and Google Maven `litert:2.3.2` (`jni/arm64-v8a/libLiteRt.so`), failing if `libonnxruntime` or `libcurl` enters `DT_NEEDED`.

## Verification boundary
- Checked locally: `git apply --check patches/supertonic-generation-cancel.patch` on clean `soniqo/speech-core@59b9d790`.
- Host C++ stress test & NDK `arm64-v8a` cross-build are wired in manual workflow [`.github/workflows/research-supertonic-litert-arm64-smoke.yml`](../../../.github/workflows/research-supertonic-litert-arm64-smoke.yml) (`workflow_dispatch` only).
- **Do not** move into production `android/app/` or mark `PGEM10` runtime verified until real NDK compile/link + `PGEM10` Russian corpus benchmark run cleanly.
