# OGAM / Jarvis — Russian Android TTS and Microphone Integration Audit
Date: 2026-11-22
Target: OPPO Find X6 Pro PGEM10 / Snapdragon 8 Gen 2 (SM8550) / Android 16 / ColorOS 16.0.5
Scope: read-only source audit of OGAM voice code and two public Android TTS implementations, plus model/runtime/license research.
Status: documentation only. No model was downloaded, no source code was ported, no Android APK was built and no PGEM10 test was run.

## Executive conclusion

A high-value new Russian Android TTS reference was found: **RuVoice TTS** (kost-t-human/ruvoice-tts), version 1.1.3 at commit 6ae704fc52c029f444a29bd78ee1b59b9e92bbf0 (2026-11-16). It is a native Android TextToSpeechService built around Silero voices, with extensive Russian text normalization, stress/homograph handling, voice profiles, sentence streaming to the Android TTS callback and off-screen playback handling.

Its root source license is CC BY-NC-SA 4.0, and its built-in Russian v5_5_ru model is also CC BY-NC-SA 4.0. This is **not approved for code reuse or inclusion in OGAM's normal distributable build**. It is an architecture and test-design reference. The same project documents an additional v5_cis_base_nostress Russian voice pack under MIT (29 voices), but those are a separate model pack with reduced prosody/stress quality; their availability does not relicense the app's CC BY-NC-SA source. Keep model and wrapper licenses separate.

A second strong candidate is **Qwen3-TTS 0.6B Q4_K_M** through the Kotlin/JNI Android reference Danmoreng/qwen3-tts-android. Its application and native runtime declare MIT, and the upstream Qwen model is Apache-2.0 and supports Russian. Its current Android JNI wrapper only returns one completed FloatArray, although the pinned C++ runtime already has chunked streaming callbacks. That is the cleanest near-term technical prototype to connect to Jarvis's existing JarvisPcmStreamPlayer, provided device performance is acceptable.

**No production TTS winner is selected.** Benchmark both candidates on the PGEM10 before any production integration.

## 1. New project: RuVoice TTS — public Android source audit

Repository: https://github.com/kost-t-human/ruvoice-tts
Inspected branch: master
Inspected commit: 6ae704fc52c029f444a29bd78ee1b59b9e92bbf0
Commit date: 2026-11-16
Version in commit message: 1.1.3
Root LICENSE: CC BY-NC-SA 4.0
Key source blobs:
- SileroTtsService.kt: bdf1643be7a229d53dfb583bec726f8fbd4a0fb9
- SileroModels.kt: fda8155e04361ce899e6abc95a77f1bf0e13a55b
- Pack.kt: d6434686e48266fb06bcef05bc84ca381c961544
- app/build.gradle.kts: 1c4c47fc15fda80a4ae3065aea8e8905629b4a6c
- app/src/main/AndroidManifest.xml: 3347f41c3ab73150f621f4d6f24b47429f876a61
- Instrumentation test SileroModelsTest.kt: 6f2d06f099b8bb900ac268d51a3509aecec6ad0b
- ExecuTorch Android build script tools/build_executorch_aar.sh: blob 5f4d3886448bef9a6875250969f4f8faf0c7ffbb

### 1.1 What is technically useful

RuVoice is not a generic chat demo. It is a system Android TTS engine:
- registers a platform TextToSpeechService and standard android.intent.action.TTS_SERVICE;
- has no INTERNET permission in its manifest and describes the Russian pipeline as fully offline;
- declares only foreground-service/media-playback/notification permissions for the screen-off playback path; it does not need microphone permission for speech synthesis;
- accepts standard Android SynthesisRequest and emits PCM through SynthesisCallback;
- uses a bounded output queue, sentence segmentation and prefetch so the next text segment can be generated while the previous audio is being played;
- uses foreground media playback while the screen is off to reduce playback stalls, then drops foreground after idle;
- has a text preprocessing layer for dates, numbers, currencies, units, abbreviations, Latin terms, punctuation, SSML, pauses, homographs, stress, ё, and dictionary overrides;
- uses Silero Stress resources and a BERT homograph classifier, rather than sending raw unprocessed Russian text directly to the acoustic model;
- provides voice profiles, separate speech-rate/pitch/volume settings, SSML handling and cancellation/interruption behavior;
- includes instrumentation tests for model load/synthesis, golden audio comparison, stress text, pack voice switching, homographs and large text.

This is a strong reference for the **Russian linguistic front-end** that OGAM currently lacks. We should not copy its code; create independent OGAM-owned normalization/stress contracts or select a compatible library under a clear license.

### 1.2 Runtime architecture and build caveats

The inspected source uses:
- PyTorch Lite / TorchScript Lite 2.1.0 for tts_mel.ptl and head.ptl;
- ExecuTorch 1.5.0 with XNNPACK for the vocoder backbone backbone.pte;
- a custom-built Android AAR, not merely the standard published AAR. The project explains that a generic ExecuTorch Android AAR can trigger SIGILL on older ARMv8.0 Cortex-A53/A73 devices due to ARM atomic instruction selection. Its build script disables unrelated LLM/QNN/Vulkan components and rebuilds the XNNPACK variant using NDK r28c.
- minSdk=23, targetSdk=35, arm64-v8a only, JDK 17.
- The model files themselves are not stored in the source repository; the README describes a local conversion process from official Silero model files into TorchScript Lite and ExecuTorch assets.
- Full release APK is described by upstream as about 230 MB; lite about 145 MB without bundled voice model. This is upstream packaging information, not independently measured here.

This is a useful warning for OGAM: a model conversion and native-runtime package must be pinned and reproducible, and prebuilt binaries must not be assumed to work on every Qualcomm/ARM device.

### 1.3 Upstream performance claims — not PGEM10 measurements

RuVoice README reports:
- Galaxy A32 / Helio G80: RTF 0.21;
- Redmi Note 13 5G / Dimensity 6080 and Xiaomi device with Snapdragon 4 Gen 2: RTF about 0.05;
- working memory about 350–500 MB;
- the XNNPACK ExecuTorch vocoder portion accounts for roughly three quarters of synthesis time.

These are upstream author-reported figures. They are not independently reproduced here and are not benchmarks on Snapdragon 8 Gen 2 / PGEM10. RTF below 1 is the relevant real-time target, but OGAM must record its own cold/warm latency, first-audio time, memory, temperature and battery.

### 1.4 License decision — important

- Root application/source code: CC BY-NC-SA 4.0. Do not copy or link its source into OGAM's MIT codebase for a normal/general distribution.
- Built-in Silero v5_5_ru voice: CC BY-NC-SA 4.0. Do not package it in an OGAM release intended for commercial use or future commercial flexibility.
- Separate cis_ru pack: 29 voices based on v5_cis_base_nostress, declared MIT by upstream. This is a promising model-only lead, but it is a different model family and lacks automatic stress/homograph behavior; user-facing quality can be weaker. Actual pack archive, file hashes, all bundled assets and provenance must be inspected before any use.
- Silero Stress is described upstream as MIT, but its code/data components and any source dictionaries must still be inventoried individually before inclusion.
- RuVoice also incorporates other data sources with their own terms (including AOT-derived morphology and third-party dictionaries). Never copy its full corpus or binary resources into OGAM.

Decision: **architecture reference only for now**. Investigate the MIT v5_cis_base_nostress weights as a separate model candidate; do not adopt RuVoice source code, the built-in v5_5_ru model, or its dictionaries.

## 2. Candidate: Qwen3-TTS 0.6B through Kotlin/JNI — strongest near-term prototype

### 2.1 Audited Android implementation

Repository: https://github.com/Danmoreng/qwen3-tts-android
Inspected app tree commit: 35738304b31c425cc08fb5405372fedfd6531b3b
Inspected native submodule: https://github.com/Danmoreng/qwen3-tts.cpp
Pinned submodule SHA: 4562731dc612cb87b4cd1eedac275a17d1078773
Android app and submodule declare MIT licenses.

Observed:
- Kotlin/Compose application with an Android JNI bridge to native C++17/GGML.
- Android API 31+ and arm64-v8a target.
- Default Q4_K_M 0.6B model pair: talker qwen-talker-0.6b-base-Q4_K_M.gguf (628,905,056 bytes) plus qwen-tokenizer-12hz-Q4_K_M.gguf (254,974,752 bytes), roughly 884 MB combined in decimal units.
- Kotlin model API exposes CPU thread control, active backend name, compiled backend mask and progress in generated tokens.
- Russian is an explicit language option in the Android UI; the C++ model API uses Russian language ID 2069.
- App uses app-private storage for model files and supports local voice-profile / speaker-embedding data.
- CMake defaults OpenMP, Vulkan and OpenCL OFF. Default route is CPU. Optional Vulkan/OpenCL build flags exist; no QNN/Hexagon backend was found in the inspected CMake path.
- No Snapdragon 8 Gen 2 measurements are published in the inspected source.

### 2.2 Critical discovery: streaming exists in C++, but not in the Android JNI wrapper

The pinned C++ API exposes:
- synthesize_streaming();
- voice-reference streaming;
- speaker-embedding streaming;
- ICL-prompt streaming;
- chunk callbacks with PCM samples, sample rate, chunk indices and estimated text alignment;
- callback return false to stop synthesis early.

The C API exposes qwen3_tts_synthesize_streaming and corresponding variants. The C wrapper forwards audio chunks to the C++ callback.

But the audited Android QwenEngine.kt and its JNI nativeSynthesize use the batch path: JNI calls qwen3_tts_synthesize..., converts the completed waveform into one Java/Kotlin FloatArray and returns it. Its progress callback reports generated token counts, not PCM audio chunks. The Android app therefore does not currently make use of the C++ streaming callback in the inspected path.

This is a very useful adaptation opportunity for OGAM:
1. preserve the existing model-neutral JarvisTtsBackend contract;
2. add an isolated JNI audio-chunk callback that wraps the existing C streaming API;
3. forward PCM chunks from a worker thread to JarvisPcmStreamPlayer.write(generationId, ...);
4. use the backend's cancellation contract to return false to native generation when user barge-in or stale generation is detected;
5. keep model inference, AudioTrack and AudioFocus as separate owners.

No code has been changed. This is a planned prototype seam, not an implemented feature.

### 2.3 Resource / quality caveats

- Q4_K_M model pair requires about 884 MB of disk before caches/temporary files.
- C++ code and the reference Android app do not prove inference fits memory or runs faster than real time on PGEM10.
- Native FloatArray batch JNI can create high transient memory pressure for long speech; chunked callback is preferable.
- Voice cloning/reference audio is personal biometric-like audio data. Only allow user-provided/consented voice profiles, store under app-private storage, and expose deletion.
- Do not add all model weights to the APK; use a signed, hash-verified, resumable model pack and memory-aware loading.
- No QNN/Hexagon backend was verified in the pinned CMake configuration. Vulkan/OpenCL must be verified independently on the target; do not call it NPU acceleration.

Upstream links:
- Android app: https://github.com/Danmoreng/qwen3-tts-android/tree/35738304b31c425cc08fb5405372fedfd6531b3b
- Native runtime: https://github.com/Danmoreng/qwen3-tts.cpp/tree/4562731dc612cb87b4cd1eedac275a17d1078773
- Android Kotlin JNI wrapper: https://github.com/Danmoreng/qwen3-tts-android/blob/35738304b31c425cc08fb5405372fedfd6531b3b/app/src/main/java/com/qwen/tts/studio/engine/QwenEngine.kt
- Qwen C API: https://github.com/Danmoreng/qwen3-tts.cpp/blob/4562731dc612cb87b4cd1eedac275a17d1078773/src/qwen3_tts_c.h
- Qwen C API implementation: https://github.com/Danmoreng/qwen3-tts.cpp/blob/4562731dc612cb87b4cd1eedac275a17d1078773/src/qwen3_tts_c.cpp
- Model card: https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF

## 3. Other Russian Android TTS routes

### Sherpa-ONNX

- Apache-2.0 runtime with an Android Kotlin API for OfflineTts.
- API generateWithCallback and generateWithConfigAndCallback emits FloatArray PCM chunks. This is a natural API seam for the Jarvis PCM player.
- Official Android AAR release is available; the 2.0.1 AAR is about 47 MB for the published package, while a custom arm64 build can be assembled from the release archive.
- Supports VITS/Piper and other model families, but every voice/model/phonemizer/data file has a separate license and provenance.
- Piper Russian Denis/Dmitri model cards remain inconsistent with the upstream late-2026 retraining note. The current cards still name the older Lessac base; Piper says old copies do not qualify and the exact new model card must name rdh (Denis) or hifi_tts_92 (Dmitri). Do not package either until the downloaded exact artifact and card meet that condition.
- Piper runtime itself is GPL-3.0-or-later; this is distinct from the voice weights. Sherpa-ONNX is not Piper and remains a separate runtime candidate.

Decision: good secondary runtime candidate once a Russian model with a clean, pinned license is found.

### LiteRT Qwen3-TTS

- Separate community/Google LiteRT path with Android CompiledModel Kotlin sample.
- Existing sample's published optimized Pixel 8a CPU RTF is about 2.06, which is slower than real time (RTF > 1). The sample does not implement dual-track streaming.
- This is a different artifact/runtime from the Qwen3-TTS GGUF + JNI implementation above. Do not combine their model sizes or runtime claims.
- It remains a useful CPU/GPU/NPU experiment, but is not the first TTS prototype for Jarvis.

### Kokoro-RU

- Russian 82M candidate zaakirio/kokoro-ru, code Apache-2.0, weights tagged OpenRAIL.
- Requires Russian stress/G2P restoration (RUAccent/ru_g2p); reported laptop peak memory around 2.39 GB and no verified Android PGEM10 build.
- OpenRAIL terms are not the same as Apache-2.0; model-use terms and derivative rights need a separate review.
- Keep as PC/LAN or later mobile research, not an OGAM default.

### Silero V5 CIS Base

- Official Silero model docs describe v5_cis_base and v5_cis_base_nostress as MIT, with Russian speaker IDs. The model expects explicit stress marks and does not automatically resolve homographs/ё.
- RuVoice reports a cis_ru pack of 29 Russian voices under MIT model terms, but its application source is separately CC BY-NC-SA and should not be reused.
- Candidate only after inspecting the actual pack files, checksums, conversion provenance, and a clean-room runtime/phonemization path.

## 4. OGAM microphone, playback and echo-cancellation audit

Inspected OGAM PR #1 source:
- src/services/audioRecorderService.ts, blob 1646210d412f96522be3398f6503eff4fee0f55e
- src/services/recorderAudioStream.ts, blob 0c6932a342be348abbbc4c9bab6819f0037e696c
- src/services/recordingController.ts, blob 9c7a7a3caa70da2abce117babbcfbe24c955ef3e
- src/services/whisperService.ts, blob 4f81aed770bb005e5ba623a3bc76bcfafba42e1d
- JarvisTtsBackend.kt, blob fd71270cc0ecf8ca58056bfd533aa4cb76452e73
- JarvisPcmStreamPlayer.kt, blob 024e1af4a1ff09beb3d338ba72e1fa702d24e6eb

Confirmed:
1. AudioRecorderService is the single physical microphone-capture owner via react-native-audio-api AudioRecorder. It requests RECORD_AUDIO and records mono 16 kHz audio.
2. Its onAudioReady callback feeds both the RMS level listener and the sample listeners from the same physical capture. RecorderAudioStream sends those same samples to Whisper realtime preview. It does not start a second recorder.
3. recordingController centralizes the logical turn phase; it coordinates state but does not own the low-level recorder.
4. Qwen3-ASR batch mode receives a recorded file after stop; Whisper realtime previews and final file transcription are separate stages.
5. JarvisPcmStreamPlayer owns Android AudioTrack/AudioFocus, accepts Float32 chunks, checks generation tokens and rejects stale chunks after cancellation. This is an appropriate playback sink for a native TTS streaming callback.
6. JarvisTtsBackend is currently an interface only in the audited native voice path; it does not prove a concrete Kotlin Russian TTS engine exists.
7. AudioRecorderService.isEchoCancelled() deliberately returns false. The comments explain that Android capture and current playback do not share a voice-processing engine, so the microphone can capture Jarvis's own speaker output. The honest current policy is half-duplex: finish/stop playback before recording the next utterance. True barge-in must wait until Android AEC and playback/capture reference routing are implemented and measured.
8. The JS speechEndpoint.ts still uses RMS threshold and silence timing; it is not neural Silero VAD.

### OGAM decision

- Preserve the single physical microphone owner. Any future KWS, Whisper and Qwen capture must subscribe to or coordinate through this one capture layer; do not create independent AudioRecord/AudioRecorder owners.
- Use explicit half-duplex turn management until echo cancellation is proven.
- TTS writes PCM through the existing JarvisPcmStreamPlayer; do not make a backend own AudioTrack or AudioFocus.
- Use a generation ID to cancel old synthesis and reject late chunks.
- First add a benchmark-only backend module; do not change current production voice selection until tests pass.

## 5. Recommended benchmark matrix — no winner selected

| Candidate | License / integration | Upside | Main risk |
|---|---|---|---|
| Qwen3-TTS 0.6B Q4_K_M + qwen3-tts.cpp | Apache-2.0 model, MIT runtime/app; Kotlin/JNI reference | Russian, voice conditioning, native C++ chunk API, close fit to OGAM | ~884 MB model pair, batch-only JNI today, CPU performance and RSS unverified on PGEM10 |
| Sherpa-ONNX + cleared Russian VITS/Piper voice | Apache-2.0 runtime; per-model voice license | Existing Kotlin callback emits PCM chunks | No currently approved Denis/Dmitri artifact; GPL Piper runtime distinct |
| Silero V5 CIS Base MIT pack + clean-room runtime | MIT model pack if actual artifact verified | Many Russian voices, smaller footprint likely than Qwen; RuVoice reports low RTF on mid-tier devices | No auto stress/homographs; model pack and conversion files need exact hashes; no OGAM native adapter |
| RuVoice built-in V5_5_RU | NC-SA code and model | Rich Russian normalization and upstream reports RTF 0.05–0.21 on other phones | Cannot be included in general OGAM distribution under current license, source not portable under OGAM MIT |
| LiteRT Qwen3-TTS | Apache-2.0 family | Android Kotlin sample and hardware delegate experimentation | Published sample RTF ~2.06 on Pixel 8a CPU, no streaming sample |

Benchmark all candidates with the same Russian corpus on PGEM10:
- Cold model load time and first PCM chunk latency (TTFA).
- Warm first-chunk latency and total generation time.
- RTF (generation seconds / generated-audio seconds; less than 1 is real-time).
- Peak Java + native RSS, model disk size, model load failures and OOM behavior.
- CPU/GPU/Vulkan/NNAPI delegate used (prove actual backend in logs; never infer NPU from a model name).
- Battery percentage per 10 minutes, thermal state and sustained throttling.
- Naturalness, stress, ё, homographs, names, technical abbreviations, Latin product names, numbers/dates/currencies, long answers and punctuation.
- Voice consistency, consent and deletion for user-created voice profiles.
- Cancellation and barge-in: stale chunks must never play after cancellation; no concurrent mic owner.

## 6. Implementation plan

### Phase A — benchmark-only, no production dependency change
1. Keep current OGAM voice path intact.
2. Create a small native benchmark harness around JarvisTtsBackend and JarvisPcmStreamPlayer.
3. Add Qwen3-TTS 0.6B Q4_K_M as a separately downloaded, SHA-256-pinned experiment pack; start with CPU.
4. Adapt the C++ streaming callback through JNI in the benchmark target only; prove callback ordering, cancellation and sample-rate handling.
5. In parallel, assess Sherpa-ONNX with an independently license-cleared Russian voice and Silero CIS model-only pack after exact file/license validation.
6. Run the identical corpus on PGEM10 and collect reproducible results.

### Phase B — choose a production backend only after device evidence
1. Select the best quality/resource/legal trade-off based on measurements.
2. Keep a small low-memory fallback and unload/unmap large models when not speaking.
3. Connect the chosen engine to Jarvis through JarvisTtsBackend, preserving AudioTrack and AudioFocus ownership in JarvisPcmStreamPlayer.
4. Implement privacy controls and delete/export for recorded voice profiles.
5. Add cancellation, audio focus loss, language fallback, no-model and storage failure tests.
6. Keep half-duplex until acoustic echo cancellation is proven on the real device.

## 7. Evidence boundary

This audit read public source and READMEs. It did not:
- download model weights or third-party APKs;
- validate full license chains for every model file;
- build either external project;
- run benchmarks on OPPO Find X6 Pro;
- change OGAM source code, dependency graph or model catalog;
- produce or install an APK.

Upstream performance claims are labeled as upstream claims, not device evidence. No Russian TTS winner is selected and no always-on/duplex microphone behavior is claimed.


## 2.4 JNI streaming refinement — correction after a deeper native wrapper pass

A deeper inspection of the pinned submodule found that the JNI C++ file already contains a function named `nativeSynthesizeStreaming` (in addition to batch `nativeSynthesize`). This narrows the gap:

- The JNI C++ function already accepts chunk duration, left-context duration, collect-audio flag and a callback object.
- It resolves an `onAudioChunk` callback method, copies each native PCM chunk into a Java `FloatArray`, passes sample rate and chunk/text-alignment metadata to Kotlin, and maps callback `false` to native cancellation.
- The native implementation calls the C streaming APIs for normal, reference-voice and speaker-embedding synthesis.
- However the audited Kotlin `QwenEngine.kt` (122 lines) declares only `nativeSynthesize` and no `nativeSynthesizeStreaming` external method, no AudioChunk callback interface, and no public `synthesizeStreaming` wrapper. Therefore the native JNI streaming symbol is currently **not reachable through the shipped Kotlin API** in this inspected revision.
- The JNI callback stores the current `JNIEnv*`; the native C++ stream path appears synchronous (the callback executes during the native call), but any OGAM wrapper must verify the callback thread/lifetime contract and never retain native chunk pointers after the callback returns.
- With `collect_audio=false`, the streaming API can avoid accumulating the complete waveform for the final result; OGAM should test this path to reduce duplicate PCM memory. The exact final-result behavior still needs an Android integration test.
- The Kotlin wrapper's default `NativeParams.languageId` is 2050 (English), while Russian is 2069. Jarvis must always pass 2069 explicitly rather than relying on the wrapper default.

Updated implementation opportunity: OGAM may only need a thin Kotlin API exposure over the already-present JNI function, plus tests and proper backend/PCM lifecycle integration. This is narrower than implementing a new C++ streaming layer from scratch. It remains a planned change, not a completed feature.


## 4.1 Android public AEC experiment — possible route, not a confirmed fix

AOSP and Android API documentation provide a concrete experiment path that is more precise than simply changing audio attributes:

- `AcousticEchoCanceler` is an audio preprocessor in the **capture path**. The public API attaches it to a particular `AudioRecord` using that recorder's `getAudioSessionId()`. `isAvailable()` only tells whether the device implements AEC; after creating it for the actual session, the app must inspect its enabled state and whether the platform owns/control status. (Android API: https://developer.android.com/reference/android/media/audiofx/AcousticEchoCanceler)
- AOSP guidance says implementations should provide AEC on the capture path for `MediaRecorder.AudioSource.VOICE_COMMUNICATION`, and if present, it must be discoverable/controllable via the SDK API. This is a platform implementation requirement, not proof that OPPO's current audio stack exposes or enables it for this recorder. (AOSP: https://source.android.com/docs/core/audio/implement-pre-processing)
- OGAM's audio recorder source comments say its Android Oboe input preset is patched to `VOICE_COMMUNICATION`, but its current recorder API path does not expose the underlying `AudioRecord` session ID or an observable AEC enabled state to the JS service. That needs direct native verification; a comment about a preset is not runtime proof.
- Jarvis output currently sets `AudioAttributes.USAGE_ASSISTANT` for AudioTrack and AudioFocus. AOSP maps `USAGE_ASSISTANT` to the `VOICE_COMMAND` context, while `USAGE_VOICE_COMMUNICATION` maps to `CALL`. Therefore, do not assume that a voice-communication capture preset will cancel assistant TTS output identically on every vendor audio HAL. (AOSP: https://source.android.com/docs/core/audio/attributes)
- Android's current AudioManager documentation describes `MODE_ASSISTANT_CONVERSATION` for interactive assistants, but it is gated by `canManageAssistantAudio()`. Do not unconditionally switch the device-wide audio mode or assume a third-party app is allowed to use that mode. (Android API: https://developer.android.com/reference/android/media/AudioManager)
- A mode change to `MODE_IN_COMMUNICATION` is also device-wide audio routing state and must not be changed speculatively; test only in an isolated user-visible session, remember the prior mode and restore it reliably.

### Bounded AEC experiment for PGEM10

1. Add a benchmark-only native probe to the same microphone recorder implementation to report (without recording/storing user audio): actual capture source, AudioRecord session ID, `AcousticEchoCanceler.isAvailable()`, `create(sessionId)` success, enabled state, control state and effect descriptor.
2. Confirm whether the capture path really uses `VOICE_COMMUNICATION` on PGEM10. Do not infer from the RN wrapper's comments.
3. Compare in a controlled local test: output through current `USAGE_ASSISTANT`; then, only as a separate experiment, `USAGE_VOICE_COMMUNICATION`; check whether app has permission for any relevant assistant audio mode before considering `MODE_ASSISTANT_CONVERSATION`. Do not change mode during normal use.
4. Play a fixed generated speech corpus from the phone speaker at safe volume while recording known near-end test phrases. Measure residual echo, near-end speech preservation, clipped word rate, false speech triggers, latency and whether the AEC state remains enabled. Repeat on earpiece, Bluetooth headset and speaker routing.
5. Keep `isEchoCancelled() == false` until a PGEM10 test demonstrates adequate suppression and no material near-end speech degradation over these routes. If unsupported or no effect is attached, keep half-duplex and report why.
6. On stop, permission loss, service interruption or call-state transition, release the AEC effect with its AudioRecord session, restore any audio mode/route changed by the experiment, and return to normal audio state.

### Current verdict

The Android public API offers a plausible, testable AEC route and AOSP specifies expected behavior for VOICE_COMMUNICATION capture. It does **not** prove that OGAM's current recorder exposes its AudioRecord session, that ColorOS 16 enables AEC, or that assistant playback is removed from the captured signal. No code was changed and half-duplex remains the current safe behavior.
