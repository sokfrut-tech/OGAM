import { splitGgufPartNames } from '../../../src/utils/ggufSplitFiles';

describe('splitGgufPartNames', () => {
  it('returns a normal GGUF filename unchanged', () => {
    expect(splitGgufPartNames('Qwen3-8B-Q4_K_M.gguf')).toEqual(['Qwen3-8B-Q4_K_M.gguf']);
  });

  it('expands a valid first shard into the complete ordered set', () => {
    expect(splitGgufPartNames('Model-Q4_K_M-00001-of-00003.gguf')).toEqual([
      'Model-Q4_K_M-00001-of-00003.gguf',
      'Model-Q4_K_M-00002-of-00003.gguf',
      'Model-Q4_K_M-00003-of-00003.gguf',
    ]);
  });

  it('finds the same first shard when called with a middle or final shard', () => {
    const expected = [
      'Model-00001-of-00004.gguf',
      'Model-00002-of-00004.gguf',
      'Model-00003-of-00004.gguf',
      'Model-00004-of-00004.gguf',
    ];
    expect(splitGgufPartNames(expected[1])).toEqual(expected);
    expect(splitGgufPartNames(expected[3])).toEqual(expected);
  });

  it('preserves the filename prefix, total padding and extension case', () => {
    expect(splitGgufPartNames('my-model-v2-00002-of-00003.GGUF')).toEqual([
      'my-model-v2-00001-of-00003.GGUF',
      'my-model-v2-00002-of-00003.GGUF',
      'my-model-v2-00003-of-00003.GGUF',
    ]);
  });

  it.each([
    'Model-00000-of-00003.gguf',
    'Model-00004-of-00003.gguf',
    'Model-00001-of-00001.gguf',
    'Model-0001-of-00003.gguf',
    'Model-00001-of-0003.gguf',
    'Model-00001-of-00003.gguf.bak',
  ])('does not expand malformed or non-split name %s', name => {
    expect(splitGgufPartNames(name)).toEqual([name]);
  });
});
