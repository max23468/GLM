import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const version = process.argv[2] ?? 'v0.1';
const builtAt = new Date().toISOString().slice(0, 10);
const zipPath = 'public/downloads/pacchetto-excel-vba.zip';
const manifestPath = 'public/downloads/pacchetto-excel-vba.manifest.json';
const templateFile = 'templates/Simulatore-TPL-Lotti-1-4-template.xlsm';

mkdirSync('public/downloads', { recursive: true });
execSync("python -c 'import openpyxl' || pip install openpyxl", { stdio: 'inherit', shell: '/bin/bash' });
execSync('python scripts/build-excel-template.py', { stdio: 'inherit' });
execSync(`cd excel-vba && zip -r ../${zipPath} README.md src templates >/dev/null`);

const zipEntries = execSync(`unzip -Z1 ${zipPath}`, { encoding: 'utf8' });
if (!zipEntries.includes(templateFile)) {
  throw new Error(`Template XLSM non trovato nello ZIP: ${templateFile}`);
}

const sha256 = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
const manifest = {
  version,
  builtAt,
  sha256,
  file: '/downloads/pacchetto-excel-vba.zip',
  templateFile,
  minAppVersion: '1.1.1',
  notes: 'Modalità light: allineamento tramite golden test',
  generatedBy: 'scripts/package-excel-vba.mjs',
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Creato ${zipPath}`);
console.log(`Aggiornato ${manifestPath}`);
