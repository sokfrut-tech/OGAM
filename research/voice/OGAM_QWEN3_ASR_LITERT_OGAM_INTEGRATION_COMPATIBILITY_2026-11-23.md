# OGAM Qwen3-ASR LiteRT — Existing App Integration Compatibility
Date: 2026-11-23
Branch: docs/research-breeno-coloros-2026-11-22
Scope: read-only mapping of the public LiteRT SM8550 Qwen candidate onto the current OGAM feature branch. No OGAM code or build files changed.

## Existing OGAM implementation inspected

Feature branch: `feature/jarvis-step-2-storage-privacy`.
- `package.json` blob `6121bbdf037a677a217dce7268d82602994ba01b`.
- `android/app/build.gradle` blob `9d6ffadb557794c5533567054be7d5c61a993ef6`.
- `android/build.gradle` blob `ac9050e4f00209dfdfcf68d0a52bc2ca501a4909`.
- `src/services/qwenAsrEngine.ts` blob `223b9dd3de73af4ec4fce5a28d966b0efa4cc373`.
- `src/services/qwenAsrModel.ts` blob `5c73eb8b6aa6cb4650df7aa96d85eb8ffd71a09d`.
- `src/services/audioRecorderService.ts` blob `1646210d412f96522be3398f6503eff4fee0f55e`.
- `src/services/recorderAudioStream.ts` blob `0c6932a342be348abbbc4c9bab6819f0037e696c`.
- `src/services/recordingController.ts` blob `9c7a7a3caa70da2abce117babbcfbe24c955ef3e`.
- `src/components/ChatInput/useVoiceSessionDriver.ts` blob `e3a291c90b715f4bfd11cdde10f0f36306e38f0b`.

Current state:
- OGAM already has Qwen3-ASR 0.6B GGUF + mmproj through `llama.rn` / llama.cpp `qwen3a`.
- Android currently runs this GGUF path on CPU (`n_gpu_layers: 0`, `devices: ['CPU']`); iOS uses Metal.
- Current Qwen engine transcribes a complete WAV turn; it is not the upstream vLLM streaming implementation.
- `audioRecorderService` is the single mic owner. It requests 16 kHz mono and publishes copied normalized Float32 samples via `onAudioSamples`.
- `RecorderAudioStream` converts those samples to PCM16 bytes for the Whisper realtime adapter. A LiteRT adapter should subscribe directly to the recorder's Float32 samples, not reuse Whisper's PCM16 byte representation.
- `recordingController` and `useVoiceSessionDriver` centralize start/stop/cancel and session floor transitions. A new backend must obey those owners and must not open another `AudioRecord`.

## Android toolchain compatibility

- OGAM minSdk 24, compileSdk/targetSdk 36, NDK `27.1.12297006`, Kotlin 2.4.0.
- OGAM already pins `com.google.ai.edge.litertlm:litertlm-android:0.19.1` for local LLM inference.
- Google's current LiteRT Android guide lists CompiledModel v2.3.2 as latest and v2.3.0 as legacy; LiteRT 2.3.2 supports minSdk 24 and NDK r26a+.
- Google's ASR sample uses LiteRT 2.3.0, sample minSdk 31 and arm64-v8a. This is sample configuration, not a hard minimum for OGAM.
- Google sample includes optional Qualcomm HTP runtime modules, including V73, and a device-targeting group for Qualcomm/QTI SM8550. Runtime modules are commented out until explicitly enabled.

## Safe experiment design

1. Keep the existing GGUF Qwen engine as a selectable baseline and rollback path.
2. Add a separate experimental `QwenLiteRtAsrBackend` only after the model I/O contract, tokenizer and exact AOT manifest are verified.
3. Feed it from `audioRecorderService.onAudioSamples` using bounded, serialized PCM processing. Specify backpressure, cancellation, buffer ownership and end-of-turn flush before implementation.
4. Use Google's `CompiledModel` NPU/CPU fallback pattern and device-targeted HTP runtime module as references; do not copy its `MicrophoneAudioSource`.
5. Verify actual `Build.SOC_MODEL`, Qualcomm/QTI manufacturer, NPU compatibility and real HTP dispatch on the OPPO PGEM10 before calling the path NPU-accelerated.
6. Check Gradle dependency resolution, D8/R8 and packaged native library collisions between existing LiteRT-LM 0.19.1 and standalone LiteRT CompiledModel 2.3.x. Do not assume either conflict or compatibility without a real build.
7. Pin exact LiteRT/QNN compiler-runtime versions, model SHA-256, tokenizer, metadata, license/NOTICE and model size. Do not silently download a ~1.9 GB model over mobile data.
8. Keep Qwen's rolling 5-second windows and 2.5–3.0 second normal stride explicit. This path is an offline/rolling ASR candidate, not yet a true low-latency conversational stream.

## Decision

OGAM's current recorder and Float32 PCM callback are a good integration seam. The lowest-risk path is a parallel Android LiteRT backend that does not alter the existing Qwen GGUF engine or mic lifecycle.

Do not implement or ship until model signature correctness, Gradle/runtime compatibility, CPU baseline, Russian WER/CER, memory/thermal profile and actual SM8550 HTP dispatch are tested. No OPPO device evidence exists yet.