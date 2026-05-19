import { CRITERIA, LOTS, PAIRS, THRESHOLD_OPTIONS, type LotId, type PairId } from "../data/tender";
import { BASE_SCENARIOS, DEFAULT_SETTINGS, getBaseScenario, isBaseScenarioId, type BaseScenarioId } from "../data/base-scenarios";
import {
  createBidder,
  emptyComboOffer,
  emptyLotOffer,
  type Bidder,
  type ComboOffer,
  type LotOffer,
  type QuantityInputValue,
  type Settings,
  type TradeoffPlan,
} from "./scoring";
import { defaultOptimizationConfig, type OptimizationConfig, type OptimizationLeverInput } from "./optimization";

export const STORAGE_KEYS = {
  theme: "tpl-lotti-1-4-theme",
  workspace: "tpl-lotti-1-4-workspace",
  scenarios: "tpl-lotti-1-4-scenarios",
} as const;

export const LEGACY_STORAGE_KEYS = {
  theme: "tpl-simulator-theme",
  workspace: "tpl-simulator-workspace",
  scenarios: "tpl-simulator-scenarios",
} as const;

export type SavedScenarioSnapshot = {
  schemaVersion: 3;
  id: string;
  name: string;
  savedAt: string;
  baseScenarioId: BaseScenarioId;
  bidders: Bidder[];
  settings: Settings;
  optimization: OptimizationConfig;
  selectedBidderId: string;
  selectedLotId: LotId;
  selectedPairId: PairId;
};

export type StoredWorkspace = {
  schemaVersion: 3;
  scenarioName: string;
  activeSavedScenarioId?: string;
  baseScenarioId: BaseScenarioId;
  bidders: Bidder[];
  settings: Settings;
  optimization: OptimizationConfig;
  selectedBidderId: string;
  selectedLotId: LotId;
  selectedPairId: PairId;
};

type LegacyScenarioLike = Partial<SavedScenarioSnapshot> & {
  demoScenarioId?: unknown;
  baseScenarioId?: unknown;
};

type LegacyWorkspaceLike = Partial<StoredWorkspace> & {
  demoScenarioId?: unknown;
  baseScenarioId?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const finiteNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const nonNegativeNumber = (value: unknown, fallback = 0) => Math.max(0, finiteNumber(value, fallback));

const normalizedId = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizedName = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

export const isLotId = (value: unknown): value is LotId => typeof value === "string" && LOTS.some((lot) => lot.id === value);
export const isPairId = (value: unknown): value is PairId => typeof value === "string" && PAIRS.some((pair) => pair.id === value);

const normalizeBaseScenarioId = (value: unknown): BaseScenarioId =>
  typeof value === "string" && isBaseScenarioId(value) ? value : BASE_SCENARIOS[0].id;

const recordValue = (value: unknown, key: string) => (isRecord(value) ? value[key] : undefined);

const normalizePhaseDiscounts = (value: unknown): [number, number, number] => {
  const source = Array.isArray(value) ? value : [];
  return [0, 1, 2].map((index) => nonNegativeNumber(source[index], 0)) as [number, number, number];
};

const normalizeQuantityInput = (value: unknown): QuantityInputValue => {
  const source = isRecord(value) ? value : {};
  return {
    numerator: nonNegativeNumber(source.numerator, 0),
    denominator: nonNegativeNumber(source.denominator, 0),
  };
};

const normalizeTradeoff = (value: unknown): TradeoffPlan => {
  const source = isRecord(value) ? value : {};
  return {
    deltaUnits: nonNegativeNumber(source.deltaUnits, 0),
    unitCost: nonNegativeNumber(source.unitCost, 0),
    denominator: nonNegativeNumber(source.denominator, 0),
  };
};

const normalizeOptimizationLever = (value: unknown, criterionKind: "Q" | "T" | "D"): OptimizationLeverInput => {
  const source = isRecord(value) ? value : {};
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : criterionKind !== "D",
    stepUnits: nonNegativeNumber(source.stepUnits, 1),
    maxUnits: nonNegativeNumber(source.maxUnits, 0),
    unitCost: nonNegativeNumber(source.unitCost, 0),
    denominator: nonNegativeNumber(source.denominator, 0),
  };
};

export const normalizeOptimizationConfig = (value: unknown): OptimizationConfig => {
  const fallback = defaultOptimizationConfig();
  const source = isRecord(value) ? value : {};
  const economic = isRecord(source.economic) ? source.economic : {};
  const sourceLevers = isRecord(source.levers) ? source.levers : {};

  return {
    budget: nonNegativeNumber(source.budget, fallback.budget),
    budgetMode: source.budgetMode === "technical" ? "technical" : "strategic",
    scope:
      source.scope === "active-lots" || source.scope === "scenario" || source.scope === "active-lot"
        ? source.scope
        : fallback.scope,
    economic: {
      enabled: typeof economic.enabled === "boolean" ? economic.enabled : fallback.economic.enabled,
      stepPercent: nonNegativeNumber(economic.stepPercent, fallback.economic.stepPercent),
      maxDeltaPercent: nonNegativeNumber(economic.maxDeltaPercent, fallback.economic.maxDeltaPercent),
    },
    levers: Object.fromEntries(
      LOTS.map((lot) => {
        const lotLevers = recordValue(sourceLevers, lot.id);
        return [
          lot.id,
          Object.fromEntries(CRITERIA.map((criterion) => [criterion.id, normalizeOptimizationLever(recordValue(lotLevers, criterion.id), criterion.kind)])),
        ];
      }),
    ) as OptimizationConfig["levers"],
  };
};

export const normalizeLotOffer = (value: unknown): LotOffer => {
  const fallback = emptyLotOffer();
  const source = isRecord(value) ? value : {};
  const qValues = Object.fromEntries(
    CRITERIA.filter((criterion) => criterion.kind === "Q").map((criterion) => [
      criterion.id,
      finiteNumber(recordValue(source.qValues, criterion.id), fallback.qValues[criterion.id] ?? 0),
    ]),
  );
  const quantityInputs = Object.fromEntries(
    CRITERIA.filter((criterion) => criterion.quantityInput).map((criterion) => [
      criterion.id,
      normalizeQuantityInput(recordValue(source.quantityInputs, criterion.id)),
    ]),
  );
  const tValues = Object.fromEntries(
    CRITERIA.filter((criterion) => criterion.kind === "T").map((criterion) => [
      criterion.id,
      Boolean(recordValue(source.tValues, criterion.id) ?? fallback.tValues[criterion.id]),
    ]),
  );
  const dValues = Object.fromEntries(
    CRITERIA.filter((criterion) => criterion.kind === "D").map((criterion) => [
      criterion.id,
      finiteNumber(recordValue(source.dValues, criterion.id), fallback.dValues[criterion.id] ?? 0),
    ]),
  );
  const tradeoffs = Object.fromEntries(CRITERIA.map((criterion) => [criterion.id, normalizeTradeoff(recordValue(source.tradeoffs, criterion.id))]));

  return {
    enabled: Boolean(source.enabled),
    qValues,
    quantityInputs,
    tValues,
    dValues,
    tradeoffs,
    phaseDiscounts: normalizePhaseDiscounts(source.phaseDiscounts),
  };
};

export const normalizeComboOffer = (value: unknown): ComboOffer => {
  const fallback = emptyComboOffer();
  const source = isRecord(value) ? value : {};
  return {
    enabled: Boolean(source.enabled),
    phaseDiscounts: normalizePhaseDiscounts(source.phaseDiscounts),
    insertedInBothBuste: typeof source.insertedInBothBuste === "boolean" ? source.insertedInBothBuste : fallback.insertedInBothBuste,
    pefCoherent: typeof source.pefCoherent === "boolean" ? source.pefCoherent : fallback.pefCoherent,
  };
};

export const normalizeBidder = (value: unknown, index = 0): Bidder => {
  const source = isRecord(value) ? value : {};
  const id = normalizedId(source.id, `offerente-${index + 1}`);
  const bidder = createBidder(id, normalizedName(source.name, `Offerente ${index + 1}`));

  bidder.lots = Object.fromEntries(
    LOTS.map((lot) => [lot.id, normalizeLotOffer(recordValue(source.lots, lot.id))]),
  ) as Record<LotId, LotOffer>;
  bidder.combos = Object.fromEntries(
    PAIRS.map((pair) => [pair.id, normalizeComboOffer(recordValue(source.combos, pair.id))]),
  ) as Record<PairId, ComboOffer>;

  return bidder;
};

export const normalizeBidders = (value: unknown, baseScenarioId: BaseScenarioId): Bidder[] => {
  if (!Array.isArray(value) || !value.length) return getBaseScenario(baseScenarioId).buildBidders();
  return value.map((item, index) => normalizeBidder(item, index));
};

export const normalizeSettings = (value: unknown): Settings => {
  const source = isRecord(value) ? value : {};
  const threshold = finiteNumber(source.threshold, DEFAULT_SETTINGS.threshold);
  const allowedThresholds = THRESHOLD_OPTIONS.map((option) => option.value) as number[];
  return {
    threshold: allowedThresholds.includes(threshold) ? threshold : DEFAULT_SETTINGS.threshold,
    applyAwardLimitDerogation:
      typeof source.applyAwardLimitDerogation === "boolean"
        ? source.applyAwardLimitDerogation
        : DEFAULT_SETTINGS.applyAwardLimitDerogation,
  };
};

export const normalizeScenarioSnapshot = (value: unknown): SavedScenarioSnapshot | undefined => {
  if (!isRecord(value)) return undefined;
  const candidate = value as LegacyScenarioLike;
  const baseScenarioId = normalizeBaseScenarioId(candidate.baseScenarioId ?? candidate.demoScenarioId);
  const bidders = normalizeBidders(candidate.bidders, baseScenarioId);
  if (!bidders.length) return undefined;
  const fallbackScenario = getBaseScenario(baseScenarioId);
  const firstBidderId = bidders[0]?.id ?? fallbackScenario.defaultBidderId;

  return {
    schemaVersion: 3,
    id: normalizedId(candidate.id, `scenario-${Date.now()}`),
    name: normalizedName(candidate.name, "Scenario importato"),
    savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : new Date().toISOString(),
    baseScenarioId,
    bidders,
    settings: normalizeSettings(candidate.settings),
    optimization: normalizeOptimizationConfig(candidate.optimization),
    selectedBidderId: typeof candidate.selectedBidderId === "string" && bidders.some((bidder) => bidder.id === candidate.selectedBidderId)
      ? candidate.selectedBidderId
      : firstBidderId,
    selectedLotId: isLotId(candidate.selectedLotId) ? candidate.selectedLotId : fallbackScenario.defaultLotId,
    selectedPairId: isPairId(candidate.selectedPairId) ? candidate.selectedPairId : fallbackScenario.defaultPairId,
  };
};

export const normalizeStoredWorkspace = (value: unknown): StoredWorkspace | undefined => {
  if (!isRecord(value)) return undefined;
  const candidate = value as LegacyWorkspaceLike;
  const baseScenarioId = normalizeBaseScenarioId(candidate.baseScenarioId ?? candidate.demoScenarioId);
  const fallbackScenario = getBaseScenario(baseScenarioId);
  const bidders = normalizeBidders(candidate.bidders, baseScenarioId);
  if (!bidders.length) return undefined;

  return {
    schemaVersion: 3,
    scenarioName: normalizedName(candidate.scenarioName, fallbackScenario.title),
    activeSavedScenarioId: typeof candidate.activeSavedScenarioId === "string" ? candidate.activeSavedScenarioId : undefined,
    baseScenarioId,
    bidders,
    settings: normalizeSettings(candidate.settings),
    optimization: normalizeOptimizationConfig(candidate.optimization),
    selectedBidderId: typeof candidate.selectedBidderId === "string" && bidders.some((bidder) => bidder.id === candidate.selectedBidderId)
      ? candidate.selectedBidderId
      : bidders[0]?.id ?? fallbackScenario.defaultBidderId,
    selectedLotId: isLotId(candidate.selectedLotId) ? candidate.selectedLotId : fallbackScenario.defaultLotId,
    selectedPairId: isPairId(candidate.selectedPairId) ? candidate.selectedPairId : fallbackScenario.defaultPairId,
  };
};

export const getStoredJson = <T,>(keys: readonly string[]): T | undefined => {
  if (typeof window === "undefined") return undefined;
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      continue;
    }
  }
  return undefined;
};

export const readStoredWorkspace = (): StoredWorkspace | undefined =>
  normalizeStoredWorkspace(getStoredJson([STORAGE_KEYS.workspace, LEGACY_STORAGE_KEYS.workspace]));

export const readStoredSavedScenarios = (): SavedScenarioSnapshot[] =>
  (getStoredJson<unknown[]>([STORAGE_KEYS.scenarios, LEGACY_STORAGE_KEYS.scenarios]) ?? [])
    .map(normalizeScenarioSnapshot)
    .filter((scenario): scenario is SavedScenarioSnapshot => Boolean(scenario));
