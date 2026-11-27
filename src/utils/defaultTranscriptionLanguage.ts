import type { AppLocale } from '../i18n';

/**
 * Initial speech-to-text language for a fresh profile.
 * Keep this separate from persisted preferences: once a person selects a
 * transcription language, the store must preserve that choice across launches.
 */
export function defaultTranscriptionLanguage(appLocale: AppLocale | string): 'ru' | 'en' {
  return appLocale === 'ru' ? 'ru' : 'en';
}
