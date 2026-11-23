# OGAM / Jarvis — Low-Latency Android VAD Comparison: TEN VAD vs Silero VAD
Date: 2026-11-23
Target: OPPO Find X6 Pro PGEM10 / Snapdragon 8 Gen 2 (SM8550) / Android 16 / ColorOS 16.0.5
Status: public source/API audit. No dependency, model, or APK changed; no PGEM10 execution or acoustic benchmark performed.

## Executive decision

A useful new VAD comparison route is available inside the same Android Kotlin API in sherpa-onnx:

- Silero VAD: conservative baseline, 16 kHz input, 512-sample window (32 ms), threshold and speech/silence duration controls.
- TEN VAD: low-latency challenger, 16 kHz input, 256-sample hop (16 ms) in sherpa-onnx's Kotlin configuration. TEN's own Android example also accepts 256-sample signed-PCM frames and returns a probability/voice flag.
- Both can be compared behind one small VAD adapter, without changing OGAM's microphone capture owner.

**Recommendation:** add TEN VAD to the benchmark matrix beside Silero, but do not replace OGAM's current endpoint logic or claim TEN is better on PGEM10. TEN's published speed/latency claims are vendor/author measurements on other devices and its license is Apache-2.0 with additional conditions, not plain Apache-2.0. Review the complete license and notices before redistributing it.

## 1. TEN VAD — why it is worth testing

Repository: https://github.com/TEN-framework/ten-vad
Public release: v1.0 (Android prebuilt libraries and Android support announced in release notes).
Root license: Apache 2.0 with additional conditions; `pitch_est.cc` contains modified LPCNet-derived code with BSD-2-Clause/BSD-3-Clause notices. Treat the license as a review gate, not as plain Apache-2.0.

Observed Android-facing API in upstream README:
- `TenVad(hopSize, threshold)`
- `process(short[] audioData)`
- result probability in [0,1], binary flag and voice-detected boolean
- explicit `destroy()` cleanup
- 256 signed-PCM samples at 16 kHz = 16 ms per frame in the example
- NDK/CMake build route for Android arm64-v8a.

The upstream README lists 16 kHz and hop sizes of 160 or 256 samples (10 or 16 ms). It reports 373 KB for arm32 and 532 KB for arm64, plus author-reported RTF 0.057 on a Galaxy J6+ and 0.049 on Oppo A3s. These are older/low-end devices, not PGEM10, and the reported RTF is not a measured end-of-utterance delay.

TEN claims faster speech-to-non-speech transition detection than Silero in its conversational-agent evaluation. This is a reason to benchmark it for Jarvis response turn-taking, not independent proof of superiority in Russian, far-field, music, car noise or ColorOS.

## 2. sherpa-onnx Kotlin API — common comparison seam

Repository: https://github.com/k2-fsa/sherpa-onnx (Apache-2.0 runtime code).
Inspected Kotlin API: `sherpa-onnx/kotlin-api/Vad.kt`.

The same `VadModelConfig` supports both:
- `SileroVadModelConfig`: default windowSize 512 samples, 16 kHz, threshold 0.5, min speech 0.25 s, min silence 0.25 s, max speech 5 s.
- `TenVadModelConfig`: default windowSize 256 samples, 16 kHz, threshold 0.5, min speech 0.25 s, min silence 0.25 s, max speech 5 s.
- `Vad` consumes FloatArray frames via `acceptWaveform`, exposes queued `SpeechSegment` output, `isSpeechDetected`, `flush`, `reset`, and `release`.
- The default sample config uses one CPU thread.

This shared API makes a controlled VAD bake-off easier: same recorder samples, same app lifecycle, same endpoint policy, same test clips; only the model/runtime configuration changes. sherpa-onnx's own documentation lists a 629 KB Silero ONNX model (16 kHz), a 208 KB INT8 Silero model (16 kHz), and larger v4/v5 alternatives. It also publishes Android pure-VAD sample apps.

Important: the model file license and provenance must be checked separately from the sherpa-onnx runtime's Apache-2.0 code license.

## 3. Silero VAD — baseline and trade-off

Official repository: https://github.com/snakers4/silero-vad
Root repository license: MIT.
Current upstream version-history page reports v6.2 (2025-12-10) and a streaming VAD model with about 260K parameters. The official repository says ONNX can run on supported architectures when the integrator supplies its own audio I/O and wrapper/post-processing.

For OGAM, however, the exact Silero model export used by sherpa-onnx is the practical mobile baseline. Do not assume that the newest official upstream ONNX export and sherpa-onnx's bundled 629 KB/208 KB models are byte-identical or have identical streaming-state contracts. Pin the exact artifact, checksum and input window before implementation.

Silero's established strength is a compact, streaming, multilingual speech detector. Its endpoint timing is tunable, but the TEN project's published comparison reports several-hundred-millisecond speech-end delay in its chosen conversational test. That report is not a neutral head-to-head benchmark and should only motivate measuring both under the same OGAM corpus.

## 4. OGAM integration boundary

Existing OGAM source audit already established:
- `AudioRecorderService` is the only physical microphone owner.
- Its existing sample stream emits 16 kHz mono Float32 samples.
- `recorderAudioStream` has a separate PCM16 conversion path for the Whisper adapter; VAD should consume the original Float32 stream where possible.
- `recordingController` and `useVoiceSessionDriver` own capture/session lifecycle.
- The current JS RMS/silence endpoint heuristic is not neural VAD.
- The Android player remains the sole AudioTrack/AudioFocus owner.
- Echo cancellation is not proven; half-duplex remains the safe default.

Therefore:
1. Add a VAD adapter that accepts frames from the existing Float32 recorder stream. Never instantiate a second AudioRecord or start another microphone.
2. Use a bounded frame queue and a single serialized inference lane; do not block the audio callback on native inference.
3. For TEN VAD, convert Float32 to signed PCM16 only inside the adapter if using its direct Java/JNI API; for sherpa's Kotlin API, feed FloatArray frames as declared.
4. Keep speech detection separate from end-of-turn policy. VAD reports frame-level activity; OGAM owns pre-roll, hangover, minimum speech duration, maximum utterance duration and finalization.
5. Keep the current user-visible push-to-talk path working if VAD initialization fails. No silent fallback should claim neural VAD is active.
6. Do not use VAD as a wake-word detector. It cannot identify «Джарвис».
7. Do not enable full-duplex barge-in based on VAD alone. Playback echo can trigger VAD; true barge-in still requires a timestamp-aligned playback reference and verified AEC.

## 5. PGEM10 benchmark protocol

Use the existing Russian audio evaluation corpus and the same source PCM for each backend.

Measure:
- speech onset delay and speech-offset/end-of-utterance delay;
- missed short speech, clipped first/last phonemes and pause handling;
- false speech activation per hour in silence, music, TV, fans, road noise and Jarvis playback;
- CPU time per second of audio, peak RSS, native allocations and thread count;
- cold start, model load, battery delta and thermal behavior;
- effect of 10 ms vs 16 ms frame size and 1 vs 2 CPU threads;
- actual device state: screen on/off, foreground/background, locked/unlocked and audio-route changes.

Test Russian speech with quiet and noisy recordings, male/female voices, whispering, short commands, long sentences, natural pauses and speech overlapping playback. Keep thresholds and silence durations fixed during the first backend comparison; tune only in a second pass.

Acceptance gates:
- no second microphone owner;
- no blocking inference in the capture callback;
- no regression in first/last phoneme retention;
- false activation and end delay must be reported separately;
- CPU/RAM/battery cost must fit a long-running local assistant budget;
- exact model/runtime hashes and license notices are recorded.

## 6. Candidate decision table

| Candidate | Strength | Limitation / gate | OGAM role |
|---|---|---|---|
| TEN VAD | 16 ms frame option; Android native API; conversational endpoint focus; small reported library | Apache-2.0 with additional conditions; reported benchmarks are not PGEM10; exact artifact and notices need pinning | Low-latency challenger |
| Silero VAD via sherpa-onnx | Common Kotlin API; streaming; 16 kHz; compact ONNX options; Apache runtime | Published TEN comparison reports slower endpoint timing; exact model artifact license/hash must be verified | Stable baseline |
| Current OGAM RMS endpoint | Already present; no extra model/dependency | Heuristic, not neural VAD; noise/quiet speech limitations | Keep as fallback and benchmark control |

## 7. Next action

Before any app change, build a benchmark-only VAD harness against the existing shared PCM source. First compare Silero and TEN through the sherpa-onnx Kotlin API if the exact TEN model artifact and license notices can be pinned. If not, use the direct TEN Android JNI library only in an isolated module after legal review. Do not add the dependency to production yet.

## Sources
- TEN VAD: https://github.com/TEN-framework/ten-vad
- TEN VAD v1.0 release: https://github.com/TEN-framework/ten-vad/releases
- sherpa-onnx Kotlin VAD API: https://github.com/k2-fsa/sherpa-onnx/blob/master/sherpa-onnx/kotlin-api/Vad.kt
- sherpa-onnx Silero VAD model sizes and Android examples: https://k2-fsa.github.io/sherpa/onnx/vad/silero-vad.html
- Silero VAD upstream and license: https://github.com/snakers4/silero-vad
- Silero VAD version history: https://github.com/snakers4/silero-vad/wiki/Version-history-and-Available-Models
- Existing OGAM voice architecture and microphone/AEC boundaries: https://github.com/sokfrut-tech/OGAM/blob/docs/research-breeno-coloros-2026-11-22/research/voice/OGAM_VOICE_STACK_REALITY_AUDIT_2026-11-22.md
