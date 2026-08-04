#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const normalisePath = (value) => value.replaceAll('\\', '/');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (
      [
        '.git',
        'node_modules',
        'dist',
        'coverage',
        '.vite',
        'playwright-report',
        'test-results',
      ].includes(entry.name)
    )
      continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function fail(message) {
  console.error(`PACK_VERIFICATION_FAILED: ${message}`);
  process.exitCode = 1;
}

const required = [
  'AGENTS.md',
  'context.md',
  'plans.md',
  'CODEX_START_HERE.md',
  'CODEX_PROMPT_PROFILE.md',
  'START_DEVELOPMENT.md',
  'PACK_MANIFEST.md',
  'SHA256SUMS.txt',
  'docs/product/PRODUCT_CONTRACT.md',
  'docs/architecture/ARCHITECTURE.md',
  'docs/domain/REPERTOIRE_DOMAIN_MODEL.md',
  'docs/training/TRAINING_AND_SCHEDULING.md',
  'docs/ui/UI_AND_INTERACTION_CONTRACT.md',
  'docs/storage/OFFLINE_DATA_AND_PORTABILITY.md',
  'docs/testing/TEST_AND_ACCEPTANCE_STRATEGY.md',
  'prompts/PRM-OPENING-TRAINER-20260803-001__MVP__PHASE-0__implementation__v1.md',
];

for (const relative of required) {
  try {
    const info = await stat(path.join(root, relative));
    if (!info.isFile()) fail(`${relative} is not a file`);
  } catch {
    fail(`missing required file ${relative}`);
  }
}

const sumsText = await readFile(path.join(root, 'SHA256SUMS.txt'), 'utf8');
const expected = new Map();
for (const line of sumsText.split('\n')) {
  if (!line.trim()) continue;
  const match = line.match(/^([a-f0-9]{64})  (.+)$/);
  if (!match) {
    fail(`invalid SHA256SUMS line: ${line}`);
    continue;
  }
  expected.set(match[2], match[1]);
}

for (const [relative, wanted] of expected) {
  const buffer = await readFile(path.join(root, relative));
  const actual = sha256(buffer);
  if (actual !== wanted) fail(`hash mismatch for ${relative}: ${actual} != ${wanted}`);
}

const files = (await walk(root))
  .map((full) => normalisePath(path.relative(root, full)))
  .filter((relative) => relative !== 'SHA256SUMS.txt')
  .sort();

for (const relative of files) {
  if (!expected.has(relative)) fail(`unmanifested file ${relative}`);
}
for (const relative of expected.keys()) {
  if (!files.includes(relative)) fail(`manifest entry has no file ${relative}`);
}

for (const relative of files.filter(
  (f) => /\.(md|txt|json|mjs|js|ts|tsx|css|html)$/.test(f) || !f.includes('.'),
)) {
  const buffer = await readFile(path.join(root, relative));
  const text = buffer.toString('utf8');
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  ) {
    fail(`UTF-8 BOM present in ${relative}`);
  }
  if (text.includes('\r')) fail(`CR line ending present in ${relative}`);
  if (!text.endsWith('\n')) fail(`missing terminal LF in ${relative}`);
  const badLine = text.split('\n').findIndex((line) => /[ \t]+$/.test(line));
  if (badLine >= 0) fail(`trailing whitespace in ${relative}:${badLine + 1}`);
}

const agentsBytes = (await readFile(path.join(root, 'AGENTS.md'))).byteLength;
if (agentsBytes > 32000)
  fail(`AGENTS.md is ${agentsBytes} bytes; keep at or below 32000`);

const promptPath = path.join(
  root,
  'prompts/PRM-OPENING-TRAINER-20260803-001__MVP__PHASE-0__implementation__v1.md',
);
const prompt = await readFile(promptPath, 'utf8');
if (!prompt.endsWith('END_OF_CODEX_PROMPT\n'))
  fail('issued PHASE-0 prompt does not end with sentinel');
if ((prompt.match(/END_OF_CODEX_PROMPT/g) ?? []).length !== 1)
  fail('issued prompt sentinel count is not one');

const plans = await readFile(path.join(root, 'plans.md'), 'utf8');
for (let phase = 0; phase <= 8; phase += 1) {
  if (!plans.includes(`# PHASE-${phase} `)) fail(`plans.md missing PHASE-${phase}`);
}

if (!process.exitCode) {
  console.log(`PACK_VERIFICATION_OK files=${files.length} agents_bytes=${agentsBytes}`);
}
