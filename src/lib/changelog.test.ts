import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./version";
import { compareVersions, parseChangelog, releasedChangelog } from "./changelog";

describe("changelog", () => {
  it("estrae versioni, date, introduzioni e sezioni", () => {
    const entries = parseChangelog(`# Changelog

## [Non rilasciato]

### Non versionato

- Nota interna.

## [0.2.0] — 2026-05-20

Release di versioning.

### Novità

- **Versione**: scheda aggiornata.

### Sotto il cofano

- Script di release.
`);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      date: null,
      nonVersioned: false,
      unreleased: true,
      version: "Non rilasciato",
    });
    expect(entries[1]).toMatchObject({
      date: "2026-05-20",
      intro: "Release di versioning.",
      unreleased: false,
      version: "0.2.0",
    });
    expect(entries[1].sections).toEqual([
      { title: "Novità", items: ["**Versione**: scheda aggiornata."] },
      { title: "Sotto il cofano", items: ["Script di release."] },
    ]);
  });

  it("confronta versioni SemVer tollerando segmenti mancanti", () => {
    expect(compareVersions("0.2.0", "0.1.9")).toBe(1);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("0.1.0", "0.2.0")).toBe(-1);
  });

  it("contiene una voce rilasciata per la versione corrente", () => {
    expect(releasedChangelog.some((entry) => entry.version === APP_VERSION)).toBe(true);
  });
});
