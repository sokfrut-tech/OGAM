# tiny-voca-ru Android port plan for OGAM Jarvis

Date: 2026-11-22
Status: research/implementation plan; no model assets or ONNX Runtime dependency imported yet.

## Goal

Evaluate a compact, Russian-first, fully local voice backend for OGAM/Jarvis on OPPO Find X6 Pro (PGEM10, Snapdragon 8 Gen 2 / SM8550). The model is a leading prototype, not yet an approved production engine.

## Upstream references

- Source: https://github.com/yilbegan/tiny-voca-ru
- Model: https://huggingface.co/egnch/tiny-voca-ru
- Dataset: https://huggingface.co/datasets/egnch/tiny-voca-ru-dataset
- ONNX Runtime Android: https://central.sonatype.com/artifact/com.microsoft.onnxruntime/onnxruntime-android

## Verified model contract

- 4,534,411 parameters; model card reports ~18.2 MB safetensors / ~21.4 MB ONNX.
- Russian only; two synthetic voice IDs F and M; 24 kHz mono output.
- ONNX inputs: `tokens` int64 [1,N], `stress` int64 [1,N], `voice` int64 [1], `speed`, `pitch_shift`, `pitch_range` float32 [1].
- ONNX outputs: `audio` float32 waveform and `durations` int64.
- The exact 61-symbol IPA inventory and ordering is part of the checkpoint contract. The graph does not accept raw Cyrillic.
- Published max_tokens=512 and max_frames=3000; split long answers by sentence/clause.
- Upstream `synthesize()` accumulates a full waveform; there is no model-native PCM callback. OGAM must call the backend once per sentence and report `SENTENCE_CHUNKED`, not `MODEL_STREAMING`.

## License and quality gates

- Code and weights: Apache-2.0.
- Bundled RUAccent stress dictionary and ONNX assets: MIT.
- Dataset: CC BY 4.0; retain attribution/NOTICE.
- Voice source: dataset card says voices were created with Qwen3-TTS 1.7B VoiceDesign. Confirm the exact model-card/voice asset provenance and redistribution terms before packaging.
- Model-card evaluation: 696 test clips; WER 2.03% vs 1.54% for Qwen3-TTS teacher; no formal listening test. Do not treat this as a production-grade quality certification.
- Default `lite` homograph score is 56.0% on the published 250-item set; optional `full` uses a 10 MB INT8 `omograph.onnx` and reports 91.6% against ruaccent turbo3.1 reference. Measure both on Jarvis phrases.
- Published 81x real-time ONNX CPU throughput is on AMD Ryzen 5 3600X / 4 threads, not Android. No SM8550 claim.

## Kotlin port map

The Python frontend is not a trivial tokenizer. Upstream source sizes at the audited revision:

| Module | Lines | Port responsibility |
|---|---:|---|
| `symbols.py` | 104 | exact IPA inventory and ID map |
| `clean.py` | ~100 | Unicode normalization, stress mark canonicalization, cleanup |
| `numbers.py` | 388 | cardinal/ordinal/decimal/fraction inflection |
| `tables.py` | 785 | Russian lexical/grammatical tables |
| `normalize.py` | 857 | numbers, dates, times, units, currencies, acronyms, Latin text |
| `stress.py` | 523 | lexical stress, clitics, dictionary lookup, optional ONNX stress models |
| `omograph.py` | 250 | WordPiece and contextual homograph model input |
| `g2p.py` | 382 | Russian phonology and IPA conversion |
| `tokenize.py` | 223 | sentence splitting, phone IDs and stress arrays |
| `lexicon.py` | 219 | lexical/stem exceptions |

Do not replace this with a lossy partial port and then claim general Russian correctness. The port should be incremental, with the same input/output golden fixtures as upstream.

## Implementation sequence

### T0 — Asset and provenance lock (no Gradle changes)
- Resolve a specific immutable Hugging Face revision for `egnch/tiny-voca-ru`.
- Retrieve exact SHA-256 and byte size for the Russian `onnx/model.onnx`, `onnx/model.json`, stress dictionary, `accent.onnx`, and optional `omograph.onnx`.
- Never reuse the English `n4ze3m/tiny-voca` ONNX hash; it is a different checkpoint and vocabulary.
- Store source URLs, commit/revision, SHA-256, size, license and NOTICE entries in the OGAM model catalog.
- Confirm voice provenance and CC BY 4.0 attribution requirements.

### T1 — Isolated Android ONNX runtime spike
- Candidate dependency: `com.microsoft.onnxruntime:onnxruntime-android:1.32.0` (MIT, published on Maven Central). Pin the version; do not use `latest.release`.
- Add it only in a dedicated feature branch after T0 is complete.
- Build a tiny Android instrumentation test that loads the pinned model from app-private storage, validates the six exact input names/types, runs one known phone sequence, and verifies finite PCM, sample rate 24 kHz, duration bounds and deterministic voice index.
- Start with CPU execution provider. Evaluate NNAPI separately; generic NNAPI availability is not evidence of Hexagon/QNN acceleration.
- Record AAR/APK size, ABI footprint, R8 rules, cold-start latency and peak RSS.

### T2 — Frontend parity, in dependency order
1. Port `symbols.py` exactly and add ID-order parity assertions against model metadata.
2. Port cleanup and G2P with explicitly stressed words first; this avoids silently guessing lexical stress.
3. Port tokenizer/sentence splitting and build a small, checked-in golden corpus.
4. Port number/date/time/currency/unit normalization with tests.
5. Port LiteStress dictionary + `accent.onnx` integration.
6. Port optional contextual homograph disambiguation (`omograph.onnx`) and compare lite/full.
7. Only mark the frontend supported when upstream fixtures pass and every unsupported input is surfaced safely rather than silently mispronounced.

### T3 — OGAM sentence-chunked backend
- Implement `JarvisTtsBackend` using one utterance per synthesis call.
- For each completed sentence: validate PCM/sample rate, check generation token, forward to `JarvisPcmStreamPlayer`, then continue.
- Mark output mode `SENTENCE_CHUNKED`; do not claim native model streaming.
- `cancel(requestId)` must suppress all subsequent chunks. If ONNX Runtime cannot interrupt an in-flight `Run`, report `supportsNativeCancellation=false`; do not misrepresent cancellation.
- Keep all inference on worker threads and playback/AudioFocus in the existing PCM player.

### T4 — PGEM10 acceptance
- Cold/warm latency to first sentence; RTF per sentence; 30-second and 5-minute speech; long responses; memory peak; thermal throttling; battery draw.
- Test interruption at 100 ms / 500 ms / 1 s after generation starts and ensure stale chunks never enter a newer playback generation.
- Russian names, dates, times, phone numbers, units, abbreviations, questions, exclamations and homographs.
- Compare F/M voices with blinded listening notes. No production default until quality and privacy/licensing gates pass.

## Current decision

tiny-voca-ru is the leading compact Russian prototype because the model is small and the code/weights have permissive licenses. It is not yet integrated: exact Russian model hashes/revision, voice provenance, full frontend parity, Android runtime size and SM8550 performance remain open. CosyVoice3-MNN is demoted to batch-quality experiment after its published Flow-only real-time gate failure. Supertonic remains conditional on OpenRAIL-M acceptance and a rebuilt callback-stop fix.
