import { CalendarDays, GitBranch, Settings2, ShieldCheck, Sparkles, Wrench, type LucideIcon } from "lucide-react";
import { changelog, releasedChangelog, type ChangelogEntry, type ChangelogSection } from "../lib/changelog";
import { APP_VERSION, BUILD_DATE } from "../lib/version";
import { HelpTooltip } from "./help-tooltip";

type ReleaseCategory = "highlight" | "fix" | "internal";

const CATEGORY_META: Record<ReleaseCategory, { icon: LucideIcon; label: string }> = {
  highlight: { icon: Sparkles, label: "Novità" },
  fix: { icon: Wrench, label: "Correzioni" },
  internal: { icon: Settings2, label: "Sotto il cofano" },
};

function formatDate(date: string | null): string | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

function categorizeSection(title: string): ReleaseCategory {
  const normalized = title.toLocaleLowerCase("it-IT");
  if (/novit|aggiun/.test(normalized)) return "highlight";
  if (/cofano|intern|tecnic|build|deploy|refactor|process/.test(normalized)) return "internal";
  if (/sicurez/.test(normalized)) return "fix";
  return "fix";
}

function groupSections(sections: ChangelogSection[]): Record<ReleaseCategory, ChangelogSection[]> {
  return sections.reduce<Record<ReleaseCategory, ChangelogSection[]>>(
    (groups, section) => {
      groups[categorizeSection(section.title)].push(section);
      return groups;
    },
    { highlight: [], fix: [], internal: [] },
  );
}

function sectionIcon(category: ReleaseCategory, sections: ChangelogSection[]) {
  if (category === "fix" && sections.some((section) => /sicurez/i.test(section.title))) {
    return ShieldCheck;
  }
  return CATEGORY_META[category].icon;
}

function currentRelease(entries: ChangelogEntry[]): ChangelogEntry | undefined {
  return (
    entries.find((entry) => entry.version === APP_VERSION) ??
    entries.find((entry) => !entry.unreleased && !entry.nonVersioned) ??
    entries[0]
  );
}

function ChangelogItem({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
        }
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

function ReleaseEntry({ entry, compact = false }: { entry: ChangelogEntry; compact?: boolean }) {
  const groups = groupSections(entry.sections);
  const dateLabel = formatDate(entry.date);

  return (
    <article className={compact ? "release-entry compact" : "release-entry"}>
      <div className="release-entry-header">
        <div>
          <strong>v{entry.version}</strong>
          {entry.version === APP_VERSION && <span className="release-badge">In uso</span>}
        </div>
        {dateLabel && <time dateTime={entry.date ?? undefined}>{dateLabel}</time>}
      </div>
      {entry.intro && <p className="release-intro">{entry.intro}</p>}
      <div className="release-sections">
        {(["highlight", "fix", "internal"] as const).map((category) => {
          const sections = groups[category];
          if (sections.length === 0) return null;
          const Icon = sectionIcon(category, sections);
          return (
            <div className={`release-section ${category}`} key={category}>
              <div className="release-section-heading">
                <Icon size={14} />
                <span>{CATEGORY_META[category].label}</span>
              </div>
              <ul>
                {sections.flatMap((section) =>
                  section.items.map((item) => (
                    <li key={`${section.title}-${item}`}>
                      <ChangelogItem text={item} />
                    </li>
                  )),
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function ReleasePanel() {
  const entries = releasedChangelog.length > 0 ? releasedChangelog : changelog;
  const activeRelease = currentRelease(entries);
  const previousReleases = activeRelease
    ? entries.filter((entry) => entry.version !== activeRelease.version).slice(0, 3)
    : [];
  const buildDateLabel = formatDate(BUILD_DATE);

  return (
    <section className="panel release-panel">
      <div className="section-title">
        <GitBranch size={18} />
        Versione e changelog
        <HelpTooltip>
          Versione e note sono incluse nella build da src/lib/version.ts e CHANGELOG.md.
        </HelpTooltip>
      </div>

      <div className="release-version-row">
        <div>
          <span>Versione app</span>
          <strong>v{APP_VERSION}</strong>
        </div>
        <div>
          <span>Build</span>
          <strong>{buildDateLabel ?? BUILD_DATE}</strong>
        </div>
      </div>

      {activeRelease ? (
        <ReleaseEntry entry={activeRelease} />
      ) : (
        <div className="release-card">
          <span>Changelog</span>
          <p>Nessuna versione documentata.</p>
        </div>
      )}

      {previousReleases.length > 0 && (
        <details className="release-history">
          <summary>
            <CalendarDays size={14} />
            Storico recente
          </summary>
          <div className="release-history-list">
            {previousReleases.map((entry) => (
              <ReleaseEntry key={entry.version} entry={entry} compact />
            ))}
          </div>
        </details>
      )}

    </section>
  );
}
