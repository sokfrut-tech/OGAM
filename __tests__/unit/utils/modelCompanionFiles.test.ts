import {
  isCompanionFile,
  isDraftModelFile,
  isImatrixFile,
  isMtpHeadFile,
} from '../../../src/utils/modelCompanionFiles';

describe('GGUF companion artifact filename rules', () => {
  it.each([
    '/models/Qwen3.5-9B-MTP-ONLY-Q4_K_M.gguf',
    '/models/MTP/mtp-gemma-4-E4B-it-Q8_0.gguf',
    '/models/mtp-Qwen3.8-27B-Q4_0.gguf',
    '/models/Qwen3.5-9B-DFlash-Q4_0.gguf',
    '/models/Spark-X2.6-4B-imatrix.gguf',
  ])('recognizes auxiliary file %s', name => {
    expect(isCompanionFile(name)).toBe(true);
  });

  it.each([
    'Qwen3.5-9B-MTP-ONLY-Q4_K_M.gguf',
    'mtp-gemma-4-E4B-it-Q8_0.gguf',
    'mtp-Qwen3.8-27B-Q4_0.gguf',
    'Model-MTP-BF16.gguf',
  ])('recognizes MTP head %s', name => {
    expect(isMtpHeadFile(name)).toBe(true);
  });

  it.each([
    'Qwen3.5-9B-DFlash-Q4_0.gguf',
    'Model-draft.gguf',
    'Model-DSpark-Q4_0.gguf',
    'Model-Eagle3-Q4_0.gguf',
  ])('recognizes speculative draft %s', name => {
    expect(isDraftModelFile(name)).toBe(true);
  });

  it('recognizes imatrix calibration data without matching ordinary quant names', () => {
    expect(isImatrixFile('Spark-X2.6-4B-imatrix.gguf')).toBe(true);
    expect(isImatrixFile('imatrix.gguf')).toBe(true);
    expect(isImatrixFile('Spark-X2.6-4B-Q4_K_M.gguf')).toBe(false);
  });

  it.each([
    'Qwen3.5-9B-Q4_K_M.gguf',
    'gemma-4-E4B-it-Q8_0.gguf',
    'llama-3.2-1b-Q4_K_M.gguf',
  ])('does not classify a primary model as a companion: %s', name => {
    expect(isCompanionFile(name)).toBe(false);
  });
});
