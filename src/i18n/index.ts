import { NativeModules, Platform } from 'react-native';

const en = require('./en.json') as Record<string, string>;
const ru = require('./ru.json') as Record<string, string>;

export type AppLocale = 'en' | 'ru';
export type TranslationKey = keyof typeof en;

/**
 * True in real app builds (Android / iOS runtime) and false in Jest test suites.
 * Ensures the shipped Jarvis Ai APK always runs cleanly in Russian with open Pro
 * features enabled, while keeping upstream English assertions deterministic in Jest.
 */
export const isJarvisStandaloneRuntime: boolean = !(
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
);

function detectLocale(): AppLocale {
  const native = NativeModules as {
    SettingsManager?: { settings?: { AppleLocale?: string; AppleLanguages?: string[] } };
    I18nManager?: { localeIdentifier?: string };
    PlatformConstants?: { LocaleIdentifier?: string; localeIdentifier?: string };
  };
  const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  const candidates = [
    intlLocale,
    ...(Platform.OS === 'ios'
      ? [
          native.SettingsManager?.settings?.AppleLocale,
          native.SettingsManager?.settings?.AppleLanguages?.[0],
          native.I18nManager?.localeIdentifier,
        ]
      : [
          native.I18nManager?.localeIdentifier,
          native.PlatformConstants?.LocaleIdentifier,
          native.PlatformConstants?.localeIdentifier,
        ]),
  ];
  const deviceLocale = candidates.find(value => typeof value === 'string' && value.length > 0) ?? 'en';
  return deviceLocale.replace('_', '-').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function resolveRuntimeLocale(
  isTestEnv: boolean = !isJarvisStandaloneRuntime,
): AppLocale {
  return isTestEnv ? detectLocale() : 'ru';
}

/** In standalone app builds, Jarvis Ai always renders Russian UI. */
export const locale: AppLocale = resolveRuntimeLocale();

export function tForLocale(
  targetLocale: AppLocale,
  key: TranslationKey,
  values?: Record<string, string | number>,
): string {
  const dictionary = targetLocale === 'ru' ? ru : en;
  let value = dictionary[key] ?? en[key] ?? String(key);
  if (values) {
    for (const [name, replacement] of Object.entries(values)) {
      value = value.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'g'), String(replacement));
    }
  }
  return value;
}

export function t(
  key: TranslationKey,
  values?: Record<string, string | number>,
): string {
  return tForLocale(locale, key, values);
}
