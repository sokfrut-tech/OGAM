# Native generation watchdog

Status diagnostics for the local llama.rn generation path.

## Behaviour

- The lifecycle enters `preparing` when a generation is accepted.
- It enters `waiting` immediately before the native completion call.
- Native callbacks update the last-progress time and callback/token counters. Reasoning callbacks are marked `thinking`; answer callbacks are marked `streaming`.
- If no callback arrives for 60 seconds, the service enters `delayed`, shows a Russian chat notice, and writes a local diagnostic entry.
- If callbacks resume, the notice clears and the 60-second quiet-period check starts again.
- Stop changes the state to `stopping`. The chat tells the user that the native call is still draining.

## Safety rules

The watchdog is diagnostic, not a native cancellation primitive. It must never:

- resolve or reject the original native completion Promise;
- delete an entry from `nativeWork` before that operation settles;
- clear `activeCompletionPromise` or mark the engine idle on a JavaScript timeout;
- call `context.release()` while the native completion may still be using the JSI context;
- allow a second generation to start against the same context.

The existing Stop path remains responsible for requesting native interruption. Context release continues to wait for every tracked native operation.

## Logged fields

A delay event records only the model filename, effective backend, active/requested GPU layers, context length, configured thread/batch counts, callback/token counts, quiet duration, and one memory snapshot. It does not record prompt text, generated content, reasoning, or tool arguments. Memory is sampled once per delay event; there is no polling loop.

## Device verification

On the OPPO Find X6 Pro, test the exact installed Qwen3.5-2B GGUF and quantization. Capture the in-app debug log around:

1. model load completion;
2. the first generation with a short prompt;
3. a long prompt that previously stalled;
4. Stop while the model is silent;
5. a new send after the native operation settles.

Record the exact GGUF filename, selected backend, active GPU layer count, context length, elapsed time until the first warning, and whether Stop settles. Do not infer a Qwen-specific root cause from the watchdog warning alone.
