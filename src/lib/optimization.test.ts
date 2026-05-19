import { describe, expect, it } from "vitest";
import { LOTS } from "../data/tender";
import { createBidder, type Bidder, type Settings } from "./scoring";
import { defaultOptimizationConfig, optimizeOffer, type OptimizationConfig } from "./optimization";

const settings: Settings = {
  threshold: 0,
  applyAwardLimitDerogation: false,
};

const enableLot = (bidder: Bidder, lotId: (typeof LOTS)[number]["id"], ribasso: number) => {
  bidder.lots[lotId].enabled = true;
  bidder.lots[lotId].phaseDiscounts = [ribasso, ribasso, ribasso];
};

describe("offer optimization", () => {
  it("ottimizza senza richiedere un budget di partenza", () => {
    const bidder = createBidder("a", "A");
    const competitor = createBidder("b", "B");
    enableLot(bidder, "L1", 3);
    enableLot(competitor, "L1", 3);
    bidder.lots.L1.quantityInputs["C.1.2"] = { numerator: 10, denominator: 100 };
    bidder.lots.L1.qValues["C.1.2"] = 0.1;
    competitor.lots.L1.quantityInputs["C.1.2"] = { numerator: 100, denominator: 100 };
    competitor.lots.L1.qValues["C.1.2"] = 1;

    const config: OptimizationConfig = {
      ...defaultOptimizationConfig(),
      budgetEnabled: false,
      budget: 0,
      budgetMode: "technical",
      scope: "active-lot",
      levers: {
        L1: {
          "C.1.2": { enabled: true, stepUnits: 10, maxUnits: 20, unitCost: 1000, denominator: 100 },
        },
      },
    };

    const result = optimizeOffer([bidder, competitor], settings, bidder.id, "L1", config);

    expect(result.budgetEnabled).toBe(false);
    expect(result.remainingBudget).toBeNull();
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.usedBudget).toBeGreaterThan(0);
    expect(result.objectiveDelta).toBeGreaterThan(0);
  });

  it("applica il budget solo quando il vincolo è attivo", () => {
    const bidder = createBidder("a", "A");
    const competitor = createBidder("b", "B");
    enableLot(bidder, "L1", 3);
    enableLot(competitor, "L1", 3);
    bidder.lots.L1.quantityInputs["C.1.2"] = { numerator: 10, denominator: 100 };
    bidder.lots.L1.qValues["C.1.2"] = 0.1;
    competitor.lots.L1.quantityInputs["C.1.2"] = { numerator: 100, denominator: 100 };
    competitor.lots.L1.qValues["C.1.2"] = 1;

    const config: OptimizationConfig = {
      ...defaultOptimizationConfig(),
      budgetEnabled: true,
      budget: 20_000,
      budgetMode: "technical",
      scope: "active-lot",
      levers: {
        L1: {
          "C.1.2": { enabled: true, stepUnits: 10, maxUnits: 20, unitCost: 1000, denominator: 100 },
        },
      },
    };

    const result = optimizeOffer([bidder, competitor], settings, bidder.id, "L1", config);

    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps.every((step) => step.kind === "technical")).toBe(true);
    expect(result.budgetEnabled).toBe(true);
    expect(result.usedBudget).toBeLessThanOrEqual(20_000);
    expect(result.remainingBudget).not.toBeNull();
    expect(result.objectiveDelta).toBeGreaterThan(0);
    expect(result.optimizedBidders[0].lots.L1.quantityInputs["C.1.2"].numerator).toBeGreaterThan(10);
  });

  it("confronta la leva economica quando le leve considerate includono il ribasso", () => {
    const bidder = createBidder("a", "A");
    const competitor = createBidder("b", "B");
    enableLot(bidder, "L1", 2);
    enableLot(competitor, "L1", 4);

    const config: OptimizationConfig = {
      ...defaultOptimizationConfig(),
      budgetEnabled: false,
      budget: 0,
      budgetMode: "strategic",
      scope: "active-lot",
      economic: { enabled: true, stepPercent: 0.1, maxDeltaPercent: 0.2 },
      levers: {},
    };

    const result = optimizeOffer([bidder, competitor], settings, bidder.id, "L1", config);

    expect(result.steps.some((step) => step.kind === "economic")).toBe(true);
    expect(result.optimizedBidders[0].lots.L1.phaseDiscounts[0]).toBeGreaterThan(2);
    expect(result.objectiveDelta).toBeGreaterThan(0);
  });

  it("esclude i criteri discrezionali dal piano automatico", () => {
    const bidder = createBidder("a", "A");
    const competitor = createBidder("b", "B");
    enableLot(bidder, "L1", 3);
    enableLot(competitor, "L1", 3);
    bidder.lots.L1.dValues["B.5.1"] = 0.1;
    competitor.lots.L1.dValues["B.5.1"] = 1;

    const config: OptimizationConfig = {
      ...defaultOptimizationConfig(),
      budgetEnabled: false,
      budget: 0,
      budgetMode: "technical",
      scope: "active-lot",
      levers: {
        L1: {
          "B.5.1": { enabled: true, stepUnits: 1, maxUnits: 1, unitCost: 1000, denominator: 0 },
        },
      },
    };

    const result = optimizeOffer([bidder, competitor], settings, bidder.id, "L1", config);

    expect(result.steps.some((step) => step.criterionId === "B.5.1")).toBe(false);
  });
});
