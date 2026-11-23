# OGAM / Jarvis — Android Streaming Speech Stack and Russian Model Candidates
Date: 2026-11-23
Target: OPPO Find X6 Pro PGEM10 / SM8550 / Android 16 / ColorOS 16.0.5
Status: public source audit and integration assessment. No source code or model added to OGAM; no model weights downloaded; no APK built; no PGEM10 runtime test.

## Executive decision

A new candidate deserves priority over the previous "Qwen batch ASR only" baseline:

**Soniqo Speech Android + speech-core** provides a real Android Kotlin/JNI speech SDK, but the first Russian-ASR candidate requires a provenance correction: its Parakeet-EOU 120M export claims 25 European languages while its declared NVIDIA base model is officially English-only. Do not treat this EOU export as Russian-capable until the exporter supplies reproducible evidence of multilingual fine-tuning and model/license provenance. The better documented streaming Russian candidate in this SDK is Nemotron 3.5 ASR 0.6B LiteRT; its device memory and SM8550 behavior remain unverified.

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
- default Parakeet-EOU 120M: 153 MB export; Soniqo claims 232 MB peak and 25 languages, but this conflicts with the official English-only NVIDIA base model and is quarantined pending provenance evidence;
- optional Parakeet TDT v3: ~891 MB download, ~1.1–1.3 GB peak memory per Soniqo README; official NVIDIA model supports 25 European languages including Russian, but it is a larger quality/batch reference, not the low-memory streaming default;
- optional Nemotron-3.5 multilingual streaming: Soniqo LiteRT INT8 model card lists ~687 MB bundle (README says ~721 MB); official NVIDIA model card lists 40 locales, with Russian in the transcription-ready tier; Android peak memory is not measured;
- default Kokoro TTS: 330 MB download / 640 MB peak, but only 8 languages and no Russian;
- optional Supertonic-3: ~380 MB / 832 MB peak, 31 languages;
- Silero VAD v5: 2 MB / <10 MB peak;
- DeepFilterNet3: 8.2 MiB model, CPU streaming enhancement; README reports 40 ms model delay plus resampling latency.

The default Android SDK path is intentionally low-memory: Parakeet-EOU + short-turn Kokoro. However, the EOU model's Russian claim is not currently substantiated because its declared upstream NVIDIA base is English-only. The demo app can choose larger Parakeet TDT or Nemotron paths. The SDK accepts 16 kHz mono Float32 PCM through `pipeline.pushAudio(samples)`; the app remains responsible for microphone capture and feeding samples. This is important for OGAM: preserve one physical mic owner and bridge the existing recorder rather than adding another AudioRecord.

### Parakeet-EOU 120M: quarantine for Russian pending provenance

- Official NVIDIA model card: `nvidia/parakeet_realtime_eou_120m-v1` says **English only**, 120M FastConformer-RNNT, 16 kHz mono, EOU token, NVIDIA Open Model License.
- Soniqo's derived export `soniqo/Parakeet-EOU-120M-ONNX-INT8` claims 25 European languages and labels itself CC-BY-4.0, but its own model card says it was exported from the English-only NVIDIA base. The card does not document multilingual fine-tuning, a language-specific training dataset, a training recipe, or evidence that the Russian tokenizer/acoustic model was changed.
- This is a material model-card / provenance / license discrepancy. The 25-language claim and CC-BY-4.0 tag are not accepted as proof. Do not download, bundle, benchmark as Russian ASR, or redistribute this export until the maintainer supplies a verifiable multilingual checkpoint lineage, Russian evaluation set/results, exact revision and governing license.
- The vendor's 232 MB Android memory and 320 ms streaming claims are not independent OGAM measurements; the model card also reports a separate ~420 MB macOS arm64 peak RSS. Do not compare these numbers as if they were measured on the same platform.

### Russian ASR candidate: Nemotron-3.5 streaming 0.6B (first streaming benchmark)

- NVIDIA's official model card documents 40 language-locales; Russian `ru-RU` is in the **transcription-ready** tier. The model is 600M parameters, cache-aware FastConformer-RNNT, native streaming, punctuation/capitalization, and configurable chunk/context sizes (80–1120 ms).
- Soniqo publishes an Android LiteRT export with a ~687 MB bundle, 16 kHz mono input, 320 ms chunk + 240 ms lookahead, and three graphs (encoder/decoder/joint). The export says channelwise INT8 encoder requires an Android NNAPI or XNNPACK delegate; plain desktop LiteRT CPU interpreter cannot allocate this graph. The SDK handles streaming/cache/greedy decode.
- Soniqo README's ~721 MB estimate differs from the export card's ~687 MB. Keep both as source-reported values and verify exact file sizes/checksums before use.
- License metadata is inconsistent: the NVIDIA upstream HF card currently shows OpenMDW 1.1, while Soniqo's converted export card says NVIDIA Open Model License. Treat redistribution as blocked until the exact pinned artifact's governing terms and conversion rights are resolved.
- No Android peak RSS is published in the README; no OPPO SM8550 / ColorOS 16 compatibility or battery/thermal test has been performed. This is the best documented streaming Russian candidate in the inspected Android SDK, not yet a selected OGAM dependency.

### Russian ASR candidate: Parakeet TDT v3 0.6B (quality / batch reference)

- Official NVIDIA model card lists 25 European languages including Russian and CC-BY-4.0.
- It is a 600M FastConformer-TDT model designed for high-throughput transcription. Do not infer that it has the same cache-aware streaming/EOU behavior as Parakeet-EOU or Nemotron 3.5.
- Soniqo's Android package lists an ONNX export around 891 MB and ~1.1–1.3 GB peak memory. Use it as a quality/batch reference if device resources permit; do not make it the first always-on voice path.

### Newer candidate: Nemotron Labs Unified ASR 0.6B

- NVIDIA model card announced/released 2026-10-27; it combines offline and cache-aware streaming inference, supports 25 European languages including Russian, punctuation/capitalization, and configurable latency down to 160 ms.
- It is governed by the OpenMDW License Agreement v1.1. It may be a better unified benchmark target than separate Parakeet batch + Nemotron 3.5 streaming models.
- No verified Android LiteRT/ONNX export or OGAM-compatible mobile runtime was found in this pass. Keep it in research queue; do not claim it is mobile-ready.

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
4. After KWS trigger, wake the larger streaming Russian ASR (Nemotron 3.5 LiteRT first benchmark; Qwen3-ASR / Whisper as baselines; keep Parakeet-EOU quarantined pending provenance).
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
C. Nemotron-3.5 0.6B LiteRT streaming.
D. Parakeet TDT v3 0.6B (quality/batch reference, high-memory).
E. Nemotron Labs Unified ASR 0.6B (only after a verified Android export/runtime exists).
F. Parakeet-EOU 120M only if the multilingual fine-tuning and license discrepancy is resolved.
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
- NVIDIA Nemotron 3.5 lists Russian `ru-RU` in its transcription-ready tier; Soniqo has a LiteRT Android export, but export license metadata needs reconciliation;
- NVIDIA Nemotron Labs Unified ASR supports Russian and streaming, but an Android export was not verified;
- Supertonic-3 supports Russian among 31 languages, model license OpenRAIL-M;
- Parakeet-EOU 120M upstream NVIDIA base is English-only; Soniqo's 25-language derivative claim is unverified and quarantined.

Not verified:
- any of these models on OPPO Find X6 Pro / SM8550;
- real acoustic AEC/barge-in on a phone;
- Russian Nemotron 3.5 WER/latency, peak RSS, delegate behavior and thermal profile on PGEM10;
- Russian Parakeet-EOU WER/latency unless the multilingual provenance discrepancy is resolved;
- Supertonic/Qwen TTS voice quality on PGEM10;
- any Russian KWS detector quality;
- QNN/HTP execution of any speech model.

No code, model weights, APK or dependency was added to OGAM in this research pass.


## 9. Russian Piper voices — additional TTS option and licensing gate

New references:
- sherpa-onnx Android TTS APK catalogue: https://k2-fsa.github.io/sherpa/onnx/tts/apk.html
- Russian Piper voice sample/model page: https://k2-fsa.github.io/sherpa/onnx/tts/all/Russian/vits-piper-ru_RU-ruslan-medium.html
- Piper voice repository: https://huggingface.co/rhasspy/piper-voices
- Piper current licensing explanation: https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/LICENSING.md
- Android Kotlin wrapper: https://github.com/piper-tts-apps/piper-kotlin

### Runtime choices

1. `sherpa-onnx` is Apache-2.0 and publishes Android arm64 TTS engine APKs for Russian VITS Piper voices: Denis, Dmitri, Irina and Ruslan. Its own documentation explicitly warns that the framework license does not replace each voice's model/data license. This is the preferred first runtime to benchmark if we need to avoid linking GPL Piper core.
2. `piper-kotlin` offers a convenient Kotlin/JNI API and chunked PCM playback, but it bundles `piper1-gpl` (GPL-3.0-or-later). Linking/distributing it can impose GPL obligations on the combined app. Do not add it to OGAM without an explicit project-license decision.
3. Piper's current runtime repository `OHF-Voice/piper1-gpl` is GPL-3.0-or-later; the older `rhasspy/piper` repository was MIT but archived. Do not confuse the older engine license with the maintained GPL fork.

### Russian model voice license findings

- Russian voice catalogue has four established medium voices: `denis`, `dmitri`, `irina`, `ruslan`; typical ONNX size is ~63 MB, 22.05 kHz.
- Each voice requires its own `MODEL_CARD`. The repo-level MIT tag does not grant all model weights under MIT.
- Ruslan's model card names the Ruslan corpus under CC BY-NC-SA 4.0 and says it was fine-tuned from U.S. English Lessac medium. Do not redistribute or use commercially without resolving both the dataset and base-model chain.
- Irina's card lists RHVoice and says the dataset license is Unknown; do not treat it as clear for redistribution.
- Denis and Dmitri cards list CC0 voice-dataset recordings but also state they were fine-tuned from U.S. English Lessac medium. Piper's own licensing guidance says the full fine-tuning chain matters; the Lessac base dataset is research-only. Commercial/redistribution rights remain unresolved until the model chain is checked and the relevant rights holder grants permission.
- Always package the exact voice MODEL_CARD and preserve provenance; the ONNX JSON config does not contain the licensing history.

### Russian text normalization limitation

An independent Russian speech benchmark project reports common Piper front-end problems with spaced thousands, dates, time strings, ordinal suffixes and homographs/stress. These are not acoustic model failures alone: Jarvis must normalize numbers, dates, times, units, abbreviations and names before TTS. Its proposed regex/num2words patch is only a baseline; production needs grammatical case/ordinal agreement and domain dictionaries. Treat these as third-party benchmark observations, not OGAM test results.

### Updated TTS benchmark tiers

- Tier 1 (fast/light reference): sherpa-onnx + Russian Piper Denis/Dmitri/Irina/Ruslan, subject to exact model-card/license review and text normalization. Compare male/female voice samples and p50/p95 synthesis RTF on PGEM10.
- Tier 2 (multilingual expressiveness): Supertonic-3 Russian (OpenRAIL-M model license; ~832 MB Android peak reported by Soniqo).
- Tier 3 (voice design/clone): Qwen3-TTS 0.6B Q4 Android port (CPU, custom voice), subject to model artifact provenance and device memory/thermal testing.

No Piper voice or runtime was downloaded or added to OGAM.


## 9. Model provenance correction — 2026-11-23

A deeper model-card comparison supersedes the earlier Parakeet-EOU Russian recommendation. Full evidence and exact source links are recorded in [OGAM_RUSSIAN_STREAMING_ASR_MODEL_PROVENANCE_AUDIT_2026-11-23.md](OGAM_RUSSIAN_STREAMING_ASR_MODEL_PROVENANCE_AUDIT_2026-11-23.md).

Key correction:
- NVIDIA's official Parakeet-Realtime-EOU-120M card is English-only.
- Soniqo's derivative card says 25 European languages but identifies the English-only NVIDIA model as its base and does not document the claimed multilingual fine-tuning. The card also changes the license label from NVIDIA Open Model License to CC-BY-4.0 without explaining the basis.
- Therefore Parakeet-EOU is **not approved as a Russian model candidate** until lineage, Russian validation and license are independently established.
- Move Nemotron 3.5 LiteRT to first Android streaming benchmark priority; retain Parakeet TDT v3 as a larger Russian batch/quality reference; add Nemotron Labs Unified ASR as a promising newer model pending Android export/runtime work.
