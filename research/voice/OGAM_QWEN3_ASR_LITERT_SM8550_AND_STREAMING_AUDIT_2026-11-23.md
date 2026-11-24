# OGAM / Jarvis — Qwen3-ASR LiteRT SM8550 and Streaming Audit
Date: 2026-11-23
Target: OPPO Find X6 Pro PGEM10 / Snapdragon 8 Gen 2 / SM8550 / Android 16 / ColorOS 16.0.5
Status: source-level research only. No model weights downloaded, no code copied into OGAM, no APK built, no OPPO device execution.

## Executive conclusion

A real Qwen3-ASR 0.6B LiteRT export exists with a Qualcomm SM8550-specific AOT `.tflite` graph. This is a genuine exact-SoC candidate, not a generic model rename. The model supports Russian and is Apache-2.0 per both the upstream Qwen model and the LiteRT Community conversion card.

However, there are two different mobile exports and they must not be confused:
1. `qwen3_asr_0.6b_5s_i8.litertlm` (~960 MB): a portable LiteRT-LM Omni bundle for CPU/GPU. The model card documents 5-second overlapping-window transcription, warm-start early output, and overlap seam merging. It is not the SM8550 NPU AOT bundle.
2. `qwen3_asr_0.6b_5s_f32_Qualcomm_SM8550.tflite` (~1.9 GB): a standalone LiteRT NPU AOT model graph, with CPU fallback intended by the Android LiteRT sample. It requires a separate LiteRT CompiledModel path, host-side mel preprocessing/tokenizer/decoder/postprocessing, and the matching Qualcomm runtime pack.

Critical latency distinction: upstream Qwen's native streaming implementation is currently vLLM-only. The LiteRT Community mobile card uses overlapping 5-second windows (2.5–3.0 s stride), and Google's LiteRT ASR Android sample explicitly says its supported models are not streaming models; it simulates live updates by repeatedly recognizing overlapping windows. Do not label the LiteRT Android route as true low-latency streaming.

## 1. Exact model provenance and target artifact

Upstream model:
- `Qwen/Qwen3-ASR-0.6B`, Apache-2.0.
- Upstream source repository: https://github.com/QwenLM/Qwen3-ASR
- Upstream source tree commit inspected: `7c6daf77a2421100f5fb066495372c00129d39ff`.
- Upstream `qwen_asr/inference/qwen3_asr.py` blob: `d99b91512a5bbc1c15897d97752cfd86ea68d46e`.
- Upstream streaming demo `qwen_asr/cli/demo_streaming.py` blob: `ca6da63782199b9f63346b85e16c2bbdc41af2b4`.
- Upstream VLLM streaming example blob: `b137244504fddcd9e5d9a8faa6bc33d286c70498`.

LiteRT Community export:
- Model: https://huggingface.co/litert-community/Qwen3-ASR-0.6B
- Card states the export is converted from upstream `Qwen/Qwen3-ASR-0.6B`, with no retraining or fine-tuning.
- Card states Apache-2.0 for weights/tokenizer and Apache-2.0 for conversion/runtime stack.
- Supported language list includes Russian (`ru`), automatic language identification, punctuation and capitalization.
- Exact SM8550 artifact: `qwen3_asr_0.6b_5s_f32_Qualcomm_SM8550.tflite`.
- HF Xet SHA-256 reported for this exact file in the inspected current file page: `206e299eb736d8c62ba4e6750a43718aa2a94665bfe0c3e0061112133b1ff10f`.
- Approximate size reported by HF: 1.9 GB; an earlier LFS pointer snapshot in commit `dd8ed8ba3c32bccfe0a76c0cc81e9b7cf4f2ad81` reported 1,896,159,552 bytes and SHA `80fc6dc300d0d8b306e8250cb96eea8b6fcd193f14848f938fff03eef75fb781`. These are different object hashes/snapshots; use the current Xet hash from the current file page and verify after download.
- The current file page shows the file under commit `dd8ed8b` (HF file page); the exact model card is dynamic and must be pinned to an immutable revision before any download.

## 2. Mobile package options

### A. LiteRT-LM Omni INT8 bundle
- `qwen3_asr_0.6b_5s_i8.litertlm`, 960 MB on disk.
- CPU/GPU backends; do not assume this bundle uses the Qualcomm NPU.
- Contains INT8 audio encoder/projector (~181 MB), 28-layer Qwen3 autoregressive decoder (~582 MB), stateful KV cache, embedding table (~150 MB), tokenizer and model metadata.
- Frontend expects 16 kHz mono and computes 128-bin Slaney log-mel features with 400-point Hann STFT and 10 ms hop; the packaged C++ frontend can resample other input sample rates.
- Card says 5-second sliding windows with overlap ratio 0.4–0.75, warm-start early first-chunk emission, and cross-window seam alignment.
- For long utterances, the card says the normal window stride is 2.5–3.0 seconds. This is useful for rolling transcription, but is materially slower to update than a true 320 ms cache-aware streaming recognizer.
- The `.litertlm` bundle is the easiest CPU/GPU package to prototype, but not the NPU target.

### B. Standalone SM8550 AOT `.tflite`
- `qwen3_asr_0.6b_5s_f32_Qualcomm_SM8550.tflite`, about 1.9 GB.
- Model card describes these SoC-specific graphs as standalone LiteRT NPU pipelines precompiled with LiteRT NeuroPilot/QNN compilers.
- The standalone `.tflite` path does not include the `.litertlm` bundle's Omni orchestration; host app must implement the model's preprocessing, encode/decode signatures, tokenization and output merger.
- The AOT file is FP32-named and much larger than the INT8 LiteRT-LM bundle. Do not compare file size alone as a quality or speed ranking.
- AOT target file presence does not prove execution on the OPPO handset. The matching runtime/delegate and actual NPU assignment must be verified.

## 3. Google Android LiteRT sample is the strongest implementation reference

Repository: https://github.com/google-ai-edge/litert-samples
- Main tree commit inspected: `e7f17f629a9385e8a4a12b2f3914fa02ee72f6ff`.
- Android ASR `LiteRtRunner.kt` blob: `e01709206b31d2836cfd7c311c4dac7b59e2f0b2`.
- Android `MainActivity.kt` blob: `66d7871426989ba522521e375c17901850c2ed26`.
- Android `MicrophoneAudioSource.kt` blob: `fb12ecd9dfe99597e80d2b24d828adb3e0feaf89`.
- `model_metadata.json` blob: `879d95be5c438402604effd535089fe6d5d9919c`.
- Android app Gradle blob: `02d1c0c9273d69ba58a681dbc63ab72dc9311910`.
- Android sample README blob: `d6057c6ae26540c367725bd7626cec574b0364ef`.

Verified implementation details:
- `model_metadata.json` contains a `qwen3-asr-0.6b` entry and a remote NPU model URL pattern ending in `qwen3_asr_0.6b_5s_f32_<target>.tflite`.
- `LiteRtRunner` selects `Accelerator.NPU`, includes CPU as fallback, creates `BuiltinNpuAcceleratorProvider`, configures Qualcomm HTP performance mode, and chooses the NPU-specific model path when NPU is selected.
- Its target mapper converts `Build.SOC_MODEL` values beginning `SM8` into `Qualcomm_<SMxxxx>`; the target handset should resolve to `Qualcomm_SM8550` if Android reports the expected SoC string.
- The runner uses `CompiledModel` encode/decode signatures, loops over autoregressive token decoding, and reuses encoder output buffers without copying them.
- Sample Gradle pins `com.google.ai.edge.litert:litert:2.3.0` and `litert-gpu:2.3.0`, minSdk 31, arm64-v8a, and legacy JNI packaging.
- Qualcomm NPU runtime modules for HTP V69/V73/V75/V79/V81 are present as optional dynamic features but commented out in the sample app Gradle. Its README says a runtime module must be enabled for NPU support.
- The sample's mic source creates its own AudioRecord. OGAM must not copy that ownership model: adapt the recognizer to OGAM's existing shared PCM stream and do not open a second microphone.

## 4. Streaming reality: upstream vLLM vs LiteRT Android

Upstream Qwen source explicitly states that streaming inference is currently available only with the vLLM backend. The official demo pushes 500 ms audio chunks and the example uses a 1.0–2.0 second chunk size. The state maintains buffered audio, previous text/prefix and rollback state for unconfirmed words.

That upstream implementation is not an Android LiteRT implementation and cannot be assumed to run on the OPPO device. It is a useful algorithmic reference only.

The LiteRT Community `.litertlm` card describes a 5-second window and 2.5–3.0 second stride for regular long-audio processing. Its warm-start/overlap strategy can emit early provisional text, but it is not the same as a continuously cached streaming encoder.

Google's LiteRT ASR sample README says the models in that sample are not streaming models; microphone recognition is done by repeated 5-second overlapped windows. The sample's microphone source pre-pads early windows and emits provisional/confirmed text after token-merging. It demonstrates a mobile streaming UI, not a true streaming acoustic model.

Decision: Qwen3-ASR LiteRT can be a strong multilingual offline recognizer candidate, but the 5-second rolling-window implementation is not the first choice for a wake-word-driven, low-latency conversational assistant. Keep Nemotron 3.5 streaming as the leading low-latency candidate until device benchmarks show otherwise; evaluate Qwen in parallel for accuracy, noise robustness and vocabulary coverage.

## 5. Accuracy and domain vocabulary caveat

An open LiteRT-LM issue #4360 (opened 2026-11-03) reports that the current Qwen3-ASR Omni API does not expose context/hotword prompt injection, although the upstream model supports a context string. In the issue author's synthetic English alphanumeric-code test, a local patch improved exact code recognition from 13/31 to 21/31 on Galaxy S26 Ultra GPU; the reported no-context path also dropped/truncated some 5-second windows. This is a user-reported issue and English synthetic-code result, not a verified Russian result or proof of a general defect.

OGAM needs a Russian test set emphasizing contacts, app names, device commands, technical terms, addresses, dates, amounts and alphanumeric identifiers. If the LiteRT runtime cannot pass a context/hotword list, record that as a functional limitation and do not invent a workaround. The Qwen upstream context support and the LiteRT wrapper API are different surfaces.

## 6. Comparison with Nemotron 3.5 streaming

| Dimension | Nemotron 3.5 LiteRT (Goodnotes/Soniqo path) | Qwen3-ASR LiteRT SM8550 |
|---|---|---|
| Russian | Supported via `ru-RU` prompt | Supported as `ru` with auto language ID |
| Model execution | Cache-aware streaming RNN-T | 5 s encoder + autoregressive decoder |
| Partial update model | 320 ms windows in Soniqo wrapper | Overlapping 5 s windows; normal stride 2.5–3.0 s |
| Device-specific export | Goodnotes SM8550 AOT encoder candidate | Standalone SM8550 AOT `.tflite` graph |
| Model pack | 3 graphs + vocabulary/language/config metadata | Standalone graph + host preprocessing/tokenizer/decoder |
| Runtime caveat | Current Soniqo LiteRT engine hardcodes CPU | Google sample has explicit NPU/CPU selection, but HTP runtime module must be packaged |
| License | NVIDIA OpenMDW/Open Model License provenance needs review | Apache-2.0 per upstream Qwen and LiteRT conversion card |
| OPPO validation | Not done | Not done |

These are architecture facts, not benchmark results. No direct Russian WER/CER, latency, power, thermal or memory comparison has been performed on PGEM10.

## 7. Recommended OGAM path

1. Keep a common `StreamingAsrBackend` abstraction and OGAM as the sole microphone owner.
2. Preserve Nemotron as the low-latency streaming track. First solve its Android QNN/SM8550 runtime integration and CPU fallback; do not mistake the Soniqo CPU engine for NPU acceleration.
3. Add Qwen3-ASR LiteRT as a separate experimental backend using Google's `CompiledModel` architecture, not LiteRT-LM Omni as an assumed NPU backend.
4. Adapt Google sample's encode/decode and token-merger ideas to OGAM's shared PCM feed. Do not transplant its `MicrophoneAudioSource` or UI.
5. Pin the exact Qwen AOT file SHA, source commit, LiteRT 2.3.0 version, Qualcomm HTP runtime module (confirm SM8550/HTP V73), tokenizer, model metadata and licenses.
6. Verify `Build.SOC_MODEL` and NPU compatibility on PGEM10; assert actual NPU backend assignment and CPU fallback reason in diagnostic logs.
7. Build Russian offline evaluation: WER/CER, command exact match, names/numbers, noisy far-field speech, quiet speech, clipped audio, 5-second boundaries, overlapping-window merge and cancellation.
8. Measure first partial latency, stable transcript latency, real-time factor, peak RSS, CPU/NPU utilization, battery and thermal throttling. Compare against Nemotron using identical audio and session conditions.
9. Keep Qwen rolling-window backend as optional/fallback if its first stable partial is too slow for natural dialogue; use Nemotron for interactive commands unless test results reverse the ranking.

## 8. Research decision

Qwen3-ASR 0.6B is approved for a controlled offline evaluation track. The exact SM8550 AOT artifact and a public Android LiteRT NPU implementation pattern exist. This is a significant new candidate.

It is not yet approved as the default Jarvis microphone backend: the NPU model is ~1.9 GB, its LiteRT live path uses overlapping fixed windows rather than true streaming, context/hotword exposure is unclear, and OPPO runtime/performance has not been tested.

No OGAM source code, dependency versions, model weights or APKs were changed in this research pass.