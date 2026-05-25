import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const version = process.argv[2] ?? 'v0.1';
const builtAt = new Date().toISOString().slice(0, 10);
const zipPath = 'public/downloads/pacchetto-excel-vba.zip';
const manifestPath = 'public/downloads/pacchetto-excel-vba.manifest.json';

mkdirSync('public/downloads', { recursive: true });
execSync(`cd excel-vba && zip -r ../${zipPath} README.md src templates >/dev/null`);

const sha256 = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
const manifest = { version, builtAt, sha256, file: '/downloads/pacchetto-excel-vba.zip' };
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Creato ${zipPath}`);
console.log(`Aggiornato ${manifestPath}`);
