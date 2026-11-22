# Jarvis — local Russian TTS runtime evaluation

Date: 2026-11-22  
Repository: `sokfrut-tech/OGAM`  
Branch: `feature/jarvis-step-2-storage-privacy`  
Status: research and architecture decision only. **No TTS runtime or model weights were added to OGAM by this evaluation.**

## Product requirements

A Jarvis voice-output backend must:

1. Synthesize Russian speech fully offline after the voice package has been downloaded.
2. Stream sentence/chunk audio so the first sentence can start before the full assistant reply is complete.
3. Support immediate cancellation/barge-in when the user starts speaking, app lifecycle changes, or a newer reply replaces the current one.
4. Expose Float32 PCM/sample-rate output to a single OGAM-owned playback queue; TTS engines must not own a second microphone or conversation session.
5. Run on Android API 24+ if possible, with ARM64 as the primary phone ABI. Optional models may be downloaded into OGAM model storage; they must not be bundled into the base APK.
6. Have a complete code, model, voice, training-data and attribution record. A permissive code licence does not automatically clear the voice/model dataset.
7. Be replaceable without changing Jarvis identity, chat history, system-assistant entry, skills or the HUD.

## Candidates inspected

| Candidate | Russian support | Runtime / integration | Distribution / licensing | Decision |
|---|---|---|---|---|
| Sherpa-ONNX Android 2.0.3 + Supertonic-3 | 31 languages including `ru`; G2P-free Unicode frontend | Android Kotlin API exposes `OfflineTts` and callback PCM generation. Official Android sample pins Maven `com.github.k2-fsa.sherpa-onnx:sherpa-onnx:v2.0.3`. | Sherpa code Apache-2.0. Supertonic-3 weights use OpenRAIL-M with use-based restrictions and downstream notice/redistribution requirements. HF repository currently reports 415 MB total. Soniqo's selected deployment notes say ~380 MB download and ~832 MB peak memory; these are vendor measurements, not OGAM/OPPO measurements. | **First runtime prototype candidate**, opt-in model download only, pending licence review and OPPO profiling. Do not put the model in the APK. |
| GarAlex/local-tts — Vosk 0.7 Russian | Native Russian Vosk multi-speaker model; five speaker IDs F01/F02/F03/M01/M02; native dictionary and explicit-stress frontend | MIT Rust project, native Rust inference, C ABI and cancellable synthesis. No Piper/eSpeak runtime; no Python at inference. Android NDK/Rust/ORT packaging, ABI size and latency have not been measured in OGAM. Unknown Russian words require manual stress annotation. | Code is MIT. The Vosk model card declares Apache-2.0, but the source documentation explicitly leaves dictionary/data licensing and detailed rights lineage for the training voices unresolved. | **Keep as a second candidate**. Do not ship voice assets until the dictionary/data/voice rights chain is resolved and a revision/hash is pinned. |
| TeraTTSv2 ONNX | Russian and English, ten styles; Russian stress annotation is automatic by default | ONNX Runtime, selectable diffusion samplers, streamed Float32 audio. Repository currently reports ~1.17 GB. Its model interface uses custom code; the HF guide currently requires `trust_remote_code=True`. No audited Android-native integration path has been demonstrated. | Custom OpenRAIL-M commercial-attribution licence. Commercial products must credit/link TeraTTSv2 publicly; redistribution must pass on both license files and use restrictions. | **Research-only**. Too large for the first OPPO prototype; custom-code and licence review required before any use. |
| Soniqo speech-android SDK | Supertonic-3 supports Russian; the SDK's default Kokoro voice bundle does **not** include Russian | Apache-2.0 Android SDK and Kotlin pipeline, but minSdk 26, NDK r29, CMake 4.1.2 and a `speech-core` git submodule. OGAM currently targets API 24 and uses a different native build. The SDK's published TTS table reports Supertonic-3 ~380 MB / ~832 MB peak RAM; measured on Galaxy S23 Ultra, not OPPO. | SDK code Apache-2.0; model license remains Supertonic OpenRAIL-M. | **Architecture reference, not a drop-in dependency**. Do not raise OGAM minSdk or pull the whole SDK/submodule only for TTS. |
| Piper / piper-phonemize | Several Russian voice files exist; each model has an independent dataset chain | Android sherpa samples show integration, but the text frontend package `piper-phonemize` is GPL-3.0-or-later because of eSpeak NG; current Piper engine is GPL-3.0-or-later. | Runtime/phonemizer GPL obligations and voice-specific model-card/data restrictions. Some voices have non-commercial or unresolved dataset ancestry. | **Do not bundle in OGAM's current distribution model** without an intentional licensing decision. |
| JokobeeTTS / Kokoro | The inspected supported voice packs do not provide Russian. | Kotlin Android modules exist; separate language packs. | Project/engine code Apache-2.0; voice/model packs still need their own audit. | Not a Russian-first candidate. |

## Evidence and source pins

### Sherpa-ONNX

- Repository: https://github.com/k2-fsa/sherpa-onnx
- Inspected source commit: `38016c6e0622e90bf417c35e8b47e0eb805af417` (release v2.0.3, 2026-11-22).
- License: Apache-2.0.
- Android source: `android/SherpaOnnxAar/sherpa_onnx/src/main/java/com/k2fsa/sherpa/onnx/Tts.kt`.
- API: `OfflineTtsSupertonicModelConfig`, `OfflineTtsConfig`, `OfflineTts.generateWithCallback`, `GeneratedAudio.samples` and `GeneratedAudio.sampleRate`. This provides the callback surface required for chunked streaming to an OGAM-owned `AudioTrack` player.
- Example Android dependency in the official sample: `com.github.k2-fsa.sherpa-onnx:sherpa-onnx:v2.0.3`.
- Official project: https://github.com/k2-fsa/sherpa-onnx

### Supertonic-3

- Model: https://huggingface.co/Supertone/supertonic-3
- The current model card lists 31 languages including Russian, approximately 99M parameters, local ONNX inference and no cloud synthesis.
- HF repository listing inspected during this review reported 415 MB total. Soniqo's selected Supertonic-3 Android package documentation lists ~380 MB and ~832 MB peak RAM. Different package subsets/packaging can account for the difference; treat the exact OGAM download size as unmeasured until the chosen assets and hashes are pinned.
- Licence: OpenRAIL-M. It grants use/distribution subject to required passing-on of restrictions and license notice. The license contains use-based restrictions; this is not equivalent to Apache/MIT and must be accepted before model distribution.
- Do not infer that the model's outputs are automatically clear for every purpose just because the model card says local/open-weight.

### Soniqo Android reference

- Repository: https://github.com/soniqo/speech-android
- Inspected commit: `66059f2a5bb9a91f6c7b5cabe59f4e74e72ddded`.
- Repository license: Apache-2.0.
- Maven SDK documented as `audio.soniqo:speech:0.0.28`.
- Its Gradle config specifies minSdk 26, NDK 29 and CMake 4.1.2; the library expects the `speech-core` native submodule.
- It demonstrates that a full local voice pipeline can be orchestrated in Kotlin, but bringing the whole dependency to OGAM would require a separate compatibility/build/provenance project.

### GarAlex/local-tts — Russian Vosk

- Repository: https://github.com/GarAlex/local-tts
- Inspected commit: `61efef0c129dff71c4ff93e0639ce290aeb674ca`.
- Project license: MIT.
- Russian assets manifest: https://github.com/GarAlex/local-tts/blob/61efef0c129dff71c4ff93e0639ce290aeb674ca/assets/russian-assets.json
- Russian archive URL is `vosk-model-tts-ru-0.7-multi.zip`, with pinned SHA-256 `5da7414fabad4df88ed2f3b930798506fe1fad40abdf1c742f7b05802d62de38`. The archive contains `model.onnx`, `dictionary` and `config.json`; the repository also retains the publisher model card and Vosk source licence.
- The model card declares Apache-2.0; however, the repository's own `docs/CYRILLIC.md` explicitly records that the dictionary/data licence and detailed rights lineage for every voice remain unresolved. Treat this as a release blocker for the speech assets, not as something an MIT code license cures.
- C ABI includes engine load, synthesis, cancellation, PCM/sample-rate access and explicit memory free functions. Android ABI/ORT build, binary footprint, memory, RTF and OPPO voice quality are unmeasured.

### TeraTTSv2

- Model: https://huggingface.co/TeraSpace/TeraTTSv2
- HF repository listing inspected during this review reports about 1.17 GB.
- It documents automatic Russian stress for `<ru>…</ru>`, explicit stress markers taking priority, Russian voice prompts `ru_f1` and `ru_m5`, and streamed Float32 PCM output at 44.1 kHz.
- License: custom `terattsv2-openrail-m-commercial-attribution`, based on OpenRAIL-M, with a distinct public commercial attribution requirement. The model guide says public product descriptions must mention and link TeraTTSv2 by TeraSpace; redistributors must include both license files and retain use restrictions.
- Training dataset named in its model card: `langswap/dialogs-ru-emotional-conversations`. Check dataset terms and speaker consent separately.
- It uses custom model code in its documented Python path; the ONNX presence alone is not proof of a self-contained Android-native runtime. It is not selected for the first mobile prototype.

## Architecture decision

1. Keep a vendor-neutral OGAM interface: `JarvisTtsBackend` loads a downloaded package, reports language/speaker/sample-rate metadata, streams Float32 PCM sentence chunks, supports `cancel(jobId)` and releases native resources deterministically.
2. Keep playback in an OGAM-owned Android audio component, not inside the model backend. The player owns AudioTrack, AudioFocus, ordered writes, output-route errors, cancellation and resource release. Barge-in and a newer answer must be able to stop it without waiting for the whole TTS generation.
3. Use model packages managed by the existing model catalogue/downloader: manifest, exact revision, SHA-256, licence record, voice card and size. Never bundle large model weights in the base APK.
4. Prototype Sherpa-ONNX 2.0.3 + Supertonic-3 as the first technical candidate only after OpenRAIL-M product restrictions are reviewed. Use CPU first and compare RTF/TTFA/RAM/thermal/battery before considering Qualcomm acceleration.
5. Keep local-tts/Vosk as a second Russian candidate; it may be lighter, but the dataset/voice rights caveat blocks redistribution until cleared.
6. TeraTTSv2 remains a quality/latency comparison option, not a default mobile candidate, because of its reported size, custom-code path and additional attribution condition.
7. Do not add Piper/eSpeak-GPL to the current OGAM binary unless a deliberate project licensing decision is made.

## Required OPPO Find X6 Pro measurements

For each candidate with cleared rights, pin one exact model revision and compare at least three runs using identical Russian paragraphs:

- cold model load time and warm load time;
- time to first audio (TTFA), real-time factor (RTF), and total synthesis time;
- peak native RSS, Java heap and model storage size;
- CPU/GPU utilisation, device temperature, battery cost and throttling after 5/15/30 minutes;
- chunk gap, pronunciation stress, punctuation/numbers, abbreviations, English technical terms and proper names;
- immediate barge-in cancellation latency, cleanup of partial audio, and the ability to start a newer reply without playing stale chunks;
- offline verification with network disabled and repeat after app background/foreground transitions.

No such OGAM/OPPO measurements exist yet. Do not call any candidate production-ready based on vendor measurements.

## Android PCM playback boundary added to OGAM

On 2026-11-22 an engine-neutral Android playback class was added:

- Source: `android/app/src/main/java/ai/offgridmobile/voice/JarvisPcmStreamPlayer.kt`.
- Unit tests: `android/app/src/test/java/ai/offgridmobile/voice/JarvisPcmStreamPlayerTest.kt` (8 JVM tests; not yet executed by Gradle).
- It accepts ordered mono Float32 chunks at 8–96 kHz, uses streaming `AudioTrack` with non-blocking writes, and keeps a generation token for every reply.
- `cancel()` invalidates the token before releasing the track; stale callbacks cannot write into a later reply. The code also protects a new AudioFocus request from late cleanup of an older in-flight start.
- AudioFocus is transient and speech-typed. It ducks on `AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK`, cancels on permanent/transient loss and releases focus after completion/cancellation.
- The class is model-independent and does not create a microphone, wake-word service, network path or TTS model. A future Sherpa `OfflineTts.generateWithCallback` adapter can feed its `FloatArray` chunks and return cancellation to the native generator.

This is a reusable native output component, not yet a user-visible speech feature: it is not registered as a React Native module and no TTS engine calls it yet.

## Current status

- No Sherpa, Soniqo, Supertonic, TeraTTSv2, Piper or local-tts dependency has been added to OGAM.
- No TTS model weights have been downloaded or packaged by this research step.
- No local Russian TTS reply path exists in the Free/Core build yet.
- Open-core CI checks the PCM source contract, but does not compile Kotlin or run the 8 JVM tests. Android Gradle and OPPO verification remain outstanding.
- Next implementation slice: create the streaming text-to-TTS adapter contract and sentence chunker, then connect a selected backend after its licence and OPPO footprint gates are passed.
