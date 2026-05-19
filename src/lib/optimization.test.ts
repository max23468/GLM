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
  it("ottimizza le leve tecniche senza richiedere tetti esterni", () => {
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
      mode: "technical-only",
      scope: "active-lot",
      levers: {
        L1: {
          "C.1.2": { enabled: true, granularityUnits: 1, maxUnits: 20, unitCost: 1000, denominator: 100 },
        },
      },
    };

    const result = optimizeOffer([bidder, competitor], settings, bidder.id, "L1", config);
    const planCost = result.steps.reduce((sum, step) => sum + step.cost, 0);

    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps.every((step) => step.kind === "technical")).toBe(true);
    expect(result.steps[0].units).toBeGreaterThan(1);
    expect(planCost).toBeGreaterThan(0);
    expect(result.objectiveDelta).toBeGreaterThan(0);
  });

  it("non crea ribasso diretto non finanziato da una rinuncia tecnica", () => {
    const bidder = createBidder("a", "A");
    const competitor = createBidder("b", "B");
    enableLot(bidder, "L1", 2);
    enableLot(competitor, "L1", 4);

    const config: OptimizationConfig = {
      ...defaultOptimizationConfig(),
      mode: "technical-economic",
      scope: "active-lot",
      levers: {},
    };

    const result = optimizeOffer([bidder, competitor], settings, bidder.id, "L1", config);

    expect(result.steps.some((step) => step.kind === "reallocation")).toBe(false);
    expect(result.optimizedBidders[0].lots.L1.phaseDiscounts[0]).toBe(2);
  });

  it("esclude il ribasso quando la modalità è solo tecnica", () => {
    const bidder = createBidder("a", "A");
    const competitor = createBidder("b", "B");
    enableLot(bidder, "L1", 2);
    enableLot(competitor, "L1", 4);
    bidder.lots.L1.quantityInputs["C.1.2"] = { numerator: 100, denominator: 100 };
    bidder.lots.L1.qValues["C.1.2"] = 1;
    competitor.lots.L1.quantityInputs["C.1.2"] = { numerator: 100, denominator: 100 };
    competitor.lots.L1.qValues["C.1.2"] = 1;

    const config: OptimizationConfig = {
      ...defaultOptimizationConfig(),
      mode: "technical-only",
      scope: "active-lot",
      levers: {
        L1: {
          "C.1.2": { enabled: true, granularityUnits: 1, maxUnits: 100, unitCost: 100_000, denominator: 100 },
        },
      },
    };

    const result = optimizeOffer([bidder, competitor], settings, bidder.id, "L1", config);

    expect(result.steps.some((step) => step.kind === "reallocation")).toBe(false);
    expect(result.optimizedBidders[0].lots.L1.phaseDiscounts[0]).toBe(2);
  });

  it("può riallocare una rinuncia tecnica per finanziare più ribasso", () => {
    const bidder = createBidder("a", "A");
    const competitor = createBidder("b", "B");
    enableLot(bidder, "L1", 2);
    enableLot(competitor, "L1", 4);
    bidder.lots.L1.quantityInputs["C.1.2"] = { numerator: 100, denominator: 100 };
    bidder.lots.L1.qValues["C.1.2"] = 1;
    competitor.lots.L1.quantityInputs["C.1.2"] = { numerator: 100, denominator: 100 };
    competitor.lots.L1.qValues["C.1.2"] = 1;

    const config: OptimizationConfig = {
      ...defaultOptimizationConfig(),
      mode: "technical-economic",
      scope: "active-lot",
      levers: {
        L1: {
          "C.1.2": { enabled: true, granularityUnits: 1, maxUnits: 100, unitCost: 100_000, denominator: 100 },
        },
      },
    };

    const result = optimizeOffer([bidder, competitor], settings, bidder.id, "L1", config);
    const reallocation = result.steps.find((step) => step.kind === "reallocation");

    expect(reallocation).toBeDefined();
    expect(reallocation?.criterionId).toBe("C.1.2");
    expect(reallocation?.releasedValue).toBeGreaterThan(0);
    expect(reallocation?.economicUnits).toBeGreaterThan(0);
    expect(reallocation?.economicUnits).toBeCloseTo(((reallocation?.releasedValue ?? 0) * 100) / LOTS.find((lot) => lot.id === "L1")!.totalBase, 4);
    expect(reallocation?.technicalDelta).toBeLessThan(0);
    expect(reallocation?.economicDelta).toBeGreaterThan(0);
    expect(result.optimizedBidders[0].lots.L1.quantityInputs["C.1.2"].numerator).toBeLessThan(100);
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
      mode: "technical-only",
      scope: "active-lot",
      levers: {
        L1: {
          "B.5.1": { enabled: true, granularityUnits: 1, maxUnits: 1, unitCost: 1000, denominator: 0 },
        },
      },
    };

    const result = optimizeOffer([bidder, competitor], settings, bidder.id, "L1", config);

    expect(result.steps.some((step) => step.criterionId === "B.5.1")).toBe(false);
  });
});
