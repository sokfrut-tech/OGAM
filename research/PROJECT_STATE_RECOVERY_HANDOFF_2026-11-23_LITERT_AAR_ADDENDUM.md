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

## Evidence state
| Gate | State |
|---|---|
| Version/publication and Android baseline | CONFIRMED |
| AAR path and arm64 member path | CONFIRMED from official Google codelab |
| Exact AAR / .so hashes and ELF audit | OPEN |
| Exact notice-file bytes | OPEN |
| Speech-core interface link closure | OPEN |
| Native compile/link | NOT RUN |
| Cancellation race fix/tests | NOT DONE |
| OPPO PGEM10 device test | NOT RUN |

## Next safe sequence
1. In a manual-only CI job, download the exact AAR from Google Maven and calculate hashes from bytes.
2. Verify ZIP entries, preserve LICENSE and THIRD_PARTY_NOTICE.txt, inspect AArch64 ELF and dynamic symbols.
3. Finish the real TTSInterface/vtable link closure review; do not stub virtual behavior.
4. Build an isolated CPU-only arm64 JNI smoke library against the pinned speech-core commit. Fail if ONNX Runtime or libcurl is linked.
5. Add generation-based cancellation and race tests before considering a Kotlin/JNI adapter.
6. Only after CPU proof, consider a separate Qualcomm NPU feasibility track for SM8550/HTP v73.
7. Keep all changes in the research branch and PR #2 Draft. Do not merge or modify production app code.

## Repository state after this addendum
The research branch head and main branch must be checked from GitHub before any subsequent writes; this addendum is not a production implementation or device validation.
