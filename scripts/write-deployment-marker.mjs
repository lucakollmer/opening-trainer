import { writeFile } from 'node:fs/promises';

const sha =
  process.env.WORKERS_CI_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? 'local';
const branch = process.env.WORKERS_CI_BRANCH ?? process.env.CF_PAGES_BRANCH ?? 'local';
const buildUuid = process.env.WORKERS_CI_BUILD_UUID ?? null;

await writeFile(
  new URL('../dist/deployment.json', import.meta.url),
  `${JSON.stringify({ sha, branch, build_uuid: buildUuid }, null, 2)}\n`,
);
