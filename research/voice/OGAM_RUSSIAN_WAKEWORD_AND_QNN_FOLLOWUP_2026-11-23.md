# OGAM / Jarvis — Russian Wake Word and Snapdragon 8 Gen 2 Runtime Follow-up
Date: 2026-11-23
Target: OPPO Find X6 Pro PGEM10 / SM8550 / Android 16 / ColorOS 16.0.5
Status: public-source and OGAM source audit only. No model downloaded, no code changed, no APK built, no PGEM10 benchmark run.

## Executive decisions

1. Do not enable full-duplex listening or barge-in in production yet. OGAM's current physical microphone owner is already centralized, but the source explicitly reports echo cancellation as false. Keep half-duplex until real microphone/reference AEC is integrated and verified on PGEM10.
2. Do not ship an English openWakeWord model as the Russian wake word "Джарвис". openWakeWord's own README says its current training support is English-only. A community Russian/Kazakh "Мост" model is discoverable, but its published recall is only 7.2% on 500 synthetic positive clips, with 1.39 false activations/hour on about 10 hours of negatives at threshold 0.5. It is not a viable production candidate.
3. Investigate a custom acoustic KWS detector trained specifically for Russian "Джарвис", or a Russian streaming-transducer KWS path if a compatible online model can be found or trained. The current sherpa-onnx catalogue lists Russian Zipformer models as offline transducers; its KWS API is described around streaming transducer models. Do not assume an offline Russian model is drop-in compatible with the online KWS API.
4. Treat Snapdragon 8 Gen 2 NPU support as a runtime/build integration task, not a checkbox. Qualcomm documents SM8550 / Hexagon V73 support for AI Engine Direct; LiteRT documents SM8550 support for its QNN backend. ONNX Runtime QNN EP documentation says Android is supported but the documented prebuilt packages are Windows-only and Android requires a source build. None of this proves an OGAM model is delegated to the OPPO NPU.
5. Keep all speech acceleration experiments benchmark-only and optional. CPU is the reproducible baseline; LiteRT/QNN must report actual delegated ops, fallback ops, latency, memory, thermal and battery results.

## 1. OGAM microphone ownership — source-verified

Audited PR #1 branch `feature/jarvis-step-2-storage-privacy`, head `67159e2f821b14616eebcaf0e6da997633cd7aa4`.

| Source | Blob SHA | Finding |
|---|---|---|
| `src/services/audioRecorderService.ts` | `1646210d412f96522be3398f6503eff4fee0f55e` | Owns the actual `react-native-audio-api` AudioRecorder; requests mic permission; records mono 16 kHz WAV; emits shared PCM buffers and RMS levels. |
| `src/services/recorderAudioStream.ts` | `0c6932a342be348abbbc4c9bab6819f0037e696c` | Adapter only subscribes to AudioRecorderService buffers; starting/stopping this stream does not start/stop the microphone. It feeds Whisper realtime from the same physical capture that writes the file. |
| `src/services/whisperService.ts` | `4f81aed770bb005e5ba623a3bc76bcfafba42e1d` | Owns the Whisper native lane and serializes realtime/file transcription/model release; prevents overlapping native jobs. |
| `src/services/recordingController.ts` | `9c7a7a3caa70da2abce117babbcfbe24c955ef3e` | One lifecycle coordinator for start/stop/cancel; the actual capture mechanics remain in the registered recorder. |
| `src/components/ChatInput/useVoiceSessionDriver.ts` | `e3a291c90b715f4bfd11cd10f0f36306e38f0b` | Starts capture only on an edge into listen; cancels capture when playback seizes the voice-session floor. |

### Positive architecture result

The correct ownership pattern already exists for ordinary recording and Whisper preview:
- one physical recorder;
- one stream subscription for live ASR;
- the same capture writes the final WAV;
- one native Whisper lane prevents overlapping inference/release;
- one controller coordinates start/stop/cancel.

Do not add a second AudioRecord/AudioRecorder for KWS. A future KWS engine must subscribe to this owner or use a single native capture service shared by KWS and ASR.

### Blocking AEC result

`AudioRecorderService.isEchoCancelled()` explicitly returns `false`. Its source comment explains that the current TTS output is not routed through the same voice-processing path as microphone capture, so the mic can record the assistant's own speech and trigger false speech detection/self-interruption. The code comment says hands-free waits until the assistant finishes.

The separate `audioSessionManager.ts` configures iOS `videoChat` voice-processing mode only when requested; Android returns false for this iOS session API. An Oboe input preset or a requested Android capture source is not evidence of acoustic echo cancellation unless the actual capture session has a valid echo-canceller path and the playback reference is routed into it.

**Decision:** half-duplex remains the safe product behavior. Do not advertise interruption while Jarvis speaks. Before enabling barge-in:
1. capture the actual microphone stream with timestamps;
2. tap the exact PCM sent to playback and obtain presentation timestamps, not merely write-call time;
3. align both streams to one monotonic clock;
4. apply AEC with bounded queues and fail-closed behavior;
5. test near-end speech, far-end-only playback, double-talk, music/TV, room reverb, Bluetooth and speaker/receiver routes;
6. verify no false self-trigger, acceptable latency and stable thermal/battery behavior on PGEM10.

LocalVQE / TimestampedEchoCancellationStream remains a research candidate from the separate Soniqo audit, not an integrated feature.

## 2. Russian wake-word model survey

### 2.1 openWakeWord — not a ready Russian solution

Official project README:
- https://github.com/dscripka/openWakeWord
- It currently describes language support as English-only because the pretrained synthetic speech generators are based on English datasets.
- Its training workflow recommends several thousand positive synthetic examples and large-scale negative audio. Its pretrained detectors used approximately 30,000 hours of negative speech, noise and music.

A separate model library lists a Russian/Kazakh synthetic model for the word "Мост":
- https://openwakeword.com/library/1013
- 64 × 3 network, 115,000 training steps, 405 KB ONNX / 412 KB TFLite.
- Published recall: 7.2% on 500 synthetic positive utterances.
- Published false activations: 1.39/hour on approximately 10 hours of near-miss phrases, noise and read speech at threshold 0.5.
- Only seven downloads were listed at the time of review.

This shows that a Russian-language community model can exist in the ecosystem, but the reported recall is far too low to justify integration. The model's exact downloadable artifact, training license and independent test corpus were not inspected.

### 2.2 onnx-wakeword — promising runtime shape, language gap

Repository: https://github.com/voicute/onnx-wakeword
- MIT inference engine; Android Java + ONNX Runtime path; very small causal TCN model architecture; supports custom keyword models and false-trigger mining.
- Its current README lists Chinese, English, German, French, Japanese, Spanish and Hindi — not Russian.
- Custom model training is offered through a separate hosted service; training-service pricing/terms and model redistribution rights must be checked independently before using it.
- No Russian "Джарвис" model is listed.

Decision: architecture candidate only. Do not send user audio to an external training service. If a future model is trained, use consented/licensed synthetic and volunteer audio, and retain a fully local inference package.

### 2.3 Mycroft Precise — language-independent training concept, not Android-ready

References:
- https://github.com/MycroftAI/mycroft-precise
- https://mycroft-ai.gitbook.io/docs/mycroft-technologies/precise

Precise is trained on acoustic patterns rather than a fixed phonetic dictionary, so a custom phrase can be trained from sound samples. It requires a deliberate training dataset and Linux-oriented tooling; the inspected documentation does not establish a maintained Android ARM64 integration or a Russian pre-trained model.

Decision: study its dataset/training approach, not adopt its runtime without a current build and mobile audit.

### 2.4 sherpa-onnx — Russian ASR exists; Russian KWS pairing remains unresolved

Official KWS documentation:
- https://k2-fsa.github.io/sherpa/onnx/kws/index.html
- https://k2-fsa.github.io/sherpa/onnx/c-api/html/keyword_spotting.html

KWS is an open-vocabulary keyword detector built around streaming transducer models and a keyword list. Official KWS examples/models listed at review time include Chinese/English, Chinese and English model families, not a ready Russian wake-word model.

Russian ASR model catalogue:
- https://k2-fsa.github.io/sherpa/onnx/pretrained_models/
- Russian offline transducer models include `sherpa-onnx-zipformer-ru-2024-09-18` and `sherpa-onnx-small-zipformer-ru-2024-09-18`.
- The documented full Zipformer package contains an INT8 encoder of about 65 MB plus decoder/joiner/tokenizer; the small model has an INT8 encoder of about 24 MB.
- These are listed under offline transducer models, while KWS documentation describes an online/streaming transducer interface. The current online transducer catalogue did not list a Russian model.

Decision: do not wire the offline Russian ASR pack into KWS by assumption. Investigate whether a streaming Russian model can be trained/exported and accepted by the KWS API, or train a compact phrase classifier.

### 2.5 Recommended "Джарвис" training/evaluation protocol

Prepare a user-consented dataset before choosing the runtime:
- positive speech: at least 30–50 speakers initially, varied gender/age/accent, distance, quiet/loud, fast/slow, whisper and normal speech;
- variants: "Джарвис", "Джарвис, слушай", clipped starts, connected speech and common mispronunciations;
- hard negatives: "жарить", "жар-вис" fragments, names and words with similar syllables, TV/radio, music, assistant TTS, other people talking and silence;
- room/phone augmentation: reverb, distance, device orientation, fan/road noise and microphone gain changes;
- split by speaker and recording session, never random adjacent clips, to prevent leakage;
- report recall, false accepts/hour, false rejects, trigger latency and CPU/RAM/battery; report confidence intervals and test on unseen speakers;
- include far-end-only assistant playback and double-talk after AEC is implemented.

No user voice samples are requested or committed to Git. Keep raw recordings local and private; publish only synthetic/test metadata and aggregate metrics where consent permits.

## 3. Snapdragon 8 Gen 2 / NPU evidence

### 3.1 Hardware identity

Qualcomm AI Runtime SDK documentation maps Snapdragon 8 Gen 2 (SM8550) to Hexagon architecture V73:
- https://docs.qualcomm.com/nav/home/QNN_general_overview.html?product=924033590759186372

This supports selecting the V73 toolchain/runtime for a controlled benchmark. It does not prove every V73 library shipped in OGAM is compatible with a given model or SDK version.

### 3.2 ONNX Runtime QNN EP

Official documentation:
- https://onnxruntime.ai/docs/execution-providers/QNN-ExecutionProvider.html
- Describes Android and Windows Qualcomm Snapdragon use.
- The inspected page documents QNN SDK 2.22.x validation against SC8280, SM8350 and Snapdragon X devices, not an explicit SM8550 Android validation matrix.
- The same page says prebuilt packages are Windows-only; Android requires a source build.

Decision: no assumption that the standard Android ONNX Runtime package already contains QNN EP. An Android QNN build must pin ONNX Runtime + QAIRT/QNN SDK versions, ABI, backend libraries and exact HTP V73 files; validate partitioning and CPU fallback per model.

### 3.3 LiteRT QNN backend

Official Google AI Edge documentation:
- https://developers.google.com/edge/litert/next/qualcomm
- Explicitly lists Snapdragon 8 Gen 2 (SM8550) among supported SoCs.
- Android setup requires Android API 34 and NDK support for API 28; this can be an optional high-tier path on the user's Android 16 phone, but must not raise OGAM's global minSdk.
- LiteRT CompiledModel/QNN is not the same runtime as LiteRT-LM. OGAM's existing `litertlm` integration must not be described as QNN/NPU acceleration unless the actual engine path exposes and proves that delegate.

### 3.4 Recommended acceleration order

1. CPU reference on identical input/model/quantization.
2. LiteRT GPU / supported delegate only where the model/runtime supports it.
3. LiteRT CompiledModel + QNN HTP V73 isolated prototype.
4. ONNX Runtime QNN EP only after a reproducible Android ARM64 build.
5. Compare actual delegated partitions, CPU fallbacks, cold/warm load, p50/p95 latency, RSS, thermal throttling and battery. If delegation fails, fail visibly or fall back to CPU; never report NPU use based only on the requested provider.

## 4. PR #1 / CI state snapshot

PR #1 remains open and Draft; current fetched head is `67159e2f821b14616eebcaf0e6da997633cd7aa4`. The latest inspected run for this head is:
- CI run 45060169581: failed.
- OGAM external dependency audit run 45060169357: success.
- The failed CI job summary shows lint/types/architecture failed, all eight Jest shards failed, Android tests failed, coverage failed; iOS tests passed.
- The separate source audit success does not mean the full application test suite passes.
- The PR's private `pro` submodule pointer is `cae82b3df1ec751205359c351beb18b953404251`; `.gitmodules` points to `off-grid-ai/mobile-pro`. The connected public repository fetch returned 404, so its implementation files could not be independently inspected in this audit. Do not infer the actual TTS backend implementation from test names or the interface alone.

## 5. Next work sequence

1. Build a small benchmark-only Android KWS harness that subscribes to the existing single microphone owner; do not introduce a second capture session.
2. Compare a custom Russian "Джарвис" classifier against a sherpa-onnx Russian streaming-KWS experiment only if a compatible streaming model can be sourced/trained.
3. Audit training and model licenses before any model download; record model card, exact revision, artifact hashes and dataset provenance.
4. Keep half-duplex in the product until AEC is attached to the real mic/playback paths and verified on PGEM10.
5. Separately benchmark Qwen3-TTS streaming JNI and Supertonic-3 LiteRT; do not conflate LiteRT-LM with LiteRT QNN.
6. No production code/model selection, APK build or device compatibility claim until the measured gates pass.

## Evidence boundaries

- Source-verified: OGAM's current single recorder, shared Whisper stream, serialization lane and explicit AEC=false state.
- Public-document verified: openWakeWord language limitation/training guidance; KWS API design; Russian offline sherpa models; SM8550/V73 and LiteRT QNN SoC support.
- Author-reported only: community "Мост" recall/false-trigger figures; these are not independently reproduced.
- Not performed: custom Russian KWS training, artifact download/hash verification, Android KWS integration, QNN build, APK build, PGEM10 audio capture or benchmark.


## 6. New Russian microWakeWord trainer — 2026-11-22 follow-up

A dedicated follow-up audit is saved at [OGAM_RUSSIAN_MICROWAKEWORD_ANDROID_AUDIT_2026-11-22.md](OGAM_RUSSIAN_MICROWAKEWORD_ANDROID_AUDIT_2026-11-22.md). It adds the following evidence:
- The MIT repository interkelstar/microwakeword-trainer has a Russian production config for «Джарвис», four Piper Russian voices, punctuation variants, adversarial near-match phrases and a 50k-sample training setup.
- The author reports 47/50 held-out real activations (94%), 1/140 mined hard-negative false activations and an 82.5 KB streaming TFLite model. The test set is small; the 1/140 result is not FAR/hour; the actual model binary is not present in the inspected repository.
- The underlying microWakeWord framework is Apache-2.0. It uses a 16 kHz / 40-feature MicroFrontend and a stateful streaming classifier. The trainer export prose says uint8, but its inference helper's quantization test checks int8; inspect the real exported tensor dtype/scale before Android implementation.
- The Golos crowd dataset referenced by the other trainer has licence marked "other" with attribution/reserved conditions. Do not bundle or train on it until exact terms are reviewed. Piper voice licences must be verified per voice/revision.
- Android implementation remains a prototype: preserve AudioRecorderService as the only physical capture owner; validate the MicroFrontend and the exported TFLite graph in LiteRT; no KWS model or Android integration has been committed.

### Android microphone-policy clarification

The Android VoiceInteractionService exemption must not be described as a blanket background microphone permission or general foreground-service launch exemption. Android documents it specifically in the while-in-use microphone restrictions. General background FGS-start rules remain a separate check. The selected VoiceInteractionService is kept running by the system, but its public API does not grant ordinary apps the hidden/SystemApi DSP hotword methods requiring MANAGE_HOTWORD_DETECTION, and the Automotive software-hotword route uses hidden HOTWORD capture permission/source. Android 15+ also blocks microphone FGS startup from BOOT_COMPLETED for target API 35+ apps. Start an opted-in microphone session from a visible user action unless a current explicit platform exemption is verified; never claim ColorOS 16 behavior until PGEM10 testing.

Sources: https://developer.android.com/reference/android/service/voice/VoiceInteractionService ; https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start ; https://developer.android.com/develop/background-work/services/fgs/service-types ; https://developer.android.com/about/versions/15/behavior-changes-15 ; https://source.android.com/docs/automotive/voice/voice_interaction_guide/app_development .
