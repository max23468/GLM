import { describe, expect, it } from "vitest";
import { CRITERIA, LOTS, PAIRS } from "../data/tender";
import { createBidder, simulate, type Bidder, type Settings } from "./scoring";

const settings: Settings = {
  threshold: 0,
  applyAwardLimitDerogation: false,
};

const fillOffer = (bidder: Bidder, lotId: (typeof LOTS)[number]["id"], ribasso: number, technicalSeed: number) => {
  const offer = bidder.lots[lotId];
  offer.enabled = true;
  offer.phaseDiscounts = [ribasso, ribasso, ribasso];
  for (const criterion of CRITERIA) {
    if (criterion.kind === "Q") {
      offer.qValues[criterion.id] = criterion.formula === "lower" ? Math.max(1, 100 - technicalSeed) : technicalSeed;
      if (criterion.formula === "soil") offer.qValues[criterion.id] = 0;
      if (criterion.input === "ratio") offer.qValues[criterion.id] = Math.min(1, technicalSeed / 100);
    }
    if (criterion.kind === "T") offer.tValues[criterion.id] = true;
    if (criterion.kind === "D") offer.dValues[criterion.id] = 0.7;
  }
};

describe("TPL tender scoring", () => {
  it("keeps lot participation separate for each operator", () => {
    const first = createBidder("a", "A");
    const second = createBidder("b", "B");
    fillOffer(first, "L1", 4, 80);
    fillOffer(second, "L2", 4, 80);

    const result = simulate([first, second], settings, first.id);

    expect(result.lotScores[first.id].L1.participates).toBe(true);
    expect(result.lotScores[first.id].L2.participates).toBe(false);
    expect(result.lotScores[second.id].L1.participates).toBe(false);
    expect(result.lotScores[second.id].L2.participates).toBe(true);
  });

  it("marks a combinatory offer inadmissible when single lots are not both active", () => {
    const bidder = createBidder("a", "A");
    fillOffer(bidder, "L1", 4, 80);
    bidder.combos["L1+L2"] = { enabled: true, phaseDiscounts: [6, 6, 6], insertedInBothBuste: true, pefCoherent: true };

    const result = simulate([bidder], settings, bidder.id);

    expect(result.comboScores[bidder.id]["L1+L2"].admissible).toBe(false);
    expect(result.comboScores[bidder.id]["L1+L2"].warnings).toContain("L'offerta combinatoria richiede offerte singole su entrambi i lotti.");
  });

  it("uses the admissible combinatory assignment when it maximizes the scenario", () => {
    const first = createBidder("a", "A");
    fillOffer(first, "L1", 3, 80);
    fillOffer(first, "L2", 3, 80);
    first.combos["L1+L2"] = { enabled: true, phaseDiscounts: [5, 5, 5], insertedInBothBuste: true, pefCoherent: true };

    const second = createBidder("b", "B");
    fillOffer(second, "L1", 2, 60);
    fillOffer(second, "L2", 2, 60);

    const result = simulate([first, second], settings, first.id);

    expect(result.comboScores[first.id]["L1+L2"].admissible).toBe(true);
    expect(result.selectedScenario?.assignments.some((assignment) => assignment.kind === "combo" && assignment.pairId === "L1+L2")).toBe(true);
  });

  it("rejects overlapping combinatory pairs for the same bidder", () => {
    const bidder = createBidder("a", "A");
    for (const lot of ["L1", "L2", "L3"] as const) fillOffer(bidder, lot, 3, 80);
    bidder.combos["L1+L2"] = { enabled: true, phaseDiscounts: [5, 5, 5], insertedInBothBuste: true, pefCoherent: true };
    bidder.combos["L2+L3"] = { enabled: true, phaseDiscounts: [5, 5, 5], insertedInBothBuste: true, pefCoherent: true };

    const result = simulate([bidder], settings, bidder.id);

    for (const pair of ["L1+L2", "L2+L3"] as (typeof PAIRS)[number]["id"][]) {
      expect(result.comboScores[bidder.id][pair].admissible).toBe(false);
      expect(result.comboScores[bidder.id][pair].warnings.some((warning) => warning.includes("sovrapposta"))).toBe(true);
    }
  });
});
