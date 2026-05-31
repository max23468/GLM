import { describe, expect, it } from "vitest";
import { CRITERIA, LOTS, PAIRS } from "../data/tender";
import {
  candidateLotScore,
  applyQualitativeReadyDefaults,
  computeWeightedRibasso,
  createBidder,
  economicBreakdown,
  pairBaseByPhase,
  resolvePhaseDiscounts,
  round4,
  setAverageDiscountValue,
  simulate,
  type Bidder,
  type Settings,
} from "./scoring";

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

const assignedLotCount = (result: ReturnType<typeof simulate>, bidderId: string) =>
  result.selectedScenario?.assignments
    .filter((assignment) => assignment.bidderId === bidderId)
    .reduce((sum, assignment) => sum + assignment.lotIds.length, 0) ?? 0;

describe("TPL tender scoring", () => {
  it("precompila come presenti i campi qualitativi per un nuovo concorrente", () => {
    const bidder = createBidder("a", "A");
    applyQualitativeReadyDefaults(bidder.lots.L1);

    for (const criterion of CRITERIA) {
      if (criterion.kind === "T") expect(bidder.lots.L1.tValues[criterion.id]).toBe(true);
      if (criterion.kind === "D") expect(bidder.lots.L1.dValues[criterion.id]).toBe(1);
      if (criterion.kind === "Q") expect(bidder.lots.L1.qValues[criterion.id]).toBe(0);
    }
  });

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

  it("calcola i tassi di copertura dagli input tecnici elementari", () => {
    const first = createBidder("a", "A");
    const second = createBidder("b", "B");
    first.lots.L1.enabled = true;
    second.lots.L1.enabled = true;
    first.lots.L1.qValues["C.1.2"] = 1;
    second.lots.L1.qValues["C.1.2"] = 1;
    first.lots.L1.quantityInputs["C.1.2"] = { numerator: 50, denominator: 100 };
    second.lots.L1.quantityInputs["C.1.2"] = { numerator: 80, denominator: 100 };

    const result = simulate([first, second], settings, first.id);

    expect(result.lotScores[first.id].L1.subScores["C.1.2"].value).toBe(0.5);
    expect(result.lotScores[first.id].L1.subScores["C.1.2"].rawScore).toBe(1.25);
    expect(result.lotScores[second.id].L1.subScores["C.1.2"].value).toBe(0.8);
    expect(result.lotScores[second.id].L1.subScores["C.1.2"].rawScore).toBe(2);
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

  it("keeps lot-specific scores for combinatory candidates", () => {
    const bidder = createBidder("a", "A");
    bidder.lots.L1.enabled = true;
    bidder.lots.L1.phaseDiscounts = [2, 2, 2];
    fillOffer(bidder, "L2", 2, 90);
    bidder.combos["L1+L2"] = { enabled: true, phaseDiscounts: [5, 5, 5], insertedInBothBuste: true, pefCoherent: true };

    const result = simulate([bidder], settings, bidder.id);
    const candidate = result.candidates.find((item) => item.kind === "combo" && item.pairId === "L1+L2");
    expect(candidate).toBeDefined();

    const expectedL1 = round4(result.lotScores[bidder.id].L1.technical + (result.comboScores[bidder.id]["L1+L2"].lotEconomic.L1 ?? 0));
    const expectedL2 = round4(result.lotScores[bidder.id].L2.technical + (result.comboScores[bidder.id]["L1+L2"].lotEconomic.L2 ?? 0));
    expect(candidate?.scoreByLot.L1).toBe(expectedL1);
    expect(candidate?.scoreByLot.L2).toBe(expectedL2);
    expect(candidateLotScore(candidate!, "L1")).toBe(expectedL1);
    expect(candidateLotScore(candidate!, "L2")).toBe(expectedL2);
    expect(candidateLotScore(candidate!, "L1")).not.toBe(candidateLotScore(candidate!, "L2"));
  });

  it("rejects a combinatory offer with the same direct amount as the single offers", () => {
    const bidder = createBidder("a", "A");
    fillOffer(bidder, "L1", 5, 80);
    fillOffer(bidder, "L2", 5, 80);
    bidder.combos["L1+L2"] = { enabled: true, phaseDiscounts: [5, 5, 5], insertedInBothBuste: true, pefCoherent: true };

    const result = simulate([bidder], settings, bidder.id);

    expect(result.comboScores[bidder.id]["L1+L2"].admissible).toBe(false);
    expect(result.comboScores[bidder.id]["L1+L2"].warnings.some((warning) => warning.includes("non economicamente migliorativo"))).toBe(true);
  });

  it("does not use the two-lot award derogation when all lots can be assigned under the ordinary limit", () => {
    const first = createBidder("a", "A");
    for (const lot of LOTS) fillOffer(first, lot.id, 8, 95);

    const second = createBidder("b", "B");
    fillOffer(second, "L3", 3, 70);
    fillOffer(second, "L4", 3, 70);

    const result = simulate([first, second], { ...settings, applyAwardLimitDerogation: true }, first.id);

    expect(result.selectedScenario?.unassignedLots).toEqual([]);
    expect(assignedLotCount(result, first.id)).toBeLessThanOrEqual(2);
    expect(result.selectedScenario?.awardLimitDerogationUsed).toBe(false);
  });

  it("uses the two-lot award derogation only when the ordinary limit leaves lots unassigned", () => {
    const bidder = createBidder("a", "A");
    for (const lot of LOTS) fillOffer(bidder, lot.id, 8, 95);

    const withoutDerogation = simulate([bidder], settings, bidder.id);
    const withDerogation = simulate([bidder], { ...settings, applyAwardLimitDerogation: true }, bidder.id);

    expect(assignedLotCount(withoutDerogation, bidder.id)).toBe(2);
    expect(withoutDerogation.selectedScenario?.unassignedLots).toHaveLength(2);
    expect(assignedLotCount(withDerogation, bidder.id)).toBe(4);
    expect(withDerogation.selectedScenario?.unassignedLots).toEqual([]);
    expect(withDerogation.selectedScenario?.awardLimitDerogationUsed).toBe(true);
    expect(withDerogation.warnings.some((warning) => warning.includes("Deroga al limite di due lotti applicata"))).toBe(true);
  });

  it("applies the configured threshold before economic ranking", () => {
    const bidder = createBidder("a", "A");
    bidder.lots.L1.enabled = true;
    bidder.lots.L1.phaseDiscounts = [10, 10, 10];

    const result = simulate([bidder], { ...settings, threshold: 43.4 }, bidder.id);

    expect(result.lotScores[bidder.id].L1.admitted).toBe(false);
    expect(result.lotScores[bidder.id].L1.singleEconomic).toBe(0);
    expect(result.warnings.some((warning) => warning.includes("Sotto soglia di sbarramento"))).toBe(true);
  });

  it("uses the imported aggregate technical override when sub-criteria are not available", () => {
    const bidder = createBidder("a", "A");
    bidder.lots.L1.enabled = true;
    bidder.lots.L1.technicalOverrideRaw = 42;
    bidder.lots.L1.phaseDiscounts = [5, 5, 5];

    const result = simulate([bidder], { ...settings, threshold: 36 }, bidder.id);
    const score = result.lotScores[bidder.id].L1;

    expect(score.qtRaw).toBe(42);
    expect(score.technical).toBe(42);
    expect(score.admitted).toBe(true);
    expect(score.warnings).toContain("Tecnico aggregato importato: sub-criteri non disponibili.");
  });

  it("includes admissible combinatory discounts in rMax for both lots", () => {
    const bidder = createBidder("a", "A");
    fillOffer(bidder, "L1", 2, 80);
    fillOffer(bidder, "L2", 2, 80);
    bidder.combos["L1+L2"] = { enabled: true, phaseDiscounts: [6, 6, 6], insertedInBothBuste: true, pefCoherent: true };

    const result = simulate([bidder], settings, bidder.id);

    expect(result.comboScores[bidder.id]["L1+L2"].admissible).toBe(true);
    expect(result.rMaxByLot.L1).toBe(0.06);
    expect(result.rMaxByLot.L2).toBe(0.06);
  });

  it("builds the All. 18 economic breakdown from phase bases and discounts", () => {
    const breakdown = economicBreakdown(LOTS[0].baseByPhase, [5, 5, 5]);

    expect(breakdown.baseTotal).toBe(LOTS[0].totalBase);
    expect(breakdown.ribasso).toBe(0.05);
    expect(breakdown.offeredTotal).toBe(LOTS[0].totalBase * 0.95);
    expect(round4(breakdown.phases.reduce((sum, phase) => sum + phase.weight, 0))).toBe(1);
  });

  it("uses documented phase bases for combinatory economic views", () => {
    const bases = pairBaseByPhase("L1+L2");

    expect(bases).toEqual([
      LOTS.find((lot) => lot.id === "L1")!.baseByPhase[0] + LOTS.find((lot) => lot.id === "L2")!.baseByPhase[0],
      LOTS.find((lot) => lot.id === "L1")!.baseByPhase[1] + LOTS.find((lot) => lot.id === "L2")!.baseByPhase[1],
      LOTS.find((lot) => lot.id === "L1")!.baseByPhase[2] + LOTS.find((lot) => lot.id === "L2")!.baseByPhase[2],
    ]);
  });

  it("flags a draw when total and technical scores are tied", () => {
    const first = createBidder("a", "A");
    const second = createBidder("b", "B");
    fillOffer(first, "L1", 4, 80);
    fillOffer(second, "L1", 4, 80);

    const result = simulate([first, second], settings, first.id);

    expect(result.selectedScenario?.drawRequired).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("sorteggio pubblico"))).toBe(true);
  });

  it("allinea il ribasso medio unico alle tre fasi per il calcolo economico", () => {
    const lot = LOTS[0];
    const byPhase = createBidder("a", "A");
    byPhase.lots.L1.enabled = true;
    byPhase.lots.L1.discountInputMode = "phases";
    byPhase.lots.L1.phaseDiscounts = [4, 6, 8];

    const byAverage = createBidder("b", "B");
    byAverage.lots.L1.enabled = true;
    byAverage.lots.L1 = setAverageDiscountValue(byAverage.lots.L1, 6);

    const phaseRibasso = computeWeightedRibasso(lot.baseByPhase, resolvePhaseDiscounts(byPhase.lots.L1));
    const averageRibasso = computeWeightedRibasso(lot.baseByPhase, resolvePhaseDiscounts(byAverage.lots.L1));

    expect(averageRibasso).toBe(computeWeightedRibasso(lot.baseByPhase, [6, 6, 6]));
    expect(simulate([byAverage], settings, byAverage.id).lotScores[byAverage.id].L1.singleRibasso).toBe(averageRibasso);
    expect(phaseRibasso).not.toBe(averageRibasso);
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
