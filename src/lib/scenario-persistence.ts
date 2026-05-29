import { CRITERIA, LOTS, PAIRS, THRESHOLD_OPTIONS, type LotId, type PairId } from "../data/tender";
import {
  BASE_SCENARIOS,
  DEFAULT_SETTINGS,
  getBaseScenario,
  isBaseScenarioId,
  type BaseScenario,
  type BaseScenarioId,
} from "../data/base-scenarios";
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
  hiddenBaseScenarios: "tpl-lotti-1-4-hidden-base-scenarios",
} as const;

export const LEGACY_STORAGE_KEYS = {
  theme: "tpl-simulator-theme",
  workspace: "tpl-simulator-workspace",
  scenarios: "tpl-simulator-scenarios",
} as const;

export const PRESET_SCENARIO_PREFIX = "preset-";

export const PRESET_SAVED_AT = "2026-01-01T00:00:00.000Z";

export type SavedScenarioSnapshot = {
  schemaVersion: 8;
  id: string;
  name: string;
  savedAt: string;
  originProfileId?: BaseScenarioId;
  bidders: Bidder[];
  settings: Settings;
  optimization: OptimizationConfig;
  selectedBidderId: string;
  selectedLotId: LotId;
  selectedPairId: PairId;
};

export type StoredWorkspace = {
  schemaVersion: 8;
  scenarioName: string;
  activeSavedScenarioId?: string;
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

export const presetScenarioId = (baseId: BaseScenarioId) => `${PRESET_SCENARIO_PREFIX}${baseId}`;

export const isPresetScenarioId = (id: string) => id.startsWith(PRESET_SCENARIO_PREFIX);

export const baseIdFromPresetScenarioId = (id: string): BaseScenarioId | undefined => {
  const candidate = id.slice(PRESET_SCENARIO_PREFIX.length);
  return isBaseScenarioId(candidate) ? candidate : undefined;
};

export const resolveOriginProfileId = (
  snapshot?: Pick<SavedScenarioSnapshot, "id" | "originProfileId"> | null,
): BaseScenarioId => {
  if (snapshot?.originProfileId && isBaseScenarioId(snapshot.originProfileId)) return snapshot.originProfileId;
  const fromPreset = snapshot?.id ? baseIdFromPresetScenarioId(snapshot.id) : undefined;
  return fromPreset ?? "market";
};

const resolveLegacyProfileId = (candidate: { originProfileId?: unknown; baseScenarioId?: unknown; demoScenarioId?: unknown }) =>
  normalizeBaseScenarioId(candidate.originProfileId ?? candidate.baseScenarioId ?? candidate.demoScenarioId);

export const buildPresetScenarioSnapshot = (base: BaseScenario): SavedScenarioSnapshot => ({
  schemaVersion: 8,
  id: presetScenarioId(base.id),
  name: base.title,
  savedAt: PRESET_SAVED_AT,
  originProfileId: base.id,
  bidders: base.buildBidders(),
  settings: { ...base.settings },
  optimization: base.buildOptimizationConfig(),
  selectedBidderId: base.defaultBidderId,
  selectedLotId: base.defaultLotId,
  selectedPairId: base.defaultPairId,
});

export const buildDefaultScenarioLibrary = () => BASE_SCENARIOS.map((scenario) => buildPresetScenarioSnapshot(scenario));

export const readHiddenBaseScenarioIds = (): BaseScenarioId[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.hiddenBaseScenarios) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is BaseScenarioId => typeof value === "string" && isBaseScenarioId(value));
  } catch {
    return [];
  }
};

export const hydrateScenarioLibrary = (
  library: SavedScenarioSnapshot[],
  hiddenBaseScenarioIds: readonly BaseScenarioId[] = readHiddenBaseScenarioIds(),
): SavedScenarioSnapshot[] => {
  const hidden = new Set(hiddenBaseScenarioIds);
  const byId = new Map(library.map((scenario) => [scenario.id, scenario]));
  const merged = library.filter((scenario) => {
    const presetBaseId = baseIdFromPresetScenarioId(scenario.id);
    return !presetBaseId || !hidden.has(presetBaseId);
  });

  for (const base of BASE_SCENARIOS) {
    if (hidden.has(base.id)) continue;
    const id = presetScenarioId(base.id);
    if (!byId.has(id)) merged.unshift(buildPresetScenarioSnapshot(base));
  }

  return merged;
};

type ExcelScenarioLike = {
  format?: unknown;
  source?: unknown;
  id?: unknown;
  name?: unknown;
  savedAt?: unknown;
  baseScenarioId?: unknown;
  settings?: unknown;
  selectedBidderId?: unknown;
  selectedLotId?: unknown;
  selectedPairId?: unknown;
  offers?: unknown;
  criteria?: unknown;
  combos?: unknown;
};

export type ScenarioImportReport = {
  snapshot?: SavedScenarioSnapshot;
  messages: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
};

const finiteNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const nonNegativeNumber = (value: unknown, fallback = 0) => Math.max(0, finiteNumber(value, fallback));
const boundedNumber = (value: unknown, min: number, max: number, fallback?: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

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

const extractScenarioImportCandidate = (value: unknown) => {
  if (Array.isArray(value)) return value.find(isRecord);
  if (!isRecord(value)) return value;
  for (const key of ["snapshot", "scenario", "workspace"]) {
    const nested = value[key];
    if (isRecord(nested)) return nested;
  }
  if (Array.isArray(value.scenarios)) return value.scenarios.find(isRecord);
  return value;
};

const isExcelImport = (value: unknown): value is ExcelScenarioLike =>
  isRecord(value) && (value.format === "glm-excel-v1" || value.format === "glm-excel-light-v1" || value.source === "excel-light");

const extractExcelImportCandidate = (value: unknown) => {
  if (isExcelImport(value)) return value;
  if (isRecord(value) && isExcelImport(value.excel)) return value.excel;
  if (isRecord(value) && isExcelImport(value.excelLight)) return value.excelLight;
  return undefined;
};

const normalizePhaseDiscounts = (value: unknown): [number, number, number] => {
  const source = Array.isArray(value) ? value : [];
  return [0, 1, 2].map((index) => nonNegativeNumber(source[index], 0)) as [number, number, number];
};

const normalizeDiscountInputMode = (value: unknown, fallback: LotOffer["discountInputMode"] = "phases") =>
  value === "average" ? "average" : fallback ?? "phases";

const normalizeQuantityInput = (value: unknown): QuantityInputValue => {
  const source = isRecord(value) ? value : {};
  return {
    numerator: nonNegativeNumber(source.numerator, 0),
    denominator: nonNegativeNumber(source.denominator, 0),
  };
};

const normalizeTradeoff = (value: unknown, fallback?: TradeoffPlan): TradeoffPlan => {
  const source = isRecord(value) ? value : {};
  const normalized = {
    deltaUnits: nonNegativeNumber(source.deltaUnits, 0),
    unitCost: nonNegativeNumber(source.unitCost, 0),
    denominator: nonNegativeNumber(source.denominator, 0),
  };
  const isBlank = normalized.deltaUnits === 0 && normalized.unitCost === 0 && normalized.denominator === 0;
  return isBlank && fallback ? fallback : normalized;
};

const fallbackOptimizationLever = (criterionKind: "Q" | "T" | "D"): OptimizationLeverInput => ({
  enabled: criterionKind !== "D",
  granularityUnits: 1,
  maxUnits: 0,
  unitCost: 0,
  denominator: 0,
});

const normalizeOptimizationLever = (
  value: unknown,
  criterionKind: "Q" | "T" | "D",
  fallbackValue?: OptimizationLeverInput,
): OptimizationLeverInput => {
  const source = isRecord(value) ? value : {};
  const fallback = fallbackValue ?? fallbackOptimizationLever(criterionKind);
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : fallback.enabled,
    granularityUnits: nonNegativeNumber(source.granularityUnits, nonNegativeNumber(source.stepUnits, fallback.granularityUnits)),
    maxUnits: nonNegativeNumber(source.maxUnits, fallback.maxUnits),
    unitCost: nonNegativeNumber(source.unitCost, fallback.unitCost),
    denominator: nonNegativeNumber(source.denominator, fallback.denominator),
  };
};

export const normalizeOptimizationConfig = (value: unknown, fallbackConfig?: OptimizationConfig): OptimizationConfig => {
  const fallback = fallbackConfig ?? defaultOptimizationConfig();
  const source = isRecord(value) ? value : {};
  const sourceLevers = isRecord(source.levers) ? source.levers : {};
  const legacyMode = source.budgetMode === "technical" ? "technical-only" : source.budgetMode === "strategic" ? "technical-economic" : undefined;

  return {
    mode:
      source.mode === "technical-only" || source.mode === "technical-economic"
        ? source.mode
        : legacyMode ?? fallback.mode,
    scope:
      source.scope === "active-lots" || source.scope === "scenario" || source.scope === "active-lot"
        ? source.scope
        : fallback.scope,
    levers: Object.fromEntries(
      LOTS.map((lot) => {
        const lotLevers = recordValue(sourceLevers, lot.id);
        const fallbackLotLevers = fallback.levers[lot.id] ?? {};
        return [
          lot.id,
          Object.fromEntries(
            CRITERIA.map((criterion) => [
              criterion.id,
              normalizeOptimizationLever(recordValue(lotLevers, criterion.id), criterion.kind, fallbackLotLevers[criterion.id]),
            ]),
          ),
        ];
      }),
    ) as OptimizationConfig["levers"],
  };
};

export const normalizeLotOffer = (value: unknown, fallbackOffer?: LotOffer): LotOffer => {
  const fallback = fallbackOffer ?? emptyLotOffer();
  const source = isRecord(value) ? value : {};
  const qValues: LotOffer["qValues"] = {};
  const quantityInputs: LotOffer["quantityInputs"] = {};
  const tValues: LotOffer["tValues"] = {};
  const dValues: LotOffer["dValues"] = {};

  for (const criterion of CRITERIA) {
    if (criterion.kind === "Q") {
      qValues[criterion.id] = finiteNumber(recordValue(source.qValues, criterion.id), fallback.qValues[criterion.id] ?? 0);
      if (criterion.quantityInput) {
        quantityInputs[criterion.id] = normalizeQuantityInput(recordValue(source.quantityInputs, criterion.id));
      }
      continue;
    }

    if (criterion.kind === "T") {
      tValues[criterion.id] = Boolean(recordValue(source.tValues, criterion.id) ?? fallback.tValues[criterion.id]);
      continue;
    }

    dValues[criterion.id] = finiteNumber(recordValue(source.dValues, criterion.id), fallback.dValues[criterion.id] ?? 0);
  }
  const tradeoffs = Object.fromEntries(
    CRITERIA.map((criterion) => [
      criterion.id,
      normalizeTradeoff(recordValue(source.tradeoffs, criterion.id), fallback.tradeoffs[criterion.id]),
    ]),
  );

  const phaseDiscounts = normalizePhaseDiscounts(source.phaseDiscounts ?? fallback.phaseDiscounts);
  const discountInputMode = normalizeDiscountInputMode(source.discountInputMode, fallback.discountInputMode);
  const averageDiscount = nonNegativeNumber(
    source.averageDiscount,
    discountInputMode === "average" ? phaseDiscounts[0] : (fallback.averageDiscount ?? phaseDiscounts[0]),
  );

  return {
    enabled: normalizeBoolean(source.enabled, fallback.enabled),
    technicalOverrideRaw: boundedNumber(source.technicalOverrideRaw, 0, 70, fallback.technicalOverrideRaw),
    qValues,
    quantityInputs,
    tValues,
    dValues,
    tradeoffs,
    discountInputMode,
    phaseDiscounts,
    averageDiscount,
  };
};

export const normalizeComboOffer = (value: unknown): ComboOffer => {
  const fallback = emptyComboOffer();
  const source = isRecord(value) ? value : {};
  const phaseDiscounts = normalizePhaseDiscounts(source.phaseDiscounts ?? fallback.phaseDiscounts);
  const discountInputMode = normalizeDiscountInputMode(source.discountInputMode, fallback.discountInputMode);
  const averageDiscount = nonNegativeNumber(
    source.averageDiscount,
    discountInputMode === "average" ? phaseDiscounts[0] : (fallback.averageDiscount ?? phaseDiscounts[0]),
  );

  return {
    enabled: normalizeBoolean(source.enabled, fallback.enabled),
    discountInputMode,
    phaseDiscounts,
    averageDiscount,
    insertedInBothBuste: normalizeBoolean(source.insertedInBothBuste, fallback.insertedInBothBuste),
    pefCoherent: normalizeBoolean(source.pefCoherent, fallback.pefCoherent),
  };
};

const criterionById = new Map(CRITERIA.map((criterion) => [criterion.id, criterion]));

const normalizeExcelScenarioSnapshot = (value: ExcelScenarioLike): { snapshot?: SavedScenarioSnapshot; hasCriteria: boolean } => {
  const baseScenarioId = normalizeBaseScenarioId(value.baseScenarioId);
  const fallbackScenario = getBaseScenario(baseScenarioId);
  const bidderMap = new Map<string, Bidder>();
  let hasCriteria = false;

  const ensureBidder = (idValue: unknown, nameValue?: unknown) => {
    const fallbackId = `excel-${bidderMap.size + 1}`;
    const id = normalizedId(idValue, fallbackId);
    const existing = bidderMap.get(id);
    if (existing) {
      const normalized = normalizedName(nameValue, existing.name);
      if (normalized && normalized !== existing.name) existing.name = normalized;
      return existing;
    }
    const bidder = createBidder(id, normalizedName(nameValue, id));
    bidderMap.set(id, bidder);
    return bidder;
  };

  const offers = Array.isArray(value.offers) ? value.offers : [];
  for (const row of offers) {
    if (!isRecord(row)) continue;
    const lotId = recordValue(row, "lotId") ?? recordValue(row, "lotto");
    if (!isLotId(lotId)) continue;
    const bidder = ensureBidder(recordValue(row, "bidderId"), recordValue(row, "bidderName") ?? recordValue(row, "bidderNome"));
    const offer = bidder.lots[lotId];
    offer.enabled = normalizeBoolean(recordValue(row, "enabled") ?? recordValue(row, "attivo"), true);
    offer.technicalOverrideRaw = boundedNumber(
      recordValue(row, "technicalRaw") ?? recordValue(row, "technicalOverrideRaw") ?? recordValue(row, "punteggioTecnicoRaw"),
      0,
      70,
      0,
    );
    const discount = boundedNumber(recordValue(row, "discount") ?? recordValue(row, "ribasso") ?? recordValue(row, "ribassoMedioPercento"), 0, 100, 0) ?? 0;
    offer.discountInputMode = "average";
    offer.averageDiscount = discount;
    offer.phaseDiscounts = [discount, discount, discount];
  }

  const criteria = Array.isArray(value.criteria) ? value.criteria : [];
  for (const row of criteria) {
    if (!isRecord(row)) continue;
    const lotId = recordValue(row, "lotId") ?? recordValue(row, "lotto");
    if (!isLotId(lotId)) continue;
    const criterionId = recordValue(row, "criterionId") ?? recordValue(row, "criterioId") ?? recordValue(row, "criterio");
    if (typeof criterionId !== "string") continue;
    const criterion = criterionById.get(criterionId);
    if (!criterion) continue;
    const bidder = ensureBidder(recordValue(row, "bidderId"), recordValue(row, "bidderName") ?? recordValue(row, "bidderNome"));
    const offer = bidder.lots[lotId];
    const keyHasOfferRow = offers.some((offerRow) =>
      isRecord(offerRow) && recordValue(offerRow, "bidderId") === bidder.id && (recordValue(offerRow, "lotId") ?? recordValue(offerRow, "lotto")) === lotId,
    );
    if (!keyHasOfferRow) offer.enabled = true;

    if (criterion.kind === "Q") {
      const numerator = boundedNumber(recordValue(row, "numerator") ?? recordValue(row, "numeratore"), 0, Number.MAX_SAFE_INTEGER);
      const denominator = boundedNumber(recordValue(row, "denominator") ?? recordValue(row, "denominatore"), 0, Number.MAX_SAFE_INTEGER);
      if (criterion.quantityInput && typeof numerator === "number" && typeof denominator === "number" && denominator > 0) {
        offer.quantityInputs[criterion.id] = { numerator, denominator };
        const ratio = Math.min(1, Math.max(0, numerator / denominator));
        offer.qValues[criterion.id] = criterion.quantityInput.kind === "percent" ? ratio * 100 : ratio;
      } else {
        offer.qValues[criterion.id] = boundedNumber(recordValue(row, "value") ?? recordValue(row, "valore"), 0, Number.MAX_SAFE_INTEGER, 0) ?? 0;
      }
    }

    if (criterion.kind === "T") {
      offer.tValues[criterion.id] = normalizeBoolean(recordValue(row, "flag") ?? recordValue(row, "value") ?? recordValue(row, "valore"), false);
    }

    if (criterion.kind === "D") {
      offer.dValues[criterion.id] = boundedNumber(recordValue(row, "flag") ?? recordValue(row, "value") ?? recordValue(row, "valore"), 0, 1, 0) ?? 0;
    }

    hasCriteria = true;
  }

  const combos = Array.isArray(value.combos) ? value.combos : [];
  for (const row of combos) {
    if (!isRecord(row)) continue;
    const pairId = recordValue(row, "pairId") ?? recordValue(row, "coppia");
    if (!isPairId(pairId)) continue;
    const bidder = ensureBidder(recordValue(row, "bidderId"), recordValue(row, "bidderName") ?? recordValue(row, "bidderNome"));
    const combo = bidder.combos[pairId];
    combo.enabled = normalizeBoolean(recordValue(row, "enabled") ?? recordValue(row, "attivo"), false);
    const discount = boundedNumber(recordValue(row, "discount") ?? recordValue(row, "ribasso") ?? recordValue(row, "ribassoCombinatoria"), 0, 100, 0) ?? 0;
    combo.discountInputMode = "average";
    combo.averageDiscount = discount;
    combo.phaseDiscounts = [discount, discount, discount];
    combo.insertedInBothBuste = normalizeBoolean(recordValue(row, "insertedInBothBuste") ?? recordValue(row, "inseritoBuste"), true);
    combo.pefCoherent = normalizeBoolean(recordValue(row, "pefCoherent") ?? recordValue(row, "pefCoerente"), true);
  }

  const bidders = Array.from(bidderMap.values());
  if (!bidders.length) return { hasCriteria };
  if (hasCriteria) {
    for (const bidder of bidders) {
      for (const lot of LOTS) delete bidder.lots[lot.id].technicalOverrideRaw;
    }
  }
  const firstBidderId = bidders[0]?.id ?? fallbackScenario.defaultBidderId;

  return {
    hasCriteria,
    snapshot: {
    schemaVersion: 8,
    id: normalizedId(value.id, `excel-${Date.now()}`),
    name: normalizedName(value.name, "Scenario Excel"),
    savedAt: typeof value.savedAt === "string" ? value.savedAt : new Date().toISOString(),
    originProfileId: baseScenarioId,
    bidders,
    settings: normalizeSettings(value.settings),
    optimization: fallbackScenario.buildOptimizationConfig(),
    selectedBidderId:
      typeof value.selectedBidderId === "string" && bidders.some((bidder) => bidder.id === value.selectedBidderId)
        ? value.selectedBidderId
        : firstBidderId,
    selectedLotId: isLotId(value.selectedLotId) ? value.selectedLotId : fallbackScenario.defaultLotId,
    selectedPairId: isPairId(value.selectedPairId) ? value.selectedPairId : fallbackScenario.defaultPairId,
    },
  };
};

export const normalizeBidder = (value: unknown, index = 0, fallbackBidder?: Bidder): Bidder => {
  const source = isRecord(value) ? value : {};
  const id = normalizedId(source.id, `offerente-${index + 1}`);
  const bidder = createBidder(id, normalizedName(source.name, `Offerente ${index + 1}`));

  bidder.lots = Object.fromEntries(
    LOTS.map((lot) => [lot.id, normalizeLotOffer(recordValue(source.lots, lot.id), fallbackBidder?.lots[lot.id])]),
  ) as Record<LotId, LotOffer>;
  bidder.combos = Object.fromEntries(
    PAIRS.map((pair) => [pair.id, normalizeComboOffer(recordValue(source.combos, pair.id))]),
  ) as Record<PairId, ComboOffer>;

  return bidder;
};

export const normalizeBidders = (value: unknown, baseScenarioId: BaseScenarioId): Bidder[] => {
  const fallbackBidders = getBaseScenario(baseScenarioId).buildBidders();
  if (!Array.isArray(value) || !value.length) return fallbackBidders;
  const usedIds = new Set<string>();
  return value.map((item, index) => {
    const source = isRecord(item) ? item : {};
    const fallbackById = typeof source.id === "string" ? fallbackBidders.find((bidder) => bidder.id === source.id) : undefined;
    const bidder = normalizeBidder(item, index, fallbackById ?? fallbackBidders[index]);
    const baseId = bidder.id;
    let candidateId = baseId;
    let suffix = 2;
    while (usedIds.has(candidateId)) {
      candidateId = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(candidateId);
    return { ...bidder, id: candidateId };
  });
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
  const originProfileId = resolveLegacyProfileId(candidate);
  const bidders = normalizeBidders(candidate.bidders, originProfileId);
  if (!bidders.length) return undefined;
  const fallbackScenario = getBaseScenario(originProfileId);
  const firstBidderId = bidders[0]?.id ?? fallbackScenario.defaultBidderId;
  const rawId = normalizedId(candidate.id, `scenario-${Date.now()}`);
  const id = isBaseScenarioId(rawId) && !isPresetScenarioId(rawId) ? presetScenarioId(rawId) : rawId;

  return {
    schemaVersion: 8,
    id,
    name: normalizedName(candidate.name, "Scenario importato"),
    savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : new Date().toISOString(),
    originProfileId,
    bidders,
    settings: normalizeSettings(candidate.settings),
    optimization: normalizeOptimizationConfig(candidate.optimization, fallbackScenario.buildOptimizationConfig()),
    selectedBidderId: typeof candidate.selectedBidderId === "string" && bidders.some((bidder) => bidder.id === candidate.selectedBidderId)
      ? candidate.selectedBidderId
      : firstBidderId,
    selectedLotId: isLotId(candidate.selectedLotId) ? candidate.selectedLotId : fallbackScenario.defaultLotId,
    selectedPairId: isPairId(candidate.selectedPairId) ? candidate.selectedPairId : fallbackScenario.defaultPairId,
  };
};

const hasIncompleteBidderShape = (value: unknown) => {
  if (!Array.isArray(value)) return true;
  return value.some((item) => {
    if (!isRecord(item)) return true;
    const lots = isRecord(item.lots) ? item.lots : {};
    const combos = isRecord(item.combos) ? item.combos : {};
    return (
      LOTS.some((lot) => !isRecord(lots[lot.id])) ||
      PAIRS.some((pair) => !isRecord(combos[pair.id]))
    );
  });
};

const hasDuplicateBidderIds = (value: unknown) => {
  if (!Array.isArray(value)) return false;
  const ids = value
    .map((item) => recordValue(item, "id"))
    .filter((id): id is string => typeof id === "string" && id.trim() !== "");
  return new Set(ids).size !== ids.length;
};

export const normalizeScenarioSnapshotWithReport = (value: unknown): ScenarioImportReport => {
  const excelCandidate = extractExcelImportCandidate(value);
  if (excelCandidate) {
    const { snapshot, hasCriteria } = normalizeExcelScenarioSnapshot(excelCandidate);
    return {
      snapshot,
      messages: snapshot
        ? [
            hasCriteria
              ? "Formato Excel importato: sub-criteri tecnici, ribassi e combinatorie acquisiti."
              : "Formato Excel importato con tecnico aggregato: i sub-criteri non erano presenti nel file.",
          ]
        : ["Il JSON Excel non contiene offerte importabili."],
    };
  }

  const importCandidate = extractScenarioImportCandidate(value);
  if (!isRecord(importCandidate)) {
    return {
      snapshot: undefined,
      messages: ["Il JSON non contiene un oggetto scenario riconoscibile."],
    };
  }

  const candidate = importCandidate as LegacyScenarioLike;
  const snapshot = normalizeScenarioSnapshot(importCandidate);
  if (!snapshot) {
    return {
      snapshot: undefined,
      messages: ["Il JSON non contiene uno scenario importabile."],
    };
  }

  const messages: string[] = [];
  if (importCandidate !== value) messages.push("Struttura JSON riconosciuta: importato il primo scenario disponibile.");
  if (candidate.schemaVersion !== 8) messages.push("Schema aggiornato alla versione corrente.");
  if ((candidate.baseScenarioId || candidate.demoScenarioId) && !candidate.originProfileId) {
    messages.push("Profilo di riferimento legacy migrato al formato corrente.");
  }
  if (!Array.isArray(candidate.bidders) || candidate.bidders.length === 0) {
    messages.push("Concorrenti mancanti: usata la base dello scenario selezionato.");
  } else if (hasIncompleteBidderShape(candidate.bidders)) {
    messages.push("Offerte incomplete riparate con lotti, combinatorie e campi mancanti.");
  }
  if (hasDuplicateBidderIds(candidate.bidders)) messages.push("ID concorrente duplicati resi univoci per evitare sovrapposizioni nei punteggi.");
  if (!isRecord(candidate.optimization)) messages.push("Configurazione Ottimizzazione assente o non valida: usati i valori dello scenario base.");
  if (!isRecord(candidate.settings)) {
    messages.push("Parametri scenario assenti o non validi: usati i valori predefiniti.");
  } else if (snapshot.settings.threshold !== candidate.settings.threshold || snapshot.settings.applyAwardLimitDerogation !== candidate.settings.applyAwardLimitDerogation) {
    messages.push("Parametri scenario non validi riallineati ai valori supportati.");
  }
  if (snapshot.selectedBidderId !== candidate.selectedBidderId || snapshot.selectedLotId !== candidate.selectedLotId || snapshot.selectedPairId !== candidate.selectedPairId) {
    messages.push("Focus di lavoro non valido riallineato a concorrente, lotto e combinatoria disponibili.");
  }

  return { snapshot, messages };
};

export const normalizeStoredWorkspace = (value: unknown): StoredWorkspace | undefined => {
  if (!isRecord(value)) return undefined;
  const candidate = value as LegacyWorkspaceLike;
  const originProfileId = resolveLegacyProfileId(candidate);
  const fallbackScenario = getBaseScenario(originProfileId);
  const bidders = normalizeBidders(candidate.bidders, originProfileId);
  if (!bidders.length) return undefined;
  let activeSavedScenarioId = typeof candidate.activeSavedScenarioId === "string" ? candidate.activeSavedScenarioId : undefined;
  if (!activeSavedScenarioId && (candidate.baseScenarioId || candidate.demoScenarioId)) {
    activeSavedScenarioId = presetScenarioId(originProfileId);
  }

  return {
    schemaVersion: 8,
    scenarioName: normalizedName(candidate.scenarioName, fallbackScenario.title),
    activeSavedScenarioId,
    bidders,
    settings: normalizeSettings(candidate.settings),
    optimization: normalizeOptimizationConfig(candidate.optimization, fallbackScenario.buildOptimizationConfig()),
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

const normalizeStoredScenarioList = (value: unknown) => (Array.isArray(value) ? value : []);

export const readStoredWorkspace = (): StoredWorkspace | undefined =>
  normalizeStoredWorkspace(getStoredJson([STORAGE_KEYS.workspace, LEGACY_STORAGE_KEYS.workspace]));

export const bootstrapScenarioLibrary = (stored: SavedScenarioSnapshot[]): SavedScenarioSnapshot[] => {
  const hidden = readHiddenBaseScenarioIds();
  if (!stored.length) return hydrateScenarioLibrary([], hidden);

  const hasPresetEntries = stored.some((scenario) => isPresetScenarioId(scenario.id));
  if (!hasPresetEntries) return [...hydrateScenarioLibrary([], hidden), ...stored];

  return stored.filter((scenario) => {
    const presetBaseId = baseIdFromPresetScenarioId(scenario.id);
    return !presetBaseId || !hidden.includes(presetBaseId);
  });
};

export const readStoredSavedScenarios = (): SavedScenarioSnapshot[] =>
  bootstrapScenarioLibrary(
    normalizeStoredScenarioList(getStoredJson<unknown>([STORAGE_KEYS.scenarios, LEGACY_STORAGE_KEYS.scenarios]))
      .map(normalizeScenarioSnapshot)
      .filter((scenario): scenario is SavedScenarioSnapshot => Boolean(scenario)),
  );
