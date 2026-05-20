import changelogRaw from "../../CHANGELOG.md?raw";

export type ChangelogSection = {
  title: string;
  items: string[];
};

export type ChangelogEntry = {
  version: string;
  date: string | null;
  unreleased: boolean;
  nonVersioned: boolean;
  intro?: string;
  sections: ChangelogSection[];
};

function normalizeSectionTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("it-IT");
}

export function isEndUserChangelogSection(title: string): boolean {
  const normalized = normalizeSectionTitle(title);

  if (
    /cofano|intern|tecnic|build|deploy|refactor|process|svilupp|\bci\b|test|release|script|dipenden|repository|\brepo\b|commit|\bpr\b/.test(
      normalized,
    )
  ) {
    return false;
  }

  return /novit|aggiun|correz|risol|sicurez|modific|miglior|rimos|breaking|accessibil|layout|warning|changelog/.test(
    normalized,
  );
}

export function hasEndUserChangelogContent(entry: ChangelogEntry): boolean {
  return entry.sections.some(
    (section) => isEndUserChangelogSection(section.title) && section.items.length > 0,
  );
}

export function parseChangelog(raw: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const headerRegex = /^##\s+\[([^\]]+)\](?:\s+[—–-]\s+(\d{4}-\d{2}-\d{2}))?/gm;
  const matches = [...raw.matchAll(headerRegex)];

  for (let index = 0; index < matches.length; index++) {
    const match = matches[index];
    const start = match.index! + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index! : raw.length;
    let body = raw.slice(start, end).trim();

    const separatorIndex = body.indexOf("\n---");
    if (separatorIndex !== -1) body = body.slice(0, separatorIndex).trim();

    const version = match[1].trim();
    const date = match[2] ?? null;
    const unreleased = /non\s+rilasciato/i.test(version);
    const nonVersioned = /non\s+versionato/i.test(version);
    const sectionRegex = /^###\s+(.+)$/gm;
    const sectionMatches = [...body.matchAll(sectionRegex)];
    const intro =
      sectionMatches.length > 0
        ? body.slice(0, sectionMatches[0].index!).trim() || undefined
        : body.trim() || undefined;

    const sections: ChangelogSection[] = sectionMatches.map((sectionMatch, sectionIndex) => {
      const sectionStart = sectionMatch.index! + sectionMatch[0].length;
      const sectionEnd =
        sectionIndex + 1 < sectionMatches.length
          ? sectionMatches[sectionIndex + 1].index!
          : body.length;
      const sectionBody = body.slice(sectionStart, sectionEnd).trim();
      const items = sectionBody
        .split(/\n/)
        .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
        .filter((line) => line.length > 0);
      return { title: sectionMatch[1].trim(), items };
    });

    entries.push({ version, date, unreleased, nonVersioned, intro, sections });
  }

  return entries;
}

export const changelog: ChangelogEntry[] = parseChangelog(changelogRaw);

export const releasedChangelog: ChangelogEntry[] = changelog.filter(
  (entry) => !entry.unreleased && !entry.nonVersioned && hasEndUserChangelogContent(entry),
);

export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split(".").map((part) => Number.parseInt(part, 10) || 0);

  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const leftPart = left[index] ?? 0;
    const rightPart = right[index] ?? 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}
