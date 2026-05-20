import { describe, expect, it } from "vitest";
import { BASE_SCENARIOS } from "./base-scenarios";
import { CRITERIA, LOTS } from "./tender";

const automaticCriteria = CRITERIA.filter((criterion) => criterion.kind !== "D");

describe("base scenarios validation", () => {
  it("compila tutti gli input necessari per il catalogo leve tecniche", () => {
    for (const scenario of BASE_SCENARIOS) {
      const config = scenario.buildOptimizationConfig();
      expect("economic" in config, scenario.id).toBe(false);

      for (const lot of LOTS) {
        const lotLevers = config.levers[lot.id];
        expect(lotLevers, `${scenario.id} ${lot.id}`).toBeDefined();

        for (const criterion of automaticCriteria) {
          const lever = lotLevers?.[criterion.id];
          const needsBase = criterion.kind === "Q" && (criterion.input === "ratio" || Boolean(criterion.quantityInput));
          expect(lever, `${scenario.id} ${lot.id} ${criterion.id}`).toBeDefined();
          expect(lever?.enabled, `${scenario.id} ${lot.id} ${criterion.id}`).toBe(true);
          expect(lever?.unitCost, `${scenario.id} ${lot.id} ${criterion.id}`).toBeGreaterThan(0);
          expect(lever?.granularityUnits, `${scenario.id} ${lot.id} ${criterion.id}`).toBeGreaterThan(0);
          expect(lever?.maxUnits, `${scenario.id} ${lot.id} ${criterion.id}`).toBeGreaterThan(0);
          if (needsBase) {
            expect(lever?.denominator, `${scenario.id} ${lot.id} ${criterion.id}`).toBeGreaterThan(0);
          } else {
            expect(lever?.denominator, `${scenario.id} ${lot.id} ${criterion.id}`).toBe(0);
          }
        }
      }
    }
  });

  it("mantiene coerenti tradeoff puntuali e leve di ottimizzazione negli scenari base", () => {
    for (const scenario of BASE_SCENARIOS) {
      const config = scenario.buildOptimizationConfig();
      const bidders = scenario.buildBidders();
      expect(bidders.length, scenario.id).toBeGreaterThan(0);

      for (const bidder of bidders) {
        for (const lot of LOTS) {
          expect(bidder.lots[lot.id], `${scenario.id} ${bidder.id} ${lot.id}`).toBeDefined();
          expect(bidder.lots[lot.id].phaseDiscounts, `${scenario.id} ${bidder.id} ${lot.id}`).toHaveLength(3);

          for (const criterion of automaticCriteria) {
            const tradeoff = bidder.lots[lot.id].tradeoffs[criterion.id];
            const lever = config.levers[lot.id]?.[criterion.id];
            expect(tradeoff, `${scenario.id} ${bidder.id} ${lot.id} ${criterion.id}`).toBeDefined();
            expect(tradeoff.unitCost, `${scenario.id} ${bidder.id} ${lot.id} ${criterion.id}`).toBe(lever?.unitCost);
            expect(tradeoff.deltaUnits, `${scenario.id} ${bidder.id} ${lot.id} ${criterion.id}`).toBe(lever?.granularityUnits);
            expect(tradeoff.denominator, `${scenario.id} ${bidder.id} ${lot.id} ${criterion.id}`).toBe(lever?.denominator);
          }
        }
      }
    }
  });
});
