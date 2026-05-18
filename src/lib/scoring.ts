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

export type LotOffer = {
  enabled: boolean;
  qValues: Record<string, number>;
  tValues: Record<string, boolean>;
  dValues: Record<string, number>;
  tradeoffs: Record<string, TradeoffPlan>;
  phaseDiscounts: [number, number, number];
};

export type TradeoffPlan = {
  deltaUnits: number;
  unitCost: number;
  denominator: number;
};

export type ComboOffer = {
  enabled: boolean;
  phaseDiscounts: [number, number, number];
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
};

export type Scenario = {
  id: string;
  assignments: AssignmentCandidate[];
  totalScore: number;
  technicalScore: number;
  unassignedLots: LotId[];
  drawRequired: boolean;
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

export const emptyLotOffer = (): LotOffer => ({
  enabled: false,
  qValues: Object.fromEntries(CRITERIA.filter((criterion) => criterion.kind === "Q").map((criterion) => [criterion.id, 0])),
  tValues: Object.fromEntries(CRITERIA.filter((criterion) => criterion.kind === "T").map((criterion) => [criterion.id, false])),
  dValues: Object.fromEntries(CRITERIA.filter((criterion) => criterion.kind === "D").map((criterion) => [criterion.id, 0.6])),
  tradeoffs: emptyTradeoffs(),
  phaseDiscounts: [0, 0, 0],
});

export const emptyTradeoffs = () =>
  Object.fromEntries(CRITERIA.map((criterion) => [criterion.id, { deltaUnits: 0, unitCost: 0, denominator: 0 } satisfies TradeoffPlan]));

export const emptyComboOffer = (): ComboOffer => ({
  enabled: false,
  phaseDiscounts: [0, 0, 0],
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

export const round2 = (value: number) => round(value, 2);
export const round4 = (value: number) => round(value, 4);

export const formatPoints = (value: number) => round2(value).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatPercent = (value: number) => (value * 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

export const computeWeightedRibasso = (baseByPhase: [number, number, number], phaseDiscounts: [number, number, number]) => {
  const roundedDiscounts = phaseDiscounts.map((item) => round4(discountToDecimal(item))) as [number, number, number];
  const baseTotal = baseByPhase.reduce((sum, value) => sum + value, 0);
  const offered = baseByPhase.reduce((sum, base, index) => sum + base * (1 - roundedDiscounts[index]), 0);
  return round4(1 - offered / baseTotal);
};

const pairBaseByPhase = (pairId: PairId): [number, number, number] => {
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
        singleRibasso: computeWeightedRibasso(lot.baseByPhase, bidder.lots[lot.id].phaseDiscounts),
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
      const enabledOffers = bidders.filter((bidder) => bidder.lots[lot.id].enabled);
      const values = enabledOffers.map((bidder) => {
        const offer = bidder.lots[lot.id];
        if (criterion.kind === "Q") return offer.qValues[criterion.id] ?? 0;
        if (criterion.kind === "T") return offer.tValues[criterion.id] ?? false;
        return offer.dValues[criterion.id] ?? 0;
      });
      const numericValues = values.map(Number).filter((value) => Number.isFinite(value));
      const maxValue = Math.max(0, ...numericValues);
      const positiveValues = numericValues.filter((value) => value > 0);
      const minPositive = positiveValues.length ? Math.min(...positiveValues) : 0;
      const maxDiscretionary = criterion.kind === "D" ? Math.max(0, ...numericValues) : 0;

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
          value = lotOffer.qValues[criterion.id] ?? 0;
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
            const dependencyValue = lotOffer.qValues[criterion.dependency.criterionId] ?? 0;
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
      score.admitted = score.participates && score.qtRaw >= settings.threshold;
      if (score.participates && !score.admitted) {
        score.warnings.push(`Sotto soglia Q/T: ${formatPoints(score.qtRaw)} < ${formatPoints(settings.threshold)}.`);
      }
    }

    for (const ambit of AMBITS) {
      const bestRaw = Math.max(
        0,
        ...bidders
          .map((bidder) => result[bidder.id][lot.id])
          .filter((score) => score.admitted)
          .map((score) => score.rawByAmbit[ambit.id] ?? 0),
      );
      for (const bidder of bidders) {
        const score = result[bidder.id][lot.id];
        const raw = score.rawByAmbit[ambit.id] ?? 0;
        score.riparamByAmbit[ambit.id] = score.admitted && bestRaw > 0 ? round4(clamp(raw * (ambit.maxPoints / bestRaw), 0, ambit.maxPoints)) : 0;
      }
    }

    for (const bidder of bidders) {
      const score = result[bidder.id][lot.id];
      score.technical = round4(Object.values(score.riparamByAmbit).reduce((sum, value) => sum + value, 0));
    }
  }

  return result;
};

const comboHasOverlaps = (bidder: Bidder, pairId: PairId) => {
  const enabledPairs = PAIRS.filter((pair) => bidder.combos[pair.id].enabled).map((pair) => pair.id);
  const selected = getPair(pairId);
  return enabledPairs.some((otherId) => {
    if (otherId === pairId) return false;
    const other = getPair(otherId);
    return selected.lots.some((lotId) => other.lots.includes(lotId));
  });
};

const comboSetAllowed = (bidder: Bidder) => {
  const enabled = PAIRS.filter((pair) => bidder.combos[pair.id].enabled).map((pair) => pair.id).sort();
  if (enabled.length <= 1) return true;
  if (enabled.length > 2) return false;
  return COMPATIBLE_PAIR_SETS.some((set) => [...set].sort().join("|") === enabled.join("|"));
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
          const ribasso = computeWeightedRibasso(pairBaseByPhase(pair.id), combo.phaseDiscounts);
          const singleOfferedSum = firstLot.totalBase * (1 - firstScore.singleRibasso) + secondLot.totalBase * (1 - secondScore.singleRibasso);
          const minRequiredRibasso = round4(1 - singleOfferedSum / baseSum);
          const warnings: string[] = [];

          if (combo.enabled && (!firstScore.participates || !secondScore.participates)) {
            warnings.push("L'offerta combinatoria richiede offerte singole su entrambi i lotti.");
          }
          if (combo.enabled && (!firstScore.admitted || !secondScore.admitted)) {
            warnings.push("Almeno uno dei due lotti non supera la soglia tecnica Q/T.");
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
          if (combo.enabled && ribasso <= minRequiredRibasso) {
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
            ribasso > minRequiredRibasso;

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
    const singleRibassi = bidders
      .filter((bidder) => lotScores[bidder.id][lot.id].admitted)
      .map((bidder) => lotScores[bidder.id][lot.id].singleRibasso);
    const comboRibassi = bidders.flatMap((bidder) =>
      PAIRS.filter((pair) => {
        const combo = bidder.combos[pair.id];
        const [firstLotId, secondLotId] = pair.lots;
        const firstScore = lotScores[bidder.id][firstLotId];
        const secondScore = lotScores[bidder.id][secondLotId];
        const firstLot = getLot(firstLotId);
        const secondLot = getLot(secondLotId);
        const baseSum = firstLot.totalBase + secondLot.totalBase;
        const ribasso = computeWeightedRibasso(pairBaseByPhase(pair.id), combo.phaseDiscounts);
        const singleOfferedSum = firstLot.totalBase * (1 - firstScore.singleRibasso) + secondLot.totalBase * (1 - secondScore.singleRibasso);
        const minRequiredRibasso = round4(1 - singleOfferedSum / baseSum);

        return (
          pair.lots.includes(lot.id) &&
          combo.enabled &&
          firstScore.admitted &&
          secondScore.admitted &&
          !comboHasOverlaps(bidder, pair.id) &&
          comboSetAllowed(bidder) &&
          combo.insertedInBothBuste &&
          combo.pefCoherent &&
          ribasso > minRequiredRibasso
        );
      }).map((pair) => computeWeightedRibasso(pairBaseByPhase(pair.id), bidder.combos[pair.id].phaseDiscounts)),
    );
    rMaxByLot[lot.id] = Math.max(0, ...singleRibassi, ...comboRibassi);
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
        });
      }
    }

    for (const pair of PAIRS) {
      const score = comboScores[bidder.id][pair.id];
      if (score.admissible) {
        candidates.push({
          id: `${bidder.id}:${pair.id}:combo`,
          bidderId: bidder.id,
          bidderName: bidder.name,
          kind: "combo",
          lotIds: [...pair.lots],
          pairId: pair.id,
          totalScore: score.totalScore,
          technicalScore: score.technicalScore,
        });
      }
    }
  }
  return candidates;
};

const scenarioKey = (assignments: AssignmentCandidate[]) => assignments.map((assignment) => assignment.id).sort().join("||");

const enumerateScenarios = (candidates: AssignmentCandidate[], settings: Settings): Scenario[] => {
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
      });
      return;
    }

    recurse(new Set([...processedLots, nextLot]), occupiedLots, bidderCounts, assignments);

    for (const candidate of candidates.filter((item) => item.lotIds.includes(nextLot))) {
      if (candidate.lotIds.some((lotId) => occupiedLots.has(lotId))) continue;
      const currentCount = bidderCounts[candidate.bidderId] ?? 0;
      const nextCount = currentCount + candidate.lotIds.length;
      if (!settings.applyAwardLimitDerogation && nextCount > 2) continue;
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

  const sorted = [...scenarios.values()].sort((a, b) => {
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
          return b.technicalScore - a.technicalScore;
        }),
    ]),
  ) as Record<LotId, AssignmentCandidate[]>;
};

const candidateLotScore = (candidate: AssignmentCandidate, lotId: LotId) => {
  if (candidate.kind === "single") return candidate.totalScore;
  return candidate.totalScore / candidate.lotIds.length;
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
      warnings.push(...lotScores[bidder.id][lot.id].warnings.map((warning) => `${bidder.name} ${lot.shortLabel}: ${warning}`));
    }
    for (const pair of PAIRS) {
      warnings.push(...comboScores[bidder.id][pair.id].warnings.map((warning) => `${bidder.name} ${pair.label}: ${warning}`));
    }
  }
  const selected = scenarios[0];
  if (selected?.drawRequired) {
    warnings.push("Lo scenario migliore è ex aequo anche dopo il criterio tecnico: è richiesto sorteggio pubblico.");
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
        const bestValue = Math.max(...bidders.filter((item) => item.lots[lot.id].enabled).map((item) => item.lots[lot.id].qValues[criterion.id] ?? 0));
        body = `${criterion.id}: per allinearti al migliore scenario corrente il valore deve raggiungere ${bestValue.toLocaleString("it-IT")} ${criterion.unit}.`;
      } else if (criterion.formula === "lower") {
        const bestValue = Math.min(...bidders.filter((item) => item.lots[lot.id].enabled).map((item) => item.lots[lot.id].qValues[criterion.id] ?? Infinity));
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
        title: `${lot.shortLabel} - supera la soglia Q/T`,
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
        ? `${combo.warnings[0]} Incremento minimo stimato del ribasso combinatorio: ${(increase * 100).toLocaleString("it-IT", { maximumFractionDigits: 2 })} punti percentuali.`
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
  const scenarios = enumerateScenarios(candidates, settings);
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

export const criteriaByAmbit = (ambit: Ambit) => CRITERIA.filter((criterion) => criterion.ambit === ambit.id);

export const maxQtPoints = () => CRITERIA.filter((criterion) => criterion.kind !== "D").reduce((sum, criterion) => sum + criterion.maxPoints, 0);

export const getCriterion = (id: string) => {
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
