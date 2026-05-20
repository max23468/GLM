import { describe, expect, it } from "vitest";
import { SCENARIO_LIBRARY_ITEMS } from "./scenario-library";
import { normalizeScenarioSnapshot } from "../lib/scenario-persistence";
import mercatoRealistico from "../../public/scenarios/mercato-realistico.json";
import tecnologiaFlotta from "../../public/scenarios/tecnologia-flotta.json";
import ribassoAggressivo from "../../public/scenarios/ribasso-aggressivo.json";
import presidioLocale from "../../public/scenarios/presidio-locale.json";

const snapshotsByPath: Record<string, unknown> = {
  "/scenarios/mercato-realistico.json": mercatoRealistico,
  "/scenarios/tecnologia-flotta.json": tecnologiaFlotta,
  "/scenarios/ribasso-aggressivo.json": ribassoAggressivo,
  "/scenarios/presidio-locale.json": presidioLocale,
};

describe("libreria scenari GitHub", () => {
  it("espone snapshot JSON versionati e importabili", () => {
    expect(SCENARIO_LIBRARY_ITEMS.length).toBeGreaterThan(0);
    expect(new Set(SCENARIO_LIBRARY_ITEMS.map((item) => item.id)).size).toBe(SCENARIO_LIBRARY_ITEMS.length);
    expect(new Set(SCENARIO_LIBRARY_ITEMS.map((item) => item.path)).size).toBe(SCENARIO_LIBRARY_ITEMS.length);

    for (const item of SCENARIO_LIBRARY_ITEMS) {
      expect(item.path, item.id).toMatch(/^\/scenarios\/.+\.json$/);
      expect(item.updatedAt, item.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const snapshot = normalizeScenarioSnapshot(snapshotsByPath[item.path]);
      expect(snapshot, item.id).toBeDefined();
      expect(snapshot?.baseScenarioId, item.id).toBe(item.baseScenarioId);
      expect(snapshot?.name, item.id).toContain("Libreria GitHub");
      expect(snapshot?.bidders.length, item.id).toBeGreaterThan(0);
      expect(snapshot?.optimization.levers[snapshot.selectedLotId], item.id).toBeDefined();
    }
  });
});
