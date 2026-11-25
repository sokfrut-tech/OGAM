import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import { useChatStore } from '../../stores/chatStore';
import { useJarvisProStore } from '../../stores/jarvisProStore';

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

async function speak(text: string, messageId?: string): Promise<boolean> {
  const native = getNativeTts();
  const clean = stripMarkdownForSpeech(text);
  if (!native || !clean) {
    useJarvisProStore.getState().setTtsSpeakingMessageId(null);
    return false;
  }
  ensureStateListener();
  const { ttsRate, ttsVoiceId } = useJarvisProStore.getState();
  useJarvisProStore.getState().setTtsSpeakingMessageId(messageId ?? '__manual__');
  try {
    const ok = await native.speak(clean, 'ru-RU', ttsRate, ttsVoiceId);
    if (!ok) {
      useJarvisProStore.getState().setTtsSpeakingMessageId(null);
    }
    return ok;
  } catch {
    useJarvisProStore.getState().setTtsSpeakingMessageId(null);
    return false;
  }
}

async function stop(): Promise<void> {
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

function speakOnStreamEnd(conversationId: string): void {
  const state = useJarvisProStore.getState();
  if (!state.ttsAutoSpeak) return;
  const conv = useChatStore.getState().conversations.find(c => c.id === conversationId);
  const lastAssistant = [...(conv?.messages ?? [])]
    .reverse()
    .find(m => m.role === 'assistant' && !m.isSystemInfo && m.content.trim().length > 0);
  if (!lastAssistant) return;
  void speak(lastAssistant.content, lastAssistant.id);
}

export const jarvisTtsService = {
  canSpeak,
  listVoices,
  speak,
  stop,
  isSpeaking,
  speakOnStreamEnd,
};
