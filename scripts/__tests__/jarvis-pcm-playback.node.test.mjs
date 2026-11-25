import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');

test('Jarvis PCM player uses mono Float32 AudioTrack and non-blocking ordered writes', () => {
  const source = read('android/app/src/main/java/ai/offgridmobile/voice/JarvisPcmStreamPlayer.kt');
  assert.ok(source.includes('AudioFormat.ENCODING_PCM_FLOAT'));
  assert.ok(source.includes('AudioFormat.CHANNEL_OUT_MONO'));
  assert.ok(source.includes('AudioTrack.MODE_STREAM'));
  assert.ok(source.includes('AudioTrack.WRITE_NON_BLOCKING'));
  assert.ok(source.includes('while (cursor < end)'));
  assert.ok(source.includes('cursor += written'));
});

test('Jarvis PCM player owns AudioFocus and cancels on focus loss', () => {
  const source = read('android/app/src/main/java/ai/offgridmobile/voice/JarvisPcmStreamPlayer.kt');
  assert.ok(source.includes('AudioFocusRequest.Builder'));
  assert.ok(source.includes('AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK'));
  assert.ok(source.includes('onLost = { cancel(token) }'));
  assert.ok(source.includes('onDuck = { setVolume(token, DUCKED_VOLUME) }'));
  assert.ok(source.includes('onGain = { setVolume(token, NORMAL_VOLUME) }'));
});

test('PCM generations invalidate stale chunks and make finish/cancel idempotent', () => {
  const source = read('android/app/src/main/java/ai/offgridmobile/voice/JarvisPcmStreamPlayer.kt');
  assert.ok(source.includes('generation += 1'));
  assert.ok(source.includes('generation != generationToken'));
  assert.ok(source.includes('if (!isCurrent(generationToken)) return false'));
  assert.ok(source.includes('abandonFailedStart(token)'));
  assert.ok(source.includes('safeRelease(target, immediate = true)'));
});

test('Android unit tests cover write order, interruption, stale startup, sample-rate validation and focus', () => {
  const unit = read('android/app/src/test/java/ai/offgridmobile/voice/JarvisPcmStreamPlayerTest.kt');
  assert.equal((unit.match(/@Test/g) ?? []).length, 8);
  assert.ok(unit.includes('val firstGeneration = player.begin(24_000)!!'));
  assert.ok(unit.includes('firstGeneration.set(player.begin(24_000))'));
  for (const name of [
    'writesPartialChunksInOrderAndFinishesTheCurrentGeneration',
    'cancelInvalidatesLateChunksAndReleasesTheTrackImmediately',
    'staleGenerationCannotFinishOrCancelANewerReply',
    'invalidSampleRateDoesNotRequestFocusOrCreateATrack',
    'focusDenialDoesNotStartPlayback',
    'focusLossCancelsTheCurrentGeneration',
    'duckingAndFocusGainAdjustOnlyTheCurrentTrackVolume',
    'lateTrackCreationFromCancelledStartCannotAbandonNewerFocus',
  ]) assert.ok(unit.includes(name), `Missing test: ${name}`);
});

test('PCM stream and focus use assistant speech attributes with bounded buffer polling', () => {
  const source = read('android/app/src/main/java/ai/offgridmobile/voice/JarvisPcmStreamPlayer.kt');
  assert.equal((source.match(/AudioAttributes\.USAGE_ASSISTANT/g) ?? []).length, 2);
  assert.ok(source.includes('AudioAttributes.CONTENT_TYPE_SPEECH'));
  assert.ok(source.includes('LockSupport.parkNanos(5_000_000L)'));
  assert.ok(!source.includes('LockSupport.parkNanos(100_000L)'));
});
