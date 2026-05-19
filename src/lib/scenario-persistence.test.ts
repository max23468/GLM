import { describe, expect, it } from "vitest";
import { CRITERIA, LOTS, PAIRS } from "../data/tender";
import { normalizeScenarioSnapshot, normalizeStoredWorkspace } from "./scenario-persistence";

describe("scenario persistence normalization", () => {
  it("repairs partial imported bidders before simulation uses them", () => {
    const snapshot = normalizeScenarioSnapshot({
      id: "legacy",
      name: "Legacy",
      demoScenarioId: "market",
      bidders: [
        {
          id: "a",
          name: "Operatore A",
          lots: {
            L1: {
              enabled: true,
              qValues: { "A.1.1": 10 },
              quantityInputs: { "C.1.2": { numerator: 8, denominator: 10 } },
              phaseDiscounts: [5],
            },
          },
        },
      ],
      settings: { threshold: 999, applyAwardLimitDerogation: "yes" },
      selectedBidderId: "missing",
      selectedLotId: "bad",
      selectedPairId: "bad",
    });

    expect(snapshot).toBeDefined();
    expect(snapshot?.schemaVersion).toBe(7);
    expect(snapshot?.baseScenarioId).toBe("market");
    expect(snapshot?.optimization.mode).toBe("technical-economic");
    expect(snapshot?.optimization.scope).toBe("active-lot");
    expect(snapshot?.optimization.levers.L1?.["C.1.2"].unitCost).toBeGreaterThan(0);
    expect(snapshot?.settings.threshold).toBe(37);
    expect(snapshot?.settings.applyAwardLimitDerogation).toBe(false);
    expect(snapshot?.selectedBidderId).toBe("a");
    expect(snapshot?.selectedLotId).toBe("L1");
    expect(snapshot?.selectedPairId).toBe("L1+L4");

    const bidder = snapshot!.bidders[0];
    for (const lot of LOTS) expect(bidder.lots[lot.id]).toBeDefined();
    for (const pair of PAIRS) expect(bidder.combos[pair.id]).toBeDefined();
    for (const criterion of CRITERIA) {
      if (criterion.kind === "Q") expect(bidder.lots.L1.qValues[criterion.id]).toBeDefined();
      if (criterion.kind === "T") expect(bidder.lots.L1.tValues[criterion.id]).toBeDefined();
      if (criterion.kind === "D") expect(bidder.lots.L1.dValues[criterion.id]).toBeDefined();
      expect(bidder.lots.L1.tradeoffs[criterion.id]).toBeDefined();
    }
    expect(bidder.lots.L1.tradeoffs["C.1.2"].unitCost).toBeGreaterThan(0);
  });

  it("accepts the new baseScenarioId field and falls back to scenario defaults", () => {
    const workspace = normalizeStoredWorkspace({
      schemaVersion: 2,
      scenarioName: "",
      baseScenarioId: "local",
      bidders: [],
      settings: { threshold: 38, applyAwardLimitDerogation: true },
      selectedBidderId: "missing",
      selectedLotId: "missing",
      selectedPairId: "missing",
    });

    expect(workspace).toBeDefined();
    expect(workspace?.schemaVersion).toBe(7);
    expect(workspace?.baseScenarioId).toBe("local");
    expect(workspace?.optimization.mode).toBe("technical-economic");
    expect(workspace?.optimization.levers.L4?.["C.2.1"].unitCost).toBeGreaterThan(0);
    expect(workspace?.scenarioName).toBe("Presidio locale");
    expect(workspace?.settings).toEqual({ threshold: 38, applyAwardLimitDerogation: true });
    expect(workspace?.selectedLotId).toBe("L4");
    expect(workspace?.selectedPairId).toBe("L3+L4");
    expect(workspace?.bidders.length).toBeGreaterThan(0);
  });

  it("normalizza gli input di ottimizzazione negli snapshot importati", () => {
    const snapshot = normalizeScenarioSnapshot({
      id: "optimizer",
      baseScenarioId: "market",
      optimization: {
        budgetEnabled: true,
        budget: 500000,
        budgetMode: "technical",
        scope: "active-lots",
        economic: { enabled: false, stepPercent: 0.2, maxDeltaPercent: 1.5 },
        levers: {
          L1: {
            "C.1.2": { enabled: true, stepUnits: 5, maxUnits: 20, unitCost: 1000, denominator: 80 },
          },
        },
      },
      bidders: [{ id: "a", lots: { L1: { enabled: true } } }],
    });

    expect(snapshot).toBeDefined();
    expect(snapshot?.optimization.mode).toBe("technical-only");
    expect("budgetEnabled" in snapshot!.optimization).toBe(false);
    expect("budget" in snapshot!.optimization).toBe(false);
    expect("budgetMode" in snapshot!.optimization).toBe(false);
    expect("economic" in snapshot!.optimization).toBe(false);
    expect(snapshot?.optimization.scope).toBe("active-lots");
    expect(snapshot?.optimization.levers.L1?.["C.1.2"]).toEqual({
      enabled: true,
      granularityUnits: 5,
      maxUnits: 20,
      unitCost: 1000,
      denominator: 80,
    });
    expect(snapshot?.optimization.levers.L2?.["C.1.2"]).toBeDefined();
    expect(snapshot?.optimization.levers.L2?.["C.1.2"].unitCost).toBeGreaterThan(0);
    expect(snapshot?.optimization.levers.L1?.["B.5.1"].enabled).toBe(false);
  });
});
