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
    expect(snapshot?.baseScenarioId).toBe("market");
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
    expect(workspace?.baseScenarioId).toBe("local");
    expect(workspace?.scenarioName).toBe("Presidio locale");
    expect(workspace?.settings).toEqual({ threshold: 38, applyAwardLimitDerogation: true });
    expect(workspace?.selectedLotId).toBe("L4");
    expect(workspace?.selectedPairId).toBe("L3+L4");
    expect(workspace?.bidders.length).toBeGreaterThan(0);
  });
});
