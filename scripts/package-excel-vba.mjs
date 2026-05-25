import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const builtAt = new Date().toISOString().slice(0, 10);
const workbookPath = 'public/downloads/Simulatore-TPL-Lotti-1-4.xlsm';
const legacyZipPath = 'public/downloads/pacchetto-excel-vba.zip';
const manifestPath = 'public/downloads/pacchetto-excel-vba.manifest.json';
const templatePath = 'excel-vba/templates/Simulatore-TPL-Lotti-1-4-template.xlsm';
const workbookFile = 'Simulatore-TPL-Lotti-1-4.xlsm';

function resolveVersion() {
  if (process.argv[2]) return process.argv[2];

  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8')).version ?? 'v0.1';
  } catch {
    return 'v0.1';
  }
}

function resolveMinAppVersion() {
  try {
    return JSON.parse(readFileSync('package.json', 'utf8')).version ?? '1.4.0';
  } catch {
    return '1.4.0';
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
rmSync(legacyZipPath, { force: true });
copyFileSync(templatePath, workbookPath);

const sha256 = createHash('sha256').update(readFileSync(workbookPath)).digest('hex');
const manifest = {
  version,
  builtAt,
  sha256,
  file: `/downloads/${workbookFile}`,
  templateFile: workbookFile,
  minAppVersion: resolveMinAppVersion(),
  notes: 'File XLSM unico con macro integrate, ScambioWeb e modalità light',
  generatedBy: 'scripts/package-excel-vba.mjs',
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Creato ${workbookPath}`);
console.log(`Aggiornato ${manifestPath}`);
