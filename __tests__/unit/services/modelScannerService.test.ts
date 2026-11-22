import { classifyModelArtifact } from '../../../src/services/modelArtifactClassifier';

describe('classifyModelArtifact', () => {
  it.each([
    ['llama-3.2-1b-Q4_K_M.gguf', 'gguf', true],
    ['mmproj-model-f16.gguf', 'mmproj', false],
    ['ggml-tiny.bin', 'whisper', true],
    ['unet.mnn', 'mnn-model', false],
    ['unet.bin', 'qnn-model', false],
    ['libQnnHtp.so', 'qnn-runtime', false],
    ['portrait-lora-v1.safetensors', 'lora', false],
    ['model.safetensors', 'safetensors', false],
    ['manifest.json', 'manifest', false],
  ])('classifies %s', (name, kind, installable) => {
    expect(classifyModelArtifact(name)).toEqual({ kind, installable });
  });

  it('does not offer hidden or unknown files for import', () => {
    expect(classifyModelArtifact('.partial-download')).toEqual({
      kind: 'unknown',
      installable: false,
    });
    expect(classifyModelArtifact('notes.txt')).toEqual({
      kind: 'unknown',
      installable: false,
    });
  });
});
