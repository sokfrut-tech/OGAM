import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  QWEN_IMAGE_21_WEIGHT,
  SD_CHECKPOINT_HEADER_BYTES,
  imageEngineSettings,
  isCompleteSDCheckpointHeader,
  isImageWeightAvailableOn,
  isSDImageWeight,
  sdImagePackFor,
} from '../../src/utils/sdImagePackPolicy.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function buildSafetensorsHeader(tensorNames) {
  const obj = {};
  for (const name of tensorNames) {
    obj[name] = { dtype: 'F16', shape: [1], data_offsets: [0, 2] };
  }
  const jsonBytes = new TextEncoder().encode(JSON.stringify(obj));
  const buf = new Uint8Array(8 + jsonBytes.byteLength);
  const view = new DataView(buf.buffer);
  view.setUint32(0, jsonBytes.byteLength, true);
  view.setUint32(4, 0, true);
  buf.set(jsonBytes, 8);
  return buf;
}

function buildGgufV3Header(tensorNames) {
  const enc = new TextEncoder();
  const chunks = [];
  const pushU32 = (v) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v, true);
    chunks.push(b);
  };
  const pushU64 = (v) => {
    const b = new Uint8Array(8);
    const view = new DataView(b.buffer);
    view.setUint32(0, v >>> 0, true);
    view.setUint32(4, Math.floor(v / 4294967296) >>> 0, true);
    chunks.push(b);
  };
  const pushStr = (s) => {
    const sb = enc.encode(s);
    pushU64(sb.byteLength);
    chunks.push(sb);
  };

  chunks.push(enc.encode('GGUF'));
  pushU32(3);
  pushU64(tensorNames.length);
  pushU64(0);
  for (const name of tensorNames) {
    pushStr(name);
    pushU32(2);
    pushU64(1);
    pushU64(1);
    pushU32(0);
    pushU64(0);
  }
  const total = chunks.reduce((s, c) => s + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

test('sdImagePackFor distinguishes DiT packs from standalone checkpoints and exposes companion regexes', () => {
  assert.equal(SD_CHECKPOINT_HEADER_BYTES, 1024 * 1024);
  assert.equal(QWEN_IMAGE_21_WEIGHT.test('Qwen_Image_2.1-Q4_K_M.gguf'), true);

  const qwen = sdImagePackFor('Qwen_Image_2.1-Q4_K_M.gguf');
  assert.equal(qwen?.family, 'qwen-image-2.1');
  assert.equal(qwen?.vae.test('qwen_image_vae.safetensors'), true);
  assert.equal(qwen?.llm.test('Qwen3VL-2B-Instruct-Q4_K_M.gguf'), true);

  const flux = sdImagePackFor('flux-2-klein-4b-Q8_0.gguf');
  assert.equal(flux?.family, 'flux2-klein');
  assert.equal(flux?.vae.test('flux2-vae.safetensors'), true);
  assert.equal(flux?.llm.test('Qwen3-4B-Q4_K_M.gguf'), true);

  const zimage = sdImagePackFor('z_image_turbo-Q4_K.gguf');
  assert.equal(zimage?.family, 'z-image');
  assert.equal(zimage?.vae.test('ae.safetensors'), true);
  assert.equal(zimage?.llm.test('Qwen3-4B-Instruct-2507-Q4_K_M.gguf'), true);

  assert.equal(sdImagePackFor('realvisxl-v5.0-lightning-Q4_K_M.gguf'), null);
});

test('isSDImageWeight, isImageWeightAvailableOn, and imageEngineSettings follow sd.cpp rules', () => {
  assert.equal(isSDImageWeight('realvisxl-v5.0-lightning-Q4_K_M.gguf'), true);
  assert.equal(isSDImageWeight('flux-2-klein-4b-Q4_0.gguf'), true);
  assert.equal(isSDImageWeight('ae.safetensors'), true);
  assert.equal(isSDImageWeight('flux2-vae.safetensors'), false);
  assert.equal(isSDImageWeight('model-lora.safetensors'), false);
  assert.equal(isSDImageWeight('sd-00001-of-00002.gguf'), false);

  assert.equal(isImageWeightAvailableOn('model.gguf', 'android'), true);
  assert.equal(isImageWeightAvailableOn('model-ios.safetensors', 'android'), false);
  assert.equal(isImageWeightAvailableOn('model-ios.safetensors', 'ios'), true);

  assert.deepEqual(imageEngineSettings('flux-2-klein-4b-Q4_0.gguf'), {
    sampler: 'euler',
    scheduler: 'discrete',
  });
  assert.deepEqual(imageEngineSettings('realvisxl-v5.0-lightning.gguf'), {
    sampler: 'euler',
    scheduler: 'sgm_uniform',
  });
  assert.deepEqual(imageEngineSettings('dreamshaper-8.safetensors'), {
    sampler: 'euler_a',
    scheduler: 'karras',
  });
});

test('isCompleteSDCheckpointHeader verifies GGUF & safetensors headers and fails closed on incomplete data', () => {
  const completeTensors = [
    'model.diffusion_model.input_blocks.0.0.weight',
    'first_stage_model.decoder.up.0.block.0.weight',
    'cond_stage_model.transformer.text_model.embeddings.weight',
  ];
  assert.equal(isCompleteSDCheckpointHeader(buildSafetensorsHeader(completeTensors)), true);
  assert.equal(isCompleteSDCheckpointHeader(buildGgufV3Header(completeTensors)), true);

  const missingVae = [
    'model.diffusion_model.input_blocks.0.0.weight',
    'conditioner.embedders.0.model.weight',
  ];
  assert.equal(isCompleteSDCheckpointHeader(buildSafetensorsHeader(missingVae)), false);
  assert.equal(isCompleteSDCheckpointHeader(buildGgufV3Header(missingVae)), false);
  assert.equal(isCompleteSDCheckpointHeader(new Uint8Array([1, 2, 3])), false);
});

test('Slice 10 image pack callers drop non-CATALOG @offgrid/models imports', () => {
  const browserSrc = fs.readFileSync(path.join(REPO_ROOT, 'src/services/huggingFaceModelBrowser.ts'), 'utf8');
  assert.doesNotMatch(
    browserSrc,
    /(sdImagePackFor|isCompleteSDCheckpointHeader|imageEngineSettings|QWEN_IMAGE_21_WEIGHT|SD_CHECKPOINT_HEADER_BYTES|isImageWeightAvailableOn|isSDImageWeight)[^;]*from\s+['"]@offgrid\/models['"]/,
  );

  for (const rel of [
    '__tests__/pro/video/engine/filmOnPhone.test.ts',
    '__tests__/pro/video/filmWaitsForStills.rendered.test.tsx',
  ]) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    assert.doesNotMatch(src, /@offgrid\/models/, `${rel} still references @offgrid/models`);
  }
});
