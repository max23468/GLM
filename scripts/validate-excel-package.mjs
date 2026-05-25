import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const zipPath = 'public/downloads/pacchetto-excel-vba.zip';
const manifestPath = 'public/downloads/pacchetto-excel-vba.manifest.json';

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const required = ['version', 'builtAt', 'sha256', 'file', 'templateFile', 'minAppVersion', 'generatedBy'];
for (const key of required) {
  if (!manifest[key]) throw new Error(`Manifest incompleto: campo mancante ${key}`);
}

const currentHash = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
if (currentHash !== manifest.sha256) throw new Error('Hash ZIP non coerente con manifest');

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

const zipEntries = unzipList(zipPath);
if (!manifest.templateFile.endsWith('.xlsm')) {
  throw new Error(`Il manifest deve puntare a un template .xlsm: ${manifest.templateFile}`);
}

const requiredEntries = [
  'README.md',
  'src/modChecks.bas',
  'src/modConfig.bas',
  'src/modEngine.bas',
  'src/modOptimization.bas',
  'src/modScenario.bas',
  'src/modSimulation.bas',
  'src/modTypes.bas',
  'src/modValidation.bas',
  'templates/golden-cases.csv',
  'templates/offerte-esempio.csv',
  manifest.templateFile,
];

for (const entry of requiredEntries) {
  if (!zipEntries.includes(entry)) throw new Error(`Elemento mancante nello ZIP: ${entry}`);
}

const xlsxTemplates = zipEntries.filter((entry) => entry.startsWith('templates/') && entry.endsWith('.xlsx'));
if (xlsxTemplates.length > 0) {
  throw new Error(`Lo ZIP contiene template .xlsx non ammessi: ${xlsxTemplates.join(', ')}`);
}

const tempDir = mkdtempSync(path.join(tmpdir(), 'glm-excel-'));
const tempTemplate = path.join(tempDir, 'template.xlsm');

try {
  writeFileSync(tempTemplate, unzipEntry(zipPath, manifest.templateFile));
  const templateEntries = unzipList(tempTemplate);
  if (!templateEntries.includes('[Content_Types].xml')) {
    throw new Error('Template Excel non valido: [Content_Types].xml mancante');
  }
  if (!templateEntries.includes('xl/vbaProject.bin')) {
    throw new Error('Template XLSM senza progetto VBA incorporato: xl/vbaProject.bin mancante');
  }

  const contentTypes = unzipEntry(tempTemplate, '[Content_Types].xml').toString('utf8');
  if (!contentTypes.includes('macroEnabled')) {
    throw new Error('Template XLSM senza content type macroEnabled');
  }

  const vbaProject = unzipEntry(tempTemplate, 'xl/vbaProject.bin');
  if (vbaProject.length < 1024) {
    throw new Error('Template XLSM con progetto VBA vuoto o sospetto');
  }

  const workbookXml = unzipEntry(tempTemplate, 'xl/workbook.xml').toString('utf8');
  const sheetNames = [...workbookXml.matchAll(/<sheet[^>]* name="([^"]+)"/g)].map((match) => match[1]);
  const requiredSheets = [
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
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}

console.log('Pacchetto Excel valido');
