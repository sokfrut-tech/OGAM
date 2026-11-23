# LiteRT 2.3.2 Binary Provenance, ELF/ABI Audit, and Soniqo `speech-core` Link Closure

- **Date:** 2026-11-23
- **Repository / Branch:** `sokfrut-tech/OGAM` / `docs/research-breeno-coloros-2026-11-22` (PR `#2`, Draft)
- **Target Device Baseline:** OPPO Find X6 Pro `PGEM10`, Snapdragon 8 Gen 2 (`SM8550` / `arm64-v8a`), Android 16 / ColorOS 16.0.5
- **Supersedes Open Acquisition Gate In:** `OGAM_LITERT_232_AAR_ACQUISITION_AND_HASH_GATE_2026-11-23.md`, `PROJECT_STATE_RECOVERY_HANDOFF_2026-11-23_LITERT_AAR_ADDENDUM.md`
- **Scope:** Direct Google Maven binary acquisition, byte-level SHA-256 provenance, AArch64 ELF `.dynamic` / `.dynsym` inspection, `2.1.5 → 2.3.2` C-API cross-check against pinned `soniqo/speech-core@59b9d7902ea62dbbbfb95e139e2bf0e8957f8753`, and `TTSInterface` source link closure. **No OGAM app source, Gradle build, NDK binary compilation, or `PGEM10` runtime execution was performed.**

---

## 1. Direct Binary Provenance — `com.google.ai.edge.litert:litert:2.3.2`

Downloaded via HTTPS `GET` (`HTTP 200`) from `https://dl.google.com/dl/android/maven2/com/google/ai/edge/litert/litert/2.3.2/litert-2.3.2.aar`.

| Artifact / ZIP Member | Size (bytes) | SHA-256 | Notes |
|---|---:|---|---|
| `litert-2.3.2.aar` | `7,640,090` | `4d1f26b47f89e501940cbfb6e165faf3e600a7213af02e9816d39a49614bf702` | Official Google Maven release archive (10 ZIP entries) |
| `AndroidManifest.xml` | `823` | `192aa9eabe8d96c9924d1f6784f32ccd9a0674a4888704fa7fb066854926b075` | `package="com.google.ai.edge.litert.impl"`, `<uses-sdk android:minSdkVersion="24"/>` |
| `jni/arm64-v8a/libLiteRt.so` | `5,629,696` | `6acacb3cb6b96b5a4f23b45d7bb8df2b305458ec894d62f646224b73d180dbd5` | Target phone ABI |
| `jni/armeabi-v7a/libLiteRt.so` | `3,653,808` | `e16cc9d21b3cff9dc614b12e040d5984ea35afb634940dbbe9baf6b6db432c93` | 32-bit ARM library inside AAR |
| `jni/x86_64/libLiteRt.so` | `7,784,496` | `0167cf5f2b61e0e866e9a27ab794bea161652f129bdd51dad3a7cae8173dd540` | Emulator x86_64 library inside AAR |
| `LICENSE` | `13,575` | `71c6915d04265772a0339bed47276942c678b45cc01534210ebe6984fd1aec65` | Apache License, Version 2.0 (January 2004) |
| `THIRD_PARTY_NOTICE.txt` | `1,960,672` | `db6e1ff4b61c11eb01c45f135928527a50a05282739054686793ec70f442f119` | Bundled third-party attribution notices (`1.96 MB`) |

*(Note: `classes.jar` (`25,390`), `R.txt` (`15,419`), `proguard.txt` (`214`), `res/` (`0`) omitted from SHA list.)*

---

## 2. Baseline Comparison — `com.google.ai.edge.litert:litert:2.1.5`

Downloaded via HTTPS `GET` (`HTTP 200`) from `https://dl.google.com/dl/android/maven2/com/google/ai/edge/litert/litert/2.1.5/litert-2.1.5.aar` (12 ZIP entries).

| Artifact / ZIP Member | Size (bytes) | SHA-256 | Difference vs `2.3.2` |
|---|---:|---|---|
| `litert-2.1.5.aar` | `10,058,192` | `a162d1ddbdad87c002b7ec7eb31a703f2761335e693f292f94091b3569d8aa37` | Larger because GPU CL/GL accelerator `.so` was bundled directly inside base AAR |
| `jni/arm64-v8a/libLiteRt.so` | `5,328,296` | `366e3e040b00692158f9f8f9105870672c93348a3d8e9024120b40045a074b0b` | Core LiteRT runtime (`5.33 MB` vs `5.63 MB`) |
| `jni/arm64-v8a/libLiteRtClGlAccelerator.so` | `2,728,920` | `d22d9490c43a9428a6047564560dae83ce32a616658baa324b43843bfb066e89` | Present in `2.1.5` base AAR; split out of base AAR in `2.3.2` |
| `LICENSE` | `13,575` | `71c6915d04265772a0339bed47276942c678b45cc01534210ebe6984fd1aec65` | Byte-identical Apache-2.0 text |
| `THIRD_PARTY_NOTICE.txt` | `1,832,369` | `e3bb590c6b611b7a3cf06095c464ea51565c5c28b7128a337b3af7951277a1b1` | Shorter than `2.3.2` (`1,960,672` bytes) |

---

## 3. AArch64 ELF64 `.dynamic` & `.dynsym` Audit (`jni/arm64-v8a/libLiteRt.so`)

| Property | LiteRT `2.1.5` | LiteRT `2.3.2` |
|---|---|---|
| ELF class / endianness / machine | ELF64 LE / `EM_AARCH64` (`183`) | ELF64 LE / `EM_AARCH64` (`183`) |
| `DT_SONAME` | `libLiteRt.so` | `libLiteRt.so` |
| `DT_RUNPATH` / `DT_RPATH` | `[]` | `[]` |
| `DT_NEEDED` | `libandroid.so`, `libdl.so`, `libGLESv3.so`, `libEGL.so`, `libm.so`, `liblog.so`, `libc.so` | `libdl.so`, `libGLESv3.so`, `libEGL.so`, `libm.so`, `liblog.so`, `libc.so` |
| Non-NDK runtime deps (`libonnxruntime`, `libcurl`, etc.) | **None** | **None** |
| Defined global/weak `.dynsym` exports | `714` total / `421` `LiteRt*` | `702` total / `436` `LiteRt*` |
| `LiteRt*` `.dynsym` delta (`2.1.5 → 2.3.2`) | — | **`+16` added**, **`1` removed** (`LiteRtSetEnvironmentOptionsValue`) |

---

## 4. `soniqo/speech-core@59b9d7902ea62dbbbfb95e139e2bf0e8957f8753` C-API Compatibility

Cross-checked every direct `LiteRt*()` call across `include/speech_core/models/litert_engine.h` and `src/models/litert/litert_supertonic_tts.cpp` against the exported `.dynsym` tables of both `2.1.5` and `2.3.2`:

- **Engine wrapper (`include/speech_core/models/litert_engine.h`):** `LiteRtCreateCompiledModel`, `LiteRtCreateEnvironment`, `LiteRtCreateManagedTensorBuffer`, `LiteRtCreateModelFromBuffer`, `LiteRtCreateModelFromFile`, `LiteRtCreateOptions`, `LiteRtDestroyCompiledModel`, `LiteRtDestroyEnvironment`, `LiteRtDestroyModel`, `LiteRtDestroyOptions`, `LiteRtDestroyTensorBuffer`, `LiteRtLockTensorBuffer`, `LiteRtSetOptionsHardwareAccelerators`, `LiteRtUnlockTensorBuffer`. *(Note: `LiteRtHostBuffer` is a C++ helper wrapper type inside `litert_engine.h`, not an exported `libLiteRt.so` C function.)*
- **Supertonic wrapper (`src/models/litert/litert_supertonic_tts.cpp`):** `LiteRtDestroyCompiledModel`, `LiteRtDestroyModel`, `LiteRtGetMainModelSubgraphIndex`, `LiteRtGetModelSubgraph`, `LiteRtGetNumSubgraphInputs`, `LiteRtGetSubgraphInput`, `LiteRtGetTensorName`, `LiteRtRunCompiledModel`.
- **Result:** All **21** real `LiteRt*()` C runtime functions called by `litert_engine.h` + `litert_supertonic_tts.cpp` are exported in **both `libLiteRt.so` `2.1.5` and `2.3.2`**. The sole symbol removed in `2.3.2` (`LiteRtSetEnvironmentOptionsValue`) is **not called**. Binary signature/struct layout compatibility across `third_party/litert` headers vs `2.3.2` C structs still requires real arm64 NDK compilation to confirm.

---

## 5. Immutable `utf8proc` Pin & Complete `TTSInterface` Link Closure

Inspected pinned `soniqo/speech-core` `CMakeLists.txt` (`L314-329`) and `src/tts_synthesis_options.cpp`:

1. **`utf8proc` immutable pin:** `CMakeLists.txt` declares `GIT_TAG v2.11.0` on `https://github.com/JuliaStrings/utf8proc.git`, which resolves to commit **`d7bf128df773c2a1a7242eb80e51e91a769fc985`**.
2. **`TTSInterface::synthesize_with_options` closure:**
   - `include/speech_core/models/litert_supertonic_tts.h` inherits `TTSInterface`.
   - `src/tts_synthesis_options.cpp` (`L149-151`, `L167-170`) defines `TTSInterface::synthesize_with_options` and calls `internal::apply_tts_postprocess_owned`, which pulls:
     - `include/speech_core/audio/offline_spectral_de_esser.h`
     - `src/audio/offline_spectral_de_esser.cpp` (`1,711` lines)
     - `third_party/fftooura/ooura_fft_engine.cpp` + `third_party/fftooura/fft4g.cpp` (Ooura FFT; no ONNX Runtime or `libcurl`).
3. **Complete minimal non-stubbed Supertonic-only CMake unit list (prior to compile test):**
   - `src/models/litert/litert_supertonic_tts.cpp`
   - `src/models/litert/supertonic_tokenizer.cpp`
   - `src/util/text_chunker.cpp`
   - `src/tts_synthesis_options.cpp`
   - `src/audio/offline_spectral_de_esser.cpp`
   - `third_party/fftooura/ooura_fft_engine.cpp` + `third_party/fftooura/fft4g.cpp`
   - Static dep: `utf8proc` (`d7bf128df773c2a1a7242eb80e51e91a769fc985`)
   - Shared libs: prebuilt `jni/arm64-v8a/libLiteRt.so` + Android NDK `log` (`-llog`), with **zero ONNX Runtime** (`SPEECH_CORE_WITH_ONNX=OFF`) and **zero `libcurl`** (`SPEECH_CORE_WITH_HF_DOWNLOAD=OFF`).

---

## 6. Updated Gate Status (What Changed vs Still Open)

| Gate | Status | Evidence |
|---|---|---|
| LiteRT `2.3.2` & `2.1.5` AAR byte sizes & SHA-256 | **CLOSED** | Computed directly from Google Maven `HTTP 200` downloads |
| Extracted `jni/arm64-v8a/libLiteRt.so` ELF64 & `.dynsym` audit | **CLOSED** | `EM_AARCH64`, `SONAME libLiteRt.so`, NDK-only `DT_NEEDED`, 436 `LiteRt*` exports |
| `LICENSE` & `THIRD_PARTY_NOTICE.txt` byte/hash verification | **CLOSED** | Apache-2.0 (`13,575` B) & notices (`1,960,672` B) hashed cleanly |
| `2.1.5 → 2.3.2` Supertonic C-API symbol presence | **CLOSED** | 21/21 called `LiteRt*()` C functions present (`LiteRtHostBuffer` is C++ helper) |
| `TTSInterface` link closure + immutable `utf8proc` SHA | **CLOSED** | Ooura de-esser closure mapped; `utf8proc` `v2.11.0` = `d7bf128df773c2a1a7242eb80e51e91a769fc985` |
| Isolated arm64 NDK CMake compile/link smoke build | **OPEN** | Header/struct ABI compatibility between `third_party/litert` and `2.3.2` `.so` requires real NDK build |
| Cancellation entry-race (`cancelled_ = false`) fix & tests | **OPEN** | Must serialize start/cancel handshake & generation token before JNI adapter |
| `OPPO Find X6 Pro PGEM10` runtime & Russian corpus benchmark | **OPEN** | Not run; CPU harness before separate Qualcomm NPU (`SM8550` / HTP v73) track |
