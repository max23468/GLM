import { CRITERIA, LOTS, type Criterion, type LotId } from "../data/tender";
import {
  candidateLotScore,
  getQuantitativeCriterionValue,
  round4,
  simulate,
  type Bidder,
  type Settings,
  type SimulationResult,
  type TradeoffPlan,
} from "./scoring";
import { applyTradeoffPlanToOffer, defaultTradeoff } from "./tradeoff";

export type OptimizationBudgetMode = "strategic" | "technical";
export type OptimizationScope = "active-lot" | "active-lots" | "scenario";

export type OptimizationLeverInput = {
  enabled: boolean;
  stepUnits: number;
  maxUnits: number;
  unitCost: number;
  denominator: number;
};

export type OptimizationEconomicInput = {
  enabled: boolean;
  stepPercent: number;
  maxDeltaPercent: number;
};

export type OptimizationConfig = {
  budget: number;
  budgetMode: OptimizationBudgetMode;
  scope: OptimizationScope;
  economic: OptimizationEconomicInput;
  levers: Partial<Record<LotId, Record<string, OptimizationLeverInput>>>;
};

export type OptimizationStep = {
  id: string;
  kind: "technical" | "economic";
  lotId: LotId;
  criterionId?: string;
  criterionLabel?: string;
  ambit?: string;
  title: string;
  units: number;
  unitLabel: string;
  cost: number;
  objectiveDelta: number;
  efficiency: number;
  afterScore: number;
};

export type OptimizationAreaSummary = {
  key: string;
  label: string;
  cost: number;
  objectiveDelta: number;
};

export type OptimizationResult = {
  initialScore: number;
  finalScore: number;
  objectiveDelta: number;
  budget: number;
  usedBudget: number;
  remainingBudget: number;
  optimizedBidders: Bidder[];
  optimizedSimulation: SimulationResult;
  steps: OptimizationStep[];
  areas: OptimizationAreaSummary[];
  warnings: string[];
};

type OptimizationCandidate = Omit<OptimizationStep, "id" | "afterScore"> & {
  bidders: Bidder[];
  score: number;
};

export const defaultOptimizationConfig = (): OptimizationConfig => ({
  budget: 1_000_000,
  budgetMode: "strategic",
  scope: "active-lot",
  economic: {
    enabled: true,
    stepPercent: 0.1,
    maxDeltaPercent: 2,
  },
  levers: {},
});

export const defaultOptimizationLever = (criterion: Criterion, tradeoff?: TradeoffPlan): OptimizationLeverInput => ({
  enabled: criterion.kind !== "D",
  stepUnits: Math.max(0, tradeoff?.deltaUnits || (criterion.kind === "T" ? 1 : 1)),
  maxUnits: 0,
  unitCost: Math.max(0, tradeoff?.unitCost ?? 0),
  denominator: Math.max(0, tradeoff?.denominator ?? 0),
});

export const getOptimizationLever = (config: OptimizationConfig, lotId: LotId, criterion: Criterion, tradeoff?: TradeoffPlan) =>
  config.levers[lotId]?.[criterion.id] ?? defaultOptimizationLever(criterion, tradeoff);

export const optimizeOffer = (
  bidders: Bidder[],
  settings: Settings,
  selectedBidderId: string,
  selectedLotId: LotId,
  config: OptimizationConfig,
): OptimizationResult => {
  const initialBidders = structuredClone(bidders);
  let currentBidders = structuredClone(bidders);
  const budget = Math.max(0, config.budget || 0);
  let remainingBudget = budget;
  const initialSimulation = simulate(initialBidders, settings, selectedBidderId);
  let currentSimulation = initialSimulation;
  const initialScore = objectiveScore(initialSimulation, currentBidders, selectedBidderId, selectedLotId, config.scope);
  let currentScore = initialScore;
  const steps: OptimizationStep[] = [];
  const warnings: string[] = [];

  if (!currentBidders.some((bidder) => bidder.id === selectedBidderId)) {
    return emptyOptimizationResult(initialSimulation, currentBidders, budget, "Offerente selezionato non trovato nello scenario.");
  }

  const targetLots = getTargetLots(currentBidders, selectedBidderId, selectedLotId, config.scope);
  if (!targetLots.length) {
    return emptyOptimizationResult(initialSimulation, currentBidders, budget, "Nessun lotto attivo disponibile per l'ottimizzazione.");
  }

  for (let iteration = 0; iteration < 200; iteration += 1) {
    const candidates = buildCandidates({
      baselineBidders: initialBidders,
      currentBidders,
      currentSimulation,
      settings,
      selectedBidderId,
      selectedLotId,
      targetLots,
      config,
      remainingBudget,
      currentScore,
    });
    const best = candidates.sort((a, b) => {
      if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
      if (b.objectiveDelta !== a.objectiveDelta) return b.objectiveDelta - a.objectiveDelta;
      return a.cost - b.cost;
    })[0];

    if (!best || best.objectiveDelta <= 0.0001) break;
    currentBidders = best.bidders;
    currentSimulation = simulate(currentBidders, settings, selectedBidderId);
    currentScore = best.score;
    remainingBudget = Math.max(0, remainingBudget - best.cost);
    steps.push({
      id: `step-${steps.length + 1}`,
      kind: best.kind,
      lotId: best.lotId,
      criterionId: best.criterionId,
      criterionLabel: best.criterionLabel,
      ambit: best.ambit,
      title: best.title,
      units: best.units,
      unitLabel: best.unitLabel,
      cost: round4(best.cost),
      objectiveDelta: round4(best.objectiveDelta),
      efficiency: round4(best.efficiency),
      afterScore: round4(best.score),
    });
  }

  if (!steps.length) {
    warnings.push("Nessuna leva produce un miglioramento positivo con budget, massimali e costi correnti.");
  }

  return {
    initialScore: round4(initialScore),
    finalScore: round4(currentScore),
    objectiveDelta: round4(currentScore - initialScore),
    budget,
    usedBudget: round4(budget - remainingBudget),
    remainingBudget: round4(remainingBudget),
    optimizedBidders: currentBidders,
    optimizedSimulation: currentSimulation,
    steps,
    areas: summarizeAreas(steps),
    warnings,
  };
};

const emptyOptimizationResult = (simulation: SimulationResult, bidders: Bidder[], budget: number, warning: string): OptimizationResult => ({
  initialScore: 0,
  finalScore: 0,
  objectiveDelta: 0,
  budget,
  usedBudget: 0,
  remainingBudget: budget,
  optimizedBidders: structuredClone(bidders),
  optimizedSimulation: simulation,
  steps: [],
  areas: [],
  warnings: [warning],
});

const getTargetLots = (bidders: Bidder[], selectedBidderId: string, selectedLotId: LotId, scope: OptimizationScope): LotId[] => {
  const bidder = bidders.find((item) => item.id === selectedBidderId);
  if (!bidder) return [];
  if (scope === "active-lot") return bidder.lots[selectedLotId].enabled ? [selectedLotId] : [];
  return LOTS.filter((lot) => bidder.lots[lot.id].enabled).map((lot) => lot.id);
};

const objectiveScore = (simulation: SimulationResult, bidders: Bidder[], selectedBidderId: string, selectedLotId: LotId, scope: OptimizationScope) => {
  const bidder = bidders.find((item) => item.id === selectedBidderId);
  if (!bidder) return 0;

  if (scope === "scenario") {
    return round4(
      simulation.selectedScenario?.assignments
        .filter((assignment) => assignment.bidderId === selectedBidderId)
        .reduce((sum, assignment) => sum + assignment.lotIds.reduce((lotSum, lotId) => lotSum + candidateLotScore(assignment, lotId), 0), 0) ?? 0,
    );
  }

  const lotIds = scope === "active-lot" ? [selectedLotId] : LOTS.filter((lot) => bidder.lots[lot.id].enabled).map((lot) => lot.id);
  return round4(lotIds.reduce((sum, lotId) => sum + (simulation.lotScores[selectedBidderId]?.[lotId].singleTotal ?? 0), 0));
};

const buildCandidates = ({
  baselineBidders,
  currentBidders,
  currentSimulation,
  settings,
  selectedBidderId,
  selectedLotId,
  targetLots,
  config,
  remainingBudget,
  currentScore,
}: {
  baselineBidders: Bidder[];
  currentBidders: Bidder[];
  currentSimulation: SimulationResult;
  settings: Settings;
  selectedBidderId: string;
  selectedLotId: LotId;
  targetLots: LotId[];
  config: OptimizationConfig;
  remainingBudget: number;
  currentScore: number;
}): OptimizationCandidate[] => {
  const candidates: OptimizationCandidate[] = [];
  const bidder = currentBidders.find((item) => item.id === selectedBidderId);
  const baselineBidder = baselineBidders.find((item) => item.id === selectedBidderId);
  if (!bidder || !baselineBidder) return candidates;

  for (const lotId of targetLots) {
    const currentOffer = bidder.lots[lotId];
    const baselineOffer = baselineBidder.lots[lotId];
    if (!currentOffer.enabled) continue;

    for (const criterion of CRITERIA) {
      if (criterion.kind === "D") continue;
      const lever = getOptimizationLever(config, lotId, criterion, currentOffer.tradeoffs[criterion.id] ?? defaultTradeoff());
      if (!lever.enabled) continue;
      const stepUnits = nextTechnicalStepUnits(baselineOffer, currentOffer, currentBidders, lotId, criterion, lever);
      if (stepUnits <= 0) continue;
      const cost = criterion.kind === "T" ? Math.max(0, lever.unitCost) : stepUnits * Math.max(0, lever.unitCost);
      if (cost <= 0) continue;
      if (cost > remainingBudget) continue;

      const nextBidders = structuredClone(currentBidders);
      const nextBidder = nextBidders.find((item) => item.id === selectedBidderId);
      if (!nextBidder) continue;
      const plan = technicalStepToTradeoff(criterion, lever, stepUnits);
      applyTradeoffPlanToOffer(nextBidder.lots[lotId], criterion, plan);
      const nextSimulation = simulate(nextBidders, settings, selectedBidderId);
      const nextScore = objectiveScore(nextSimulation, nextBidders, selectedBidderId, selectedLotId, config.scope);
      const objectiveDelta = round4(nextScore - currentScore);
      if (objectiveDelta <= 0) continue;

      candidates.push({
        kind: "technical",
        lotId,
        criterionId: criterion.id,
        criterionLabel: criterion.label,
        ambit: criterion.ambit,
        title: `${lotId} - ${criterion.id} ${criterion.label}`,
        units: stepUnits,
        unitLabel: criterion.kind === "T" ? "impegno" : criterion.tradeoffUnit,
        cost,
        objectiveDelta,
        efficiency: efficiency(objectiveDelta, cost),
        score: nextScore,
        bidders: nextBidders,
      });
    }

    if (config.budgetMode === "strategic" && config.economic.enabled) {
      const economicStep = nextEconomicStepUnits(baselineOffer, currentOffer, config.economic);
      const lot = LOTS.find((item) => item.id === lotId);
      const cost = lot ? (lot.totalBase * economicStep) / 100 : 0;
      if (economicStep > 0 && cost <= remainingBudget) {
        const nextBidders = structuredClone(currentBidders);
        const nextBidder = nextBidders.find((item) => item.id === selectedBidderId);
        if (nextBidder) {
          nextBidder.lots[lotId].phaseDiscounts = nextBidder.lots[lotId].phaseDiscounts.map((discount) => discount + economicStep) as [number, number, number];
          const nextSimulation = simulate(nextBidders, settings, selectedBidderId);
          const nextScore = objectiveScore(nextSimulation, nextBidders, selectedBidderId, selectedLotId, config.scope);
          const objectiveDelta = round4(nextScore - currentScore);
          if (objectiveDelta > 0) {
            candidates.push({
              kind: "economic",
              lotId,
              title: `${lotId} - aumenta il ribasso medio`,
              units: economicStep,
              unitLabel: "p.p. ribasso",
              cost,
              objectiveDelta,
              efficiency: efficiency(objectiveDelta, cost),
              score: nextScore,
              bidders: nextBidders,
            });
          }
        }
      }
    }
  }

  return candidates;
};

const technicalStepToTradeoff = (criterion: Criterion, lever: OptimizationLeverInput, stepUnits: number): TradeoffPlan => ({
  deltaUnits: criterion.kind === "T" ? 1 : stepUnits,
  unitCost: criterion.kind === "T" ? lever.unitCost : lever.unitCost,
  denominator: lever.denominator,
});

const nextTechnicalStepUnits = (
  baselineOffer: Bidder["lots"][LotId],
  currentOffer: Bidder["lots"][LotId],
  bidders: Bidder[],
  lotId: LotId,
  criterion: Criterion,
  lever: OptimizationLeverInput,
) => {
  if (criterion.kind === "T") return currentOffer.tValues[criterion.id] ? 0 : 1;
  const step = Math.max(0, lever.stepUnits || 0);
  if (step <= 0) return 0;
  const maxUnits = resolvedMaxUnits(baselineOffer, currentOffer, bidders, lotId, criterion, lever);
  const baselineUnits = technicalUnits(baselineOffer, criterion, lever);
  const currentUnits = technicalUnits(currentOffer, criterion, lever);
  const usedUnits =
    criterion.formula === "lower" || criterion.formula === "soil"
      ? Math.max(0, baselineUnits - currentUnits)
      : Math.max(0, currentUnits - baselineUnits);
  return Math.min(step, Math.max(0, maxUnits - usedUnits));
};

const resolvedMaxUnits = (
  baselineOffer: Bidder["lots"][LotId],
  currentOffer: Bidder["lots"][LotId],
  bidders: Bidder[],
  lotId: LotId,
  criterion: Criterion,
  lever: OptimizationLeverInput,
) => {
  if (lever.maxUnits > 0) return lever.maxUnits;
  const currentValue = Number(getQuantitativeCriterionValue(currentOffer, criterion)) || 0;
  if (criterion.quantityInput) {
    const input = currentOffer.quantityInputs[criterion.id];
    const denominator = lever.denominator > 0 ? lever.denominator : input?.denominator ?? 0;
    return Math.max(0, denominator - (input?.numerator ?? 0));
  }
  if (criterion.input === "ratio") {
    const denominator = lever.denominator > 0 ? lever.denominator : 0;
    return denominator > 0 ? Math.max(0, (1 - currentValue) * denominator) : 0;
  }
  if (criterion.formula === "lower" || criterion.formula === "soil") {
    return Math.max(0, Number(getQuantitativeCriterionValue(baselineOffer, criterion)) || 0);
  }
  const bestValue = Math.max(
    0,
    ...bidders
      .filter((bidder) => bidder.lots[lotId].enabled)
      .map((bidder) => Number(getQuantitativeCriterionValue(bidder.lots[lotId], criterion)) || 0),
  );
  return Math.max(0, bestValue - currentValue);
};

const technicalUnits = (offer: Bidder["lots"][LotId], criterion: Criterion, lever: OptimizationLeverInput) => {
  if (criterion.quantityInput) {
    const input = offer.quantityInputs[criterion.id];
    return Math.max(0, input?.numerator ?? 0);
  }
  const value = Number(getQuantitativeCriterionValue(offer, criterion)) || 0;
  if (criterion.input === "ratio") return value * Math.max(0, lever.denominator);
  return Math.max(0, value);
};

const nextEconomicStepUnits = (baselineOffer: Bidder["lots"][LotId], currentOffer: Bidder["lots"][LotId], economic: OptimizationEconomicInput) => {
  const step = Math.max(0, economic.stepPercent || 0);
  const maxDelta = Math.max(0, economic.maxDeltaPercent || 0);
  if (step <= 0 || maxDelta <= 0) return 0;
  const baselineAverage = averageDiscount(baselineOffer.phaseDiscounts);
  const currentAverage = averageDiscount(currentOffer.phaseDiscounts);
  const usedDelta = Math.max(0, currentAverage - baselineAverage);
  return Math.min(step, Math.max(0, maxDelta - usedDelta));
};

const averageDiscount = (discounts: [number, number, number]) => discounts.reduce((sum, value) => sum + value, 0) / discounts.length;

const efficiency = (delta: number, cost: number) => (cost > 0 ? delta / cost : delta);

const summarizeAreas = (steps: OptimizationStep[]): OptimizationAreaSummary[] => {
  const map = new Map<string, OptimizationAreaSummary>();
  for (const step of steps) {
    const key = step.kind === "economic" ? "economica" : step.ambit ?? "tecnica";
    const label = step.kind === "economic" ? "Offerta economica" : `Ambito ${key}`;
    const current = map.get(key) ?? { key, label, cost: 0, objectiveDelta: 0 };
    current.cost = round4(current.cost + step.cost);
    current.objectiveDelta = round4(current.objectiveDelta + step.objectiveDelta);
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => {
    if (b.objectiveDelta !== a.objectiveDelta) return b.objectiveDelta - a.objectiveDelta;
    return b.cost - a.cost;
  });
};
