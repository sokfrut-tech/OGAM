/**
 * OGAM-owned language catalogs for local speech-to-text engines.
 *
 * Replaces the `@offgrid/speech` `transcriptionLanguages` helper while preserving
 * the exact contracts expected by `TranscriptionLanguageSelect` and `QwenAsrEngine`:
 * - English-only Whisper models (`*.en`) expose only English (`[{ code: 'en', label: 'English' }]`).
 * - Qwen3-ASR exposes `auto` plus its 30 named languages whose English labels match
 *   the `language <Label><asr_text>` assistant prefill in `QwenAsrEngine`.
 * - Multilingual Whisper exposes `auto` plus standard Whisper languages (and excludes
 *   Qwen3-ASR-specific codes such as `'fil'` and `'yue'`).
 */

export type TranscriptionEngine = 'whisper' | 'qwen3-asr';

export interface TranscriptionLanguage {
  readonly code: string;
  readonly label: string;
}

const ENGLISH_ONLY_WHISPER_ID_RE = /\.en(?:$|[._-])/i;

const WHISPER_ENGLISH_ONLY: readonly TranscriptionLanguage[] = Object.freeze([
  Object.freeze({ code: 'en', label: 'English' }),
]);

/**
 * Qwen3-ASR's supported languages paired with the English names written before
 * `<asr_text>` in the model prompt/response (`language Russian<asr_text>`, etc.).
 */
const QWEN_ASR_LANGUAGES: readonly TranscriptionLanguage[] = Object.freeze([
  Object.freeze({ code: 'auto', label: 'Auto-detect' }),
  Object.freeze({ code: 'en', label: 'English' }),
  Object.freeze({ code: 'zh', label: 'Chinese' }),
  Object.freeze({ code: 'yue', label: 'Cantonese' }),
  Object.freeze({ code: 'ar', label: 'Arabic' }),
  Object.freeze({ code: 'de', label: 'German' }),
  Object.freeze({ code: 'fr', label: 'French' }),
  Object.freeze({ code: 'es', label: 'Spanish' }),
  Object.freeze({ code: 'pt', label: 'Portuguese' }),
  Object.freeze({ code: 'id', label: 'Indonesian' }),
  Object.freeze({ code: 'it', label: 'Italian' }),
  Object.freeze({ code: 'ko', label: 'Korean' }),
  Object.freeze({ code: 'ru', label: 'Russian' }),
  Object.freeze({ code: 'th', label: 'Thai' }),
  Object.freeze({ code: 'vi', label: 'Vietnamese' }),
  Object.freeze({ code: 'ja', label: 'Japanese' }),
  Object.freeze({ code: 'tr', label: 'Turkish' }),
  Object.freeze({ code: 'hi', label: 'Hindi' }),
  Object.freeze({ code: 'ms', label: 'Malay' }),
  Object.freeze({ code: 'nl', label: 'Dutch' }),
  Object.freeze({ code: 'sv', label: 'Swedish' }),
  Object.freeze({ code: 'da', label: 'Danish' }),
  Object.freeze({ code: 'fi', label: 'Finnish' }),
  Object.freeze({ code: 'pl', label: 'Polish' }),
  Object.freeze({ code: 'cs', label: 'Czech' }),
  Object.freeze({ code: 'fil', label: 'Filipino' }),
  Object.freeze({ code: 'fa', label: 'Persian' }),
  Object.freeze({ code: 'el', label: 'Greek' }),
  Object.freeze({ code: 'ro', label: 'Romanian' }),
  Object.freeze({ code: 'hu', label: 'Hungarian' }),
  Object.freeze({ code: 'mk', label: 'Macedonian' }),
]);

/**
 * Multilingual Whisper ISO-639-1 language choices (`'fil'` and `'yue'` are
 * intentionally excluded because tests treat them as Qwen3-ASR-only options).
 */
const WHISPER_MULTILINGUAL: readonly TranscriptionLanguage[] = Object.freeze([
  Object.freeze({ code: 'auto', label: 'Auto-detect' }),
  Object.freeze({ code: 'en', label: 'English' }),
  Object.freeze({ code: 'ru', label: 'Russian' }),
  Object.freeze({ code: 'fr', label: 'French' }),
  Object.freeze({ code: 'de', label: 'German' }),
  Object.freeze({ code: 'es', label: 'Spanish' }),
  Object.freeze({ code: 'it', label: 'Italian' }),
  Object.freeze({ code: 'pt', label: 'Portuguese' }),
  Object.freeze({ code: 'nl', label: 'Dutch' }),
  Object.freeze({ code: 'pl', label: 'Polish' }),
  Object.freeze({ code: 'tr', label: 'Turkish' }),
  Object.freeze({ code: 'uk', label: 'Ukrainian' }),
  Object.freeze({ code: 'ar', label: 'Arabic' }),
  Object.freeze({ code: 'hi', label: 'Hindi' }),
  Object.freeze({ code: 'zh', label: 'Chinese' }),
  Object.freeze({ code: 'ja', label: 'Japanese' }),
  Object.freeze({ code: 'ko', label: 'Korean' }),
  Object.freeze({ code: 'id', label: 'Indonesian' }),
  Object.freeze({ code: 'vi', label: 'Vietnamese' }),
  Object.freeze({ code: 'th', label: 'Thai' }),
  Object.freeze({ code: 'sv', label: 'Swedish' }),
  Object.freeze({ code: 'da', label: 'Danish' }),
  Object.freeze({ code: 'fi', label: 'Finnish' }),
  Object.freeze({ code: 'no', label: 'Norwegian' }),
  Object.freeze({ code: 'cs', label: 'Czech' }),
  Object.freeze({ code: 'ro', label: 'Romanian' }),
  Object.freeze({ code: 'hu', label: 'Hungarian' }),
  Object.freeze({ code: 'el', label: 'Greek' }),
  Object.freeze({ code: 'fa', label: 'Persian' }),
  Object.freeze({ code: 'he', label: 'Hebrew' }),
  Object.freeze({ code: 'ms', label: 'Malay' }),
  Object.freeze({ code: 'bg', label: 'Bulgarian' }),
  Object.freeze({ code: 'hr', label: 'Croatian' }),
  Object.freeze({ code: 'sk', label: 'Slovak' }),
  Object.freeze({ code: 'sl', label: 'Slovenian' }),
  Object.freeze({ code: 'sr', label: 'Serbian' }),
  Object.freeze({ code: 'ca', label: 'Catalan' }),
  Object.freeze({ code: 'bn', label: 'Bengali' }),
  Object.freeze({ code: 'ur', label: 'Urdu' }),
  Object.freeze({ code: 'ta', label: 'Tamil' }),
  Object.freeze({ code: 'sw', label: 'Swahili' }),
  Object.freeze({ code: 'kk', label: 'Kazakh' }),
  Object.freeze({ code: 'tl', label: 'Tagalog' }),
]);

/** Returns true when `modelId` identifies an English-only Whisper checkpoint (`*.en`). */
export function isEnglishOnlyWhisperModel(modelId?: string | null): boolean {
  return Boolean(modelId && ENGLISH_ONLY_WHISPER_ID_RE.test(modelId.trim()));
}

/** Returns selectable transcription language entries for `engine` and optional `modelId`. */
export function transcriptionLanguages(
  engine: TranscriptionEngine,
  modelId?: string | null,
): readonly TranscriptionLanguage[] {
  if (engine === 'qwen3-asr') {
    return QWEN_ASR_LANGUAGES;
  }
  if (isEnglishOnlyWhisperModel(modelId)) {
    return WHISPER_ENGLISH_ONLY;
  }
  return WHISPER_MULTILINGUAL;
}
