#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGES = [
  'models', 'rag', 'sync', 'speech', 'notes', 'notes-editor',
  'ui', 'writing', 'design', 'automation', 'pro',
];
const EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json',
  '.yaml', '.yml', '.gradle', '.kts', '.sh', '.properties',
  '.xml', '.pbxproj', '.plist', '.toml', '.gitmodules',
]);
const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'Pods', '.gradle', 'build', '.cxx',
  'DerivedData', 'coverage', '.claude', '.artifacts',
]);

function scopeFor(file) {
  if (file.includes('/__tests__/') || /\.(test|spec)\.[^.]+$/.test(file)) return 'test';
  if (file.startsWith('.github/') || /(^|\/)(package\.json|package-lock\.json|metro\.config\.js|jest\.config\.js|tsconfig\.json|\.gitmodules)$/.test(file)) return 'build-config';
  return 'source-or-config';
}

export function scanFileContent(file, content) {
  const hits = [];
  const importPattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"](@offgrid\/(?:models|rag|sync|speech|notes|notes-editor|ui|writing|design|automation|pro)(?:\/[^'"]*)?)['"]/g;
  const sharedPattern = /(?:file:)?\.\.\/shared(?:\/[^\s"'\x60]*)?/g;
  const proPattern = /(?:PRO_SUBMODULE_PAT|off-grid-ai\/mobile-pro|off-grid-ai\/shared|git submodule|pro\/package\.json|(?:\.\.\/|\.\/)?pro\/)/gi;
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const match of line.matchAll(importPattern)) {
      const specifier = match[1];
      const packageName = specifier.split('/').slice(0, specifier.startsWith('@offgrid/') ? 2 : 1).join('/');
      hits.push({ kind: 'package-import', package: packageName, specifier, line: index + 1, text: line.trim().slice(0, 260) });
    }
    for (const match of line.matchAll(sharedPattern)) {
      hits.push({ kind: 'shared-workspace-path', value: match[0], line: index + 1, text: line.trim().slice(0, 260) });
    }
    for (const match of line.matchAll(proPattern)) {
      hits.push({ kind: 'pro-or-private-checkout-reference', value: match[0], line: index + 1, text: line.trim().slice(0, 260) });
    }
  }
  return hits.map(hit => ({ file, scope: scopeFor(file), ...hit }));
}

function walkFiles(root, current = root, found = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) walkFiles(root, absolute, found);
    else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      try {
        if (fs.statSync(absolute).size <= 5 * 1024 * 1024) found.push({ relative, absolute });
      } catch { /* Ignore files that disappear during the scan. */ }
    }
  }
  return found;
}

export function buildReport(root = process.cwd()) {
  const files = walkFiles(root);
  const hits = [];
  for (const file of files) {
    try {
      hits.push(...scanFileContent(file.relative, fs.readFileSync(file.absolute, 'utf8')));
    } catch { /* Binary or unreadable files are outside this text audit. */ }
  }

  let rootDependencies = {};
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    rootDependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  } catch { /* The scanner can also run against a source subdirectory. */ }

  const localDependencies = Object.entries(rootDependencies)
    .filter(([name, value]) => name.startsWith('@offgrid/') && typeof value === 'string' && value.startsWith('file:'))
    .map(([name, value]) => ({ name, path: value }));

  const byPackage = Object.fromEntries(PACKAGES.map(name => {
    const key = `@offgrid/${name}`;
    return [key, hits.filter(hit => hit.kind === 'package-import' && hit.package === key).length];
  }));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    repository: 'sokfrut-tech/OGAM',
    filesScanned: files.length,
    localFileDependencies: localDependencies,
    packageImportCounts: byPackage,
    hitCounts: {
      packageImports: hits.filter(hit => hit.kind === 'package-import').length,
      sharedWorkspacePaths: hits.filter(hit => hit.kind === 'shared-workspace-path').length,
      proOrPrivateCheckoutReferences: hits.filter(hit => hit.kind === 'pro-or-private-checkout-reference').length,
    },
    hits,
  };
}

function renderSummary(report) {
  const lines = [
    '# OGAM external-package import audit',
    '',
    `- Files scanned: **${report.filesScanned}**`,
    `- Local `file:` dependencies: **${report.localFileDependencies.length}**`,
    `- Package imports: **${report.hitCounts.packageImports}**`,
    `- Shared workspace path references: **${report.hitCounts.sharedWorkspacePaths}**`,
    `- Pro/private checkout references: **${report.hitCounts.proOrPrivateCheckoutReferences}**`,
    '',
    '## Local package dependencies',
    '',
    ...report.localFileDependencies.map(item => `- \`${item.name}\` → \`${item.path}\``),
    '',
    '## Import counts',
    '',
    ...Object.entries(report.packageImportCounts).map(([name, count]) => `- \`${name}\`: ${count}`),
    '',
    'Full file/line evidence is in the `ogam-import-audit` workflow artifact.',
  ];
  return lines.join('\n');
}

function main() {
  const root = process.cwd();
  const report = buildReport(root);
  const outputArg = process.argv.find(arg => arg.startsWith('--output='));
  const outputPath = outputArg?.slice('--output='.length);
  const json = JSON.stringify(report, null, 2);
  if (outputPath) fs.writeFileSync(path.resolve(root, outputPath), json + '\n');
  else process.stdout.write(json + '\n');

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, renderSummary(report) + '\n');
  }
  console.log(`OGAM import audit: ${report.filesScanned} files, ${report.hits.length} references.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) main();
