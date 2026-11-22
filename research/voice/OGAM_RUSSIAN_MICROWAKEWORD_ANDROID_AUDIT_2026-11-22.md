# OGAM / Jarvis — Russian microWakeWord and Android KWS Audit
Date: 2026-11-22
Target: OPPO Find X6 Pro PGEM10 / Snapdragon 8 Gen 2 (SM8550) / Android 16 / ColorOS 16.0.5
Status: source, training-config and platform-documentation audit. No wake-word model was trained/downloaded, no Android runtime integrated, no APK built, and no PGEM10 microphone test performed.

## Executive decision

The strongest new Russian wake-word lead is an MIT training project that explicitly targets the exact phrase «Джарвис»:
- interkelstar/microwakeword-trainer — MIT training pipeline with Russian Piper voices and adversarial negative phrases.
- It exports an approximately 82.5 KB streaming TFLite model. Its author reports 47/50 real-world detections (94%) and 1 false activation among 140 mined hard-negative clips.
- The underlying kahrendt/microWakeWord framework is Apache-2.0 and exports a small streaming MixedNet/Inception CNN.

This is substantially more promising than the inspected Russian openWakeWord DNN trainer, whose author reports only about 45–60% recall on 50 natural recordings despite about 99.8% validation accuracy.

**Recommendation:** make microWakeWord the first KWS benchmark prototype candidate, not yet the production winner. The test sample is small, results are author-reported, the actual 82.5 KB model file was not found in the trainer repository, and an Android runtime/feature frontend has not been integrated or tested.

## 1. Exact source revisions and licences

### 1.1 Russian microWakeWord trainer

Repository: https://github.com/interkelstar/microwakeword-trainer
Inspected main commit: 8fdbadc3b969a8c1993108c0d655910440dfb762 (2026-09-27)
Licence: MIT.

Inspected source:
- README: 6f7d87292cdda2bd3a2f684bf1b72d705536cdb7
- Russian production config ru_jarvis.yaml: 1f83762f8e9d0584015631f77c01eb2956ba4ab9
- Training/export script train_mww.py: a8f486227b45b2f6e8db256791baa3865fc525ae

The repo's stated purpose is to train a custom Russian wake word «Джарвис» entirely from synthetic TTS positives, without requiring the owner to record hundreds of positive clips. The training config sets:
- wake word: Джарвис;
- positive phrases: Джарвис, Джарвис!, Джарвис?;
- primary Russian Piper voices: Dmitri, Denis, Irina, Ruslan;
- a secondary English voice set for cross-language negative phrases;
- adversarial Russian near-matches such as Джар, Ярвис, Джарв, Вис, Джек, Джаз, Жарко, Жаль, Пожар, Пожалуйста, and other common words/names;
- train_with_recordings: false, meaning the example production config does not mix recorded clips into the positive training data;
- 50,000 positive synthetic TTS clips, 10,000 validation clips;
- MixedNet architecture, stride 3, 204 feature-frame input context, probability cutoff 0.9 and sliding-window size 10.

The trainer optionally supports adding ElevenLabs positive clips; this is not required by the Russian example. For OGAM, keep the first baseline Piper-only to avoid paid service/API dependencies and external transmission of voice text.

### 1.2 Underlying microWakeWord framework

Repository: https://github.com/kahrendt/microWakeWord
Inspected main commit: 4665173cd35f1cff9a61e06fc427f124766c488e (2026-07-06)
Licence: Apache-2.0.

Inspected:
- README blob 96c5391668bec4170b8501ad06c80efddb7551d0
- LICENSE blob 261eeb9e9f8b2b4b0d119366dda99c6fd7d35c64
- streaming layer blob 37b77702c8ee8038c4e6e91979560e264e7555c1
- inference helper blob ec0634376accb8e7832205c117149f4acb3e6cf0

The framework is built around a low-power streaming CNN (MixedNet/Inception) derived from streaming keyword-spotting work. It converts audio into 40 spectral features every 10 ms and runs the streaming model every 30 ms in the configured example. The model is designed for a rolling feature stream, not for repeatedly re-evaluating a complete two-second recording.

### 1.3 Model card/licence boundaries for training assets

The trainer downloads separate Piper ONNX voice models from rhasspy/piper-voices. The exact model cards must be checked per voice revision before redistribution or training. One inspected example, ru_RU-dmitri-medium, is listed as Russian, single-speaker, 22,050 Hz; its model card records its training dataset as CC0 and the model repository page identifies MIT. That is useful evidence for this one voice only; do not infer that all Russian voices or every dependency carry the same terms.

Sources:
- Piper Dmitri model card: https://huggingface.co/rhasspy/piper-voices/blob/main/ru/ru_RU/dmitri/medium/MODEL_CARD
- Piper Dmitri model files: https://huggingface.co/rhasspy/piper-voices/tree/main/ru/ru_RU/dmitri/medium

The example config optionally uses bond005/sberdevices_golos_10h_crowd for real speech negatives in the openWakeWord trainer; the microWakeWord trainer uses the kahrendt microWakeWord negative-data ecosystem and can also use local false-positive clips. The Golos-derived dataset card declares license: other and describes it as a public licence with attribution and reserved conditions, not a recognised permissive SPDX licence. Its card also says source-speaker identity must not be inferred. Do not bundle or train from that dataset for an OGAM distributable model until its exact licence/terms are reviewed. Prefer properly licensed noise/room data and locally consented test speech, or keep the ambiguous dataset out of the first training run.

Sources:
- Dataset card: https://huggingface.co/datasets/bond005/sberdevices_golos_10h_crowd
- Dataset README: https://huggingface.co/datasets/bond005/sberdevices_golos_10h_crowd/blob/main/README.md

No Piper weights, Golos audio, microphone recordings or KWS model weights were downloaded or committed in this audit.

## 2. Reported Russian «Джарвис» results — promising, but limited

The microWakeWord trainer author reports training on:
- 50,000 Piper TTS clips across four Russian voices (Dmitri, Denis, Irina, Ruslan);
- additional ElevenLabs positives;
- about 314,000 positive and 353,000 negative feature windows;
- an evaluated held-out set of 50 real daily-use activations and 140 mined hard false-positive clips (TV speech, clicks, knocks and similar cases);
- 208 false-positive clips mined from real daily use for hard-negative retraining.

Reported results:
- real activation recall: 47/50 = 94%;
- hard-negative test: 1/140 false activation;
- previous openWakeWord model on the same comparison set: 50/50 recall but 91/140 hard false positives;
- production cutoff: 0.9;
- streaming uint8 TFLite model size: 82.5 KB;
- validation accuracy: 99.77%.

Important caveats:
1. These are trainer-author results, not independently reproduced by OGAM.
2. The positive field sample is only 50 utterances. A Wilson 95% interval for 47/50 is approximately 83.8%–97.9%; the true performance could be materially lower or higher.
3. 1/140 is a proportion on a mined set of hard-negative clips. It is **not** a false-accept-per-hour or false-activation-per-day measurement.
4. The source README does not publish independent, speaker-disjoint, long-duration FAR/hour validation on a second device.
5. The actual ru_jarvis_mww.tflite and JSON manifest are not present in the inspected trainer repository tree. The repo provides its training recipe/config, not a ready-to-download, hash-pinned model artifact.

Verdict: enough evidence to justify a controlled prototype; not enough to promise 94% recall or a production false-activation rate on OPPO.

## 3. Why the microWakeWord design is attractive for Jarvis

### 3.1 Runtime pipeline

The inspected framework/trainer design is:
1. 16 kHz mono PCM input.
2. 160 samples (10 ms) per capture step.
3. TFLite Micro micro_speech-style MicroFrontend, producing 40 features from a 30 ms audio window every 10 ms.
4. Noise reduction / automatic gain control is included in the reference MicroFrontend feature path.
5. The streaming MixedNet/Inception classifier consumes a rolling window and keeps its internal streaming state.
6. Configured stride 3 advances the classifier every three 10 ms feature frames (30 ms).
7. A sliding average over 10 model probabilities is compared with the configured 0.9 threshold before declaring the hotword.

This is much smaller and more focused than running full Russian ASR continuously. The KWS detector only needs to classify the phrase «Джарвис»; after detection, the existing OGAM ASR/LLM conversation path takes over.

### 3.2 Android integration opportunity — not yet proven

The trainer exports a TFLite model and the framework's Python inference helper imports ai_edge_litert.interpreter.Interpreter. The trainer export path creates a streaming inference graph using its Stream wrapper and asks TFLiteConverter for builtin INT8 operators. This suggests a possible Android LiteRT/TFLite deployment, but it is not yet a verified Android integration:

- the MicroFrontend feature extractor is separate from the TFLite classifier and must be reproduced exactly;
- Android must use the same 40-bin feature scaling, noise/AGC and window/stride behavior as training;
- the stateful streaming model's input/output state contract must be inspected from the actual exported model;
- the trainer README calls the artifact uint8 quantised while the Python inference helper's quantization branch checks for np.int8. The generated model's real tensor dtype, quantization scale and zero-point must be read from the actual .tflite artifact before implementation; do not trust the prose label;
- the generated model's operator list must be checked against the Android LiteRT interpreter and chosen ABI;
- no Android Kotlin SDK, Java wrapper or OPPO benchmark was found in the trainer itself.

Suggested clean-room OGAM interface:
- JarvisWakeWordBackend.load(modelFile, manifest, expectedSha256)
- pushAudio(pcm16kMonoFrame) from the existing shared capture stream
- onScore(probability) for diagnostics/threshold evaluation
- onWakeWordDetected(confidence, monotonicTimestamp) after sliding-window/debounce rules
- reset() on capture interruption/route change
- close() to release model/interpreter state.

Port the MicroFrontend separately in C++/JNI or a compatible supported Android implementation. Do not replace it with a generic mel filterbank or an arbitrary VAD output: feature-scale mismatch can silently prevent detection.

### 3.3 Model and training effort

The trainer README estimates:
- Linux training host (Ubuntu/Debian/WSL2), Python 3.9+;
- approximately 15 GB training disk space;
- NVIDIA GPU strongly recommended; CPU training approximately 8–14 hours;
- 50k positive TTS clips; model export and optional test phase.

This is a training-pipeline requirement, not an OGAM runtime requirement. The resulting model is reported at only 82.5 KB, but the exact OGAM deployment artifact must be generated, hash-pinned and validated by our own CI before inclusion.

## 4. Comparison with openWakeWord and Vosk-based Jarvis

### 4.1 openWakeWord Trainer — not the first-choice Russian baseline

Repository: https://github.com/interkelstar/openwakeword-trainer
Inspected main commit: 5e230ce0fe8c827c38cfc72ac41bc3ed10aca708
Licence: MIT.

Its Russian example also targets «Джарвис» with four Piper voices and adversarial negatives. The author reports:
- about 50,000 synthetic clips and about 860 KB TFLite model;
- about 99.8% validation accuracy;
- only approximately 45–60% recall on 50 natural real-world recordings;
- variable false-positive behaviour requiring multiple training runs and hard-negative tuning.

The author states they moved to microWakeWord because the streaming CNN gave much better real-world recall. This is a project author's comparison and not an independent head-to-head evaluation by OGAM, but it is a strong reason to put microWakeWord first in our prototype queue.

### 4.2 Official openWakeWord hey_jarvis

The official openWakeWord hey_jarvis model is trained for the English phrase "hey jarvis"; its docs note that using only "jarvis" may work with more false rejects. It is not a pretrained Russian «Джарвис» model and is not a substitute for the Russian trainer.

Source:
https://github.com/dscripka/openWakeWord/blob/main/docs/models/hey_jarvis.md

### 4.3 Vosk + Silero VAD — useful functional fallback

Repository: https://github.com/SaKuRa5353/Jarvis
Inspected main commit: 821435a0c3c5ad479fbd62b708968a110233b0fc (MIT).
Inspected wakeword detector blob: 5fa960ea4a1af4494d0d23ba412c2c74ba690ee5.

This independent Russian Jarvis project uses:
- a single microphone stream shared by consumers;
- Silero VAD running in silence;
- Vosk's Russian ASR recognizer activated only after speech begins;
- approximately 0.4 s pre-roll so the first syllable is not cut off;
- text match for «Джарвис» in the Vosk transcription;
- a wait_or_done path that can interrupt TTS/LLM work when a new wakeword arrives.

This is not a tiny dedicated KWS detector: during speech it runs full Russian ASR. It is a useful functional fallback and architecture reference if a small KWS model is unavailable, but its Python/PortAudio/desktop dependencies are not an Android implementation.

## 5. Android KWS model landscape

### Sherpa-ONNX

Sherpa-ONNX is a useful Android/Apache-2.0 speech runtime. Its pre-trained KWS model catalogue at the audited snapshot lists Chinese-English, Chinese and English models; no ready-to-use Russian KWS artifact was identified. Russian ASR models do exist, but an offline transducer is not automatically compatible with the online/streaming KWS interface.

Decision:
- retain Sherpa for Russian ASR and general Android speech runtime comparison;
- do not assume an available Russian offline ASR package is a drop-in KWS model;
- a custom Russian KWS-compatible streaming model would need a separate export and evaluation.

Sources:
- KWS docs: https://k2-fsa.github.io/sherpa/onnx/kws/
- Android docs: https://k2-fsa.github.io/sherpa/onnx/kws/apk.html
- pretrained model catalogue: https://k2-fsa.github.io/sherpa/onnx/pretrained_models/

### No dedicated Android runtime in the examined trainer

The microWakeWord trainer is a Linux/Python training pipeline. It produces a TFLite file and a deployment JSON for the Python/ESPHome-oriented microWakeWord inference ecosystem. No Android Kotlin API or verified Android ARM64 build was included in the inspected repository.

This is a manageable but real integration task: prove that the exported stateful TFLite graph runs with the Android LiteRT interpreter, implement the matching MicroFrontend, then route its detection result into the existing assistant state machine.

## 6. Android 12–16 microphone access — important policy correction

Primary platform sources:
- VoiceInteractionService API: https://developer.android.com/reference/android/service/voice/VoiceInteractionService
- background FGS start restrictions: https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
- foreground-service types: https://developer.android.com/develop/background-work/services/fgs/service-types
- Android 15 behavior changes: https://developer.android.com/about/versions/15/behavior-changes-15
- AOSP Automotive voice interaction guide: https://source.android.com/docs/automotive/voice/voice_interaction_guide/app_development
- AOSP VoiceInteractionService source: https://android.googlesource.com/platform/frameworks/base/+/c8de8c708fd74a1d8d784ce630cc9857f6b4d698/core/java/android/service/voice/VoiceInteractionService.java

Verified distinctions:

1. **System keeps the selected VoiceInteractionService running.** Android's public API says the user's current global VoiceInteractionService is kept running to support functions such as hotword listening in the background. This is important, but it does not itself implement a wakeword model or grant every microphone capture API.

2. **DSP/system hotword APIs are privileged.** AOSP marks createAlwaysOnHotwordDetector and createHotwordDetector as @SystemApi/@hide and the modern method requires MANAGE_HOTWORD_DETECTION. These are not ordinary public APIs for a normal third-party app.

3. **The Automotive software-hotword capture path is also privileged.** The AOSP guide specifies AudioSource.HOTWORD and CAPTURE_AUDIO_HOTWORD for that path and states those constants are hidden/available only to bundled apps. Do not assume OGAM can use this privileged route.

4. **A user-selected VoiceInteractionService is a documented microphone while-in-use exception, not a blanket bypass for all FGS rules.** Android's background FGS documentation separates general background-start restrictions from restrictions on starting FGS types that require while-in-use permissions. The app providing the current VoiceInteractionService is listed under the while-in-use exception list. This does not mean every arbitrary background startForegroundService() is permitted, nor does it grant the hidden DSP hotword APIs. Start the user-consented microphone session from a visible user action unless another explicit current platform exemption is confirmed.

5. **Microphone FGS requirements still apply.** For a normal app-owned microphone FGS, declare android:foregroundServiceType="microphone", FOREGROUND_SERVICE, FOREGROUND_SERVICE_MICROPHONE, and runtime RECORD_AUDIO; start only after the required permission is granted and make the active microphone state visible to the user. Recheck the exact target-SDK requirements against the current Android documentation at build time.

6. **Android 15+ blocks microphone FGS startup from BOOT_COMPLETED for apps targeting API 35+.** Do not start a hidden listening loop from a boot receiver or promise unattended auto-restart after reboot. Provide a user-visible re-enable path.

7. **ColorOS 16 remains unverified.** The public Android rules do not prove Oppo's battery management, keyguard, Doze and app-standby behavior on PGEM10. Test the assistant role, lock screen, display off, Doze, battery saver, force-stop, reboot and route changes on the actual device.

User-facing product rule: wakeword must be opt-in, have visible microphone state and a stop control. If permission, role or capture fails, Jarvis returns to inactive/press-to-talk mode. No stealth recording and no policy bypass.

## 7. OGAM microphone ownership — confirmed integration boundary

Existing PR #1 source:
- src/services/audioRecorderService.ts, blob SHA 1646210d412f96522be3398f6503eff4fee0f55e.
- src/services/recorderAudioStream.ts, blob SHA 0c6932a342be348abbbc4c9bab6819f0037e696c.
- src/services/whisperService.ts, blob SHA 4f81aed770bb005e5ba623a3bc76bcfafba42e1d.
- src/services/recordingController.ts, blob SHA 9c7a7a3caa70da2abce117babbcfbe24c955ef3e.

The current OGAM recorder already:
- owns one react-native-audio-api AudioRecorder;
- captures mono 16 kHz audio;
- offers shared sample and RMS callbacks to subscribers;
- writes the same capture to its recording file;
- feeds Whisper realtime from the same underlying microphone stream;
- serializes Whisper native operations through a single lane;
- has isEchoCancelled() hard-coded false and therefore safely remains half-duplex.

Do not add a second AudioRecord or React Native AudioRecorder for KWS. The KWS engine should subscribe to the existing PCM stream when the authorised microphone session is active, and unsubscribe cleanly on stop/suspend. Do not change the production recorder or leave a microphone running outside the visible/user-approved state machine.

## 8. Recommended OGAM prototype and acceptance gates

### Prototype architecture
- Add an isolated JarvisWakeWordBackend interface and benchmark-only TFLite/LiteRT implementation.
- Keep model interpreter and exact MicroFrontend separate from the recorder.
- Feed 16 kHz mono PCM from AudioRecorderService's shared subscriber path; no second hardware capture.
- Generate stateful feature frames, run inference at the configured 30 ms model step, average the sliding window and apply a configurable threshold plus debounce/cooldown.
- On hit, emit a monotonic timestamp and transition the existing assistant coordinator from standby to query capture.
- Keep the hotword detector inactive when microphone permission is not authorised, assistant role is not active where required, the user stopped listening, or Android suspended capture.
- During Jarvis TTS playback, continue to block/ignore self-trigger until AEC is verified; half-duplex remains the default.

### Required tests before product adoption
- Verify TFLite model operator list, input/output tensors, dtype, quantization scales/zero points, streaming state tensors and Android LiteRT compatibility.
- Reproduce the exact 40-feature MicroFrontend on 16 kHz PCM and compare feature values against the reference Python/frontend outputs on identical test WAVs.
- Add unit tests for rolling feature buffer, model state, stride, threshold, smoothing, reset, cancellation and time discontinuity.
- Test at least 30–50 consenting speakers, split train/test by speaker and recording session; include normal, fast, quiet, far-field, whisper, accent and noisy cases.
- Use long negative recordings and report false accepts/hour, not only false clips; add TV/radio, music, other speech, similar words, assistant TTS and silence.
- Measure recall, false rejects, false accepts/hour, detection latency, CPU %, native/RSS memory, battery drain per hour, device temperature and screen-off reliability.
- Compare CPU first; only test QNN/NNAPI or other acceleration after a log confirms the backend and delegated operators actually ran.

### No-go until evidence
- No default production wakeword enabled.
- No claim of DSP hotword / hardware low-power listening.
- No claim of continuous or guaranteed screen-off operation on ColorOS.
- No always-listening start from boot.
- No APK release, model commit or user-facing 94% performance claim based on the trainer README alone.

## 9. Sources and exact inspected pins

- microWakeWord Russian trainer (MIT): https://github.com/interkelstar/microwakeword-trainer/tree/8fdbadc3b969a8c1993108c0d655910440dfb762
- microWakeWord framework (Apache-2.0): https://github.com/kahrendt/microWakeWord/tree/4665173cd35f1cff9a61e06fc427f124766c488e
- openWakeWord Russian trainer (MIT): https://github.com/interkelstar/openwakeword-trainer/tree/5e230ce0fe8c827c38cfc72ac41bc3ed10aca708
- Russian Jarvis desktop reference (MIT): https://github.com/SaKuRa5353/Jarvis/tree/821435a0c3c5ad479fbd62b708968a110233b0fc
- Official openWakeWord hey_jarvis: https://github.com/dscripka/openWakeWord/blob/main/docs/models/hey_jarvis.md
- Piper Russian Dmitri model card: https://huggingface.co/rhasspy/piper-voices/blob/main/ru/ru_RU/dmitri/medium/MODEL_CARD
- Golos dataset card/licence caveat: https://huggingface.co/datasets/bond005/sberdevices_golos_10h_crowd
- Sherpa KWS docs: https://k2-fsa.github.io/sherpa/onnx/kws/
- Android VoiceInteractionService API: https://developer.android.com/reference/android/service/voice/VoiceInteractionService
- Android background FGS restrictions: https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
- Android microphone FGS requirements: https://developer.android.com/develop/background-work/services/fgs/service-types
- Android 15 FGS restrictions: https://developer.android.com/about/versions/15/behavior-changes-15
- AOSP DSP/software hotword privileges: https://source.android.com/docs/automotive/voice/voice_interaction_guide/app_development
- AOSP VoiceInteractionService hidden API annotations: https://android.googlesource.com/platform/frameworks/base/+/c8de8c708fd74a1d8d784ce630cc9857f6b4d698/core/java/android/service/voice/VoiceInteractionService.java

## 10. Work not performed

No training pipeline was run; no model file was generated, downloaded or hashed; no TFLite/Android runtime was integrated; no QNN delegate was built; no APK was built or installed; no microphone recording or PGEM10 battery/thermal/recall/FAR test was performed. This document is source-level research and a prototype design, not an implemented feature.
