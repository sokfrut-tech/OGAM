import assert from 'node:assert/strict';
import test from 'node:test';
import { SpeechEndpointTimer } from '../../src/utils/speechEndpoint.ts';
import {
  DEFAULT_SILENCE_AFTER_SPEECH_MS,
  DEFAULT_SPEAKER_DRAIN_MS,
  SILENCE_AFTER_SPEECH_CHOICES_MS,
  SPEAKER_DRAIN_CHOICES_MS,
  SPEECH_ONSET_LOOKBACK_MS,
  VOICE_DELAY_LABELS,
  VOICE_TURN_LABELS,
  secondsLabel,
} from '../../src/utils/voiceTurnSettings.ts';

test('exposes valid voice turn defaults, choices, labels, and seconds formatting', () => {
  assert.equal(DEFAULT_SILENCE_AFTER_SPEECH_MS, 1500);
  assert.equal(DEFAULT_SPEAKER_DRAIN_MS, 400);
  assert.equal(SPEECH_ONSET_LOOKBACK_MS, 350);
  assert.ok(SILENCE_AFTER_SPEECH_CHOICES_MS.includes(DEFAULT_SILENCE_AFTER_SPEECH_MS));
  assert.ok(SPEAKER_DRAIN_CHOICES_MS.includes(DEFAULT_SPEAKER_DRAIN_MS));

  for (const mode of ['tap', 'silence', 'handsfree']) {
    assert.ok(VOICE_TURN_LABELS[mode].label.length > 0);
    assert.ok(VOICE_TURN_LABELS[mode].description.length > 0);
  }
  assert.ok(VOICE_DELAY_LABELS.silenceAfterSpeech.label.length > 0);
  assert.ok(VOICE_DELAY_LABELS.speakerDrain.label.length > 0);

  assert.equal(secondsLabel(1000), '1s');
  assert.equal(secondsLabel(1500), '1.5s');
  assert.equal(secondsLabel(400), '0.4s');
  assert.equal(secondsLabel(0), '0s');
});

test('adapts noise floor, detects speech, and honors silence timeout after speech', () => {
  const logs = [];
  const timer = new SpeechEndpointTimer(() => {}, line => logs.push(line));
  try {
    timer.begin(1000, { handsFree: false, silenceAfterSpeechMs: 1200 });
    assert.equal(timer.hasHeardSpeech(), false);
    assert.equal(timer.quietTailSeconds(2000), 0);
    assert.equal(timer.hasEnded(5000), false);
    assert.equal(timer.hasEnded(9000), true); // 8000ms pre-speech timeout in silence mode

    const ambient = timer.observeLevel(0.01, 1200);
    assert.equal(ambient.speech, false);
    assert.equal(timer.hasHeardSpeech(), false);

    const speech = timer.observeLevel(0.12, 1500);
    assert.equal(speech.speech, true);
    assert.equal(timer.hasHeardSpeech(), true);
    assert.equal(timer.hasEnded(2699), false);
    assert.equal(timer.hasEnded(2700), true);
    assert.equal(timer.quietTailSeconds(2700), 1.2);
    assert.ok(logs.length >= 1);
  } finally {
    timer.cancel();
  }
});

test('handsFree waits indefinitely before first speech, then ends after chosen silence window', () => {
  const timer = new SpeechEndpointTimer(() => {});
  try {
    timer.begin(1000, { handsFree: true, silenceAfterSpeechMs: 2000 });
    assert.equal(timer.hasEnded(60_000), false);
    timer.observeLevel(0.005, 60_100);
    assert.equal(timer.hasEnded(120_000), false);

    const spoken = timer.observeLevel(0.08, 120_500);
    assert.equal(spoken.speech, true);
    assert.equal(timer.hasEnded(122_499), false);
    assert.equal(timer.hasEnded(122_500), true);
    assert.equal(timer.quietTailSeconds(122_500), 2.0);
  } finally {
    timer.cancel();
  }
});

test('ignores negative or non-finite RMS values without poisoning noise floor', () => {
  const timer = new SpeechEndpointTimer(() => {});
  try {
    timer.begin(1000);
    assert.deepEqual(timer.observeLevel(Number.NaN, 1100), { speech: false, floor: 0 });
    assert.deepEqual(timer.observeLevel(-0.5, 1200), { speech: false, floor: 0 });
  } finally {
    timer.cancel();
  }
});
