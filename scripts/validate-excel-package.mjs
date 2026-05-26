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
const duplicateEntries = templateEntries.filter((entry, index) => templateEntries.indexOf(entry) !== index);
if (duplicateEntries.length) {
  throw new Error(`Template Excel con entry ZIP duplicate: ${[...new Set(duplicateEntries)].join(', ')}`);
}
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
  'Compila',
  'Report',
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

const expectedVisibleSheets = ['Dashboard', 'Compila', 'CriteriTecnici', 'Ottimizzazione', 'Combinatorie', 'Report', 'Guida'];
const expectedHiddenSheets = ['Parametri', 'Offerte', 'Risultati', 'Istruzioni', 'ScenarioGlobale', 'ScambioWeb', 'ConfrontoWeb', 'LogOttimizzazione', 'Glossario'];
for (const sheetName of expectedVisibleSheets) {
  const sheet = sheetEntries.find((entry) => entry.name === sheetName);
  if (sheet?.state !== 'visible') throw new Error(`Foglio operativo non visibile: ${sheetName}`);
}
for (const sheetName of expectedHiddenSheets) {
  const sheet = sheetEntries.find((entry) => entry.name === sheetName);
  if (sheet?.state !== 'hidden') throw new Error(`Foglio avanzato non nascosto: ${sheetName}`);
}

const worksheetEntries = templateEntries.filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry));
const workbookExtraEntries = templateEntries.filter((entry) => /^xl\/(tables\/table\d+|comments\d+|drawings\/drawing\d+)\.xml$/.test(entry));
const workbookFormulaXml = [...worksheetEntries, ...workbookExtraEntries].map((entry) => unzipEntry(workbookPath, entry).toString('utf8')).join('\n');
const worksheetRelEntries = templateEntries.filter((entry) => /^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(entry));
const commentDrawingTargets = new Map();
function resolveRelationshipTarget(relEntry, target) {
  if (target.startsWith('/')) return target.slice(1);
  const sourceEntry = relEntry.replace('/_rels/', '/').replace(/\.rels$/, '');
  const sourceDir = sourceEntry.slice(0, sourceEntry.lastIndexOf('/'));
  const parts = `${sourceDir}/${target}`.split('/');
  const resolved = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }
  return resolved.join('/');
}

for (const entry of worksheetRelEntries) {
  const xml = unzipEntry(workbookPath, entry).toString('utf8');
  const relationships = [...xml.matchAll(/<Relationship\b[^>]*>/g)].map((match) => match[0]);
  for (const relationship of relationships) {
    const type = relationship.match(/\bType="([^"]+)"/)?.[1] ?? '';
    const targetMode = relationship.match(/\bTargetMode="([^"]+)"/)?.[1] ?? '';
    const target = relationship.match(/\bTarget="([^"]+)"/)?.[1];
    if (target && targetMode !== 'External') {
      const resolvedTarget = resolveRelationshipTarget(entry, target);
      if (!templateEntries.includes(resolvedTarget)) {
        throw new Error(`Relazione worksheet pendente: ${entry} punta a ${target} (${resolvedTarget})`);
      }
    }
    if (!/\/(comments|vmlDrawing)$/.test(type)) continue;
    if (!target) continue;
    const key = `${type}:${target}`;
    const previous = commentDrawingTargets.get(key);
    if (previous) {
      throw new Error(`Relazione commenti/VML riusata da più fogli: ${target} in ${previous} e ${entry}`);
    }
    commentDrawingTargets.set(key, entry);
  }
}
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

const protectedSheets = (workbookFormulaXml.match(/<sheetProtection\b/g) ?? []).length;
if (protectedSheets < 6) {
  throw new Error(`Protezione selettiva insufficiente: trovati ${protectedSheets} fogli protetti`);
}

for (const token of ['tblCompilaOfferte', 'Cosa manca', 'Pulsanti operativi', 'Report risultati']) {
  if (!workbookFormulaXml.includes(token)) {
    throw new Error(`Elemento UX atteso assente nel workbook: ${token}`);
  }
}

console.log('Pacchetto Excel valido');
