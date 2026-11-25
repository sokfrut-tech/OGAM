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

interface NativeAndroidStt {
  isAvailable(): Promise<boolean>;
  startListening(languageTag: string | null, preferOffline: boolean): Promise<boolean>;
  stopListening(): Promise<boolean>;
  cancel(): Promise<boolean>;
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
    const tag = mapLocaleToAndroidSpeechTag(opts.language);
    await native.startListening(tag, opts.preferOffline ?? true);
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
  ensureMicPermission,
  startListening,
  stopListening,
  cancel,
};
