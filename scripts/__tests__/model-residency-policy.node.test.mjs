import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  planEviction,
  admissionBudgetMB,
  dirtyHeadroomMB,
  hasDirtyPressure,
  exceedsDirtyCeiling,
  fitsWithoutEviction,
  memoryWarningVictims,
  freesIdleSpeechForGeneration,
} from '../../src/utils/modelResidencyPolicy.ts';

const LEGACY_MODELS_PKG = `${'@offgrid'}/models`;
const resident = (key, type, sizeMB, lastUsedAt, extra = {}) => ({
  key,
  type,
  sizeMB,
  lastUsedAt,
  ...extra,
});

test('planEviction handles co-residency, singleModel, priority/LRU order, pinned, and sidecar limits', () => {
  const coReside = planEviction(
    [resident('img', 'image', 400, 1)],
    { key: 'txt', type: 'text', sizeMB: 800 },
    4000,
  );
  assert.equal(coReside.fits, true);
  assert.deepEqual(coReside.evict, []);

  const aggressive = planEviction(
    [resident('smol', 'classifier', 100, 2, { pinned: true }), resident('img', 'image', 400, 1)],
    { key: 'txt', type: 'text', sizeMB: 500 },
    8000,
    { singleModel: true },
  );
  assert.deepEqual(aggressive.evict.map(e => e.key), ['img']);
  assert.equal(aggressive.fits, true);

  const audioResidents = [
    resident('txt', 'text', 1500, 4),
    resident('stt', 'whisper', 1500, 1),
    resident('tts', 'tts', 320, 2),
  ];
  const keepLlm = planEviction(audioResidents, { key: 'img', type: 'image', sizeMB: 1200 }, 3000);
  assert.deepEqual(keepLlm.evict.map(e => e.key), ['stt', 'tts']);
  assert.equal(keepLlm.fits, true);

  const sidecarBlocked = planEviction(
    [resident('txt', 'text', 800, 1)],
    { key: 'tts', type: 'tts', sizeMB: 320 },
    700,
  );
  assert.equal(sidecarBlocked.fits, false);
  assert.deepEqual(sidecarBlocked.evict, []);

  const alreadyResident = planEviction(
    [resident('txt', 'text', 800, 1)],
    { key: 'txt', type: 'text', sizeMB: 800 },
    900,
  );
  assert.equal(alreadyResident.fits, true);
  assert.deepEqual(alreadyResident.evict, []);
});

test('dirty pressure, headroom, admission budget, dirty ceiling, warning victims, and speech reclaim match contracts', () => {
  assert.equal(dirtyHeadroomMB(12 * 1024, 'balanced', 'ios'), 1024);
  assert.equal(dirtyHeadroomMB(12 * 1024, 'balanced', 'android'), 512);
  assert.equal(dirtyHeadroomMB(8 * 1024, 'balanced', 'android'), 1024);
  assert.equal(dirtyHeadroomMB(8 * 1024, 'aggressive', 'ios'), 512);

  const residents = [
    resident('image', 'image', 1000, 1, { dirtyMemory: true }),
    resident('tts', 'tts', 200, 2),
    resident('cls', 'classifier', 100, 3, { pinned: true }),
  ];
  assert.equal(hasDirtyPressure(residents, {}), true);
  assert.equal(hasDirtyPressure([], { dirtyMemory: true }), true);
  assert.equal(hasDirtyPressure([resident('txt', 'text', 500, 1)], {}), false);

  assert.equal(
    admissionBudgetMB({
      physicalCapMB: 9000,
      floorMB: 1024,
      dirtyPressure: false,
      residentMB: 1200,
      availableMB: 500,
      headroomMB: 1024,
    }),
    9000,
  );
  assert.equal(
    admissionBudgetMB({
      physicalCapMB: 9000,
      floorMB: 1024,
      dirtyPressure: true,
      residentMB: 1200,
      availableMB: 3000,
      headroomMB: 1024,
    }),
    3176,
  );

  const sameKeyReload = exceedsDirtyCeiling(
    [resident('image', 'image', 5000, 1, { dirtyMemory: true })],
    { key: 'image', sizeMB: 5000, dirtyMemory: true },
    { evict: [], fits: true, freedMB: 0 },
    8000,
  );
  assert.equal(sameKeyReload, false);

  assert.equal(fitsWithoutEviction([resident('txt', 'text', 700, 1)], { key: 'txt', sizeMB: 700 }, 1000), true);
  assert.equal(fitsWithoutEviction([resident('txt', 'text', 700, 1)], { key: 'txt', sizeMB: 1200 }, 1000), false);
  assert.equal(fitsWithoutEviction([resident('txt', 'text', 700, 1)], { key: 'img', sizeMB: 400 }, 1000), false);
  const oversizedReplacement = planEviction(
    [resident('txt', 'text', 700, 1)],
    { key: 'txt', type: 'text', sizeMB: 1200 },
    1000,
  );
  assert.equal(oversizedReplacement.fits, false);
  assert.deepEqual(memoryWarningVictims(residents).map(v => v.key), ['tts']);
  assert.equal(freesIdleSpeechForGeneration(4 * 1024), true);
  assert.equal(freesIdleSpeechForGeneration(8 * 1024), false);
});

test('migrated residency modules and tests no longer reference legacy models package', () => {
  const importPattern = new RegExp(`(?:from\\s*|require\\(\\s*)['"]${LEGACY_MODELS_PKG}`);
  const migratedFiles = [
    'src/services/modelResidency/index.ts',
    'src/services/modelResidency/residents.ts',
    'src/services/modelResidency/logging.ts',
    'src/components/models/useResidentRows.ts',
    '__tests__/unit/services/modelResidency.test.ts',
  ];
  for (const rel of migratedFiles) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
    assert.equal(importPattern.test(src), false, `${rel} should not import ${LEGACY_MODELS_PKG}`);
  }
});
