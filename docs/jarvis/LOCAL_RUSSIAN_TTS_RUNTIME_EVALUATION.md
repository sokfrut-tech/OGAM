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
| tiny-voca-ru (4.5M Russian ONNX) | Russian-only; fixed female/male voices; 24 kHz mono | 21.4 MB ONNX; upstream inference uses ONNX Runtime; current Python 3.11 frontend must be ported to Kotlin; sentence-at-a-time synthesis can feed the existing PCM player, but the reference API is not streaming | Model/code Apache-2.0; bundled ruaccent assets MIT; training dataset CC BY 4.0 with attribution; two synthetic voices, no voice cloning | **Top compact prototype candidate**. Pin model/assets and port the exact 61-symbol frontend; benchmark OPPO before adoption. Model-card 81x CPU result is desktop-only. |
| Sherpa-ONNX Android 2.0.3 + Supertonic-3 | 31 languages including `ru`; G2P-free Unicode frontend | Android Kotlin API exposes `OfflineTts` and callback PCM generation. Official Android sample pins Maven `com.github.k2-fsa.sherpa-onnx:sherpa-onnx:v2.0.3`. | Sherpa code Apache-2.0. Supertonic-3 weights use OpenRAIL-M with use-based restrictions and downstream notice/redistribution requirements. HF repository currently reports 415 MB total. Soniqo's selected deployment notes say ~380 MB download and ~832 MB peak memory; these are vendor measurements, not OGAM/OPPO measurements. | **First runtime prototype candidate**, opt-in model download only, pending licence review and OPPO profiling. Do not put the model in the APK. |
| GarAlex/local-tts — Vosk 0.7 Russian | Native Russian Vosk multi-speaker model; five speaker IDs F01/F02/F03/M01/M02; native dictionary and explicit-stress frontend | MIT Rust project, native Rust inference, C ABI and cancellable synthesis. No Piper/eSpeak runtime; no Python at inference. Android NDK/Rust/ORT packaging, ABI size and latency have not been measured in OGAM. Unknown Russian words require manual stress annotation. | Code is MIT. The Vosk model card declares Apache-2.0, but the source documentation explicitly leaves dictionary/data licensing and detailed rights lineage for the training voices unresolved. | **Keep as a second candidate**. Do not ship voice assets until the dictionary/data/voice rights chain is resolved and a revision/hash is pinned. |
| TeraTTSv2 ONNX | Russian and English, ten styles; Russian stress annotation is automatic by default | ONNX Runtime, selectable diffusion samplers, streamed Float32 audio. Repository currently reports ~1.17 GB. Its model interface uses custom code; the HF guide currently requires `trust_remote_code=True`. No audited Android-native integration path has been demonstrated. | Custom OpenRAIL-M commercial-attribution licence. Commercial products must credit/link TeraTTSv2 publicly; redistribution must pass on both license files and use restrictions. | **Research-only**. Too large for the first OPPO prototype; custom-code and licence review required before any use. |
| Soniqo speech-android SDK | Supertonic-3 supports Russian; the SDK's default Kokoro voice bundle does **not** include Russian | Apache-2.0 Android SDK and Kotlin pipeline, but minSdk 26, NDK r29, CMake 4.1.2 and a `speech-core` git submodule. OGAM currently targets API 24 and uses a different native build. The SDK's published TTS table reports Supertonic-3 ~380 MB / ~832 MB peak RAM; measured on Galaxy S23 Ultra, not OPPO. | SDK code Apache-2.0; model license remains Supertonic OpenRAIL-M. | **Architecture reference, not a drop-in dependency**. Do not raise OGAM minSdk or pull the whole SDK/submodule only for TTS. |
| Piper / piper-phonemize | Several Russian voice files exist; each model has an independent dataset chain | Android sherpa samples show integration, but the text frontend package `piper-phonemize` is GPL-3.0-or-later because of eSpeak NG; current Piper engine is GPL-3.0-or-later. | Runtime/phonemizer GPL obligations and voice-specific model-card/data restrictions. Some voices have non-commercial or unresolved dataset ancestry. | **Do not bundle in OGAM's current distribution model** without an intentional licensing decision. |
| JokobeeTTS / Kokoro | The inspected supported voice packs do not provide Russian. | Kotlin Android modules exist; separate language packs. | Project/engine code Apache-2.0; voice/model packs still need their own audit. | Not a Russian-first candidate. |

## Evidence and source pins

### tiny-voca-ru

- Model: https://huggingface.co/egnch/tiny-voca-ru
- Source/frontend: https://github.com/yilbegan/tiny-voca-ru
- Dataset/provenance: https://huggingface.co/datasets/egnch/tiny-voca-ru-dataset
- The model card reports 4,534,411 parameters, 21.4 MB ONNX, 24 kHz mono output and two voices (F/M). Its ONNX inference inputs are tokens, stress, voice, speed, pitch_shift and pitch_range; outputs are waveform audio and durations.
- The ONNX graph is an upstream export at opset 17. Android ONNX Runtime operator support and Snapdragon 8 Gen 2 performance have not been verified.
- The current text frontend is Python 3.11+: Russian normalization, numbers/dates/currency, stress dictionary + accent.onnx, optional full homograph disambiguation, G2P and a 61-symbol IPA/token inventory. A Kotlin port needs parity fixtures; do not replace it with a simple transliteration shortcut.
- The model card's CPU speed (81x real-time on a four-thread Ryzen 5 3600X) is not an Android measurement. The reference API concatenates sentence outputs before returning; OGAM can synthesize sentence chunks independently to start playback earlier, but TTFA must be measured.
- Model/source license: Apache-2.0; bundled ruaccent assets: MIT; dataset: CC BY 4.0. The dataset card attributes synthetic audio to Qwen3-TTS 1.7B VoiceDesign and includes CC0 Common Voice plus generated/template text. Preserve all attribution and pin hashes before downloading.
- Evaluation in the model card: 2.03% WER / 0.46% CER on 696 test clips against Whisper large-v3-turbo; 98.5% CTC top-1 stress accuracy on dictionary words; lite/full homograph figures 56.0% / 91.6%. These are upstream figures, not independent OPPO results.

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
4. Prototype tiny-voca-ru as the first compact Russian model: pin exact ONNX/frontend assets, port its 61-symbol Kotlin frontend with Python parity fixtures, and compare lite/full stress. Use sentence chunks with JarvisPcmStreamPlayer; no release claim until OPPO TTFA/RTF/RAM/thermal/battery and listening checks pass.
5. Keep Sherpa-ONNX 2.0.3 + Supertonic-3 as the first streaming-oriented alternative, but only after OpenRAIL-M product restrictions are reviewed. Use CPU first and compare RTF/TTFA/RAM/thermal/battery before considering Qualcomm acceleration.
6. Keep local-tts/Vosk as another Russian candidate; it may be lighter, but the dataset/voice rights caveat blocks redistribution until cleared.
7. TeraTTSv2 remains a quality/latency comparison option, not a default mobile candidate, because of its reported size, custom-code path and additional attribution condition.
8. Do not add Piper/eSpeak-GPL to the current OGAM binary unless a deliberate project licensing decision is made.

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

## 2026-11-22 follow-up: reconcile Chinese TTS research and verify Supertonic cancellation

The new Qwen3-TTS and CosyVoice Android source audits are additional high-quality/batch candidates, not replacements for the original selection above:
- Qwen3-TTS Android `QwenEngine.synthesize()` returns the complete FloatArray after generation; its callback is token progress only, not incremental PCM.
- CosyVoice3-MNN Android `CosyVoiceRuntime.synthesize()` writes a completed audio file and returns a report; the inspected Kotlin surface does not expose PCM chunks.
- Therefore both are batch-quality candidates and cannot satisfy the first-sentence-before-full-reply streaming requirement without additional native changes. Their model cards' streaming claims do not transfer automatically to these Android wrappers.
- Keep the original priority: tiny-voca-ru as compact Russian prototype; Sherpa-ONNX + Supertonic-3 as streaming-oriented Kotlin prototype after license and callback gates. Qwen3-TTS/CosyVoice remain optional A/B quality comparisons.

### Supertonic callback cancellation finding
Pinned source: sherpa-onnx v2.0.3, commit `38016c6e0622e90bf417c35e8b47e0eb805af417`.

The public `GeneratedAudioCallback` contract in `sherpa-onnx/csrc/offline-tts.h` says return `0` to stop and `1` to continue. However, `OfflineTtsSupertonicImpl::ProcessChunksAndConcatenate()` in `sherpa-onnx/csrc/offline-tts-supertonic-impl.cc` calls the callback and ignores its return value. Thus the Supertonic callback surface emits sentence/chunk PCM, but does not currently honor cancellation through the documented return contract.

Prepared an OGAM-side source patch:
- `patches/sherpa-onnx/v2.0.3-supertonic-callback-stop.patch`
- It stores the current generated chunk, checks callback return, and breaks before generating the next text chunk when return is 0.
- The patch has been recorded but NOT applied to a compiled sherpa library, and no native build/test has been run. Do not claim cancellation is fixed yet.
- For immediate user barge-in, JarvisPcmStreamPlayer can stop audio immediately. Without the native patch, Supertonic may continue computing remaining chunks in the background. Do not start a second TTS generation until the first one finishes or its worker process is safely terminated.

### JNI callback audit note
The v2.0.3 Android JNI wrapper captures `JNIEnv*` and a local callback `jobject` in the callback lambda. The callback path appears to be called synchronously from the C++ generation loop, but the wrapper has no explicit `JavaVM`/global-reference/AttachCurrentThread protection. A reported upstream issue describes SIGABRT on Android callback invocation (issue #3492). Treat callback use as a device-smoke-test gate; if the callback can cross threads in our integration, patch JNI to use a global reference and attach the calling thread safely. Do not claim the upstream bug is fixed from the v2.0.3 source inspected here.

### Updated decision
- Tiny-voca-ru remains the first compact Russian prototype candidate.
- Sherpa-ONNX 2.0.3 + Supertonic-3 remains the first streaming-oriented candidate, but only after applying/testing the callback-stop patch, checking the JNI callback path on Android and reviewing OpenRAIL-M terms.
- Qwen3-TTS/CosyVoice are high-quality batch A/B candidates, not first streaming backends.
- `react-native-sherpa-onnx` remains an architecture reference rather than a recommended dependency for OGAM's native Kotlin TTS slice; the existing plan already uses the narrower official Kotlin AAR, and the RN wrapper adds unrelated modules and third-party license surface.


## 2026-11-22 OGAM native TTS adapter groundwork

Added to `feature/jarvis-step-2-storage-privacy`:
- `JarvisTtsBackend.kt`: engine-neutral backend interface and explicit capability flags for batch/sentence-chunked/model-streaming output, native cancellation, cloning, instructions and language hints. It keeps inference separate from playback and microphone/session ownership.
- `JarvisSpeechChunker.kt`: incremental text chunker with Russian abbreviations, decimal numbers, initials, fragment boundaries, maximum chunk size, flush and reset.
- Tests: 6 chunker tests + 3 backend-contract tests. Existing PCM player has 8 JVM tests.
- No native engine/model dependency added. No Gradle tests run or Android device test confirmed.


### CI source-contract check for the new native TTS boundary
- Added `scripts/__tests__/jarvis-tts-backend.node.test.mjs` and wired it into `ogam-external-dependency-audit.yml`.
- Node source-contract audit run 423 passed on commit `a8113ac77c35108dc9f2a88da9f990923e9bbd08`: https://github.com/sokfrut-tech/OGAM/actions/runs/45058086277
- This checks the source boundary and regression-test presence only. It does not compile Kotlin, run JUnit, build APK or prove device behavior.
