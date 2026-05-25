import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const zipPath = 'public/downloads/pacchetto-excel-vba.zip';
const manifestPath = 'public/downloads/pacchetto-excel-vba.manifest.json';

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const required = ['version', 'builtAt', 'sha256', 'file', 'templateFile', 'minAppVersion', 'generatedBy'];
for (const key of required) {
  if (!manifest[key]) throw new Error(`Manifest incompleto: campo mancante ${key}`);
}

const currentHash = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
if (currentHash !== manifest.sha256) throw new Error('Hash ZIP non coerente con manifest');

const zipEntries = execSync(`unzip -Z1 ${zipPath}`, { encoding: 'utf8' });
if (!zipEntries.includes(manifest.templateFile)) {
  throw new Error(`Template non presente nello ZIP: ${manifest.templateFile}`);
}

console.log('Pacchetto Excel valido');
