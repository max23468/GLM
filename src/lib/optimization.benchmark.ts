import { describe, expect, it } from "vitest";
import { BASE_SCENARIOS } from "../data/base-scenarios";
import { optimizeOffer } from "./optimization";

type BenchmarkRow = {
  scenario: string;
  bidderId: string;
  lotId: string;
  steps: number;
  objectiveDelta: number;
  durationMs: number;
};

const maxDurationMs = 15_000;

describe("optimization benchmark", () => {
  it("mantiene misurabile il costo sui profili base", () => {
    const rows: BenchmarkRow[] = [];
    const startedAt = performance.now();

    for (const scenario of BASE_SCENARIOS) {
      const bidders = scenario.buildBidders();
      const scenarioStartedAt = performance.now();
      const result = optimizeOffer(
        bidders,
        scenario.settings,
        scenario.defaultBidderId,
        scenario.defaultLotId,
        scenario.buildOptimizationConfig(),
      );

      rows.push({
        scenario: scenario.id,
        bidderId: scenario.defaultBidderId,
        lotId: scenario.defaultLotId,
        steps: result.steps.length,
        objectiveDelta: Number(result.objectiveDelta.toFixed(4)),
        durationMs: Number((performance.now() - scenarioStartedAt).toFixed(2)),
      });
    }

    const durationMs = performance.now() - startedAt;
    console.table(rows);
    expect(rows.every((row) => row.steps > 0)).toBe(true);
    expect(durationMs).toBeLessThan(maxDurationMs);
  });
});
