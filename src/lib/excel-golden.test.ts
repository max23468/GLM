import { describe, expect, it } from "vitest";
import goldenCsv from "../../excel-vba/templates/golden-cases.csv?raw";
import { BASE_SCENARIOS } from "../data/base-scenarios";
import { LOTS, type LotId } from "../data/tender";
import { candidateLotScore, round4, simulate } from "./scoring";

const parseGoldenCases = () => {
  const [header, ...rows] = goldenCsv.trim().split(/\r?\n/);
  const keys = header.split(",");
  return rows.map((row) => {
    const values = row.split(",");
    return Object.fromEntries(keys.map((key, index) => [key, values[index] ?? ""]));
  });
};

describe("Excel golden cases", () => {
  it("allinea i casi golden ai risultati dei profili base web", () => {
    const cases = parseGoldenCases();
    expect(cases.length).toBeGreaterThanOrEqual(10);

    for (const testCase of cases) {
      const scenario = BASE_SCENARIOS.find((item) => item.id === testCase.Scenario);
      expect(scenario, testCase.Caso).toBeDefined();
      expect(LOTS.some((lot) => lot.id === testCase.LotId), testCase.Caso).toBe(true);
      const lotId = testCase.LotId as LotId;
      const result = simulate(scenario!.buildBidders(), scenario!.settings, scenario!.defaultBidderId);
      const actual = round4(result.candidates.reduce((best, candidate) => Math.max(best, candidateLotScore(candidate, lotId)), 0));
      const expected = Number(testCase.ExpectedTotal);
      const tolerance = Number(testCase.Tolerance);
      expect(Math.abs(actual - expected), `${testCase.Caso} ${testCase.Scenario} ${testCase.LotId}`).toBeLessThanOrEqual(tolerance);
    }
  });
});
