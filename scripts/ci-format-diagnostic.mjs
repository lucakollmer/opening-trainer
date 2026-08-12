import { spawnSync } from 'node:child_process';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const files = [
  'src/app/App.test.tsx',
  'src/app/App.tsx',
  'src/domain/chess/positionKey.test.ts',
  'src/domain/training/session.test.ts',
  'src/domain/training/session.ts',
  'src/features/board/ChessboardPreview.tsx',
  'src/features/repertoire-tree/RepertoireTreePreview.tsx',
  'src/features/task/TaskPreviewCard.tsx',
  'src/fixtures/trainingFixtures.ts',
];

const format = spawnSync('pnpm', ['exec', 'prettier', '--write', ...files], {
  stdio: 'inherit',
});

if (format.status !== 0) {
  process.exit(format.status ?? 1);
}

const runnerTemp = process.env.RUNNER_TEMP;
if (!runnerTemp) {
  process.exit(0);
}

const evidenceRoot = join(
  runnerTemp,
  'opening-trainer-browser-smoke',
  'formatted-source',
);

for (const file of files) {
  const target = join(evidenceRoot, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(file, target);
}
