const fs = require('node:fs');
const path = require('node:path');
const {
  proDependentTestPaths,
  jarvisDisabledTelemetryTestPaths,
  proTestHarnesses,
  toKnipGlob,
} = require('./scripts/test-exclusions');

const proExists = fs.existsSync(path.resolve(__dirname, 'pro/package.json'));

// Modules intentionally retained in open-core as seams/shared helpers consumed by private pro/.
const proSeamCoreFiles = [
  'src/components/NameSheet.tsx',
  'src/components/settings/SettingsSectionHeader.tsx',
  'src/utils/coalesce.ts',
];

const disabledEntryDirs = [
  '!__tests__/pro/**',
  '!__tests__/unit/audio/**',
  '!__tests__/unit/engine/**',
  '!__tests__/integration/audio/**',
];

const ignoredPaths = [
  ...jarvisDisabledTelemetryTestPaths.map(toKnipGlob),
  ...(proExists
    ? []
    : [
        ...proDependentTestPaths.map(toKnipGlob),
        ...proTestHarnesses,
        ...proSeamCoreFiles,
      ]),
];

/** @type {import('knip').KnipConfig} */
module.exports = {
  entry: [
    'App.tsx',
    '__tests__/**/*.{ts,tsx}',
    ...jarvisDisabledTelemetryTestPaths.map(p => `!${toKnipGlob(p)}`),
    ...(proExists
      ? ['pro/**/*.{ts,tsx}']
      : disabledEntryDirs),
    'scripts/lib/engines.js',
  ],
  project: proExists
    ? ['src/**/*.{ts,tsx}', 'pro/**/*.{ts,tsx}']
    : ['src/**/*.{ts,tsx}'],
  ignore: ignoredPaths,
  ignoreBinaries: [
    'swiftlint',
    'c\\+\\+',
    'llama-embedding',
  ],
  ignoreDependencies: [
    '@offgrid/pro',
    'buffer',
    'js-sha512',
    'react-compiler-runtime',
    'eslint-plugin-react-compiler',
    'eslint-plugin-react-native',
    'eslint-plugin-react',
    'eslint-plugin-react-hooks',
    '@babel/preset-env',
    '@babel/runtime',
    'sonar-scanner',
    'babel-plugin-istanbul',
    ...(proExists
      ? ['@offgrid/film-native']
      : ['react-native-calendar-events', 'react-native-webview']),
  ],
  ...(proExists ? {} : {
    rules: {
      // Open-core checkouts omit pro/ consumers of shared seams; keep file/dep gates strict.
      exports: 'off',
      types: 'off',
    },
  }),
};
