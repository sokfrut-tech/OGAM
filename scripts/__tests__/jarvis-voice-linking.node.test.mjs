import test from 'node:test';
import assert from 'node:assert/strict';
import { JARVIS_VOICE_ASSISTANT_URL, jarvisVoiceLinking } from '../../src/navigation/jarvisVoiceLinking.ts';

test('system assistant URI targets the existing Chat screen and requests a single voice start', () => {
  const url = new URL(JARVIS_VOICE_ASSISTANT_URL);
  assert.equal(url.protocol, 'offgrid:');
  assert.equal(url.host, 'assistant');
  assert.equal(url.pathname, '/voice');
  assert.equal(url.searchParams.get('startVoice'), '1');
  assert.equal(jarvisVoiceLinking.config.screens.Chat.path, 'assistant/voice');
  assert.equal(jarvisVoiceLinking.config.screens.Chat.parse.startVoice('1'), true);
  assert.equal(jarvisVoiceLinking.config.screens.Chat.parse.startVoice('0'), false);
});
