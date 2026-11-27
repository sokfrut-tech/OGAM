import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import { useChatStore } from '../../stores/chatStore';
import { useJarvisProStore } from '../../stores/jarvisProStore';
import { useUiModeStore } from '../../stores/uiModeStore';

export interface JarvisTtsVoice {
  id: string;
  name: string;
  locale: string;
  networkRequired: boolean;
}

interface NativeAndroidTts {
  isAvailable(): Promise<boolean>;
  speak(
    text: string,
    languageTag: string | null,
    rate: number,
    voiceId: string | null,
  ): Promise<boolean>;
  speakQueued?(
    text: string,
    languageTag: string | null,
    rate: number,
    voiceId: string | null,
  ): Promise<boolean>;
  stop(): Promise<boolean>;
  isSpeaking(): Promise<boolean>;
  getVoices(): Promise<JarvisTtsVoice[]>;
}

function getNativeTts(): NativeAndroidTts | null {
  if (Platform.OS !== 'android') return null;
  const mod = NativeModules.JarvisAndroidTtsModule as NativeAndroidTts | undefined;
  return mod && typeof mod.speak === 'function' ? mod : null;
}

export function stripMarkdownForSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]+/g, '')
    .replace(/[>#|]+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

let listenerBound = false;
let streamedCharOffset = 0;

function resetStreamingSpeech(): void {
  streamedCharOffset = 0;
}

function ensureStateListener(): void {
  if (listenerBound || typeof DeviceEventEmitter?.addListener !== 'function') return;
  listenerBound = true;
  DeviceEventEmitter.addListener('JarvisTtsState', (event: { state?: string } | undefined) => {
    if (event?.state === 'done' || event?.state === 'error') {
      useJarvisProStore.getState().setTtsSpeakingMessageId(null);
    }
  });
}

async function canSpeak(): Promise<boolean> {
  const native = getNativeTts();
  if (!native) return false;
  try {
    return await native.isAvailable();
  } catch {
    return false;
  }
}

async function listVoices(): Promise<JarvisTtsVoice[]> {
  const native = getNativeTts();
  if (!native) return [];
  try {
    const list = await native.getVoices();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function speakWithMode(
  text: string,
  messageId: string | undefined,
  queued: boolean,
): Promise<boolean> {
  const native = getNativeTts();
  const clean = stripMarkdownForSpeech(text);
  if (!native || !clean) {
    if (!queued) {
      useJarvisProStore.getState().setTtsSpeakingMessageId(null);
    }
    return false;
  }
  ensureStateListener();
  const { ttsRate, ttsVoiceId } = useJarvisProStore.getState();
  useJarvisProStore.getState().setTtsSpeakingMessageId(messageId ?? '__manual__');
  try {
    const ok =
      queued && typeof native.speakQueued === 'function'
        ? await native.speakQueued(clean, 'ru-RU', ttsRate, ttsVoiceId)
        : await native.speak(clean, 'ru-RU', ttsRate, ttsVoiceId);
    if (!ok && !queued) {
      useJarvisProStore.getState().setTtsSpeakingMessageId(null);
    }
    return ok;
  } catch {
    useJarvisProStore.getState().setTtsSpeakingMessageId(null);
    return false;
  }
}

async function speak(text: string, messageId?: string): Promise<boolean> {
  streamedCharOffset = 0;
  return speakWithMode(text, messageId, false);
}

async function speakQueued(text: string, messageId?: string): Promise<boolean> {
  return speakWithMode(text, messageId, true);
}

async function stop(): Promise<void> {
  streamedCharOffset = 0;
  useJarvisProStore.getState().setTtsSpeakingMessageId(null);
  const native = getNativeTts();
  if (!native) return;
  try {
    await native.stop();
  } catch {
    // Best-effort stop.
  }
}

function isSpeaking(): boolean {
  return useJarvisProStore.getState().ttsSpeakingMessageId !== null;
}

function shouldAutoSpeakNow(): boolean {
  return (
    useUiModeStore.getState().interfaceMode === 'audio' ||
    useJarvisProStore.getState().ttsAutoSpeak
  );
}

function findSentenceBoundaryEnd(text: string): number {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') return i + 1;
    if (ch === '.' || ch === '!' || ch === '?' || ch === '…') {
      const next = text[i + 1];
      if (next !== undefined && /\s/.test(next)) {
        return i + 1;
      }
    }
  }
  return -1;
}

function stripThinkingBlocks(raw: string): string {
  let out = raw;
  for (;;) {
    const start = out.toLowerCase().indexOf('<think>');
    if (start < 0) break;
    const end = out.toLowerCase().indexOf('</think>', start + 7);
    if (end < 0) {
      out = out.slice(0, start);
      break;
    }
    out = out.slice(0, start) + out.slice(end + 8);
  }
  return out.trimStart();
}

function onStreamingToken(fullContent: string): void {
  if (!shouldAutoSpeakNow() || !getNativeTts()) return;
  if (fullContent.length < streamedCharOffset) {
    streamedCharOffset = 0;
  }
  const pending = fullContent.slice(streamedCharOffset);
  if (pending.length < 18) return;
  const boundaryEnd = findSentenceBoundaryEnd(pending);
  if (boundaryEnd <= 0) return;
  const rawChunk = pending.slice(0, boundaryEnd);
  const speakable = stripMarkdownForSpeech(rawChunk);
  streamedCharOffset += boundaryEnd;
  if (speakable.length >= 4) {
    void speakQueued(speakable, '__stream__');
  }
}

function speakOnStreamEnd(conversationId: string): void {
  const alreadyStreamed = streamedCharOffset;
  streamedCharOffset = 0;
  if (!shouldAutoSpeakNow()) return;
  const conv = useChatStore.getState().conversations.find(c => c.id === conversationId);
  const lastAssistant = [...(conv?.messages ?? [])]
    .reverse()
    .find(m => m.role === 'assistant' && !m.isSystemInfo && m.content.trim().length > 0);
  if (!lastAssistant) return;
  const visibleContent = stripThinkingBlocks(lastAssistant.content);
  const tail = alreadyStreamed > 0 && alreadyStreamed <= visibleContent.length
    ? visibleContent.slice(alreadyStreamed)
    : visibleContent;
  if (!stripMarkdownForSpeech(tail)) return;
  if (alreadyStreamed > 0) {
    void speakQueued(tail, lastAssistant.id);
  } else {
    void speak(tail, lastAssistant.id);
  }
}

export const jarvisTtsService = {
  canSpeak,
  listVoices,
  speak,
  speakQueued,
  stop,
  isSpeaking,
  onStreamingToken,
  resetStreamingSpeech,
  speakOnStreamEnd,
};
