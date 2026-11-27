/**
 * Voice turn-mode and timing settings shared across stores, types, and UI
 * (`@offgrid/speech` clean-room replacement for OGAM).
 */

export type VoiceTurnMode = 'tap' | 'silence' | 'handsfree';

export const DEFAULT_SILENCE_AFTER_SPEECH_MS = 1500;
export const DEFAULT_SPEAKER_DRAIN_MS = 400;
export const SPEECH_ONSET_LOOKBACK_MS = 350;

export const SILENCE_AFTER_SPEECH_CHOICES_MS = [1000, 1500, 2000, 3000] as const;
export const SPEAKER_DRAIN_CHOICES_MS = [200, 400, 600, 800] as const;

export const VOICE_TURN_LABELS: Readonly<
  Record<VoiceTurnMode, { readonly label: string; readonly description: string }>
> = {
  tap: {
    label: 'Tap',
    description: 'You start recording and tap again when you finish speaking.',
  },
  silence: {
    label: 'Auto-stop',
    description: 'End the spoken turn automatically after you stop talking.',
  },
  handsfree: {
    label: 'Hands-free',
    description: 'Listen continuously in voice mode; a turn begins when you speak.',
  },
};

export const VOICE_DELAY_LABELS = {
  silenceAfterSpeech: {
    label: 'Pause to end turn',
    description: 'How long of a quiet pause finishes your spoken turn.',
  },
  speakerDrain: {
    label: 'Speaker drain delay',
    description: 'Wait after playback finishes before reopening the microphone.',
  },
} as const;

export function secondsLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const seconds = ms / 1000;
  return Number.isInteger(seconds) ? `${seconds}s` : `${Number(seconds.toFixed(2))}s`;
}
