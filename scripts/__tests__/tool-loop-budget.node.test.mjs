import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_MAX_TOOL_CALLS,
  MAX_MAX_TOOL_CALLS,
  MIN_MAX_TOOL_CALLS,
  TOOL_PROMPT_SAFETY_RESERVE_TOKENS,
  callsWithinToolBudget,
  finalResponseFromToolResults,
  normalizeMaxToolCalls,
  toolLimitFinalAnswerInstruction,
  toolPromptChars,
  toolResultCharBudget,
} from '../../src/utils/toolLoopBudget.ts';

test('normalizes missing, fractional and out-of-range tool limits', () => {
  assert.equal(DEFAULT_MAX_TOOL_CALLS, 5);
  assert.equal(normalizeMaxToolCalls(undefined), DEFAULT_MAX_TOOL_CALLS);
  assert.equal(normalizeMaxToolCalls(Number.NaN), DEFAULT_MAX_TOOL_CALLS);
  assert.equal(normalizeMaxToolCalls(3.9), 3);
  assert.equal(normalizeMaxToolCalls(0), MIN_MAX_TOOL_CALLS);
  assert.equal(normalizeMaxToolCalls(-20), MIN_MAX_TOOL_CALLS);
  assert.equal(normalizeMaxToolCalls(1000), MAX_MAX_TOOL_CALLS);
  assert.equal(normalizeMaxToolCalls(Number.POSITIVE_INFINITY), DEFAULT_MAX_TOOL_CALLS);
});

test('keeps only the calls remaining in the response budget', () => {
  const calls = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(callsWithinToolBudget(calls, 0, 3), ['a', 'b', 'c']);
  assert.deepEqual(callsWithinToolBudget(calls, 1, 3), ['a', 'b']);
  assert.deepEqual(callsWithinToolBudget(calls, 3, 3), []);
  assert.deepEqual(callsWithinToolBudget(calls, 10, 3), []);
  assert.deepEqual(callsWithinToolBudget([], 0, 3), []);
});

test('counts serialized message and tool schema characters', () => {
  const messages = [{ role: 'user', content: 'hi' }];
  const tools = [{ name: 'search', parameters: { query: 'string' } }];
  assert.equal(
    toolPromptChars(messages, tools),
    JSON.stringify(messages).length + JSON.stringify(tools).length,
  );
  assert.ok(toolPromptChars(messages, tools) > toolPromptChars(messages, []));
});

test('budgets tool output from the remaining context after prompt, reply and safety reserves', () => {
  const budget = toolResultCharBudget({
    contextLength: 4096,
    promptChars: 3000,
    replyReserveTokens: 1024,
  });
  const expected = (4096 - Math.ceil(3000 / 3) - 1024 - TOOL_PROMPT_SAFETY_RESERVE_TOKENS) * 3;
  assert.equal(budget, expected);
  assert.ok(budget > 0);
  assert.ok(budget <= 24_000);
});

test('never returns a negative budget and enforces the hard result cap', () => {
  assert.equal(toolResultCharBudget({
    contextLength: 512,
    promptChars: 50_000,
    replyReserveTokens: 1024,
  }), 0);

  assert.equal(toolResultCharBudget({
    contextLength: 100_000,
    promptChars: 0,
    replyReserveTokens: 0,
  }), 24_000);
});

test('handles invalid prompt and context accounting without throwing', () => {
  assert.equal(toolResultCharBudget({
    contextLength: Number.NaN,
    promptChars: Number.NaN,
    replyReserveTokens: Number.NaN,
  }), 0);
});

test('instructs the model to stop calling tools and report missing information honestly', () => {
  const instruction = toolLimitFinalAnswerInstruction(3);
  assert.match(instruction, /limit of 3 tool calls/);
  assert.match(instruction, /Do not call any more tools/);
  assert.match(instruction, /completed tool results/);
  assert.match(instruction, /do not invent results/);
});

test('combines the recovery instruction and non-empty completed results in order', () => {
  assert.equal(
    finalResponseFromToolResults('Answer from available data.', ['first result', '', 'third result']),
    'Answer from available data.\n\nCompleted tool result 1:\nfirst result\n\nCompleted tool result 2:\nthird result',
  );
  assert.equal(finalResponseFromToolResults('', []), '');
});
