import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function walkFiles(dir, exts) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, exts));
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

test('en.json and ru.json have 100% key parity and zero empty values', () => {
  const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/en.json'), 'utf8'));
  const ru = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/ru.json'), 'utf8'));
  const enKeys = Object.keys(en).sort();
  const ruKeys = Object.keys(ru).sort();

  assert.deepEqual(ruKeys, enKeys);
  assert.ok(enKeys.length >= 250, 'expected expanded i18n dictionaries');

  for (const key of enKeys) {
    assert.equal(typeof en[key], 'string');
    assert.equal(typeof ru[key], 'string');
    assert.ok(en[key].trim().length > 0, `Empty en.json value for ${key}`);
    assert.ok(ru[key].trim().length > 0, `Empty ru.json value for ${key}`);
    assert.equal(
      /off\s*grid\s*ai|offgridmobile\.ai|getoffgridai\.co/i.test(ru[key]),
      false,
      `Forbidden foreign brand/domain in ru.json key ${key}: ${ru[key]}`,
    );
  }
  assert.equal(ru['app.name'], 'Jarvis Ai');
  assert.equal(ru['app.proName'], 'Jarvis Ai Pro');
});

test('every t(...) call in src/ references a defined key in en.json and ru.json', () => {
  const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/en.json'), 'utf8'));
  const ru = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/ru.json'), 'utf8'));
  const files = walkFiles(path.join(ROOT, 'src'), ['.ts', '.tsx']);
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const match of src.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
      const key = match[1];
      assert.ok(key in en, `Missing key "${key}" in en.json (used in ${file})`);
      assert.ok(key in ru, `Missing key "${key}" in ru.json (used in ${file})`);
    }
  }
});

test('Android strings.xml preserves Jarvis Ai branding and Russian actions', () => {
  const xml = fs.readFileSync(
    path.join(ROOT, 'android/app/src/main/res/values/strings.xml'),
    'utf8',
  );
  assert.match(xml, /<string name="app_name">Jarvis Ai<\/string>/);
  assert.match(xml, /<string name="jarvis_assistant_name">Jarvis Ai<\/string>/);
  assert.match(xml, /<string name="process_text_action_label">Копировать в Jarvis Ai<\/string>/);
  assert.match(xml, /<string name="improve_text_action_label">Улучшить в Jarvis Ai<\/string>/);
});

test('open/uncensored and Russian GGUF models use verified HuggingFace SHA-256 checksums', () => {
  const catalogSrc = fs.readFileSync(
    path.join(ROOT, 'src/utils/modelCatalogCore.ts'),
    'utf8',
  );
  const expectedModels = [
    'bartowski/Dolphin3.0-Llama3.1-8B-GGUF',
    'bartowski/dolphin-2.9.3-mistral-7B-32k-GGUF',
    'NousResearch/Hermes-3-Llama-3.1-8B-GGUF',
    'IlyaGusev/saiga_nemo_12b_gguf',
    'IlyaGusev/saiga_llama3_8b_gguf',
    'bartowski/Qwen2.5-7B-Instruct-GGUF',
  ];
  for (const id of expectedModels) {
    assert.ok(catalogSrc.includes(`id: '${id}'`), `Catalog missing model ${id}`);
  }
  const shaMatches = [...catalogSrc.matchAll(/sha256:\s*'([0-9a-f]{64})'/g)];
  assert.ok(shaMatches.length >= 6, 'expected 64-char SHA-256 hashes for added models');
});
