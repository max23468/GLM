import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  type LucideIcon,
  Monitor,
  Moon,
  Plus,
  Route,
  SlidersHorizontal,
  Sun,
  Trash2,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AMBITS,
  CRITERIA,
  DISCRETIONARY_SCALE,
  DOCUMENT_WARNINGS,
  LOT_CONTEXT,
  LOTS,
  PAIRS,
  PUBLIC_SOURCE_NOTES,
  THRESHOLD_OPTIONS,
  type Criterion,
  type LotId,
  type PairId,
} from "./data/tender";
import {
  computeQuantityInputValue,
  createBidder,
  criteriaByParent,
  emptyTradeoffs,
  formatPercent,
  formatPoints,
  getQuantitativeCriterionValue,
  maxQtPoints,
  round4,
  simulate,
  type Bidder,
  type ComboScore,
  type LotScore,
  type LotOffer,
  type QuantityInputValue,
  type Settings,
  type SimulationResult,
  type TradeoffPlan,
} from "./lib/scoring";

const euroFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
type ThemePreference = "auto" | "light" | "dark";
type WorkspaceTab = "tecnica" | "economica" | "combinatorie" | "risultati";

const THEME_STORAGE_KEY = "tpl-simulator-theme";

const themeOptions: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "auto", label: "Auto", icon: Monitor },
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "dark", label: "Scuro", icon: Moon },
];

const workspaceTabs: { value: WorkspaceTab; label: string; icon: LucideIcon }[] = [
  { value: "tecnica", label: "Tecnica", icon: BarChart3 },
  { value: "economica", label: "Economica", icon: CircleDollarSign },
  { value: "combinatorie", label: "Combinatorie", icon: Route },
  { value: "risultati", label: "Risultati", icon: Trophy },
];

const criterionKindLabel: Record<Criterion["kind"], string> = {
  Q: "Quantitativo",
  T: "Tabellare",
  D: "Discrezionale",
};

const getStoredTheme = (): ThemePreference => {
  if (typeof window === "undefined") return "auto";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
};

const defaultSettings: Settings = {
  threshold: THRESHOLD_OPTIONS[0].value,
  applyAwardLimitDerogation: false,
};

type DemoOfferProfile = {
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

type LotDemoBaseline = {
  busBase: number;
  annualRuns: number;
  stops: number;
  notableStops: number;
  railStops: number;
  lines: number;
};

const LOT_DEMO_BASELINES: Record<LotId, LotDemoBaseline> = {
  L1: { busBase: 100, annualRuns: 227005, stops: 520, notableStops: 124, railStops: 19, lines: 24 },
  L2: { busBase: 158, annualRuns: 548216, stops: 1373, notableStops: 343, railStops: 54, lines: 98 },
  L3: { busBase: 102, annualRuns: 565632, stops: 1243, notableStops: 260, railStops: 29, lines: 36 },
  L4: { busBase: 124, annualRuns: 528783, stops: 1546, notableStops: 324, railStops: 55, lines: 53 },
};

const DEMO_PROFILES: Record<string, DemoOfferProfile> = {
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

const lotScale: Record<LotId, number> = {
  L1: 0.82,
  L2: 1.08,
  L3: 1,
  L4: 1.12,
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const rounded = (value: number, digits = 2) => Number(value.toFixed(digits));

const quantityInputFromComputedValue = (criterion: Criterion, value: number, lotId: LotId): QuantityInputValue => {
  const baseline = LOT_DEMO_BASELINES[lotId];
  const denominator = criterion.quantityInput?.kind === "percent" ? baseline.annualRuns : baseline.busBase;
  const ratio = criterion.quantityInput?.kind === "percent" ? clamp01(value / 100) : clamp01(value);
  return {
    numerator: Math.round(ratio * denominator),
    denominator,
  };
};

const withProfile = (base: DemoOfferProfile, patch: Partial<DemoOfferProfile>): DemoOfferProfile => ({
  ...base,
  ...patch,
  discounts: patch.discounts ?? base.discounts,
});

const realisticOffer = (lotId: LotId, profile: DemoOfferProfile): LotOffer => {
  const lot = LOTS.find((item) => item.id === lotId);
  if (!lot) throw new Error(`Unknown lot ${lotId}`);
  const scale = lotScale[lotId];
  const baseline = LOT_DEMO_BASELINES[lotId];

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
    tradeoffs: emptyTradeoffs(),
    phaseDiscounts: profile.discounts,
  };
};

const buildMarketScenario = (): Bidder[] => {
  const autoguidovie = createBidder("autoguidovie-demo", "Autoguidovie (scenario demo)");
  autoguidovie.lots.L1 = realisticOffer("L1", DEMO_PROFILES.autoguidovie);
  autoguidovie.lots.L4 = realisticOffer("L4", withProfile(DEMO_PROFILES.autoguidovie, { service: 1.08, discounts: [4.55, 4.8, 5.05] }));
  autoguidovie.combos["L1+L4"] = { enabled: true, phaseDiscounts: [5.05, 5.25, 5.45], insertedInBothBuste: true, pefCoherent: true };

  const movibus = createBidder("movibus-ovest-demo", "Movibus RTI Ovest (scenario demo)");
  movibus.lots.L1 = realisticOffer("L1", withProfile(DEMO_PROFILES.movibusWest, { service: 1.04, discounts: [4.85, 5.05, 5.25] }));
  movibus.lots.L2 = realisticOffer("L2", withProfile(DEMO_PROFILES.movibusWest, { quality: 0.78, stopFocus: 0.75, discounts: [5.0, 5.2, 5.4] }));
  movibus.combos["L1+L2"] = { enabled: true, phaseDiscounts: [5.4, 5.55, 5.75], insertedInBothBuste: true, pefCoherent: true };

  const arriva = createBidder("arriva-demo", "Arriva Italia (scenario demo)");
  arriva.lots.L2 = realisticOffer("L2", DEMO_PROFILES.arriva);
  arriva.lots.L3 = realisticOffer("L3", withProfile(DEMO_PROFILES.arriva, { service: 1.06, discounts: [4.95, 5.2, 5.45] }));
  arriva.combos["L2+L3"] = { enabled: true, phaseDiscounts: [5.7, 5.9, 6.1], insertedInBothBuste: true, pefCoherent: true };

  const netAtm = createBidder("net-atm-demo", "NET / Gruppo ATM (scenario demo)");
  netAtm.lots.L3 = realisticOffer("L3", DEMO_PROFILES.netAtm);
  netAtm.lots.L4 = realisticOffer("L4", withProfile(DEMO_PROFILES.netAtm, { service: 1.0, stopFocus: 0.72, discounts: [4.0, 4.25, 4.45] }));
  netAtm.combos["L3+L4"] = { enabled: true, phaseDiscounts: [4.9, 5.05, 5.25], insertedInBothBuste: true, pefCoherent: true };

  const star = createBidder("star-lodi-demo", "STAR Mobility Lodi (scenario demo)");
  star.lots.L4 = realisticOffer("L4", DEMO_PROFILES.starLocal);

  return [autoguidovie, movibus, arriva, netAtm, star];
};

const demoBidder = (bidders: Bidder[], id: string) => {
  const bidder = bidders.find((item) => item.id === id);
  if (!bidder) throw new Error(`Unknown demo bidder ${id}`);
  return bidder;
};

const buildTechScenario = (): Bidder[] => {
  const bidders = buildMarketScenario();
  const netAtm = demoBidder(bidders, "net-atm-demo");
  netAtm.lots.L3 = realisticOffer("L3", withProfile(DEMO_PROFILES.netAtm, { tech: 0.96, digital: 0.92, environmental: 0.94, discounts: [3.9, 4.05, 4.25] }));
  netAtm.lots.L4 = realisticOffer("L4", withProfile(DEMO_PROFILES.netAtm, { service: 1.02, tech: 0.94, digital: 0.9, environmental: 0.93, stopFocus: 0.78, discounts: [3.85, 4.05, 4.2] }));
  netAtm.combos["L3+L4"] = { enabled: true, phaseDiscounts: [4.55, 4.7, 4.9], insertedInBothBuste: true, pefCoherent: true };

  const autoguidovie = demoBidder(bidders, "autoguidovie-demo");
  autoguidovie.lots.L1 = realisticOffer("L1", withProfile(DEMO_PROFILES.autoguidovie, { environmental: 0.82, digital: 0.82, discounts: [4.1, 4.35, 4.6] }));
  autoguidovie.lots.L4 = realisticOffer("L4", withProfile(DEMO_PROFILES.autoguidovie, { service: 1.08, environmental: 0.82, digital: 0.8, discounts: [4.2, 4.45, 4.7] }));
  return bidders;
};

const buildDiscountScenario = (): Bidder[] => {
  const bidders = buildMarketScenario();
  const movibus = demoBidder(bidders, "movibus-ovest-demo");
  movibus.lots.L1 = realisticOffer("L1", withProfile(DEMO_PROFILES.movibusWest, { quality: 0.71, tech: 0.66, environmental: 0.56, discounts: [5.55, 5.8, 6.0] }));
  movibus.lots.L2 = realisticOffer("L2", withProfile(DEMO_PROFILES.movibusWest, { quality: 0.73, tech: 0.68, stopFocus: 0.7, environmental: 0.58, discounts: [5.65, 5.9, 6.1] }));
  movibus.combos["L1+L2"] = { enabled: true, phaseDiscounts: [6.15, 6.35, 6.55], insertedInBothBuste: true, pefCoherent: true };

  const arriva = demoBidder(bidders, "arriva-demo");
  arriva.lots.L2 = realisticOffer("L2", withProfile(DEMO_PROFILES.arriva, { tech: 0.71, digital: 0.66, stopFocus: 0.64, discounts: [5.9, 6.15, 6.35] }));
  arriva.lots.L3 = realisticOffer("L3", withProfile(DEMO_PROFILES.arriva, { service: 1.02, tech: 0.7, digital: 0.65, discounts: [5.8, 6.05, 6.25] }));
  arriva.combos["L2+L3"] = { enabled: true, phaseDiscounts: [6.35, 6.55, 6.75], insertedInBothBuste: true, pefCoherent: true };
  return bidders;
};

const buildLocalScenario = (): Bidder[] => {
  const bidders = buildMarketScenario();
  const star = demoBidder(bidders, "star-lodi-demo");
  star.lots.L4 = realisticOffer("L4", withProfile(DEMO_PROFILES.starLocal, { quality: 0.76, service: 1.03, tech: 0.7, digital: 0.78, safety: 0.74, stopFocus: 0.72, environmental: 0.62, discretionary: 0.72, discounts: [4.45, 4.65, 4.85] }));

  const netAtm = demoBidder(bidders, "net-atm-demo");
  netAtm.lots.L4 = realisticOffer("L4", withProfile(DEMO_PROFILES.netAtm, { service: 0.94, stopFocus: 0.67, discounts: [3.8, 4.0, 4.15] }));

  const autoguidovie = demoBidder(bidders, "autoguidovie-demo");
  autoguidovie.combos["L1+L4"] = { enabled: false, phaseDiscounts: [0, 0, 0], insertedInBothBuste: true, pefCoherent: true };
  return bidders;
};

type DemoScenarioId = "market" | "tech" | "discount" | "local";

type DemoScenario = {
  id: DemoScenarioId;
  title: string;
  body: string;
  basis: string[];
  defaultBidderId: string;
  defaultLotId: LotId;
  defaultPairId: PairId;
  settings: Settings;
  buildBidders: () => Bidder[];
};

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "market",
    title: "Mercato realistico",
    body: "Operatori noti del bacino, combinatorie plausibili e profili tecnici differenziati.",
    basis: [
      "Basi di lotto da All. 04, All. 05 e All. 09: mezzi, fermate e corse annue stimate.",
      "Profili operatori calibrati su segnali pubblici: flotta, tecnologie, presidio territoriale.",
      "Combinatorie coerenti con adiacenze e strategie industriali plausibili, non con offerte ufficiali.",
    ],
    defaultBidderId: "autoguidovie-demo",
    defaultLotId: "L1",
    defaultPairId: "L1+L4",
    settings: defaultSettings,
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
    defaultBidderId: "net-atm-demo",
    defaultLotId: "L3",
    defaultPairId: "L3+L4",
    settings: defaultSettings,
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
    defaultBidderId: "arriva-demo",
    defaultLotId: "L2",
    defaultPairId: "L2+L3",
    settings: defaultSettings,
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
    defaultBidderId: "star-lodi-demo",
    defaultLotId: "L4",
    defaultPairId: "L3+L4",
    settings: defaultSettings,
    buildBidders: buildLocalScenario,
  },
];

type TradeoffPreview = {
  nextValue: number | boolean;
  totalCost: number;
  technicalDelta: number;
  economicDelta: number;
  totalDelta: number;
  ribassoDelta: number;
  afterTechnical: number;
  afterEconomic: number;
  afterTotal: number;
  missingDenominator: boolean;
};

const defaultTradeoff = (): TradeoffPlan => ({ deltaUnits: 0, unitCost: 0, denominator: 0 });

const effectiveTradeoffDenominator = (criterion: Criterion, quantityInput: QuantityInputValue | undefined, plan: TradeoffPlan) => {
  if (!criterion.quantityInput) return plan.denominator;
  return plan.denominator > 0 ? plan.denominator : quantityInput?.denominator ?? 0;
};

const quantityInputAfterTradeoff = (
  criterion: Criterion,
  currentValue: number | boolean,
  quantityInput: QuantityInputValue | undefined,
  plan: TradeoffPlan,
): QuantityInputValue | undefined => {
  if (!criterion.quantityInput) return undefined;
  const denominator = effectiveTradeoffDenominator(criterion, quantityInput, plan);
  if (denominator <= 0) return undefined;
  const currentNumeric = Number(currentValue) || 0;
  const currentRatio = criterion.quantityInput.kind === "percent" ? currentNumeric / 100 : currentNumeric;
  const numerator = quantityInput?.denominator === denominator ? quantityInput.numerator : Math.round(clamp01(currentRatio) * denominator);
  return {
    numerator: Math.max(0, numerator + Math.max(0, plan.deltaUnits)),
    denominator,
  };
};

const computeTradeoffValue = (criterion: Criterion, currentValue: number | boolean, plan: TradeoffPlan, quantityInput?: QuantityInputValue) => {
  if (criterion.kind === "T") return true;
  if (criterion.kind === "D") return currentValue;

  const current = Number(currentValue) || 0;
  if (criterion.quantityInput) {
    const nextInput = quantityInputAfterTradeoff(criterion, currentValue, quantityInput, plan);
    return nextInput ? computeQuantityInputValue(criterion, nextInput) : current;
  }
  if (criterion.input === "ratio") {
    if (plan.denominator <= 0) return current;
    return Math.min(1, Math.max(0, current + plan.deltaUnits / plan.denominator));
  }
  if (criterion.formula === "lower" || criterion.formula === "soil") {
    return Math.max(0, current - plan.deltaUnits);
  }
  return Math.max(0, current + plan.deltaUnits);
};

const tradeoffCost = (criterion: Criterion, plan: TradeoffPlan) => {
  if (criterion.kind === "D") return 0;
  const quantity = criterion.kind === "T" ? 1 : Math.max(0, plan.deltaUnits);
  return quantity * Math.max(0, plan.unitCost);
};

const signedPoints = (amount: number) => `${amount >= 0 ? "+" : ""}${formatPoints(amount)}`;

const signedPercent = (amount: number) =>
  `${amount >= 0 ? "+" : ""}${amount.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pt`;

const formatCriterionValue = (criterion: Criterion, value: number | boolean | undefined) => {
  if (criterion.kind === "T") return value ? "Sì" : "No";
  const numericValue = Number(value ?? 0);
  const formatted = numericValue.toLocaleString("it-IT", {
    minimumFractionDigits: criterion.input === "integer" || criterion.input === "sqm" || criterion.input === "index" ? 0 : 2,
    maximumFractionDigits: criterion.input === "integer" || criterion.input === "sqm" || criterion.input === "index" ? 0 : 3,
  });
  if (criterion.input === "percent") return `${formatted}%`;
  if (criterion.input === "judgement") return `coeff. ${formatted}`;
  if (criterion.unit === "0-1" || !criterion.unit) return formatted;
  return `${formatted} ${criterion.unit}`.trim();
};

const formatPlainNumber = (value: number) => value.toLocaleString("it-IT", { maximumFractionDigits: 0 });

const formatCriterionRowValue = (criterion: Criterion, value: number | boolean | undefined, quantityInput?: QuantityInputValue) => {
  if (!criterion.quantityInput || !quantityInput?.denominator) return formatCriterionValue(criterion, value);
  return `${formatPlainNumber(quantityInput.numerator)}/${formatPlainNumber(quantityInput.denominator)} -> ${formatCriterionValue(criterion, value)}`;
};

const criterionStatus = (criterion: Criterion, score: number, note?: string) => {
  if (note) return { label: "Verifica", tone: "warn" };
  if (criterion.maxPoints <= 0) return { label: "n/d", tone: "muted" };
  if (score <= 0) return { label: "Scoperto", tone: "weak" };
  if (score >= criterion.maxPoints * 0.9) return { label: "Forte", tone: "ok" };
  return { label: "Parziale", tone: "mid" };
};

function App() {
  const [demoScenarioId, setDemoScenarioId] = useState<DemoScenarioId>("market");
  const [bidders, setBidders] = useState<Bidder[]>(() => DEMO_SCENARIOS[0].buildBidders());
  const [selectedBidderId, setSelectedBidderId] = useState(DEMO_SCENARIOS[0].defaultBidderId);
  const [selectedLotId, setSelectedLotId] = useState<LotId>("L1");
  const [selectedPairId, setSelectedPairId] = useState<PairId>(DEMO_SCENARIOS[0].defaultPairId);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("tecnica");
  const [selectedAmbitId, setSelectedAmbitId] = useState(AMBITS[0].id);
  const [selectedCriterionId, setSelectedCriterionId] = useState(CRITERIA[0].id);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [themePreference, setThemePreference] = useState<ThemePreference>(getStoredTheme);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false,
  );
  const resolvedTheme = themePreference === "auto" ? (systemPrefersDark ? "dark" : "light") : themePreference;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    setSystemPrefersDark(media.matches);
    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = themePreference;
    document.documentElement.style.colorScheme = resolvedTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [resolvedTheme, themePreference]);

  const selectedBidder = bidders.find((bidder) => bidder.id === selectedBidderId) ?? bidders[0];
  const selectedLotContext = LOT_CONTEXT[selectedLotId];
  const selectedDemoScenario = DEMO_SCENARIOS.find((scenario) => scenario.id === demoScenarioId) ?? DEMO_SCENARIOS[0];
  const result = useMemo(() => simulate(bidders, settings, selectedBidder?.id ?? ""), [bidders, settings, selectedBidder?.id]);
  const selectedLotScore = selectedBidder ? result.lotScores[selectedBidder.id][selectedLotId] : undefined;
  const selectedComboScore = selectedBidder ? result.comboScores[selectedBidder.id][selectedPairId] : undefined;
  const selectedLotLabel = LOTS.find((lot) => lot.id === selectedLotId)?.label ?? selectedLotId;
  const activeTabLabel = workspaceTabs.find((tab) => tab.value === activeTab)?.label ?? "Tecnica";
  const workspaceTitle =
    activeTab === "risultati" ? `Risultati - ${selectedLotLabel}` :
    activeTab === "combinatorie" ? `Offerte combinatorie - ${selectedLotLabel}` :
    `Offerta ${activeTabLabel.toLowerCase()} - ${selectedLotLabel}`;
  const selectedAmbit = AMBITS.find((ambit) => ambit.id === selectedAmbitId) ?? AMBITS[0];
  const selectedAmbitCriteria = useMemo(() => CRITERIA.filter((criterion) => criterion.ambit === selectedAmbit.id), [selectedAmbit.id]);
  const selectedCriterion = selectedAmbitCriteria.find((criterion) => criterion.id === selectedCriterionId) ?? selectedAmbitCriteria[0] ?? CRITERIA[0];

  useEffect(() => {
    if (selectedAmbitCriteria.length && !selectedAmbitCriteria.some((criterion) => criterion.id === selectedCriterionId)) {
      setSelectedCriterionId(selectedAmbitCriteria[0].id);
    }
  }, [selectedAmbitCriteria, selectedCriterionId]);

  const buildTradeoffPreview = (criterion: Criterion) => {
    if (!selectedBidder || !selectedLotScore || !selectedBidder.lots[selectedLotId].enabled) return undefined;
    const offer = selectedBidder.lots[selectedLotId];
    const plan = offer.tradeoffs[criterion.id] ?? defaultTradeoff();
    const currentSubScore = selectedLotScore.subScores[criterion.id];
    if (!currentSubScore || criterion.kind === "D") return undefined;

    const nextBidders = structuredClone(bidders);
    const nextBidder = nextBidders.find((bidder) => bidder.id === selectedBidder.id);
    if (!nextBidder) return undefined;
    const nextOffer = nextBidder.lots[selectedLotId];
    const quantityInput = offer.quantityInputs?.[criterion.id];
    const nextValue = computeTradeoffValue(criterion, currentSubScore.value, plan, quantityInput);
    if (criterion.kind === "Q") {
      const nextInput = quantityInputAfterTradeoff(criterion, currentSubScore.value, quantityInput, plan);
      if (nextInput) {
        nextOffer.quantityInputs = { ...nextOffer.quantityInputs, [criterion.id]: nextInput };
        nextOffer.qValues[criterion.id] = computeQuantityInputValue(criterion, nextInput);
      } else {
        nextOffer.qValues[criterion.id] = Number(nextValue);
      }
    }
    if (criterion.kind === "T") nextOffer.tValues[criterion.id] = Boolean(nextValue);

    const lot = LOTS.find((item) => item.id === selectedLotId);
    const totalCost = tradeoffCost(criterion, plan);
    if (lot && totalCost > 0) {
      const reductionPoints = (totalCost / lot.totalBase) * 100;
      nextOffer.phaseDiscounts = nextOffer.phaseDiscounts.map((discount) => Math.max(0, discount - reductionPoints)) as [number, number, number];
    }

    const nextResult = simulate(nextBidders, settings, selectedBidder.id);
    const after = nextResult.lotScores[selectedBidder.id][selectedLotId];
    return {
      nextValue,
      totalCost,
      technicalDelta: round4(after.technical - selectedLotScore.technical),
      economicDelta: round4(after.singleEconomic - selectedLotScore.singleEconomic),
      totalDelta: round4(after.singleTotal - selectedLotScore.singleTotal),
      ribassoDelta: round4(after.singleRibasso - selectedLotScore.singleRibasso),
      afterTechnical: after.technical,
      afterEconomic: after.singleEconomic,
      afterTotal: after.singleTotal,
      missingDenominator:
        criterion.kind === "Q" &&
        (criterion.input === "ratio" || Boolean(criterion.quantityInput)) &&
        effectiveTradeoffDenominator(criterion, quantityInput, plan) <= 0 &&
        plan.deltaUnits > 0,
    };
  };

  const updateBidder = (bidderId: string, updater: (bidder: Bidder) => Bidder) => {
    setBidders((current) => current.map((bidder) => (bidder.id === bidderId ? updater(structuredClone(bidder)) : bidder)));
  };

  const loadDemoScenario = (scenario: DemoScenario) => {
    setDemoScenarioId(scenario.id);
    setBidders(scenario.buildBidders());
    setSettings(scenario.settings);
    setSelectedBidderId(scenario.defaultBidderId);
    setSelectedLotId(scenario.defaultLotId);
    setSelectedPairId(scenario.defaultPairId);
  };

  const updateLotOffer = (lotId: LotId, updater: (offer: LotOffer) => LotOffer) => {
    if (!selectedBidder) return;
    updateBidder(selectedBidder.id, (bidder) => {
      bidder.lots[lotId] = updater(bidder.lots[lotId]);
      return bidder;
    });
  };

  const applyTradeoff = (criterion: Criterion) => {
    if (!selectedBidder) return;
    updateLotOffer(selectedLotId, (offer) => {
      const plan = offer.tradeoffs[criterion.id] ?? defaultTradeoff();
      const currentValue =
        criterion.kind === "Q" ? getQuantitativeCriterionValue(offer, criterion) : criterion.kind === "T" ? offer.tValues[criterion.id] : offer.dValues[criterion.id];
      const quantityInput = offer.quantityInputs?.[criterion.id];
      const nextValue = computeTradeoffValue(criterion, currentValue, plan, quantityInput);
      if (criterion.kind === "Q") {
        const nextInput = quantityInputAfterTradeoff(criterion, currentValue, quantityInput, plan);
        if (nextInput) {
          offer.quantityInputs = { ...offer.quantityInputs, [criterion.id]: nextInput };
          offer.qValues[criterion.id] = computeQuantityInputValue(criterion, nextInput);
        } else {
          offer.qValues[criterion.id] = Number(nextValue);
        }
      }
      if (criterion.kind === "T") offer.tValues[criterion.id] = Boolean(nextValue);

      const lot = LOTS.find((item) => item.id === selectedLotId);
      const totalCost = tradeoffCost(criterion, plan);
      if (lot && totalCost > 0) {
        const reductionPoints = (totalCost / lot.totalBase) * 100;
        offer.phaseDiscounts = offer.phaseDiscounts.map((discount) => Math.max(0, discount - reductionPoints)) as [number, number, number];
      }
      return { ...offer };
    });
  };

  const addBidder = () => {
    const nextId = `offerente-${Date.now()}`;
    const next = createBidder(nextId, `Nuovo offerente ${bidders.length + 1}`);
    next.lots.L1.enabled = true;
    setBidders((current) => [...current, next]);
    setSelectedBidderId(nextId);
    setSelectedLotId("L1");
  };

  const removeBidder = (bidderId: string) => {
    if (bidders.length <= 1) return;
    const nextBidders = bidders.filter((bidder) => bidder.id !== bidderId);
    setBidders(nextBidders);
    if (selectedBidderId === bidderId) setSelectedBidderId(nextBidders[0].id);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Gare Lotti Milanesi</h1>
          <p>Offerta tecnica 70, offerta economica 30, scenario di aggiudicazione con lotti singoli e combinatori.</p>
        </div>
        <div className="topbar-actions">
          <div className="theme-control" aria-label="Tema interfaccia">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  className={themePreference === option.value ? "active" : ""}
                  onClick={() => setThemePreference(option.value)}
                  aria-pressed={themePreference === option.value}
                  title={option.value === "auto" ? `Auto (${resolvedTheme === "dark" ? "scuro" : "chiaro"})` : option.label}
                >
                  <Icon size={15} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
          <div className="source-pill">
            <ClipboardList size={16} />
            Fonti: web pubbliche, Disciplinare, All. 13, All. 18
          </div>
        </div>
      </header>

      <div className="layout">
        <aside className="left-rail">
          <section className="panel demo-panel">
            <div className="section-title">
              <ClipboardList size={18} />
              Scenari demo
            </div>
            <div className="demo-list">
              {DEMO_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  className={`demo-card ${scenario.id === demoScenarioId ? "active" : ""}`}
                  onClick={() => loadDemoScenario(scenario)}
                >
                  <strong>{scenario.title}</strong>
                  <span>{scenario.body}</span>
                </button>
              ))}
            </div>
            <div className="hint">Preset compilati da fonti pubbliche e modelli locali: servono per simulare, non rappresentano offerte ufficiali.</div>
          </section>

          <section className="panel">
            <div className="section-title">
              <SlidersHorizontal size={18} />
              Parametri
            </div>
            <div className="active-scenario">
              <span>Scenario attivo</span>
              <strong>{selectedDemoScenario.title}</strong>
              <ul className="scenario-basis" aria-label="Base scenario demo">
                {selectedDemoScenario.basis.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <label className="field">
              <span>Soglia Q/T</span>
              <select
                value={settings.threshold}
                onChange={(event) => setSettings((current) => ({ ...current, threshold: Number(event.target.value) }))}
              >
                {THRESHOLD_OPTIONS.map((option) => (
                  <option key={option.id} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={settings.applyAwardLimitDerogation}
                onChange={(event) => setSettings((current) => ({ ...current, applyAwardLimitDerogation: event.target.checked }))}
              />
              <span>Applica deroga al limite di due lotti se necessaria per evitare lotti non assegnati</span>
            </label>
            <div className="hint">Q/T max ricostruito: {formatPoints(maxQtPoints())} punti. Le incongruenze sono elencate nel pannello criticità.</div>
          </section>

          <section className="panel">
            <div className="section-title between">
              <span>
                <Route size={18} />
                Offerenti
              </span>
              <button className="icon-button" onClick={addBidder} aria-label="Aggiungi offerente" title="Aggiungi offerente">
                <Plus size={17} />
              </button>
            </div>
            <div className="offeror-list">
              {bidders.map((bidder) => {
                const activeLots = LOTS.filter((lot) => bidder.lots[lot.id].enabled).length;
                const isSelected = bidder.id === selectedBidder?.id;
                return (
                  <button key={bidder.id} className={`offeror-row ${isSelected ? "selected" : ""}`} onClick={() => setSelectedBidderId(bidder.id)}>
                    <span>{bidder.name}</span>
                    <small>
                      {activeLots} {activeLots === 1 ? "lotto" : "lotti"}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">Lotti</div>
            <div className="chip-grid">
              {LOTS.map((lot) => (
                <button key={lot.id} className={`chip ${selectedLotId === lot.id ? "active" : ""}`} onClick={() => setSelectedLotId(lot.id)}>
                  {lot.shortLabel}
                </button>
              ))}
            </div>
            <div className="lot-context">
              <strong>{selectedLotContext.territory}</strong>
              <span>
                Base d'asta {euroFormatter.format(LOTS.find((lot) => lot.id === selectedLotId)?.totalBase ?? 0)}.{" "}
                {selectedLotContext.operatingHint}
              </span>
              <a href={selectedLotContext.sourceUrl} target="_blank" rel="noreferrer">
                {selectedLotContext.source}
              </a>
            </div>
            <div className="section-title compact">Combinatorie ammesse</div>
            <div className="chip-grid two">
              {PAIRS.map((pair) => (
                <button key={pair.id} className={`chip ${selectedPairId === pair.id ? "active" : ""}`} onClick={() => setSelectedPairId(pair.id)}>
                  {pair.label.replace("Lotti ", "")}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="workspace">
          {selectedBidder && (
            <>
              <section className="panel identity-panel">
                <div>
                  <div className="section-title">Offerente</div>
                  <div className="identity-grid">
                    <label className="field">
                      <span>Nome</span>
                      <input
                        value={selectedBidder.name}
                        onChange={(event) =>
                          updateBidder(selectedBidder.id, (bidder) => {
                            bidder.name = event.target.value;
                            return bidder;
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
                <button className="ghost danger" disabled={bidders.length <= 1} onClick={() => removeBidder(selectedBidder.id)}>
                  <Trash2 size={16} />
                  Rimuovi
                </button>
              </section>

              <section className="panel lot-switchboard">
                <div className="section-title">
                  <BarChart3 size={18} />
                  Gare di partecipazione
                </div>
                <div className="participation-matrix">
                  <div className="matrix-head">
                    <span>Operatore</span>
                    {LOTS.map((lot) => (
                      <span key={lot.id}>{lot.shortLabel}</span>
                    ))}
                    {PAIRS.map((pair) => (
                      <span key={pair.id}>{pair.label.replace("Lotti ", "")}</span>
                    ))}
                  </div>
                  {bidders.map((bidder) => (
                    <div key={bidder.id} className={`matrix-row ${bidder.id === selectedBidder.id ? "selected" : ""}`}>
                      <button className="matrix-name" onClick={() => setSelectedBidderId(bidder.id)}>
                        {bidder.name}
                      </button>
                      {LOTS.map((lot) => {
                        const lotScore = result.lotScores[bidder.id][lot.id];
                        return (
                          <label key={lot.id} className={`matrix-check ${bidder.lots[lot.id].enabled ? lotScore.admitted ? "ok" : "warn" : ""}`} title={bidder.lots[lot.id].enabled ? lotScore.admitted ? "Offerta ammessa" : "Offerta da verificare" : "Non partecipa"}>
                            <input
                              type="checkbox"
                              checked={bidder.lots[lot.id].enabled}
                              onChange={(event) =>
                                updateBidder(bidder.id, (draft) => {
                                  draft.lots[lot.id].enabled = event.target.checked;
                                  return draft;
                                })
                              }
                            />
                            <span>{lotScore.admitted ? "✓" : bidder.lots[lot.id].enabled ? "!" : ""}</span>
                          </label>
                        );
                      })}
                      {PAIRS.map((pair) => {
                        const comboScore = result.comboScores[bidder.id][pair.id];
                        return (
                          <label key={pair.id} className={`matrix-check combo ${bidder.combos[pair.id].enabled ? comboScore.admissible ? "ok" : "warn" : ""}`} title={bidder.combos[pair.id].enabled ? comboScore.admissible ? "Combinatoria ammissibile" : "Combinatoria da verificare" : "Non presentata"}>
                            <input
                              type="checkbox"
                              checked={bidder.combos[pair.id].enabled}
                              onChange={(event) =>
                                updateBidder(bidder.id, (draft) => {
                                  draft.combos[pair.id].enabled = event.target.checked;
                                  return draft;
                                })
                              }
                            />
                            <span>{comboScore.admissible ? "✓" : bidder.combos[pair.id].enabled ? "!" : ""}</span>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="hint">Le combinatorie restano valide solo per coppie ammesse, senza sovrapposizioni e con offerte singole attive sui due lotti.</div>
                <div className="lot-toggle-grid compact">
                  {LOTS.map((lot) => {
                    const lotScore = result.lotScores[selectedBidder.id][lot.id];
                    return (
                      <button key={lot.id} className={`lot-toggle ${selectedLotId === lot.id ? "focus" : ""} ${selectedBidder.lots[lot.id].enabled ? "on" : ""}`} onClick={() => setSelectedLotId(lot.id)}>
                        <strong>{lot.label}</strong>
                        <span>{lotScore.admitted ? "ammesso" : selectedBidder.lots[lot.id].enabled ? "da verificare" : "non partecipa"}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="panel workbench-panel">
                <div className="editor-header">
                  <div>
                    <div className="section-title">{workspaceTitle}</div>
                    <p>Vista operativa per compilare valori, ribassi, combinatorie e leggere subito l'impatto sul punteggio.</p>
                  </div>
                  {selectedLotScore && (
                    <div className={`status-badge ${selectedLotScore.admitted ? "ok" : "warn"}`}>
                      {selectedLotScore.admitted ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                      Q/T {formatPoints(selectedLotScore.qtRaw)}
                    </div>
                  )}
                </div>

                <div className="workspace-tabs" role="tablist" aria-label="Sezioni offerta">
                  {workspaceTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.value}
                        className={`workspace-tab ${activeTab === tab.value ? "active" : ""}`}
                        onClick={() => setActiveTab(tab.value)}
                        role="tab"
                        aria-selected={activeTab === tab.value}
                      >
                        <Icon size={16} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {!selectedBidder.lots[selectedLotId].enabled && activeTab !== "combinatorie" && activeTab !== "risultati" ? (
                  <div className="empty-state">Attiva la partecipazione al lotto per inserire i punteggi.</div>
                ) : (
                  <>
                    {activeTab === "tecnica" && selectedLotScore && (
                      <TechnicalWorkbench
                        bidder={selectedBidder}
                        lotId={selectedLotId}
                        lotScore={selectedLotScore}
                        selectedAmbitId={selectedAmbit.id}
                        selectedCriterion={selectedCriterion}
                        onAmbitSelect={setSelectedAmbitId}
                        onCriterionSelect={setSelectedCriterionId}
                        onCriterionChange={(criterion, value) =>
                          updateLotOffer(selectedLotId, (offer) => {
                            if (criterion.kind === "Q") offer.qValues[criterion.id] = Number(value);
                            if (criterion.kind === "T") offer.tValues[criterion.id] = Boolean(value);
                            if (criterion.kind === "D") offer.dValues[criterion.id] = Number(value);
                            return { ...offer };
                          })
                        }
                        onQuantityInputChange={(criterion, patch) =>
                          updateLotOffer(selectedLotId, (offer) => {
                            const current = offer.quantityInputs[criterion.id] ?? { numerator: 0, denominator: 0 };
                            const nextInput = { ...current, ...patch };
                            return {
                              ...offer,
                              qValues: {
                                ...offer.qValues,
                                [criterion.id]: computeQuantityInputValue(criterion, nextInput),
                              },
                              quantityInputs: {
                                ...offer.quantityInputs,
                                [criterion.id]: nextInput,
                              },
                            };
                          })
                        }
                        tradeoff={selectedBidder.lots[selectedLotId].tradeoffs[selectedCriterion.id] ?? defaultTradeoff()}
                        preview={buildTradeoffPreview(selectedCriterion)}
                        onTradeoffChange={(patch) =>
                          updateLotOffer(selectedLotId, (offer) => ({
                            ...offer,
                            tradeoffs: {
                              ...offer.tradeoffs,
                              [selectedCriterion.id]: { ...(offer.tradeoffs[selectedCriterion.id] ?? defaultTradeoff()), ...patch },
                            },
                          }))
                        }
                        onApplyTradeoff={() => applyTradeoff(selectedCriterion)}
                      />
                    )}

                    {activeTab === "economica" && selectedLotScore && (
                      <EconomicsWorkbench
                        selectedLotId={selectedLotId}
                        lotScore={selectedLotScore}
                        discounts={selectedBidder.lots[selectedLotId].phaseDiscounts}
                        disabled={!selectedBidder.lots[selectedLotId].enabled}
                        onChange={(index, value) =>
                          updateLotOffer(selectedLotId, (offer) => {
                            const next = [...offer.phaseDiscounts] as [number, number, number];
                            next[index] = value;
                            return { ...offer, phaseDiscounts: next };
                          })
                        }
                      />
                    )}

                    {activeTab === "combinatorie" && selectedComboScore && (
                      <ComboWorkbench
                        bidder={selectedBidder}
                        selectedPairId={selectedPairId}
                        comboScore={selectedComboScore}
                        onPairSelect={setSelectedPairId}
                        onEnabledChange={(enabled) =>
                          updateBidder(selectedBidder.id, (bidder) => {
                            bidder.combos[selectedPairId].enabled = enabled;
                            return bidder;
                          })
                        }
                        onDiscountChange={(index, value) =>
                          updateBidder(selectedBidder.id, (bidder) => {
                            const next = [...bidder.combos[selectedPairId].phaseDiscounts] as [number, number, number];
                            next[index] = value;
                            bidder.combos[selectedPairId].phaseDiscounts = next;
                            return bidder;
                          })
                        }
                        onInsertedChange={(checked) =>
                          updateBidder(selectedBidder.id, (bidder) => {
                            bidder.combos[selectedPairId].insertedInBothBuste = checked;
                            return bidder;
                          })
                        }
                        onPefChange={(checked) =>
                          updateBidder(selectedBidder.id, (bidder) => {
                            bidder.combos[selectedPairId].pefCoherent = checked;
                            return bidder;
                          })
                        }
                      />
                    )}

                    {activeTab === "risultati" && <ResultsWorkbench result={result} selectedLotId={selectedLotId} />}
                  </>
                )}
              </section>
            </>
          )}
        </main>

        <aside className="right-panel">
          <section className="panel hero-score">
            <div className="section-title">
              <Trophy size={18} />
              Scenario vincente
            </div>
            {result.selectedScenario ? (
              <>
                <div className="score-number">{formatPoints(result.selectedScenario.totalScore)}</div>
                <div className="muted">Tecnico complessivo {formatPoints(result.selectedScenario.technicalScore)}</div>
                <div className="assignment-list">
                  {result.selectedScenario.assignments.map((assignment) => (
                    <div key={assignment.id} className="assignment-row">
                      <span>{assignment.lotIds.join(" + ")}</span>
                      <strong>{assignment.bidderName}</strong>
                      <small>{assignment.kind === "combo" ? "combinatoria" : "singola"} - {formatPoints(assignment.totalScore)}</small>
                    </div>
                  ))}
                  {!result.selectedScenario.assignments.length && <div className="empty-state compact">Nessuna assegnazione ammissibile.</div>}
                </div>
              </>
            ) : (
              <div className="empty-state compact">Nessuno scenario calcolabile.</div>
            )}
          </section>

          <section className="panel">
            <div className="section-title">Classifica {selectedLotId}</div>
            <div className="ranking-list">
              {result.lotRankings[selectedLotId].slice(0, 6).map((candidate, index) => (
                <div key={candidate.id} className="ranking-row">
                  <span>{index + 1}</span>
                  <div>
                    <strong>{candidate.bidderName}</strong>
                    <small>{candidate.kind === "combo" ? candidate.pairId : "Offerta singola"}</small>
                  </div>
                  <b>{formatPoints(candidate.kind === "combo" ? candidate.totalScore / candidate.lotIds.length : candidate.totalScore)}</b>
                </div>
              ))}
              {!result.lotRankings[selectedLotId].length && <div className="empty-state compact">Nessuna offerta ammessa sul lotto.</div>}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">Migliora punteggio</div>
            <div className="suggestion-list">
              {result.suggestions.map((suggestion) => (
                <article key={`${suggestion.title}-${suggestion.body}`} className="suggestion">
                  <div>
                    <strong>{suggestion.title}</strong>
                    <span className={`effort ${suggestion.effort}`}>sforzo {suggestion.effort}</span>
                  </div>
                  <p>{suggestion.body}</p>
                  <small>Impatto potenziale: {formatPoints(suggestion.impact)} pt</small>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <ClipboardList size={18} />
              Fonti e basi usate
            </div>
            <div className="source-list">
              {PUBLIC_SOURCE_NOTES.map((note) => (
                <article key={note.id} className="source-card">
                  <div>
                    <strong>{note.title}</strong>
                    <span>{note.metric}</span>
                  </div>
                  <p>{note.body}</p>
                  <a href={note.sourceUrl} target="_blank" rel="noreferrer">
                    {note.source}
                  </a>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-title warn-title">
              <AlertTriangle size={18} />
              Criticità
            </div>
            <div className="warning-list">
              {DOCUMENT_WARNINGS.map((warning) => (
                <article key={warning.title} className="warning-card">
                  <strong>{warning.title}</strong>
                  <p>{warning.body}</p>
                </article>
              ))}
              {result.warnings.map((warning) => (
                <article key={warning} className="warning-card runtime">
                  <strong>Scenario</strong>
                  <p>{warning}</p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function TechnicalWorkbench({
  bidder,
  lotId,
  lotScore,
  selectedAmbitId,
  selectedCriterion,
  onAmbitSelect,
  onCriterionSelect,
  onCriterionChange,
  onQuantityInputChange,
  tradeoff,
  preview,
  onTradeoffChange,
  onApplyTradeoff,
}: {
  bidder: Bidder;
  lotId: LotId;
  lotScore: LotScore;
  selectedAmbitId: string;
  selectedCriterion: Criterion;
  onAmbitSelect: (ambitId: string) => void;
  onCriterionSelect: (criterionId: string) => void;
  onCriterionChange: (criterion: Criterion, value: number | boolean) => void;
  onQuantityInputChange: (criterion: Criterion, patch: Partial<QuantityInputValue>) => void;
  tradeoff: TradeoffPlan;
  preview?: TradeoffPreview;
  onTradeoffChange: (patch: Partial<TradeoffPlan>) => void;
  onApplyTradeoff: () => void;
}) {
  const selectedSubScore = lotScore.subScores[selectedCriterion.id];
  const selectedAmbit = AMBITS.find((ambit) => ambit.id === selectedAmbitId) ?? AMBITS[0];

  return (
    <div className="technical-workbench">
      <div className="scorecard-area">
        <div className="ambit-strip" aria-label="Ambiti tecnici">
          {AMBITS.map((ambit) => (
            <button
              key={ambit.id}
              className={`ambit-button ${ambit.id === selectedAmbitId ? "active" : ""}`}
              onClick={() => onAmbitSelect(ambit.id)}
            >
              <small>{ambit.id}</small>
              <span>{ambit.label}</span>
              <strong>{formatPoints(lotScore.riparamByAmbit[ambit.id] ?? 0)} / {formatPoints(ambit.maxPoints)}</strong>
            </button>
          ))}
        </div>

        <div className="criteria-table" aria-label={`Criteri ${selectedAmbit.label}`}>
          <div className="criteria-table-head">
            <span>Criterio</span>
            <span>Valore</span>
            <span>Punti</span>
            <span>Stato</span>
          </div>
          {criteriaByParent(selectedAmbit).map((parent) => {
            const parentScore = parent.criteria.reduce((sum, criterion) => sum + (lotScore.subScores[criterion.id]?.rawScore ?? 0), 0);
            const parentMax = parent.criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
            return (
              <div key={parent.parentId} className="criteria-parent-section">
                <div className="criteria-parent-row">
                  <div>
                    <strong>{parent.parentId}</strong>
                    <span>{parent.parentLabel}</span>
                  </div>
                  <b>{formatPoints(parentScore)} / {formatPoints(parentMax)}</b>
                </div>
                {parent.criteria.map((criterion) => {
                  const subScore = lotScore.subScores[criterion.id];
                  return (
                    <CriterionRow
                      key={criterion.id}
                      criterion={criterion}
                      value={subScore?.value}
                      quantityInput={bidder.lots[lotId].quantityInputs?.[criterion.id]}
                      score={subScore?.rawScore ?? 0}
                      note={subScore?.note}
                      selected={criterion.id === selectedCriterion.id}
                      onSelect={() => onCriterionSelect(criterion.id)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <CriterionInspector
        criterion={selectedCriterion}
        bidder={bidder}
        lotId={lotId}
        score={selectedSubScore?.rawScore ?? 0}
        note={selectedSubScore?.note}
        tradeoff={tradeoff}
        preview={preview}
        onChange={(value) => onCriterionChange(selectedCriterion, value)}
        onQuantityInputChange={(patch) => onQuantityInputChange(selectedCriterion, patch)}
        onTradeoffChange={onTradeoffChange}
        onApplyTradeoff={onApplyTradeoff}
      />
    </div>
  );
}

function CriterionRow({
  criterion,
  value,
  quantityInput,
  score,
  note,
  selected,
  onSelect,
}: {
  criterion: Criterion;
  value?: number | boolean;
  quantityInput?: QuantityInputValue;
  score: number;
  note?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = criterionStatus(criterion, score, note);
  return (
    <button className={`criterion-row ${selected ? "selected" : ""}`} onClick={onSelect}>
      <span className="criterion-row-name">
        <strong>{criterion.id}</strong>
        <span>{criterion.label}</span>
      </span>
      <span className="criterion-row-value">{formatCriterionRowValue(criterion, value, quantityInput)}</span>
      <span className="criterion-row-points">{formatPoints(score)} / {formatPoints(criterion.maxPoints)}</span>
      <span className={`row-status ${status.tone}`}>{status.label}</span>
    </button>
  );
}

function CriterionInspector({
  criterion,
  bidder,
  lotId,
  score,
  note,
  tradeoff,
  preview,
  onChange,
  onQuantityInputChange,
  onTradeoffChange,
  onApplyTradeoff,
}: {
  criterion: Criterion;
  bidder: Bidder;
  lotId: LotId;
  score: number;
  note?: string;
  tradeoff: TradeoffPlan;
  preview?: TradeoffPreview;
  onChange: (value: number | boolean) => void;
  onQuantityInputChange: (patch: Partial<QuantityInputValue>) => void;
  onTradeoffChange: (patch: Partial<TradeoffPlan>) => void;
  onApplyTradeoff: () => void;
}) {
  const offer = bidder.lots[lotId];
  const quantityInput = offer.quantityInputs?.[criterion.id] ?? { numerator: 0, denominator: 0 };
  const value = criterion.kind === "Q" ? getQuantitativeCriterionValue(offer, criterion) : criterion.kind === "T" ? offer.tValues[criterion.id] : offer.dValues[criterion.id];
  const status = criterionStatus(criterion, score, note);
  const tradeoffDenominatorValue = effectiveTradeoffDenominator(criterion, quantityInput, tradeoff);

  return (
    <aside className="criterion-inspector">
      <div className="criterion-inspector-head">
        <div>
          <strong>{criterion.id}</strong>
          <span>{criterion.label}</span>
        </div>
        <b>{formatPoints(score)} / {formatPoints(criterion.maxPoints)}</b>
      </div>

      <div className="inspector-badges">
        <span>{criterionKindLabel[criterion.kind]}</span>
        <span className={`row-status ${status.tone}`}>{status.label}</span>
      </div>

      <div className="inspector-section">
        <div className="inspector-section-title">Dati proposta tecnica</div>
      {criterion.kind === "Q" && criterion.quantityInput && (
        <div className="quantity-input-panel">
          <div className="quantity-input-grid">
            <label className="field compact">
              <span>{criterion.quantityInput.numeratorLabel}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={quantityInput.numerator}
                onChange={(event) => onQuantityInputChange({ numerator: Number(event.target.value) })}
              />
            </label>
            <label className="field compact">
              <span>{criterion.quantityInput.denominatorLabel}</span>
              <input
                type="number"
                min={0}
                step={1}
                value={quantityInput.denominator}
                onChange={(event) => onQuantityInputChange({ denominator: Number(event.target.value) })}
              />
            </label>
          </div>
          <div className="calculated-value">
            <span>{criterion.quantityInput.resultLabel} calcolato</span>
            <strong>{quantityInput.denominator > 0 ? formatCriterionValue(criterion, value) : "Base mancante"}</strong>
          </div>
          {quantityInput.denominator > 0 && quantityInput.numerator > quantityInput.denominator && (
            <span className="note-warning">Il valore per il punteggio viene limitato alla copertura massima pari a 1.</span>
          )}
        </div>
      )}
      {criterion.kind === "Q" && !criterion.quantityInput && (
        <div className="input-with-unit">
          <input
            type="number"
            min={criterion.formula === "soil" ? undefined : 0}
            max={criterion.input === "ratio" ? 1 : undefined}
            step={criterion.input === "ratio" ? 0.05 : criterion.input === "percent" ? 0.01 : 1}
            value={Number(value)}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <span>{criterion.unit}</span>
        </div>
      )}
      {criterion.kind === "T" && (
        <div className="segmented">
          <button className={value ? "selected" : ""} onClick={() => onChange(true)}>
            Sì
          </button>
          <button className={!value ? "selected" : ""} onClick={() => onChange(false)}>
            No
          </button>
        </div>
      )}
      {criterion.kind === "D" && (
        <select value={Number(value)} onChange={(event) => onChange(Number(event.target.value))}>
          {DISCRETIONARY_SCALE.map((item) => (
            <option key={item.label} value={item.value}>
              {item.label} - {item.value}
            </option>
          ))}
        </select>
      )}
      </div>

      <div className="criterion-meta">
        <span>{criterion.parentId} - {criterion.parentLabel}</span>
        <span>{criterion.kind} - {criterion.source}</span>
        {criterion.note && <span>{criterion.note}</span>}
        {note && <span className="note-warning">{note}</span>}
      </div>
      {criterion.kind !== "D" ? (
        <div className="tradeoff-box">
          <div className="tradeoff-title">
            <span>Tradeoff tecnico/economico</span>
            <small>costi come ipotesi utente</small>
          </div>
          <div className="tradeoff-grid">
            {criterion.kind === "Q" && (
              <label className="field compact">
                <span>Delta {criterion.tradeoffUnit}</span>
                <input
                  type="number"
                  step={criterion.quantityInput || criterion.input === "ratio" ? 1 : criterion.input === "percent" ? 0.01 : 1}
                  min={0}
                  value={tradeoff.deltaUnits}
                  onChange={(event) => onTradeoffChange({ deltaUnits: Number(event.target.value) })}
                />
              </label>
            )}
            {criterion.kind === "Q" && (criterion.input === "ratio" || criterion.quantityInput) && (
              <label className="field compact">
                <span>{criterion.quantityInput ? "Base di calcolo tradeoff" : "Base Nbus/fermate"}</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={tradeoffDenominatorValue}
                  onChange={(event) => onTradeoffChange({ denominator: Number(event.target.value) })}
                />
              </label>
            )}
            <label className="field compact">
              <span>{criterion.kind === "T" ? "Costo totale impegno" : "Costo unitario"}</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={tradeoff.unitCost}
                onChange={(event) => onTradeoffChange({ unitCost: Number(event.target.value) })}
              />
            </label>
          </div>
          {preview && (
            <div className="tradeoff-preview">
              {preview.missingDenominator ? (
                <span className="note-warning">Inserisci la base di calcolo per trasformare le unità aggiunte nel valore usato dal punteggio.</span>
              ) : (
                <>
                  <span>Costo {euroFormatter.format(preview.totalCost)}</span>
                  <span>Tecnico {signedPoints(preview.technicalDelta)}</span>
                  <span>Economico {signedPoints(preview.economicDelta)}</span>
                  <span>Totale {signedPoints(preview.totalDelta)}</span>
                  <span>Ribasso {signedPercent(preview.ribassoDelta * 100)}</span>
                </>
              )}
            </div>
          )}
          <button className="apply-tradeoff" onClick={onApplyTradeoff} disabled={!preview || preview.missingDenominator || (preview.totalCost === 0 && tradeoff.deltaUnits === 0)}>
            Applica al lotto
          </button>
        </div>
      ) : (
        <div className="tradeoff-box muted-box">
          I sub-criteri discrezionali dipendono dal giudizio della Commissione: qui si simula il coefficiente, ma non esiste una formula deterministica costo-punteggio nel disciplinare.
        </div>
      )}
    </aside>
  );
}

function EconomicsWorkbench({
  selectedLotId,
  lotScore,
  discounts,
  disabled,
  onChange,
}: {
  selectedLotId: LotId;
  lotScore: LotScore;
  discounts: [number, number, number];
  disabled?: boolean;
  onChange: (index: number, value: number) => void;
}) {
  return (
    <div className="economics-board">
      <div className="metric-grid">
        <div className="metric-tile">
          <span>Ribasso medio</span>
          <strong>{formatPercent(lotScore.singleRibasso)}</strong>
        </div>
        <div className="metric-tile">
          <span>Punteggio economico</span>
          <strong>{formatPoints(lotScore.singleEconomic)} / 30,00</strong>
        </div>
        <div className="metric-tile">
          <span>Totale singolo</span>
          <strong>{formatPoints(lotScore.singleTotal)}</strong>
        </div>
      </div>
      <EconomicEditor
        title={`Ribasso singolo - ${selectedLotId}`}
        discounts={discounts}
        ribasso={lotScore.singleRibasso}
        disabled={disabled}
        onChange={onChange}
      />
      <div className="hint">Il ribasso medio è ponderato sulle tre fasi e alimenta il punteggio economico del lotto singolo.</div>
    </div>
  );
}

function ComboWorkbench({
  bidder,
  selectedPairId,
  comboScore,
  onPairSelect,
  onEnabledChange,
  onDiscountChange,
  onInsertedChange,
  onPefChange,
}: {
  bidder: Bidder;
  selectedPairId: PairId;
  comboScore: ComboScore;
  onPairSelect: (pairId: PairId) => void;
  onEnabledChange: (enabled: boolean) => void;
  onDiscountChange: (index: number, value: number) => void;
  onInsertedChange: (checked: boolean) => void;
  onPefChange: (checked: boolean) => void;
}) {
  const combo = bidder.combos[selectedPairId];
  return (
    <div className="combo-workbench">
      <div className="pair-strip" aria-label="Coppie combinatorie">
        {PAIRS.map((pair) => (
          <button key={pair.id} className={`pair-button ${pair.id === selectedPairId ? "active" : ""}`} onClick={() => onPairSelect(pair.id)}>
            <strong>{pair.label.replace("Lotti ", "")}</strong>
            <span>{bidder.combos[pair.id].enabled ? "attiva" : "non presentata"}</span>
          </button>
        ))}
      </div>

      <div className="metric-grid">
        <div className="metric-tile">
          <span>Ribasso combinatorio</span>
          <strong>{formatPercent(comboScore.ribasso)}</strong>
        </div>
        <div className="metric-tile">
          <span>Minimo migliorativo</span>
          <strong>{formatPercent(comboScore.minRequiredRibasso)}</strong>
        </div>
        <div className={`metric-tile ${comboScore.admissible ? "ok" : "warn"}`}>
          <span>Stato</span>
          <strong>{comboScore.admissible ? "Ammissibile" : combo.enabled ? "Da verificare" : "Non attiva"}</strong>
        </div>
      </div>

      <div className="combo-box elevated">
        <div className="combo-title">
          <strong>Combinatoria {selectedPairId.replace("L", "").replace("+L", "+")}</strong>
          <label className="switch">
            <input type="checkbox" checked={combo.enabled} onChange={(event) => onEnabledChange(event.target.checked)} />
            <span>attiva</span>
          </label>
        </div>
        <EconomicEditor
          title="Ribasso combinatorio"
          discounts={combo.phaseDiscounts}
          ribasso={comboScore.ribasso}
          disabled={!combo.enabled}
          onChange={onDiscountChange}
        />
        <div className="combo-checks">
          <label className="toggle-row">
            <input type="checkbox" checked={combo.insertedInBothBuste} onChange={(event) => onInsertedChange(event.target.checked)} />
            Inserita in entrambe le buste
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={combo.pefCoherent} onChange={(event) => onPefChange(event.target.checked)} />
            PEF combinatorio presente e coerente
          </label>
        </div>
        {comboScore.warnings.length ? (
          <div className="warning-list compact">
            {comboScore.warnings.map((warning) => (
              <div key={warning} className="inline-warning">{warning}</div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ResultsWorkbench({ result, selectedLotId }: { result: SimulationResult; selectedLotId: LotId }) {
  return (
    <div className="results-board">
      <div className="metric-grid">
        <div className="metric-tile">
          <span>Scenario migliore</span>
          <strong>{result.selectedScenario ? formatPoints(result.selectedScenario.totalScore) : "n/d"}</strong>
        </div>
        <div className="metric-tile">
          <span>Tecnico complessivo</span>
          <strong>{result.selectedScenario ? formatPoints(result.selectedScenario.technicalScore) : "n/d"}</strong>
        </div>
        <div className={`metric-tile ${result.selectedScenario?.unassignedLots.length ? "warn" : "ok"}`}>
          <span>Lotti non assegnati</span>
          <strong>{result.selectedScenario?.unassignedLots.join(", ") || "nessuno"}</strong>
        </div>
      </div>

      <div className="results-grid">
        <section>
          <div className="section-title compact">Assegnazioni scenario</div>
          <div className="assignment-list">
            {result.selectedScenario?.assignments.map((assignment) => (
              <div key={assignment.id} className="assignment-row">
                <span>{assignment.lotIds.join(" + ")}</span>
                <strong>{assignment.bidderName}</strong>
                <small>{assignment.kind === "combo" ? "combinatoria" : "singola"} - {formatPoints(assignment.totalScore)}</small>
              </div>
            ))}
            {!result.selectedScenario?.assignments.length && <div className="empty-state compact">Nessuna assegnazione ammissibile.</div>}
          </div>
        </section>

        <section>
          <div className="section-title compact">Classifica {selectedLotId}</div>
          <div className="ranking-list">
            {result.lotRankings[selectedLotId].slice(0, 8).map((candidate, index) => (
              <div key={candidate.id} className="ranking-row">
                <span>{index + 1}</span>
                <div>
                  <strong>{candidate.bidderName}</strong>
                  <small>{candidate.kind === "combo" ? candidate.pairId : "Offerta singola"}</small>
                </div>
                <b>{formatPoints(candidate.kind === "combo" ? candidate.totalScore / candidate.lotIds.length : candidate.totalScore)}</b>
              </div>
            ))}
            {!result.lotRankings[selectedLotId].length && <div className="empty-state compact">Nessuna offerta ammessa sul lotto.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function EconomicEditor({
  title,
  discounts,
  ribasso,
  disabled,
  onChange,
}: {
  title: string;
  discounts: [number, number, number];
  ribasso: number;
  disabled?: boolean;
  onChange: (index: number, value: number) => void;
}) {
  return (
    <div className={`economic-editor ${disabled ? "disabled" : ""}`}>
      <div className="economic-title">
        <strong>{title}</strong>
        <span>R medio {formatPercent(ribasso)}</span>
      </div>
      <div className="phase-grid">
        {["Fase 1", "Fase 2", "Fase 3"].map((phase, index) => (
          <label className="field compact" key={phase}>
            <span>{phase}</span>
            <input type="number" min={0} step={0.01} value={discounts[index]} disabled={disabled} onChange={(event) => onChange(index, Number(event.target.value))} />
          </label>
        ))}
      </div>
    </div>
  );
}

export default App;
