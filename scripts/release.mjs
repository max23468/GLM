#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const changelogPath = path.join(root, "CHANGELOG.md");
const versionPath = path.join(root, "src/lib/version.ts");
const packagePath = path.join(root, "package.json");
const packageLockPath = path.join(root, "package-lock.json");

const validBumps = new Set(["major", "minor", "patch", "none"]);
const majorSections = new Set(["breaking", "breaking changes", "rimosso"]);
const minorSections = new Set(["novita", "aggiunto"]);
const patchSections = new Set([
  "correzioni",
  "modificato",
  "risolto",
  "sicurezza",
  "sotto il cofano",
]);
const nonVersionedSections = new Set(["non versionato", "non rilasciabile", "nessuna release"]);

function fail(message) {
  console.error(`Errore release: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    bump: null,
    date: null,
    dryRun: false,
    help: false,
    version: null,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg.startsWith("--bump=")) {
      options.bump = arg.slice("--bump=".length);
      continue;
    }

    if (arg === "--bump") {
      options.bump = argv[++index];
      continue;
    }

    if (arg.startsWith("--version=")) {
      options.version = arg.slice("--version=".length);
      continue;
    }

    if (arg === "--version") {
      options.version = argv[++index];
      continue;
    }

    if (arg.startsWith("--date=")) {
      options.date = arg.slice("--date=".length);
      continue;
    }

    if (arg === "--date") {
      options.date = argv[++index];
      continue;
    }

    if (!options.bump && validBumps.has(arg)) {
      options.bump = arg;
      continue;
    }

    fail(`Argomento non riconosciuto: ${arg}`);
  }

  return options;
}

function showHelp() {
  console.log(`Uso:
  npm run release
  npm run release -- --dry-run
  npm run release -- --bump patch
  npm run release -- --bump none
  npm run release -- --version 0.3.0
  npm run release -- --date 2026-05-20

Senza --bump o --version, il bump viene inferito da CHANGELOG.md:
  major  se [Non rilasciato] contiene sezioni breaking o Rimosso
  minor  se contiene Novità o Aggiunto
  patch  se contiene solo Correzioni, Sicurezza, Modificato, Risolto o Sotto il cofano
  none   se contiene solo Non versionato

Se contiene sezioni non riconosciute, il comando si ferma.`);
}

function todayInRome() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Rome",
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function readCurrentVersion(packageJsonSource, versionSource) {
  const pkg = readPackageFile(packageJsonSource, "package.json");
  const dateMatch = versionSource.match(/export const BUILD_DATE = "([^"]+)";/);

  if (typeof pkg.version !== "string") fail("version non trovato in package.json.");
  if (!dateMatch) fail("BUILD_DATE non trovato in src/lib/version.ts.");

  return {
    buildDate: dateMatch[1],
    version: pkg.version,
  };
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) fail(`Versione SemVer non valida: ${version}`);
  return match.slice(1).map(Number);
}

function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);

  for (let index = 0; index < 3; index++) {
    if (left[index] > right[index]) return 1;
    if (left[index] < right[index]) return -1;
  }

  return 0;
}

function bumpVersion(currentVersion, bump) {
  const [major, minor, patch] = parseVersion(currentVersion);

  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  if (bump === "none") return currentVersion;

  fail(`Bump non valido: ${bump}`);
}

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function extractUnreleased(changelog, { allowEmpty = false } = {}) {
  const headerRegex = /^## \[Non rilasciato\]\s*$/m;
  const headerMatch = changelog.match(headerRegex);

  if (!headerMatch || headerMatch.index === undefined) {
    fail("Blocco ## [Non rilasciato] non trovato in CHANGELOG.md.");
  }

  const bodyStart = headerMatch.index + headerMatch[0].length;
  const afterHeader = changelog.slice(bodyStart);
  const nextHeaderIndex = afterHeader.search(/\n## \[[^\]]+\]/);

  if (nextHeaderIndex === -1) {
    fail("Nessuna release esistente trovata dopo ## [Non rilasciato].");
  }

  const rawBody = afterHeader.slice(0, nextHeaderIndex);
  const body = rawBody.trim();

  if (!body && !allowEmpty) {
    fail("Il blocco [Non rilasciato] è vuoto. Aggiungi almeno una voce prima di rilasciare.");
  }

  return {
    afterHeader,
    beforeHeader: changelog.slice(0, headerMatch.index),
    body,
    rest: afterHeader.slice(nextHeaderIndex),
  };
}

function sectionHasContent(body) {
  return body.split("\n").some((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith("<!--") && !trimmed.endsWith("-->");
  });
}

function parseSections(markdown) {
  const headings = [...markdown.matchAll(/^###\s+(.+)$/gm)];

  return headings.map((heading, index) => {
    const bodyStart = heading.index + heading[0].length;
    const bodyEnd = index + 1 < headings.length ? headings[index + 1].index : markdown.length;
    const body = markdown.slice(bodyStart, bodyEnd);

    return {
      hasContent: sectionHasContent(body),
      title: normalize(heading[1]),
    };
  });
}

function validateSections(unreleasedBody) {
  const sections = parseSections(unreleasedBody);
  const unknownSections = sections.filter(
    (section) =>
      !majorSections.has(section.title) &&
      !minorSections.has(section.title) &&
      !patchSections.has(section.title) &&
      !nonVersionedSections.has(section.title),
  );

  if (sections.length === 0) {
    fail("Il blocco [Non rilasciato] deve usare sezioni ### riconosciute.");
  }

  if (unknownSections.length > 0) {
    fail(
      `Sezioni changelog non riconosciute: ${unknownSections
        .map((section) => section.title)
        .join(", ")}. Usa Novità, Correzioni, Sotto il cofano, Rimosso oppure Non versionato.`,
    );
  }

  return sections;
}

function inferBump(unreleasedBody) {
  const sections = validateSections(unreleasedBody);
  const normalizedBody = normalize(unreleasedBody);
  const hasNonVersioned = sections.some(
    (section) => nonVersionedSections.has(section.title) && section.hasContent,
  );
  const hasVersioned = sections.some(
    (section) =>
      section.hasContent &&
      (majorSections.has(section.title) ||
        minorSections.has(section.title) ||
        patchSections.has(section.title)),
  );

  if (hasNonVersioned && hasVersioned) {
    fail(
      "Il blocco [Non rilasciato] mescola voci versionate e non versionate. Separa il lavoro prima di rilasciare.",
    );
  }

  if (hasNonVersioned) return "none";

  if (
    sections.some((section) => section.hasContent && majorSections.has(section.title)) ||
    /\bbreaking change\b/.test(normalizedBody)
  ) {
    return "major";
  }

  if (sections.some((section) => section.hasContent && minorSections.has(section.title))) {
    return "minor";
  }

  if (sections.some((section) => section.hasContent && patchSections.has(section.title))) {
    return "patch";
  }

  fail("Impossibile inferire la categoria dal blocco [Non rilasciato].");
}

function analyzeUnreleased(unreleasedBody) {
  const sections = parseSections(unreleasedBody);
  const hasNonVersioned = sections.some(
    (section) => section.hasContent && nonVersionedSections.has(section.title),
  );
  const hasMajor = sections.some(
    (section) => section.hasContent && majorSections.has(section.title),
  );
  const hasMinor = sections.some(
    (section) => section.hasContent && minorSections.has(section.title),
  );
  const hasPatch = sections.some(
    (section) => section.hasContent && patchSections.has(section.title),
  );

  if (hasNonVersioned) return "non versionato";
  if (hasMajor) return "major";
  if (hasMinor) return "minor";
  if (hasPatch) return "patch";
  return "patch";
}

function changelogAnchor(version, date) {
  return `#${version.replace(/\./g, "")}--${date}`;
}

function updateChangelog(changelog, release) {
  if (changelog.includes(`## [${release.version}]`)) {
    fail(`CHANGELOG.md contiene già una release ${release.version}.`);
  }

  if (changelog.includes(`[${release.version}]:`)) {
    fail(`CHANGELOG.md contiene già un link per ${release.version}.`);
  }

  const unreleased = extractUnreleased(changelog);
  const nextChangelog = `${unreleased.beforeHeader}## [Non rilasciato]\n\n## [${release.version}] — ${release.date}\n\n${unreleased.body}\n${unreleased.rest}`;
  const releaseLink = `[${release.version}]: ${changelogAnchor(release.version, release.date)}`;

  if (nextChangelog.includes("[Non rilasciato]: #non-rilasciato")) {
    return nextChangelog.replace(
      /^\[Non rilasciato\]: #non-rilasciato$/m,
      `[Non rilasciato]: #non-rilasciato\n${releaseLink}`,
    );
  }

  return nextChangelog;
}

function updateVersionFile(source, release) {
  return source.replace(/export const BUILD_DATE = "[^"]+";/, `export const BUILD_DATE = "${release.date}";`);
}

function readPackageFile(source, label) {
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`${label} non è JSON valido: ${error.message}`);
  }
}

function updatePackageJson(source, release) {
  const pkg = readPackageFile(source, "package.json");
  pkg.version = release.version;
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

function updatePackageLock(source, release) {
  const lock = readPackageFile(source, "package-lock.json");
  lock.version = release.version;
  if (lock.packages?.[""]) {
    lock.packages[""].version = release.version;
  }
  return `${JSON.stringify(lock, null, 2)}\n`;
}

function assertPackageVersions(current, packageLockSource) {
  const lock = readPackageFile(packageLockSource, "package-lock.json");
  const rootLockVersion = lock.packages?.[""]?.version;

  if (lock.version !== current.version || rootLockVersion !== current.version) {
    fail(
      `package-lock.json è a ${lock.version}/${rootLockVersion}, ma package.json è ${current.version}. Allinea prima di rilasciare.`,
    );
  }
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  showHelp();
  process.exit(0);
}

if (options.bump && !validBumps.has(options.bump)) {
  fail(`--bump deve essere major, minor, patch o none. Ricevuto: ${options.bump}`);
}

if (options.bump === "none" && options.version) {
  fail("--bump none non può essere usato insieme a --version.");
}

if (options.date && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
  fail(`--date deve usare il formato YYYY-MM-DD. Ricevuto: ${options.date}`);
}

if (options.version && !/^\d+\.\d+\.\d+$/.test(options.version)) {
  fail(`--version deve usare il formato X.Y.Z. Ricevuto: ${options.version}`);
}

const changelog = readFileSync(changelogPath, "utf8");
const versionFile = readFileSync(versionPath, "utf8");
const packageJson = readFileSync(packagePath, "utf8");
const packageLock = readFileSync(packageLockPath, "utf8");
const current = readCurrentVersion(packageJson, versionFile);
assertPackageVersions(current, packageLock);

const unreleased = extractUnreleased(changelog, { allowEmpty: options.dryRun });
if (!unreleased.body) {
  console.log("Nessuna voce da rilasciare: il blocco [Non rilasciato] è vuoto.");
  console.log("Prossimo passo: aggiungi una voce sotto Novità, Correzioni o Non versionato prima di preparare una release.");
  process.exit(0);
}
validateSections(unreleased.body);
const bump = options.bump ?? (options.version ? null : inferBump(unreleased.body));
const nextVersion = options.version ?? bumpVersion(current.version, bump);
const releaseDate = options.date ?? todayInRome();
const strategy = options.version ? "versione esplicita" : `bump ${bump}`;

if (bump === "none") {
  const sections = validateSections(unreleased.body);
  const hasVersioned = sections.some(
    (section) =>
      section.hasContent &&
      (majorSections.has(section.title) ||
        minorSections.has(section.title) ||
        patchSections.has(section.title)),
  );

  if (hasVersioned) {
    fail("--bump none può essere usato solo con voci Non versionato.");
  }

  console.log("Categoria: non versionato. Nessuna release SemVer da preparare.");
  console.log("Nessun file aggiornato.");
  process.exit(0);
}

if (
  validateSections(unreleased.body).some(
    (section) => section.hasContent && nonVersionedSections.has(section.title),
  )
) {
  fail(
    "Il blocco [Non rilasciato] contiene voci Non versionato. Separale dalle voci da rilasciare prima di generare una versione.",
  );
}

if (compareVersions(nextVersion, current.version) <= 0) {
  fail(
    `La nuova versione (${nextVersion}) deve essere maggiore della versione corrente (${current.version}).`,
  );
}

const nextChangelog = updateChangelog(changelog, {
  date: releaseDate,
  version: nextVersion,
});
const nextVersionFile = updateVersionFile(versionFile, {
  date: releaseDate,
  version: nextVersion,
});
const nextPackageJson = updatePackageJson(packageJson, { version: nextVersion });
const nextPackageLock = updatePackageLock(packageLock, { version: nextVersion });

if (options.dryRun) {
  console.log(`Dry-run release Simulatore gara TPL lotti 1-4 ${nextVersion} (${releaseDate})`);
  console.log(`Versione corrente: ${current.version} (${current.buildDate})`);
  console.log(`Strategia: ${strategy}`);
  console.log(`Analisi blocco [Non rilasciato]: ${analyzeUnreleased(unreleased.body)}`);
  console.log("File che verrebbero aggiornati:");
  console.log("- CHANGELOG.md");
  console.log("- src/lib/version.ts (data build)");
  console.log("- package.json");
  console.log("- package-lock.json");
  process.exit(0);
}

writeFileSync(changelogPath, nextChangelog);
writeFileSync(versionPath, nextVersionFile);
writeFileSync(packagePath, nextPackageJson);
writeFileSync(packageLockPath, nextPackageLock);

console.log(`Release Simulatore gara TPL lotti 1-4 ${nextVersion} preparata (${releaseDate}, ${strategy}).`);
console.log("Aggiornati CHANGELOG.md, src/lib/version.ts (data build), package.json e package-lock.json.");
