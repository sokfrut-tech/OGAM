import { MAX_TOOL_RESULT_CHARS } from './toolResultBudget.ts';

/** Default per-turn tool-call limit retained for older installs without a saved value. */
export const DEFAULT_MAX_TOOL_CALLS = 5;
export const MIN_MAX_TOOL_CALLS = 1;
export const MAX_MAX_TOOL_CALLS = 20;

/** Prompt accounting reserves room for system/message framing not represented in JSON input. */
export const TOOL_PROMPT_SAFETY_RESERVE_TOKENS = 192;

/**
 * Normalize persisted or user-entered tool limits to the supported range.
 * Missing, NaN and infinite values fall back to the stable default.
 */
export function normalizeMaxToolCalls(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_TOOL_CALLS;
  return Math.min(MAX_MAX_TOOL_CALLS, Math.max(MIN_MAX_TOOL_CALLS, Math.floor(value)));
}

/** Keep only the tool calls that still fit in this response's total-call budget. */
export function callsWithinToolBudget<T>(
  calls: readonly T[],
  alreadyUsed: number,
  maximum: number,
): T[] {
  const remaining = normalizeMaxToolCalls(maximum) - Math.max(0, Math.floor(Number.isFinite(alreadyUsed) ? alreadyUsed : 0));
  return remaining > 0 ? calls.slice(0, remaining) : [];
}

function serializedLength(value: unknown): number {
  try {
    const serialized = JSON.stringify(value ?? null);
    return serialized?.length ?? 0;
  } catch {
    // Prompt inputs are expected to be JSON-safe, but a malformed extension must not crash a turn.
    return String(value ?? '').length;
  }
}

/** Approximate characters used by message history plus the tool schemas offered to the model. */
export function toolPromptChars(
  messages: readonly unknown[],
  tools: readonly unknown[] = [],
): number {
  return serializedLength(messages) + serializedLength(tools);
}

export interface ToolResultCharBudgetInput {
  contextLength: number;
  promptChars: number;
  replyReserveTokens: number;
}

/**
 * Calculate a conservative character budget for the next tool result.
 * The estimate uses 3 characters/token (safer than the common English 4-char estimate for
 * JSON, identifiers and non-English text), reserves prompt-framing tokens and the requested
 * final-answer allowance, then applies the global hard cap.
 */
export function toolResultCharBudget({
  contextLength,
  promptChars,
  replyReserveTokens,
}: ToolResultCharBudgetInput): number {
  const contextTokens = Number.isFinite(contextLength) ? Math.max(0, Math.floor(contextLength)) : 0;
  const promptCharacters = Number.isFinite(promptChars) ? Math.max(0, Math.ceil(promptChars)) : 0;
  const replyTokens = Number.isFinite(replyReserveTokens) ? Math.max(0, Math.ceil(replyReserveTokens)) : 0;
  const promptTokens = Math.ceil(promptCharacters / 3);
  const remainingTokens =
    contextTokens - promptTokens - replyTokens - TOOL_PROMPT_SAFETY_RESERVE_TOKENS;
  if (remainingTokens <= 0) return 0;
  return Math.min(MAX_TOOL_RESULT_CHARS, remainingTokens * 3);
}

/** Instruction supplied after the per-response tool-call limit has been reached. */
export function toolLimitFinalAnswerInstruction(maximum: number): string {
  const limit = normalizeMaxToolCalls(maximum);
  return [
    `You have reached the limit of ${limit} tool calls for this response.`,
    'Do not call any more tools.',
    'Answer the original request using only the information already available in the conversation and completed tool results.',
    'Be clear about any missing information; do not invent results or claim an uncompleted action succeeded.',
  ].join(' ');
}

/** Combine completed tool results into a bounded recovery prompt for final-answer synthesis. */
export function finalResponseFromToolResults(
  instruction: string,
  results: readonly string[],
): string {
  const completed = results
    .map(result => result.trim())
    .filter(result => result.length > 0)
    .map((result, index) => `Completed tool result ${index + 1}:\n${result}`);

  return [instruction.trim(), ...completed].filter(Boolean).join('\n\n');
}
