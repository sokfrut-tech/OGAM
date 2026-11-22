import { NativeModules, Platform } from 'react-native';

const en = require('./en.json') as Record<string, string>;
const ru = require('./ru.json') as Record<string, string>;

export type AppLocale = 'en' | 'ru';
export type TranslationKey = keyof typeof en;

function detectLocale(): AppLocale {
  const native = NativeModules as {
    SettingsManager?: { settings?: { AppleLocale?: string; AppleLanguages?: string[] } };
    I18nManager?: { localeIdentifier?: string };
    PlatformConstants?: { LocaleIdentifier?: string; localeIdentifier?: string };
  };
  const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
  const candidates = [
    intlLocale,
    ...(Platform.OS === 'ios' ? [
        native.SettingsManager?.settings?.AppleLocale,
        native.SettingsManager?.settings?.AppleLanguages?.[0],
        native.I18nManager?.localeIdentifier,
      ] : [
        native.I18nManager?.localeIdentifier,
        native.PlatformConstants?.LocaleIdentifier,
        native.PlatformConstants?.localeIdentifier,
      ]),
  ];
  const deviceLocale = candidates.find(value => typeof value === 'string' && value.length > 0) ?? 'en';
  return deviceLocale.replace('_', '-').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

/** The fork follows the device language and currently ships English + Russian. */
export const locale: AppLocale = detectLocale();

export function t(
  key: TranslationKey,
  values?: Record<string, string | number>,
): string {
  const dictionary = locale === 'ru' ? ru : en;
  let value = dictionary[key] ?? en[key] ?? String(key);
  if (values) {
    for (const [name, replacement] of Object.entries(values)) {
      value = value.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'g'), String(replacement));
    }
  }
  return value;
}
