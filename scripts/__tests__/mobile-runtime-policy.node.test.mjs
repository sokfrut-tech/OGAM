import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  IPHONE_INFERENCE_THREADS,
  androidInferenceThreads,
  mobileUseMmap,
  stateCacheBudgetMb,
  MOBILE_BACKEND_ROWS,
  MOBILE_DEVICE_ROWS,
  classifyMobileDevice,
  fastestBenchedBackend,
  planMobileFastestSettings,
} from '../../src/utils/mobileRuntimePolicy.ts';
import { MOBILE_MTP_DRAFT_TOKENS } from '../../src/utils/modelCapabilityRules.ts';

const LEGACY_MODELS_PKG = `${'@offgrid'}/models`;

test('androidInferenceThreads matches real CPH2707, big.LITTLE, Elite, and Gen3 topologies', () => {
  assert.equal(IPHONE_INFERENCE_THREADS, 4);
  assert.equal(androidInferenceThreads([380, 380, 380, 873, 873, 873, 873, 1024]), 4);
  assert.equal(androidInferenceThreads([1024, 1024, 1024, 1024, 410, 410, 410, 410]), 4);
  assert.equal(androidInferenceThreads([1024, 1024, 380, 380, 380, 380, 380, 380]), 2);
  assert.equal(androidInferenceThreads([1024, 1024, 1024, 1024, 1024, 1024, 1024, 1024]), 8);
  assert.equal(androidInferenceThreads([3532800, 3532800, 3532800, 3532800, 3532800, 3532800, 4320000, 4320000]), 8);
  assert.equal(androidInferenceThreads([2265600, 2265600, 2956800, 2956800, 3148800, 3148800, 3148800, 3302400]), 5);
  assert.equal(androidInferenceThreads([]), 0);
});

test('mobileUseMmap and stateCacheBudgetMb honor platform, RAM tier, and repacked file types', () => {
  assert.equal(mobileUseMmap('ios', 2, 12), true);
  assert.equal(mobileUseMmap('android', 2, 4), true);
  assert.equal(mobileUseMmap('android', 2, 8), false);
  assert.equal(mobileUseMmap('android', 15, 12), false);
  assert.equal(mobileUseMmap('android', 7, 12), false);
  assert.equal(mobileUseMmap('android', 1, 12), true);
  assert.equal(mobileUseMmap('android', null, 12), true);

  assert.equal(stateCacheBudgetMb(0), 0);
  assert.equal(stateCacheBudgetMb(3200), 160);
  assert.equal(stateCacheBudgetMb(10000), 256);
});

test('backend rows, device classification, fastest backend selection, and plan generation match contracts', () => {
  assert.equal(MOBILE_BACKEND_ROWS.htp.batch, 128);
  assert.equal(MOBILE_BACKEND_ROWS.htp.quantizedKv, false);
  assert.equal(MOBILE_BACKEND_ROWS.htp.sessionSave, true);
  assert.equal(MOBILE_BACKEND_ROWS.opencl.sessionSave, false);
  assert.equal(MOBILE_BACKEND_ROWS.cpu.quantizedKv, true);

  const npuDevice = { platform: 'android', totalRamGb: 12, hasNpu: true, hasAdreno: true };
  assert.equal(classifyMobileDevice(npuDevice), 'android-npu');
  assert.deepEqual(MOBILE_DEVICE_ROWS['android-npu'].benchBackends, ['cpu', 'htp', 'opencl']);
  assert.equal(
    fastestBenchedBackend(
      [
        { backend: 'cpu', tokensPerSecond: 9 },
        { backend: 'htp', tokensPerSecond: 24 },
        { backend: 'opencl', tokensPerSecond: 14 },
      ],
      'cpu',
    ),
    'htp',
  );
  assert.equal(
    fastestBenchedBackend([{ backend: 'cpu', tokensPerSecond: null }], 'cpu'),
    'cpu',
  );

  const plan = planMobileFastestSettings({
    device: npuDevice,
    coreValues: [380, 380, 380, 873, 873, 873, 873, 1024],
    freeRamMb: 4000,
    modelFileType: 15,
    benchedBackend: 'htp',
  });
  assert.equal(plan.backend, 'htp');
  assert.equal(plan.batch, 128);
  assert.equal(plan.threads, 4);
  assert.equal(plan.useMmap, false);
  assert.equal(plan.kvCacheType, 'f16');
  assert.equal(plan.flashAttn, false);
  assert.equal(plan.mtpDraftTokens, MOBILE_MTP_DRAFT_TOKENS);
});

test('migrated mobile runtime files no longer import legacy models package', () => {
  const importPattern = new RegExp(`(?:from\\s*|require\\(\\s*)['"]${LEGACY_MODELS_PKG}`);
  const migrated = [
    'src/services/hardware.ts',
    'src/services/cpuTopologyReader.ts',
    'src/services/activeModelService/memory.ts',
    'src/services/modalityBackends.ts',
    'src/services/modalityPlacement.ts',
    'src/services/llmHelpers.ts',
    'src/services/llm.ts',
    'src/services/fastestSettings.ts',
  ];
  for (const rel of migrated) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
    assert.equal(importPattern.test(src), false, `${rel} should not import ${LEGACY_MODELS_PKG}`);
  }
});
