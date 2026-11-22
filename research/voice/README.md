# OGAM / Jarvis — Voice Research Index
Date: 2026-11-22
Target: OPPO Find X6 Pro PGEM10 / Snapdragon 8 Gen 2 / Android 16 / ColorOS 16.0.5
Status: public source research and design notes; no new TTS/KWS model is integrated or benchmarked on the phone.

## Current research documents

- [Wake-word and Android background-microphone audit](OGAM_WAKEWORD_AND_BACKGROUND_MICROPHONE_RESEARCH_2026-11-22.md) — openWakeWord, AndroidWakeWord, Sherpa-ONNX, Android 12–16 background/microphone restrictions, Russian phrase and license checks.
- [Russian Android TTS backend audit](OGAM_RUSSIAN_TTS_ANDROID_BACKEND_AUDIT_2026-11-22.md) — RuVoice TTS source/license audit, Qwen3-TTS Android Kotlin/JNI, native streaming callback already exists in JNI C++ but is not exposed by Kotlin QwenEngine, Sherpa-ONNX callback path, microphone ownership and a public Android AEC experiment route (unverified on PGEM10).
- [Earlier Chinese/Indian on-device speech scan](../china-india/CHINESE_INDIAN_ON_DEVICE_SPEECH_SCAN_2026-11-22.md) — Qwen3-ASR/ASR and LiteRT routes, Qwen3-TTS LiteRT and Indian/Indic speech model scan.

## Decisions / no-go boundaries

1. Keep the physical microphone owner unique: OGAM AudioRecorderService. KWS/ASR/Whisper must share/subcribe to it or coordinate through one native capture service; never start a competing recorder.
2. Keep half-duplex voice turns until Android AEC is attached to and verified on the actual AudioRecord session and the assistant playback reference is demonstrably suppressed. Current AudioRecorderService.isEchoCancelled() deliberately returns false. Android AEC is attached by AudioRecord session ID; OBOE preset comments alone are not proof.
3. Preserve JarvisPcmStreamPlayer as the single Android AudioTrack/AudioFocus owner. TTS inference sends Float32 chunks; cancellation is generation-scoped.
4. No wake-word, TTS model or acceleration backend is selected until license, exact artifacts, hashes and PGEM10 measurement are available.
5. Do not copy RuVoice code or bundle its built-in v5_5_ru model: its root source and built-in model are CC BY-NC-SA 4.0. Official Silero now lists v5_6_ru as a newer Russian model, also under the main CC BY-NC-SA 4.0 license. The separate v5_cis_base_nostress MIT model pack is a clean-license candidate, but requires an independent stress/normalization layer and clean-room runtime.
6. Qwen3-TTS 0.6B Q4_K_M is the leading Kotlin/JNI prototype candidate. The reference JNI C++ already has nativeSynthesizeStreaming, but the Kotlin QwenEngine wrapper does not declare or expose it. Expose and test that existing JNI path only in an isolated benchmark build first.
7. Sherpa-ONNX remains a strong Kotlin chunked-TTS API/runtime candidate, but the located Russian MMS ONNX voice is CC BY-NC 4.0. VoxSherpa confirms an Android system TTS integration path and a Russian MMS catalogue entry, but its app is GPL-3.0, its own system TTS path appears to call the MMS loader with isMms=false, and its sentence-level output is not model-streaming.
8. No TTS/KWS model weights, external APK, or proprietary OPPO code are committed to the repository. The new VoxSherpa/MMS lead remains architecture/source evidence only.

## Next gate
Create a benchmark-only Kotlin backend harness around JarvisTtsBackend + JarvisPcmStreamPlayer; compare Qwen3-TTS Q4_K_M, a legal MIT Silero CIS pack with a clean-room runtime, and Sherpa-ONNX with a separately cleared Russian VITS/Piper voice. Run the same Russian corpus on PGEM10, record TTFA/RTF/RSS/temperature/battery/audio quality, then choose. Do not change the production voice path before evidence.
