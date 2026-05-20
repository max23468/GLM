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
  hiddenBaseScenarios: "tpl-lotti-1-4-hidden-base-scenarios",
} as const;

export const LEGACY_STORAGE_KEYS = {
  theme: "tpl-simulator-theme",
  workspace: "tpl-simulator-workspace",
  scenarios: "tpl-simulator-scenarios",
} as const;

export type SavedScenarioSnapshot = {
  schemaVersion: 7;
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
  schemaVersion: 7;
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
  const tradeoffs = Object.fromEntries(
    CRITERIA.map((criterion) => [
      criterion.id,
      normalizeTradeoff(recordValue(source.tradeoffs, criterion.id), fallback.tradeoffs[criterion.id]),
    ]),
  );

  return {
    enabled: normalizeBoolean(source.enabled, fallback.enabled),
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
    enabled: normalizeBoolean(source.enabled, fallback.enabled),
    phaseDiscounts: normalizePhaseDiscounts(source.phaseDiscounts),
    insertedInBothBuste: normalizeBoolean(source.insertedInBothBuste, fallback.insertedInBothBuste),
    pefCoherent: normalizeBoolean(source.pefCoherent, fallback.pefCoherent),
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
  const baseScenarioId = normalizeBaseScenarioId(candidate.baseScenarioId ?? candidate.demoScenarioId);
  const bidders = normalizeBidders(candidate.bidders, baseScenarioId);
  if (!bidders.length) return undefined;
  const fallbackScenario = getBaseScenario(baseScenarioId);
  const firstBidderId = bidders[0]?.id ?? fallbackScenario.defaultBidderId;

  return {
    schemaVersion: 7,
    id: normalizedId(candidate.id, `scenario-${Date.now()}`),
    name: normalizedName(candidate.name, "Scenario importato"),
    savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : new Date().toISOString(),
    baseScenarioId,
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
  if (candidate.schemaVersion !== 7) messages.push("Schema aggiornato alla versione corrente.");
  if (!candidate.baseScenarioId && candidate.demoScenarioId) messages.push("Campo legacy demoScenarioId migrato a baseScenarioId.");
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
  const baseScenarioId = normalizeBaseScenarioId(candidate.baseScenarioId ?? candidate.demoScenarioId);
  const fallbackScenario = getBaseScenario(baseScenarioId);
  const bidders = normalizeBidders(candidate.bidders, baseScenarioId);
  if (!bidders.length) return undefined;

  return {
    schemaVersion: 7,
    scenarioName: normalizedName(candidate.scenarioName, fallbackScenario.title),
    activeSavedScenarioId: typeof candidate.activeSavedScenarioId === "string" ? candidate.activeSavedScenarioId : undefined,
    baseScenarioId,
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

export const readStoredSavedScenarios = (): SavedScenarioSnapshot[] =>
  normalizeStoredScenarioList(getStoredJson<unknown>([STORAGE_KEYS.scenarios, LEGACY_STORAGE_KEYS.scenarios]))
    .map(normalizeScenarioSnapshot)
    .filter((scenario): scenario is SavedScenarioSnapshot => Boolean(scenario));
