/**
 * OGAM-owned pure voice session state machine.
 *
 * Replaces `@offgrid/speech`'s `voiceSession` state-machine exports while keeping
 * `src/services/voiceSession.ts` and `src/services/recordingController.ts` as
 * the single runtime owner across Voice mode and chat dictation.
 */

export type VoiceSessionState = 'listen' | 'speak' | 'stop';
export type VoiceSessionPhase = 'idle' | 'listening' | 'recording' | 'transcribing' | 'speaking';
export type VoiceReplayReturnState = 'listen' | 'stop';

export type VoiceSessionEvent =
  | 'userStart'
  | 'speechHeard'
  | 'turnCaptured'
  | 'dictationFinished'
  | 'nothingHeard'
  | 'userStop'
  | 'replyStarted'
  | 'replyEnded'
  | 'replayStarted'
  | 'replayEnded';

export interface VoiceSession {
  readonly state: VoiceSessionState;
  readonly phase: VoiceSessionPhase;
  readonly emptyTurns: number;
  readonly replayReturnsTo?: VoiceReplayReturnState;
}

/** Consecutive empty turns tolerated in hands-free mode before disarming the mic. */
export const MAX_EMPTY_TURNS = 2;

const STOP_IDLE_SESSION: VoiceSession = Object.freeze({
  state: 'stop',
  phase: 'idle',
  emptyTurns: 0,
});

function listenSession(emptyTurns: number, phase: 'listening' | 'recording' = 'listening'): VoiceSession {
  return { state: 'listen', phase, emptyTurns };
}

/** Builds the initial session snapshot for `handsFree` mode (`true` starts listening). */
export function initialVoiceSession(handsFree: boolean): VoiceSession {
  return handsFree ? listenSession(0, 'listening') : STOP_IDLE_SESSION;
}

/** Microphone hardware may be open only while the session is in `'listen'`. */
export function micShouldBeOpen(session: VoiceSession): boolean {
  return session.state === 'listen';
}

/** Assistant or replay audio may play only while the session holds the `'speak'` floor. */
export function speechMayPlay(session: VoiceSession): boolean {
  return session.state === 'speak';
}

/**
 * Pure transition function for voice sessions.
 *
 * Returns `session` by reference on no-op events so subscribers are notified
 * only when state or user-visible phase genuinely changes.
 */
export function nextVoiceSession(
  session: VoiceSession,
  event: VoiceSessionEvent,
  handsFree: boolean,
): VoiceSession {
  switch (event) {
    case 'userStart':
      if (session.state === 'listen') return session;
      return listenSession(0, 'listening');

    case 'speechHeard':
      if (session.state !== 'listen' || session.phase === 'recording') return session;
      return listenSession(session.emptyTurns, 'recording');

    case 'turnCaptured':
      if (session.state !== 'listen') return session;
      return { state: 'speak', phase: 'transcribing', emptyTurns: session.emptyTurns };

    case 'dictationFinished':
      if (session.replayReturnsTo) return session;
      if (session.state === 'stop' && session.phase === 'idle' && session.emptyTurns === 0) {
        return session;
      }
      return STOP_IDLE_SESSION;

    case 'nothingHeard': {
      if (session.state === 'stop' || session.replayReturnsTo) return session;
      if (!handsFree) return STOP_IDLE_SESSION;
      const nextEmptyTurns = session.emptyTurns + 1;
      if (nextEmptyTurns >= MAX_EMPTY_TURNS) return STOP_IDLE_SESSION;
      return listenSession(nextEmptyTurns, 'listening');
    }

    case 'userStop':
      if (
        session.state === 'stop' &&
        session.phase === 'idle' &&
        session.emptyTurns === 0 &&
        !session.replayReturnsTo
      ) {
        return session;
      }
      return STOP_IDLE_SESSION;

    case 'replyStarted':
      if (session.state !== 'speak') return session;
      if (session.phase === 'speaking' && session.emptyTurns === 0) return session;
      return { ...session, phase: 'speaking', emptyTurns: 0 };

    case 'replyEnded':
      if (session.state !== 'speak' || session.replayReturnsTo) return session;
      return handsFree ? listenSession(0, 'listening') : STOP_IDLE_SESSION;

    case 'replayStarted': {
      const returnTo: VoiceReplayReturnState =
        session.replayReturnsTo ??
        ((session.state === 'listen' || session.state === 'speak') && handsFree ? 'listen' : 'stop');
      if (
        session.state === 'speak' &&
        session.phase === 'speaking' &&
        session.replayReturnsTo === returnTo &&
        session.emptyTurns === 0
      ) {
        return session;
      }
      return {
        state: 'speak',
        phase: 'speaking',
        emptyTurns: 0,
        replayReturnsTo: returnTo,
      };
    }

    case 'replayEnded':
      if (!session.replayReturnsTo) return session;
      return session.replayReturnsTo === 'listen' && handsFree
        ? listenSession(0, 'listening')
        : STOP_IDLE_SESSION;
  }
}
