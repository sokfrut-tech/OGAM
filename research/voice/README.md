# OGAM / Jarvis — Voice Research Index
Date: 2026-11-22
Target: OPPO Find X6 Pro PGEM10 / Snapdragon 8 Gen 2 / Android 16 / ColorOS 16.0.5
Status: public source research and design notes; no new TTS/KWS model is integrated or benchmarked on the phone.

## Current research documents

- [Qwen3-ASR LiteRT SM8550 and streaming audit](OGAM_QWEN3_ASR_LITERT_SM8550_AND_STREAMING_AUDIT_2026-11-23.md) — exact Snapdragon 8 Gen 2 AOT export found; distinguishes the 960 MB CPU/GPU LiteRT-LM bundle from the ~1.9 GB SM8550 standalone NPU graph and documents 5 s sliding-window latency limits.

- [Nemotron LiteRT streaming integration audit](OGAM_NEMOTRON_LITERT_STREAMING_INTEGRATION_AUDIT_2026-11-23.md) — validates caller-fed 16 kHz PCM streaming API and Russian prompt selection; identifies the current LiteRT engine's hardcoded CPU accelerator and Goodnotes AOT model-pack mismatch.

- [SM8550-specific Nemotron LiteRT follow-up](OGAM_RUSSIAN_STREAMING_ASR_MODEL_PROVENANCE_AUDIT_2026-11-23.md#7-oppo-specific-litert-export-discovered-goodnotes-sm8550-aot) — identifies Goodnotes FP16/W8A16 Nemotron exports with a Qualcomm SM8550 AOT encoder, runtime/version gates, and license-notice caveats.

- [Russian streaming ASR provenance audit](OGAM_RUSSIAN_STREAMING_ASR_MODEL_PROVENANCE_AUDIT_2026-11-23.md) — corrects the Parakeet-EOU language/license discrepancy; prioritizes Nemotron 3.5 LiteRT for Android streaming tests, keeps Parakeet TDT v3 as a Russian quality/batch reference, and tracks Nemotron Labs Unified ASR pending Android export.

- [Wake-word and Android background-microphone audit](OGAM_WAKEWORD_AND_BACKGROUND_MICROPHONE_RESEARCH_2026-11-22.md) — openWakeWord, AndroidWakeWord, Sherpa-ONNX, Android 12–16 background/microphone restrictions, Russian phrase and license checks.
- [Russian Android TTS backend audit](OGAM_RUSSIAN_TTS_ANDROID_BACKEND_AUDIT_2026-11-22.md) — RuVoice TTS source/license audit, Qwen3-TTS Android Kotlin/JNI, native streaming callback already exists in JNI C++ but is not exposed by Kotlin QwenEngine, Sherpa-ONNX callback path, microphone ownership and a public Android AEC experiment route (unverified on PGEM10).
- [Earlier Chinese/Indian on-device speech scan](../china-india/CHINESE_INDIAN_ON_DEVICE_SPEECH_SCAN_2026-11-22.md) — Qwen3-ASR/ASR and LiteRT routes, Qwen3-TTS LiteRT and Indian/Indic speech model scan.


- [Russian audio evaluation corpus v1](JARVIS_RUSSIAN_AUDIO_EVALUATION_CORPUS_V1_2026-11-22.md) — fixed phrases for Russian stress/homographs, numbers and units, technical language, Jarvis responses, wake-word positive/negative tests, AEC scenarios, and a repeatable PGEM10 benchmark protocol. Text-only; no user audio stored.


- [Qwen3-TTS Android integration/build-isolation plan](OGAM_QWEN3_TTS_ANDROID_INTEGRATION_PLAN_2026-11-22.md) — exact NDK/CMake/GGML pins, confirmed duplicate-target risk with the existing Stable Diffusion native build, isolated Android library options, JNI callback contract and benchmark acceptance gates.


- [Soniqo Speech Android: Supertonic-3 and LocalVQE AEC audit](SONIQO_SUPERTONIC_LOCALVQE_ANDROID_AUDIT_2026-11-22.md) — Russian-capable 99M LiteRT TTS and its OpenRAIL-M model terms, S23 Ultra benchmark reference, actual Android TTS API limits, plus 16 kHz timestamped LocalVQE echo cancellation and its Kotlin/JNI integration gap.


- [CosyVoice 3 and VoxCPM2 mobile TTS audit](COSYVOICE_VOXCPM2_MOBILE_TTS_AUDIT_2026-11-22.md) — CosyVoice's unresolved public Russian wrong-language report and Android GGUF build/toolchain/frontend gaps; VoxCPM2's 30-language/Russian WER evidence, Apache license and 2B/8 GB desktop / 8.7 GB ARM bundle scale.

- [Russian microWakeWord and Android KWS audit](OGAM_RUSSIAN_MICROWAKEWORD_ANDROID_AUDIT_2026-11-22.md) — MIT trainer for Russian «Джарвис», author-reported 47/50 real activations and 1/140 hard negatives, 82.5 KB TFLite output, exact MicroFrontend/stateful graph requirements, single-mic OGAM integration and Android 12–16 microphone privilege boundaries.

- [Alkove and Voicute Android KWS comparative audit](OGAM_ALKOVE_VOICUTE_ANDROID_KWS_AUDIT_2026-11-22.md) — Alkove caller-supplied PCM API, seven-language Spot/Lex limit, manual-IPA caveat, Focus/Cue/AEC reference, Voicute Android ONNX sliding-window engine and seven-language model limit.


- [Existing OGAM TTS/PCM and microphone contract audit](OGAM_EXISTING_TTS_PCM_AND_MICROPHONE_CONTRACT_AUDIT_2026-11-23.md) — source-level confirmation of the model-only TTS boundary, single Jarvis AudioTrack/AudioFocus owner, shared AudioRecorderService capture, and the missing monotonic AEC reference-timestamp path.

## Decisions / no-go boundaries

1. Keep the physical microphone owner unique: OGAM AudioRecorderService. KWS/ASR/Whisper must share/subcribe to it or coordinate through one native capture service; never start a competing recorder.
2. Keep half-duplex voice turns until Android AEC is attached to and verified on the actual AudioRecord session and the assistant playback reference is demonstrably suppressed. Current AudioRecorderService.isEchoCancelled() deliberately returns false. Android AEC is attached by AudioRecord session ID; OBOE preset comments alone are not proof.
3. Preserve JarvisPcmStreamPlayer as the single Android AudioTrack/AudioFocus owner. TTS inference sends Float32 chunks; cancellation is generation-scoped.
4. microWakeWord is now the first Russian KWS benchmark candidate, not yet a selected production engine. Its 82.5 KB / 94% / 1-of-140 figures are author-reported; the model binary is absent from the inspected trainer repo and requires an exact MicroFrontend + TFLite dtype/operator audit and PGEM10 test.
5. No TTS/KWS model or acceleration backend is selected for production until license, exact artifacts, hashes and PGEM10 measurement are available.
6. Do not copy RuVoice code or bundle its built-in v5_5_ru model: its root source and built-in model are CC BY-NC-SA 4.0. Official Silero now lists v5_6_ru as a newer Russian model, also under the main CC BY-NC-SA 4.0 license. The separate v5_cis_base_nostress MIT model pack is a clean-license candidate, but requires an independent stress/normalization layer and clean-room runtime.
7. Compare Qwen3-TTS 0.6B Q4_K_M with Supertonic-3 LiteRT for Russian TTS. Qwen offers the Q4 GGUF/JNI route and an existing native streaming method; Supertonic is only 99M/31 languages and has an author-reported S23 Ultra CPU result of 0.34 RTF, ~1.1s TTFA and 832MB peak RAM. Supertonic weights are OpenRAIL-M, not unrestricted. The reference JNI C++ already has nativeSynthesizeStreaming, but the Kotlin QwenEngine wrapper does not declare or expose it. Expose and test that existing JNI path only in an isolated benchmark build first.
8. Sherpa-ONNX remains a strong Kotlin TTS runtime candidate; its VITS callback is batch/model-dependent and still accumulates the resulting GeneratedAudio buffer. The located Russian MMS ONNX voice is CC BY-NC 4.0. VoxSherpa confirms an Android system TTS integration path and a Russian MMS catalogue entry, but its app is GPL-3.0, its own system TTS path appears to call the MMS loader with isMms=false, and its sentence-level output is not model-streaming.
9. LocalVQE v1.4-AEC is a new AEC prototype candidate: 16 kHz, 256-sample paired mic/reference frames and timestamp-aligned fail-closed stream; the current Soniqo Android Kotlin/JNI SDK does not expose it. Keep OGAM half-duplex until a PGEM10 reference/mic sync test passes.
10. No TTS/KWS model weights, external APK, or proprietary OPPO code are committed to the repository. The new VoxSherpa/MMS lead remains architecture/source evidence only.

## Next gate
Create a benchmark-only Kotlin backend harness around JarvisTtsBackend + JarvisPcmStreamPlayer; compare Qwen3-TTS Q4_K_M, a legal MIT Silero CIS pack with a clean-room runtime, and Sherpa-ONNX with a separately cleared Russian VITS/Piper voice. Run the same Russian corpus on PGEM10, record TTFA/RTF/RSS/temperature/battery/audio quality, then choose. Do not change the production voice path before evidence.


- [Russian wake-word and Snapdragon 8 Gen 2 runtime follow-up](OGAM_RUSSIAN_WAKEWORD_AND_QNN_FOLLOWUP_2026-11-23.md) — custom Russian wake-word research, openWakeWord language/quality limits, sherpa KWS model gap, OGAM's verified single-mic/AEC boundary and SM8550 NPU runtime evidence.


## Wake-word next gate
The microWakeWord trainer is the first benchmark candidate for Russian «Джарвис». Before implementation, get or train a model with cleared Piper/negative-data provenance, inspect the real TFLite tensor types and operators, reproduce the 40-bin MicroFrontend and run the same held-out speaker/negative protocol on PGEM10. Do not create a second microphone capture owner. The VoiceInteractionService while-in-use exception is not a general FGS-start bypass or privileged DSP access; initial microphone activation must follow a visible user action and Android's current permission/service requirements.

## KWS comparison update
microWakeWord remains the first Russian «Джарвис» candidate. Alkove is worth an optional caller-supplied PCM experiment because it does not require a second mic, but Spot/Lex are only validated for fr/en/es/it/pt/ca/ro. Voicute is an Android ONNX/hard-negative reference, but its custom model catalogue does not include Russian. Neither replaces the Russian microWakeWord training path.


- [TEN VAD vs Silero VAD Android comparison (2026-11-23)](OGAM_TEN_VAD_SILERO_ANDROID_COMPARISON_2026-11-23.md) — new low-latency VAD challenger, common sherpa-onnx Kotlin API, 16 ms vs 32 ms windows, licensing caveat and OGAM single-microphone benchmark plan.

- [Android streaming speech stack and Russian model candidates (2026-11-23)](OGAM_ANDROID_STREAMING_SPEECH_STACK_AND_RUSSIAN_MODELS_2026-11-23.md) — Soniqo Speech Android/speech-core audit, Parakeet-EOU Russian streaming ASR candidate, Nemotron, Supertonic-3, Qwen3-TTS Android, Russian Piper voices/sherpa-onnx licensing, Voicute KWS and PGEM10 benchmark plan.
