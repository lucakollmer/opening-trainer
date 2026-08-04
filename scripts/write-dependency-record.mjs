import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const runtimePackages = [
  'react',
  'react-dom',
  '@mui/material',
  '@mui/icons-material',
  '@mui/x-tree-view',
  '@emotion/react',
  '@emotion/styled',
  'react-chessboard',
  'chess.js',
  'dexie',
  'dexie-react-hooks',
  'ts-fsrs',
];

const developmentPackages = [
  'vite',
  '@vitejs/plugin-react',
  'typescript',
  '@types/node',
  '@types/react',
  '@types/react-dom',
  'vite-plugin-pwa',
  'vitest',
  'jsdom',
  '@testing-library/react',
  '@testing-library/jest-dom',
  '@testing-library/user-event',
  'fake-indexeddb',
  'eslint',
  '@eslint/js',
  'typescript-eslint',
  'eslint-plugin-react-hooks',
  'eslint-plugin-react-refresh',
  'prettier',
  'globals',
];

async function packageMetadata(packageName) {
  const path = join('node_modules', ...packageName.split('/'), 'package.json');
  const metadata = JSON.parse(await readFile(path, 'utf8'));
  const repository =
    typeof metadata.repository === 'string'
      ? metadata.repository
      : (metadata.repository?.url ?? metadata.homepage ?? 'not-declared');
  const licence =
    typeof metadata.license === 'string'
      ? metadata.license
      : (metadata.license?.type ?? 'not-declared');

  return {
    name: packageName,
    version: metadata.version,
    licence,
    repository: String(repository)
      .replace(/^git\+/, '')
      .replace(/\.git$/u, ''),
  };
}

const records = [];
for (const packageName of [...runtimePackages, ...developmentPackages]) {
  records.push(await packageMetadata(packageName));
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const lines = [
  '# PHASE-0 installed dependencies and environment',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Environment',
  '',
  `- Node: ${process.version}`,
  `- npm: ${process.env.NPM_VERSION ?? 'not-recorded'}`,
  `- pnpm: ${process.env.PNPM_VERSION ?? 'not-recorded'}`,
  `- packageManager: ${packageJson.packageManager ?? 'not-recorded'}`,
  '',
  '## Direct dependency record',
  '',
  '| Package | Installed version | Licence declared by package | Official package repository/homepage | Scope |',
  '|---|---:|---|---|---|',
];

for (const record of records) {
  const scope = runtimePackages.includes(record.name) ? 'runtime' : 'development';
  lines.push(
    `| \`${record.name}\` | \`${record.version}\` | ${record.licence} | ${record.repository} | ${scope} |`,
  );
}

lines.push(
  '',
  '## Acceptance notes',
  '',
  '- MUI X usage is limited to `@mui/x-tree-view` Community/MIT features.',
  '- `react-chessboard` is isolated behind a presentation component.',
  '- `chess.js`, Dexie and `ts-fsrs` are behind project-owned domain/infrastructure boundaries.',
  '- No package requires a cloud account, paid runtime feature or mandatory telemetry for this foundation.',
  '- Exact transitive resolutions are recorded in `pnpm-lock.yaml`.',
  '',
);

await writeFile(
  'docs/dependencies/INSTALLED_DEPENDENCIES.md',
  `${lines.join('\n')}\n`,
  'utf8',
);
