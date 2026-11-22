# Jarvis — Step 6: voice-enabled image generation screen

Status: screen, navigation route, editable prompt preview and service integration committed on `feature/jarvis-step-2-storage-privacy`.

## Implemented

- Add `ImageGenScreen` and a Models-tab entry point.
- Prompt and negative-prompt editors.
- Dictation through the existing Whisper realtime transcription service. The selected Whisper model is loaded through `useWhisperStore`; final transcription is appended to the editable prompt.
- Explicit prompt-enhancement preview using the existing text engine. The user can edit the result before generation.
- Add `promptIsFinal` so the generation service does not silently enhance the user's reviewed prompt a second time.
- Respect the selected image model's per-model image parameter policy for initial steps and CFG values.
- Expose supported controls: steps, CFG/guidance scale, seed (blank means random), negative prompt.
- Subscribe to the existing image-generation lifecycle and show progress, cancellation and the saved image result.
- Existing image generation, model memory admission, MNN/QNN/SD backend selection and result saving remain owned by OGAM services.

## Important capability boundaries

- The current `GenerateImageParams` and native image bridge expose prompt, negative prompt, width/height, steps, guidance scale and seed. They do not expose sampler selection, denoising strength, inpainting masks or LoRA adapter controls. The screen does not show these as functional options.
- Prompt enhancement now requests natural English and a concise prompt of at most 45 words as a conservative target for a 75-token CLIP context.
- The installed native image bridge does not expose the actual CLIP tokenizer or token count. Therefore the 45-word target is a heuristic, not a guarantee of exactly 75 CLIP tokens. Exact enforcement requires adding the matching tokenizer for the selected image model.
- Prompt preview requires a usable text model; if unavailable, the existing enhancer reports the skip and the original text remains editable.
- Voice dictation requires a downloaded and selected Whisper model and sufficient free RAM. The existing single-model residency policy remains in force.

## Files

- `src/screens/ImageGenScreen.tsx`
- `src/services/imageGenerationTypes.ts`
- `src/services/imageGenerationService.ts`
- `src/services/imagePromptEnhancement.ts`
- `src/services/imageGenerationHelpers.ts`
- `src/navigation/types.ts`
- `src/navigation/AppNavigator.tsx`
- `src/screens/index.ts`
- `src/screens/ModelsScreen/index.tsx`
- `__tests__/unit/services/imageGenerationHelpers.test.ts`

## Verification

- A unit test covers the English/concise CLIP-friendly prompt instruction.
- CI has not run the tests for this branch.
- Android device tests still required: microphone permission, Whisper load/unload under memory pressure, MNN/QNN generation, cancellation and saved-image preview on OPPO Find X6 Pro.
