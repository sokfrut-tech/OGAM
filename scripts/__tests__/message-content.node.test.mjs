import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  REASONING_DELIMITERS,
  TOOL_CALL_CLOSERS,
  TOOL_CALL_OPENERS,
  XML_TOOL_CALL_FUNCTION_MARKER,
  XML_TOOL_CALL_PARAMETER_MARKER,
  maxPartialTagSuffix,
  parseModelOutput,
  partialTagSuffix,
  prepareMessageForSpeech,
  stripControlTokens,
  stripStreamingControlTokens,
  templateEmitsReasoning,
  withoutReasoning,
} from '../../src/utils/messageContent.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

const GRAMMAR_TOKENS = [
  ...REASONING_DELIMITERS.flatMap((d) => [d.open, d.close]),
  ...TOOL_CALL_OPENERS,
  ...TOOL_CALL_CLOSERS,
  '<function=',
  '</function>',
  '<parameter=',
  '</parameter>',
  '<invoke',
  '<function_call>',
];
const MARKUP = new RegExp(
  GRAMMAR_TOKENS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
);

test('parseModelOutput satisfies the 9 anti-leak contract cases with zero markup in answer', () => {
  const toolBlock =
    '<tool_call>\n<function=search_kb>\n<parameter=query>\nAchilles\n</parameter>\n</function>\n</tool_call>';
  const cases = [
    ['inline <think>', '<think>reasoning</think>\nThe answer.', null],
    ['inline <think> + tool block', `<think>r</think>\n${toolBlock}`, null],
    ['separate channel + tool block in content', toolBlock, 'the reasoning'],
    ['Gemma channel', '<|channel>thought\nreasoning\n<channel|>The answer.', null],
    [
      'Gemma bare opener before tool call (empty thought)',
      '<|channel>thought<|tool_call>call:calculator{expression:300 * 591}',
      'the reasoning',
    ],
    [
      'Qwen channel',
      '<|channel|>analysis<|message|>reasoning<|channel|>final<|message|>The answer.',
      null,
    ],
    ['gemma tool token', 'Sure. <|tool_call>{"name":"x"}<tool_call|>', null],
    ['answer only', 'Just a plain answer.', null],
    ['reasoning only (no answer)', '<think>only reasoning, no answer</think>', null],
  ];

  for (const [label, content, reasoning] of cases) {
    const out = parseModelOutput(content, reasoning);
    assert.equal(MARKUP.test(out.answer), false, `${label}: answer leaked markup: ${out.answer}`);
  }

  const reasoningOnly = parseModelOutput('<think>abc</think>', null);
  assert.ok(reasoningOnly.reasoning?.includes('abc'));
  assert.equal(reasoningOnly.answer, '');
});

test('labelled <think> block takes precedence over stray reasoning channel', () => {
  const out = parseModelOutput(
    '<think>__LABEL:Enhanced prompt__\nA cinematic lighthouse.</think>',
    'stray live channel thinking',
  );
  assert.equal(out.reasoningLabel, 'Enhanced prompt');
  assert.equal(out.reasoning, 'A cinematic lighthouse.');
  assert.equal(out.answer, '');
  assert.equal(out.isReasoningComplete, true);
});

test('withoutReasoning, speech prep, streaming token filtering, and template checks work as expected', () => {
  assert.equal(withoutReasoning('<think>hidden</think>\nVisible answer.'), 'Visible answer.');
  assert.equal(withoutReasoning('<think>partial thought</think>'), 'partial thought');
  assert.equal(withoutReasoning('Plain reply'), 'Plain reply');

  assert.equal(
    prepareMessageForSpeech('<think>reason</think>\n## Title\nUse `code` and **bold** [link](https://example.com).'),
    'Title\nUse code and bold link.',
  );

  assert.equal(
    stripStreamingControlTokens('<think>keep</think><|im_start|>assistant\nHi<tool_call>{"a":1}</tool_call><|im_end|>'),
    '<think>keep</think>Hi',
  );
  assert.equal(stripControlTokens('<|im_start|>assistant\nHello<|im_end|>'), 'Hello');

  assert.equal(partialTagSuffix('hello <thi', '<think>'), 4);
  assert.equal(maxPartialTagSuffix('end <function=foo', ['<think>', '<function=']), 0);
  assert.equal(maxPartialTagSuffix('end <fun', ['<think>', '<function=']), 4);

  assert.equal(XML_TOOL_CALL_FUNCTION_MARKER, '<function=(\\w+)>');
  assert.equal(XML_TOOL_CALL_PARAMETER_MARKER, '<parameter=(\\w+)>');
  assert.equal(templateEmitsReasoning('{{ if enable_thinking }}'), true);
  assert.equal(templateEmitsReasoning('plain template'), false);
});

test('src/utils/messageContent.ts has no @offgrid/sync imports', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src/utils/messageContent.ts'), 'utf8');
  assert.equal(src.includes('@offgrid/sync'), false);
});
