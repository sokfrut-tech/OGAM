const en = require('./en.json') as Record<string, string>;
const ru = require('./ru.json') as Record<string, string>;

export type AppLocale = 'en' | 'ru';
export type TranslationKey = keyof typeof en;

/** Jarvis is a Russian-first assistant build; the UI must not inherit an English
 * Hermes default locale on Android or the user's unrelated system language. */
export const locale: AppLocale = 'ru';

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
