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

export type OptimizationMode = "technical-economic" | "technical-only";
export type OptimizationScope = "active-lot" | "active-lots" | "scenario";

export type OptimizationLeverInput = {
  enabled: boolean;
  granularityUnits: number;
  maxUnits: number;
  unitCost: number;
  denominator: number;
};

export type OptimizationConfig = {
  mode: OptimizationMode;
  scope: OptimizationScope;
  levers: Partial<Record<LotId, Record<string, OptimizationLeverInput>>>;
};

export type OptimizationStep = {
  id: string;
  kind: "technical" | "reallocation";
  lotId: LotId;
  criterionId?: string;
  criterionLabel?: string;
  ambit?: string;
  title: string;
  units: number;
  unitLabel: string;
  cost: number;
  releasedValue?: number;
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
  mode: "technical-economic",
  scope: "active-lot",
  levers: {},
});

export const defaultOptimizationLever = (criterion: Criterion, tradeoff?: TradeoffPlan): OptimizationLeverInput => ({
  enabled: criterion.kind !== "D",
  granularityUnits: Math.max(0, tradeoff?.deltaUnits || 1),
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
  const initialSimulation = simulate(initialBidders, settings, selectedBidderId);
  let currentSimulation = initialSimulation;
  const initialScore = objectiveScore(initialSimulation, currentBidders, selectedBidderId, selectedLotId, config.scope);
  let currentScore = initialScore;
  const steps: OptimizationStep[] = [];
  const warnings: string[] = [];

  if (!currentBidders.some((bidder) => bidder.id === selectedBidderId)) {
    return emptyOptimizationResult(initialSimulation, currentBidders, "Offerente selezionato non trovato nello scenario.");
  }

  const targetLots = getTargetLots(currentBidders, selectedBidderId, selectedLotId, config.scope);
  if (!targetLots.length) {
    return emptyOptimizationResult(initialSimulation, currentBidders, "Nessun lotto attivo disponibile per l'ottimizzazione.");
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
      currentScore,
    });
    const best = candidates.sort((a, b) => {
      if (b.objectiveDelta !== a.objectiveDelta) return b.objectiveDelta - a.objectiveDelta;
      if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
      return a.cost - b.cost;
    })[0];

    if (!best || best.objectiveDelta <= 0.0001) break;
    currentBidders = best.bidders;
    currentSimulation = simulate(currentBidders, settings, selectedBidderId);
    currentScore = best.score;
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
      releasedValue: best.releasedValue === undefined ? undefined : round4(best.releasedValue),
      economicUnits: best.economicUnits === undefined ? undefined : round4(best.economicUnits),
      technicalDelta: best.technicalDelta === undefined ? undefined : round4(best.technicalDelta),
      economicDelta: best.economicDelta === undefined ? undefined : round4(best.economicDelta),
      objectiveDelta: round4(best.objectiveDelta),
      efficiency: round4(best.efficiency),
      afterScore: round4(best.score),
    });
  }

  if (!steps.length) {
    warnings.push("Nessuna leva produce un miglioramento positivo con massimali, costi e input correnti.");
  }

  return {
    initialScore: round4(initialScore),
    finalScore: round4(currentScore),
    objectiveDelta: round4(currentScore - initialScore),
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
  warning: string,
): OptimizationResult => ({
  initialScore: 0,
  finalScore: 0,
  objectiveDelta: 0,
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
      if (isBelowInitialTechnicalOffer(baselineOffer, currentOffer, criterion, lever)) continue;
      const availableUnits = availableTechnicalIncreaseUnits(baselineOffer, currentOffer, currentBidders, lotId, criterion, lever);
      for (const units of candidateQuantities(availableUnits, lever.granularityUnits, criterion)) {
        const cost = criterion.kind === "T" ? Math.max(0, lever.unitCost) : units * Math.max(0, lever.unitCost);
        if (cost <= 0) continue;

        const nextBidders = structuredClone(currentBidders);
        const nextBidder = nextBidders.find((item) => item.id === selectedBidderId);
        if (!nextBidder) continue;
        const plan = technicalUnitsToTradeoff(criterion, lever, units);
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
          units,
          unitLabel: criterion.kind === "T" ? "impegno" : criterion.tradeoffUnit,
          cost,
          technicalDelta: objectiveDelta,
          economicDelta: 0,
          objectiveDelta,
          efficiency: efficiency(objectiveDelta, cost),
          score: nextScore,
          bidders: nextBidders,
        });
      }
    }

    const reallocationCandidates =
      config.mode === "technical-economic"
        ? buildReallocationCandidates({
            baselineOffer,
            currentBidders,
            currentOffer,
            currentScore,
            lotId,
            selectedBidderId,
            selectedLotId,
            settings,
            config,
          })
        : [];
    candidates.push(...reallocationCandidates);

  }

  return candidates;
};

const buildReallocationCandidates = ({
  baselineOffer,
  currentBidders,
  currentOffer,
  currentScore,
  lotId,
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

    const availableReductionUnits = availableTechnicalReductionUnits(baselineOffer, currentOffer, criterion, lever);

    return candidateQuantities(availableReductionUnits, lever.granularityUnits, criterion).flatMap((reductionUnits): OptimizationCandidate[] => {
      const releasedValue = technicalReductionCost(criterion, reductionUnits, lever);
      if (reductionUnits <= 0 || releasedValue <= 0) return [];

      const economicStep = fundedEconomicStepUnits(currentOffer, lot.totalBase, releasedValue);
      if (economicStep <= 0.0001) return [];

      const economicCost = (lot.totalBase * economicStep) / 100;
      if (economicCost - releasedValue > 0.0001) return [];

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
          releasedValue,
          economicUnits: economicStep,
          technicalDelta: round4(reducedScore - currentScore),
          economicDelta: round4(nextScore - reducedScore),
          objectiveDelta,
          efficiency: efficiency(objectiveDelta, Math.max(1, economicCost)),
          score: nextScore,
          bidders: nextBidders,
        },
      ];
    });
  });
};

const technicalUnitsToTradeoff = (criterion: Criterion, lever: OptimizationLeverInput, units: number): TradeoffPlan => ({
  deltaUnits: criterion.kind === "T" ? 1 : units,
  unitCost: criterion.kind === "T" ? lever.unitCost : lever.unitCost,
  denominator: lever.denominator,
});

const availableTechnicalIncreaseUnits = (
  baselineOffer: Bidder["lots"][LotId],
  currentOffer: Bidder["lots"][LotId],
  bidders: Bidder[],
  lotId: LotId,
  criterion: Criterion,
  lever: OptimizationLeverInput,
) => {
  if (criterion.kind === "T") return currentOffer.tValues[criterion.id] ? 0 : 1;
  const maxUnits = resolvedMaxUnits(baselineOffer, currentOffer, bidders, lotId, criterion, lever);
  const baselineUnits = technicalUnits(baselineOffer, criterion, lever);
  const currentUnits = technicalUnits(currentOffer, criterion, lever);
  const usedUnits =
    criterion.formula === "lower" || criterion.formula === "soil"
      ? Math.max(0, baselineUnits - currentUnits)
      : Math.max(0, currentUnits - baselineUnits);
  return Math.max(0, maxUnits - usedUnits);
};

const availableTechnicalReductionUnits = (
  baselineOffer: Bidder["lots"][LotId],
  currentOffer: Bidder["lots"][LotId],
  criterion: Criterion,
  lever: OptimizationLeverInput,
) => {
  if (criterion.kind === "T") return currentOffer.tValues[criterion.id] ? 1 : 0;

  const baselineUnits = technicalUnits(baselineOffer, criterion, lever);
  const currentUnits = technicalUnits(currentOffer, criterion, lever);

  if (criterion.formula === "lower" || criterion.formula === "soil") {
    if (lever.maxUnits <= 0) return 0;
    const ceiling = baselineUnits + lever.maxUnits;
    return Math.max(0, ceiling - currentUnits);
  }

  const floor = lever.maxUnits > 0 ? Math.max(0, baselineUnits - lever.maxUnits) : 0;
  return Math.max(0, currentUnits - floor);
};

const candidateQuantities = (availableUnits: number, granularityUnits: number, criterion: Criterion) => {
  const available = round4(Math.max(0, availableUnits));
  if (available <= 0) return [];
  if (criterion.kind === "T") return [1];

  const granularity = Math.max(0.0001, granularityUnits || 1);
  const stepCount = Math.max(1, Math.ceil(available / granularity));
  const sampleEvery = stepCount <= 5 ? 1 : Math.max(1, Math.ceil(stepCount / 3));
  const values = new Set<number>();

  values.add(round4(Math.min(available, granularity)));
  for (let index = sampleEvery; index <= stepCount; index += sampleEvery) {
    values.add(round4(Math.min(available, index * granularity)));
  }
  values.add(available);

  return [...values].filter((value) => value > 0).sort((a, b) => a - b);
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

const fundedEconomicStepUnits = (
  currentOffer: Bidder["lots"][LotId],
  lotTotalBase: number,
  availableFunding: number,
) => {
  if (lotTotalBase <= 0 || availableFunding <= 0) return 0;
  const fundedStep = (availableFunding * 100) / lotTotalBase;
  const phaseHeadroom = Math.min(...currentOffer.phaseDiscounts.map((discount) => Math.max(0, 100 - discount)));
  return Math.min(fundedStep, phaseHeadroom);
};

const efficiency = (delta: number, cost: number) => (cost > 0 ? delta / cost : delta);

const summarizeAreas = (steps: OptimizationStep[]): OptimizationAreaSummary[] => {
  const map = new Map<string, OptimizationAreaSummary>();
  for (const step of steps) {
    const key = step.kind === "reallocation" ? "economica" : step.ambit ?? "tecnica";
    const label = step.kind === "reallocation" ? "Offerta economica" : `Ambito ${key}`;
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
