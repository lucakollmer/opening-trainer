import { access, readFile } from 'node:fs/promises';

const manifestPath = new URL('../dist/manifest.webmanifest', import.meta.url);
const serviceWorkerPath = new URL('../dist/sw.js', import.meta.url);

await access(manifestPath);
await access(serviceWorkerPath);

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (manifest.name !== 'Opening Trainer') {
  throw new Error('Unexpected PWA manifest name.');
}

if (manifest.display !== 'standalone') {
  throw new Error('PWA manifest must use standalone display mode.');
}

console.log('PWA_FOUNDATION_OK manifest=dist/manifest.webmanifest sw=dist/sw.js');
