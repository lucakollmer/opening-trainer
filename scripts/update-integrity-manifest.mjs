#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const excludedDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.vite',
  'playwright-report',
  'test-results',
]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = (await walk(root))
  .map((fullPath) => path.relative(root, fullPath).replaceAll('\\', '/'))
  .filter((relativePath) => relativePath !== 'SHA256SUMS.txt')
  .sort();
const lines = [];

for (const relativePath of files) {
  const digest = createHash('sha256')
    .update(await readFile(path.join(root, relativePath)))
    .digest('hex');
  lines.push(`${digest}  ${relativePath}`);
}

await writeFile(path.join(root, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`, 'utf8');

console.log(`INTEGRITY_MANIFEST_UPDATED files=${files.length}`);
