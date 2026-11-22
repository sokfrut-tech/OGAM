# OGAM / Jarvis — Alkove and Voicute Android KWS Comparative Audit
Date: 2026-11-22
Target: OPPO Find X6 Pro PGEM10 / Snapdragon 8 Gen 2 / SM8550 / Android 16 / ColorOS 16.0.5
Status: repository, model manifest, Android API and published benchmark audit. No model weights were downloaded, no APK installed, no native code built, and no PGEM10 microphone test performed.

## Executive decision

Three different KWS directions now have clear roles:

1. **microWakeWord Russian trainer** remains the first candidate for the actual Russian wake phrase «Джарвис». It is the only inspected candidate with a custom Russian training recipe and author-reported real Russian activations. The 82.5 KB model binary is not present in the inspected training repository, its author-reported test is small, and Android feature extraction is not yet integrated.
2. **Alkove** is the strongest Android shared-PCM architecture reference. Its Apache-2.0 Kotlin/Rust SDK exposes a caller-supplied PCM API, so OGAM can feed its existing single mic stream to the processor without opening another AudioRecord. It also offers voice isolation, speech detection, turn detection, keyword spotting and voiceprints. However, its published Spot/Lex models cover seven European languages only, not Russian. Manual IPA entry can approximate «Джарвис» for an experiment, but does not make the acoustic model Russian-capable.
3. **Voicute ONNX Wakeword** is a useful Android Java/ONNX reference for sliding-window inference and hard-negative optimization. It publishes strong English Hey Jarvis R1 hard-negative results, but the hosted custom trainer and model catalogue list seven other languages and no Russian. Do not send private audio to the hosted trainer.

No KWS engine is selected for production. Maintain a clean separation between a Russian KWS model, an optional PCM voice-isolation layer and the Android microphone service.

## 1. Alkove — repository, license and Android availability

Repository: https://github.com/alkove-ai/alkove
Inspected main commit: 084523e0abdd3f0ea44d57ff27e40e8eadf3f60f (2026-11-21 14:41 UTC)
Root source license: Apache-2.0.
Android dependency: ai.alkove:alkove:0.5.0 from https://maven.alkove.ai.
Android API 24+, arm64-v8a and x86_64.
Build path: Kotlin wrapper + Rust JNI via cargo-ndk; JDK 17+, Android NDK and Rust toolchain 1.99.1.

Inspected source revisions:
- docs/models/spot.md: 3a7c8f294f68cc1c96c2506d9a9443a388128865
- docs/models/lex.md: d5da1a7085d7d97eb5e6b472738ea0e8c708698b
- docs/models/focus.md: d8955ca797c96b366f7a8f5ace477dc4e700909b
- docs/start/android.md: 3107bac1176b98a2ed97bfdc8e92dea3af1f5b23
- Android Process.kt: cda4e13d79c03abae7217a19183b80be44f988da
- Android Input.kt: c30aafc4f6e4b7a043be2aceaaadfc2e1d9a0220
- Android Mic.kt: 6995a32ae0b591c09612f4be4db1e865e7be5236
- Android Spot.kt: c58705f4da7e2206852a29cbd4d42978cc51eb05
- Spot IPA table: f13de15e091fa492ba751c04504bdb741518a1e1
- Android microphone instrumentation tests: 5e92074f7516b353adfec6c333a3a7a1ce4538d4
- Spot benchmark JSON: 668253ba29d5663b89b8bb4cba1e4bc8ed05acbe
- Focus benchmark JSON: b5d885bbb1b071fceb9ad91ba77073c570c0ff90
- Cue benchmark JSON: 81905a44aa42b14cc37e179dbb7b7abc61df8545

### 1.1 Exact model set and offline provenance

The five official bundles total about 9.1 MB:
| Model | Download bytes | SHA-256 |
|---|---:|---|
| Focus | 2,320,032 | 25028c1f9faf765ccab4076716b5e8a8e756cd7662babd2bc078951982df5ce4 |
| Cue | 1,199,892 | 19e8b6c66ee9ce23bba3b8011f03827c5ba4bb2fe8bec25fe07558a78950190a |
| Spot | 2,774,380 | fef6b59f0c31c5c742db17d758621f778b23cff5a04834e0c6ec47b313d2ce3d |
| Timbre | 970,064 | fc94dfff533f1a4fb2abea172c1f5ff7a92cc00c6331275ea1a26e38f877b0e8 |
| Lex | 1,818,020 | 1e64ca9f5c2281cadae0f9c4a944cd1b1b433f0c0c29760c36340c97f7308957 |

The manifest pins a separate Hugging Face revision and SHA-256 for each file. The Android model manager verifies hashes on download and stores models in app-private cache. It supports preload/offline cache checks, custom model base URL, files in app assets, a local directory or caller-supplied model bytes. This is a useful provenance and offline-delivery pattern for OGAM.

### 1.2 API: microphone-owning versus caller-supplied PCM

The SDK exposes two distinct usage paths.

**Mic-owning input APIs:**
- WakeListener.start and AgentInput.start create their own AudioRecord through Alkove's Mic helper.
- Do not use these APIs inside OGAM, because PR #1 already has AudioRecorderService as the single physical microphone owner.

**Caller-supplied PCM API:**
- Android Processor accepts a model set, sample rate, optional Focus/Cue, voiceprint, words and context.
- Processor.push(FloatArray) and Processor.push(ShortArray) accept caller-provided PCM blocks of arbitrary length.
- The processor can return output audio, speech events, wake events and diagnostics.
- Its native processor is constructed with Focus, Cue, Spot and Timbre model handles as needed.

This caller-supplied PCM route is the strongest Alkove feature for OGAM. In principle, OGAM could feed the existing shared 16 kHz microphone PCM to Processor without opening another AudioRecord. The adapter must run on a bounded worker lane and must not block the AudioRecorderService callback. No OGAM adapter has been written.

### 1.3 Spot and Lex do not officially support Russian

Official Spot:
- 2.8 MB quantized 4-bit / int8 weights;
- 16 kHz mono, 480 Float32 samples per step (30 ms);
- 58 phoneme log-probabilities, 90 ms behind the input, plus a speech probability 30 ms behind;
- Apache-2.0;
- language scope: French, English, Spanish, Italian, Portuguese, Catalan and Romanian.

Official Lex:
- 1.8 MB int8;
- grapheme-to-phoneme for the same seven languages;
- words up to 33 characters;
- up to three likely pronunciations in the Spot phone inventory;
- Apache-2.0.

The current Lex language table is exactly fr, en, es, pt, it, ca and ro. There is no ru entry. The Android unit tests explicitly check that these seven languages are supported and that German is rejected.

### 1.4 Manual IPA is possible but does not add Russian acoustic training

Alkove allows a caller to compile a word as IPA between slashes, bypassing Lex. This is useful for an experimental «Джарвис» pronunciation. The fixed 58-phone inventory includes a number of phones shared with Russian, so an approximate pronunciation such as /dʒarvis/ can be represented.

However:
- the inventory does not contain the complete Russian phoneme set; some Russian consonants must be approximated or folded to neighbouring classes;
- Spot itself is trained and measured only for the seven published languages;
- manual IPA bypasses Lex only. It does not train Spot on Russian accents, Russian coarticulation or Russian hard-negative words;
- a manually compiled word without an explicitly supported language receives generic uncalibrated thresholds, not Russian-specific calibration.

Spot.enroll can calibrate a particular user's pronunciation thresholds from three spoken takes and can produce a voiceprint. That is a personalization step, not new Russian acoustic training. Voiceprints should never be treated as secure identity authentication.

Decision: manual IPA «Джарвис» is a useful smoke experiment only. Do not describe Alkove as Russian-capable until it passes a held-out Russian speaker/noise test.

### 1.5 Published Spot results

The Spot benchmark uses 40 words per language. For each word, thresholds are calibrated to a target false-alarm rate on half the speakers, then recall is measured on the other half. False alarms are counted on speech that does not contain the target word.

Author-published results:
- mean recall 80.4% at 1 false alarm/hour across French, English, Spanish, Italian, Catalan and Portuguese;
- mean recall 73.7% at 0.5 false alarms/hour;
- after-pause context mean recall 85.9% at 1 false alarm/hour and 81.3% at 0.5;
- Romanian is omitted because its evaluation set was too short to calibrate those operating points.

The source benchmark states the Spot native classifier runs once per 480 samples / 30 ms. On a Galaxy Z Fold8, Snapdragon SM8850, Android 17, native ARM64, its published result is 224 microseconds per model run, or 7.5 ms of compute per second of audio. This is an author benchmark on a different device and OS, not a measurement on PGEM10.

These figures are not directly comparable to the microWakeWord trainer's 47/50 real triggers and 1/140 mined hard negatives: the datasets and metrics differ, and Alkove's benchmark is not Russian.

### 1.6 Focus and Cue: complementary models, not AEC

Focus isolates a chosen speaker from other voices, or the closest voice when there is no voiceprint. It operates on 16 kHz PCM in 256-sample / 16 ms steps, with a one-step algorithmic delay. The author-published seven-language test reports improved speaker isolation when a voiceprint is supplied. It is not an echo canceller: it does not require the exact assistant playback reference.

Cue detects speech boundaries and supports turn/end-of-turn logic. Its published benchmark includes 24 one-minute streams, but the test speech and turn-end datasets are not Russian. No Russian turn-end validation was found.

The models may be useful as optional acoustic front-end experiments, but Russian speech preservation, proper-name WER, near-end clipping and added latency must be tested before adoption.

### 1.7 Alkove's Android Mic and public AEC reference

Inspected Android Mic.kt:
- opens AudioRecord at 16 kHz, mono, Float32;
- when echo cancellation is enabled, uses MediaRecorder.AudioSource.VOICE_COMMUNICATION;
- obtains the actual AudioRecord audioSessionId;
- if available, creates AcousticEchoCanceler for that session and enables it;
- explicitly disables platform NoiseSuppressor and AutomaticGainControl so the model path receives unmodified audio apart from AEC;
- on API 29+, listens for AudioRecordingCallback to report OS capture silencing;
- reads AudioRecord monotonic timestamps and measures capture backlog.

This is a useful reference for exposing the actual session/effect state. It does not prove ColorOS has effective AEC and it does not provide the exact playback-reference signal required by LocalVQE. OGAM's inspected React Native recorder does not expose an AudioRecord session ID. Keep the separate PGEM10 AEC experiment and keep half-duplex until measurements pass.

## 2. Voicute ONNX Wakeword — Android Java architecture and language gap

Repository: https://github.com/voicute/onnx-wakeword
Inspected main commit: 826687a44e83e042cdeb49747448a687d0da2b27 (2026-11-18)
Root code license: MIT.
Android Gradle blob: 6c1d8cdec99b9f5746ae1eab7d7e50e362731045
Android WakeWordEngine.java blob: 8f80b33282f6e063e6c2977b3a294c363f0db55e
DetectionLogic.java blob: 997d4c8c7de2daac2e428f96d8f6e04968d9dad7
AudioCapture.java blob: 0721d3b73fa023c9d13fa4bf90f4aa146d4bb018
Model catalogue blob: 6ff38a57deaa6df709d401046726b362baa99f13

### 2.1 Language coverage and false-trigger optimization

The current model catalogue and hosted training service list seven languages:
- Chinese
- English
- French
- German
- Japanese
- Spanish
- Hindi

Russian is not listed. The README directs users to voicute.com for custom training; a self-hosted Russian training pipeline was not found in the inspected repository. Do not upload private/user recordings to the hosted service.

For English Hey Jarvis, the project publishes an R1 optimized model tested on a 26.9-hour held-out negative corpus:
- baseline: 44.6 false triggers/hour, 100% recall;
- optimized: 4.8 false triggers/hour, 99.0% recall.

Other language optimized pairs show author-reported reductions of 89–99% after mining hard negatives. The method is a useful design reference, but 4.8 false triggers/hour remains too frequent for unattended personal assistant activation unless additional gating or a more conservative threshold is used. These are project-authored metrics on English/language-specific data, not Russian or PGEM10 results.

### 2.2 Android inference structure

The app uses ONNX Runtime Android 1.26.0, min SDK 26, target/compile SDK 34, Java 11.

The Java engine:
- accepts mono 16 kHz PCM16 as short arrays;
- loads a shared melspectrogram.onnx and a classifier ONNX or a multi-keyword ONNX package;
- reads model_info.json for mel_time, keyword names and consecutive-frame settings;
- uses a 25 ms mel window and 10 ms hop;
- often evaluates a 98-frame (~1.0 second) sliding window, with some 150-frame models;
- transforms mel output by x/10 + 2 and prepares classifier input/padding;
- applies classifier thresholds and reports the highest scoring keyword.

This is a sliding-window inference engine, not a stateful 30 ms streaming CNN. Each process call recomputes the mel spectrogram and classifier over the supplied window.

### 2.3 Five false-trigger gates

DetectionLogic contains:
1. consecutive high-probability frames, allowing a small gap;
2. peak score relative to an adaptive background estimate;
3. 1.5-second cooldown;
4. burst detector that blocks repeated triggers for five seconds;
5. optional pre/post energy-jump gate intended to reject continuous music/video playback.

The L5 energy-jump gate is disabled by default and requires tuning. These gates are interesting architecture for OGAM's false-activation review, but are not proof of robust operation on ColorOS or Russian speech.

### 2.4 Mic ownership and compatibility

The Voicute demo's AudioCapture class itself opens a separate AudioRecord at 16 kHz using VOICE_RECOGNITION and enables NoiseSuppressor. It does not attach AcousticEchoCanceler. Do not reuse this capture class inside OGAM.

The inference engine can in principle be fed by caller-provided PCM in an isolated adapter, but its model bundle must match the exact ONNX mel front-end, classifier input layout and model_info metadata. It is not interchangeable with the microWakeWord TFLite model or Alkove's .alk model format.

Decision: keep Voicute as an Android ONNX and hard-negative-mining architecture reference only. No suitable Russian model was found.

## 3. Comparative decision for OGAM

| Candidate | Russian coverage | Android/shared-PCM fit | Best current role |
|---|---|---|---|
| microWakeWord Russian trainer | Explicit Russian «Джарвис» training recipe; author-reported 47/50 real activations and 1/140 mined hard negatives; actual model file absent | TFLite plausible; exact MicroFrontend/stateful graph and Android adapter still required | **First Russian KWS training/benchmark candidate** |
| Alkove Spot / Lex | Seven languages only; manual IPA can represent an approximate word but does not add Russian acoustic training | Strong caller-supplied PCM Processor API, API24+ ARM64 Kotlin/Rust | Optional shared-PCM, voice-isolation and VAD experiment |
| Voicute ONNX Wakeword | Seven languages only; no Russian custom training source located | Android Java/ONNX Runtime engine; demo opens its own AudioRecord; sliding-window model | Hard-negative gating and Android ONNX architecture reference |

No model metrics above are directly comparable. Each project used a different dataset, language set and validation protocol.

## 4. Recommended next steps

1. Keep microWakeWord as the primary Russian «Джарвис» path. Obtain or train the actual model, verify SHA-256, real tensor types, quantization, operators, state tensors and exact 40-bin MicroFrontend.
2. Optionally run an Alkove manual-IPA smoke test with the same Russian phrases and negatives, but clearly label it experimental and outside the published language scope.
3. Evaluate Alkove Focus/Cue separately from KWS; do not enable Focus in production until Russian near-end speech and proper-name transcription are preserved.
4. Do not select Voicute for Russian until a compatible Russian model and self-hosted/acceptable licensing path are found.
5. Preserve OGAM's single physical mic owner. Use caller-supplied PCM APIs only; never instantiate Alkove AgentInput/WakeListener or Voicute AudioCapture inside OGAM.
6. Keep JarvisPcmStreamPlayer as the single playback owner. AEC remains unverified; half-duplex stays default.
7. No code, Gradle dependency, model asset or APK was changed. No external model weights or user audio were copied. No PGEM10 measurements were performed.

## Sources and pins

- Alkove Apache-2.0 repository: https://github.com/alkove-ai/alkove/tree/084523e0abdd3f0ea44d57ff27e40e8eadf3f60f
- Alkove Android quick start and caller-supplied PCM path: https://github.com/alkove-ai/alkove/blob/084523e0abdd3f0ea44d57ff27e40e8eadf3f60f/docs/start/android.md
- Alkove Spot language, IPA, benchmark and phone scope: https://github.com/alkove-ai/alkove/blob/084523e0abdd3f0ea44d57ff27e40e8eadf3f60f/docs/models/spot.md
- Alkove Lex languages and inventory: https://github.com/alkove-ai/alkove/blob/084523e0abdd3f0ea44d57ff27e40e8eadf3f60f/docs/models/lex.md
- Alkove Kotlin Processor: https://github.com/alkove-ai/alkove/blob/084523e0abdd3f0ea44d57ff27e40e8eadf3f60f/android/alkove/src/main/kotlin/ai/alkove/Process.kt
- Alkove Android Mic/AEC reference: https://github.com/alkove-ai/alkove/blob/084523e0abdd3f0ea44d57ff27e40e8eadf3f60f/android/alkove/src/main/kotlin/ai/alkove/Mic.kt
- Alkove published model benchmarks: https://github.com/alkove-ai/alkove/tree/084523e0abdd3f0ea44d57ff27e40e8eadf3f60f/bench/results
- Voicute MIT ONNX Wakeword repository: https://github.com/voicute/onnx-wakeword/tree/826687a44e83e042cdeb49747448a687d0da2b27
- Voicute model languages and false-trigger optimization results: https://github.com/voicute/onnx-wakeword/blob/826687a44e83e042cdeb49747448a687d0da2b27/models/README.md

This document records source-level findings only. It does not claim that Alkove or Voicute has been integrated or tested on OPPO.
