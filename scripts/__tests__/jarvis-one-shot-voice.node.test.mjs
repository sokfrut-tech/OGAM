import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('Android system invocation is one-shot and auto-send is isolated from normal dictation', () => {
  const screen = read('src/screens/ChatScreen/index.tsx');
  const area = read('src/screens/ChatScreen/ChatMessageArea.tsx');
  const input = read('src/components/ChatInput/index.tsx');
  const handlers = read('src/components/ChatInput/voiceNoteSend.ts');
  const voice = read('src/components/ChatInput/Voice.ts');
  assert.ok(screen.includes('setAssistantVoiceInputPending(true)'));
  assert.ok(screen.includes('assistantVoiceInput={assistantVoiceInputPending}'));
  assert.ok(area.includes('assistantVoiceInput={assistantVoiceInput}'));
  assert.ok(input.includes('autoSendVoiceInput: assistantVoiceInput'));
  assert.ok(handlers.includes('deps.autoSendVoiceInput && isStandalone()'));
  assert.ok(handlers.includes('deps.appendTranscript(text)'));
  assert.ok(voice.includes('onCaptureSettled: hasTranscript'));
});

test('Whisper reports empty and non-empty completion without changing ordinary capture-end events', () => {
  const whisper = read('src/hooks/useWhisperTranscription.ts');
  assert.ok(whisper.includes('onCaptureSettled?: (hasTranscript: boolean) => void'));
  assert.ok(whisper.includes('onCaptureSettledRef.current?.(Boolean(result.text && cleanTranscription(result.text)))'));
  assert.ok(whisper.includes('onCaptureEndedRef.current?.()'));
  assert.ok(whisper.includes('onCaptureStartFailedRef.current?.()'));
  const voice = read('src/components/ChatInput/Voice.ts');
  assert.ok(voice.includes('onCaptureStartFailed: settleFailedCaptureStart'));
  assert.ok(voice.includes("voiceSession.dispatch('turnCaptured')"));
  assert.ok(voice.includes("voiceSession.dispatch('dictationFinished')"));
});
