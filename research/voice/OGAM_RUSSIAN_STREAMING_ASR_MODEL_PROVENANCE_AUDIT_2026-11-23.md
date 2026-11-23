# OGAM / Jarvis — Russian Streaming ASR Model Provenance Audit
Date: 2026-11-23
Target: OPPO Find X6 Pro PGEM10 / SM8550 / Android 16 / ColorOS 16.0.5
Status: public model-card, Android SDK and source metadata audit. No model weights downloaded, no APK built, no device benchmark, no code/dependency added.

## Executive decision

**First mobile streaming benchmark:** NVIDIA Nemotron 3.5 ASR 0.6B through Soniqo's Android LiteRT export, subject to exact artifact/license pinning and OPPO delegate testing.

**Russian quality/batch reference:** NVIDIA Parakeet TDT 0.6B v3.

**Quarantined:** Soniqo Parakeet-EOU 120M ONNX INT8 export. Its advertised Russian/multilingual capability conflicts with the declared upstream NVIDIA model card, which is English-only. Do not use it as a Russian ASR until provenance and license are independently resolved.

**Research queue:** NVIDIA Nemotron Labs Unified ASR 0.6B, released 2026-10-27, supports Russian and cache-aware streaming, but no verified Android LiteRT/ONNX export was found in this pass.

## 1. Parakeet-Realtime-EOU-120M: source/export conflict

### Official upstream
- Model: https://huggingface.co/nvidia/parakeet_realtime_eou_120m-v1
- NVIDIA model card: English-only; 120M FastConformer-RNNT; 16 kHz single-channel audio; emits EOU token; does not emit punctuation/capitalization.
- Governing terms on official card: NVIDIA Open Model License.
- This model is not the same model as Parakeet TDT v3. The fact that TDT v3 supports Russian does not transfer Russian support to the EOU model.

### Soniqo export
- Model: https://huggingface.co/soniqo/Parakeet-EOU-120M-ONNX-INT8
- Claims 25 European languages, 153 MB bundle, 320 ms chunks and EOU/EOB tokens.
- Its own model card states it was exported from the official NVIDIA English-only EOU model.
- Its card labels the export CC-BY-4.0, but does not document multilingual fine-tuning, new Russian training data, tokenizer changes, checkpoint lineage or a license basis for changing the license label.
- Soniqo Android README reports 232 MB peak memory. The Soniqo model card separately reports ~420 MB peak RSS on macOS arm64. These are different environments and not directly comparable.

### Risk and decision
This is a material discrepancy in language support, model lineage and license metadata. A converted ONNX export cannot acquire Russian acoustic competence simply because a separate Parakeet TDT model supports Russian. The model may have been adapted outside the visible card, but the public evidence does not prove it.

Do not:
- list this as a confirmed Russian model;
- download or redistribute it as Russian-capable;
- compare its Russian WER as though the language support were established;
- assume CC-BY-4.0 supersedes the upstream NVIDIA terms.

Reopen only after the exporter provides:
1. exact source checkpoint and immutable revision;
2. whether fine-tuning occurred, training data/license and training recipe;
3. Russian evaluation corpus, WER/CER and per-domain results;
4. exact ONNX file hashes and reproducible export details;
5. a written explanation of the governing license for the converted/adapted weights.

## 2. Nemotron 3.5 ASR streaming 0.6B: best documented Android candidate

### Official NVIDIA model
- Model: https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b
- 600M parameters, cache-aware FastConformer-RNNT with language-ID prompt conditioning.
- Official card lists 40 language-locales. Russian ru-RU is in the transcription-ready tier (not merely tokenizer/adaptation-ready).
- Native streaming with configurable chunk/context sizes from 80 ms through 1120 ms; native punctuation and capitalization.
- Official model card currently identifies OpenMDW 1.1 terms. Always pin the exact revision and review the actual license text before redistribution.

### Soniqo Android LiteRT export
- Model: https://huggingface.co/soniqo/Nemotron-3.5-ASR-Streaming-Multilingual-0.6B-LiteRT-INT8
- Three-graph LiteRT/TFLite bundle: encoder, decoder, joint; 16 kHz mono; cache-aware streaming; 320 ms chunk + 240 ms lookahead in this export.
- Export card lists ~687 MB; Android README says ~721 MB. Pin exact files and hashes; do not collapse these into one verified size.
- Channelwise INT8 encoder requires an Android NNAPI or XNNPACK delegate; the card says plain desktop LiteRT CPU interpreter cannot allocate the encoder graph. This is a hard runtime constraint, not optional optimization.
- The SDK says it handles delegate selection, streaming cache management and RNNT greedy decoding.
- Soniqo's converted export card labels the license NVIDIA Open Model License, while the current upstream NVIDIA card shows OpenMDW 1.1. This is a second license metadata discrepancy; resolve against exact model revision and license documents before bundling.
- No Android peak RSS is published in the SDK README. No SM8550, ColorOS 16, battery, thermal or microphone integration measurement has been performed.

### OGAM assessment
This is the first streaming candidate worth a controlled Android benchmark because it has (a) Russian in NVIDIA's transcription-ready locale tier, (b) an existing Android LiteRT export and SDK wrapper, and (c) a streaming RNNT path. Do not import the whole Soniqo pipeline. Build an OGAM-owned adapter only after the exact model artifact, license and Android delegate path are validated. Continue feeding it from OGAM's existing AudioRecorderService PCM; never open a second AudioRecord.

## 3. Parakeet TDT v3 0.6B: Russian quality/batch reference

- Official model: https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3
- 600M FastConformer-TDT, 25 European languages including Russian.
- CC-BY-4.0, with attribution requirements.
- Designed for high-throughput transcription and long-form audio. Do not infer that it has Parakeet-EOU's endpoint token or the same cache-aware streaming behavior.
- Soniqo lists an Android ONNX export around 891 MB and ~1.1–1.3 GB peak memory. Treat those as vendor-reported figures pending pinned file hashes and device measurement.
- Use as a larger quality/batch reference, not as the always-on low-memory recognizer.

## 4. Newer NVIDIA candidate: Nemotron Labs Unified ASR 0.6B

- Model card: https://huggingface.co/nvidia/nemotron-labs-unified-asr-0.6b
- Published 2026-10-27; combines offline and cache-aware streaming inference.
- 25 European languages including Russian; punctuation/capitalization; configurable streaming latency down to 160 ms.
- OpenMDW License Agreement v1.1.
- No verified Android LiteRT/ONNX export or supported Kotlin/JNI runtime was found in this pass. Add to the research queue, not the immediate integration queue.

## 5. Updated benchmark order

1. OGAM current Qwen3-ASR 0.6B batch WAV — existing baseline.
2. Whisper runtime currently in OGAM — existing baseline.
3. Nemotron 3.5 0.6B LiteRT INT8 — first streaming Android candidate; delegate and license gates first.
4. Parakeet TDT v3 0.6B — high-memory Russian quality/batch reference.
5. Nemotron Labs Unified ASR 0.6B — only after a verified Android export/runtime is found.
6. Parakeet-EOU 120M — do not benchmark as Russian unless provenance and license conflict is resolved.

Use the same fixed Russian corpus and identical audio files. Measure WER/CER, exact match for names/numbers/dates, partial/final latency, real-time factor, cold load, peak RSS, CPU/delegate, battery and thermal behavior over 15/30/60 minutes. Include quiet, far-field, accent, technical vocabulary, music/TV and device-speaker playback tests.

## 6. Safety and integration constraints

- Existing OGAM AudioRecorderService remains the only physical microphone owner.
- ASR/KWS/VAD must subscribe to shared PCM or a single coordinated native capture source.
- Keep half-duplex while AEC is unverified. No ASR result may execute an Android action directly; route through typed intent/tool permissions and confirmation policy.
- Do not ship an artifact until its exact model revision, SHA-256, model license, conversion provenance and redistribution terms are documented.
- No model weights or user recordings were downloaded/uploaded in this research pass.

## Source links

- NVIDIA Parakeet EOU: https://huggingface.co/nvidia/parakeet_realtime_eou_120m-v1
- Soniqo Parakeet EOU export: https://huggingface.co/soniqo/Parakeet-EOU-120M-ONNX-INT8
- NVIDIA Parakeet TDT v3: https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3
- NVIDIA Nemotron 3.5: https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b
- Soniqo Nemotron 3.5 LiteRT export: https://huggingface.co/soniqo/Nemotron-3.5-ASR-Streaming-Multilingual-0.6B-LiteRT-INT8
- NVIDIA Nemotron Labs Unified ASR: https://huggingface.co/nvidia/nemotron-labs-unified-asr-0.6b
- Soniqo Android SDK: https://github.com/soniqo/speech-android
