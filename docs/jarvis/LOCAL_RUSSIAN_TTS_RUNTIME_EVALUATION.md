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


### Latest verification snapshot — 2026-11-22
- Current PR #1 head: `781d6e68ebc11b971892f521c05e3020b5f9d2a9`.
- External dependency audit run 426 completed successfully on this exact head: https://github.com/sokfrut-tech/OGAM/actions/runs/45058165618
- The passing audit includes the TTS backend/chunker source contract, assistant bridge source contracts, PCM playback source contract and the other configured Node-only checks.
- Full CI run 182 is still pending/no job result at last inspection. Gradle/JUnit, APK build and PGEM10 tests are not verified.


## 2026-11-22 follow-up: latest sherpa-onnx release, real-time gate, and chunker regression fix

### Sherpa-ONNX v2.0.3 release audit
- GitHub marks v2.0.3 as the latest sherpa-onnx release on 2026-11-22: https://github.com/k2-fsa/sherpa-onnx/releases/tag/v2.0.3
- Official Android AAR asset: `sherpa-onnx-2.0.3.aar`, 52,411,426 bytes, SHA-256 `4c766e2e74c9d33d595338c21fe3b305c73ba45d47e96a235675c33142a2ec50`.
- The official Kotlin API exposes `OfflineTts.generateWithConfigAndCallback(...)`. It invokes a PCM callback as generation proceeds and returns a final `GeneratedAudio`; callers can therefore stream PCM to OGAM's player while the call is still generating. The API's returned audio array is still accumulated, so the adapter must consider peak memory and avoid retaining unnecessary duplicate PCM.
- Official Android sample uses a worker thread, an `AudioTrack`, and callback return 0/1. The sample is a useful API reference, not production-ready integration: its own player lifecycle is simpler than OGAM's generation-token/AudioFocus ownership.
- Supertonic's C++ implementation in v2.0.3 still invokes `callback(...)` but ignores the return value in `OfflineTtsSupertonicImpl::ProcessChunksAndConcatenate()`. This confirms that callback PCM is incremental but native generation cancellation is not honored. The OGAM patch remains necessary and must be applied to a pinned sherpa source build, then tested before native cancellation is advertised.
- JNI callback review correction: in the inspected v2.0.3 wrapper, `OfflineTts_generateWithConfigImpl` calls `tts->Generate(...)` synchronously, and the callback is invoked inside that synchronous generation loop. The inspected call path does not demonstrate cross-thread callback invocation; therefore capturing `JNIEnv*` and a local callback reference is not by itself proof of a thread-affinity bug. Keep Android smoke tests, but do not add speculative AttachCurrentThread/global-ref changes unless a real asynchronous path or device crash reproduces the need.

### CosyVoice3-MNN performance downgrade
- Separate upstream research branch: https://github.com/Nian27/CosyVoice3-MNN/blob/main/research/mnn-cosyvoice3/README.md
- The published Stage 1 Flow benchmark on Honor BKQ_AN90 / Adreno 840 reports about 1.152 s steady median for one sequence-256 estimator call. The official 10-step solver implies about 11.52 s of Flow compute; after subtracting a 2.0 s prompt from 5.12 s mel context, the newly generated portion is about 3.12 s, giving an estimated Flow-only RTF around 3.69 before wrapper overhead.
- The report explicitly says Stage 1 fails its real-time performance gate. This is not an end-to-end OGAM or OPPO Find X6 Pro benchmark, but it is enough to demote CosyVoice3-MNN from the first conversational prototype to an optional batch-quality experiment. Its 1.399 GB main model archive and ~998 MB optional enrollment archive further increase storage and memory pressure.
- Do not copy the SM8850/Adreno 840 NPU path to SM8550. OPPO Find X6 Pro remains untested.

### Chunker regression fix
- Updated `JarvisSpeechChunker.kt` to include closing quotes/brackets when detecting sentence boundaries and protect both periods in spaced Russian abbreviations such as `и т. д.` / `т. п.`.
- Added JUnit regression cases in `JarvisSpeechChunkerTest.kt`: `keepsSpacedRussianAbbreviationsInsideTheSameSentence` and `closesQuotedSentenceBeforeStartingTheNextSentence`.
- A local isolated Kotlin compile + focused harness passed 7 representative cases (fragment boundaries, flush, spaced abbreviation, Russian/English closing quotes, decimals and initials). This was not a Gradle/JUnit run and not an Android test.
- Source-contract audit test was extended to require these regression fixtures. Latest audit result for the new commit is pending at the time of this note.

### Full CI status / blockers
- Full CI run on the preceding merge head `8a90878592e0e44a2d25dcbf7077e0e669fcee15`: https://github.com/sokfrut-tech/OGAM/actions/runs/45058750893
- The full CI was not green. Lint/type/architecture/knip and Jest shards failed. The type logs show missing private workspace packages `@offgrid/sync` and `@offgrid/models`, followed by cascaded missing types; Jest shards report many suites failing to load/configure. This is an environment/private-workspace dependency blocker plus broader pre-existing branch integration debt, not evidence that the new Kotlin chunker failed.
- Android test job was still running at the last status check; no final Android Gradle/JUnit result is claimed.
- The separate external-dependency source-contract workflow had passed on the previous head. Recheck it on the new commit before treating the current source audit as green.


## 2026-11-22 follow-up: tiny-voca-ru Android feasibility

### Model and license evidence
- Project: https://github.com/yilbegan/tiny-voca-ru
- Model: https://huggingface.co/egnch/tiny-voca-ru
- Dataset: https://huggingface.co/datasets/egnch/tiny-voca-ru-dataset
- The Russian model card reports 4,534,411 parameters, approximately 18.2 MB safetensors / 21.4 MB ONNX, 24 kHz mono, and two voices (F/M). It is trained from scratch for Russian.
- Code and weights are Apache-2.0. Bundled RUAccent stress data and ONNX assets are MIT. The training dataset is CC BY 4.0 and must be attributed if redistributed or used in derivative datasets.
- The dataset card says the two voices were created with Qwen3-TTS 1.7B VoiceDesign. The available card does not fully document reference-voice provenance/permission, so retain a voice-provenance check before shipping the voice assets.
- The published evaluation is a sanity check, not a formal listening test: test WER 2.03% vs 1.54% for its Qwen3-TTS teacher; 696 clips; no formal listening panel. CPU throughput 81x real-time is measured on an AMD Ryzen 5 3600X with four threads, not on Android/SM8550.
- Important Russian quality caveat: default `lite` stress scored 56.0% on a 250-item homograph set versus 91.6% for the ruaccent turbo3.1 reference. The optional `full` path uses a 10 MB INT8 `omograph.onnx`; this should be included in the quality comparison, not silently omitted.

### ONNX inference contract and Android fit
- The ONNX graph consumes `tokens` and `stress` as int64 [1,N], `voice` as int64 [1], and `speed`, `pitch_shift`, `pitch_range` as float32 [1]. It returns float32 audio at 24 kHz plus int64 token durations.
- The model expects a 61-symbol Russian IPA inventory; the exact symbol order is part of the checkpoint contract. The model does not accept raw Cyrillic text directly.
- The upstream Python frontend is substantial: normalize.py 857 lines, numbers.py 388, tables.py 785, stress.py 523, g2p.py 382, tokenize.py 223, omograph.py 250, plus cleanup/lexicon/data. A partial quick transliteration would risk incorrect stress, numbers, dates, units, Latin words and homographs. Plan a staged, golden-fixture-backed Kotlin port instead.
- Upstream inference splits text into utterances/sentences and returns a complete waveform; it has no model-native PCM callback. OGAM can still achieve honest `SENTENCE_CHUNKED` delivery by invoking one sentence at a time and forwarding each completed sentence to `JarvisPcmStreamPlayer`. It must not be labelled `MODEL_STREAMING`.
- `max_tokens` is 512 and `max_frames` is 3000 in the published model configuration. Long utterances must be split at sentence/clause boundaries.
- OGAM currently has no declared ONNX Runtime Android dependency in `android/app/build.gradle` or `package.json`. Maven Central currently publishes `com.microsoft.onnxruntime:onnxruntime-android:1.32.0` under MIT. This is a plausible runtime dependency, but its APK size, native ABI footprint, minSdk fit, R8 keep rules, and SM8550 execution must be checked before adding it.
- ONNX Runtime documents an optional Android NNAPI execution provider for Android 8.1+; it is not evidence that this model will run on the OPPO Hexagon/NPU. Default CPU first, then measure NNAPI as a separate experiment. Do not claim QNN/HTP acceleration without a model-specific validated graph.

### Decision
- Promote tiny-voca-ru to the leading compact Russian TTS prototype, ahead of CosyVoice3-MNN for the first Android experiment. It has a much smaller model, permissive model/code licenses, native ONNX inference, and Russian-specific frontend.
- Do not add the model or ORT dependency to production yet. First pin the exact Hugging Face model revision, retrieve the Russian model's own ONNX/config hashes (do not reuse the English `n4ze3m/tiny-voca` hash), resolve voice asset provenance/attribution, and port the frontend with golden tests.
- Implement a sentence-chunked adapter after the frontend passes parity tests. Benchmark cold/warm latency, RTF, RSS, thermal throttling, 10+ minute use, and interruption on OPPO Find X6 Pro / PGEM10 / SM8550.
- Supertonic remains an alternative sentence/model-chunk callback path only if its OpenRAIL-M restrictions are accepted and the callback-stop patch is applied to a pinned native build.


## Correction: latest CosyVoice3-MNN distillation results supersede the Stage-1 RTF-only conclusion (2026-11-22)

A fresh review of the upstream research memory and Stage 3 feasibility report shows that the earlier ~3.69 Flow RTF was the original 10-step Stage-1 estimate, not the latest distilled pipeline result.

Newer upstream evidence:
- Source: https://github.com/Nian27/CosyVoice3-MNN/blob/main/research/mnn-cosyvoice3/README.md
- Research memory: https://github.com/Nian27/CosyVoice3-MNN/blob/main/docs/RESEARCH_MEMORY.md
- The follow-up distillation proof of concept trained a single-branch student and a two-step trajectory student. On 20 training and 4 held-out Chinese utterances from one zero-shot speaker, the two-step student reports mean mel cosine 0.99882 / mean mel SNR 26.26 dB on held-out generated regions; an additional unseen sentence reports 0.99843 / 24.99 dB. This is an engineering gate with a very small corpus, not broad release validation.
- On Honor BKQ_AN90 / Adreno 840, the distilled batch-1 Flow model at sequence 516 takes ~1.187 s per OpenCL High estimator call; two calls take ~2.374 s. This supersedes the original 10-step estimate for the distilled model.
- Persistent three-stage cross-module benchmark: cool-device run processed 14.8 s of speech work in 9.33 s (throughput RTF 0.63); after a 58 s preparation load, a hot run took 19.51 s for 15.12 s audio (RTF 1.29). Therefore peak/cool-device throughput can be real-time, but sustained thermal performance is not proven.
- Full MNN runtime PSS is about 2.25 GB, model bundle about 1.3 GiB, cold startup around 10–15 s, and only Honor SM8850 has been validated. The upstream docs explicitly warn that non-SM8850 devices are unverified and CPU fallback may be much slower.

Revised decision:
- Do NOT call CosyVoice3-MNN merely a batch-only candidate; the distilled two-step route has a promising cool-device real-time result.
- Keep it as a high-quality / high-resource experimental track, not the default OGAM Jarvis backend, until the exact v1.2.0 package/model provenance is pinned and sustained tests pass on our SM8550/PGEM10.
- tiny-voca-ru remains the first compact prototype because of its ~21.4 MB model, permissive code/weight licenses and low storage footprint. Its own Android performance and listening quality are also unverified; it is a feasibility choice, not a proven winner.


## Latest verification and dataset provenance — 2026-11-22

### tiny-voca-ru dataset/voice provenance clarification
- The Hugging Face dataset card now explicitly documents 20,287 clips (20,116 default + 171 homograph clips), 23.82 hours, disjoint train/validation/test sentence splits, and CC BY 4.0 licensing: https://huggingface.co/datasets/egnch/tiny-voca-ru-dataset
- Both F/M voices are documented as generated with Qwen3-TTS 1.7B VoiceDesign. The card describes reference clips and lists voice seeds/selection metrics in `voices.json`, but the public summary does not fully establish the underlying reference speaker consent/provenance. This remains a release gate, not an allegation of misuse.
- The model card reports ONNX 81x real-time on Ryzen 5 3600X with four threads; it is explicitly a desktop result and cannot be extrapolated to Snapdragon 8 Gen 2. It reports 56.0% on the 250-item homograph set for `lite`; do not claim the `full` mode has 91.6% measured accuracy—the 91.6% figure belongs to a ruaccent turbo3.1 reference column.
- Exact ONNX file SHA-256 and immutable model revision are still not verified from the model repository file metadata. Do not reuse hashes from the English tiny-voca model.

### ONNX Runtime Android execution plan
- Official ORT Android documentation states the published Android package includes CPU and NNAPI support; Android NNAPI requires API 27+ (Android 8.1), with API 28+ recommended. NNAPI is a generic Android interface, not proof of Qualcomm QNN/HTP use on SM8550: https://onnxruntime.ai/docs/execution-providers/NNAPI-ExecutionProvider
- Official mobile guidance recommends CPU first for quantized models and then device-specific benchmarking of NNAPI/XNNPACK; accelerator partitioning can reduce performance when unsupported ops fall back: https://onnxruntime.ai/docs/tutorials/mobile/
- ORT's Android build documentation requires R8 keep rule `-keep class ai.onnxruntime.** { *; }` for minimized apps using the Maven Android package: https://onnxruntime.ai/docs/build/android.html
- OGAM's `android/app/build.gradle` currently has no ONNX Runtime dependency. Do not add it until the exact model/config hashes, model input contract, package size/ABI and R8 rules are reviewed.

### Current CI snapshot on PR #1
- Current PR #1 head at check: `7b399c5261e09f365ca44d81fb053dbe68af8c08`; PR remains draft/open/unmerged.
- External dependency audit run 45059622374 passed on that exact head: https://github.com/sokfrut-tech/OGAM/actions/runs/45059622374
- Full CI run 45059622387 was still in progress at the last check: https://github.com/sokfrut-tech/OGAM/actions/runs/45059622387
- Three Jest shards already failed: 86/104, 89/106, and 83/106 suites failed respectively. Logs show broad `Cannot find module '@offgrid/models'` failures plus missing `pro/sync` modules/configuration. This is a repository/private-workspace CI integration blocker; it is not evidence that the new Kotlin chunker tests failed.
- Android Gradle test job had started but no completed result was available. No Kotlin/JUnit, APK or PGEM10 pass is claimed.


## New China/India scan: LiteRT Qwen3-ASR SM8550 + Qwen3-TTS Android route (2026-11-22)

Research evidence saved on branch `docs/research-breeno-coloros-2026-11-22`:
`research/china-india/CHINESE_INDIAN_ON_DEVICE_SPEECH_SCAN_2026-11-22.md`
Commit: `33589c0b30e55ccdf7a568a72f268834875c62c3`.

New high-priority finding:
- Google LiteRT-LM model documentation exposes Qwen3-ASR-0.6B Android deployment and a SoC-specific AOT NPU graph family including Qualcomm SM8550 (Snapdragon 8 Gen 2), the exact SoC in PGEM10.
- 960 MB INT8 .litertlm bundle supports Russian among 30 languages/22 Chinese dialects; Android CPU/GPU runner documented; 3–4 GB available RAM recommended.
- Separate SM8550 AOT .tflite graph family is listed at 1.88–2.19 GB and targets standalone LiteRT NPU C++/Kotlin APIs. Exact filename, model revision, hash, I/O contract, NPU runtime and ColorOS compatibility still need pinning. Do not claim NPU use until verified in device logs.
- This is an alternative native deployment route, not a replacement for OGAM's already integrated Qwen3-ASR GGUF/llama.rn backend. Preserve Whisper fallback.

New TTS candidate:
- Qwen3-TTS-12Hz-0.6B-Base LiteRT-LM is Russian-capable, Apache-2.0, Android NDK runner/C++ OmniSession path documented, INT8 v2 bundle ~2.44 GB / INT4 ~2.24 GB.
- Model card reports Galaxy S26 RTF 1.24 GPU / 1.29 CPU, peak RSS ~1.44 / ~1.90 GB. Not tested on PGEM10. Separate older Kotlin CPU TFLite sample is slower (RTF ~2.06 Pixel 8a optimized) and does not implement dual-track streaming; do not conflate with newer LiteRT-LM Omni.
- Candidate for optional expressive Russian TTS tier; tiny-voca-ru remains compact fallback until real tests.

India scan:
- Indic-Speak is 3B BF16, 22 Indic languages + English, ~6.6 GB weights, gated/custom license, no Russian and no verified Android deployment.
- IndicF5 is 0.4B, 11 Indic languages, MIT, reference-audio conditioned; no Russian/Android proof.
- IndicConformer 600M MIT covers 22 Indic languages, and card recommends newer Indic-Transcribe (25 Indic languages); neither supports Russian.
- These are useful future Indic-language research, not Russian core candidates.


## Additional China/India model shortlist: visual brain + local planner (2026-11-22)

Expanded scan saved on research branch:
`research/china-india/CHINESE_INDIAN_ON_DEVICE_SPEECH_SCAN_2026-11-22.md`
Latest research commit: `118caa591c5780d72f852eeac429df7f3fc0bd95`.

- **MiniCPM-V 4.7 1B**: new OpenBMB visual model with Android Kotlin/Gradle demo via MiniCPM-V-Apps; supports images, multi-image, documents and video; 1.55B params, Apache-2.0, BF16 file ~3.13 GB with quantized variants. Candidate for Jarvis camera/screenshot/document perception. No PGEM10 benchmark yet.
- **MiniCPM5-2B**: OpenBMB released Sept 2026 for on-device/resource-constrained use; candidate for offline planner benchmark, but Russian quality/tool reliability and actual phone runtime must be tested.
- **MiniCPM-o 4.5**: 9.37B / ~20.05 GB, vision+speech+text full duplex. Keep as architecture reference, not phone default.
- **Bharat-Tiny-LLM v3**: 1.7B Hindi/Hinglish/English, Q4_K_M ~1 GB claim; no Russian target, and its model card reports 29% on pinned 100-item GSM8K-Hindi subset (higher prior figure retracted). Research only for future language pack.
- This does not change current TTS priorities or production model defaults. Continue to keep visual model, planner, ASR and TTS as separable modules.
