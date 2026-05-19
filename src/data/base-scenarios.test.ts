import { describe, expect, it } from "vitest";
import { BASE_SCENARIOS } from "./base-scenarios";
import { CRITERIA, LOTS } from "./tender";
import { optimizeOffer } from "../lib/optimization";

const automaticCriteria = CRITERIA.filter((criterion) => criterion.kind !== "D");
const discretionaryCriteria = CRITERIA.filter((criterion) => criterion.kind === "D");

describe("base scenarios", () => {
  it("precompilano le leve di ottimizzazione per tutti i lotti", () => {
    for (const scenario of BASE_SCENARIOS) {
      const config = scenario.buildOptimizationConfig();

      expect(config.mode).toBe("technical-economic");

      for (const lot of LOTS) {
        for (const criterion of automaticCriteria) {
          const lever = config.levers[lot.id]?.[criterion.id];
          expect(lever, `${scenario.id} ${lot.id} ${criterion.id}`).toBeDefined();
          expect(lever?.enabled, `${scenario.id} ${lot.id} ${criterion.id}`).toBe(true);
          expect(lever?.granularityUnits, `${scenario.id} ${lot.id} ${criterion.id}`).toBeGreaterThan(0);
          expect(lever?.maxUnits, `${scenario.id} ${lot.id} ${criterion.id}`).toBeGreaterThan(0);
          expect(lever?.unitCost, `${scenario.id} ${lot.id} ${criterion.id}`).toBeGreaterThan(0);
          if (criterion.quantityInput?.kind === "ratio" || criterion.input === "ratio") {
            expect(lever?.granularityUnits, `${scenario.id} ${lot.id} ${criterion.id}`).toBe(1);
          }
          if (criterion.quantityInput || criterion.input === "ratio") {
            expect(lever?.denominator, `${scenario.id} ${lot.id} ${criterion.id}`).toBeGreaterThan(0);
          }
        }

        for (const criterion of discretionaryCriteria) {
          const lever = config.levers[lot.id]?.[criterion.id];
          expect(lever, `${scenario.id} ${lot.id} ${criterion.id}`).toBeDefined();
          expect(lever?.enabled, `${scenario.id} ${lot.id} ${criterion.id}`).toBe(false);
          expect(lever?.unitCost, `${scenario.id} ${lot.id} ${criterion.id}`).toBe(0);
        }
      }
    }
  });

  it("precompilano anche i costi dell'analisi puntuale criterio", () => {
    for (const scenario of BASE_SCENARIOS) {
      const bidders = scenario.buildBidders();
      expect(bidders.length).toBeGreaterThan(0);

      for (const bidder of bidders) {
        for (const lot of LOTS) {
          for (const criterion of automaticCriteria) {
            const tradeoff = bidder.lots[lot.id].tradeoffs[criterion.id];
            expect(tradeoff, `${scenario.id} ${bidder.id} ${lot.id} ${criterion.id}`).toBeDefined();
            expect(tradeoff.deltaUnits, `${scenario.id} ${bidder.id} ${lot.id} ${criterion.id}`).toBeGreaterThan(0);
            expect(tradeoff.unitCost, `${scenario.id} ${bidder.id} ${lot.id} ${criterion.id}`).toBeGreaterThan(0);
            if (criterion.quantityInput || criterion.input === "ratio") {
              expect(tradeoff.denominator, `${scenario.id} ${bidder.id} ${lot.id} ${criterion.id}`).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });

  it("rendono subito calcolabile un piano di ottimizzazione per il focus di default", () => {
    for (const scenario of BASE_SCENARIOS) {
      const bidders = scenario.buildBidders();
      const result = optimizeOffer(
        bidders,
        scenario.settings,
        scenario.defaultBidderId,
        scenario.defaultLotId,
        scenario.buildOptimizationConfig(),
      );

      expect(result.steps.length, scenario.id).toBeGreaterThan(0);
      expect(result.steps.reduce((sum, step) => sum + step.cost, 0), scenario.id).toBeGreaterThan(0);
      expect(result.objectiveDelta, scenario.id).toBeGreaterThan(0);
    }
  }, 15000);
});
