import test from 'node:test';
import assert from 'node:assert/strict';

import {
  boundToolResult,
  MAX_TOOL_RESULT_CHARS,
} from '../../src/utils/toolResultBudget.ts';

test('uses a stable 24k-character default budget', () => {
  assert.equal(MAX_TOOL_RESULT_CHARS, 24_000);
});

test('leaves content at or below the budget byte-for-byte unchanged', () => {
  const content = 'B'.repeat(MAX_TOOL_RESULT_CHARS);
  assert.equal(boundToolResult('web_search', content), content);
  assert.equal(boundToolResult('web_search', 'small', 1000), 'small');
});

test('keeps the head and reports the original character count when truncating', () => {
  const content = 'A'.repeat(29_000);
  const result = boundToolResult('read_wiki_contents', content);

  assert.ok(result.startsWith('A'.repeat(100)));
  assert.ok(result.startsWith(content.slice(0, MAX_TOOL_RESULT_CHARS)));
  assert.match(result, /result truncated/);
  assert.match(result, /showing the first 24000 of 29000 characters/);
  assert.ok(result.length < MAX_TOOL_RESULT_CHARS + 500);
  assert.ok(result.length < content.length);
});

test('applies the active tool-loop budget supplied by the caller', () => {
  const content = 'C'.repeat(5000);
  const result = boundToolResult('small-window', content, 1000);

  assert.ok(result.startsWith(content.slice(0, 1000)));
  assert.match(result, /showing the first 1000 of 5000 characters/);
  assert.ok(result.length < content.length);
});

test('normalizes negative and non-finite budgets safely', () => {
  const shortContent = 'oversized';
  assert.match(boundToolResult('tool', shortContent, -1), /showing the first 0 of 9 characters/);

  const longContent = 'D'.repeat(30_000);
  assert.match(
    boundToolResult('tool', longContent, Number.NaN),
    /showing the first 24000 of 30000 characters/,
  );
});
