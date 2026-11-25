import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  preprocessChatMarkdown,
  safeChatExternalUrl,
} from '../../src/utils/chatMarkdown.ts';
import {
  PROMPT_ENHANCEMENT_REASONING_LABEL,
  PROMPT_ENHANCEMENT_STATUS,
  chatListPreviewLine,
  isRuntimeOnlyMessage,
  readGatewayComputerId,
} from '../../src/utils/chatSyncPrimitives.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

test('preprocessChatMarkdown escapes digit*digit chains without touching markdown emphasis', () => {
  assert.equal(preprocessChatMarkdown('5*5'), String.raw`5\*5`);
  assert.equal(preprocessChatMarkdown('5*5*5*5*6*7'), String.raw`5\*5\*5\*5\*6\*7`);
  assert.equal(preprocessChatMarkdown('*italic* and **bold**'), '*italic* and **bold**');
  assert.equal(
    preprocessChatMarkdown('The result of 3*4 is *twelve*'),
    String.raw`The result of 3\*4 is *twelve*`,
  );
});

test('safeChatExternalUrl permits only clean http/https URLs and rejects unsafe schemes or control chars', () => {
  assert.equal(safeChatExternalUrl('https://example.com/docs'), 'https://example.com/docs');
  assert.equal(safeChatExternalUrl('  https://github.com/off-grid-ai  '), 'https://github.com/off-grid-ai');
  assert.equal(safeChatExternalUrl('http://localhost:8080/health'), 'http://localhost:8080/health');

  assert.equal(safeChatExternalUrl('ftp://example.com/file'), null);
  assert.equal(safeChatExternalUrl('javascript:alert(1)'), null);
  assert.equal(safeChatExternalUrl('data:text/html,hi'), null);
  assert.equal(safeChatExternalUrl('file:///etc/passwd'), null);
  assert.equal(safeChatExternalUrl('https://example.com/a\nb'), null);
  assert.equal(safeChatExternalUrl('   '), null);
});

test('chatListPreviewLine formats single-line previews, strips markup, keeps LaTeX intact, and truncates long lines', () => {
  assert.equal(chatListPreviewLine('user', '$37 \\times 43 = 1591$'), 'You: $37 \\times 43 = 1591$');
  assert.equal(
    chatListPreviewLine('assistant', '<think>plan</think>\n```ts\nconst a = 1;\n```\nDone.'),
    'const a = 1; Done.',
  );
  assert.equal(chatListPreviewLine('assistant', '   '), '');

  const long = chatListPreviewLine('assistant', 'a '.repeat(80), 40);
  assert.ok(long.length <= 40);
  assert.ok(long.endsWith('…'));
});

test('readGatewayComputerId extracts non-empty Sync id from desktop /health payload', () => {
  assert.equal(readGatewayComputerId({ computer_id: 'dev-1' }), 'dev-1');
  assert.equal(readGatewayComputerId({ computerId: '  dev-2  ' }), 'dev-2');
  assert.equal(readGatewayComputerId({ computer_id: '   ' }), undefined);
  assert.equal(readGatewayComputerId(null), undefined);
  assert.equal(readGatewayComputerId('not-an-object'), undefined);
});

test('isRuntimeOnlyMessage and prompt enhancement constants match enhancer/sync boundaries', () => {
  assert.equal(PROMPT_ENHANCEMENT_REASONING_LABEL, 'Enhanced prompt');
  assert.equal(PROMPT_ENHANCEMENT_STATUS, 'Enhancing your prompt...');

  assert.equal(isRuntimeOnlyMessage({ role: 'assistant', content: PROMPT_ENHANCEMENT_STATUS }), true);
  assert.equal(isRuntimeOnlyMessage({ role: 'assistant', content: 'Enhancing prompt with AI...' }), true);
  assert.equal(isRuntimeOnlyMessage({ role: 'assistant', content: 'Model loaded: Qwen3.5 4B (1.2s)' }), true);
  assert.equal(isRuntimeOnlyMessage({ role: 'assistant', content: 'Context compacted' }), true);
  assert.equal(isRuntimeOnlyMessage({ role: 'assistant', content: 'Any text', notice: true }), true);
  assert.equal(
    isRuntimeOnlyMessage({ role: 'assistant', content: 'A cinematic fox in a snowstorm.' }),
    false,
  );
});

test('markdown and chat sync primitive consumers no longer import @offgrid/sync', () => {
  const files = [
    'src/components/MarkdownText.tsx',
    'src/utils/visibleMessages.ts',
    'src/services/imagePromptEnhancement.ts',
    'src/services/imageGenerationHelpers.ts',
    'src/services/networkDiscovery.ts',
  ];
  for (const rel of files) {
    const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    assert.equal(content.includes('@offgrid/sync'), false, `${rel} still references @offgrid/sync`);
  }
});
