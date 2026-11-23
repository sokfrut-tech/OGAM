# OGAM / Jarvis — Android Streaming Speech Stack and Russian Model Candidates
Date: 2026-11-23
Target: OPPO Find X6 Pro PGEM10 / SM8550 / Android 16 / ColorOS 16.0.5
Status: public source audit and integration assessment. No source code or model added to OGAM; no model weights downloaded; no APK built; no PGEM10 runtime test.

## Executive decision

A new candidate deserves priority over the previous "Qwen batch ASR only" baseline:

**Soniqo Speech Android + speech-core** provides an Android Kotlin/JNI package and a 120M Parakeet-EOU streaming ASR path. The project README reports 153 MB model download, 232 MB peak memory, 25 European languages; the upstream NVIDIA Parakeet-TDT v3 language list explicitly includes Russian. The Android SDK uses Parakeet-EOU as its low-memory default and exposes partial transcription / streaming APIs. This is a strong benchmark candidate for Russian live ASR, not yet an OGAM integration decision.

A separate TTS candidate also improved materially:
- **Supertonic-3** explicitly supports Russian among 31 languages. The Soniqo Android package lists a ~380 MB LiteRT bundle and 832 MB peak memory. This is plausible for an on-demand high-quality Russian voice, but its model license is OpenRAIL-M (not a permissive Apache/MIT model license), and the original Supertonic repository announced it would be archived in July 2026. Legal/maintenance review and device benchmarks are mandatory.
- **Qwen3-TTS Android** is a real local Android CPU implementation using a Q4_K_M 0.6B model and JNI/C++ runtime. The Android app wrapper is MIT and the official Qwen3-TTS source is Apache-2.0; model-conversion/quantized artifacts have their own provenance and terms. It remains a second benchmark candidate for expressive/custom voice, not a proven fast always-on voice on PGEM10.

**Do not replace OGAM's voice stack wholesale.** Treat Soniqo as a reference implementation and benchmark harness. Preserve OGAM's own conversation, role, permissions, tool registry, data storage and Jarvis UI.

## 1. Soniqo speech-core — source audit

Repositories:
- https://github.com/soniqo/speech-core
- https://github.com/soniqo/speech-android
- Core inspected main tree commit: `59b9d7902ea62dbbbfb95e139e2bf0e8957f8753`
- Core docs/models blob: `20001cff4ddd538bd3fddf9e9ad75d0193c3d3e6`
- Core docs/pipeline blob: `dcf4bae986aed4be6d85242ff7218784ee01c01c`
- Android tree commit: `66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded`
- Android README blob: `93bbca79eb76b318dcae5664ef84f6cdc2ee9f6d`
- Android README_ru blob: `8d13ae39fff8ecb7dfaa669f2a8d2bf1461291ee`
- Android SDK CMake blob: `35f77921dbfcd4f1942fe72fb41939f51d704824`
- Android license: Apache-2.0.
- Core license: Apache-2.0.

### What is real in source

The core is C++17 and separates the voice orchestration from concrete model backends. It has a state machine for Idle, Listening, Transcribing, Thinking and Speaking; turn detection; queued speech; cancellation; and interruption events. It exposes C API / JNI-friendly interfaces. The Android repository is a Kotlin SDK/JNI wrapper around that core, not merely a demo UI.

The Android README says:
- default Parakeet-EOU 120M: 153 MB download, 232 MB peak memory, 25 languages;
- optional Parakeet TDT v3: 891 MB download, ~1.1–1.3 GB peak memory, 25 European languages;
- optional Nemotron-3.5 multilingual streaming: ~721 MB LiteRT INT8, 100+ languages, peak memory not yet measured;
- default Kokoro TTS: 330 MB download / 640 MB peak, but only 8 languages and no Russian;
- optional Supertonic-3: ~380 MB / 832 MB peak, 31 languages;
- Silero VAD v5: 2 MB / <10 MB peak;
- DeepFilterNet3: 8.2 MiB model, CPU streaming enhancement; README reports 40 ms model delay plus resampling latency.

The default Android SDK path is intentionally low-memory: Parakeet-EOU + short-turn Kokoro. The demo app can choose the larger Parakeet TDT path. It accepts 16 kHz mono Float32 PCM through `pipeline.pushAudio(samples)`; the app remains responsible for microphone capture and feeding samples. This is important for OGAM: we can preserve one physical mic owner and bridge the existing recorder into the SDK rather than adding another AudioRecord.

### Russian ASR candidate: Parakeet-EOU 120M

- The official NVIDIA `parakeet-tdt-0.6b-v3` model card explicitly lists Russian among 25 languages and is CC-BY-4.0.
- Soniqo's Android README states Parakeet-EOU 120M is the small streaming model from the same 25-language family, with live partials and explicit end-of-utterance support.
- The SDK's README describes ~340 ms partial update cadence in its separate dictation guide and reports 232 MB peak RSS for the 120M Android model. These are vendor-reported measurements, not PGEM10 measurements.
- The Android API supports `StreamingTranscriber.beginStream()`, chunked `pushAudio()`, and `endStream()`; it emits partials and final text. Parakeet autodetects language and does not accept a forced-language prompt.
- This could provide a more responsive live Russian transcript than OGAM's current Qwen whole-WAV path. Compare accuracy, punctuation, names, technical terms, noise, far-field speech and memory against Qwen3-ASR 0.6B and Whisper on the exact same Russian test set.

Important caveat: Parakeet-EOU is not a wake-word detector. Its ASR transcript can be used as a second-stage confirmation after a small KWS model, but running a 120M ASR continuously as the primary wake-word engine is not recommended without measured CPU/battery cost.

### Russian ASR candidate: Nemotron-3.5 streaming 0.6B

- NVIDIA's model card lists Russian `ru-RU` and a broad multilingual set.
- Soniqo Android exposes a LiteRT backend and language-prompted streaming API; the model bundle is ~721 MB INT8 in its README.
- Peak memory is explicitly not yet measured in the Android README. Do not treat it as a low-memory choice or assume 100+ languages guarantees better Russian quality.
- Use only as a second benchmark tier after Parakeet-EOU. It may provide language selection / multilingual flexibility but has a substantially larger bundle.

### TTS candidates in the Soniqo stack

- Kokoro 82M is the low-memory default but its published language list excludes Russian. It is not the Russian Jarvis voice solution.
- Supertonic-3 is listed as Russian-capable via its 31-language model and Android LiteRT backend. Vendor Android README reports ~380 MB download and 832 MB peak memory. It is a promising Russian on-device TTS candidate for measurement.
- Pocket TTS 100M is a streaming TTS model in the SDK, but its published voice/language is English-only. Do not select it for Russian.
- VoxCPM2 and Chatterbox have higher memory/model complexity; not first choices for the user's mobile-first Russian voice path.

### AEC / interruption — do not over-read the demo tests

The core pipeline has interruption state transitions and cancels TTS / clears the speech queue when incoming speech is confirmed. The Android `BargeInTest` uses pre-synthesized PCM fixtures and pushes them into the pipeline; this verifies software state-machine interruption behavior. It does **not** prove acoustic barge-in on a phone speaker/microphone in a real room.

The core docs describe an optional `OnnxLocalVQEEchoCanceller` with hybrid DSP + neural AEC. Its microphone and playback reference must be independently captured and timestamp-aligned through `TimestampedEchoCancellationStream`. The docs explicitly say missing timestamps, buffer overrun or AEC inference errors surface as failures; raw mic audio is not emitted as fallback. This is the correct safety principle.

The model wrappers docs state current reference ONNX/LiteRT wrappers are CPU-only; NNAPI/GPU/Hexagon delegates are not wired in the core reference wrappers. Thus the Soniqo package is not proof of QNN/HTP use on SM8550. Its Android README defaults `useNnapi=false` and calls NNAPI deprecated/unmeasured. No NPU acceleration claim should be carried into OGAM.

**Integration decision:** use Soniqo as a candidate for isolated ASR/TTS/turn-state benchmarks. Do not transplant its whole VoicePipeline until checking cancellation, output audio timestamps, AEC playback reference, model load/unload, service lifecycle and OGAM's existing voice session state. AEC must be measured on actual PGEM10 hardware before enabling full-duplex.

## 2. Supertonic-3: Russian TTS and license/maintenance caveats

Official model card: https://huggingface.co/Supertone/supertonic-3
- Lists 31 languages including `ru`.
- Model size approximately 99M parameters across public ONNX assets.
- Fixed preset voices; model supports expression tags such as laugh, breath and sigh.
- Model is under OpenRAIL-M, while sample code is MIT. These are separate licenses.
- Supertonic Android wrapper from Soniqo uses LiteRT, not ONNX in the Android SDK path.

Original open-source repo notice (mirrored in public README): on July 23, 2026, the upstream Supertonic repository announced it would be archived and receive no further development/official support; Voice Builder access ended August 31, 2026. Treat the model as an available static model, not an actively maintained upstream dependency. Check the exact model license and acceptable-use conditions before redistribution.

**Benchmark priority:** compare Russian intelligibility, stress placement, names/abbreviations, naturalness, chunk latency, memory and thermal load against Piper voices and Qwen3-TTS. Do not select based only on its 31-language claim.

## 3. Qwen3-TTS Android: real local implementation, but benchmark tier

References:
- https://github.com/QwenLM/Qwen3-TTS
- https://github.com/Danmoreng/qwen3-tts-android

Source facts:
- Official Qwen3-TTS repository is Apache-2.0 and lists Russian among 10 languages. It supports 0.6B and 1.7B families, streaming generation, custom voice and voice design.
- The Android example app is MIT, Kotlin/Compose + JNI/C++, with Qwen3-TTS.cpp as a submodule. It downloads a Q4_K_M tokenizer and 0.6B Base talker GGUF into app-private storage; its README states CPU runtime, arm64, Android 12+.
- The Android wrapper does not prove OPPO/SM8550 latency, battery or thermal performance. Its quantized GGUF files are hosted in a separate Hugging Face repository; verify model provenance, exact revision, conversion method, hash and license before reuse.
- Official Qwen3-TTS docs' advertised low first-packet latency is an upstream model/runtime claim; do not assume it transfers to this Android CPU port.

**Decision:** retain as a second TTS track for custom voice / expressive speech. Compare the smallest supported Q4 model against Supertonic-3 on PGEM10. Do not keep a 0.6B TTS model resident alongside the LLM/ASR unless memory and thermal tests support it.

## 4. Voicute onnx-wakeword — useful small KWS architecture, no Russian model

Repository: https://github.com/voicute/onnx-wakeword
- Repo inspected main tree: `826687a44e83e042cdeb49747448a687d0da2b27`
- README blob: `28b714fad42b5abce8c1f931eb2c894ef22eb4c4`
- Android WakeWordEngine blob: `8f80b33282f6e063e6c2977b3a294c363f0db55e`
- Android AudioCapture blob: `0721d3b73fa023c9d13fa4bf90f4aa146d4bb018`
- Android DetectionLogic blob: `997d4c8c7de2daac2e428f96d8f6e04968d9dad7`
- Wrapper license: MIT.

### Positive source evidence

- Tiny Causal TCN classifier, multi-keyword model output, ONNX inference; README claims model size under 130 KB and ~25K parameters.
- Android Java implementation uses ONNX Runtime Android, 16 kHz mono PCM, Mel frontend, model inference and a five-layer anti-false-trigger filter (consecutive frames, peak/background ratio, cooldown, burst detection, optional energy-jump check).
- It has an English `Hey Jarvis` R1 demo model, with a model-info file; this is not a Russian model.
- README states training supports Chinese, English, Japanese, French, German, Spanish and Hindi — **not Russian**.
- The Android sample's `AudioCapture` opens its own `AudioRecord` and runs a separate capture thread. OGAM must not import this capture layer because it would create a second microphone owner. Only the feature/inference/detection pieces could be adapted to the existing OGAM PCM stream.
- README reports held-out TTS recall and false-trigger numbers for listed languages, but these are maintainer-reported test results; not independently reproduced and not evidence for Russian.

### Training/privacy boundary

The README's custom training route is an online service. It says generated synthetic speech is used and optional real recordings can be uploaded; the downloaded inference model then runs offline. Before using the service, inspect its current privacy terms, model redistribution license, retention policy and whether a Russian keyword is accepted. Current published language list excludes Russian, so do not upload user voice data or pay for training based on the present documentation.

Decision: preserve its small-model architecture and multi-layer detection idea as a reference; no model selection/download.

## 5. Russian wake word strategy — revised

No inspected candidate is a ready-to-ship Russian "Джарвис" detector:
- openWakeWord: its standard pretrained training stack is English-centric;
- sherpa-onnx KWS model catalogue: Chinese/English pretrained KWS models, not Russian;
- Voicute: supports seven listed languages, not Russian; hosted training route;
- the community Russian "Мост" example had previously reported 7.2% recall and is not acceptable.

Recommended order:
1. Keep a tiny always-on KWS subsystem separate from full ASR.
2. Obtain a legally redistributable Russian "Джарвис" model or train one with local/licensed data and hard negatives; do not use a cloud service until privacy and model license are verified.
3. Feed the KWS model from OGAM's existing single mic owner, 16 kHz mono PCM; never open a second AudioRecord.
4. After KWS trigger, wake the larger streaming Russian ASR (Parakeet-EOU first benchmark, Qwen3-ASR / Whisper as baselines).
5. Use VAD and ASR to validate the invocation and phrase, then pass a bounded transcript to the conversation engine.
6. During TTS playback, remain half-duplex until a timestamp-aligned AEC path is validated on device.

## 6. Exact benchmark plan for PGEM10

Use one fixed Russian corpus and identical capture files:
- quiet close speech;
- 1–3 m far-field speech;
- whispers and low-volume speech;
- regional accents and male/female voice diversity;
- technical terms, app names, contact names (synthetic only), numbers, dates and addresses;
- television/music/noise and similar-sounding negative phrases;
- assistant TTS playback with no user speech;
- double-talk after AEC is implemented.

Measure per candidate:
- WER/CER and entity/number exact-match rate;
- partial latency p50/p95 and finalization latency;
- real-time factor, CPU load, RSS/peak memory, cold model load;
- battery drain and thermal throttling over 15/30/60 minutes;
- false wake activations/hour and miss rate;
- cancellation correctness and audio queue recovery.

Benchmark matrix:
A. Current OGAM Qwen3-ASR 0.6B batch WAV.
B. Whisper current supported mobile runtime.
C. Parakeet-EOU 120M streaming.
D. Parakeet TDT v3 0.6B (quality reference, high-memory).
E. Nemotron-3.5 0.6B LiteRT (secondary multilingual streaming candidate).
F. TTS: existing Piper candidate(s), Supertonic-3, Qwen3-TTS 0.6B Q4.
G. VAD: current RMS endpoint vs Silero VAD v5, then Smart Turn for turn completion.
H. AEC: none/half-duplex baseline vs timestamp-aligned LocalVQE AEC; do not expose barge-in before it passes.

## 7. Next implementation boundary

No direct dependency import yet. First build an OGAM-owned adapter spike behind a feature flag:
- `SpeechInputSource`: subscribes to OGAM recorder PCM and timestamps; does not own microphone.
- `WakeWordDetector`: model-only KWS interface; CPU first.
- `StreamingAsrBackend`: partial/final transcript and cancel semantics.
- `VoiceTurnCoordinator`: VAD, endpoint/SmartTurn, conversation state.
- `TtsBackend`: streaming PCM frames, cancellation, playback timestamps.
- `EchoReferenceSource`: exact playback PCM + monotonic presentation timestamps.
- `SpeechDiagnostics`: per-stage timings, memory, errors, model revision/hash, runtime/delegate.

The app-level assistant service remains the owner of system invocation, permission checks, tool/action policy and UI. The LLM must not receive unrestricted microphone, shell, accessibility or device-control authority.

## 8. Evidence boundaries

Source-verified:
- Soniqo core/Android public code and documented model wrappers, API shape, licenses and source tests;
- Voicute Java Android inference and capture split; its current language list and MIT wrapper license;
- Qwen Android example code, Q4_K_M 0.6B CPU target, API 31+, MIT app license; official Qwen source Apache-2.0.

Official model-card verified:
- Parakeet TDT v3 supports Russian among 25 languages (CC-BY-4.0);
- Supertonic-3 supports Russian among 31 languages, model license OpenRAIL-M;
- Nemotron-3.5 ASR lists Russian `ru-RU`.

Not verified:
- any of these models on OPPO Find X6 Pro / SM8550;
- real acoustic AEC/barge-in on a phone;
- Russian Parakeet-EOU WER/latency on PGEM10;
- Supertonic/Qwen TTS voice quality on PGEM10;
- any Russian KWS detector quality;
- QNN/HTP execution of any speech model.

No code, model weights, APK or dependency was added to OGAM in this research pass.
