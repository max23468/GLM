import {
  CRITERIA,
  LOTS,
  PAIRS,
  THRESHOLD_OPTIONS,
  type Criterion,
  type LotId,
  type PairId,
} from "./tender";
import {
  computeQuantityInputValue,
  createBidder,
  type Bidder,
  type LotOffer,
  type QuantityInputValue,
  type Settings,
  type TradeoffPlan,
} from "../lib/scoring";
import { defaultOptimizationConfig, type OptimizationConfig, type OptimizationLeverInput } from "../lib/optimization";

export type BaseScenarioId = "market" | "tech" | "discount" | "local";

export type BaseScenario = {
  id: BaseScenarioId;
  title: string;
  body: string;
  basis: string[];
  defaultBidderId: string;
  defaultLotId: LotId;
  defaultPairId: PairId;
  settings: Settings;
  buildOptimizationConfig: () => OptimizationConfig;
  buildBidders: () => Bidder[];
};

type OfferProfile = {
  quality: number;
  service: number;
  tech: number;
  digital: number;
  safety: number;
  stopFocus: number;
  environmental: number;
  discretionary: number;
  discounts: [number, number, number];
};

type LotBaseline = {
  busBase: number;
  annualRuns: number;
  stops: number;
  notableStops: number;
  railStops: number;
  lines: number;
};

type ScenarioAssumptionProfile = BaseScenarioId;

export const DEFAULT_SETTINGS: Settings = {
  threshold: THRESHOLD_OPTIONS[0].value,
  applyAwardLimitDerogation: false,
};

export const LOT_BASELINES: Record<LotId, LotBaseline> = {
  L1: { busBase: 100, annualRuns: 227005, stops: 520, notableStops: 124, railStops: 19, lines: 24 },
  L2: { busBase: 158, annualRuns: 548216, stops: 1373, notableStops: 343, railStops: 54, lines: 98 },
  L3: { busBase: 102, annualRuns: 565632, stops: 1243, notableStops: 260, railStops: 29, lines: 36 },
  L4: { busBase: 124, annualRuns: 528783, stops: 1546, notableStops: 324, railStops: 55, lines: 53 },
};

export const OFFER_PROFILES: Record<string, OfferProfile> = {
  autoguidovie: {
    quality: 0.88,
    service: 1.06,
    tech: 0.84,
    digital: 0.82,
    safety: 0.88,
    stopFocus: 0.78,
    environmental: 0.8,
    discretionary: 0.82,
    discounts: [4.4, 4.65, 4.9],
  },
  movibusWest: {
    quality: 0.76,
    service: 1.02,
    tech: 0.72,
    digital: 0.68,
    safety: 0.74,
    stopFocus: 0.72,
    environmental: 0.62,
    discretionary: 0.72,
    discounts: [4.7, 4.95, 5.15],
  },
  arriva: {
    quality: 0.8,
    service: 1.1,
    tech: 0.76,
    digital: 0.7,
    safety: 0.76,
    stopFocus: 0.68,
    environmental: 0.72,
    discretionary: 0.74,
    discounts: [5.15, 5.35, 5.55],
  },
  netAtm: {
    quality: 0.86,
    service: 1.04,
    tech: 0.9,
    digital: 0.86,
    safety: 0.88,
    stopFocus: 0.75,
    environmental: 0.88,
    discretionary: 0.82,
    discounts: [4.1, 4.35, 4.55],
  },
  starLocal: {
    quality: 0.76,
    service: 1.0,
    tech: 0.74,
    digital: 0.82,
    safety: 0.78,
    stopFocus: 0.74,
    environmental: 0.68,
    discretionary: 0.74,
    discounts: [3.8, 4.05, 4.15],
  },
};

const LOT_SCALE: Record<LotId, number> = {
  L1: 0.82,
  L2: 1.08,
  L3: 1,
  L4: 1.12,
};

const SCENARIO_COST_MULTIPLIER: Record<ScenarioAssumptionProfile, number> = {
  market: 1,
  tech: 1.08,
  discount: 0.92,
  local: 1.04,
};

const SCENARIO_OPTIMIZATION_SETTINGS: Record<
  ScenarioAssumptionProfile,
  Pick<OptimizationConfig, "mode" | "scope" | "economic">
> = {
  market: {
    mode: "technical-economic",
    scope: "active-lot",
    economic: { enabled: true, stepPercent: 0.1, maxDeltaPercent: 1.5 },
  },
  tech: {
    mode: "technical-economic",
    scope: "active-lot",
    economic: { enabled: true, stepPercent: 0.1, maxDeltaPercent: 1 },
  },
  discount: {
    mode: "technical-economic",
    scope: "active-lot",
    economic: { enabled: true, stepPercent: 0.15, maxDeltaPercent: 2.5 },
  },
  local: {
    mode: "technical-economic",
    scope: "active-lot",
    economic: { enabled: true, stepPercent: 0.1, maxDeltaPercent: 1.2 },
  },
};

const UNIT_COST_BY_CRITERION: Record<string, number> = {
  "A.1.1": 18,
  "A.1.2": 2.4,
  "B.1.1": 0.09,
  "B.2.1": 190,
  "B.3.1": 230,
  "B.4.1": 3.7,
  "C.1.1": 3600,
  "C.1.2": 4300,
  "C.2.1": 2600,
  "C.2.2": 120000,
  "C.2.3": 90000,
  "C.2.4": 950,
  "C.3.1": 3400,
  "C.3.2": 80000,
  "D.1.1": 22000,
  "D.1.2": 2500,
  "D.1.3": 9000,
  "D.2.1": 1200,
  "E.1.1": 110000,
  "F.1.1": 150000,
  "F.2.1": 950,
  "F.3.1": 1.7,
  "F.4.1": 350,
  "F.5.1": 60000,
  "G.2.1": 45000,
  "G.3.1": 40000,
  "G.5.1": 120000,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const rounded = (value: number, digits = 2) => Number(value.toFixed(digits));

const lotById = (lotId: LotId) => {
  const lot = LOTS.find((item) => item.id === lotId);
  if (!lot) throw new Error(`Unknown lot ${lotId}`);
  return lot;
};

const roundTo = (value: number, step: number) => {
  const roundedValue = Math.round(value / step) * step;
  const digits = step < 1 ? Math.ceil(Math.abs(Math.log10(step))) : 0;
  return Number(roundedValue.toFixed(digits));
};

const costForCriterion = (criterion: Criterion, profile: ScenarioAssumptionProfile) => {
  if (criterion.kind === "D") return 0;
  const baseCost = UNIT_COST_BY_CRITERION[criterion.id] ?? 1000;
  const multiplier = SCENARIO_COST_MULTIPLIER[profile] ?? 1;
  return Math.max(1, roundTo(baseCost * multiplier, baseCost >= 1000 ? 50 : 0.1));
};

const denominatorForCriterion = (lotId: LotId, criterion: Criterion) => {
  const baseline = LOT_BASELINES[lotId];
  if (criterion.quantityInput?.kind === "percent") return baseline.annualRuns;
  if (criterion.quantityInput?.kind === "ratio" || criterion.input === "ratio") return baseline.busBase;
  return 0;
};

const granularityUnitsForCriterion = (lotId: LotId, criterion: Criterion) => {
  const baseline = LOT_BASELINES[lotId];
  const lot = lotById(lotId);
  if (criterion.kind === "T") return 1;

  switch (criterion.id) {
    case "A.1.1":
      return Math.max(500, Math.round(baseline.annualRuns * 0.006));
    case "A.1.2":
      return lotId === "L1" ? 9000 : 15000;
    case "B.1.1":
      return Math.round(lot.minProductionYears3to7 * 0.01);
    case "B.2.1":
      return Math.max(80, Math.round(baseline.annualRuns * 0.0006));
    case "B.3.1":
      return Math.max(40, Math.round(baseline.annualRuns * 0.0003));
    case "B.4.1":
      return Math.round(lot.minProductionYears3to7 * 0.0045);
    case "D.1.1":
      return Math.max(6, Math.round(baseline.notableStops * 0.06));
    case "D.1.2":
      return Math.max(20, Math.round(baseline.stops * 0.06));
    case "D.1.3":
      return Math.max(5, Math.round(baseline.railStops * 0.27));
    case "D.2.1":
      return Math.max(5, Math.round(baseline.notableStops * 0.04));
    case "F.1.1":
      return 6;
    case "F.3.1":
      return Math.round(14000 * LOT_SCALE[lotId]);
    case "F.4.1":
      return 40;
    default:
      if (criterion.quantityInput?.kind === "ratio" || criterion.input === "ratio") return 1;
      return 1;
  }
};

const maxUnitsForCriterion = (lotId: LotId, criterion: Criterion) => {
  const baseline = LOT_BASELINES[lotId];
  const lot = lotById(lotId);
  if (criterion.kind === "T") return 1;

  switch (criterion.id) {
    case "A.1.1":
      return Math.max(500, Math.round(baseline.annualRuns * 0.012));
    case "A.1.2":
      return lotId === "L1" ? 18000 : 30000;
    case "B.1.1":
      return Math.round(lot.minProductionYears3to7 * 0.02);
    case "B.2.1":
      return Math.max(150, Math.round(baseline.annualRuns * 0.0012));
    case "B.3.1":
      return Math.max(80, Math.round(baseline.annualRuns * 0.0006));
    case "B.4.1":
      return Math.round(lot.minProductionYears3to7 * 0.009);
    case "D.1.1":
      return Math.max(10, Math.round(baseline.notableStops * 0.12));
    case "D.1.2":
      return Math.max(40, Math.round(baseline.stops * 0.12));
    case "D.1.3":
      return Math.max(8, Math.round(baseline.railStops * 0.55));
    case "D.2.1":
      return Math.max(10, Math.round(baseline.notableStops * 0.08));
    case "F.1.1":
      return 12;
    case "F.3.1":
      return Math.round(28000 * LOT_SCALE[lotId]);
    case "F.4.1":
      return 80;
    default:
      if (criterion.quantityInput?.kind === "ratio" || criterion.input === "ratio") return Math.max(1, Math.round(baseline.busBase * 0.25));
      return granularityUnitsForCriterion(lotId, criterion) * 5;
  }
};

const assumptionForCriterion = (
  lotId: LotId,
  criterion: Criterion,
  profile: ScenarioAssumptionProfile,
): OptimizationLeverInput => ({
  enabled: criterion.kind !== "D",
  granularityUnits: criterion.kind === "D" ? 0 : granularityUnitsForCriterion(lotId, criterion),
  maxUnits: criterion.kind === "D" ? 0 : maxUnitsForCriterion(lotId, criterion),
  unitCost: costForCriterion(criterion, profile),
  denominator: denominatorForCriterion(lotId, criterion),
});

const tradeoffForCriterion = (lotId: LotId, criterion: Criterion, profile: ScenarioAssumptionProfile): TradeoffPlan => {
  const assumption = assumptionForCriterion(lotId, criterion, profile);
  return {
    deltaUnits: assumption.granularityUnits,
    unitCost: assumption.unitCost,
    denominator: assumption.denominator,
  };
};

const scenarioTradeoffs = (lotId: LotId, profile: ScenarioAssumptionProfile) =>
  Object.fromEntries(CRITERIA.map((criterion) => [criterion.id, tradeoffForCriterion(lotId, criterion, profile)]));

const completeScenarioTradeoffs = (bidders: Bidder[], profile: ScenarioAssumptionProfile) =>
  bidders.map((bidder) => {
    LOTS.forEach((lot) => {
      bidder.lots[lot.id].tradeoffs = scenarioTradeoffs(lot.id, profile);
    });
    return bidder;
  });

export const buildScenarioOptimizationConfig = (profile: ScenarioAssumptionProfile): OptimizationConfig => {
  const scenarioSettings = SCENARIO_OPTIMIZATION_SETTINGS[profile];
  return {
    ...defaultOptimizationConfig(),
    ...scenarioSettings,
    economic: { ...scenarioSettings.economic },
    levers: Object.fromEntries(
      LOTS.map((lot) => [
        lot.id,
        Object.fromEntries(CRITERIA.map((criterion) => [criterion.id, assumptionForCriterion(lot.id, criterion, profile)])),
      ]),
    ) as OptimizationConfig["levers"],
  };
};

const quantityInputFromComputedValue = (criterion: Criterion, value: number, lotId: LotId): QuantityInputValue => {
  const baseline = LOT_BASELINES[lotId];
  const denominator = criterion.quantityInput?.kind === "percent" ? baseline.annualRuns : baseline.busBase;
  const ratio = criterion.quantityInput?.kind === "percent" ? clamp01(value / 100) : clamp01(value);
  return {
    numerator: Math.round(ratio * denominator),
    denominator,
  };
};

const withProfile = (base: OfferProfile, patch: Partial<OfferProfile>): OfferProfile => ({
  ...base,
  ...patch,
  discounts: patch.discounts ?? base.discounts,
});

const simulatedOffer = (lotId: LotId, profile: OfferProfile, assumptionProfile: ScenarioAssumptionProfile): LotOffer => {
  const lot = lotById(lotId);
  const scale = LOT_SCALE[lotId];
  const baseline = LOT_BASELINES[lotId];

  const qValue = (criterion: Criterion) => {
    switch (criterion.id) {
      case "A.1.1":
        return rounded(0.85 + profile.quality * 1.65 + (scale - 1) * 0.12);
      case "A.1.2":
        return Math.round(lot.minPassengerChecks * (0.96 + profile.quality * 0.55));
      case "B.1.1":
        return Math.round(lot.minProductionYears3to7 * 0.035 * profile.service * scale);
      case "B.2.1":
        return Math.round(baseline.annualRuns * 0.002 * profile.service);
      case "B.3.1":
        return Math.round(baseline.annualRuns * 0.00075 * profile.service * (0.88 + profile.digital * 0.25));
      case "B.4.1":
        return Math.round(lot.minProductionYears3to7 * 0.018 * profile.service);
      case "C.1.1":
        return rounded(clamp01(profile.tech - 0.05), 3);
      case "C.1.2":
        return rounded(clamp01(profile.tech), 3);
      case "C.2.1":
        return rounded(clamp01(profile.tech + 0.04), 3);
      case "C.2.4":
        return rounded(clamp01(profile.safety), 3);
      case "C.3.1":
        return rounded(clamp01(profile.digital), 3);
      case "D.1.1":
        return Math.round(baseline.notableStops * 0.28 * profile.stopFocus);
      case "D.1.2":
        return Math.round(baseline.stops * 0.08 * profile.stopFocus);
      case "D.1.3":
        return Math.round((baseline.railStops * 1.2 + baseline.notableStops * 0.08) * profile.digital);
      case "D.2.1":
        return Math.round(baseline.notableStops * 0.2 * profile.stopFocus);
      case "F.1.1":
        return Math.round(126 - profile.environmental * 58);
      case "F.2.1":
        return rounded(clamp01(profile.environmental), 3);
      case "F.3.1":
        return Math.round(85000 * profile.environmental * scale);
      case "F.4.1":
        return profile.stopFocus >= 0.78 ? 0 : Math.round(160 * (1 - profile.stopFocus) * scale);
      default:
        if (criterion.input === "ratio") return rounded(clamp01(profile.quality), 3);
        if (criterion.input === "index") return Math.round(126 - profile.quality * 45);
        if (criterion.input === "sqm") return Math.round(180 * (1 - profile.stopFocus));
        return Math.round((criterion.maxPoints * 160 + 260) * profile.quality * scale);
    }
  };

  const qValues = Object.fromEntries(CRITERIA.filter((criterion) => criterion.kind === "Q").map((criterion) => [criterion.id, qValue(criterion)]));
  const quantityInputs = Object.fromEntries(
    CRITERIA.filter((criterion) => criterion.quantityInput).map((criterion) => [
      criterion.id,
      quantityInputFromComputedValue(criterion, qValues[criterion.id] ?? 0, lotId),
    ]),
  );
  const tValues = Object.fromEntries(
    CRITERIA.filter((criterion) => criterion.kind === "T").map((criterion) => {
      const value =
        criterion.id === "C.2.2" ? profile.tech >= 0.72 :
        criterion.id === "C.2.3" ? profile.safety >= 0.78 :
        criterion.id === "C.3.2" ? profile.digital >= 0.55 :
        criterion.id === "E.1.1" ? profile.digital >= 0.6 :
        criterion.id === "F.5.1" ? profile.environmental >= 0.62 :
        criterion.id === "G.2.1" ? profile.safety >= 0.7 :
        criterion.id === "G.3.1" ? profile.quality >= 0.68 :
        true;
      return [criterion.id, value];
    }),
  );
  const dValues = Object.fromEntries(
    CRITERIA.filter((criterion) => criterion.kind === "D").map((criterion) => {
      const value =
        criterion.id === "B.5.1" ? profile.discretionary + (profile.service - 1) * 0.18 :
        criterion.id === "E.2.1" ? profile.discretionary + (profile.digital - 0.7) * 0.12 :
        criterion.id === "G.1.1" ? profile.discretionary + (profile.tech - 0.7) * 0.12 :
        criterion.id === "G.4.1" ? profile.discretionary + (profile.quality - 0.75) * 0.1 :
        profile.discretionary;
      return [criterion.id, rounded(clamp01(value), 2)];
    }),
  );
  return {
    enabled: true,
    qValues,
    quantityInputs,
    tValues,
    dValues,
    tradeoffs: scenarioTradeoffs(lotId, assumptionProfile),
    phaseDiscounts: profile.discounts,
  };
};

const buildMarketScenario = (assumptionProfile: ScenarioAssumptionProfile = "market"): Bidder[] => {
  const autoguidovie = createBidder("autoguidovie", "Autoguidovie");
  autoguidovie.lots.L1 = simulatedOffer("L1", OFFER_PROFILES.autoguidovie, assumptionProfile);
  autoguidovie.lots.L4 = simulatedOffer("L4", withProfile(OFFER_PROFILES.autoguidovie, { service: 1.08, discounts: [4.55, 4.8, 5.05] }), assumptionProfile);
  autoguidovie.combos["L1+L4"] = { enabled: true, phaseDiscounts: [5.05, 5.25, 5.45], insertedInBothBuste: true, pefCoherent: true };

  const movibus = createBidder("movibus-ovest", "Movibus RTI Ovest");
  movibus.lots.L1 = simulatedOffer("L1", withProfile(OFFER_PROFILES.movibusWest, { service: 1.04, discounts: [4.85, 5.05, 5.25] }), assumptionProfile);
  movibus.lots.L2 = simulatedOffer("L2", withProfile(OFFER_PROFILES.movibusWest, { quality: 0.78, stopFocus: 0.75, discounts: [5.0, 5.2, 5.4] }), assumptionProfile);
  movibus.combos["L1+L2"] = { enabled: true, phaseDiscounts: [5.4, 5.55, 5.75], insertedInBothBuste: true, pefCoherent: true };

  const arriva = createBidder("arriva", "Arriva Italia");
  arriva.lots.L2 = simulatedOffer("L2", OFFER_PROFILES.arriva, assumptionProfile);
  arriva.lots.L3 = simulatedOffer("L3", withProfile(OFFER_PROFILES.arriva, { service: 1.06, discounts: [4.95, 5.2, 5.45] }), assumptionProfile);
  arriva.combos["L2+L3"] = { enabled: true, phaseDiscounts: [5.7, 5.9, 6.1], insertedInBothBuste: true, pefCoherent: true };

  const netAtm = createBidder("net-atm", "NET / Gruppo ATM");
  netAtm.lots.L3 = simulatedOffer("L3", OFFER_PROFILES.netAtm, assumptionProfile);
  netAtm.lots.L4 = simulatedOffer("L4", withProfile(OFFER_PROFILES.netAtm, { service: 1.0, stopFocus: 0.72, discounts: [4.0, 4.25, 4.45] }), assumptionProfile);
  netAtm.combos["L3+L4"] = { enabled: true, phaseDiscounts: [4.9, 5.05, 5.25], insertedInBothBuste: true, pefCoherent: true };

  const star = createBidder("star-lodi", "STAR Mobility Lodi");
  star.lots.L4 = simulatedOffer("L4", OFFER_PROFILES.starLocal, assumptionProfile);

  return completeScenarioTradeoffs([autoguidovie, movibus, arriva, netAtm, star], assumptionProfile);
};

const baseBidder = (bidders: Bidder[], id: string) => {
  const bidder = bidders.find((item) => item.id === id);
  if (!bidder) throw new Error(`Unknown base bidder ${id}`);
  return bidder;
};

const buildTechScenario = (): Bidder[] => {
  const bidders = buildMarketScenario("tech");
  const netAtm = baseBidder(bidders, "net-atm");
  netAtm.lots.L3 = simulatedOffer("L3", withProfile(OFFER_PROFILES.netAtm, { tech: 0.96, digital: 0.92, environmental: 0.94, discounts: [3.9, 4.05, 4.25] }), "tech");
  netAtm.lots.L4 = simulatedOffer("L4", withProfile(OFFER_PROFILES.netAtm, { service: 1.02, tech: 0.94, digital: 0.9, environmental: 0.93, stopFocus: 0.78, discounts: [3.85, 4.05, 4.2] }), "tech");
  netAtm.combos["L3+L4"] = { enabled: true, phaseDiscounts: [4.55, 4.7, 4.9], insertedInBothBuste: true, pefCoherent: true };

  const autoguidovie = baseBidder(bidders, "autoguidovie");
  autoguidovie.lots.L1 = simulatedOffer("L1", withProfile(OFFER_PROFILES.autoguidovie, { environmental: 0.82, digital: 0.82, discounts: [4.1, 4.35, 4.6] }), "tech");
  autoguidovie.lots.L4 = simulatedOffer("L4", withProfile(OFFER_PROFILES.autoguidovie, { service: 1.08, environmental: 0.82, digital: 0.8, discounts: [4.2, 4.45, 4.7] }), "tech");
  return completeScenarioTradeoffs(bidders, "tech");
};

const buildDiscountScenario = (): Bidder[] => {
  const bidders = buildMarketScenario("discount");
  const movibus = baseBidder(bidders, "movibus-ovest");
  movibus.lots.L1 = simulatedOffer("L1", withProfile(OFFER_PROFILES.movibusWest, { quality: 0.71, tech: 0.66, environmental: 0.56, discounts: [5.55, 5.8, 6.0] }), "discount");
  movibus.lots.L2 = simulatedOffer("L2", withProfile(OFFER_PROFILES.movibusWest, { quality: 0.73, tech: 0.68, stopFocus: 0.7, environmental: 0.58, discounts: [5.65, 5.9, 6.1] }), "discount");
  movibus.combos["L1+L2"] = { enabled: true, phaseDiscounts: [6.15, 6.35, 6.55], insertedInBothBuste: true, pefCoherent: true };

  const arriva = baseBidder(bidders, "arriva");
  arriva.lots.L2 = simulatedOffer("L2", withProfile(OFFER_PROFILES.arriva, { tech: 0.71, digital: 0.66, stopFocus: 0.64, discounts: [5.9, 6.15, 6.35] }), "discount");
  arriva.lots.L3 = simulatedOffer("L3", withProfile(OFFER_PROFILES.arriva, { service: 1.02, tech: 0.7, digital: 0.65, discounts: [5.8, 6.05, 6.25] }), "discount");
  arriva.combos["L2+L3"] = { enabled: true, phaseDiscounts: [6.35, 6.55, 6.75], insertedInBothBuste: true, pefCoherent: true };
  return completeScenarioTradeoffs(bidders, "discount");
};

const buildLocalScenario = (): Bidder[] => {
  const bidders = buildMarketScenario("local");
  const star = baseBidder(bidders, "star-lodi");
  star.lots.L4 = simulatedOffer("L4", withProfile(OFFER_PROFILES.starLocal, { quality: 0.76, service: 1.03, tech: 0.7, digital: 0.78, safety: 0.74, stopFocus: 0.72, environmental: 0.62, discretionary: 0.72, discounts: [4.45, 4.65, 4.85] }), "local");

  const netAtm = baseBidder(bidders, "net-atm");
  netAtm.lots.L4 = simulatedOffer("L4", withProfile(OFFER_PROFILES.netAtm, { service: 0.94, stopFocus: 0.67, discounts: [3.8, 4.0, 4.15] }), "local");

  const autoguidovie = baseBidder(bidders, "autoguidovie");
  autoguidovie.combos["L1+L4"] = { enabled: false, phaseDiscounts: [0, 0, 0], insertedInBothBuste: true, pefCoherent: true };
  return completeScenarioTradeoffs(bidders, "local");
};

export const BASE_SCENARIOS: BaseScenario[] = [
  {
    id: "market",
    title: "Mercato realistico",
    body: "Operatori noti del bacino, combinatorie plausibili e profili tecnici differenziati.",
    basis: [
      "Basi di lotto da All. 04, All. 05 e All. 09: mezzi, fermate e corse annue stimate.",
      "Profili operatori calibrati su segnali pubblici: flotta, tecnologie, presidio territoriale.",
      "Combinatorie coerenti con adiacenze e strategie industriali plausibili, non con offerte ufficiali.",
    ],
    defaultBidderId: "autoguidovie",
    defaultLotId: "L1",
    defaultPairId: "L1+L4",
    settings: DEFAULT_SETTINGS,
    buildOptimizationConfig: () => buildScenarioOptimizationConfig("market"),
    buildBidders: buildMarketScenario,
  },
  {
    id: "tech",
    title: "Tecnologia e flotta",
    body: "Scenario in cui pesano copertura di bordo, informazione dinamica e performance ambientali.",
    basis: [
      "Autoguidovie: flotta 777 mezzi, AVM, accessibilità, videosorveglianza e ADAS su fonti ufficiali.",
      "NET/ATM: presidio nord-est milanese e traiettoria dichiarata verso flotta bus elettrica.",
      "Le coperture C e F partono da input elementari: autobus attrezzati su autobus totali di lotto.",
    ],
    defaultBidderId: "net-atm",
    defaultLotId: "L3",
    defaultPairId: "L3+L4",
    settings: DEFAULT_SETTINGS,
    buildOptimizationConfig: () => buildScenarioOptimizationConfig("tech"),
    buildBidders: buildTechScenario,
  },
  {
    id: "discount",
    title: "Ribasso aggressivo",
    body: "Scenario economico con maggiore spinta sui ribassi e qualche compromesso tecnico.",
    basis: [
      "Ribassi più alti per stressare soglia Q/T, riparametrazione e convenienza delle combinatorie.",
      "Arriva: benchmark su scala nazionale e piano di rinnovo flotta, senza trasformarlo in offerta tecnica reale.",
      "Le metriche operative restano ancorate alle basi documentali dei singoli lotti.",
    ],
    defaultBidderId: "arriva",
    defaultLotId: "L2",
    defaultPairId: "L2+L3",
    settings: DEFAULT_SETTINGS,
    buildOptimizationConfig: () => buildScenarioOptimizationConfig("discount"),
    buildBidders: buildDiscountScenario,
  },
  {
    id: "local",
    title: "Presidio locale",
    body: "Scenario in cui il lotto 4 premia conoscenza territoriale e continuità operativa.",
    basis: [
      "Lotto 4 tarato sulle grandezze locali ricavate dagli allegati: 124 mezzi e 1.546 fermate.",
      "STAR: segnali pubblici su Lodi/Casalpusterlengo, bigliettazione elettronica e pagamento a bordo.",
      "Il presidio locale migliora alcune leve di fermata e informazione, ma non sostituisce la comparazione economica.",
    ],
    defaultBidderId: "star-lodi",
    defaultLotId: "L4",
    defaultPairId: "L3+L4",
    settings: DEFAULT_SETTINGS,
    buildOptimizationConfig: () => buildScenarioOptimizationConfig("local"),
    buildBidders: buildLocalScenario,
  },
];

export const isBaseScenarioId = (value: string): value is BaseScenarioId =>
  BASE_SCENARIOS.some((scenario) => scenario.id === value);

export const getBaseScenario = (value?: string): BaseScenario =>
  BASE_SCENARIOS.find((scenario) => scenario.id === value) ?? BASE_SCENARIOS[0];
