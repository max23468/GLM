import { CRITERIA, LOTS, type Criterion, type LotId } from "../data/tender";
import {
  applyPhaseDiscountDelta,
  candidateLotScore,
  computeQuantityInputValue,
  getQuantitativeCriterionValue,
  resolvePhaseDiscounts,
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
  diagnostics: {
    iterations: number;
    evaluatedCandidates: number;
    simulationRuns: number;
  };
};

type OptimizationCandidate = Omit<OptimizationStep, "id" | "afterScore"> & {
  bidders: Bidder[];
  score: number;
};

const compareOptimizationCandidates = (left: OptimizationCandidate, right: OptimizationCandidate) => {
  if (right.objectiveDelta !== left.objectiveDelta) return right.objectiveDelta - left.objectiveDelta;
  if (right.efficiency !== left.efficiency) return right.efficiency - left.efficiency;
  return left.cost - right.cost;
};

const pickBestCandidate = (candidates: OptimizationCandidate[]) => {
  let best: OptimizationCandidate | undefined;
  for (const candidate of candidates) {
    if (!best || compareOptimizationCandidates(candidate, best) < 0) best = candidate;
  }
  return best;
};

export const defaultOptimizationConfig = (): OptimizationConfig => ({
  mode: "technical-economic",
  scope: "active-lot",
  levers: {},
});

const defaultOptimizationLever = (criterion: Criterion, tradeoff?: TradeoffPlan): OptimizationLeverInput => ({
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
  const diagnostics = {
    iterations: 0,
    evaluatedCandidates: 0,
    simulationRuns: 1,
  };
  const runSimulation = (nextBidders: Bidder[]) => {
    diagnostics.simulationRuns += 1;
    return simulate(nextBidders, settings, selectedBidderId);
  };

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
      runSimulation,
    });
    diagnostics.iterations += 1;
    diagnostics.evaluatedCandidates += candidates.length;
    const best = pickBestCandidate(candidates);

    if (!best || best.objectiveDelta <= 0.0001) break;
    currentBidders = best.bidders;
    currentSimulation = runSimulation(currentBidders);
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
    diagnostics,
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
  diagnostics: {
    iterations: 0,
    evaluatedCandidates: 0,
    simulationRuns: 1,
  },
});

const getTargetLots = (bidders: Bidder[], selectedBidderId: string, selectedLotId: LotId, scope: OptimizationScope): LotId[] => {
  const bidder = bidders.find((item) => item.id === selectedBidderId);
  if (!bidder) return [];
  if (scope === "active-lot") return bidder.lots[selectedLotId].enabled ? [selectedLotId] : [];
  const lotIds: LotId[] = [];
  for (const lot of LOTS) {
    if (bidder.lots[lot.id].enabled) lotIds.push(lot.id);
  }
  return lotIds;
};

const objectiveScore = (simulation: SimulationResult, bidders: Bidder[], selectedBidderId: string, selectedLotId: LotId, scope: OptimizationScope) => {
  const bidder = bidders.find((item) => item.id === selectedBidderId);
  if (!bidder) return 0;

  if (scope === "scenario") {
    let score = 0;
    for (const assignment of simulation.selectedScenario?.assignments ?? []) {
      if (assignment.bidderId !== selectedBidderId) continue;
      score += assignment.lotIds.reduce((lotSum, lotId) => lotSum + candidateLotScore(assignment, lotId), 0);
    }
    return round4(score);
  }

  const lotIds: LotId[] = [];
  if (scope === "active-lot") {
    lotIds.push(selectedLotId);
  } else {
    for (const lot of LOTS) {
      if (bidder.lots[lot.id].enabled) lotIds.push(lot.id);
    }
  }
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
  runSimulation,
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
  runSimulation: (bidders: Bidder[]) => SimulationResult;
}): OptimizationCandidate[] => {
  const candidates: OptimizationCandidate[] = [];
  const bidder = currentBidders.find((item) => item.id === selectedBidderId);
  const baselineBidder = baselineBidders.find((item) => item.id === selectedBidderId);
  if (!bidder || !baselineBidder) return candidates;
  const selectedBidderIndex = currentBidders.findIndex((item) => item.id === selectedBidderId);
  if (selectedBidderIndex === -1) return candidates;

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
        const nextBidder = nextBidders[selectedBidderIndex];
        if (!nextBidder) continue;
        const plan = technicalUnitsToTradeoff(criterion, lever, units);
        applyTradeoffPlanToOffer(nextBidder.lots[lotId], criterion, plan);
        const nextSimulation = runSimulation(nextBidders);
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
            selectedBidderIndex,
            runSimulation,
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
  selectedBidderIndex,
  runSimulation,
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
  selectedBidderIndex: number;
  runSimulation: (bidders: Bidder[]) => SimulationResult;
}): OptimizationCandidate[] => {
  const lot = LOTS.find((item) => item.id === lotId);
  if (!lot) return [];

  const candidates: OptimizationCandidate[] = [];
    for (const criterion of CRITERIA) {
      if (criterion.kind === "D") continue;
    const lever = getOptimizationLever(config, lotId, criterion, currentOffer.tradeoffs[criterion.id] ?? defaultTradeoff());
    if (!lever.enabled) continue;

    const availableReductionUnits = availableTechnicalReductionUnits(baselineOffer, currentOffer, criterion, lever);

    for (const reductionUnits of candidateQuantities(availableReductionUnits, lever.granularityUnits, criterion)) {
      const releasedValue = technicalReductionCost(criterion, reductionUnits, lever);
      if (reductionUnits <= 0 || releasedValue <= 0) continue;

      const economicStep = fundedEconomicStepUnits(currentOffer, lot.totalBase, releasedValue);
      if (economicStep <= 0.0001) continue;

      const economicCost = (lot.totalBase * economicStep) / 100;
      if (economicCost - releasedValue > 0.0001) continue;

      const reducedBidders = structuredClone(currentBidders);
      const reducedBidder = reducedBidders[selectedBidderIndex];
      if (!reducedBidder) continue;
      applyTechnicalReductionToOffer(reducedBidder.lots[lotId], criterion, lever, reductionUnits);
      const reducedSimulation = runSimulation(reducedBidders);
      const reducedScore = objectiveScore(reducedSimulation, reducedBidders, selectedBidderId, selectedLotId, config.scope);

      const nextBidders = structuredClone(reducedBidders);
      const nextBidder = nextBidders[selectedBidderIndex];
      if (!nextBidder) continue;
      nextBidder.lots[lotId] = applyPhaseDiscountDelta(nextBidder.lots[lotId], economicStep);
      const nextSimulation = runSimulation(nextBidders);
      const nextScore = objectiveScore(nextSimulation, nextBidders, selectedBidderId, selectedLotId, config.scope);
      const objectiveDelta = round4(nextScore - currentScore);
      if (objectiveDelta <= 0) continue;

      candidates.push({
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
      });
    }
  }
  return candidates;
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
  const values = new Set<number>();

  values.add(round4(Math.min(available, granularity)));
  if (stepCount <= 3) {
    for (let index = 2; index <= stepCount; index += 1) {
      values.add(round4(Math.min(available, index * granularity)));
    }
  } else {
    values.add(round4(Math.min(available, Math.ceil(stepCount / 2) * granularity)));
  }
  values.add(available);

  const result: number[] = [];
  for (const value of values) {
    if (value > 0) result.push(value);
  }
  result.sort((a, b) => a - b);
  return result;
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
  let bestValue = 0;
  for (const bidder of bidders) {
    if (!bidder.lots[lotId].enabled) continue;
    bestValue = Math.max(bestValue, Number(getQuantitativeCriterionValue(bidder.lots[lotId], criterion)) || 0);
  }
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
  const phaseHeadroom = Math.min(...resolvePhaseDiscounts(currentOffer).map((discount) => Math.max(0, 100 - discount)));
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
  const areas = Array.from(map.values());
  areas.sort((a, b) => {
    if (b.objectiveDelta !== a.objectiveDelta) return b.objectiveDelta - a.objectiveDelta;
    return b.cost - a.cost;
  });
  return areas;
};
