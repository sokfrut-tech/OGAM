# Chinese and Indian open speech model scan for OGAM / Jarvis

Date: 2026-11-22
Target: OPPO Find X6 Pro PGEM10, Snapdragon 8 Gen 2 / SM8550, Android 16 / ColorOS 16.0.5. Primary language: Russian, offline-first.

## Executive result

A significant new deployment route was found beyond the earlier CosyVoice / Qwen3-ASR / tiny-voca scan: Google's LiteRT-LM and LiteRT samples now document Android paths for Qwen3-ASR and Qwen3-TTS. The Qwen3-ASR model card lists a Qualcomm SM8550-specific AOT NPU graph family, directly matching the phone's SoC. This is a high-priority new lead.

Do not replace OGAM's existing Qwen3-ASR llama.rn GGUF integration yet. Keep it and Whisper fallback while testing the LiteRT route as an alternate native backend.

## China: Qwen3-ASR 0.6B — highest priority Android/NPU lead

Sources:
- https://github.com/google-ai-edge/LiteRT-LM/blob/main/omni/docs/Qwen3-ASR-0.6B.README.md
- https://github.com/google-ai-edge/LiteRT-LM
- https://github.com/google-ai-edge/litert-samples
- https://github.com/QwenLM/Qwen3-ASR
- https://huggingface.co/litert-community/Qwen3-ASR-0.6B

Verified documentation:
- Qwen3-ASR 0.6B, Apache-2.0 weights/tokenizer, 30 languages and 22 Chinese dialects; Russian explicitly supported.
- INT8 .litertlm bundle is 960 MB, self-contained audio encoder + 28-layer Qwen3 decoder + tokenizer. Android CPU/GPU runner documented; model card recommends devices with 3–4 GB available RAM.
- Fixed 5-second audio encoder windows; overlapping 2.5–3.0 second stride, confirmed/unconfirmed text and seam alignment for long audio.
- Standalone .tflite graph variants are listed as AOT-compiled for Qualcomm SM8450, SM8550 (Snapdragon 8 Gen 2), SM8650, SM8750, SM8850 and other SoCs.
- The SM8550 AOT graph is a separate deployment artifact, not the 960 MB .litertlm bundle. Docs list the FP32 NPU graph family at 1.88–2.19 GB and direct LiteRT NPU C++/Kotlin APIs. Exact filename, graph I/O contract, NPU runtime version, memory and notices must be pinned from model files before integration.
- Android NDK C++ runner instructions are documented; C++ OmniEngine/OmniSession streaming API is documented for the .litertlm path.
- This is a documented deployment path, not proof of performance on OPPO/ColorOS. The precompiled SM8550 target is promising but must be tested on PGEM10; Qualcomm/ColorOS compatibility cannot be assumed.

Relevance:
- Potentially uses the target SoC NPU rather than OGAM's current CPU-only llama.rn n_gpu_layers=0 route.
- First smoke test should use 960 MB INT8 .litertlm. Test the larger SM8550 AOT graph separately after exact artifact and delegate checks.
- Benchmark cold/warm startup, first partial transcript, RTF, RAM, sustained heat, battery, cancellation and Russian noisy-speech accuracy.
- Do not claim NPU acceleration until device logs prove SM8550 NPU selection rather than CPU fallback.

## China: Qwen3-TTS 0.6B — high-priority Russian TTS candidate

Sources:
- https://github.com/QwenLM/Qwen3-TTS
- https://github.com/google-ai-edge/LiteRT-LM/blob/main/omni/docs/Qwen3-TTS-12Hz-0.6B-Base.README.md
- https://huggingface.co/litert-community/Qwen3-TTS-12Hz-0.6B-Base
- https://github.com/google-ai-edge/litert-samples

Verified documentation:
- Official Qwen3-TTS 0.6B supports Russian among 10 languages, streaming, style/emotion/prosody controls, and 3-second voice cloning on Base. Base weights and LiteRT-LM conversion are Apache-2.0.
- LiteRT-LM model bundle: INT8 v2 ~2.44 GB or INT4 ~2.24 GB. Model card reports near-real-time Galaxy S26 performance: RTF 1.24 GPU / 1.29 CPU, peak memory ~1.44 GB GPU / ~1.90 GB CPU, ~2 s GPU engine load after compilation cache.
- Android NDK omni_runner build and GPU/CPU run are documented; C++ OmniEngine/OmniSession exposes audio output chunks.
- A separate older Kotlin CPU sample for standalone TFLite graphs was verified on Pixel 8a but measured RTF ~2.06 after optimizations, and explicitly does not implement dual-track streaming. Do not confuse that older TFLite sample with the newer LiteRT-LM Omni bundle.
- Fast Galaxy S26 measurements do not prove OPPO SM8550 performance. Bundle is large and peak memory substantial; keep optional/download-on-demand and unload competing large models before testing.
- Qwen's 97 ms first-packet figure is an upstream architecture claim, not an OPPO benchmark.
- Bundled multilingual demo voice is available. Assess custom voice enrollment provenance and permissions separately.

Relevance:
- Qwen3-TTS LiteRT-LM is a more complete expressive Russian candidate than tiny-voca-ru, but much larger.
- Proposed split: tiny-voca-ru remains compact/low-storage fallback; Qwen3-TTS LiteRT is optional expressive/high-quality tier pending PGEM10 benchmark.
- Compare Russian names, abbreviations, dates, numbers and long answers with the same test corpus.

## India: AI4Bharat / Bodhan AI — strong Indic work, not Russian core

### Indic-Speak (Bodhan AI + AI4Bharat)
- https://huggingface.co/bodhan-ai/indic-speak
- 3B BF16 model, 22 Indian languages plus English.
- Current model is gated and requires accepting a custom Indic Open Model License; model card says voices are contracted/consenting recordings and it does not support voice cloning.
- Visible model file is ~6.6 GB. Too large for default phone voice path, does not list Russian, and no verified native Android/ONNX deployment found in inspected card.
- Future Indic-language expansion/reference only.

### IndicF5
- https://github.com/AI4Bharat/IndicF5
- https://huggingface.co/ai4bharat/IndicF5
- 0.4B model, 11 Indian languages, MIT model card. Requires reference audio + reference transcript. No Russian; official repo shows Python/Transformers workflow, not native Android runtime.
- Useful research source, not Russian Jarvis TTS.

### IndicConformer / Indic-Transcribe
- https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual
- IndicConformer is 600M, MIT, 22 Indic languages; its model card recommends newer Indic-Transcribe for better transcription across 25 Indian languages.
- Neither covers Russian; no verified Android/SM8550 path in reviewed official materials.
- Future Indic-language add-on only, not replacement for Russian Qwen3-ASR.

## Ecosystem findings and next gates

- Scan included public GitHub repositories, official model cards and ModelScope/Hugging Face references. Claims are treated as leads until a model/runtime/device contract exists.
- China priority: Qwen3-ASR LiteRT/SM8550 and Qwen3-TTS LiteRT-LM.
- India: AI4Bharat/Bodhan has strong Indic speech research, but language coverage and model size do not fit Russian-first target.
- Continue Gitee, GitCode, AtomGit, ModelScope and Hugging Face search for native Android/Qualcomm ports; do not import code/weights until license, provenance, hashes and runtime compatibility are checked.

Implementation gates:
1. Pin Qwen3-ASR LiteRT revision and SHA-256; identify exact SM8550 AOT filename and I/O contract.
2. Create isolated Android benchmark flavor, not production integration.
3. Run 960 MB INT8 .litertlm on PGEM10 first; record CPU/GPU backend and memory. Separately test SM8550 AOT graph if exact artifact is available.
4. Compare with existing OGAM Qwen3-ASR GGUF on identical Russian corpus; preserve Whisper fallback.
5. Pin Qwen3-TTS LiteRT-LM INT8/INT4 and test Russian phrases on PGEM10; measure first PCM packet, RTF, RSS, thermals and voice quality.
6. Keep tiny-voca-ru as compact fallback until Kotlin frontend parity and Android benchmark complete.
7. No production dependency or model catalog default change until evidence passes.

Evidence labels:
- Verified in source/model cards: language support, published artifact sizes, declared architecture, documented Android build path, declared SoC variants.
- Not verified: OPPO PGEM10 runtime, actual NPU selection, battery/thermal behavior, end-to-end UX, quality on this Jarvis corpus.


## Additional China scan: MiniCPM-V 4.7 and MiniCPM5 for the Jarvis brain/eyes

Sources:
- https://github.com/OpenBMB/MiniCPM-V
- https://github.com/OpenBMB/MiniCPM-V-Apps
- https://github.com/OpenBMB/MiniCPM
- https://modelscope.cn/models/OpenBMB/MiniCPM-V-4.7-1B

### MiniCPM-V 4.7 1B — candidate for Jarvis camera / screenshot / document understanding
- OpenBMB's October 2026 release includes a 1B dense variant and a 35B-A3B MoE variant.
- 1B variant supports single-image, multi-image, document and video understanding, with Android/iOS/HarmonyOS deployment and GGUF/llama.cpp/Ollama paths.
- Official Android app repository has Kotlin/Gradle Android demo, using a local llama.cpp-omni fork. It also supports model downloads and local inference.
- ModelScope card identifies 1.55B parameters and Apache-2.0; full BF16 model is about 3.13 GB. Quantized variants are available; exact GGUF quant file and runtime compatibility need pinning.
- Good candidate for visual Jarvis skills: camera scene description, screenshot reading, object/context questions, document OCR-like understanding, UI assistance. It is not an audio assistant and not a replacement for ASR/TTS.
- No OPPO Find X6 Pro / SM8550 benchmark found. The published phone demos include iPhone 17 Pro Max and platform support statements; do not assume performance on PGEM10. Validate Android build, RAM, heat, image size and Russian visual-language prompts.

### MiniCPM5-2B — candidate for local text reasoning / planner
- OpenBMB MiniCPM repo changelog says MiniCPM5-2B released 2026-09-07 as a dense 2B model for on-device/resource-constrained use; 1B version released 2026-05-19. Hybrid Think/No Think reasoning and deployment Agent Skills are advertised.
- A separate open-source mLLM project reports Android ARM CPU support for MiniCPM5-2B, but that is a community runtime integration, not proof of official OpenBMB Android APK support.
- Candidate for offline planner/secondary brain evaluation against existing Qwen/Gemma small models; must benchmark Russian reasoning, tool-call reliability, token throughput, memory and license. Do not replace current main model without head-to-head task set.

### MiniCPM-o 4.5 — capable but not phone-default
- OpenBMB's 9B end-to-end omni model combines vision, speech and text with full-duplex real-time interaction.
- ModelScope lists about 9.37B parameters and ~20.05 GB weights, Apache-2.0.
- Valuable architecture/reference for Jarvis multimodal conversation, but too large for the current phone as a default local model. Treat as desktop/server research, not a PGEM10 target.

### India: Bharat-Tiny-LLM v3 — interesting but language-specific
- https://huggingface.co/eulogik/Bharat-Tiny-LLM-v3
- 1.7B Hindi/Hinglish/English model adapted from Qwen3-1.7B, with a Q4_K_M claim around 1.0 GB and offline phone/laptop/browser usage.
- Model card reports only 29% on a pinned 100-example GSM8K-Hindi subset and retracts an earlier higher figure. Treat benchmark claims carefully.
- Not Russian-capable by declared target; no reason to displace Russian-first OGAM planner. Could be a useful reference for future multilingual tokenization / India language pack.

Decision:
- Add MiniCPM-V 4.7 1B to the Jarvis visual-model shortlist for an Android prototype; it is more immediately actionable than MiniCPM-o 4.5.
- Add MiniCPM5-2B to offline planner benchmark candidates, not a production replacement.
- Keep MiniCPM-o 4.5 as architecture reference only due ~20 GB weights.
- India scan remains language-specific; the strongest discovered small model Bharat-Tiny-LLM v3 is Hindi/Hinglish/English, not Russian.
