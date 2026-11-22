# Jarvis — Step 5: raw prompt and assistant prefill

Status: implementation and focused unit tests committed on `feature/jarvis-step-2-storage-privacy`.

## Verified runtime contract

The fork pins `llama.rn` to `npm:@ogai/llama.rn@0.13.0-b12560`. Its checked source defines both `prompt` and `messages` on completion parameters, and `prefill_text` for the chat parser when the last assistant message is a prefill. It also supports `force_pure_content` to bypass chat/reasoning/tool output parsing.

## Implementation

- `llmService.generateRawPrompt(prompt, options)` passes the exact supplied string using the runtime's `prompt` field.
- Raw mode does not call the message converter, does not add the app's system prompt, and does not wrap the supplied text in the chat template.
- Raw mode sets `force_pure_content: true`, while retaining the existing native completion lifecycle: stop-aware context, single in-flight generation, safe completion, stream callbacks, completion statistics and context-health tracking.
- `llmService.generatePrefillResponse(messages, prefillText, options)` uses the runtime's `prefill_text` field and requires the final message to be an assistant prefix.
- Raw prompt and chat prefill are mutually exclusive. Empty raw prompts and invalid prefill placement are rejected before native completion.
- Existing model load/unload and RAM admission remain owned by `ActiveModelService` / `modelResidencyManager`; this step does not add a second loader or memory estimator.

## Files

- `src/services/llm.ts`
- `__tests__/unit/services/llm.test.ts`

## Verification

- Focused tests cover exact raw prompt forwarding, omission of chat messages, native prefill forwarding, and invalid inputs.
- Tests have not yet been run because the fork has no GitHub Actions results for the current branch.
- Device verification is still required on OPPO Find X6 Pro, including one raw completion and one assistant-prefill completion on the installed `@ogai/llama.rn` native runtime.
