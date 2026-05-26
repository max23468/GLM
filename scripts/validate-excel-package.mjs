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
  return execFileSync('unzip', ['-p', filePath, escapedEntry], { maxBuffer: 64 * 1024 * 1024 });
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
if (!workbookXml.includes('activeTab="0"')) {
  throw new Error('Il workbook deve aprirsi sulla Dashboard senza fogli raggruppati');
}

const sheetEntries = [...workbookXml.matchAll(/<sheet\b[^>]*\/>/g)].map((match) => {
  const tag = match[0];
  const name = tag.match(/\bname="([^"]+)"/)?.[1];
  const state = tag.match(/\bstate="([^"]+)"/)?.[1] ?? 'visible';
  return { name, state };
}).filter((sheet) => sheet.name);
const sheetNames = sheetEntries.map((sheet) => sheet.name);
const requiredSheets = [
  'Dashboard',
  'Guida',
  'Glossario',
  'Istruzioni',
  'Parametri',
  'Offerte',
  'CriteriTecnici',
  'Combinatorie',
  'ScenarioGlobale',
  'ScambioWeb',
  'Risultati',
  'Ottimizzazione',
  'LogOttimizzazione',
  'ConfrontoWeb',
];

for (const sheetName of requiredSheets) {
  if (!sheetNames.includes(sheetName)) throw new Error(`Foglio mancante nel template: ${sheetName}`);
}

const expectedVisibleSheets = ['Dashboard', 'Parametri', 'CriteriTecnici', 'Offerte', 'Ottimizzazione', 'Combinatorie', 'Risultati', 'Guida'];
const expectedHiddenSheets = ['Istruzioni', 'ScenarioGlobale', 'ScambioWeb', 'ConfrontoWeb', 'LogOttimizzazione', 'Glossario'];
for (const sheetName of expectedVisibleSheets) {
  const sheet = sheetEntries.find((entry) => entry.name === sheetName);
  if (sheet?.state !== 'visible') throw new Error(`Foglio operativo non visibile: ${sheetName}`);
}
for (const sheetName of expectedHiddenSheets) {
  const sheet = sheetEntries.find((entry) => entry.name === sheetName);
  if (sheet?.state !== 'hidden') throw new Error(`Foglio avanzato non nascosto: ${sheetName}`);
}

const worksheetEntries = templateEntries.filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry));
const workbookFormulaXml = worksheetEntries.map((entry) => unzipEntry(workbookPath, entry).toString('utf8')).join('\n');
const unsupportedFormulaTokens = ['MAXIFS', 'RANK.EQ'];
for (const token of unsupportedFormulaTokens) {
  if (workbookFormulaXml.includes(token)) {
    throw new Error(`Formula Excel non compatibile nel pacchetto: ${token}`);
  }
}

const forbiddenVisibleCopy = [/excel\s+light/i, /json\s+light/i, /glm-excel-light/i, /modalit[aà]\s+light/i];
for (const pattern of forbiddenVisibleCopy) {
  if (pattern.test(workbookXml) || pattern.test(workbookFormulaXml)) {
    throw new Error(`Copy Excel obsoleto nel workbook: ${pattern}`);
  }
}

const selectedTabs = (workbookFormulaXml.match(/tabSelected="1"/g) ?? []).length;
if (selectedTabs > 1) {
  throw new Error(`Il workbook apre ${selectedTabs} fogli selezionati: deve aprirne uno solo`);
}

console.log('Pacchetto Excel valido');
