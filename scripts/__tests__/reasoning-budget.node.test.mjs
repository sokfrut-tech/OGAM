import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REASONING_BUDGET_AUTO,
  REASONING_BUDGET_OPTIONS,
  reasoningBudgetLabel,
  thinkingBudgetPayload,
} from '../../src/utils/reasoningBudget.ts';

test('uses zero as the persisted automatic reasoning-budget sentinel', () => {
  assert.equal(REASONING_BUDGET_AUTO, 0);
});

test('offers increasing positive budgets beginning at 512 tokens', () => {
  assert.deepEqual(REASONING_BUDGET_OPTIONS, [512, 1024, 2048, 4096, 8192, 16384, 32768]);
  assert.ok(REASONING_BUDGET_OPTIONS.every((value, index, values) =>
    Number.isInteger(value) && value > 0 && (index === 0 || value > values[index - 1])));
});

test('labels auto, sub-K and whole-K budgets clearly', () => {
  assert.equal(reasoningBudgetLabel(REASONING_BUDGET_AUTO), 'Auto');
  assert.equal(reasoningBudgetLabel(512), '512 tokens');
  assert.equal(reasoningBudgetLabel(1024), '1K tokens');
  assert.equal(reasoningBudgetLabel(2048), '2K tokens');
  assert.equal(reasoningBudgetLabel(1536), '1536 tokens');
});

test('omits the token cap when thinking is off or budget is automatic', () => {
  assert.deepEqual(thinkingBudgetPayload(false, 2048), {});
  assert.deepEqual(thinkingBudgetPayload(true, REASONING_BUDGET_AUTO), {});
  assert.deepEqual(thinkingBudgetPayload(true), {});
});

test('sends an explicit integer token cap only when enabled', () => {
  assert.deepEqual(thinkingBudgetPayload(true, 1024), { thinking_budget_tokens: 1024 });
  assert.deepEqual(thinkingBudgetPayload(true, 1024.9), { thinking_budget_tokens: 1024 });
  assert.deepEqual(thinkingBudgetPayload(true, -100), {});
  assert.deepEqual(thinkingBudgetPayload(true, Number.NaN), {});
});

test('sends OpenRouter reasoning as enabled-by-default or as an explicit token cap', async () => {
  const { openRouterReasoningPayload } = await import('../../src/utils/reasoningBudget.ts');
  assert.deepEqual(openRouterReasoningPayload(true), { reasoning: { enabled: true } });
  assert.deepEqual(openRouterReasoningPayload(true, 1024), { reasoning: { max_tokens: 1024 } });
  assert.deepEqual(openRouterReasoningPayload(true, 1024.8), { reasoning: { max_tokens: 1024 } });
  assert.deepEqual(openRouterReasoningPayload(false), { reasoning: { enabled: false } });
});
