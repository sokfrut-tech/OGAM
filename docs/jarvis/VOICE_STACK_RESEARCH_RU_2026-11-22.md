# Russian-first voice stack research for Jarvis

Date: 2026-11-22
Scope: OGAM Android / OPPO Find X6 Pro; offline-first; Russian speech is a release requirement.

## Findings from open projects

### 1. ru-voice-agent — best voice-agent architecture reference

Repository: https://github.com/meshoklv/ru-voice-agent
License: MIT (repository source code).
Companion benchmark: https://github.com/meshoklv/ru-speech-bench (MIT).

What is reusable:
- A single duplex voice-session pipeline: audio capture → correct sample-rate conversion → streaming ASR → end-of-turn detector → LLM stream → sentence chunker → TTS → ordered audio playback.
- First-sentence speech starts before the LLM finishes its full answer.
- Barge-in cancels current speech as soon as the person starts speaking.
- LLM fallback is selected before the first spoken word, never halfway through a sentence.
- Local logs contain text/timings but deliberately do not store raw audio.
- Every remote endpoint is token-gated and loopback-only by default; cloud TTS is optional, not required.
- The benchmark records actual hardware, measured latency, caveats and separate code/model licenses.

Not directly portable: this project is a Python/Linux server plus browser client, not an Android library. Its pipeline is an architecture and test reference; OGAM needs native Kotlin/React Native lifecycle, Android audio focus, OPPO background policy and device-specific profiling.

### 2. Streaming Russian ASR candidates

| Candidate | License | Evidence / strengths | Limitations / Jarvis decision |
|---|---|---|---|
| Existing OGAM Whisper realtime | Existing dependency; model-specific terms to verify | Already wired to native recording, streaming transcription, cancellation and model downloads | Preserve; first migrate the private `@offgrid/speech` state/timer contracts |
| T-one | Apache-2.0 code and weights | Russian Conformer CTC; 300 ms input chunks; benchmark measured ~99–123 ms per chunk and RTF 0.31 on an 8-vCPU Xeon with one ORT thread | 145 MB model; output alphabet has no digits, Latin letters or punctuation. Could be a fast Russian draft, not the sole transcript. No OPPO Android runtime test yet |
| GigaAM-v3 via sherpa-onnx | MIT code/weights per upstream project and benchmark audit | Russian ASR, punctuation, digits/Latin output; good offline batch transcription candidate | Not streaming; model package about 232 MB; use for final correction or recorded files, not immediate duplex turn-taking |
| Qwen3-ASR already in OGAM | Verify exact model/runtime license and revision before shipping | Existing OGAM path already supports local Qwen3-ASR plus Whisper fallback | Preserve and test; do not assume its model/runtime supports all streaming modes |

Possible routing to benchmark, not yet implemented:
1. Existing Whisper realtime remains the current baseline.
2. T-one may be tested as an optional low-latency Russian streaming hypothesis.
3. Whisper or GigaAM can correct technical terms, Latin names and digits after the turn.
4. Never silently substitute a low-confidence transcript: show confidence/uncertainty and ask the person to repeat when necessary.

T-one measurements and caveats are from the MIT benchmark project, not from Android hardware. The benchmark explicitly states its disagreement figures are not human-labelled WER.

### 3. VAD and end-of-turn detection

- Silero VAD: MIT code and ONNX model; small model (about 1.2–2.2 MB in the benchmark package), supports 8 kHz and 16 kHz chunks. The benchmark measured roughly 0.5–0.6 ms per 32 ms chunk on an older Xeon CPU. This is a promising local VAD candidate, but OPPO latency, battery, false starts and microphone noise must be measured.
- Smart Turn v3.2: 8.3 MB ONNX, BSD-2-Clause weights. Upstream publishes Russian benchmark metrics, but the independent benchmark's monologue tests were weak (AUC 0.635 on a limited mid-word-cut experiment) and explicitly says a labelled real-dialogue set is needed. Defer as a default.
- Do not equate silence with a completed thought. Use VAD for speech boundaries plus configurable silence; test interruption, breathing pauses, multi-sentence speech and noisy rooms.
- Current OGAM voice settings (tap/silence/hands-free, silence delay, speaker drain) must be retained and migrated from `@offgrid/speech`, not simplified away.

### 4. Russian TTS candidates and license gates

| Candidate | Code/runtime | Voice/model status | Jarvis decision |
|---|---|---|---|
| sherpa-onnx | Apache-2.0; Android arm64 Kotlin/Java APIs; supports VITS/Piper, Kokoro, VAD, ASR and other offline speech tasks | Runtime license does not grant voice/model rights; each ONNX voice and phonemizer/data pack must be checked separately | Strong native Android runtime candidate; test as an OGAM optional engine after exact ABI/APK-size review |
| Piper VITS voices through sherpa-onnx | sherpa-onnx runtime can run VITS/Piper models; no need to embed the Piper Python runtime | Voice weights carry per-model cards. Russian `denis`/`dmitri` cards and training provenance have conflicting/stale public descriptions; a maintainer issue dated Nov 19, 2026 says current main was retrained away from the Lessac base, with Denis CC0 and Dmitri CC BY 4.0 dataset chain. Pin the exact current revision and obtain the updated model cards before shipping. `ruslan` is CC BY-NC-SA; `irina` has no clear license on its card | Do not package any Russian Piper voice yet. Re-check exact revision, model card, base provenance, file hashes and commercial/use rights. Do not include the GPL-3.0 Piper runtime |
| Silero v5_5_ru | Silero runtime code may be MIT; model weights are CC BY-NC-SA 4.0 | Natural Russian with stress/homograph handling; the independent RuVoice Android project integrates it but its repository license is CC BY-NC-SA 4.0 | Non-commercial model only; do not use as OGAM default |
| Silero v5_cis_base / v5_cis_base_nostress | Model license MIT according to Silero model docs | Large set of CIS voices including Russian; some are non-native speakers and can have accents; `nostress` does not provide the full v5 stress/homograph behaviour | Research candidate for a separately implemented Android backend; verify model export format, provenance, exact voice quality and on-device compatibility |
| Kokoro-82M | Apache-2.0 weights; React Native ExecuTorch TTS API supports Kokoro | Strong natural voice; Russian is not an official stock language. Russian via espeak G2P can misplace stress. Kokoro-RU fine-tune has OpenRAIL tag and incomplete terms/provenance audit | Preserve current Pro Kokoro architecture as optional multilingual TTS; not the Russian-first default until stress/quality benchmark passes |
| Qwen3-TTS 1.7B | Apache-2.0 declared | Russian capable, but benchmark used RTX 3090 Ti; 4.54 GB weights + 0.68 GB tokenizer; measured RTF 2.8–3.3 on that GPU, with reference leakage and no verified mobile streaming | Optional PC/LAN research only; not a phone default |
| ESpeech-TTS-1 RL-V2 | Apache-2.0 declared for weights; base-model license unverified | Promising Russian stress/quality and GPU measurements | PC/LAN research only until base provenance and mobile runtime are verified |

Important licensing distinction:
- `VoxSherpa-TTS` is GPL-3.0; use only as an architecture reference unless OGAM intentionally accepts GPL-3.0 obligations.
- The newer Piper runtime `OHF-Voice/piper1-gpl` is GPL-3.0. The archived original Piper code had MIT, but it is not the same maintained runtime. Do not assume the old license applies to the current runtime.
- Model repository metadata (e.g. a top-level MIT tag) does not override an individual voice's MODEL_CARD, training data or upstream dataset terms.
- Never package weights based only on a model name, a benchmark table or an unpinned mirror.

### 5. Existing OGAM advanced speech features to retain

The current OGAM test tree shows the Pro audio layer already has:
- streaming sentence-by-sentence TTS coordinator;
- final-turn speech and streaming-tail flush;
- playback state machine with monotonic session IDs and stale-session race guards;
- pause/resume/stop, elapsed/duration/amplitude state;
- TTS engine subscription, download provider and engine lifecycle tests;
- Kokoro model and voice catalog tests;
- audio waveform and streaming clock tests.

The implementations live in the private `pro/audio` workspace and are not present in the public standalone branch. Their tests are valuable behavioural contracts, but they are not a substitute for the missing implementation. Rebuild or port each capability under the global `search → inspect → compare → license-check → adapt/integrate → test → document` policy. Do not disable audio mode or replace it with a no-op.

## Proposed Jarvis voice architecture

1. **Audio I/O owner:** Android AudioRecord/AudioTrack, audio focus, Bluetooth route changes, echo cancellation/noise suppression where supported, foreground session lifecycle.
2. **VAD/turn owner:** Silero VAD (candidate) with explicit turn settings; optional Smart Turn only after a Russian dialogue benchmark.
3. **ASR router:** Whisper realtime baseline; optional T-one streaming; Whisper/GigaAM/Qwen fallback/correction based on confidence and task.
4. **Conversation stream:** one user turn and one assistant turn with cancellation tokens; model output is chunked by sentence without speaking internal reasoning.
5. **TTS router:** local Russian engine first; multilingual Kokoro/ExecuTorch optional; no silent cloud fallback.
6. **Playback coordinator:** monotonic session token, one playback state machine, sentence queue, stale event rejection, barge-in and cleanup.
7. **Text normalizer:** Russian numbers, dates, time, units, currencies, abbreviations, Latin technical terms, homographs and stress dictionary before TTS.
8. **Diagnostics:** timing metadata and error codes; never store raw audio unless the person explicitly chooses to save a recording.

## Device evaluation required before choosing defaults

Run on OPPO Find X6 Pro (Android/ColorOS build recorded):
- cold/warm model load, first audio latency, RTF, CPU/GPU, RAM, APK/asset size, thermal throttling and battery per 10 minutes;
- 1/2/4-thread configurations; background/foreground and screen-off behavior;
- Russian conversational dialogue with interruptions, pauses, numbers, dates, names, Latin IT terms, profanity and noisy environment;
- ASR WER/CER against a human-labelled corpus (not cross-engine disagreement);
- TTS listening panel and pronunciation/stress error set;
- model cancellation/unload/reload, incoming call, Bluetooth headset and permission revocation.

No TTS model has been selected as the default. No large model or voice pack has been downloaded by this research step.


## sherpa-onnx Android integration feasibility (v2.0.3)

The official Android source was inspected, not just the README:
- Kotlin/JNI wrappers include `Vad` with Silero VAD configuration and `OfflineTts` with VITS, Kokoro and other model families.
- The Android AAR module declares minSdk 21 and exposes Kotlin APIs; the JNI library is loaded from `sherpa-onnx-jni`.
- The official v2.0.3 release publishes a full Android AAR (52,411,426 bytes; SHA-256 `4c766e2e74c9d33d595338c21fe3b305c73ba45d47e96a235675c33142a2ec50`) and an Android native archive (47,988,767 bytes; SHA-256 `2a30b222abae6d5cf544df4a1c27944279449c25dbb9c755097189cb45db1df0`). This is too large to add casually just for VAD.
- The AAR project README shows how to build a local AAR from the release's native libraries. A slim arm64-only build or a custom static/shared runtime may reduce size, but must be measured and reproduced in CI; do not assume the full AAR is the right package.
- The library is Apache-2.0. The model and phonemizer assets remain separately licensed.
- The upstream sample system TTS engine demonstrates that a proper Android `TextToSpeechService` is possible; Jarvis can first call the library directly for its own speech and later optionally expose a system TTS engine.

Integration decision: **candidate only, not yet added to OGAM dependencies**. First prove an arm64-only package build, ABI compatibility with OGAM's NDK/CMake settings, release APK delta, cold-start and model performance. Do not bundle model weights in the APK; download selected assets only after explicit user confirmation, with exact size, SHA-256, license and storage/RAM disclosure.

Official source paths inspected:
- `android/SherpaOnnxAar/README.md`
- `android/SherpaOnnxAar/sherpa_onnx/src/main/java/com/k2fsa/sherpa/onnx/Vad.kt`
- `android/SherpaOnnxAar/sherpa_onnx/src/main/java/com/k2fsa/sherpa/onnx/Tts.kt`
- Release: https://github.com/k2-fsa/sherpa-onnx/releases/tag/v2.0.3


## 6. Current Android voice-agent implementation study — Jandal AI (Apache-2.0)

Repository inspected at commit `c55203575f4087b395cc1bfb651fac2581c42611` on 2026-11-22:
https://github.com/NickMonrad/kernel-ai-assistant

The project is a useful current Android reference because it has a native Kotlin voice module, local inference, typed capture lifecycle and an Android default-assistant integration. Its source tree and tests were inspected; this is an architecture study, not a code copy.

### Patterns worth adapting independently

- **Typed capture events:** `VoiceInputEvent` distinguishes `ListeningRequested`, `ListeningStarted`, `SpeechDetected`, `PartialTranscript`, `Transcript`, `SpeechEnded`, `Error` and `ListeningStopped`.
- **Session ownership:** every capture has a monotonically allocated `captureSessionId`. Scoped stop/cancel and admission callbacks prevent stale UI or backend cleanup from stopping a newer recording.
- **Mic arbitration:** `WakeMicYieldGate` releases the wake-word microphone on a capture request/start and only rearms it when the matching capture session stops. A stale stop from a replaced session is ignored.
- **Single speech-stop authority:** `SpeechStopCoordinator` tracks SpeakingStarted/SpeakingStopped and accepts one stop request only while speech is active; with no UI collector it stops the output controller directly.
- **Default-assistant path:** `VoiceInteractionService` registers the app; `VoiceInteractionSessionService` creates a session; `VoiceInteractionSession.onShow` delegates to the same voice-command activity used by other entry points. The example pauses the wake-word service before the activity takes the microphone and restores it on hide.
- **Backend selection and recovery:** the voice module separates input/output interfaces from Android native, Sherpa and asr4all engines; it models unavailable/fallback outcomes and session-scoped events instead of sharing mutable booleans across UI/native layers.

Relevant inspected paths:
- `core/voice/src/main/java/com/kernel/ai/core/voice/VoiceInputController.kt`
- `core/voice/src/main/java/com/kernel/ai/core/voice/SelectableVoiceInputController.kt`
- `core/voice/src/main/java/com/kernel/ai/core/voice/SpeechStopCoordinator.kt`
- `app/src/main/java/com/kernel/ai/assistant/JandalVoiceInteractionService.kt`
- `app/src/main/java/com/kernel/ai/assistant/JandalVoiceInteractionSession.kt`
- `app/src/main/java/com/kernel/ai/assistant/WakeMicYieldGate.kt`
- Matching unit tests under `core/voice/src/test` and `app/src/test`.

### What must NOT be transplanted blindly

- Jandal's voice stack uses its own model/backend policies and a different app architecture. OGAM needs to keep its existing Whisper/Qwen ASR, direct-audio models, audio recorder, model residency and cancellation contracts.
- Its privileged/root-only patterns from PocketDaemon are not required and must not be introduced.
- Code reuse must preserve Apache-2.0 notices; the safer first step is to reproduce the observable contracts in OGAM-owned Kotlin/TypeScript modules with OGAM tests.
- Jandal's wake detector is an always-on feature with battery, microphone permission and OEM background implications. Jarvis must keep wake-word detection opt-in and explicitly visible.

## 7. OGAM voice-session migration — reverse-engineered contract and open boundary

Current OGAM consumers and tests on the active branch establish these behaviours:

1. `userStart` moves an idle/stopped session into `listen` with a user-visible `listening` phase.
2. `speechHeard` changes only the phase to `recording`; it must notify UI subscribers but must NOT cause the edge-triggered mic driver to start another recording.
3. `turnCaptured` moves the turn to the `transcribing` phase and closes the microphone before transcription/LLM work.
4. `userStop` is an explicit stop boundary; the recording-controller test expects the final UI phase to be `idle`.
5. `nothingHeard` may be dispatched once or twice depending on which path ended the turn. Do not collapse the two-event empty-turn paths until each caller and hands-free return rule is specified.
6. `dictationFinished` closes chat dictation without borrowing the assistant-response lifecycle.
7. Replay has a distinct return-to-previous-floor contract: `Voice.ts` checks `replayReturnsTo`; cancelling capture due to replay must not dispatch `dictationFinished`, because replay owns the floor and `replayEnded` returns it.

Verified OGAM files/tests:
- `src/services/voiceSession.ts`
- `src/services/recordingController.ts`
- `src/components/ChatInput/useVoiceSessionDriver.ts`
- `src/components/ChatInput/Voice.ts`
- `src/components/ChatInput/useSilenceEndpoint.ts`
- `__tests__/unit/services/recordingController.test.ts`
- `docs/GAPS_BACKLOG.md` (hands-free race and edge-trigger contract)

**Migration blocker:** the exact `@offgrid/speech` transition implementation and private Pro replay/playback callers are not available in this connected fork. The event names above are grounded in OGAM consumers/tests, but the complete replay state contract and all hidden Pro callers are not yet proven. Do not replace `voiceSession` with an inferred three-state boolean machine. The next safe migration step is to create a full caller/event inventory (including the Pro-side replay start/end seam), then implement a pure OGAM-owned transition table with tests for initial hands-free, userStart idempotency, speechHeard phase-only notification, turnCaptured, userStop, one/two nothingHeard, dictationFinished, replay return and stale capture ownership.

## 8. Russian-first default in the primary ChatInput path

The current main `ChatInput/Voice` path reads `useWhisperStore.transcriptionLanguage` and passes it to:
- Whisper live recognition (`startRealtimeTranscription`);
- Whisper final recorded-file transcription (`transcribeFile`);
- Qwen3-ASR (`QwenAsrEngine.transcribe`), which maps the selected code to a language-name prefill such as `language Russian<asr_text>`.

The old store default was hard-coded to `en`. On 2026-11-22 the new-profile default was changed to the app/device locale: Russian → `ru`, English/unsupported locales → `en`. The setting is persisted; existing values are deliberately not overwritten during upgrade, to preserve a person's explicit choice. A unit Node test verifies the pure locale mapping. A Qwen ChatInput integration test for the Russian code has been added but has not yet run in Jest or on OPPO. Therefore this is a code-level default fix, not a measured ASR quality result.

## 9. Scope note for the legacy Russian locale correction

The 2026-11-22 change to `voiceService.ts` corrects the separate `react-native-voice` wrapper and its `useVoiceRecording` hook. Repository code search found no production call site for that legacy hook. The current main ChatInput flow instead uses `audioRecorderService` plus Whisper/Qwen transcription and `useWhisperStore.transcriptionLanguage`. Therefore the RU/EN wrapper fix is useful maintenance, but it is **not** proof that the primary ChatInput pipeline or offline ASR defaults are already Russian. Verify the actual selected Whisper/Qwen language and model on OPPO before release.

## 10. System-assistant one-shot conversation behavior

The Android system-assistant route now sets a one-shot flag on the existing ChatScreen and passes it through ChatMessageArea → ChatInput → voice handlers. It does not create a second microphone or message-sending implementation.

- For an empty composer with no pending attachments, a non-empty recognized phrase is submitted through the normal `chat.handleSend` path. The normal user-message history, routing and model pipeline remain the source of truth.
- If typed draft text or any pending attachment already exists, the spoken phrase is appended to the composer and left for review. The app does not silently send the pre-existing draft or attachments just because the system assistant was invoked.
- Ordinary manual Chat-mode dictation is unchanged: it still fills the composer without auto-sending.
- The one-shot flag is cleared on successful send, fallback-to-draft, an empty capture, a failed transcription, a cancellation or a stale result that no longer belongs to the open chat. Whisper now exposes an `onCaptureSettled(hasTranscript)` signal for both manually and automatically completed captures; the existing `onCaptureEnded` voice-session semantics remain separate.
- New `voiceNoteSend.test.ts` Jest tests cover assistant auto-send, draft protection and pending-attachment protection. A new Node source-contract test is part of open-core CI. The Jest tests have not yet run in this CI workflow.
- This still does not provide a spoken reply in free/core mode: local Russian TTS, sentence streaming and duplex/barge-in remain separate open implementation slices. No OPPO device verification has been performed.

