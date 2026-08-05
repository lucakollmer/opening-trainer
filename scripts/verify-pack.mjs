#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const normalisePath = (value) => value.replaceAll('\\', '/');

const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.vite',
  'playwright-report',
  'test-results',
]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
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
  'CHATGPT_START_HERE.md',
  'CHATGPT_WORKFLOW_PROFILE.md',
  'START_DEVELOPMENT.md',
  'WORKFLOW_MIGRATION.md',
  'PACK_MANIFEST.md',
  'SHA256SUMS.txt',
  'docs/workflow/CHATGPT_GITHUB_ACTIONS_CODING.md',
  'docs/workflow/ACTIONS_SECURITY_AND_EVIDENCE.md',
  'docs/workflow/PHASE_COMMANDS.md',
  'docs/workflow/PROMPT_WRITING_GUIDELINES.md',
  'docs/workflow/STRUCTURED_REPORT_TEMPLATE.md',
  'docs/product/PRODUCT_CONTRACT.md',
  'docs/architecture/ARCHITECTURE.md',
  'docs/domain/REPERTOIRE_DOMAIN_MODEL.md',
  'docs/training/TRAINING_AND_SCHEDULING.md',
  'docs/ui/UI_AND_INTERACTION_CONTRACT.md',
  'docs/storage/OFFLINE_DATA_AND_PORTABILITY.md',
  'docs/testing/TEST_AND_ACCEPTANCE_STRATEGY.md',
  'prompts/WRK-OPENING-TRAINER-20260804-001__MVP__GOVERNANCE__migration__v1.md',
];

for (const relative of required) {
  try {
    const info = await stat(path.join(root, relative));
    if (!info.isFile()) fail(`${relative} is not a file`);
  } catch {
    fail(`missing required file ${relative}`);
  }
}

const prohibitedPaths = [
  'CODEX_START_HERE.md',
  'CODEX_PROMPT_PROFILE.md',
  'docs/codex/COMPLETION_REPORT_TEMPLATE.md',
  'docs/codex/PHASE_COMMANDS.md',
  'docs/codex/PROMPT_WRITING_GUIDELINES.md',
  'prompts/PRM-OPENING-TRAINER-20260803-001__MVP__PHASE-0__implementation__v1.md',
];

for (const relative of prohibitedPaths) {
  try {
    await stat(path.join(root, relative));
    fail(`deprecated execution-control path remains: ${relative}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') fail(`could not inspect deprecated path ${relative}`);
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
  try {
    const buffer = await readFile(path.join(root, relative));
    const actual = sha256(buffer);
    if (actual !== wanted)
      fail(`hash mismatch for ${relative}: ${actual} != ${wanted}`);
  } catch {
    fail(`manifest entry has no readable file ${relative}`);
  }
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

const textFiles = files.filter(
  (relative) =>
    /\.(md|txt|json|mjs|js|ts|tsx|css|html|yml|yaml)$/.test(relative) ||
    !relative.includes('.'),
);

const staleAuthorityPhrases = [
  ['GitHub Actions is not', 'the acceptance system for this programme'].join(' '),
  ['Local validation is authoritative', 'for Codex'].join(' '),
  ['Do not wait for, rerun,', 'debug or cite Actions'].join(' '),
];

for (const relative of textFiles) {
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
  if (relative !== 'scripts/verify-pack.mjs') {
    for (const phrase of staleAuthorityPhrases) {
      if (text.includes(phrase))
        fail(`stale execution authority in ${relative}: ${phrase}`);
    }
  }
}

const agentsBytes = (await readFile(path.join(root, 'AGENTS.md'))).byteLength;
if (agentsBytes > 32000)
  fail(`AGENTS.md is ${agentsBytes} bytes; keep at or below 32000`);

const requestPath = path.join(
  root,
  'prompts/WRK-OPENING-TRAINER-20260804-001__MVP__GOVERNANCE__migration__v1.md',
);
const request = await readFile(requestPath, 'utf8');
if (!request.endsWith('END_OF_WORK_REQUEST\n')) {
  fail('issued governance request does not end with END_OF_WORK_REQUEST');
}
if ((request.match(/END_OF_WORK_REQUEST/g) ?? []).length !== 1) {
  fail('issued governance request sentinel count is not one');
}

const reportTemplate = await readFile(
  path.join(root, 'docs/workflow/STRUCTURED_REPORT_TEMPLATE.md'),
  'utf8',
);
if (!reportTemplate.includes('END_OF_COMPLETION_REPORT')) {
  fail('structured report template is missing its completion sentinel');
}

const plans = await readFile(path.join(root, 'plans.md'), 'utf8');
for (let phase = 0; phase <= 8; phase += 1) {
  if (!plans.includes(`# PHASE-${phase} `)) fail(`plans.md missing PHASE-${phase}`);
}
if (!plans.includes('# GOVERNANCE-MIGRATION ')) {
  fail('plans.md missing the current governance migration operation');
}

const agents = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
for (const requiredPhrase of [
  'Google Drive Assistant Memory',
  'ChatGPT + GitHub Actions',
  'Luca retains phase acceptance, merge, and continuation authority',
]) {
  if (!agents.includes(requiredPhrase))
    fail(`AGENTS.md missing required authority phrase: ${requiredPhrase}`);
}

if (!process.exitCode) {
  console.log(`PACK_VERIFICATION_OK files=${files.length} agents_bytes=${agentsBytes}`);
}
