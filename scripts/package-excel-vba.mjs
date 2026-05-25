import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const builtAt = new Date().toISOString().slice(0, 10);
const zipPath = 'public/downloads/pacchetto-excel-vba.zip';
const manifestPath = 'public/downloads/pacchetto-excel-vba.manifest.json';
const templateFile = 'templates/Simulatore-TPL-Lotti-1-4-template.xlsm';
const templatePath = `excel-vba/${templateFile}`;

function resolveVersion() {
  if (process.argv[2]) return process.argv[2];

  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8')).version ?? 'v0.1';
  } catch {
    return 'v0.1';
  }
}

function unzipList(filePath) {
  return execFileSync('unzip', ['-Z1', filePath], { encoding: 'utf8' })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
}

function unzipEntry(filePath, entry) {
  const escapedEntry = entry.replaceAll('[', '\\[').replaceAll(']', '\\]');
  return execFileSync('unzip', ['-p', filePath, escapedEntry]);
}

function validateMacroTemplate() {
  const templateEntries = unzipList(templatePath);
  if (!templateEntries.includes('xl/vbaProject.bin')) {
    throw new Error(`Template XLSM senza progetto VBA: ${templatePath}`);
  }

  const contentTypes = unzipEntry(templatePath, '[Content_Types].xml').toString('utf8');
  if (!contentTypes.includes('macroEnabled')) {
    throw new Error(`Template XLSM senza content type macroEnabled: ${templatePath}`);
  }
}

validateMacroTemplate();
const version = resolveVersion();
mkdirSync('public/downloads', { recursive: true });
rmSync(zipPath, { force: true });
execFileSync('zip', ['-r', `../${zipPath}`, 'README.md', 'src', 'templates', '-x', 'templates/*.xlsx'], {
  cwd: 'excel-vba',
  stdio: 'ignore',
});

const zipEntries = unzipList(zipPath);
if (!zipEntries.includes(templateFile)) {
  throw new Error(`Template Excel non trovato nello ZIP: ${templateFile}`);
}
if (zipEntries.some((entry) => entry.startsWith('templates/') && entry.endsWith('.xlsx'))) {
  throw new Error('Lo ZIP non deve includere template .xlsx: il pacchetto distribuisce direttamente il .xlsm');
}

const sha256 = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
const manifest = {
  version,
  builtAt,
  sha256,
  file: '/downloads/pacchetto-excel-vba.zip',
  templateFile,
  minAppVersion: '1.1.1',
  notes: 'Template XLSM con macro integrate; modalità light',
  generatedBy: 'scripts/package-excel-vba.mjs',
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Creato ${zipPath}`);
console.log(`Aggiornato ${manifestPath}`);
