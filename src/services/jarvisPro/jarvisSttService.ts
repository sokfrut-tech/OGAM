import {
  DeviceEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  type EmitterSubscription,
} from 'react-native';

export interface JarvisSttListenOptions {
  language?: string;
  preferOffline?: boolean;
  onPartial?: (text: string) => void;
  onResult?: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}

export interface JarvisSttEngineInfo {
  available: boolean;
  servicePackage: string;
  isGoogleService: boolean;
}

interface NativeAndroidStt {
  isAvailable(): Promise<boolean>;
  getEngineInfo?(): Promise<JarvisSttEngineInfo>;
  startListening(languageTag: string | null, preferOffline: boolean): Promise<boolean>;
  stopListening(): Promise<boolean>;
  cancel(): Promise<boolean>;
}

const CJK_KANA_HANGUL_RE = /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;
const CYRILLIC_CHAR_RE = /[А-Яа-яЁё]/;

/**
 * Detect when an OEM Android recognizer ignores `ru-RU` and returns CJK or full English sentences.
 * Allows short technical Latin words (`OK`, `Wi-Fi`, `Qwen`) and any mixed Cyrillic string.
 */
export function isLikelyWrongLanguageForRussian(text: string, languageTag: string): boolean {
  if (!languageTag.trim().toLowerCase().startsWith('ru')) return false;
  const clean = text.trim();
  if (!clean || CYRILLIC_CHAR_RE.test(clean)) return false;
  if (CJK_KANA_HANGUL_RE.test(clean)) return true;
  const words = clean.split(/\s+/).filter(w => /[A-Za-z]/.test(w));
  const latinLetters = clean.match(/[A-Za-z]/g)?.length ?? 0;
  return words.length >= 2 && latinLetters >= 6;
}

function getNativeStt(): NativeAndroidStt | null {
  if (Platform.OS !== 'android') return null;
  const mod = NativeModules.JarvisAndroidSttModule as NativeAndroidStt | undefined;
  return mod && typeof mod.startListening === 'function' ? mod : null;
}

export function mapLocaleToAndroidSpeechTag(language?: string | null): string {
  const clean = language?.trim();
  if (!clean || clean === 'auto' || clean === 'ru') return 'ru-RU';
  if (clean === 'en') return 'en-US';
  if (clean.includes('-') || clean.includes('_')) return clean.replace('_', '-');
  return clean.length === 2 ? `${clean}-${clean.toUpperCase()}` : clean;
}

let activeSubscriptions: EmitterSubscription[] = [];

function clearSubscriptions(): void {
  for (const sub of activeSubscriptions) {
    try {
      sub.remove();
    } catch {
      // Ignore already detached listener.
    }
  }
  activeSubscriptions = [];
}

function isNativeModulePresent(): boolean {
  return getNativeStt() !== null;
}

async function isAvailable(): Promise<boolean> {
  const native = getNativeStt();
  if (!native) return false;
  try {
    return await native.isAvailable();
  } catch {
    return false;
  }
}

async function getEngineInfo(): Promise<JarvisSttEngineInfo> {
  const native = getNativeStt();
  if (!native || typeof native.getEngineInfo !== 'function') {
    return {
      available: native ? await isAvailable() : false,
      servicePackage: 'unknown',
      isGoogleService: false,
    };
  }
  try {
    return await native.getEngineInfo();
  } catch {
    return { available: false, servicePackage: 'unknown', isGoogleService: false };
  }
}

async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (granted) return true;
    const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function startListening(opts: JarvisSttListenOptions): Promise<boolean> {
  const native = getNativeStt();
  if (!native) {
    opts.onError?.('Системный голосовой ввод недоступен на этом устройстве.');
    opts.onEnd?.();
    return false;
  }

  const permitted = await ensureMicPermission();
  if (!permitted) {
    opts.onError?.('Нет разрешения на микрофон.');
    opts.onEnd?.();
    return false;
  }

  const tag = mapLocaleToAndroidSpeechTag(opts.language);
  clearSubscriptions();
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    clearSubscriptions();
    opts.onEnd?.();
  };

  if (typeof DeviceEventEmitter?.addListener === 'function') {
    activeSubscriptions.push(
      DeviceEventEmitter.addListener('JarvisSttPartial', (ev: { text?: string } | undefined) => {
        if (typeof ev?.text === 'string' && ev.text.trim()) {
          opts.onPartial?.(ev.text.trim());
        }
      }),
      DeviceEventEmitter.addListener('JarvisSttResult', (ev: { text?: string } | undefined) => {
        const text = typeof ev?.text === 'string' ? ev.text.trim() : '';
        settled = true;
        clearSubscriptions();
        if (text && isLikelyWrongLanguageForRussian(text, tag)) {
          const preview = text.slice(0, 48);
          opts.onError?.(
            `Системный распознаватель телефона вернул не русский текст («${preview}»). Скачайте офлайн-модель Whisper Small (RU) или Qwen3-ASR в разделе «Модели → Транскрибация».`,
          );
          opts.onEnd?.();
          return;
        }
        opts.onResult?.(text);
        opts.onEnd?.();
      }),
      DeviceEventEmitter.addListener('JarvisSttError', (ev: { message?: string } | undefined) => {
        const message = typeof ev?.message === 'string' && ev.message.trim()
          ? ev.message.trim()
          : 'Не удалось распознать речь.';
        settled = true;
        clearSubscriptions();
        opts.onError?.(message);
        opts.onEnd?.();
      }),
      DeviceEventEmitter.addListener('JarvisSttState', (ev: { state?: string } | undefined) => {
        if (ev?.state === 'ended' && !settled) {
          settle();
        }
      }),
    );
  }

  try {
    await native.startListening(tag, opts.preferOffline ?? false);
    return true;
  } catch (err) {
    clearSubscriptions();
    const message = err instanceof Error ? err.message : 'Не удалось запустить голосовой ввод.';
    opts.onError?.(message);
    opts.onEnd?.();
    return false;
  }
}

async function stopListening(): Promise<void> {
  const native = getNativeStt();
  if (!native) return;
  try {
    await native.stopListening();
  } catch {
    // Ignore stop errors if session already ended.
  }
}

async function cancel(): Promise<void> {
  clearSubscriptions();
  const native = getNativeStt();
  if (!native) return;
  try {
    await native.cancel();
  } catch {
    // Ignore cancel errors.
  }
}

export const jarvisSttService = {
  isNativeModulePresent,
  isAvailable,
  getEngineInfo,
  ensureMicPermission,
  startListening,
  stopListening,
  cancel,
};
