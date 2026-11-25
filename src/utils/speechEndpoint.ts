/**
 * Adaptive room-noise speech endpoint detector restored from MIT repository history
 * (`aaf68870:src/services/speechEndpoint.ts`) and extended to support the
 * `useSilenceEndpoint` consumer contract (configurable `silenceAfterSpeechMs`,
 * `handsFree` mode, injected `log` callback, and `quietTailSeconds()`).
 */

/** Default quiet pause after speech that ends a turn, in ms. */
const DEFAULT_SILENCE_AFTER_SPEECH_MS = 1_500;

/**
 * How long to wait when nothing has been said at all in push-to-start `silence` mode.
 */
const SILENCE_BEFORE_SPEECH_MS = 8_000;

/**
 * How far above the adapting noise floor counts as speech.
 */
const SPEECH_OVER_FLOOR = 3;
const SPEECH_FLOOR_MARGIN = 0.006;

/** Floor follows quiet quickly and loud slowly so long speech does not drag the threshold up. */
const FLOOR_FALL = 0.25;
const FLOOR_RISE = 0.02;

/** Periodic re-check interval so turns still end if audio buffer delivery stalls. */
const CHECK_EVERY_MS = 250;

export interface SpeechEndpointReading {
  /** Whether this buffer sounded like speech. */
  speech: boolean;
  /** The adapting noise floor, exposed so a decision can be explained. */
  floor: number;
}

export interface SpeechEndpointOptions {
  /** Hands-free keeps waiting indefinitely until speech starts, then ends on silence. */
  handsFree?: boolean;
  /** Quiet pause after speech that ends the turn, in ms. */
  silenceAfterSpeechMs?: number;
}

export class SpeechEndpointTimer {
  private readonly onEnded: () => void;
  private readonly log?: (line: string) => void;
  private floor: number | null = null;
  private heardSpeech = false;
  private lastSpeechAt = 0;
  private startedAt = 0;
  private handsFree = false;
  private silenceAfterSpeechMs = DEFAULT_SILENCE_AFTER_SPEECH_MS;
  private timer: ReturnType<typeof setInterval> | null = null;
  private ended = true;
  private levelLogAt = 0;

  constructor(onEnded: () => void, log?: (line: string) => void) {
    this.onEnded = onEnded;
    this.log = log;
  }

  /** A turn has started. Nothing has been heard yet. */
  begin(now: number = Date.now(), options?: SpeechEndpointOptions): void {
    this.log?.('[VAD] begin - listening for silence');
    this.levelLogAt = 0;
    this.floor = null;
    this.heardSpeech = false;
    this.lastSpeechAt = 0;
    this.startedAt = now;
    this.handsFree = Boolean(options?.handsFree);
    this.silenceAfterSpeechMs =
      typeof options?.silenceAfterSpeechMs === 'number' &&
      Number.isFinite(options.silenceAfterSpeechMs) &&
      options.silenceAfterSpeechMs > 0
        ? options.silenceAfterSpeechMs
        : DEFAULT_SILENCE_AFTER_SPEECH_MS;
    this.ended = false;
    this.clear();
    this.timer = setInterval(() => this.check(Date.now()), CHECK_EVERY_MS);
    if (typeof this.timer === 'object' && this.timer !== null && 'unref' in this.timer) {
      (this.timer as { unref: () => void }).unref();
    }
  }

  /** One buffer of microphone loudness (RMS). */
  observeLevel(rms: number, now: number = Date.now()): SpeechEndpointReading {
    if (!Number.isFinite(rms) || rms < 0) return { speech: false, floor: this.floor ?? 0 };
    if (this.floor === null) this.floor = rms;
    const speech = rms > this.floor * SPEECH_OVER_FLOOR + SPEECH_FLOOR_MARGIN;
    const alpha = rms < this.floor ? FLOOR_FALL : speech ? 0 : FLOOR_RISE;
    this.floor += alpha * (rms - this.floor);
    if (now - this.levelLogAt >= 1_000) {
      this.levelLogAt = now;
      this.log?.(
        `[VAD] rms=${rms.toFixed(4)} floor=${this.floor.toFixed(4)} speech=${speech} heard=${this.heardSpeech} quietMs=${this.heardSpeech ? now - this.lastSpeechAt : now - this.startedAt}`,
      );
    }
    if (speech) {
      this.heardSpeech = true;
      this.lastSpeechAt = now;
    }
    return { speech, floor: this.floor };
  }

  /** Whether the turn should end now. Public so it can be checked synchronously. */
  hasEnded(now: number = Date.now()): boolean {
    if (this.heardSpeech) {
      return now - this.lastSpeechAt >= this.silenceAfterSpeechMs;
    }
    if (this.handsFree) return false;
    return now - this.startedAt >= SILENCE_BEFORE_SPEECH_MS;
  }

  /** Seconds of quiet elapsed since the last heard speech (0 if nothing was heard). */
  quietTailSeconds(now: number = Date.now()): number {
    if (!this.heardSpeech || this.lastSpeechAt <= 0) return 0;
    const elapsedMs = Math.max(0, now - this.lastSpeechAt);
    return elapsedMs / 1000;
  }

  /** True once speech has been heard at all. */
  hasHeardSpeech(): boolean {
    return this.heardSpeech;
  }

  /** Forget the turn. Called whenever transcription stops, however it stopped. */
  cancel(): void {
    this.clear();
    this.ended = true;
  }

  private check(now: number): void {
    if (this.ended || !this.hasEnded(now)) return;
    this.log?.(`[VAD] ENDING turn - heardSpeech=${this.heardSpeech}`);
    this.ended = true;
    this.clear();
    this.onEnded();
  }

  private clear(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
