import { describe, expect, it } from "vitest";
import { LOTS, PAIRS } from "../data/tender";
import { normalizeScenarioSnapshotWithReport, normalizeStoredWorkspace } from "./scenario-persistence";
import { resolvePhaseDiscounts, simulate } from "./scoring";

const dirtyImportFixtures = [
  {
    name: "snapshot manuale con lotti incompleti e valori fuori range",
    payload: {
      schemaVersion: 3,
      baseScenarioId: "market",
      id: "dirty-manual",
      name: "Manuale sporco",
      bidders: [
        {
          id: "operatore",
          name: "Operatore manuale",
          lots: {
            L1: {
              enabled: "true",
              qValues: { "A.1.1": "18", "F.1.1": "bad" },
              tValues: { "C.2.2": 1 },
              dValues: { "B.5.1": 2 },
              phaseDiscounts: [150, -4, "6"],
            },
          },
        },
        {
          id: "operatore",
          name: "Operatore duplicato",
          lots: {
            L2: {
              enabled: true,
              phaseDiscounts: ["3", "4", "5"],
              quantityInputs: { "C.1.2": { numerator: "15", denominator: "30" } },
            },
          },
        },
      ],
      optimization: {
        budgetMode: "strategic",
        levers: {
          L1: {
            "C.1.2": { enabled: true, stepUnits: "5", maxUnits: "25", unitCost: "1200", denominator: "80" },
          },
        },
      },
      selectedBidderId: "missing",
      selectedLotId: "bad-lot",
      selectedPairId: "bad-pair",
    },
  },
  {
    name: "libreria esportata con primo scenario incapsulato",
    payload: {
      format: "glm-scenario-library-v1",
      scenarios: [
        {
          schemaVersion: 6,
          demoScenarioId: "local",
          id: "dirty-library-first",
          name: "Libreria sporca",
          bidders: [{ id: "local-a", lots: { L4: { enabled: true, phaseDiscounts: [4] } } }],
        },
      ],
    },
  },
  {
    name: "Excel light aggregato senza criteri",
    payload: {
      excelLight: {
        format: "glm-excel-light-v1",
        name: "Excel aggregato sporco",
        offers: [{ bidderId: "excel-a", bidderName: "Excel A", lotId: "L1", enabled: 1, technicalRaw: "44", discount: "5.5" }],
      },
    },
  },
] as const;

describe("scenario persistence dirty import fixtures", () => {
  it.each(dirtyImportFixtures)("$name resta importabile e simulabile", ({ payload }) => {
    const report = normalizeScenarioSnapshotWithReport(payload);

    expect(report.snapshot, report.messages.join(" | ")).toBeDefined();
    expect(report.messages.length).toBeGreaterThan(0);

    const snapshot = report.snapshot!;
    expect(snapshot.schemaVersion).toBe(8);
    expect(snapshot.bidders.length).toBeGreaterThan(0);
    expect(snapshot.bidders.map((bidder) => bidder.id)).toEqual([...new Set(snapshot.bidders.map((bidder) => bidder.id))]);

    for (const bidder of snapshot.bidders) {
      for (const lot of LOTS) {
        expect(bidder.lots[lot.id], `${bidder.id} ${lot.id}`).toBeDefined();
        expect(resolvePhaseDiscounts(bidder.lots[lot.id]).every((discount) => discount >= 0 && discount <= 100)).toBe(true);
      }
      for (const pair of PAIRS) expect(bidder.combos[pair.id], `${bidder.id} ${pair.id}`).toBeDefined();
    }

    const result = simulate(snapshot.bidders, snapshot.settings, snapshot.selectedBidderId);
    expect(result.scenarios.length).toBeGreaterThan(0);
    expect(result.warningItems.every((warning) => warning.id && warning.title && warning.message)).toBe(true);
  });

  it("ripara workspace locale con notifiche e focus corrotti senza bloccare l'app", () => {
    const workspace = normalizeStoredWorkspace({
      schemaVersion: 4,
      scenarioName: "Workspace sporco",
      baseScenarioId: "discount",
      bidders: [{ id: "a", lots: { L3: { enabled: "1", phaseDiscounts: [7] } } }],
      selectedBidderId: "missing",
      selectedLotId: "L9",
      selectedPairId: "bad",
      notifications: [
        { tone: "error", title: "Errore import", body: "Dettaglio", read: 0 },
        { tone: "invalid", title: "Avviso", body: 42 },
      ],
    });

    expect(workspace).toBeDefined();
    expect(workspace?.selectedBidderId).toBe("a");
    expect(workspace?.selectedLotId).toBe("L2");
    expect(workspace?.selectedPairId).toBe("L2+L3");
    expect(workspace?.notifications).toHaveLength(2);
    expect(workspace?.notifications[1].tone).toBe("info");
  });
});
