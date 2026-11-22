# Russian-first voice stack research for Jarvis

Date: 2026-11-22
Scope: OGAM Android / OPPO Find X6 Pro; offline-first; Russian speech is a release requirement.

## Findings from open projects

### 1. ru-voice-agent — best voice-agent architecture reference

Repository: https://github.com/meshoklv/ru-voice-agent
License: MIT (repository source code).
Companion benchmark: https://github.com/meshoklv/ru-speech-bench (MIT).

What is reusable:
- A single duplex voice-session pipeline: audio capture → correct sample-rate conversion → streaming ASR → end-of-turn detector → LLM stream → sentence chunker → TTS → ordered audio playback.
- First-sentence speech starts before the LLM finishes its full answer.
- Barge-in cancels current speech as soon as the person starts speaking.
- LLM fallback is selected before the first spoken word, never halfway through a sentence.
- Local logs contain text/timings but deliberately do not store raw audio.
- Every remote endpoint is token-gated and loopback-only by default; cloud TTS is optional, not required.
- The benchmark records actual hardware, measured latency, caveats and separate code/model licenses.

Not directly portable: this project is a Python/Linux server plus browser client, not an Android library. Its pipeline is an architecture and test reference; OGAM needs native Kotlin/React Native lifecycle, Android audio focus, OPPO background policy and device-specific profiling.

### 2. Streaming Russian ASR candidates

| Candidate | License | Evidence / strengths | Limitations / Jarvis decision |
|---|---|---|---|
| Existing OGAM Whisper realtime | Existing dependency; model-specific terms to verify | Already wired to native recording, streaming transcription, cancellation and model downloads | Preserve; first migrate the private `@offgrid/speech` state/timer contracts |
| T-one | Apache-2.0 code and weights | Russian Conformer CTC; 300 ms input chunks; benchmark measured ~99–123 ms per chunk and RTF 0.31 on an 8-vCPU Xeon with one ORT thread | 145 MB model; output alphabet has no digits, Latin letters or punctuation. Could be a fast Russian draft, not the sole transcript. No OPPO Android runtime test yet |
| GigaAM-v3 via sherpa-onnx | MIT code/weights per upstream project and benchmark audit | Russian ASR, punctuation, digits/Latin output; good offline batch transcription candidate | Not streaming; model package about 232 MB; use for final correction or recorded files, not immediate duplex turn-taking |
| Qwen3-ASR already in OGAM | Verify exact model/runtime license and revision before shipping | Existing OGAM path already supports local Qwen3-ASR plus Whisper fallback | Preserve and test; do not assume its model/runtime supports all streaming modes |

Possible routing to benchmark, not yet implemented:
1. Existing Whisper realtime remains the current baseline.
2. T-one may be tested as an optional low-latency Russian streaming hypothesis.
3. Whisper or GigaAM can correct technical terms, Latin names and digits after the turn.
4. Never silently substitute a low-confidence transcript: show confidence/uncertainty and ask the person to repeat when necessary.

T-one measurements and caveats are from the MIT benchmark project, not from Android hardware. The benchmark explicitly states its disagreement figures are not human-labelled WER.

### 3. VAD and end-of-turn detection

- Silero VAD: MIT code and ONNX model; small model (about 1.2–2.2 MB in the benchmark package), supports 8 kHz and 16 kHz chunks. The benchmark measured roughly 0.5–0.6 ms per 32 ms chunk on an older Xeon CPU. This is a promising local VAD candidate, but OPPO latency, battery, false starts and microphone noise must be measured.
- Smart Turn v3.2: 8.3 MB ONNX, BSD-2-Clause weights. Upstream publishes Russian benchmark metrics, but the independent benchmark's monologue tests were weak (AUC 0.635 on a limited mid-word-cut experiment) and explicitly says a labelled real-dialogue set is needed. Defer as a default.
- Do not equate silence with a completed thought. Use VAD for speech boundaries plus configurable silence; test interruption, breathing pauses, multi-sentence speech and noisy rooms.
- Current OGAM voice settings (tap/silence/hands-free, silence delay, speaker drain) must be retained and migrated from `@offgrid/speech`, not simplified away.

### 4. Russian TTS candidates and license gates

| Candidate | Code/runtime | Voice/model status | Jarvis decision |
|---|---|---|---|
| sherpa-onnx | Apache-2.0; Android arm64 Kotlin/Java APIs; supports VITS/Piper, Kokoro, VAD, ASR and other offline speech tasks | Runtime license does not grant voice/model rights; each ONNX voice and phonemizer/data pack must be checked separately | Strong native Android runtime candidate; test as an OGAM optional engine after exact ABI/APK-size review |
| Piper VITS voices through sherpa-onnx | sherpa-onnx runtime can run VITS/Piper models; no need to embed the Piper Python runtime | Voice weights carry per-model cards. Russian `denis`/`dmitri` cards and training provenance have conflicting/stale public descriptions; a maintainer issue dated Nov 19, 2026 says current main was retrained away from the Lessac base, with Denis CC0 and Dmitri CC BY 4.0 dataset chain. Pin the exact current revision and obtain the updated model cards before shipping. `ruslan` is CC BY-NC-SA; `irina` has no clear license on its card | Do not package any Russian Piper voice yet. Re-check exact revision, model card, base provenance, file hashes and commercial/use rights. Do not include the GPL-3.0 Piper runtime |
| Silero v5_5_ru | Silero runtime code may be MIT; model weights are CC BY-NC-SA 4.0 | Natural Russian with stress/homograph handling; the independent RuVoice Android project integrates it but its repository license is CC BY-NC-SA 4.0 | Non-commercial model only; do not use as OGAM default |
| Silero v5_cis_base / v5_cis_base_nostress | Model license MIT according to Silero model docs | Large set of CIS voices including Russian; some are non-native speakers and can have accents; `nostress` does not provide the full v5 stress/homograph behaviour | Research candidate for a separately implemented Android backend; verify model export format, provenance, exact voice quality and on-device compatibility |
| Kokoro-82M | Apache-2.0 weights; React Native ExecuTorch TTS API supports Kokoro | Strong natural voice; Russian is not an official stock language. Russian via espeak G2P can misplace stress. Kokoro-RU fine-tune has OpenRAIL tag and incomplete terms/provenance audit | Preserve current Pro Kokoro architecture as optional multilingual TTS; not the Russian-first default until stress/quality benchmark passes |
| Qwen3-TTS 1.7B | Apache-2.0 declared | Russian capable, but benchmark used RTX 3090 Ti; 4.54 GB weights + 0.68 GB tokenizer; measured RTF 2.8–3.3 on that GPU, with reference leakage and no verified mobile streaming | Optional PC/LAN research only; not a phone default |
| ESpeech-TTS-1 RL-V2 | Apache-2.0 declared for weights; base-model license unverified | Promising Russian stress/quality and GPU measurements | PC/LAN research only until base provenance and mobile runtime are verified |

Important licensing distinction:
- `VoxSherpa-TTS` is GPL-3.0; use only as an architecture reference unless OGAM intentionally accepts GPL-3.0 obligations.
- The newer Piper runtime `OHF-Voice/piper1-gpl` is GPL-3.0. The archived original Piper code had MIT, but it is not the same maintained runtime. Do not assume the old license applies to the current runtime.
- Model repository metadata (e.g. a top-level MIT tag) does not override an individual voice's MODEL_CARD, training data or upstream dataset terms.
- Never package weights based only on a model name, a benchmark table or an unpinned mirror.

### 5. Existing OGAM advanced speech features to retain

The current OGAM test tree shows the Pro audio layer already has:
- streaming sentence-by-sentence TTS coordinator;
- final-turn speech and streaming-tail flush;
- playback state machine with monotonic session IDs and stale-session race guards;
- pause/resume/stop, elapsed/duration/amplitude state;
- TTS engine subscription, download provider and engine lifecycle tests;
- Kokoro model and voice catalog tests;
- audio waveform and streaming clock tests.

The implementations live in the private `pro/audio` workspace and are not present in the public standalone branch. Their tests are valuable behavioural contracts, but they are not a substitute for the missing implementation. Rebuild or port each capability under the global `search → inspect → compare → license-check → adapt/integrate → test → document` policy. Do not disable audio mode or replace it with a no-op.

## Proposed Jarvis voice architecture

1. **Audio I/O owner:** Android AudioRecord/AudioTrack, audio focus, Bluetooth route changes, echo cancellation/noise suppression where supported, foreground session lifecycle.
2. **VAD/turn owner:** Silero VAD (candidate) with explicit turn settings; optional Smart Turn only after a Russian dialogue benchmark.
3. **ASR router:** Whisper realtime baseline; optional T-one streaming; Whisper/GigaAM/Qwen fallback/correction based on confidence and task.
4. **Conversation stream:** one user turn and one assistant turn with cancellation tokens; model output is chunked by sentence without speaking internal reasoning.
5. **TTS router:** local Russian engine first; multilingual Kokoro/ExecuTorch optional; no silent cloud fallback.
6. **Playback coordinator:** monotonic session token, one playback state machine, sentence queue, stale event rejection, barge-in and cleanup.
7. **Text normalizer:** Russian numbers, dates, time, units, currencies, abbreviations, Latin technical terms, homographs and stress dictionary before TTS.
8. **Diagnostics:** timing metadata and error codes; never store raw audio unless the person explicitly chooses to save a recording.

## Device evaluation required before choosing defaults

Run on OPPO Find X6 Pro (Android/ColorOS build recorded):
- cold/warm model load, first audio latency, RTF, CPU/GPU, RAM, APK/asset size, thermal throttling and battery per 10 minutes;
- 1/2/4-thread configurations; background/foreground and screen-off behavior;
- Russian conversational dialogue with interruptions, pauses, numbers, dates, names, Latin IT terms, profanity and noisy environment;
- ASR WER/CER against a human-labelled corpus (not cross-engine disagreement);
- TTS listening panel and pronunciation/stress error set;
- model cancellation/unload/reload, incoming call, Bluetooth headset and permission revocation.

No TTS model has been selected as the default. No large model or voice pack has been downloaded by this research step.


## sherpa-onnx Android integration feasibility (v2.0.3)

The official Android source was inspected, not just the README:
- Kotlin/JNI wrappers include `Vad` with Silero VAD configuration and `OfflineTts` with VITS, Kokoro and other model families.
- The Android AAR module declares minSdk 21 and exposes Kotlin APIs; the JNI library is loaded from `sherpa-onnx-jni`.
- The official v2.0.3 release publishes a full Android AAR (52,411,426 bytes; SHA-256 `4c766e2e74c9d33d595338c21fe3b305c73ba45d47e96a235675c33142a2ec50`) and an Android native archive (47,988,767 bytes; SHA-256 `2a30b222abae6d5cf544df4a1c27944279449c25dbb9c755097189cb45db1df0`). This is too large to add casually just for VAD.
- The AAR project README shows how to build a local AAR from the release's native libraries. A slim arm64-only build or a custom static/shared runtime may reduce size, but must be measured and reproduced in CI; do not assume the full AAR is the right package.
- The library is Apache-2.0. The model and phonemizer assets remain separately licensed.
- The upstream sample system TTS engine demonstrates that a proper Android `TextToSpeechService` is possible; Jarvis can first call the library directly for its own speech and later optionally expose a system TTS engine.

Integration decision: **candidate only, not yet added to OGAM dependencies**. First prove an arm64-only package build, ABI compatibility with OGAM's NDK/CMake settings, release APK delta, cold-start and model performance. Do not bundle model weights in the APK; download selected assets only after explicit user confirmation, with exact size, SHA-256, license and storage/RAM disclosure.

Official source paths inspected:
- `android/SherpaOnnxAar/README.md`
- `android/SherpaOnnxAar/sherpa_onnx/src/main/java/com/k2fsa/sherpa/onnx/Vad.kt`
- `android/SherpaOnnxAar/sherpa_onnx/src/main/java/com/k2fsa/sherpa/onnx/Tts.kt`
- Release: https://github.com/k2-fsa/sherpa-onnx/releases/tag/v2.0.3
