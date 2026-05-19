import { CRITERIA, LOTS, type Criterion, type LotId } from "../data/tender";
import {
  candidateLotScore,
  computeQuantityInputValue,
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
  budgetEnabled: boolean;
  budget: number;
  budgetMode: OptimizationBudgetMode;
  scope: OptimizationScope;
  economic: OptimizationEconomicInput;
  levers: Partial<Record<LotId, Record<string, OptimizationLeverInput>>>;
};

export type OptimizationStep = {
  id: string;
  kind: "technical" | "economic" | "reallocation";
  lotId: LotId;
  criterionId?: string;
  criterionLabel?: string;
  ambit?: string;
  title: string;
  units: number;
  unitLabel: string;
  cost: number;
  budgetImpact: number;
  releasedBudget?: number;
  economicUnits?: number;
  technicalDelta?: number;
  economicDelta?: number;
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
  budgetEnabled: boolean;
  budget: number;
  usedBudget: number;
  remainingBudget: number | null;
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
  budgetEnabled: false,
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
  const budgetEnabled = config.budgetEnabled === true;
  const budget = Math.max(0, config.budget || 0);
  let remainingBudget = budgetEnabled ? budget : Number.POSITIVE_INFINITY;
  const initialSimulation = simulate(initialBidders, settings, selectedBidderId);
  let currentSimulation = initialSimulation;
  const initialScore = objectiveScore(initialSimulation, currentBidders, selectedBidderId, selectedLotId, config.scope);
  let currentScore = initialScore;
  const steps: OptimizationStep[] = [];
  const warnings: string[] = [];

  if (!currentBidders.some((bidder) => bidder.id === selectedBidderId)) {
    return emptyOptimizationResult(initialSimulation, currentBidders, budgetEnabled, budget, "Offerente selezionato non trovato nello scenario.");
  }

  const targetLots = getTargetLots(currentBidders, selectedBidderId, selectedLotId, config.scope);
  if (!targetLots.length) {
    return emptyOptimizationResult(initialSimulation, currentBidders, budgetEnabled, budget, "Nessun lotto attivo disponibile per l'ottimizzazione.");
  }

  for (let iteration = 0; iteration < 1000; iteration += 1) {
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
      if (!budgetEnabled) {
        if (b.objectiveDelta !== a.objectiveDelta) return b.objectiveDelta - a.objectiveDelta;
        if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
        return a.cost - b.cost;
      }
      if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
      if (b.objectiveDelta !== a.objectiveDelta) return b.objectiveDelta - a.objectiveDelta;
      return a.cost - b.cost;
    })[0];

    if (!best || best.objectiveDelta <= 0.0001) break;
    currentBidders = best.bidders;
    currentSimulation = simulate(currentBidders, settings, selectedBidderId);
    currentScore = best.score;
    if (budgetEnabled) remainingBudget = Math.max(0, remainingBudget - best.budgetImpact);
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
      budgetImpact: round4(best.budgetImpact),
      releasedBudget: best.releasedBudget === undefined ? undefined : round4(best.releasedBudget),
      economicUnits: best.economicUnits === undefined ? undefined : round4(best.economicUnits),
      technicalDelta: best.technicalDelta === undefined ? undefined : round4(best.technicalDelta),
      economicDelta: best.economicDelta === undefined ? undefined : round4(best.economicDelta),
      objectiveDelta: round4(best.objectiveDelta),
      efficiency: round4(best.efficiency),
      afterScore: round4(best.score),
    });
  }

  if (!steps.length) {
    warnings.push(
      budgetEnabled
        ? "Nessuna leva produce un miglioramento positivo con budget, massimali e costi correnti."
        : "Nessuna leva produce un miglioramento positivo con massimali, costi e input correnti.",
    );
  }

  const usedBudget = steps.reduce((sum, step) => sum + step.budgetImpact, 0);

  return {
    initialScore: round4(initialScore),
    finalScore: round4(currentScore),
    objectiveDelta: round4(currentScore - initialScore),
    budgetEnabled,
    budget,
    usedBudget: round4(usedBudget),
    remainingBudget: budgetEnabled ? round4(Math.max(0, budget - usedBudget)) : null,
    optimizedBidders: currentBidders,
    optimizedSimulation: currentSimulation,
    steps,
    areas: summarizeAreas(steps),
    warnings,
  };
};

const emptyOptimizationResult = (
  simulation: SimulationResult,
  bidders: Bidder[],
  budgetEnabled: boolean,
  budget: number,
  warning: string,
): OptimizationResult => ({
  initialScore: 0,
  finalScore: 0,
  objectiveDelta: 0,
  budgetEnabled,
  budget,
  usedBudget: 0,
  remainingBudget: budgetEnabled ? budget : null,
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
      if (!config.budgetEnabled && isBelowInitialTechnicalOffer(baselineOffer, currentOffer, criterion, lever)) continue;
      const stepUnits = nextTechnicalStepUnits(baselineOffer, currentOffer, currentBidders, lotId, criterion, lever);
      if (stepUnits <= 0) continue;
      const cost = criterion.kind === "T" ? Math.max(0, lever.unitCost) : stepUnits * Math.max(0, lever.unitCost);
      if (cost <= 0) continue;
      if (config.budgetEnabled && cost > remainingBudget) continue;

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
        budgetImpact: cost,
        objectiveDelta,
        efficiency: efficiency(objectiveDelta, cost),
        score: nextScore,
        bidders: nextBidders,
      });
    }

    const reallocationCandidates =
      config.budgetMode === "strategic" && config.economic.enabled
        ? buildReallocationCandidates({
            baselineOffer,
            currentBidders,
            currentOffer,
            currentScore,
            lotId,
            remainingBudget,
            selectedBidderId,
            selectedLotId,
            settings,
            config,
          })
        : [];
    candidates.push(...reallocationCandidates);

    if (config.budgetMode === "strategic" && config.economic.enabled) {
      const economicStep = nextEconomicStepUnits(baselineOffer, currentOffer, config.economic);
      const lot = LOTS.find((item) => item.id === lotId);
      const cost = lot ? (lot.totalBase * economicStep) / 100 : 0;
      if (economicStep > 0 && (config.budgetEnabled || !reallocationCandidates.length) && (!config.budgetEnabled || cost <= remainingBudget)) {
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
              title: `${lotId} - aumenta il ribasso medio diretto`,
              units: economicStep,
              unitLabel: "p.p. ribasso",
              cost,
              budgetImpact: cost,
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

const buildReallocationCandidates = ({
  baselineOffer,
  currentBidders,
  currentOffer,
  currentScore,
  lotId,
  remainingBudget,
  selectedBidderId,
  selectedLotId,
  settings,
  config,
}: {
  baselineOffer: Bidder["lots"][LotId];
  currentBidders: Bidder[];
  currentOffer: Bidder["lots"][LotId];
  currentScore: number;
  lotId: LotId;
  remainingBudget: number;
  selectedBidderId: string;
  selectedLotId: LotId;
  settings: Settings;
  config: OptimizationConfig;
}): OptimizationCandidate[] => {
  const lot = LOTS.find((item) => item.id === lotId);
  if (!lot) return [];

  return CRITERIA.flatMap((criterion): OptimizationCandidate[] => {
    if (criterion.kind === "D") return [];
    const lever = getOptimizationLever(config, lotId, criterion, currentOffer.tradeoffs[criterion.id] ?? defaultTradeoff());
    if (!lever.enabled) return [];

    const reductionUnits = nextTechnicalReductionUnits(baselineOffer, currentOffer, criterion, lever);
    const releasedBudget = technicalReductionCost(criterion, reductionUnits, lever);
    if (reductionUnits <= 0 || releasedBudget <= 0) return [];

    const maxFunding = releasedBudget + (config.budgetEnabled ? remainingBudget : 0);
    const economicStep = fundedEconomicStepUnits(baselineOffer, currentOffer, config.economic, lot.totalBase, maxFunding);
    if (economicStep <= 0.0001) return [];

    const economicCost = (lot.totalBase * economicStep) / 100;
    const budgetImpact = Math.max(0, economicCost - releasedBudget);
    if (config.budgetEnabled && budgetImpact > remainingBudget) return [];
    if (!config.budgetEnabled && budgetImpact > 0.0001) return [];

    const reducedBidders = structuredClone(currentBidders);
    const reducedBidder = reducedBidders.find((item) => item.id === selectedBidderId);
    if (!reducedBidder) return [];
    applyTechnicalReductionToOffer(reducedBidder.lots[lotId], criterion, lever, reductionUnits);
    const reducedSimulation = simulate(reducedBidders, settings, selectedBidderId);
    const reducedScore = objectiveScore(reducedSimulation, reducedBidders, selectedBidderId, selectedLotId, config.scope);

    const nextBidders = structuredClone(reducedBidders);
    const nextBidder = nextBidders.find((item) => item.id === selectedBidderId);
    if (!nextBidder) return [];
    nextBidder.lots[lotId].phaseDiscounts = nextBidder.lots[lotId].phaseDiscounts.map((discount) => discount + economicStep) as [number, number, number];
    const nextSimulation = simulate(nextBidders, settings, selectedBidderId);
    const nextScore = objectiveScore(nextSimulation, nextBidders, selectedBidderId, selectedLotId, config.scope);
    const objectiveDelta = round4(nextScore - currentScore);
    if (objectiveDelta <= 0) return [];

    return [
      {
        kind: "reallocation",
        lotId,
        criterionId: criterion.id,
        criterionLabel: criterion.label,
        ambit: criterion.ambit,
        title: `${lotId} - rialloca ${criterion.id} verso ribasso`,
        units: reductionUnits,
        unitLabel: criterion.kind === "T" ? "impegno tecnico" : criterion.tradeoffUnit,
        cost: economicCost,
        budgetImpact,
        releasedBudget,
        economicUnits: economicStep,
        technicalDelta: round4(reducedScore - currentScore),
        economicDelta: round4(nextScore - reducedScore),
        objectiveDelta,
        efficiency: efficiency(objectiveDelta, Math.max(1, budgetImpact || economicCost)),
        score: nextScore,
        bidders: nextBidders,
      },
    ];
  });
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

const nextTechnicalReductionUnits = (
  baselineOffer: Bidder["lots"][LotId],
  currentOffer: Bidder["lots"][LotId],
  criterion: Criterion,
  lever: OptimizationLeverInput,
) => {
  if (criterion.kind === "T") return currentOffer.tValues[criterion.id] ? 1 : 0;
  const step = Math.max(0, lever.stepUnits || 0);
  if (step <= 0) return 0;

  const baselineUnits = technicalUnits(baselineOffer, criterion, lever);
  const currentUnits = technicalUnits(currentOffer, criterion, lever);

  if (criterion.formula === "lower" || criterion.formula === "soil") {
    if (lever.maxUnits <= 0) return 0;
    const ceiling = baselineUnits + lever.maxUnits;
    return Math.min(step, Math.max(0, ceiling - currentUnits));
  }

  const floor = lever.maxUnits > 0 ? Math.max(0, baselineUnits - lever.maxUnits) : 0;
  return Math.min(step, Math.max(0, currentUnits - floor));
};

const isBelowInitialTechnicalOffer = (
  baselineOffer: Bidder["lots"][LotId],
  currentOffer: Bidder["lots"][LotId],
  criterion: Criterion,
  lever: OptimizationLeverInput,
) => {
  if (criterion.kind === "T") return Boolean(baselineOffer.tValues[criterion.id]) && !currentOffer.tValues[criterion.id];
  const baselineUnits = technicalUnits(baselineOffer, criterion, lever);
  const currentUnits = technicalUnits(currentOffer, criterion, lever);
  return criterion.formula === "lower" || criterion.formula === "soil" ? currentUnits > baselineUnits : currentUnits < baselineUnits;
};

const technicalReductionCost = (criterion: Criterion, units: number, lever: OptimizationLeverInput) =>
  criterion.kind === "T" ? Math.max(0, lever.unitCost) : Math.max(0, units) * Math.max(0, lever.unitCost);

const applyTechnicalReductionToOffer = (offer: Bidder["lots"][LotId], criterion: Criterion, lever: OptimizationLeverInput, units: number) => {
  if (criterion.kind === "T") {
    offer.tValues[criterion.id] = false;
    return;
  }

  const worsensByIncreasing = criterion.formula === "lower" || criterion.formula === "soil";
  const direction = worsensByIncreasing ? 1 : -1;

  if (criterion.quantityInput) {
    const currentInput = offer.quantityInputs[criterion.id];
    const denominator = Math.max(0, lever.denominator || currentInput?.denominator || 0);
    if (denominator <= 0) return;
    const currentNumerator =
      currentInput?.denominator === denominator
        ? currentInput.numerator
        : Math.round(
            Math.min(
              1,
              Math.max(0, (Number(getQuantitativeCriterionValue(offer, criterion)) || 0) / (criterion.quantityInput.kind === "percent" ? 100 : 1)),
            ) * denominator,
          );
    const nextInput = {
      numerator: Math.min(denominator, Math.max(0, currentNumerator + direction * units)),
      denominator,
    };
    offer.quantityInputs = { ...offer.quantityInputs, [criterion.id]: nextInput };
    offer.qValues[criterion.id] = computeQuantityInputValue(criterion, nextInput);
    return;
  }

  if (criterion.input === "ratio") {
    const denominator = Math.max(0, lever.denominator || 0);
    if (denominator <= 0) return;
    const currentValue = Number(getQuantitativeCriterionValue(offer, criterion)) || 0;
    offer.qValues[criterion.id] = Math.min(1, Math.max(0, currentValue + direction * (units / denominator)));
    return;
  }

  const currentValue = Number(getQuantitativeCriterionValue(offer, criterion)) || 0;
  offer.qValues[criterion.id] = Math.max(0, currentValue + direction * units);
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

const fundedEconomicStepUnits = (
  baselineOffer: Bidder["lots"][LotId],
  currentOffer: Bidder["lots"][LotId],
  economic: OptimizationEconomicInput,
  lotTotalBase: number,
  availableFunding: number,
) => {
  if (lotTotalBase <= 0 || availableFunding <= 0) return 0;
  const nextStep = nextEconomicStepUnits(baselineOffer, currentOffer, economic);
  const fundedStep = (availableFunding * 100) / lotTotalBase;
  return round4(Math.min(nextStep, fundedStep));
};

const averageDiscount = (discounts: [number, number, number]) => discounts.reduce((sum, value) => sum + value, 0) / discounts.length;

const efficiency = (delta: number, cost: number) => (cost > 0 ? delta / cost : delta);

const summarizeAreas = (steps: OptimizationStep[]): OptimizationAreaSummary[] => {
  const map = new Map<string, OptimizationAreaSummary>();
  for (const step of steps) {
    const key = step.kind === "economic" || step.kind === "reallocation" ? "economica" : step.ambit ?? "tecnica";
    const label = step.kind === "economic" || step.kind === "reallocation" ? "Offerta economica" : `Ambito ${key}`;
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
