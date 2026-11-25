import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  MAX_EMPTY_TURNS,
  initialVoiceSession,
  micShouldBeOpen,
  nextVoiceSession,
  speechMayPlay,
} from '../../src/utils/voiceSessionMachine.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

function controllerPhase(session) {
  if (session.state === 'listen') return session.phase === 'recording' ? 'recording' : 'listening';
  if (session.state === 'speak') return session.phase === 'transcribing' ? 'transcribing' : 'recording';
  return 'idle';
}

test('initialVoiceSession obeys handsFree flag and mic/speaker floor predicates', () => {
  const manual = initialVoiceSession(false);
  assert.deepEqual(manual, { state: 'stop', phase: 'idle', emptyTurns: 0 });
  assert.equal(micShouldBeOpen(manual), false);
  assert.equal(speechMayPlay(manual), false);

  const handsFree = initialVoiceSession(true);
  assert.deepEqual(handsFree, { state: 'listen', phase: 'listening', emptyTurns: 0 });
  assert.equal(micShouldBeOpen(handsFree), true);
  assert.equal(speechMayPlay(handsFree), false);
});

test('follows exact recordingController phase trajectory and suppresses duplicate no-op events', () => {
  const seen = [];
  let session = initialVoiceSession(false);

  const dispatch = (event, handsFree = false) => {
    const next = nextVoiceSession(session, event, handsFree);
    if (next.state !== session.state || next.phase !== session.phase) {
      seen.push(controllerPhase(next));
    }
    session = next;
    return next;
  };

  // turnCaptured on idle must not enter transcribing
  const ignoredCapture = nextVoiceSession(session, 'turnCaptured', false);
  assert.equal(ignoredCapture, session);

  dispatch('userStart');
  dispatch('speechHeard');
  // duplicate userStart / speechHeard while already recording must be strict no-ops
  const dupStart = nextVoiceSession(session, 'userStart', false);
  assert.equal(dupStart, session);
  const dupSpeech = nextVoiceSession(session, 'speechHeard', false);
  assert.equal(dupSpeech, session);

  dispatch('turnCaptured');
  assert.equal(micShouldBeOpen(session), false);
  assert.equal(speechMayPlay(session), true);

  dispatch('userStop');
  assert.equal(micShouldBeOpen(session), false);
  assert.equal(speechMayPlay(session), false);

  assert.deepEqual(seen, ['listening', 'recording', 'transcribing', 'idle']);
});

test('dictationFinished settles manual transcription and cancellation without overriding active replay', () => {
  let session = initialVoiceSession(false);
  session = nextVoiceSession(session, 'userStart', false);
  session = nextVoiceSession(session, 'turnCaptured', false);
  session = nextVoiceSession(session, 'dictationFinished', false);
  assert.deepEqual(session, { state: 'stop', phase: 'idle', emptyTurns: 0 });

  // Cancel directly from listen/recording
  session = nextVoiceSession(session, 'userStart', false);
  session = nextVoiceSession(session, 'speechHeard', false);
  session = nextVoiceSession(session, 'dictationFinished', false);
  assert.deepEqual(session, { state: 'stop', phase: 'idle', emptyTurns: 0 });

  // Active replay retains floor on dictationFinished
  session = nextVoiceSession(session, 'replayStarted', false);
  const duringReplay = session;
  assert.equal(nextVoiceSession(session, 'dictationFinished', false), duringReplay);
});

test('nothingHeard enforces two-strike limit in handsFree mode and single-turn stop in manual mode', () => {
  assert.equal(MAX_EMPTY_TURNS, 2);

  // Manual mode stops immediately on 1 strike
  let manual = initialVoiceSession(false);
  manual = nextVoiceSession(manual, 'userStart', false);
  manual = nextVoiceSession(manual, 'turnCaptured', false);
  manual = nextVoiceSession(manual, 'nothingHeard', false);
  assert.deepEqual(manual, { state: 'stop', phase: 'idle', emptyTurns: 0 });

  // Hands-free mode tolerates 1st empty turn (even if speechHeard fired on ambient noise)
  let hf = initialVoiceSession(true);
  hf = nextVoiceSession(hf, 'speechHeard', true);
  hf = nextVoiceSession(hf, 'turnCaptured', true);
  hf = nextVoiceSession(hf, 'nothingHeard', true);
  assert.deepEqual(hf, { state: 'listen', phase: 'listening', emptyTurns: 1 });

  // 2nd empty turn disarms hands-free
  hf = nextVoiceSession(hf, 'speechHeard', true);
  hf = nextVoiceSession(hf, 'turnCaptured', true);
  hf = nextVoiceSession(hf, 'nothingHeard', true);
  assert.deepEqual(hf, { state: 'stop', phase: 'idle', emptyTurns: 0 });

  // Two immediate strikes from Voice.ts reportNothingHeard(msg, 2) also disarm cleanly
  let hfTwoStrikes = initialVoiceSession(true);
  hfTwoStrikes = nextVoiceSession(hfTwoStrikes, 'turnCaptured', true);
  hfTwoStrikes = nextVoiceSession(hfTwoStrikes, 'nothingHeard', true);
  assert.equal(hfTwoStrikes.state, 'listen');
  hfTwoStrikes = nextVoiceSession(hfTwoStrikes, 'nothingHeard', true);
  assert.deepEqual(hfTwoStrikes, { state: 'stop', phase: 'idle', emptyTurns: 0 });
});

test('replyStarted/replyEnded respect userStop silence guarantee and return to listen only in handsFree', () => {
  // Reply after userStop must stay silent
  let stopped = initialVoiceSession(true);
  stopped = nextVoiceSession(stopped, 'turnCaptured', true);
  stopped = nextVoiceSession(stopped, 'userStop', true);
  assert.equal(nextVoiceSession(stopped, 'replyStarted', true), stopped);
  assert.equal(speechMayPlay(stopped), false);

  // Full hands-free turn resets emptyTurns on replyStarted and returns to listen on replyEnded
  let hf = initialVoiceSession(true);
  hf = nextVoiceSession(hf, 'turnCaptured', true);
  hf = nextVoiceSession(hf, 'nothingHeard', true);
  assert.equal(hf.emptyTurns, 1);
  hf = nextVoiceSession(hf, 'turnCaptured', true);
  hf = nextVoiceSession(hf, 'replyStarted', true);
  assert.deepEqual(hf, { state: 'speak', phase: 'speaking', emptyTurns: 0 });
  hf = nextVoiceSession(hf, 'replyEnded', true);
  assert.deepEqual(hf, { state: 'listen', phase: 'listening', emptyTurns: 0 });

  // Non-hands-free returns to stop after replyEnded
  let manual = initialVoiceSession(false);
  manual = nextVoiceSession(manual, 'userStart', false);
  manual = nextVoiceSession(manual, 'turnCaptured', false);
  manual = nextVoiceSession(manual, 'replyStarted', false);
  manual = nextVoiceSession(manual, 'replyEnded', false);
  assert.deepEqual(manual, { state: 'stop', phase: 'idle', emptyTurns: 0 });
});

test('replayStarted seizes floor with replayReturnsTo and replayEnded restores previous floor', () => {
  // Hands-free listen -> replayStarted sets replayReturnsTo='listen'
  let hf = initialVoiceSession(true);
  hf = nextVoiceSession(hf, 'replayStarted', true);
  assert.deepEqual(hf, {
    state: 'speak',
    phase: 'speaking',
    emptyTurns: 0,
    replayReturnsTo: 'listen',
  });
  assert.equal(micShouldBeOpen(hf), false);
  assert.equal(speechMayPlay(hf), true);
  hf = nextVoiceSession(hf, 'replayEnded', true);
  assert.deepEqual(hf, { state: 'listen', phase: 'listening', emptyTurns: 0 });

  // Non-hands-free listen/stop -> replayStarted sets replayReturnsTo='stop' and returns to stop
  let manual = nextVoiceSession(initialVoiceSession(false), 'userStart', false);
  manual = nextVoiceSession(manual, 'replayStarted', false);
  assert.equal(manual.replayReturnsTo, 'stop');
  manual = nextVoiceSession(manual, 'replayEnded', false);
  assert.deepEqual(manual, { state: 'stop', phase: 'idle', emptyTurns: 0 });

  // userStop aborts replay and clears replayReturnsTo
  let aborted = nextVoiceSession(initialVoiceSession(true), 'replayStarted', true);
  aborted = nextVoiceSession(aborted, 'userStop', true);
  assert.deepEqual(aborted, { state: 'stop', phase: 'idle', emptyTurns: 0 });
  assert.equal(aborted.replayReturnsTo, undefined);
});

test('voiceSession.ts, package.json, and metro.config.js have removed @offgrid/speech completely', () => {
  const voiceSessionTs = fs.readFileSync(path.join(REPO_ROOT, 'src/services/voiceSession.ts'), 'utf8');
  const pkgJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const metroConfig = fs.readFileSync(path.join(REPO_ROOT, 'metro.config.js'), 'utf8');

  assert.equal(voiceSessionTs.includes('@offgrid/speech'), false);
  assert.match(voiceSessionTs, /from ['"]\.\.\/utils\/voiceSessionMachine['"]/);
  assert.equal('@offgrid/speech' in (pkgJson.dependencies ?? {}), false);
  assert.equal(metroConfig.includes('@offgrid/speech'), false);
  assert.equal(metroConfig.includes('packages/speech'), false);
});
