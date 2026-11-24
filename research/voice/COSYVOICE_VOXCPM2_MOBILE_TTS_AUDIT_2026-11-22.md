# OGAM / Jarvis — CosyVoice 3 and VoxCPM2 Mobile TTS Audit
Date: 2026-11-22
Target: OPPO Find X6 Pro PGEM10 / Snapdragon 8 Gen 2 (SM8550) / Android 16 / ColorOS 16.0.5
Status: repository, model-card and public issue audit. No TTS weights or APK downloaded; no model run/build/device benchmark performed.

## Executive decision

The newest Chinese TTS research adds two useful but very different candidates:

- **CosyVoice 3 0.5B / 2512** — Apache-2.0 weights; MIT community C++/GGUF port; Q4_K_M about 629 MB and supports Android ARM64 build instructions. Its Russian support is officially advertised, but a public issue reports outputting Chinese instead of Russian even with Russian reference audio, Russian transcript, cross-lingual mode and explicit instructions. Treat Russian quality as **unverified / high-risk**, not production-ready.
- **VoxCPM2 2B** — Apache-2.0 code and weights; explicitly lists Russian among 30 languages and publishes author-reported Russian WER 0.90% on an internal 500-sample language set. But the official desktop reference expects about 8 GB VRAM and reports RTF ~0.30 on RTX 4090; the Soniqo ARM/LiteRT model bundle is approximately 8.7 GB on disk. This is a quality/architecture reference, not a viable first OPPO deployment candidate.

Continue prioritizing direct PGEM10 tests of Qwen3-TTS 0.6B and Supertonic-3. Keep CosyVoice as a lower-priority experimental option only after a short Russian playback test. Keep VoxCPM2 as a large-model reference and possible future desktop/server voice-design engine.

## 1. CosyVoice 3 — official model evidence and Russian caveat

### 1.1 Official model and license

Official model card:
- FunAudioLLM/Fun-CosyVoice3-0.5B-2512
- 0.5B parameter family; model card declares Apache-2.0.
- Advertises 9 languages, including Russian, and multilingual/cross-lingual zero-shot voice cloning.
- Advertises text-in/audio-out bi-streaming, with latency "as low as 150 ms" in its model description. This is a model/project claim, not an Android latency result.
- The official listed pronunciation-inpainting controls are Chinese Pinyin and English CMU phonemes; no Russian phoneme/stress inpainting mechanism was found in the inspected tokenizer/code.

Sources:
- Official Hugging Face model card: https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512
- Official repository: https://github.com/QwenAudio/CosyVoice

### 1.2 Public Russian failure report

GitHub issue #1790, opened 2026-01-16, describes Russian reference audio + Russian transcript + Russian target text yielding Chinese speech. The reporter tested:
- inference_zero_shot;
- inference_cross_lingual;
- inference_instruct2 with an explicit "speak in Russian" instruction;
- attempted language-tag input, including <|ru|>.

The issue says the same output-language failure persisted across these tests. As checked on 2026-11-22, the issue was closed with the stale label and had no assignee, linked branch or pull request. I found no maintainer fix or reproducible success report tied to that issue. It is a user report, not an independent reproduction, but it is material enough to block a production choice until tested.

Issue:
https://github.com/QwenAudio/CosyVoice/issues/1790

Decision: official "9 languages" coverage is not enough for OGAM. Do not select CosyVoice for Russian voice until a repeatable Russian corpus test succeeds with the exact model revision and runtime.

### 1.3 GGUF and Android community port

Community implementation:
- Repository: https://github.com/Lourdle/cosyvoice.cpp
- Inspected commit: 81ce60cd682ff44b8ab4a9226c097b4aff64d1f6
- Runtime code license: MIT.
- Community model pack: Lourdle/Fun-CosyVoice3-0.5B-2512-GGUF, declared Apache-2.0.
- Exact Q4_K_M GGUF size reported: about 629 MB (0.59 GiB); Q5_K_M about 683 MB; Q8_0 about 944 MB; F16 about 1.72 GB; F32 about 3.44 GB.
- The model pack's own notes say Q4_K_M can sound muffled; Q4_1 / Q4_0 and lower quantizations have more artifacts. These are community listening notes, not Russian blind-test results.
- Current README's hardware table says OpenCL on Android 16 was tested on Snapdragon 8 Elite, but many ops fall back to CPU and frequent GPU/CPU context switching gave no significant speedup over CPU. It explicitly turns off Adreno-specialized kernels for this model because of shape limitations.

The repository's Android cross-build guide states:
- arm64-v8a, ANDROID_PLATFORM=24, shared Android STL;
- COSYVOICE_NO_FRONTEND=ON, COSYVOICE_NO_ICU=ON for its documented CPU build;
- C++20 and CMake >= 3.28 at the project root;
- for ARM64 the SIMD path can use SIMDe to map x86-style SIMD to NEON; without SIMDe it can fall back to scalar kernels;
- Android OpenCL instructions include an Android 16 loader path, but their own benchmark notes show no significant speed-up on the Snapdragon 8 Elite.
- Android cosyvoice-server additionally requires NDK r28+/Clang 19+ for C23 #embed; the core library build does not require building that server.

OGAM compatibility gap:
- Current audited OGAM build uses C++17, CMake 3.22.1, NDK 27.1.12297006.
- CosyVoice.cpp requires C++20 and CMake >=3.28, so it is not a drop-in addition to the existing native build.
- It vendors a new GGML project. OGAM already builds Stable Diffusion/Video with its own GGML and llama.rn has another native runtime. Do not add CosyVoice's top-level CMake as a child of OGAM's current CMake: isolate it in a separate Android library/native build and check symbols, ABI, STL and GGML compatibility.
- The Android instructions disable the ONNX frontend. The documented runtime command then requires a previously prepared prompt_speech.gguf. This means a user cannot freely create/refresh a voice reference entirely on the phone through that documented build alone. An Android frontend or separate clean-room reference-conditioning flow would be needed.
- The official Python model's 150 ms streaming claim is not evidence for this C++ port on Android. The community port supports chunk callbacks, but actual first-chunk latency and chunk size must be measured on PGEM10.

### 1.4 Soniqo C++ CosyVoice3 wrapper

The Soniqo speech-core audit describes OnnxCosyVoice3Tts using five inference graphs:
- llm_prefill.onnx
- llm_step.onnx
- flow_frontend.onnx
- flow.decoder.estimator.fp32.onnx
- hift.onnx
plus a Qwen text tokenizer.

It consumes a cached conditioning blob (prompt token IDs, prompt speech tokens, prompt mel and a 192-dim speaker embedding); the wrapper does not itself compute the frontend conditioning from raw reference audio. This makes it useful as an architecture reference, not an end-to-end mobile voice-capture implementation.

Soniqo source:
https://github.com/soniqo/speech-core/blob/59b9d7902ea62dbbbfb95e139e2bf0e8957f8753/docs/models.md

### CosyVoice verdict

- **License:** good (Apache weights; MIT community runtime).
- **Russian:** officially listed, but one material unresolved public report of wrong-language output; no OGAM result.
- **Storage:** Q4_K_M ~629 MB, but runtime/front-end assets add to this.
- **Android:** community ARM64 build instructions exist; not validated on PGEM10. Current OGAM build needs a separate module/toolchain update and GGML isolation.
- **Voice clone workflow:** documented Android build disables the frontend; needs precomputed prompt audio/conditioning.
- **Priority:** reserve as a later experimental candidate; do not download or integrate before a quick exact-revision Russian test.

## 2. VoxCPM2 — stronger Russian evidence, unsuitable scale for this phone

### 2.1 Official model evidence and license

OpenBMB's current repository declares:
- VoxCPM2: 2B parameters, tokenizer-free diffusion autoregressive architecture;
- 30 languages including Russian;
- native 48 kHz audio output;
- natural-language voice design and controllable voice cloning from a short reference;
- Apache-2.0 code and weights.

Official repo:
https://github.com/OpenBMB/VoxCPM

The official comparison lists VoxCPM1.5 (0.6B) and VoxCPM-0.5B as **Chinese/English only**. They are not smaller Russian-capable substitutes. The Russian coverage applies to the 2B VoxCPM2 release.

### 2.2 Russian quality evidence

OpenBMB publishes its internal multilingual intelligibility benchmark:
- 30 languages × 500 samples;
- Russian (ru) WER reported as 0.90% for VoxCPM2, compared with 0.86% for Fish S2-Pro.
- The authors say ASR scoring uses Gemini 3.1 Flash Lite API.

This is a useful, explicit Russian benchmark unlike a bare language-list claim. Limitations:
- It is author-run, not an independent blind evaluation.
- The benchmark uses the authors' own data and cloud ASR evaluator; the corpus composition, speaker balance, punctuation normalization and confidence intervals are not detailed in the inspected README.
- It evaluates intelligibility, not Russian stress/naturalness, voice similarity, long-turn prosody or OPPO runtime.
- Do not compare its 0.90% WER directly with CosyVoice CER, Supertonic RTF or our own future test corpus.

### 2.3 Hardware and mobile feasibility

Official desktop reference:
- RTX 4090 RTF about 0.30 on standard PyTorch path; about 0.13 via Nano-vLLM/vLLM-Omni.
- About 8 GB VRAM per the official model documentation.
- These are desktop/GPU numbers, not Snapdragon CPU/NPU measurements.

Soniqo speech-core has a separate LiteRT VoxCPM2 implementation, which is an especially useful ARM architecture study:
- four LiteRT graphs: text-prefill, token-step, audio-encoder and audio-decoder;
- 48 kHz output;
- reference-audio cloning and optional transcript conditioning;
- native chunk callback flushes after up to 64 autoregressive steps (up to 10.24 seconds per chunk), so this is chunked generation, not an audio token per-frame stream;
- ARM/selective model bundle is about 8.7 GB on disk; Soniqo says the fp32 LocDiT estimator is required for clean cloned-voice sibilants;
- the very large prefill graph is loaded for the prefill stage and released after; token-step/decoder/reference encoder remain resident. The exact peak RSS on PGEM10 is not published.

Therefore the Android LiteRT port demonstrates architectural portability, not that a 2B voice model is practical on a phone. Do not conflate 8.7 GB bundle size with measured resident RAM; separate weights-on-disk, peak RSS, KV/cache and temporary graph memory in any future test. With OPPO's available memory and other assistant models, this is not a sensible first on-device integration target.

### 2.4 GGUF community option

There are community GGUF ports (including tc-mb/llama.cpp-omni and DennisHuang648/VoxCPM2-GGUF) that advertise CPU/Metal/CUDA/Vulkan paths and Q8_0 variants. The inspected repository presents an M4 Pro RTF around 1.76 for a Q8_0 build, far slower than official RTX 4090 numbers. It is not evidence of Android performance. No verified ARM64 Android VoxCPM2 build or PGEM10 benchmark was found in this pass.

### VoxCPM2 verdict

- **License:** Apache-2.0.
- **Russian:** explicit 30-language list plus author-reported Russian WER 0.90% on 500 samples.
- **Voice design/cloning:** very interesting; supports both natural-language voice design and reference cloning.
- **Phone feasibility:** no-go for first OPPO prototype: 2B, desktop 8 GB VRAM target, huge 8.7 GB ARM LiteRT bundle, no PGEM10 evidence.
- **Priority:** preserve as a quality/voice-design reference; revisit only if an efficient much-smaller distilled/quantized ARM model becomes available.

## 3. Comparative placement in OGAM's candidate matrix

| Candidate | Russian evidence | Model/runtime footprint | Streaming reality | OGAM next decision |
|---|---|---|---|---|
| Qwen3-TTS 0.6B Q4_K_M | Russian included; acoustic result still required | ~884 MB paired GGUF/tokenizer in inspected Android example | Native C++ decoder chunk stream exists; current Kotlin wrapper does not expose it | Keep high-priority Android prototype |
| Supertonic-3 LiteRT 99M | ru included in 31 languages; no independent Russian listening result | ~380 MB bundle; 832 MB reported peak | piece callback; about 1.1s TTFA on S23 Ultra (author-reported) | Keep high-priority benchmark; OpenRAIL-M terms apply |
| CosyVoice3 0.5B GGUF | ru listed, but issue #1790 reports wrong Chinese output | Q4_K_M ~629 MB plus frontend/runtime | true chunk callback in community C++; Android latency unknown | Low-priority experiment only after Russian smoke test |
| VoxCPM2 2B | ru listed; author-reported WER 0.90% (500 samples) | official ~8 GB VRAM; Soniqo ARM bundle ~8.7 GB on disk | decoder chunk callback every up to 64 AR steps / 10.24 s | Reference only; no phone integration |

All model metrics above are from different evaluations and are not directly comparable. The final choice must use the same Russian test text, speaker references, audio route, device state and measurement protocol on PGEM10.

## 4. Next actions

1. Do not integrate CosyVoice or VoxCPM2 into OGAM production.
2. If a short host-side Russian smoke is later run for CosyVoice, pin the exact 2512 model, exact GGUF/runtime commit, one Russian reference clip and 10–20 phrases from the OGAM corpus. Record audio output and decode it with an independent Russian ASR plus human listening. Stop immediately if it speaks Chinese or loses Russian phonology.
3. Continue the main handset benchmark plan with Qwen3-TTS and Supertonic-3 first.
4. Keep LocalVQE AEC separate from TTS selection; TTS benchmark must not implicitly change microphone capture or enable full duplex.
5. Do not commit model weights, private reference recordings or cloned voice samples to Git.

## 5. Sources and inspected pins

- Official CosyVoice model card and language/licence claims: https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512
- Russian wrong-language issue #1790: https://github.com/QwenAudio/CosyVoice/issues/1790
- Community CosyVoice C++/GGUF runtime, MIT: https://github.com/Lourdle/cosyvoice.cpp/tree/81ce60cd682ff44b8ab4a9226c097b4aff64d1f6
- Community CosyVoice model pack, Apache-2.0 and quantization sizes: https://huggingface.co/Lourdle/Fun-CosyVoice3-0.5B-2512-GGUF
- CosyVoice Android build guide: https://github.com/Lourdle/cosyvoice.cpp/blob/81ce60cd682ff44b8ab4a9226c097b4aff64d1f6/docs/build-android.md
- CosyVoice streaming implementation notes: https://github.com/Lourdle/cosyvoice.cpp/blob/81ce60cd682ff44b8ab4a9226c097b4aff64d1f6/docs/STREAMING.md
- OpenBMB VoxCPM2 model/code, Apache-2.0 and language table: https://github.com/OpenBMB/VoxCPM
- Official OpenBMB VoxCPM2 guide with 2B/8 GB VRAM: https://openbmb.cn/docs/en/guides/voxcpm/voxcpm-2
- Soniqo VoxCPM2 LiteRT architecture/footprint: https://github.com/soniqo/speech-core/blob/59b9d7902ea62dbbbfb95e139e2bf0e8957f8753/docs/models.md

No code changes, model downloads, builds, APKs or phone tests were performed during this audit.
