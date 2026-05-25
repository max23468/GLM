import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const workbookPath = 'public/downloads/Simulatore-TPL-Lotti-1-4.xlsm';
const legacyZipPath = 'public/downloads/pacchetto-excel-vba.zip';
const manifestPath = 'public/downloads/pacchetto-excel-vba.manifest.json';

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const required = ['version', 'builtAt', 'sha256', 'file', 'templateFile', 'minAppVersion', 'generatedBy'];
for (const key of required) {
  if (!manifest[key]) throw new Error(`Manifest incompleto: campo mancante ${key}`);
}

if (existsSync(legacyZipPath)) {
  throw new Error(`File ZIP legacy non ammesso nel download pubblico: ${legacyZipPath}`);
}

if (manifest.file !== '/downloads/Simulatore-TPL-Lotti-1-4.xlsm') {
  throw new Error(`Il manifest deve puntare al file XLSM unico: ${manifest.file}`);
}

if (manifest.templateFile !== 'Simulatore-TPL-Lotti-1-4.xlsm') {
  throw new Error(`templateFile non coerente con il file unico XLSM: ${manifest.templateFile}`);
}

const currentHash = createHash('sha256').update(readFileSync(workbookPath)).digest('hex');
if (currentHash !== manifest.sha256) throw new Error('Hash XLSM non coerente con manifest');

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

if (!manifest.templateFile.endsWith('.xlsm')) {
  throw new Error(`Il manifest deve puntare a un template .xlsm: ${manifest.templateFile}`);
}

const templateEntries = unzipList(workbookPath);
if (!templateEntries.includes('[Content_Types].xml')) {
  throw new Error('Template Excel non valido: [Content_Types].xml mancante');
}
if (!templateEntries.includes('xl/vbaProject.bin')) {
  throw new Error('Template XLSM senza progetto VBA incorporato: xl/vbaProject.bin mancante');
}

const contentTypes = unzipEntry(workbookPath, '[Content_Types].xml').toString('utf8');
if (!contentTypes.includes('macroEnabled')) {
  throw new Error('Template XLSM senza content type macroEnabled');
}

const vbaProject = unzipEntry(workbookPath, 'xl/vbaProject.bin');
if (vbaProject.length < 1024) {
  throw new Error('Template XLSM con progetto VBA vuoto o sospetto');
}

const workbookXml = unzipEntry(workbookPath, 'xl/workbook.xml').toString('utf8');
const sheetNames = [...workbookXml.matchAll(/<sheet[^>]* name="([^"]+)"/g)].map((match) => match[1]);
const requiredSheets = [
  'Dashboard',
  'Guida',
  'Glossario',
  'Istruzioni',
  'Parametri',
  'Offerte',
  'Risultati',
  'Ottimizzazione',
  'LogOttimizzazione',
  'ConfrontoWeb',
];

for (const sheetName of requiredSheets) {
  if (!sheetNames.includes(sheetName)) throw new Error(`Foglio mancante nel template: ${sheetName}`);
}

console.log('Pacchetto Excel valido');
