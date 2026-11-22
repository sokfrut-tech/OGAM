/**
 * OGAM-owned reasoning-budget policy shared by native and remote model surfaces.
 *
 * Zero means "automatic": do not send a token cap and let the model/runtime decide.
 * Positive values are explicit per-turn thinking-token ceilings.
 */
export const REASONING_BUDGET_AUTO = 0;

export const REASONING_BUDGET_OPTIONS: readonly number[] = [
  512,
  1024,
  2048,
  4096,
  8192,
  16384,
  32768,
];

export function reasoningBudgetLabel(value: number): string {
  if (!Number.isFinite(value) || value <= REASONING_BUDGET_AUTO) return 'Auto';
  if (value >= 1024 && value % 1024 === 0) return `${value / 1024}K tokens`;
  return `${Math.floor(value)} tokens`;
}

/**
 * llama.rn's completion API accepts thinking_budget_tokens.
 * An automatic or disabled budget is deliberately omitted from the payload.
 */
export function thinkingBudgetPayload(
  enabled: boolean,
  budget: number = REASONING_BUDGET_AUTO,
): { thinking_budget_tokens?: number } {
  if (!enabled || !Number.isFinite(budget) || budget <= REASONING_BUDGET_AUTO) return {};
  return { thinking_budget_tokens: Math.floor(budget) };
}
