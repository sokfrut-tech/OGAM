# Supertonic cancellation-entry race — source errata (2026-11-23)

This errata supplements OGAM_SUPERTONIC_TTS_ONLY_ANDROID_ADAPTER_IMPLEMENTATION_BRIEF_2026-11-23.md.

Pinned source: soniqo/speech-core commit 59b9d7902ea62dbbbfb95e139e2bf0e8957f8753, file src/models/litert/litert_supertonic_tts.cpp.

## Confirmed race

The implementation of LiteRTSupertonicTts::synthesize() starts by executing cancelled_.store(false). cancel() simply sets the same atomic flag true. Therefore, a cancellation that arrives after a caller considers a request active but before the synthesis method executes its initial reset can be overwritten. The model's atomic flag makes cancellation safe during inference, but does not by itself solve this request-start race.

## Required fix before adapter implementation

1. Add a request-generation token or an explicit native start handshake signalled only after the model has reset its per-call cancellation state.
2. Keep a Kotlin-side pending-cancel bit until that handshake arrives.
3. If cancellation was requested before the handshake, apply native cancel immediately after the handshake and before any model graph work begins.
4. Do not destroy the native handle until the synthesis worker has returned.
5. Test deterministically: cancel before native entry, immediately after entry/reset, during the first graph execution, and between output chunks.

A Kotlin AtomicBoolean alone is insufficient unless native code checks it after its own reset and before the first graph invocation.

## Consequence

The backend may advertise native cancellation only after this race is closed and tested. Until then, classify cancellation as best-effort and keep output generation-token invalidation in JarvisPcmStreamPlayer as the immediate safety boundary. Never let stale chunks reach playback.

No production code was changed by this audit.
