import {
  AMBITS,
  COMPATIBLE_PAIR_SETS,
  CRITERIA,
  LOTS,
  PAIRS,
  type Ambit,
  type Criterion,
  type LotId,
  type PairId,
} from "../data/tender";

export type DiscountInputMode = "phases" | "average";

export type EconomicDiscountSource = {
  discountInputMode?: DiscountInputMode;
  phaseDiscounts: [number, number, number];
  averageDiscount?: number;
};

export type LotOffer = {
  enabled: boolean;
  technicalOverrideRaw?: number;
  qValues: Record<string, number>;
  quantityInputs: Record<string, QuantityInputValue>;
  tValues: Record<string, boolean>;
  dValues: Record<string, number>;
  tradeoffs: Record<string, TradeoffPlan>;
  discountInputMode?: DiscountInputMode;
  phaseDiscounts: [number, number, number];
  averageDiscount?: number;
};

export type QuantityInputValue = {
  numerator: number;
  denominator: number;
};

export type TradeoffPlan = {
  deltaUnits: number;
  unitCost: number;
  denominator: number;
};

export type ComboOffer = {
  enabled: boolean;
  discountInputMode?: DiscountInputMode;
  phaseDiscounts: [number, number, number];
  averageDiscount?: number;
  insertedInBothBuste: boolean;
  pefCoherent: boolean;
};

export type Bidder = {
  id: string;
  name: string;
  lots: Record<LotId, LotOffer>;
  combos: Record<PairId, ComboOffer>;
};

export type Settings = {
  threshold: number;
  applyAwardLimitDerogation: boolean;
};

export type SubScore = {
  criterion: Criterion;
  value: number | boolean;
  rawScore: number;
  dependencyBlocked: boolean;
  note?: string;
};

export type LotScore = {
  bidderId: string;
  lotId: LotId;
  participates: boolean;
  qtRaw: number;
  threshold: number;
  admitted: boolean;
  rawByAmbit: Record<string, number>;
  riparamByAmbit: Record<string, number>;
  technical: number;
  singleRibasso: number;
  singleEconomic: number;
  singleTotal: number;
  subScores: Record<string, SubScore>;
  warnings: string[];
};

export type ComboScore = {
  bidderId: string;
  pairId: PairId;
  enabled: boolean;
  admissible: boolean;
  ribasso: number;
  totalScore: number;
  technicalScore: number;
  lotEconomic: Partial<Record<LotId, number>>;
  warnings: string[];
  minRequiredRibasso: number;
};

export type AssignmentCandidate = {
  id: string;
  bidderId: string;
  bidderName: string;
  kind: "single" | "combo";
  lotIds: LotId[];
  pairId?: PairId;
  totalScore: number;
  technicalScore: number;
  scoreByLot: Partial<Record<LotId, number>>;
  technicalByLot: Partial<Record<LotId, number>>;
};

export type Scenario = {
  id: string;
  assignments: AssignmentCandidate[];
  totalScore: number;
  technicalScore: number;
  unassignedLots: LotId[];
  drawRequired: boolean;
  awardLimitDerogationUsed: boolean;
};

export type Suggestion = {
  bidderId: string;
  lotId?: LotId;
  pairId?: PairId;
  title: string;
  body: string;
  priority: number;
  effort: "basso" | "medio" | "alto";
  impact: number;
};

export type SimulationResult = {
  lotScores: Record<string, Record<LotId, LotScore>>;
  comboScores: Record<string, Record<PairId, ComboScore>>;
  rMaxByLot: Record<LotId, number>;
  candidates: AssignmentCandidate[];
  scenarios: Scenario[];
  selectedScenario?: Scenario;
  lotRankings: Record<LotId, AssignmentCandidate[]>;
  warnings: string[];
  suggestions: Suggestion[];
};

export type EconomicPhaseBreakdown = {
  base: number;
  discount: number;
  roundedDiscount: number;
  offered: number;
  weight: number;
};

export type EconomicBreakdown = {
  phases: [EconomicPhaseBreakdown, EconomicPhaseBreakdown, EconomicPhaseBreakdown];
  baseTotal: number;
  offeredTotal: number;
  ribasso: number;
};

const criterionById = new Map(CRITERIA.map((criterion) => [criterion.id, criterion]));
const compatiblePairSetKeys = new Set(COMPATIBLE_PAIR_SETS.map((set) => Array.from(set).sort().join("|")));
const MAX_TECH_POINTS = AMBITS.reduce((sum, ambit) => sum + ambit.maxPoints, 0);

const emptyQuantityInputs = () => {
  const inputs: Record<string, QuantityInputValue> = {};
  for (const criterion of CRITERIA) {
    if (criterion.quantityInput) inputs[criterion.id] = { numerator: 0, denominator: 0 };
  }
  return inputs;
};

const emptyQuantitativeValues = () => {
  const values: Record<string, number> = {};
  for (const criterion of CRITERIA) {
    if (criterion.kind === "Q") values[criterion.id] = 0;
  }
  return values;
};

const emptyTabularValues = () => {
  const values: Record<string, boolean> = {};
  for (const criterion of CRITERIA) {
    if (criterion.kind === "T") values[criterion.id] = false;
  }
  return values;
};

const emptyDiscretionaryValues = () => {
  const values: Record<string, number> = {};
  for (const criterion of CRITERIA) {
    if (criterion.kind === "D") values[criterion.id] = 0.6;
  }
  return values;
};

export const emptyLotOffer = (): LotOffer => ({
  enabled: false,
  qValues: emptyQuantitativeValues(),
  quantityInputs: emptyQuantityInputs(),
  tValues: emptyTabularValues(),
  dValues: emptyDiscretionaryValues(),
  tradeoffs: emptyTradeoffs(),
  discountInputMode: "phases",
  phaseDiscounts: [0, 0, 0],
  averageDiscount: 0,
});

export const applyQualitativeReadyDefaults = (offer: LotOffer) => {
  for (const criterion of CRITERIA) {
    if (criterion.kind === "T") offer.tValues[criterion.id] = true;
    if (criterion.kind === "D") offer.dValues[criterion.id] = 1;
  }
  return offer;
};

const emptyTradeoffs = () =>
  Object.fromEntries(CRITERIA.map((criterion) => [criterion.id, { deltaUnits: 0, unitCost: 0, denominator: 0 } satisfies TradeoffPlan]));

export const emptyComboOffer = (): ComboOffer => ({
  enabled: false,
  discountInputMode: "phases",
  phaseDiscounts: [0, 0, 0],
  averageDiscount: 0,
  insertedInBothBuste: true,
  pefCoherent: true,
});

export const createBidder = (id: string, name: string): Bidder => ({
  id,
  name,
  lots: Object.fromEntries(LOTS.map((lot) => [lot.id, emptyLotOffer()])) as Record<LotId, LotOffer>,
  combos: Object.fromEntries(PAIRS.map((pair) => [pair.id, emptyComboOffer()])) as Record<PairId, ComboOffer>,
});

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const round2 = (value: number) => round(value, 2);
export const round4 = (value: number) => round(value, 4);

export const formatPoints = (value: number) => round2(value).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatPercent = (value: number) => (value * 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const technicalOverrideRaw = (offer: LotOffer) => {
  if (typeof offer.technicalOverrideRaw !== "number" || !Number.isFinite(offer.technicalOverrideRaw)) return undefined;
  return round4(clamp(offer.technicalOverrideRaw, 0, MAX_TECH_POINTS));
};

export const computeQuantityInputValue = (criterion: Criterion, input?: QuantityInputValue) => {
  if (!criterion.quantityInput || !input) return 0;
  const denominator = Math.max(0, Number(input.denominator) || 0);
  if (denominator <= 0) return 0;
  const numerator = Math.max(0, Number(input.numerator) || 0);
  const ratio = clamp(numerator / denominator, 0, 1);
  return criterion.quantityInput.kind === "percent" ? round4(ratio * 100) : round4(ratio);
};

export const getQuantitativeCriterionValue = (offer: LotOffer, criterion: Criterion) => {
  if (criterion.quantityInput) {
    const input = offer.quantityInputs?.[criterion.id];
    if (input && input.denominator > 0) return computeQuantityInputValue(criterion, input);
  }
  return offer.qValues[criterion.id] ?? 0;
};

const getLot = (lotId: LotId) => {
  const lot = LOTS.find((item) => item.id === lotId);
  if (!lot) {
    throw new Error(`Unknown lot ${lotId}`);
  }
  return lot;
};

const getPair = (pairId: PairId) => {
  const pair = PAIRS.find((item) => item.id === pairId);
  if (!pair) {
    throw new Error(`Unknown pair ${pairId}`);
  }
  return pair;
};

const discountToDecimal = (percent: number) => clamp(percent / 100, 0, 1);

export const clampDiscountPercent = (value: number) => round4(Math.min(100, Math.max(0, value)));

export const resolvePhaseDiscounts = (offer: EconomicDiscountSource): [number, number, number] => {
  if (offer.discountInputMode === "average") {
    const average = clampDiscountPercent(offer.averageDiscount ?? offer.phaseDiscounts[0] ?? 0);
    return [average, average, average];
  }
  return offer.phaseDiscounts.map((discount) => clampDiscountPercent(discount)) as [number, number, number];
};

const weightedRibassoPercentFromPhases = (
  baseByPhase: [number, number, number],
  phaseDiscounts: [number, number, number],
) => round4(computeWeightedRibasso(baseByPhase, phaseDiscounts) * 100);

export const setDiscountInputMode = <T extends EconomicDiscountSource>(
  offer: T,
  mode: DiscountInputMode,
  baseByPhase?: [number, number, number],
): T => {
  if (mode === "average") {
    const average = baseByPhase
      ? weightedRibassoPercentFromPhases(baseByPhase, resolvePhaseDiscounts({ ...offer, discountInputMode: "phases" }))
      : clampDiscountPercent(offer.averageDiscount ?? offer.phaseDiscounts[0] ?? 0);
    return {
      ...offer,
      discountInputMode: "average",
      averageDiscount: average,
      phaseDiscounts: [average, average, average],
    };
  }
  return { ...offer, discountInputMode: "phases" };
};

export const setAverageDiscountValue = <T extends EconomicDiscountSource>(offer: T, value: number): T => {
  const average = clampDiscountPercent(value);
  return {
    ...offer,
    discountInputMode: "average",
    averageDiscount: average,
    phaseDiscounts: [average, average, average],
  };
};

export const setPhaseDiscountValue = <T extends EconomicDiscountSource>(
  offer: T,
  index: number,
  value: number,
): T => {
  const next = [...offer.phaseDiscounts] as [number, number, number];
  next[index] = clampDiscountPercent(value);
  return {
    ...offer,
    discountInputMode: "phases",
    phaseDiscounts: next,
  };
};

export const applyPhaseDiscountDelta = <T extends EconomicDiscountSource>(offer: T, delta: number): T => {
  const next = resolvePhaseDiscounts(offer).map((discount) => clampDiscountPercent(discount + delta)) as [
    number,
    number,
    number,
  ];
  if (offer.discountInputMode === "average") {
    return { ...offer, averageDiscount: next[0], phaseDiscounts: next };
  }
  return { ...offer, phaseDiscounts: next };
};

export const computeOfferedAmount = (baseByPhase: [number, number, number], phaseDiscounts: [number, number, number]) => {
  const roundedDiscounts = phaseDiscounts.map((item) => round4(discountToDecimal(item))) as [number, number, number];
  return baseByPhase.reduce((sum, base, index) => sum + base * (1 - roundedDiscounts[index]), 0);
};

export const computeWeightedRibasso = (baseByPhase: [number, number, number], phaseDiscounts: [number, number, number]) => {
  const baseTotal = baseByPhase.reduce((sum, value) => sum + value, 0);
  const offered = computeOfferedAmount(baseByPhase, phaseDiscounts);
  return round4(1 - offered / baseTotal);
};

export const economicBreakdownFromOffer = (
  baseByPhase: [number, number, number],
  offer: EconomicDiscountSource,
): EconomicBreakdown => economicBreakdown(baseByPhase, resolvePhaseDiscounts(offer));

export const economicBreakdown = (baseByPhase: [number, number, number], phaseDiscounts: [number, number, number]): EconomicBreakdown => {
  const baseTotal = baseByPhase.reduce((sum, value) => sum + value, 0);
  const phases = baseByPhase.map((base, index) => {
    const roundedDiscount = round4(discountToDecimal(phaseDiscounts[index]));
    return {
      base,
      discount: phaseDiscounts[index],
      roundedDiscount,
      offered: base * (1 - roundedDiscount),
      weight: baseTotal > 0 ? base / baseTotal : 0,
    };
  }) as [EconomicPhaseBreakdown, EconomicPhaseBreakdown, EconomicPhaseBreakdown];
  return {
    phases,
    baseTotal,
    offeredTotal: phases.reduce((sum, phase) => sum + phase.offered, 0),
    ribasso: computeWeightedRibasso(baseByPhase, phaseDiscounts),
  };
};

export const pairBaseByPhase = (pairId: PairId): [number, number, number] => {
  const pair = getPair(pairId);
  const first = getLot(pair.lots[0]).baseByPhase;
  const second = getLot(pair.lots[1]).baseByPhase;
  return [first[0] + second[0], first[1] + second[1], first[2] + second[2]];
};

const computeTechnicalRawScores = (bidders: Bidder[], settings: Settings): Record<string, Record<LotId, LotScore>> => {
  const makeBidderLotScores = (bidder: Bidder) =>
    LOTS.reduce((lotMap, lot) => {
      lotMap[lot.id] = {
        bidderId: bidder.id,
        lotId: lot.id,
        participates: bidder.lots[lot.id].enabled,
        qtRaw: 0,
        threshold: settings.threshold,
        admitted: false,
        rawByAmbit: Object.fromEntries(AMBITS.map((ambit) => [ambit.id, 0])),
        riparamByAmbit: Object.fromEntries(AMBITS.map((ambit) => [ambit.id, 0])),
        technical: 0,
        singleRibasso: computeWeightedRibasso(lot.baseByPhase, resolvePhaseDiscounts(bidder.lots[lot.id])),
        singleEconomic: 0,
        singleTotal: 0,
        subScores: {},
        warnings: [],
      };
      return lotMap;
    }, {} as Record<LotId, LotScore>);

  const result = Object.fromEntries(
    bidders.map((bidder) => [bidder.id, makeBidderLotScores(bidder)]),
  ) as Record<string, Record<LotId, LotScore>>;

    for (const lot of LOTS) {
      for (const criterion of CRITERIA) {
        let maxValue = 0;
        let minPositive = Number.POSITIVE_INFINITY;
        let maxDiscretionary = 0;

        for (const bidder of bidders) {
          const offer = bidder.lots[lot.id];
          if (!offer.enabled) continue;
          const value =
            criterion.kind === "Q"
              ? getQuantitativeCriterionValue(offer, criterion)
              : criterion.kind === "T"
                ? Number(offer.tValues[criterion.id] ?? false)
                : offer.dValues[criterion.id] ?? 0;
          const numericValue = Number(value);
          if (!Number.isFinite(numericValue)) continue;
          maxValue = Math.max(maxValue, numericValue);
          if (numericValue > 0) minPositive = Math.min(minPositive, numericValue);
          if (criterion.kind === "D") maxDiscretionary = Math.max(maxDiscretionary, numericValue);
        }

        if (minPositive === Number.POSITIVE_INFINITY) minPositive = 0;

      for (const bidder of bidders) {
        const lotOffer = bidder.lots[lot.id];
        const score = result[bidder.id][lot.id];
        if (!lotOffer.enabled) {
          score.subScores[criterion.id] = {
            criterion,
            value: criterion.kind === "T" ? false : 0,
            rawScore: 0,
            dependencyBlocked: false,
          };
          continue;
        }

        let rawScore = 0;
        let value: number | boolean = 0;
        let dependencyBlocked = false;
        let note: string | undefined;

        if (criterion.kind === "Q") {
          value = getQuantitativeCriterionValue(lotOffer, criterion);
          if (criterion.formula === "higher") {
            rawScore = maxValue > 0 ? criterion.maxPoints * (Number(value) / maxValue) : 0;
          }
          if (criterion.formula === "lower") {
            rawScore = minPositive > 0 && Number(value) > 0 ? criterion.maxPoints * (minPositive / Number(value)) : 0;
          }
          if (criterion.formula === "soil") {
            if (Number(value) <= 0) {
              rawScore = criterion.maxPoints;
            } else {
              rawScore = maxValue > 0 ? criterion.maxPoints * ((maxValue - Number(value)) / maxValue) : 0;
            }
          }
        }

        if (criterion.kind === "T") {
          value = Boolean(lotOffer.tValues[criterion.id]);
          if (criterion.dependency) {
              const dependencyCriterion = criterion.dependency ? criterionById.get(criterion.dependency.criterionId) : undefined;
            const dependencyValue = dependencyCriterion ? getQuantitativeCriterionValue(lotOffer, dependencyCriterion) : 0;
            dependencyBlocked = dependencyValue < criterion.dependency.value;
            if (dependencyBlocked && value) {
              note = criterion.dependency.message;
              score.warnings.push(`${criterion.id}: ${criterion.dependency.message}`);
            }
          }
          rawScore = value && !dependencyBlocked ? criterion.maxPoints : 0;
        }

        if (criterion.kind === "D") {
          value = lotOffer.dValues[criterion.id] ?? 0;
          const normalized = maxDiscretionary > 0 ? Number(value) / maxDiscretionary : 0;
          rawScore = criterion.maxPoints * normalized;
        }

        const boundedScore = round4(clamp(rawScore, 0, criterion.maxPoints));
        score.subScores[criterion.id] = { criterion, value, rawScore: boundedScore, dependencyBlocked, note };
        score.rawByAmbit[criterion.ambit] = round4((score.rawByAmbit[criterion.ambit] ?? 0) + boundedScore);
        if (criterion.kind === "Q" || criterion.kind === "T") {
          score.qtRaw = round4(score.qtRaw + boundedScore);
        }
      }
    }

    for (const bidder of bidders) {
      const score = result[bidder.id][lot.id];
      const overrideRaw = score.participates ? technicalOverrideRaw(bidder.lots[lot.id]) : undefined;
      if (typeof overrideRaw === "number") {
        score.qtRaw = overrideRaw;
        score.warnings.push("Tecnico aggregato importato: sub-criteri non disponibili.");
      }
      score.admitted = score.participates && score.qtRaw >= settings.threshold;
      if (score.participates && !score.admitted) {
        score.warnings.push(`Sotto soglia di sbarramento: ${formatPoints(score.qtRaw)} < ${formatPoints(settings.threshold)}.`);
      }
    }

    for (const ambit of AMBITS) {
      let bestRaw = 0;
      for (const bidder of bidders) {
        const score = result[bidder.id][lot.id];
        if (score.admitted) bestRaw = Math.max(bestRaw, score.rawByAmbit[ambit.id] ?? 0);
      }
      for (const bidder of bidders) {
        const score = result[bidder.id][lot.id];
        const raw = score.rawByAmbit[ambit.id] ?? 0;
        score.riparamByAmbit[ambit.id] = score.admitted && bestRaw > 0 ? round4(clamp(raw * (ambit.maxPoints / bestRaw), 0, ambit.maxPoints)) : 0;
      }
    }

    for (const bidder of bidders) {
      const score = result[bidder.id][lot.id];
      const overrideRaw = score.participates ? technicalOverrideRaw(bidder.lots[lot.id]) : undefined;
      if (typeof overrideRaw === "number") {
        score.technical = overrideRaw;
        score.riparamByAmbit = Object.fromEntries(
          AMBITS.map((ambit) => [ambit.id, round4((overrideRaw / MAX_TECH_POINTS) * ambit.maxPoints)]),
        );
      } else {
        score.technical = round4(Object.values(score.riparamByAmbit).reduce((sum, value) => sum + value, 0));
      }
    }
  }

  return result;
};

const comboHasOverlaps = (bidder: Bidder, pairId: PairId) => {
  const selected = getPair(pairId);
  return PAIRS.some((other) => {
    if (other.id === pairId || !bidder.combos[other.id].enabled) return false;
    return selected.lots[0] === other.lots[0] ||
      selected.lots[0] === other.lots[1] ||
      selected.lots[1] === other.lots[0] ||
      selected.lots[1] === other.lots[1];
  });
};

const comboSetAllowed = (bidder: Bidder) => {
  const enabled: PairId[] = [];
  for (const pair of PAIRS) {
    if (bidder.combos[pair.id].enabled) enabled.push(pair.id);
  }
  if (enabled.length <= 1) return true;
  if (enabled.length > 2) return false;
  enabled.sort();
  return compatiblePairSetKeys.has(enabled.join("|"));
};

const computeComboScores = (
  bidders: Bidder[],
  lotScores: Record<string, Record<LotId, LotScore>>,
  rMaxByLot: Record<LotId, number>,
): Record<string, Record<PairId, ComboScore>> => {
  return Object.fromEntries(
    bidders.map((bidder) => [
      bidder.id,
      Object.fromEntries(
        PAIRS.map((pair) => {
          const combo = bidder.combos[pair.id];
          const [firstLotId, secondLotId] = pair.lots;
          const firstLot = getLot(firstLotId);
          const secondLot = getLot(secondLotId);
          const firstScore = lotScores[bidder.id][firstLotId];
          const secondScore = lotScores[bidder.id][secondLotId];
          const baseSum = firstLot.totalBase + secondLot.totalBase;
          const pairBases = pairBaseByPhase(pair.id);
          const comboDiscounts = resolvePhaseDiscounts(combo);
          const ribasso = computeWeightedRibasso(pairBaseByPhase(pair.id), comboDiscounts);
          const comboOffered = computeOfferedAmount(pairBases, comboDiscounts);
          const singleOfferedSum =
            computeOfferedAmount(firstLot.baseByPhase, resolvePhaseDiscounts(bidder.lots[firstLotId])) +
            computeOfferedAmount(secondLot.baseByPhase, resolvePhaseDiscounts(bidder.lots[secondLotId]));
          const minRequiredRibasso = round4(1 - singleOfferedSum / baseSum);
          const warnings: string[] = [];

          if (combo.enabled && (!firstScore.participates || !secondScore.participates)) {
            warnings.push("L'offerta combinatoria richiede offerte singole su entrambi i lotti.");
          }
          if (combo.enabled && (!firstScore.admitted || !secondScore.admitted)) {
            warnings.push("Almeno uno dei due lotti non supera la soglia di sbarramento.");
          }
          if (combo.enabled && comboHasOverlaps(bidder, pair.id)) {
            warnings.push("Coppia sovrapposta ad altra offerta combinatoria dello stesso concorrente.");
          }
          if (combo.enabled && !comboSetAllowed(bidder)) {
            warnings.push("Le coppie combinate non rispettano gli unici set non sovrapposti ammessi.");
          }
          if (combo.enabled && !combo.insertedInBothBuste) {
            warnings.push("Inserimento incrociato non pienamente confermato nelle due buste.");
          }
          if (combo.enabled && !combo.pefCoherent) {
            warnings.push("PEF combinatorio non dichiarato coerente/presente.");
          }
          if (combo.enabled && comboOffered >= singleOfferedSum) {
            warnings.push(`Ribasso combinatorio non economicamente migliorativo: serve > ${formatPercent(minRequiredRibasso)}.`);
          }

          const admissible =
            combo.enabled &&
            firstScore.admitted &&
            secondScore.admitted &&
            firstScore.participates &&
            secondScore.participates &&
            !comboHasOverlaps(bidder, pair.id) &&
            comboSetAllowed(bidder) &&
            combo.insertedInBothBuste &&
            combo.pefCoherent &&
            comboOffered < singleOfferedSum;

          const firstEconomic = admissible && rMaxByLot[firstLotId] > 0 ? round4(30 * (ribasso / rMaxByLot[firstLotId])) : 0;
          const secondEconomic = admissible && rMaxByLot[secondLotId] > 0 ? round4(30 * (ribasso / rMaxByLot[secondLotId])) : 0;

          return [
            pair.id,
            {
              bidderId: bidder.id,
              pairId: pair.id,
              enabled: combo.enabled,
              admissible,
              ribasso,
              totalScore: round4(firstScore.technical + firstEconomic + secondScore.technical + secondEconomic),
              technicalScore: round4(firstScore.technical + secondScore.technical),
              lotEconomic: { [firstLotId]: firstEconomic, [secondLotId]: secondEconomic },
              warnings,
              minRequiredRibasso,
            } satisfies ComboScore,
          ];
        }),
      ) as Record<PairId, ComboScore>,
    ]),
  ) as Record<string, Record<PairId, ComboScore>>;
};

const computeRMaxByLot = (bidders: Bidder[], lotScores: Record<string, Record<LotId, LotScore>>) => {
  const rMaxByLot = Object.fromEntries(LOTS.map((lot) => [lot.id, 0])) as Record<LotId, number>;
  for (const lot of LOTS) {
    let rMax = 0;
    for (const bidder of bidders) {
      if (lotScores[bidder.id][lot.id].admitted) {
        rMax = Math.max(rMax, lotScores[bidder.id][lot.id].singleRibasso);
      }
      for (const pair of PAIRS) {
        const combo = bidder.combos[pair.id];
        const [firstLotId, secondLotId] = pair.lots;
        const pairContainsLot = firstLotId === lot.id || secondLotId === lot.id;
        const firstScore = lotScores[bidder.id][firstLotId];
        const secondScore = lotScores[bidder.id][secondLotId];
        const firstLot = getLot(firstLotId);
        const secondLot = getLot(secondLotId);
        const comboDiscounts = resolvePhaseDiscounts(combo);
        const comboOffered = computeOfferedAmount(pairBaseByPhase(pair.id), comboDiscounts);
        const singleOfferedSum =
          computeOfferedAmount(firstLot.baseByPhase, resolvePhaseDiscounts(bidder.lots[firstLotId])) +
          computeOfferedAmount(secondLot.baseByPhase, resolvePhaseDiscounts(bidder.lots[secondLotId]));
        if (
          pairContainsLot &&
          combo.enabled &&
          firstScore.admitted &&
          secondScore.admitted &&
          !comboHasOverlaps(bidder, pair.id) &&
          comboSetAllowed(bidder) &&
          combo.insertedInBothBuste &&
          combo.pefCoherent &&
          comboOffered < singleOfferedSum
        ) {
          rMax = Math.max(rMax, computeWeightedRibasso(pairBaseByPhase(pair.id), comboDiscounts));
        }
      }
    }
    rMaxByLot[lot.id] = rMax;
  }
  return rMaxByLot;
};

const computeSingleEconomicScores = (bidders: Bidder[], lotScores: Record<string, Record<LotId, LotScore>>, rMaxByLot: Record<LotId, number>) => {
  for (const bidder of bidders) {
    for (const lot of LOTS) {
      const score = lotScores[bidder.id][lot.id];
      score.singleEconomic = score.admitted && rMaxByLot[lot.id] > 0 ? round4(30 * (score.singleRibasso / rMaxByLot[lot.id])) : 0;
      score.singleTotal = round4(score.technical + score.singleEconomic);
    }
  }
};

const buildCandidates = (bidders: Bidder[], lotScores: Record<string, Record<LotId, LotScore>>, comboScores: Record<string, Record<PairId, ComboScore>>) => {
  const candidates: AssignmentCandidate[] = [];
  for (const bidder of bidders) {
    for (const lot of LOTS) {
      const score = lotScores[bidder.id][lot.id];
      if (score.admitted) {
        candidates.push({
          id: `${bidder.id}:${lot.id}:single`,
          bidderId: bidder.id,
          bidderName: bidder.name,
          kind: "single",
          lotIds: [lot.id],
          totalScore: score.singleTotal,
          technicalScore: score.technical,
          scoreByLot: { [lot.id]: score.singleTotal },
          technicalByLot: { [lot.id]: score.technical },
        });
      }
    }

    for (const pair of PAIRS) {
      const score = comboScores[bidder.id][pair.id];
      if (score.admissible) {
        const scoreByLot = Object.fromEntries(
          pair.lots.map((lotId) => [lotId, round4(lotScores[bidder.id][lotId].technical + (score.lotEconomic[lotId] ?? 0))]),
        ) as Partial<Record<LotId, number>>;
        const technicalByLot = Object.fromEntries(
          pair.lots.map((lotId) => [lotId, lotScores[bidder.id][lotId].technical]),
        ) as Partial<Record<LotId, number>>;
        candidates.push({
          id: `${bidder.id}:${pair.id}:combo`,
          bidderId: bidder.id,
          bidderName: bidder.name,
          kind: "combo",
          lotIds: [...pair.lots],
          pairId: pair.id,
          totalScore: score.totalScore,
          technicalScore: score.technicalScore,
          scoreByLot,
          technicalByLot,
        });
      }
    }
  }
  return candidates;
};

const scenarioKey = (assignments: AssignmentCandidate[]) => assignments.map((assignment) => assignment.id).sort().join("||");

const enumerateScenarios = (candidates: AssignmentCandidate[], allowAwardLimitDerogation: boolean): Scenario[] => {
  const scenarios = new Map<string, Scenario>();
  const lots = LOTS.map((lot) => lot.id);

  const recurse = (
    processedLots: Set<LotId>,
    occupiedLots: Set<LotId>,
    bidderCounts: Record<string, number>,
    assignments: AssignmentCandidate[],
  ) => {
    const nextLot = lots.find((lotId) => !processedLots.has(lotId));
    if (!nextLot) {
      const totalScore = round4(assignments.reduce((sum, assignment) => sum + assignment.totalScore, 0));
      const technicalScore = round4(assignments.reduce((sum, assignment) => sum + assignment.technicalScore, 0));
      const unassignedLots = lots.filter((lotId) => !occupiedLots.has(lotId));
      const key = scenarioKey(assignments);
      scenarios.set(key || "empty", {
        id: key || "empty",
        assignments: [...assignments],
        totalScore,
        technicalScore,
        unassignedLots,
        drawRequired: false,
        awardLimitDerogationUsed: Object.values(bidderCounts).some((count) => count > 2),
      });
      return;
    }

    recurse(new Set([...processedLots, nextLot]), occupiedLots, bidderCounts, assignments);

    for (const candidate of candidates) {
      if (candidate.lotIds[0] !== nextLot && candidate.lotIds[1] !== nextLot) continue;
      let hasOccupiedLot = false;
      for (const lotId of candidate.lotIds) {
        if (occupiedLots.has(lotId)) hasOccupiedLot = true;
      }
      if (hasOccupiedLot) continue;
      const currentCount = bidderCounts[candidate.bidderId] ?? 0;
      const nextCount = currentCount + candidate.lotIds.length;
      if (!allowAwardLimitDerogation && nextCount > 2) continue;
      const nextProcessed = new Set(processedLots);
      const nextOccupied = new Set(occupiedLots);
      candidate.lotIds.forEach((lotId) => {
        nextProcessed.add(lotId);
        nextOccupied.add(lotId);
      });
      recurse(nextProcessed, nextOccupied, { ...bidderCounts, [candidate.bidderId]: nextCount }, [...assignments, candidate]);
    }
  };

  recurse(new Set(), new Set(), {}, []);

  const sorted = Array.from(scenarios.values());
  sorted.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.technicalScore !== a.technicalScore) return b.technicalScore - a.technicalScore;
    return a.id.localeCompare(b.id);
  });

  const best = sorted[0];
  if (best) {
    const tied = sorted.filter((scenario) => scenario.totalScore === best.totalScore && scenario.technicalScore === best.technicalScore);
    if (tied.length > 1) {
      tied.forEach((scenario) => {
        scenario.drawRequired = true;
      });
    }
  }

  return sorted;
};

const enumerateScenariosWithAwardLimitPolicy = (candidates: AssignmentCandidate[], settings: Settings): Scenario[] => {
  const limitedScenarios = enumerateScenarios(candidates, false);
  const bestLimitedScenario = limitedScenarios[0];

  if (!settings.applyAwardLimitDerogation || !bestLimitedScenario?.unassignedLots.length) {
    return limitedScenarios;
  }

  const relaxedScenarios = enumerateScenarios(candidates, true);
  const bestRelaxedScenario = relaxedScenarios[0];
  return bestRelaxedScenario && bestRelaxedScenario.unassignedLots.length < bestLimitedScenario.unassignedLots.length
    ? relaxedScenarios
    : limitedScenarios;
};

const lotRankings = (candidates: AssignmentCandidate[]) => {
  return Object.fromEntries(
    LOTS.map((lot) => [
      lot.id,
      candidates
        .filter((candidate) => candidate.lotIds.includes(lot.id))
        .sort((a, b) => {
          const aLotScore = candidateLotScore(a, lot.id);
          const bLotScore = candidateLotScore(b, lot.id);
          if (bLotScore !== aLotScore) return bLotScore - aLotScore;
          return candidateLotTechnicalScore(b, lot.id) - candidateLotTechnicalScore(a, lot.id);
        }),
    ]),
  ) as Record<LotId, AssignmentCandidate[]>;
};

export const candidateLotScore = (candidate: AssignmentCandidate, lotId: LotId) => {
  const lotScore = candidate.scoreByLot[lotId];
  if (typeof lotScore === "number") return lotScore;
  if (candidate.kind === "single") return candidate.totalScore;
  return candidate.totalScore / candidate.lotIds.length;
};

const candidateLotTechnicalScore = (candidate: AssignmentCandidate, lotId: LotId) => {
  const lotTechnicalScore = candidate.technicalByLot[lotId];
  if (typeof lotTechnicalScore === "number") return lotTechnicalScore;
  if (candidate.kind === "single") return candidate.technicalScore;
  return candidate.technicalScore / candidate.lotIds.length;
};

const buildWarnings = (
  bidders: Bidder[],
  lotScores: Record<string, Record<LotId, LotScore>>,
  comboScores: Record<string, Record<PairId, ComboScore>>,
  scenarios: Scenario[],
) => {
    const warnings: string[] = [];
    for (const bidder of bidders) {
      for (const lot of LOTS) {
        for (const warning of lotScores[bidder.id][lot.id].warnings) {
          warnings.push(`${bidder.name} ${lot.shortLabel}: ${warning}`);
        }
      }
      for (const pair of PAIRS) {
        for (const warning of comboScores[bidder.id][pair.id].warnings) {
          warnings.push(`${bidder.name} ${pair.label}: ${warning}`);
        }
      }
    }
  const selected = scenarios[0];
  if (selected?.drawRequired) {
    warnings.push("Lo scenario migliore è ex aequo anche dopo il criterio tecnico: è richiesto sorteggio pubblico.");
  }
  if (selected?.awardLimitDerogationUsed) {
    warnings.push("Deroga al limite di due lotti applicata solo perché il limite ordinario lasciava almeno un lotto non assegnato.");
  }
  if (selected?.unassignedLots.length) {
    warnings.push(`Scenario selezionato con lotti non assegnati: ${selected.unassignedLots.join(", ")}.`);
  }
  return [...new Set(warnings)].slice(0, 20);
};

const effortWeight = (effort: Criterion["effort"]) => {
  if (effort === "basso") return 1;
  if (effort === "medio") return 1.8;
  return 3;
};

const formatInteger = (value: number) => Math.round(value).toLocaleString("it-IT");

const buildSuggestions = (
  bidders: Bidder[],
  lotScores: Record<string, Record<LotId, LotScore>>,
  comboScores: Record<string, Record<PairId, ComboScore>>,
  selectedBidderId: string,
): Suggestion[] => {
  const bidder = bidders.find((item) => item.id === selectedBidderId) ?? bidders[0];
  if (!bidder) return [];
  const suggestions: Suggestion[] = [];

  for (const lot of LOTS) {
    const score = lotScores[bidder.id][lot.id];
    if (!score.participates) continue;
    for (const criterion of CRITERIA) {
      const subScore = score.subScores[criterion.id];
      if (!subScore) continue;
      const gap = round4(Math.max(0, criterion.maxPoints - subScore.rawScore));
      if (gap <= 0.01) continue;
      let body = "";
      if (criterion.kind === "T") {
        body = subScore.dependencyBlocked
          ? `${criterion.id}: prima risolvi la dipendenza indicata, poi il sì assegna ${formatPoints(criterion.maxPoints)} punti tabellari.`
          : `${criterion.id}: portare il selettore a sì assegna ${formatPoints(criterion.maxPoints)} punti tabellari se l'impegno è documentabile.`;
        } else if (criterion.formula === "higher") {
          let bestBidder: { bidder: Bidder; value: number } | undefined;
          for (const item of bidders) {
            if (!item.lots[lot.id].enabled) continue;
            const value = getQuantitativeCriterionValue(item.lots[lot.id], criterion);
            if (!bestBidder || value > bestBidder.value) bestBidder = { bidder: item, value };
          }
          const bestValue = bestBidder?.value ?? 0;
          const currentInput = bidder.lots[lot.id].quantityInputs?.[criterion.id];
          const bestInput = bestBidder?.bidder.lots[lot.id].quantityInputs?.[criterion.id];
        if (criterion.quantityInput && bestInput?.denominator) {
          const denominator = currentInput?.denominator || bestInput.denominator;
          const targetNumerator =
            denominator === bestInput.denominator ? bestInput.numerator : Math.ceil((bestValue / (criterion.quantityInput.kind === "percent" ? 100 : 1)) * denominator);
          body = `${criterion.id}: porta ${criterion.quantityInput.numeratorLabel.toLowerCase()} a circa ${formatInteger(targetNumerator)} su ${formatInteger(denominator)} ${criterion.quantityInput.denominatorUnit} per allinearti al migliore scenario corrente.`;
        } else {
          body = `${criterion.id}: per allinearti al migliore scenario corrente il valore deve raggiungere ${bestValue.toLocaleString("it-IT")} ${criterion.unit}.`;
        }
        } else if (criterion.formula === "lower") {
          let bestValue = Number.POSITIVE_INFINITY;
          for (const item of bidders) {
            if (!item.lots[lot.id].enabled) continue;
            bestValue = Math.min(bestValue, getQuantitativeCriterionValue(item.lots[lot.id], criterion) || Infinity);
          }
          if (bestValue === Number.POSITIVE_INFINITY) bestValue = 0;
          body = `${criterion.id}: il punteggio cresce riducendo l'indice verso ${bestValue.toLocaleString("it-IT")} ${criterion.unit}.`;
      } else if (criterion.formula === "soil") {
        body = `${criterion.id}: consumo di suolo netto <= 0 assegna direttamente il massimo previsto.`;
      } else {
        body = `${criterion.id}: serve migliorare il coefficiente discrezionale simulato; il punteggio viene poi riparametrato rispetto alla migliore offerta.`;
      }
      suggestions.push({
        bidderId: bidder.id,
        lotId: lot.id,
        title: `${lot.shortLabel} - ${criterion.label}`,
        body,
        priority: gap / effortWeight(criterion.effort),
        effort: criterion.effort,
        impact: gap,
      });
    }

    if (score.qtRaw < score.threshold) {
      suggestions.push({
        bidderId: bidder.id,
        lotId: lot.id,
        title: `${lot.shortLabel} - supera la soglia di sbarramento`,
        body: `Mancano ${formatPoints(score.threshold - score.qtRaw)} punti prima della riparametrazione. Dai priorità ai tabellari certi e ai quantitativi con gap maggiore.`,
        priority: 100 + (score.threshold - score.qtRaw),
        effort: "medio",
        impact: score.threshold - score.qtRaw,
      });
    }
  }

  for (const pair of PAIRS) {
    const combo = comboScores[bidder.id][pair.id];
    if (!bidder.combos[pair.id].enabled || combo.admissible) continue;
    const increase = Math.max(0, combo.minRequiredRibasso - combo.ribasso + 0.0001);
    suggestions.push({
      bidderId: bidder.id,
      pairId: pair.id,
      title: `${pair.label} - rendi ammissibile la combinatoria`,
      body: combo.warnings.length
        ? `${combo.warnings[0]} Incremento minimo stimato del ribasso combinatorio: ${(increase * 100).toLocaleString("it-IT", { maximumFractionDigits: 2 })}%.`
        : "Verifica inserimento in entrambe le buste, PEF combinatorio e risparmio reale rispetto alle offerte singole.",
      priority: 50 + increase * 100,
      effort: "medio",
      impact: combo.totalScore,
    });
  }

  return suggestions.sort((a, b) => b.priority - a.priority).slice(0, 10);
};

export const simulate = (bidders: Bidder[], settings: Settings, selectedBidderId: string): SimulationResult => {
  const lotScores = computeTechnicalRawScores(bidders, settings);
  const rMaxByLot = computeRMaxByLot(bidders, lotScores);
  computeSingleEconomicScores(bidders, lotScores, rMaxByLot);
  const comboScores = computeComboScores(bidders, lotScores, rMaxByLot);
  const candidates = buildCandidates(bidders, lotScores, comboScores);
  const scenarios = enumerateScenariosWithAwardLimitPolicy(candidates, settings);
  return {
    lotScores,
    comboScores,
    rMaxByLot,
    candidates,
    scenarios,
    selectedScenario: scenarios[0],
    lotRankings: lotRankings(candidates),
    warnings: buildWarnings(bidders, lotScores, comboScores, scenarios),
    suggestions: buildSuggestions(bidders, lotScores, comboScores, selectedBidderId),
  };
};

const criteriaByAmbit = (ambit: Ambit) => CRITERIA.filter((criterion) => criterion.ambit === ambit.id);

export const maxQtPoints = () => {
  let total = 0;
  for (const criterion of CRITERIA) {
    if (criterion.kind !== "D") total += criterion.maxPoints;
  }
  return total;
};

const getCriterion = (id: string) => {
  const criterion = CRITERIA.find((item) => item.id === id);
  if (!criterion) throw new Error(`Unknown criterion ${id}`);
  return criterion;
};

export const criteriaByParent = (ambit: Ambit) => {
  const grouped = new Map<string, { parentId: string; parentLabel: string; criteria: Criterion[] }>();
  for (const criterion of criteriaByAmbit(ambit)) {
    const current = grouped.get(criterion.parentId) ?? {
      parentId: criterion.parentId,
      parentLabel: criterion.parentLabel,
      criteria: [],
    };
    current.criteria.push(criterion);
    grouped.set(criterion.parentId, current);
  }
  return [...grouped.values()];
};
