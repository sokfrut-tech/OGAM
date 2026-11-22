# Chinese open-model and Android implementation review — 2026-11-22

Status: research finding; no third-party code or model weights imported into OGAM.

## Executive finding

A particularly relevant, unusually advanced public Android implementation was found:
- Repository: https://github.com/Nian27/CosyVoice3-MNN
- It ports Alibaba Fun-CosyVoice 3.0 to a fully local Android arm64 app using MNN 3.6.1 and JNI.
- The repository documents an end-to-end LLM → Conditioner → Flow → HiFT synthesis pipeline, model import/export and integrity checks, voice profiles, instruction-controlled delivery, and hardware fallback.
- This is a concrete implementation to study, not merely a model card. It is a strong candidate reference for OGAM's local Russian Jarvis TTS subsystem.

## Critical compatibility caveat for our target device

Target: OPPO Find X6 Pro / PGEM10 (Snapdragon 8 Gen 2, SM8550).

The repository README says its accelerated q_proj route was validated on SM8850 (Honor Magic8 Pro), while other devices use CPU/OpenCL compatibility paths. Its published performance numbers are from SM8850 only:
- warm RTF approximately 0.79–0.96 (one reported FP16 result 0.82);
- process PSS approximately 2.25 GB with all three MNN modules resident;
- model archive approximately 1.3 GiB;
- recommended RAM 8 GB+.
The README explicitly says non-SM8850 devices were not real-device validated; CPU fallback may be materially slower. Therefore do NOT claim Find X6 Pro compatibility/performance until tested on PGEM10. Do not copy the SM8850-specific Hexagon stub/skeleton or NPU route into OGAM.

## Model and speech stack candidates

### 1. TTS: Fun-CosyVoice 3.0 / CosyVoice3-MNN
Official model/runtime project:
- https://github.com/QwenAudio/CosyVoice
- https://github.com/Nian27/CosyVoice3-MNN

Official CosyVoice repository describes Fun-CosyVoice 3.0 open weights (0.5B) and Russian among 9 supported languages; it advertises text-in/audio-out bi-streaming, instruction control (language, dialect, emotion, speed, volume), and cross-lingual voice cloning. Treat the advertised 150 ms latency as a project claim, not a measurement on PGEM10.
The MNN Android port is the most actionable lead: it documents JNI integration, local model packages outside the APK, voice profile management, and measured failure modes. Its own README reports the whole MNN model package at about 1.3 GiB and PSS about 2.25 GiB on the tested SM8850 device.

Decision: prioritize source audit and isolated PGEM10 benchmark before integrating. First test Russian pronunciation, long-form stability, cold/warm latency, memory, thermal behavior, cancellation, and offline operation. Preserve Piper as a lightweight fallback until the candidate passes.

### 2. ASR: Qwen3-ASR
Official repository:
- https://github.com/QwenLM/Qwen3-ASR

The published Qwen3-ASR family has 0.6B and 1.7B variants, supports Russian and German among its listed languages, and describes both offline and streaming inference. This is a promising multilingual ASR candidate for Russian/German voice commands. The official inference paths shown are Python/Transformers/vLLM; native Android arm64 deployment is not established by that repository page. Do not wire it into the Android app until a supported runtime/export path and actual PGEM10 resource profile are proven.

### 3. ASR/audio understanding: SenseVoiceSmall + FunASR
- https://github.com/QwenAudio/SenseVoice
- https://github.com/modelscope/FunASR

SenseVoiceSmall offers ASR, language identification, emotion and acoustic-event tags; official listed checkpoint languages are Mandarin, Cantonese, English, Japanese and Korean. It does NOT list Russian, so it is not the primary Russian ASR for Jarvis. It could be useful for Chinese-language Breeno command research or as an optional Chinese audio route.
FunASR is a broader toolkit with offline/streaming ASR, VAD, punctuation and speaker pipelines. Toolkit license and individual model licenses must be reviewed separately. Python/CUDA-oriented examples are not proof of native Android support.

## Previously identified Chinese/Asian Android assistant projects

Earlier research notes already listed:
- Zorv AI — multi-tool Android assistant, MNN/llama.cpp and Android integration patterns; inspect permission model and real device behavior before borrowing architecture.
- Eta — system-assistant concepts for ColorOS/HyperOS, VoiceInteractionService, power-button activation and screen context.
- Uktam.ai — Sherpa-ONNX, IndicConformer and llama.cpp JNI integration ideas.
- AIAssistant — Vosk offline ASR.
- DSH Mobile — Termux/Accessibility approach.
- PocketMind, AzCode, Aries AI, Phtomt, Naomi and Neyam Vaani as adjacent projects to compare.
These were research leads, not integrated components. The earlier search had not confirmed a production-ready OGAM-compatible app on Gitee/ModelScope/OpenI.

## Breeno reverse-engineering boundary

OGAM separately analyzed 26 user-supplied OPPO/Breeno APKs statically. Findings included KWS/wakeup libraries, VAD/AEC indicators, local TTS, MNN, SpeechService, OmniMind, AnalogSkillService, SQLCipher and local search/RAG indicators. This is structural evidence only: no full JADX method-level analysis or runtime tracing has yet proven the exact behavior of each component. No proprietary APK/DEX/Smali/native binaries/OEM assets are to be copied into OGAM.

## Recommended implementation order

1. Audit Nian27/CosyVoice3-MNN source, license, model provenance, build scripts, JNI interfaces and supply-chain dependencies. Compare with official QwenAudio/CosyVoice source; record exact upstream commits.
2. Build a disposable test APK/flavor only; keep model weights external to the APK and use explicit SHA-256 verification.
3. Test on the actual PGEM10 / SM8550: installation, cold start, Russian speech quality, 5–30 second prompts, repeated synthesis, memory/PSS, CPU/OpenCL backend, thermal throttling, process death/recovery, airplane mode.
4. If acceptable, wrap it behind OGAM's existing deterministic TTS provider interface; do not replace Piper until quality/resource gates pass.
5. Separately investigate Qwen3-ASR 0.6B as an optional ASR experiment. Prove Android arm64 runtime support and benchmark before choosing it over the existing Sherpa-ONNX/Silero path.
6. Keep SenseVoiceSmall as an optional Chinese-language experiment, not the Russian default.
7. Keep all model downloads user-controlled, checksum-verified, license-reviewed, and outside the APK. No mandatory cloud/API/account/telemetry.

## What is integrated in OGAM today?

As of this note, none of CosyVoice3-MNN, Qwen3-ASR, FunASR or SenseVoice has been integrated into OGAM. This note records research and prioritization only. Existing OGAM native work remains separate; do not report the above as implemented or device-tested.

## Primary sources

- https://github.com/Nian27/CosyVoice3-MNN
- https://github.com/QwenAudio/CosyVoice
- https://github.com/QwenLM/Qwen3-ASR
- https://github.com/QwenAudio/SenseVoice
- https://github.com/modelscope/FunASR
- https://github.com/modelscope/FunASR/blob/main/docs/model_selection.md
