/**
 * OGAM-owned video generation intent detector.
 *
 * Replaces `@offgrid/models` `isVideoRequest` while preserving every positive and negative
 * phrasing boundary verified by `__tests__/pro/video/videoIntentInChat.rendered.test.tsx`.
 */

const NON_GENERATION_PREFIX =
  /^\s*(?:how\s+(?:do|to|does|did|is|are|can\s+(?:i|one|we|people))|what(?:'s|\s+is|\s+are|\s+was)|why\s+|explain\b|describe\b|summarize\b|summarise\b|transcribe\b|review\b|compare\b|edit\b|trim\b|crop\b|cut\b|compress\b|convert\b|i\s+(?:made|recorded|shot|filmed|took|watched|saw|have|had)\b|we\s+(?:made|recorded|shot)\b)/i;

const RU_NON_GENERATION_PREFIX =
  /^\s*(?:как\s+(?:сделать|создать|снять|генерируют|монтировать)|что\s+такое|почему\s+|объясни(?:те)?|опиши(?:те)?|перескажи|смонтируй|обрежь|сожми|конвертируй|я\s+(?:снял|записал|посмотрел|видел)|мы\s+(?:сняли|записали))(?=$|[\s,.:;!?])/iu;

const EXPLICIT_GENERATION_VERB_PATTERN =
  /\b(?:create|generate|make|render|produce|synthesize|craft|shoot)\b(?:\s+(?:a|an|me|us|the|this|my|some|short|quick|brief|looping|cinematic|cute|cool|\d+s?)){0,5}\s*(?:video|clip|animation|movie|film|reel|gif|timelapse)\b/i;

const RU_EXPLICIT_VIDEO_PATTERN =
  /(?:^|[\s,.:;!?()"'«»-])(?:создай|создать|сгенерируй|сгенерировать|сделай|сделать|отрендери|сними|снять|собери)(?:\s+(?:мне|нам|пожалуйста|коротк\S*|быстр\S*|красивое?|кинематографич\S*))*\s+(?:видео|ролик|клип|анимаци\S*|фильм|гифк\S*|таймлапс)(?=$|[\s,.:;!?()"'«»-])/iu;

const ANIMATE_COMMAND_PATTERN =
  /(?:^|\b(?:please|can\s+you|could\s+you|would\s+you)\s+)animate\s+(?:a|an|the|this|that|my|some)\b/i;

const RU_ANIMATE_COMMAND_PATTERN =
  /^\s*(?:(?:пожалуйста|можешь|джарвис|jarvis)[\s,]+)*(?:анимируй|оживи)\s+\S+/iu;

const NOUN_PROMPT_PATTERN =
  /^\s*(?:please\s+)?(?:a|an)\s+(?:short\s+|brief\s+|cinematic\s+|looping\s+|cute\s+)?(?:video|clip|animation|timelapse)\s+(?:of|about|showing|with|featuring)\b/i;

const RU_NOUN_VIDEO_PATTERN =
  /^\s*(?:коротк\S*\s+|красивое?\s+|кинематографич\S*\s+)?(?:видео|ролик|клип|анимаци\S*|таймлапс)\s+(?:про|о|с|где|из)\s+\S+/iu;

/**
 * Return `true` only when the user is actively asking to generate or animate a video clip,
 * rejecting questions, summaries, editing queries, and past-tense mentions.
 */
export function isVideoRequest(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (NON_GENERATION_PREFIX.test(trimmed) || RU_NON_GENERATION_PREFIX.test(trimmed)) return false;
  return (
    EXPLICIT_GENERATION_VERB_PATTERN.test(trimmed) ||
    RU_EXPLICIT_VIDEO_PATTERN.test(trimmed) ||
    ANIMATE_COMMAND_PATTERN.test(trimmed) ||
    RU_ANIMATE_COMMAND_PATTERN.test(trimmed) ||
    NOUN_PROMPT_PATTERN.test(trimmed) ||
    RU_NOUN_VIDEO_PATTERN.test(trimmed)
  );
}
