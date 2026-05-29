import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Download,
  CheckCircle2,
  CircleDollarSign,
  LineChart,
  type LucideIcon,
  Monitor,
  Moon,
  Sparkles,
  Route,
  SlidersHorizontal,
  Sun,
  Trophy,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useReducer, useState, type CSSProperties } from "react";
import {
  AMBITS,
  CRITERIA,
  DISCRETIONARY_SCALE,
  DOCUMENT_WARNINGS,
  ECONOMIC_PHASES,
  ECONOMIC_UNIT_BASE_BY_LOT,
  ECONOMIC_UNIT_BASE_BY_PAIR,
  ECONOMIC_UNIT_KM_BY_LOT,
  ECONOMIC_UNIT_KM_BY_PAIR,
  LOT_CONTEXT,
  LOTS,
  PAIRS,
  THRESHOLD_OPTIONS,
  type Criterion,
  type LotId,
  type PairId,
} from "./data/tender";
import { BASE_SCENARIOS, DEFAULT_SETTINGS, getBaseScenario } from "./data/base-scenarios";
import {
  applyPhaseDiscountDelta,
  computeQuantityInputValue,
  createBidder,
  criteriaByParent,
  economicBreakdown,
  economicBreakdownFromOffer,
  formatPercent,
  formatPoints,
  candidateLotScore,
  getQuantitativeCriterionValue,
  maxQtPoints,
  pairBaseByPhase,
  resolvePhaseDiscounts,
  round4,
  setAverageDiscountValue,
  setDiscountInputMode,
  setPhaseDiscountValue,
  clampDiscountPercent,
  simulate,
  type AssignmentCandidate,
  type Bidder,
  type DiscountInputMode,
  type EconomicDiscountSource,
  type ComboScore,
  type LotScore,
  type LotOffer,
  type QuantityInputValue,
  type Settings,
  type SimulationResult,
  type Suggestion,
  type TradeoffPlan,
} from "./lib/scoring";
import { ScenarioComparison } from "./components/scenario-panels";
import { InstructionsPage } from "./components/instructions-page";
import { HelpTooltip } from "./components/help-tooltip";
import { ReleasePanel } from "./components/release-panel";
import { WorkspaceSidebar } from "./components/workspace-sidebar";
import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
  buildDefaultScenarioLibrary,
  buildPresetScenarioSnapshot,
  hydrateScenarioLibrary,
  normalizeScenarioSnapshotWithReport,
  presetScenarioId,
  readStoredSavedScenarios,
  readStoredWorkspace,
  resolveOriginProfileId,
  type SavedScenarioSnapshot,
  type StoredWorkspace,
} from "./lib/scenario-persistence";
import {
  getOptimizationLever,
  optimizeOffer,
  type OptimizationConfig,
  type OptimizationLeverInput,
  type OptimizationResult,
  type OptimizationStep,
} from "./lib/optimization";
import {
  applyTradeoffPlanToOffer,
  computeTradeoffValue,
  defaultTradeoff,
  effectiveTradeoffDenominator,
  tradeoffCost,
} from "./lib/tradeoff";

const euroFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euroPerKmFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
type ThemePreference = "auto" | "light" | "dark";
type WorkspaceTab = "tecnica" | "economica" | "ottimizza" | "combinatorie" | "risultati";
type AppView = "simulatore" | "istruzioni";

type ExcelPackageManifest = {
  file?: string;
};

const themeOptions: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "auto", label: "Auto", icon: Monitor },
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "dark", label: "Scuro", icon: Moon },
];

const workspaceTabs: { value: WorkspaceTab; label: string; icon: LucideIcon }[] = [
  { value: "tecnica", label: "Tecnica", icon: BarChart3 },
  { value: "economica", label: "Economica", icon: CircleDollarSign },
  { value: "ottimizza", label: "Ottimizzazione", icon: Sparkles },
  { value: "combinatorie", label: "Combinatorie", icon: Route },
  { value: "risultati", label: "Risultati", icon: Trophy },
];

const optimizationScopeOptions: { value: OptimizationConfig["scope"]; label: string }[] = [
  { value: "active-lot", label: "Lotto attivo" },
  { value: "active-lots", label: "Tutti i lotti attivi" },
  { value: "scenario", label: "Scenario assegnazioni" },
];

const optimizationModeOptions: { value: OptimizationConfig["mode"]; label: string }[] = [
  { value: "technical-economic", label: "Tecnica + ribasso" },
  { value: "technical-only", label: "Solo tecnica" },
];

const suggestionEffortRank: Record<Suggestion["effort"], number> = {
  basso: 0,
  medio: 1,
  alto: 2,
};

const criterionKindLabel: Record<Criterion["kind"], string> = {
  Q: "Quantitativo",
  T: "Tabellare",
  D: "Discrezionale",
};

const ambitById = new Map(AMBITS.map((ambit) => [ambit.id, ambit]));

const getStoredTheme = (): ThemePreference => {
  if (typeof window === "undefined") return "auto";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.theme) ?? window.localStorage.getItem(LEGACY_STORAGE_KEYS.theme);
    return stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
  } catch {
    return "auto";
  }
};

const currentView = (): AppView => {
  if (typeof window === "undefined") return "simulatore";
  return window.location.pathname === "/istruzioni" || window.location.pathname === "/istruzioni/" ? "istruzioni" : "simulatore";
};

const makeDownloadName = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "scenario"}-${new Date().toISOString().slice(0, 10)}.json`;

const makeExcelDownloadName = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "scenario"}-excel-${new Date().toISOString().slice(0, 10)}.json`;

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

const signedPoints = (amount: number) => `${amount >= 0 ? "+" : ""}${formatPoints(amount)}`;

type OptimizationInvestmentRow = {
  key: string;
  label: string;
  focus: string;
  objectiveDelta: number;
  technicalDelta: number;
  economicDelta: number;
  cost: number;
  moves: number;
  efficiency: number;
};

const emptyInvestmentRow = (key: string, label: string): OptimizationInvestmentRow => ({
  key,
  label,
  focus: "",
  objectiveDelta: 0,
  technicalDelta: 0,
  economicDelta: 0,
  cost: 0,
  moves: 0,
  efficiency: 0,
});

const buildOptimizationInvestmentRows = (steps: OptimizationStep[]) => {
  const rows = new Map<string, OptimizationInvestmentRow>();
  const getRow = (key: string, label: string) => {
    const current = rows.get(key) ?? emptyInvestmentRow(key, label);
    rows.set(key, current);
    return current;
  };

  for (const step of steps) {
    if (step.kind === "reallocation") {
      const row = getRow("economica", "Offerta economica");
      row.focus = "Riallocare tecnica verso ribasso";
      row.objectiveDelta = round4(row.objectiveDelta + step.objectiveDelta);
      row.technicalDelta = round4(row.technicalDelta + (step.technicalDelta ?? 0));
      row.economicDelta = round4(row.economicDelta + (step.economicDelta ?? 0));
      row.cost = round4(row.cost + step.cost);
      row.moves += 1;
      continue;
    }

    const ambit = step.ambit ? ambitById.get(step.ambit) : undefined;
    const row = getRow(step.ambit ?? "tecnica", ambit ? `Ambito ${ambit.id}` : "Offerta tecnica");
    row.focus = ambit?.label ?? "Investimenti tecnici";
    row.objectiveDelta = round4(row.objectiveDelta + step.objectiveDelta);
    row.technicalDelta = round4(row.technicalDelta + (step.technicalDelta ?? step.objectiveDelta));
    row.economicDelta = round4(row.economicDelta + (step.economicDelta ?? 0));
    row.cost = round4(row.cost + step.cost);
    row.moves += 1;
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      efficiency: row.objectiveDelta > 0 ? row.cost / row.objectiveDelta : 0,
    }))
    .sort((a, b) => {
      if (b.objectiveDelta !== a.objectiveDelta) return b.objectiveDelta - a.objectiveDelta;
      return a.efficiency - b.efficiency;
    });
};

const buildOptimizationImpactRows = (steps: OptimizationStep[]) => {
  const rows = new Map<string, Omit<OptimizationInvestmentRow, "focus" | "efficiency">>();
  const hasImpact = (row: Omit<OptimizationInvestmentRow, "focus" | "efficiency">) =>
    row.technicalDelta !== 0 || row.economicDelta !== 0 || row.objectiveDelta !== 0;
  const getRow = (key: string, label: string) => {
    const current = rows.get(key) ?? { key, label, objectiveDelta: 0, technicalDelta: 0, economicDelta: 0, cost: 0, moves: 0 };
    rows.set(key, current);
    return current;
  };

  for (const step of steps) {
    if (step.kind === "reallocation") {
      const sourceAmbit = step.ambit ? ambitById.get(step.ambit) : undefined;
      const sourceRow = getRow(step.ambit ?? "tecnica", sourceAmbit ? `${sourceAmbit.id} - ${sourceAmbit.label}` : "Offerta tecnica");
      sourceRow.technicalDelta = round4(sourceRow.technicalDelta + (step.technicalDelta ?? 0));
      sourceRow.objectiveDelta = round4(sourceRow.objectiveDelta + (step.technicalDelta ?? 0));
      sourceRow.cost = round4(sourceRow.cost + (step.releasedValue ?? 0));
      sourceRow.moves += 1;

      const economicRow = getRow("economica", "Offerta economica");
      economicRow.economicDelta = round4(economicRow.economicDelta + (step.economicDelta ?? 0));
      economicRow.objectiveDelta = round4(economicRow.objectiveDelta + (step.economicDelta ?? 0));
      economicRow.cost = round4(economicRow.cost + step.cost);
      economicRow.moves += 1;
      continue;
    }

    const ambit = step.ambit ? ambitById.get(step.ambit) : undefined;
    const row = getRow(step.ambit ?? "tecnica", ambit ? `${ambit.id} - ${ambit.label}` : "Offerta tecnica");
    row.technicalDelta = round4(row.technicalDelta + (step.technicalDelta ?? step.objectiveDelta));
    row.economicDelta = round4(row.economicDelta + (step.economicDelta ?? 0));
    row.objectiveDelta = round4(row.objectiveDelta + step.objectiveDelta);
    row.cost = round4(row.cost + step.cost);
    row.moves += 1;
  }

  const impactRows = AMBITS.map((ambit) => {
    const row = rows.get(ambit.id);
    return row ?? { key: ambit.id, label: `${ambit.id} - ${ambit.label}`, technicalDelta: 0, economicDelta: 0, objectiveDelta: 0, cost: 0, moves: 0 };
  });
  const economic = rows.get("economica");
  return [
    ...impactRows,
    economic ?? { key: "economica", label: "Offerta economica", technicalDelta: 0, economicDelta: 0, objectiveDelta: 0, cost: 0, moves: 0 },
  ].filter(hasImpact);
};

const signedPercent = (amount: number) =>
  `${amount >= 0 ? "+" : ""}${amount.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pt`;

const formatMoveCount = (moves: number) => `${moves} ${moves === 1 ? "mossa" : "mosse"}`;

const formatReallocationSummary = (step: OptimizationStep) => {
  const releasedValue = step.releasedValue ?? 0;
  const fundedValue = Math.min(step.cost, releasedValue);
  const releasedText = euroFormatter.format(releasedValue);
  const fundedText = euroFormatter.format(fundedValue);
  const ribassoText = `+${(step.economicUnits ?? 0).toLocaleString("it-IT", { maximumFractionDigits: 4 })}% di ribasso`;

  if (releasedText === fundedText) {
    return `rialloca ${releasedText} verso ${ribassoText}`;
  }

  return `libera ${releasedText}; ${fundedText} finanziano ${ribassoText}`;
};

const formatInputPercent = (value: number) =>
  `${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const formatPercentPointsFromDecimal = (value: number) =>
  `${(value * 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

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

const buildScenarioLotSummaries = (assignments: AssignmentCandidate[]) =>
  LOTS.map((lot) => {
    const assignment = assignments.find((item) => item.lotIds.includes(lot.id));
    return {
      lot,
      score: assignment ? candidateLotScore(assignment, lot.id) : undefined,
    };
  });

const assignmentByLot = (result: SimulationResult, lotId: LotId) =>
  result.selectedScenario?.assignments.find((assignment) => assignment.lotIds.includes(lotId));

const formatAssignmentLotScores = (assignment: AssignmentCandidate) =>
  assignment.lotIds.map((lotId) => `${lotId} ${formatPoints(candidateLotScore(assignment, lotId))}`).join(" · ");

const criterionStatus = (criterion: Criterion, score: number, note?: string) => {
  if (note) return { label: "Verifica", tone: "warn" };
  if (criterion.maxPoints <= 0) return { label: "n/d", tone: "muted" };
  if (score <= 0) return { label: "Scoperto", tone: "weak" };
  if (score >= criterion.maxPoints * 0.9) return { label: "Forte", tone: "ok" };
  return { label: "Parziale", tone: "mid" };
};

type SimulatorState = {
  bidders: Bidder[];
  selectedBidderId: string;
  selectedLotId: LotId;
  selectedPairId: PairId;
  activeTab: WorkspaceTab;
  selectedAmbitId: string;
  selectedCriterionId: string;
  settings: Settings;
  optimizationConfig: OptimizationConfig;
  scenarioName: string;
  activeSavedScenarioId?: string;
  compareScenarioId: string;
  scenarioNotice: string;
  isSuggestionsPanelExpanded: boolean;
  isWarningsPanelExpanded: boolean;
};

type SimulatorStateAction =
  | { type: "patch"; patch: Partial<SimulatorState> }
  | { type: "update"; updater: (state: SimulatorState) => SimulatorState };

type StateUpdater<T> = T | ((current: T) => T);

const resolveStateUpdater = <T,>(updater: StateUpdater<T>, current: T) =>
  typeof updater === "function" ? (updater as (value: T) => T)(current) : updater;

const buildDuplicateBidderName = (name: string, bidders: Bidder[]) => {
  const base = name.replace(/\s+copia(?:\s+\d+)?$/i, "").trim() || name;
  const firstCandidate = `${base} copia`;
  if (!bidders.some((bidder) => bidder.name === firstCandidate)) return firstCandidate;
  let index = 2;
  while (bidders.some((bidder) => bidder.name === `${base} copia ${index}`)) index += 1;
  return `${base} copia ${index}`;
};

const getFirstEnabledLotId = (bidder: Bidder, fallback: LotId): LotId => {
  for (const lot of LOTS) {
    if (bidder.lots[lot.id].enabled) return lot.id;
  }
  return fallback;
};

const createInitialSimulatorState = (): SimulatorState => {
  const initialWorkspace = readStoredWorkspace();
  const fallbackScenario = getBaseScenario("market");
  return {
    bidders: initialWorkspace?.bidders ?? fallbackScenario.buildBidders(),
    selectedBidderId: initialWorkspace?.selectedBidderId ?? fallbackScenario.defaultBidderId,
    selectedLotId: initialWorkspace?.selectedLotId ?? fallbackScenario.defaultLotId,
    selectedPairId: initialWorkspace?.selectedPairId ?? fallbackScenario.defaultPairId,
    activeTab: "tecnica",
    selectedAmbitId: AMBITS[0].id,
    selectedCriterionId: CRITERIA[0].id,
    settings: initialWorkspace?.settings ?? DEFAULT_SETTINGS,
    optimizationConfig: initialWorkspace?.optimization ?? fallbackScenario.buildOptimizationConfig(),
    scenarioName: initialWorkspace?.scenarioName ?? fallbackScenario.title,
    activeSavedScenarioId: initialWorkspace?.activeSavedScenarioId,
    compareScenarioId: "",
    scenarioNotice: "",
    isSuggestionsPanelExpanded: false,
    isWarningsPanelExpanded: false,
  };
};

const simulatorStateReducer = (state: SimulatorState, action: SimulatorStateAction): SimulatorState => {
  if (action.type === "patch") return { ...state, ...action.patch };
  return action.updater(state);
};

function useSimulatorController() {
  const [view, setView] = useState<AppView>(currentView);
  const [simulatorState, dispatchSimulatorState] = useReducer(simulatorStateReducer, undefined, createInitialSimulatorState);
  const {
    bidders,
    selectedBidderId,
    selectedLotId,
    selectedPairId,
    activeTab,
    selectedAmbitId,
    selectedCriterionId,
    settings,
    optimizationConfig,
    scenarioName,
    activeSavedScenarioId,
    compareScenarioId,
    scenarioNotice,
    isSuggestionsPanelExpanded,
    isWarningsPanelExpanded,
  } = simulatorState;
  const [savedScenarios, setSavedScenarios] = useState<SavedScenarioSnapshot[]>(readStoredSavedScenarios);
  const [themePreference, setThemePreference] = useState<ThemePreference>(getStoredTheme);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false,
  );
  const resolvedTheme = themePreference === "auto" ? (systemPrefersDark ? "dark" : "light") : themePreference;
  const patchSimulatorState = (patch: Partial<SimulatorState>) => dispatchSimulatorState({ type: "patch", patch });
  const updateSimulatorState = (updater: (state: SimulatorState) => SimulatorState) => dispatchSimulatorState({ type: "update", updater });
  const setBidders = (updater: StateUpdater<Bidder[]>) =>
    updateSimulatorState((state) => ({ ...state, bidders: resolveStateUpdater(updater, state.bidders) }));
  const setSelectedBidderId = (selectedBidderId: string) => patchSimulatorState({ selectedBidderId });
  const setSelectedLotId = (selectedLotId: LotId) => patchSimulatorState({ selectedLotId });
  const setSelectedPairId = (selectedPairId: PairId) => patchSimulatorState({ selectedPairId });
  const setActiveTab = (activeTab: WorkspaceTab) => patchSimulatorState({ activeTab });
  const setSelectedAmbitId = (selectedAmbitId: string) => patchSimulatorState({ selectedAmbitId });
  const setSelectedCriterionId = (selectedCriterionId: string) => patchSimulatorState({ selectedCriterionId });
  const setSettings = (updater: StateUpdater<Settings>) =>
    updateSimulatorState((state) => ({ ...state, settings: resolveStateUpdater(updater, state.settings) }));
  const setOptimizationConfig = (updater: StateUpdater<OptimizationConfig>) =>
    updateSimulatorState((state) => ({ ...state, optimizationConfig: resolveStateUpdater(updater, state.optimizationConfig) }));
  const setScenarioName = (scenarioName: string) => patchSimulatorState({ scenarioName });
  const setActiveSavedScenarioId = (activeSavedScenarioId: string | undefined) => patchSimulatorState({ activeSavedScenarioId });
  const setCompareScenarioId = (compareScenarioId: string) => patchSimulatorState({ compareScenarioId });
  const setScenarioNotice = (scenarioNotice: string) => patchSimulatorState({ scenarioNotice });
  const setSuggestionsPanelExpanded = (updater: StateUpdater<boolean>) =>
    updateSimulatorState((state) => ({ ...state, isSuggestionsPanelExpanded: resolveStateUpdater(updater, state.isSuggestionsPanelExpanded) }));
  const setWarningsPanelExpanded = (updater: StateUpdater<boolean>) =>
    updateSimulatorState((state) => ({ ...state, isWarningsPanelExpanded: resolveStateUpdater(updater, state.isWarningsPanelExpanded) }));

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = themePreference;
    document.documentElement.style.colorScheme = resolvedTheme;
    window.localStorage.setItem(STORAGE_KEYS.theme, themePreference);
  }, [resolvedTheme, themePreference]);

  useEffect(() => {
    const handleNavigation = () => setView(currentView());
    window.addEventListener("popstate", handleNavigation);
    return () => window.removeEventListener("popstate", handleNavigation);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEYS.workspace,
      JSON.stringify({
        schemaVersion: 8,
        scenarioName,
        activeSavedScenarioId,
        bidders,
        optimization: optimizationConfig,
        settings,
        selectedBidderId,
        selectedLotId,
        selectedPairId,
      } satisfies StoredWorkspace),
    );
  }, [activeSavedScenarioId, bidders, optimizationConfig, scenarioName, selectedBidderId, selectedLotId, selectedPairId, settings]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.scenarios, JSON.stringify(savedScenarios));
  }, [savedScenarios]);

  const selectedBidder = bidders.find((bidder) => bidder.id === selectedBidderId) ?? bidders[0];
  const participatingLots = useMemo(
    () => selectedBidder ? LOTS.filter((lot) => selectedBidder.lots[lot.id].enabled) : [],
    [selectedBidder],
  );
  const selectedLot = LOTS.find((lot) => lot.id === selectedLotId) ?? LOTS[0];
  const selectedLotContext = LOT_CONTEXT[selectedLotId];
  const activeSavedScenario = useMemo(
    () => (activeSavedScenarioId ? savedScenarios.find((scenario) => scenario.id === activeSavedScenarioId) : undefined),
    [activeSavedScenarioId, savedScenarios],
  );
  const removedPresetCount = useMemo(
    () => BASE_SCENARIOS.filter((base) => !savedScenarios.some((scenario) => scenario.id === presetScenarioId(base.id))).length,
    [savedScenarios],
  );
  const result = useMemo(() => simulate(bidders, settings, selectedBidder?.id ?? ""), [bidders, settings, selectedBidder?.id]);
  const optimizationResult = useMemo(
    () => optimizeOffer(bidders, settings, selectedBidder?.id ?? "", selectedLotId, optimizationConfig),
    [bidders, optimizationConfig, selectedBidder?.id, selectedLotId, settings],
  );
  const selectedLotScore = selectedBidder ? result.lotScores[selectedBidder.id][selectedLotId] : undefined;
  const selectedComboScore = selectedBidder ? result.comboScores[selectedBidder.id][selectedPairId] : undefined;
  const selectedLotLabel = selectedLot.label;
  const activeTabLabel = workspaceTabs.find((tab) => tab.value === activeTab)?.label ?? "Tecnica";
  const workspaceTitle =
    activeTab === "risultati" ? `Risultati - ${selectedLotLabel}` :
    activeTab === "combinatorie" ? `Offerte combinatorie - ${selectedLotLabel}` :
    activeTab === "ottimizza" ? `Ottimizzazione - ${selectedLotLabel}` :
    `Offerta ${activeTabLabel.toLowerCase()} - ${selectedLotLabel}`;
  const selectedAmbit = AMBITS.find((ambit) => ambit.id === selectedAmbitId) ?? AMBITS[0];
  const selectedAmbitCriteria = useMemo(() => CRITERIA.filter((criterion) => criterion.ambit === selectedAmbit.id), [selectedAmbit.id]);
  const selectedCriterion = selectedAmbitCriteria.find((criterion) => criterion.id === selectedCriterionId) ?? selectedAmbitCriteria[0] ?? CRITERIA[0];
  const compareScenario = savedScenarios.find((scenario) => scenario.id === compareScenarioId);
  const compareResult = useMemo(
    () => (compareScenario ? simulate(compareScenario.bidders, compareScenario.settings, compareScenario.selectedBidderId) : undefined),
    [compareScenario],
  );

  const selectAmbit = (ambitId: string) => {
    const firstCriterion = CRITERIA.find((criterion) => criterion.ambit === ambitId) ?? CRITERIA[0];
    patchSimulatorState({ selectedAmbitId: ambitId, selectedCriterionId: firstCriterion.id });
  };

  const selectBidder = (bidderId: string) => {
    const bidder = bidders.find((item) => item.id === bidderId);
    if (!bidder) return;
    const nextLotId = bidder.lots[selectedLotId].enabled ? selectedLotId : getFirstEnabledLotId(bidder, selectedLotId);
    patchSimulatorState({
      selectedBidderId: bidderId,
      selectedLotId: nextLotId,
      scenarioNotice:
        nextLotId === selectedLotId
          ? scenarioNotice
          : `Lotto di lavoro riallineato a ${nextLotId}: il concorrente selezionato non partecipa al lotto precedente.`,
    });
  };

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
    applyTradeoffPlanToOffer(nextOffer, criterion, plan);

    const lot = LOTS.find((item) => item.id === selectedLotId);
    const totalCost = tradeoffCost(criterion, plan);
    if (lot && totalCost > 0) {
      const reductionPoints = (totalCost / lot.totalBase) * 100;
      Object.assign(nextOffer, applyPhaseDiscountDelta(nextOffer, -reductionPoints));
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

    const rankedSuggestions = useMemo(
      () => {
        const entries: { suggestion: Suggestion; index: number; isDirect: boolean }[] = [];
        for (let index = 0; index < result.suggestions.length; index += 1) {
          const suggestion = result.suggestions[index];
          entries.push({
            suggestion,
            index,
            isDirect:
              Boolean(selectedBidder) &&
              suggestion.bidderId === selectedBidder?.id &&
              (!suggestion.lotId || suggestion.lotId === selectedLotId) &&
              (!suggestion.pairId || suggestion.pairId === selectedPairId),
          });
        }
        entries.sort((left, right) => {
          if (left.isDirect !== right.isDirect) return left.isDirect ? -1 : 1;
          const effortDelta = suggestionEffortRank[left.suggestion.effort] - suggestionEffortRank[right.suggestion.effort];
          return effortDelta || left.index - right.index;
        });
        return entries.reduce<Suggestion[]>((items, entry) => {
          items.push(entry.suggestion);
          return items;
        }, []);
      },
      [result.suggestions, selectedBidder, selectedLotId, selectedPairId],
    );

  const updateBidder = (bidderId: string, updater: (bidder: Bidder) => Bidder) => {
    setBidders((current) => current.map((bidder) => (bidder.id === bidderId ? updater(structuredClone(bidder)) : bidder)));
  };

  const updateLotOffer = (lotId: LotId, updater: (offer: LotOffer) => LotOffer) => {
    if (!selectedBidder) return;
    updateBidder(selectedBidder.id, (bidder) => {
      bidder.lots[lotId] = updater(bidder.lots[lotId]);
      return bidder;
    });
  };

  const updateOptimizationConfig = (updater: (config: OptimizationConfig) => OptimizationConfig) => {
    setOptimizationConfig((current) => updater(structuredClone(current)));
  };

  const updateOptimizationLever = (lotId: LotId, criterionId: string, patch: Partial<OptimizationLeverInput>) => {
    updateOptimizationConfig((current) => {
      const currentLotLevers = current.levers[lotId] ?? {};
      const criterion = CRITERIA.find((item) => item.id === criterionId);
      const tradeoff = selectedBidder?.lots[lotId].tradeoffs[criterionId];
      const baseLever = criterion ? getOptimizationLever(current, lotId, criterion, tradeoff) : currentLotLevers[criterionId];
      return {
        ...current,
        levers: {
          ...current.levers,
          [lotId]: {
            ...currentLotLevers,
            [criterionId]: { ...baseLever, ...patch },
          },
        },
      };
    });
  };

    const selectWorkingLot = (lotId: LotId) => {
      if (!selectedBidder?.lots[lotId].enabled) {
        setScenarioNotice("Lotto non selezionabile: attiva prima la partecipazione del concorrente selezionato.");
        return;
      }
      setSelectedLotId(lotId);
    };

    const changeSelectedBidderLotParticipation = (lotId: LotId, checked: boolean) => {
      if (!selectedBidder) return;
      updateSimulatorState((state) => {
        let nextSelectedLotId = state.selectedLotId;
        let nextNotice = state.scenarioNotice;
        const nextBidders = state.bidders.map((bidder) => {
          if (bidder.id !== state.selectedBidderId) return bidder;
          const nextBidder = structuredClone(bidder);
          nextBidder.lots[lotId].enabled = checked;
          if (!checked && lotId === state.selectedLotId) {
            nextSelectedLotId = getFirstEnabledLotId(nextBidder, state.selectedLotId);
            if (nextSelectedLotId !== state.selectedLotId) {
              nextNotice = `Lotto di lavoro riallineato a ${nextSelectedLotId}: il concorrente selezionato non partecipa al lotto precedente.`;
            }
          }
          return nextBidder;
        });
        return { ...state, bidders: nextBidders, selectedLotId: nextSelectedLotId, scenarioNotice: nextNotice };
      });
    };

  const applyOptimizationPlan = () => {
    if (!selectedBidder || !optimizationResult.steps.length) return;
    setBidders(structuredClone(optimizationResult.optimizedBidders));
    setActiveSavedScenarioId(undefined);
    setScenarioNotice(`Piano ottimizzato applicato: ${formatPoints(optimizationResult.objectiveDelta)} punti stimati.`);
  };

  const applyTradeoff = (criterion: Criterion) => {
    if (!selectedBidder) return;
    updateLotOffer(selectedLotId, (offer) => {
      const plan = offer.tradeoffs[criterion.id] ?? defaultTradeoff();
      applyTradeoffPlanToOffer(offer, criterion, plan);

      const lot = LOTS.find((item) => item.id === selectedLotId);
      const totalCost = tradeoffCost(criterion, plan);
      if (lot && totalCost > 0) {
        const reductionPoints = (totalCost / lot.totalBase) * 100;
        Object.assign(offer, applyPhaseDiscountDelta(offer, -reductionPoints));
      }
      return { ...offer };
    });
  };

  const addBidder = () => {
    const nextId = `offerente-${Date.now()}`;
    const next = createBidder(nextId, `Nuovo concorrente ${bidders.length + 1}`);
    next.lots.L1.enabled = true;
    setBidders((current) => [...current, next]);
    setSelectedBidderId(nextId);
    setSelectedLotId("L1");
  };

  const duplicateBidder = (bidderId: string) => {
    const source = bidders.find((bidder) => bidder.id === bidderId);
    if (!source) return;
    const nextId = `offerente-${Date.now()}`;
    const next = structuredClone(source);
    next.id = nextId;
    next.name = buildDuplicateBidderName(source.name, bidders);
    setBidders((current) => [...current, next]);
    patchSimulatorState({
      selectedBidderId: nextId,
      selectedLotId: getFirstEnabledLotId(next, selectedLotId),
      scenarioNotice: `Duplicato: ${next.name}`,
    });
  };

    const removeBidder = (bidderId: string) => {
      if (bidders.length <= 1) return;
      const nextBidders = bidders.filter((bidder) => bidder.id !== bidderId);
      setBidders(nextBidders);
      if (selectedBidderId === bidderId) {
        const nextSelectedBidder = nextBidders[0];
        patchSimulatorState({
          selectedBidderId: nextSelectedBidder.id,
          selectedLotId: getFirstEnabledLotId(nextSelectedBidder, selectedLotId),
        });
      }
    };

  const currentScenarioSnapshot = (id = activeSavedScenarioId ?? `scenario-${Date.now()}`, name = scenarioName): SavedScenarioSnapshot => ({
    schemaVersion: 8,
    id,
    name: name.trim() || "Scenario senza nome",
    savedAt: new Date().toISOString(),
    originProfileId: resolveOriginProfileId(activeSavedScenario),
    bidders: structuredClone(bidders),
    optimization: structuredClone(optimizationConfig),
    settings: { ...settings },
    selectedBidderId: selectedBidder?.id ?? bidders[0]?.id ?? "",
    selectedLotId,
    selectedPairId,
  });

    const applyScenarioSnapshot = (scenario: SavedScenarioSnapshot) => {
      const nextBidders = structuredClone(scenario.bidders);
      const nextSelectedBidderId = nextBidders.some((bidder) => bidder.id === scenario.selectedBidderId) ? scenario.selectedBidderId : nextBidders[0]?.id ?? "";
      const nextSelectedBidder = nextBidders.find((bidder) => bidder.id === nextSelectedBidderId);
      const nextSelectedLotId = nextSelectedBidder?.lots[scenario.selectedLotId]?.enabled
        ? scenario.selectedLotId
        : nextSelectedBidder
          ? getFirstEnabledLotId(nextSelectedBidder, scenario.selectedLotId)
          : scenario.selectedLotId;
      setScenarioName(scenario.name);
      setActiveSavedScenarioId(scenario.id);
      setBidders(nextBidders);
      setOptimizationConfig(scenario.optimization);
      setSettings(scenario.settings);
      setSelectedBidderId(nextSelectedBidderId);
      setSelectedLotId(nextSelectedLotId);
    setSelectedPairId(scenario.selectedPairId);
    setScenarioNotice(`Caricato: ${scenario.name}`);
  };

  const saveCurrentScenario = () => {
    const nextId = activeSavedScenarioId ?? `scenario-${Date.now()}`;
    const snapshot = currentScenarioSnapshot(nextId);
    setSavedScenarios((current) => [snapshot, ...current.filter((scenario) => scenario.id !== nextId)]);
    setActiveSavedScenarioId(nextId);
    setScenarioNotice(`Salvato: ${snapshot.name}`);
  };

  const duplicateCurrentScenario = () => {
    const snapshot = currentScenarioSnapshot(`scenario-${Date.now()}`, `${scenarioName || "Scenario"} copia`);
    setSavedScenarios((current) => [snapshot, ...current]);
    applyScenarioSnapshot(snapshot);
    setScenarioNotice(`Duplicato: ${snapshot.name}`);
  };

  const exportCurrentScenario = () => {
    const snapshot = currentScenarioSnapshot(activeSavedScenarioId ?? `scenario-${Date.now()}`);
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = makeDownloadName(snapshot.name);
    link.click();
    URL.revokeObjectURL(url);
    setScenarioNotice(`Esportato: ${snapshot.name}`);
  };

  const exportExcelScenario = () => {
    const savedAt = new Date().toISOString();
    const payload = {
      format: "glm-excel-v1",
      schemaVersion: 1,
      id: activeSavedScenarioId ?? `excel-${Date.now()}`,
      name: scenarioName.trim() || "Scenario Excel",
      savedAt,
      originProfileId: resolveOriginProfileId(activeSavedScenario),
      settings: { ...settings },
      selectedBidderId: selectedBidder?.id ?? bidders[0]?.id ?? "",
      selectedLotId,
      selectedPairId,
      notes: "Export per Excel: include offerte, sub-criteri A-G, ribassi e combinatorie.",
      offers: bidders.flatMap((bidder) =>
        LOTS.map((lot) => {
          const score = result.lotScores[bidder.id]?.[lot.id];
          return {
            bidderId: bidder.id,
            bidderName: bidder.name,
            lotId: lot.id,
            enabled: bidder.lots[lot.id].enabled,
            technicalRaw: round4(score?.technical ?? 0),
            discount: round4((score?.singleRibasso ?? 0) * 100),
          };
        }),
      ),
      criteria: bidders.flatMap((bidder) =>
        LOTS.flatMap((lot) =>
          CRITERIA.map((criterion) => {
            const offer = bidder.lots[lot.id];
            const quantityInput = offer.quantityInputs[criterion.id];
            const value =
              criterion.kind === "Q"
                ? getQuantitativeCriterionValue(offer, criterion)
                : criterion.kind === "T"
                  ? Number(Boolean(offer.tValues[criterion.id]))
                  : round4(offer.dValues[criterion.id] ?? 0);
            return {
              bidderId: bidder.id,
              lotId: lot.id,
              criterionId: criterion.id,
              kind: criterion.kind,
              value: round4(Number(value) || 0),
              numerator: quantityInput?.numerator,
              denominator: quantityInput?.denominator,
              flag: criterion.kind === "T" ? Number(Boolean(offer.tValues[criterion.id])) : criterion.kind === "D" ? round4(offer.dValues[criterion.id] ?? 0) : undefined,
            };
          }),
        ),
      ),
      combos: bidders.flatMap((bidder) =>
        PAIRS.map((pair) => {
          const score = result.comboScores[bidder.id]?.[pair.id];
          return {
            bidderId: bidder.id,
            bidderName: bidder.name,
            pairId: pair.id,
            enabled: bidder.combos[pair.id].enabled,
            discount: round4((score?.ribasso ?? 0) * 100),
            insertedInBothBuste: bidder.combos[pair.id].insertedInBothBuste,
            pefCoherent: bidder.combos[pair.id].pefCoherent,
          };
        }),
      ),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = makeExcelDownloadName(payload.name);
    link.click();
    URL.revokeObjectURL(url);
    setScenarioNotice(`Esportato formato Excel: ${payload.name}`);
  };

  const importScenarioFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const { snapshot, messages } = normalizeScenarioSnapshotWithReport(parsed);
      if (!snapshot) {
        setScenarioNotice(messages[0] ?? "File JSON non riconosciuto.");
        return;
      }
      const imported = { ...snapshot, id: snapshot.id || `scenario-${Date.now()}`, savedAt: new Date().toISOString() };
      setSavedScenarios((current) => [imported, ...current.filter((scenario) => scenario.id !== imported.id)]);
      applyScenarioSnapshot(imported);
      setScenarioNotice(messages.length ? `Importato: ${imported.name}. ${messages.join(" ")}` : `Importato: ${imported.name}`);
    } catch {
      setScenarioNotice("Import non riuscito: controlla il file JSON.");
    }
  };

  const loadSavedScenario = (scenarioId: string) => {
    if (!scenarioId) return;
    const scenario = savedScenarios.find((item) => item.id === scenarioId);
    if (scenario) applyScenarioSnapshot(scenario);
  };

  const resetCurrentScenarioModel = () => {
    const profileId = resolveOriginProfileId(activeSavedScenario);
    const factory = buildPresetScenarioSnapshot(getBaseScenario(profileId));
    if (activeSavedScenarioId) {
      const restored = {
        ...factory,
        id: activeSavedScenarioId,
        name: scenarioName.trim() || factory.name,
        savedAt: activeSavedScenario?.savedAt ?? factory.savedAt,
      };
      setSavedScenarios((current) => current.map((scenario) => (scenario.id === activeSavedScenarioId ? restored : scenario)));
      applyScenarioSnapshot(restored);
    } else {
      setBidders(factory.bidders);
      setOptimizationConfig(factory.optimization);
      setSettings(factory.settings);
      setSelectedBidderId(factory.selectedBidderId);
      setSelectedLotId(factory.selectedLotId);
      setSelectedPairId(factory.selectedPairId);
    }
    setScenarioNotice(`Modello ripristinato: ${factory.name}`);
  };

  const restoreRemovedPresets = () => {
    setSavedScenarios((current) => hydrateScenarioLibrary(current, []));
    setScenarioNotice("Profili predefiniti ripristinati in libreria.");
  };

  const resetToolToInitialState = () => {
    const confirmed = window.confirm(
      "Reset totale del tool: verranno cancellati workspace, scenari salvati, preferenze locali e vecchie chiavi di compatibilità. Continuare?",
    );
    if (!confirmed) return;

    [...Object.values(STORAGE_KEYS), ...Object.values(LEGACY_STORAGE_KEYS)].forEach((key) => window.localStorage.removeItem(key));
    const library = buildDefaultScenarioLibrary();
    const initialScenario = library[0];
    setView("simulatore");
    window.history.pushState({}, "", "/");
    setSavedScenarios(library);
    applyScenarioSnapshot(initialScenario);
    setCompareScenarioId("");
    setActiveTab("tecnica");
    setSelectedAmbitId(AMBITS[0].id);
    setSelectedCriterionId(CRITERIA[0].id);
    setThemePreference("auto");
    setScenarioNotice("Tool ripristinato allo stato iniziale: libreria e input sono tornati ai valori predefiniti.");
  };

  const renameCurrentScenario = (name: string) => {
    setScenarioName(name);
    if (!activeSavedScenarioId) return;
    setSavedScenarios((current) =>
      current.map((scenario) => (scenario.id === activeSavedScenarioId ? { ...scenario, name: name.trim() || "Scenario senza nome" } : scenario)),
    );
  };

  const createNewScenario = () => {
    const template = buildPresetScenarioSnapshot(getBaseScenario("market"));
    setScenarioName("Nuovo scenario");
    setActiveSavedScenarioId(undefined);
    setBidders(template.bidders);
    setOptimizationConfig(template.optimization);
    setSettings(template.settings);
    setSelectedBidderId(template.selectedBidderId);
    setSelectedLotId(template.selectedLotId);
    setSelectedPairId(template.selectedPairId);
    setCompareScenarioId("");
    setScenarioNotice("Nuovo scenario creato: salvalo in libreria quando vuoi conservarlo.");
  };

  const deleteSavedScenario = (scenarioId?: string) => {
    const targetId = scenarioId ?? activeSavedScenarioId;
    if (!targetId) {
      setScenarioNotice("Seleziona uno scenario salvato prima di eliminarlo.");
      return;
    }
    const removed = savedScenarios.find((scenario) => scenario.id === targetId);
    setSavedScenarios((current) => current.filter((scenario) => scenario.id !== targetId));
    if (compareScenarioId === targetId) setCompareScenarioId("");
    if (activeSavedScenarioId === targetId) setActiveSavedScenarioId(undefined);
    setScenarioNotice(`Eliminato: ${removed?.name ?? "scenario salvato"}`);
  };

  const navigateToInstructions = () => {
    window.history.pushState({}, "", "/istruzioni/");
    setView("istruzioni");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navigateToSimulator = () => {
    window.history.pushState({}, "", "/");
    setView("simulatore");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return {
    view,
    navigateToSimulator,
    navigateToInstructions,
    themePreference,
    setThemePreference,
    resolvedTheme,
    scenarioName,
    savedScenarios,
    activeSavedScenarioId,
    scenarioNotice,
    renameCurrentScenario,
    createNewScenario,
    saveCurrentScenario,
    duplicateCurrentScenario,
    deleteSavedScenario,
    exportCurrentScenario,
    exportExcelScenario,
    importScenarioFile,
    loadSavedScenario,
    resetCurrentScenarioModel,
    resetToolToInitialState,
    restoreRemovedPresets,
    removedPresetCount,
    bidders,
    selectedBidder,
    result,
    settings,
    addBidder,
    duplicateBidder,
    removeBidder,
    selectBidder,
    updateBidder,
    changeSelectedBidderLotParticipation,
    setSettings,
    selectedLotLabel,
    selectedLotScore,
    activeTabLabel,
    setActiveTab,
      workspaceTitle,
      selectedLot,
      selectedLotContext,
    selectWorkingLot,
    selectedLotId,
    activeTab,
    participatingLots,
      selectedAmbitId,
      selectedAmbit,
      selectAmbit,
    selectedCriterion,
    setSelectedCriterionId,
    updateLotOffer,
    buildTradeoffPreview,
    applyTradeoff,
    optimizationConfig,
    optimizationResult,
    updateOptimizationConfig,
    updateOptimizationLever,
    applyOptimizationPlan,
    selectedPairId,
    selectedComboScore,
    setSelectedPairId,
      compareScenarioId,
      compareScenario,
      compareResult,
    setCompareScenarioId,
    rankedSuggestions,
    isSuggestionsPanelExpanded,
    setSuggestionsPanelExpanded,
    isWarningsPanelExpanded,
    setWarningsPanelExpanded,
  };
}

type SimulatorController = ReturnType<typeof useSimulatorController>;

function App() {
  const controller = useSimulatorController();
  if (controller.view === "istruzioni") {
    return <InstructionsPage onBack={controller.navigateToSimulator} />;
  }
  return <SimulatorApp controller={controller} />;
}

function SimulatorApp({ controller }: { controller: SimulatorController }) {
  return (
    <div className="app-shell">
      <SimulatorHeader controller={controller} />
      <div className="layout">
        <SimulatorSidebar controller={controller} />
        <WorkspaceMain controller={controller} />
        <InsightSidebar controller={controller} />
      </div>
    </div>
  );
}

function SimulatorHeader({ controller }: { controller: SimulatorController }) {
  const { navigateToInstructions, themePreference, setThemePreference, resolvedTheme } = controller;
  const [excelPackageHref, setExcelPackageHref] = useState("/downloads/Simulatore-TPL-Lotti-1-4.xlsm");

  useEffect(() => {
    let cancelled = false;
    fetch("/downloads/pacchetto-excel-vba.manifest.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((manifest: ExcelPackageManifest | null) => {
        if (cancelled || !manifest?.file) return;
        setExcelPackageHref(manifest.file);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="topbar">
      <div>
        <h1>Simulatore gara TPL lotti 1-4</h1>
        <p>Console operativa per confrontare lotti singoli, combinatorie, soglie di sbarramento, ribassi e criticità documentali.</p>
      </div>
      <div className="topbar-actions">
        <div className="theme-control" aria-label="Tema interfaccia">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                className={themePreference === option.value ? "active" : ""}
                onClick={() => setThemePreference(option.value)}
                aria-pressed={themePreference === option.value}
                title={option.value === "auto" ? "Auto (" + (resolvedTheme === "dark" ? "scuro" : "chiaro") + ")" : option.label}
              >
                <Icon size={15} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
        <button className="doc-link" type="button" onClick={navigateToInstructions}>
          <BookOpen size={16} />
          Istruzioni
        </button>
        <a className="doc-link" href={excelPackageHref} download>
          <Download size={16} />
          Pacchetto Excel
        </a>
      </div>
    </header>
  );
}

function SimulatorSidebar({ controller }: { controller: SimulatorController }) {
  const {
    scenarioName,
    savedScenarios,
    activeSavedScenarioId,
    scenarioNotice,
    renameCurrentScenario,
    createNewScenario,
    saveCurrentScenario,
    duplicateCurrentScenario,
    deleteSavedScenario,
    exportCurrentScenario,
    exportExcelScenario,
    importScenarioFile,
    loadSavedScenario,
    resetCurrentScenarioModel,
    resetToolToInitialState,
    restoreRemovedPresets,
    removedPresetCount,
    bidders,
    selectedBidder,
    result,
    settings,
    addBidder,
    duplicateBidder,
    removeBidder,
    selectBidder,
    updateBidder,
    changeSelectedBidderLotParticipation,
    setSettings,
  } = controller;

  return (
    <WorkspaceSidebar
      scenarioName={scenarioName}
      savedScenarios={savedScenarios}
      activeSavedScenarioId={activeSavedScenarioId}
      scenarioNotice={scenarioNotice}
      onScenarioNameChange={renameCurrentScenario}
      onNew={createNewScenario}
      onSave={saveCurrentScenario}
      onDuplicate={duplicateCurrentScenario}
      onDelete={() => deleteSavedScenario()}
      onDeleteSaved={deleteSavedScenario}
      onExport={exportCurrentScenario}
      onExportExcel={exportExcelScenario}
      onImportFile={importScenarioFile}
      onLoadSaved={loadSavedScenario}
      onResetModel={resetCurrentScenarioModel}
      onResetTool={resetToolToInitialState}
      removedPresetCount={removedPresetCount}
      onRestoreRemovedPresets={restoreRemovedPresets}
      bidders={bidders}
      selectedBidder={selectedBidder}
      result={result}
      settings={settings}
      onAddBidder={addBidder}
      onDuplicateBidder={duplicateBidder}
      onRemoveBidder={removeBidder}
      onSelectBidder={selectBidder}
      onSelectedBidderNameChange={(name) => {
        if (!selectedBidder) return;
        updateBidder(selectedBidder.id, (bidder) => {
          bidder.name = name;
          return bidder;
        });
      }}
      onLotParticipationChange={changeSelectedBidderLotParticipation}
      onComboParticipationChange={(pairId, checked) => {
        if (!selectedBidder) return;
        updateBidder(selectedBidder.id, (draft) => {
          draft.combos[pairId].enabled = checked;
          return draft;
        });
      }}
      onSettingsChange={(patch) => setSettings((current) => ({ ...current, ...patch }))}
    />
  );
}

function WorkspaceMain({ controller }: { controller: SimulatorController }) {
  const { selectedBidder } = controller;

  return (
    <main className="workspace">
      {selectedBidder && <WorkspaceWorkbench controller={controller} />}
    </main>
  );
}

function WorkspaceWorkbench({ controller }: { controller: SimulatorController }) {
  const {
    selectedBidder,
    workspaceTitle,
    selectedLotScore,
    selectedLotLabel,
    selectedLotContext,
    selectedLot,
    selectedLotId,
    selectWorkingLot,
    activeTab,
    setActiveTab,
    participatingLots,
    selectedAmbit,
    selectedCriterion,
    selectAmbit,
    setSelectedCriterionId,
    updateLotOffer,
    buildTradeoffPreview,
    applyTradeoff,
    selectedPairId,
    selectedComboScore,
    result,
    optimizationConfig,
    optimizationResult,
    updateOptimizationConfig,
    updateOptimizationLever,
    applyOptimizationPlan,
    setSelectedPairId,
    updateBidder,
    bidders,
    settings,
  } = controller;

  if (!selectedBidder) return null;



  return (
    <section className="panel workbench-panel">
      <div className="workspace-tabs" role="tablist" aria-label="Sezioni offerta">
        {workspaceTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              type="button"
              className={"workspace-tab " + (activeTab === tab.value ? "active" : "")}
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

      <div className="editor-header">
        <div>
          <div className="section-title">
            {workspaceTitle}
            <HelpTooltip>Cambia tab per compilare tecnica, economica, ottimizzazione, combinatorie e risultati. I punteggi si aggiornano subito.</HelpTooltip>
          </div>
          <p>Vista operativa per compilare valori, ribassi, combinatorie e leggere subito l'impatto sul punteggio.</p>
        </div>
        {selectedLotScore && (
          <div
            className={"status-badge threshold-status " + (selectedLotScore.admitted ? "ok" : "fail")}
            aria-label={"Soglia di sbarramento " + (selectedLotScore.admitted ? "superata" : "non superata")}
            title={"Soglia di sbarramento " + (selectedLotScore.admitted ? "superata" : "non superata")}
          >
            {selectedLotScore.admitted ? <CheckCircle2 size={16} /> : <X size={16} />}
            Soglia di sbarramento
          </div>
        )}
      </div>

      <div className="lot-workspace-switcher" aria-label="Lotto di lavoro">
        <div className="lot-workspace-context">
          <span>Lotto di lavoro</span>
          <strong>{selectedLotLabel}</strong>
          <small>
            {selectedLotContext.territory} · base d'asta {euroFormatter.format(selectedLot.totalBase)}
          </small>
          <a href={selectedLotContext.sourceUrl} target="_blank" rel="noreferrer">
            {selectedLotContext.source}
          </a>
        </div>
        <fieldset className="lot-switcher-buttons">
          <legend className="visually-hidden">Seleziona lotto</legend>
          {LOTS.map((lot) => {
            const participates = Boolean(selectedBidder.lots[lot.id].enabled);
            return (
              <button
                key={lot.id}
                type="button"
                className={((selectedLotId === lot.id ? "active" : "") + " " + (participates ? "" : "disabled")).trim()}
                onClick={() => selectWorkingLot(lot.id)}
                aria-pressed={selectedLotId === lot.id}
                disabled={!participates}
                title={participates ? "Lavora su " + lot.shortLabel : "Attiva la partecipazione a " + lot.shortLabel + " per lavorare su questo lotto"}
              >
                {lot.shortLabel}
              </button>
            );
          })}
        </fieldset>
      </div>

      <ActiveWorkbench controller={controller} />
    </section>
  );
}

function ActiveWorkbench({ controller }: { controller: SimulatorController }) {
  const {
    selectedBidder,
    selectedLotScore,
    selectedLotId,
    activeTab,
    participatingLots,
    selectedAmbit,
    selectedCriterion,
    selectAmbit,
    setSelectedCriterionId,
    updateLotOffer,
    buildTradeoffPreview,
    applyTradeoff,
    selectedPairId,
    selectedComboScore,
    result,
    optimizationConfig,
    optimizationResult,
    updateOptimizationConfig,
    updateOptimizationLever,
    applyOptimizationPlan,
    setSelectedPairId,
    updateBidder,
    bidders,
    settings,
  } = controller;

  if (!selectedBidder) return null;

    if (!participatingLots.length && activeTab !== "combinatorie" && activeTab !== "risultati") {
      return <div className="empty-state">Attiva almeno un lotto nella partecipazione per compilare tecnica, economica o ottimizzazione.</div>;
    }
    if (!selectedBidder.lots[selectedLotId].enabled && activeTab !== "ottimizza" && activeTab !== "combinatorie" && activeTab !== "risultati") {
      return <div className="empty-state">Il concorrente selezionato non partecipa a questo lotto.</div>;
    }
    if (activeTab === "tecnica" && selectedLotScore) {
      return (
        <TechnicalWorkbench
          bidder={selectedBidder}
          lotId={selectedLotId}
          lotScore={selectedLotScore}
          selectedAmbitId={selectedAmbit.id}
          selectedCriterion={selectedCriterion}
          onAmbitSelect={selectAmbit}
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
                qValues: { ...offer.qValues, [criterion.id]: computeQuantityInputValue(criterion, nextInput) },
                quantityInputs: { ...offer.quantityInputs, [criterion.id]: nextInput },
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
      );
    }
    if (activeTab === "economica" && selectedLotScore) {
      return (
        <EconomicsWorkbench
          bidder={selectedBidder}
          selectedLotId={selectedLotId}
          selectedPairId={selectedPairId}
          lotScore={selectedLotScore}
          comboScore={selectedComboScore}
          rMax={result.rMaxByLot[selectedLotId]}
          lotOffer={selectedBidder.lots[selectedLotId]}
          disabled={!selectedBidder.lots[selectedLotId].enabled}
          onDiscountModeChange={(mode) =>
            updateLotOffer(selectedLotId, (offer) => {
              const lot = LOTS.find((item) => item.id === selectedLotId);
              return lot ? setDiscountInputMode(offer, mode, lot.baseByPhase) : setDiscountInputMode(offer, mode);
            })
          }
          onPhaseChange={(index, value) =>
            updateLotOffer(selectedLotId, (offer) => setPhaseDiscountValue(offer, index, value))
          }
          onAverageChange={(value) =>
            updateLotOffer(selectedLotId, (offer) => setAverageDiscountValue(offer, value))
          }
        />
      );
    }
    if (activeTab === "ottimizza") {
      return (
        <OptimizationWorkbench
          bidder={selectedBidder}
          selectedLotId={selectedLotId}
          config={optimizationConfig}
          result={optimizationResult}
          onConfigChange={updateOptimizationConfig}
          onLeverChange={updateOptimizationLever}
          onApplyPlan={applyOptimizationPlan}
        />
      );
    }
    if (activeTab === "combinatorie" && selectedComboScore) {
      return (
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
          onDiscountModeChange={(mode) =>
            updateBidder(selectedBidder.id, (bidder) => {
              bidder.combos[selectedPairId] = setDiscountInputMode(
                bidder.combos[selectedPairId],
                mode,
                pairBaseByPhase(selectedPairId),
              );
              return bidder;
            })
          }
          onPhaseChange={(index, value) =>
            updateBidder(selectedBidder.id, (bidder) => {
              bidder.combos[selectedPairId] = setPhaseDiscountValue(bidder.combos[selectedPairId], index, value);
              return bidder;
            })
          }
          onAverageChange={(value) =>
            updateBidder(selectedBidder.id, (bidder) => {
              bidder.combos[selectedPairId] = setAverageDiscountValue(bidder.combos[selectedPairId], value);
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
      );
    }
    if (activeTab === "risultati") {
      return <ResultsWorkbench result={result} selectedLotId={selectedLotId} bidders={bidders} />;
    }
    return null;
}

function InsightSidebar({ controller }: { controller: SimulatorController }) {
  const {
    isSuggestionsPanelExpanded,
    setSuggestionsPanelExpanded,
    rankedSuggestions,
    isWarningsPanelExpanded,
    setWarningsPanelExpanded,
    result,
    savedScenarios,
    compareScenarioId,
    compareScenario,
    compareResult,
    setCompareScenarioId,
  } = controller;

  return (
    <aside className="right-panel">
      <section className={"panel insight-panel " + (isSuggestionsPanelExpanded ? "expanded" : "")}>
        <div className="section-title between">
          <span>Migliora punteggio</span>
          <button
            className="action-button compact panel-size-toggle"
            type="button"
            aria-expanded={isSuggestionsPanelExpanded}
            onClick={() => setSuggestionsPanelExpanded((expanded) => !expanded)}
          >
            {isSuggestionsPanelExpanded ? "Riduci" : "Allarga"}
          </button>
        </div>
        <div className="panel-scroll suggestion-list">
          {rankedSuggestions.map((suggestion) => (
            <article key={suggestion.title + "-" + suggestion.body} className="suggestion">
              <div>
                <strong>{suggestion.title}</strong>
                <span className={"effort " + suggestion.effort}>sforzo {suggestion.effort}</span>
              </div>
              <p>{suggestion.body}</p>
              <small>Impatto potenziale: {formatPoints(suggestion.impact)} pt</small>
            </article>
          ))}
        </div>
      </section>

      <section className={"panel insight-panel " + (isWarningsPanelExpanded ? "expanded" : "")}>
        <div className="section-title between">
          <span className="warn-title">
            <AlertTriangle size={18} />
            Criticità
          </span>
          <button
            className="action-button compact panel-size-toggle"
            type="button"
            aria-expanded={isWarningsPanelExpanded}
            onClick={() => setWarningsPanelExpanded((expanded) => !expanded)}
          >
            {isWarningsPanelExpanded ? "Riduci" : "Allarga"}
          </button>
        </div>
        <div className="panel-scroll warning-list">
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

      <div className="wide-panel">
        <ScenarioComparison
          savedScenarios={savedScenarios}
          compareScenarioId={compareScenarioId}
          compareScenario={compareScenario}
          compareResult={compareResult}
          currentResult={result}
          onCompareScenarioChange={setCompareScenarioId}
        />
      </div>

      <div className="wide-panel">
        <ReleasePanel />
      </div>
    </aside>
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
  const parentSections = criteriaByParent(selectedAmbit);
  const totalCriteria = parentSections.reduce((sum, parent) => sum + parent.criteria.length, 0);

  return (
    <div className="technical-workbench">
      <div className="ambit-strip" aria-label="Ambiti tecnici">
        {AMBITS.map((ambit) => (
            <button
              key={ambit.id}
              type="button"
              className={`ambit-button ${ambit.id === selectedAmbitId ? "active" : ""}`}
            onClick={() => onAmbitSelect(ambit.id)}
          >
            <small>{ambit.id}</small>
            <span>{ambit.label}</span>
            <strong>{formatPoints(lotScore.riparamByAmbit[ambit.id] ?? 0)} / {formatPoints(ambit.maxPoints)}</strong>
          </button>
        ))}
      </div>

      <div className="criteria-filter-bar">
        <div>
          <strong>
            Criteri {selectedAmbit.id}
          </strong>
          <span>
            {totalCriteria} criteri
          </span>
        </div>
        <div className="criterion-jump-list" aria-label={`Sotto criteri ${selectedAmbit.id}`}>
          {parentSections.flatMap((parent) =>
            parent.criteria.map((criterion) => {
              const subScore = lotScore.subScores[criterion.id];
              return (
                <button
                  key={criterion.id}
                  type="button"
                  className={criterion.id === selectedCriterion.id ? "active" : ""}
                  onClick={() => onCriterionSelect(criterion.id)}
                  title={criterion.label}
                  aria-pressed={criterion.id === selectedCriterion.id}
                >
                  <strong>{criterion.id}</strong>
                  <span>{criterion.label}</span>
                  <small>{formatPoints(subScore?.rawScore ?? 0)} / {formatPoints(criterion.maxPoints)} pt</small>
                </button>
              );
            }),
          )}
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

      <div className="criteria-table" aria-label={`Criteri ${selectedAmbit.label}`}>
        <div className="criteria-table-head">
          <span>Criterio</span>
          <span>Valore</span>
          <span>Punti</span>
          <span>Stato</span>
        </div>
        {parentSections.map((parent) => {
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
      <button className={`criterion-row ${selected ? "selected" : ""}`} type="button" onClick={onSelect}>
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
      <div className="criterion-inspector-main">
        <div className="criterion-inspector-head">
          <div>
            <strong>{criterion.id}</strong>
            <span>{criterion.label}</span>
          </div>
          <b>{formatPoints(score)} / {formatPoints(criterion.maxPoints)}</b>
        </div>

        <div className="criterion-entry-panel">
          <div className="inspector-section">
            <div className="inspector-section-title">
              {criterion.kind === "Q" && criterion.quantityInput ? "Dati proposta tecnica" : "Valore offerta"}
              <HelpTooltip>
                {criterion.kind === "Q" && criterion.quantityInput
                  ? "Compila numeratore e denominatore: il simulatore calcola il rapporto usato per il punteggio."
                  : criterion.kind === "T"
                    ? "Imposta Sì solo se il requisito è presente nello scenario tecnico."
                    : "Inserisci un valore simulato entro la scala discrezionale: non è una valutazione della Commissione."}
              </HelpTooltip>
            </div>
            {criterion.kind === "Q" && criterion.quantityInput && (
              <div className="quantity-input-panel">
                <div className="quantity-input-grid">
                  <label className="field compact">
                    <span>
                      {criterion.quantityInput.numeratorLabel}
                      <HelpTooltip>Inserisci le unità che soddisfano il requisito, per esempio mezzi o corse coperte.</HelpTooltip>
                    </span>
                      <input
                        type="number"
                        aria-label={criterion.quantityInput.numeratorLabel}
                        min={0}
                      step={1}
                      value={quantityInput.numerator}
                      onChange={(event) => onQuantityInputChange({ numerator: Number(event.target.value) })}
                    />
                  </label>
                  <label className="field compact">
                    <span>
                      {criterion.quantityInput.denominatorLabel}
                      <HelpTooltip>Inserisci la base totale coerente con il criterio; senza denominatore il rapporto non è affidabile.</HelpTooltip>
                    </span>
                      <input
                        type="number"
                        aria-label={criterion.quantityInput.denominatorLabel}
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
                    aria-label={`Valore ${criterion.id}`}
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
                    <button className={value ? "selected" : ""} type="button" onClick={() => onChange(true)}>
                      Presente
                    </button>
                    <button className={!value ? "selected" : ""} type="button" onClick={() => onChange(false)}>
                      Assente
                    </button>
              </div>
            )}
            {criterion.kind === "D" && (
                <select aria-label={`Coefficiente discrezionale ${criterion.id}`} value={Number(value)} onChange={(event) => onChange(Number(event.target.value))}>
                {DISCRETIONARY_SCALE.map((item) => (
                  <option key={item.label} value={item.value}>
                    {item.label} - {item.value}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="inspector-badges">
            <span>{criterionKindLabel[criterion.kind]}</span>
            <span className={`row-status ${status.tone}`}>{status.label}</span>
          </div>
        </div>

        <div className="criterion-meta">
          <span>{criterion.parentId} - {criterion.parentLabel}</span>
          <span>{criterion.kind} - {criterion.source}</span>
          {criterion.note && <span>{criterion.note}</span>}
          {note && <span className="note-warning">{note}</span>}
        </div>
      </div>
      {criterion.kind !== "D" ? (
        <div className="tradeoff-box">
          <div className="tradeoff-title">
            <span>
              Analisi puntuale criterio
              <HelpTooltip>Stima se un miglioramento tecnico compensa il costo e la riduzione implicita del ribasso. Sono ipotesi utente, non dati di gara.</HelpTooltip>
            </span>
            <small>costi come ipotesi utente</small>
          </div>
          <div className="tradeoff-grid">
            {criterion.kind === "Q" && (
              <label className="field compact">
                <span>
                  Delta {criterion.tradeoffUnit}
                  <HelpTooltip>Unità operative aggiunte o migliorate rispetto al valore corrente del criterio.</HelpTooltip>
                </span>
                  <input
                    type="number"
                    aria-label={`Delta ${criterion.tradeoffUnit} per ${criterion.id}`}
                    step={criterion.quantityInput || criterion.input === "ratio" ? 1 : criterion.input === "percent" ? 0.01 : 1}
                  min={0}
                  value={tradeoff.deltaUnits}
                  onChange={(event) => onTradeoffChange({ deltaUnits: Number(event.target.value) })}
                />
              </label>
            )}
            {criterion.kind === "Q" && (criterion.input === "ratio" || criterion.quantityInput) && (
              <label className="field compact">
                <span>
                  {criterion.quantityInput ? "Base di calcolo analisi" : "Base Nbus/fermate"}
                  <HelpTooltip>Base su cui trasformare il delta in rapporto percentuale o quota tecnica.</HelpTooltip>
                </span>
                  <input
                    type="number"
                    aria-label={`${criterion.quantityInput ? "Base di calcolo analisi" : "Base Nbus/fermate"} per ${criterion.id}`}
                    min={0}
                  step={1}
                  value={tradeoffDenominatorValue}
                  onChange={(event) => onTradeoffChange({ denominator: Number(event.target.value) })}
                />
              </label>
            )}
            <label className="field compact">
              <span>
                {criterion.kind === "T" ? "Costo totale impegno" : "Costo unitario"}
                <HelpTooltip>Importo stimato dall'utente. Il simulatore lo traduce in minore margine di ribasso.</HelpTooltip>
              </span>
                <input
                  type="number"
                  aria-label={`${criterion.kind === "T" ? "Costo totale impegno" : "Costo unitario"} per ${criterion.id}`}
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
            <button className="apply-tradeoff" type="button" onClick={onApplyTradeoff} disabled={!preview || preview.missingDenominator || (preview.totalCost === 0 && tradeoff.deltaUnits === 0)}>
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

type EconomicBreakdownModel = ReturnType<typeof economicBreakdown>;
type EconomicPhaseRate = {
  phase: (typeof ECONOMIC_PHASES)[number];
  rate: number;
  km: number;
  offered: number;
  weight: number;
};
type EconomicStressRow = {
  delta: number;
  lowerRevenue: number;
  nextEconomic: number;
  scoreDelta: number;
};
type EconomicGuardrail = {
  label: string;
  tone: string;
  body: string;
};

function EconomicsWorkbench({
  bidder,
  selectedLotId,
  selectedPairId,
  lotScore,
  comboScore,
  rMax,
  lotOffer,
  disabled,
  onDiscountModeChange,
  onPhaseChange,
  onAverageChange,
}: {
  bidder: Bidder;
  selectedLotId: LotId;
  selectedPairId: PairId;
  lotScore: LotScore;
  comboScore?: ComboScore;
  rMax: number;
  lotOffer: LotOffer;
  disabled?: boolean;
  onDiscountModeChange: (mode: DiscountInputMode) => void;
  onPhaseChange: (index: number, value: number) => void;
  onAverageChange: (value: number) => void;
}) {
  const [targetEconomic, setTargetEconomic] = useState(30);
  const selectedLot = LOTS.find((lot) => lot.id === selectedLotId) ?? LOTS[0];
  const selectedPair = PAIRS.find((pair) => pair.id === selectedPairId) ?? PAIRS[0];
  const discountMode = lotOffer.discountInputMode ?? "phases";
  const resolvedDiscounts = resolvePhaseDiscounts(lotOffer);
  const breakdown = economicBreakdownFromOffer(selectedLot.baseByPhase, lotOffer);
  const unitBreakdown = economicBreakdownFromOffer(ECONOMIC_UNIT_BASE_BY_LOT[selectedLotId], lotOffer);
  const unitKm = ECONOMIC_UNIT_KM_BY_LOT[selectedLotId];
  const targetRibasso = rMax > 0 ? round4((Math.min(30, Math.max(0, targetEconomic)) / 30) * rMax) : 0;
  const targetDelta = Math.max(0, targetRibasso - lotScore.singleRibasso);
  const onePointDelta = rMax > 0 && lotScore.singleEconomic < 30 ? rMax / 30 : 0;
  const phaseSpread = Math.max(...resolvedDiscounts) - Math.min(...resolvedDiscounts);
  const plannedTradeoffCost = CRITERIA.reduce((sum, criterion) => {
    const plan = lotOffer.tradeoffs[criterion.id];
    return sum + (plan ? tradeoffCost(criterion, plan) : 0);
  }, 0);
  const pefCostDrag = breakdown.baseTotal > 0 ? plannedTradeoffCost / breakdown.baseTotal : 0;
  const ribassoAfterTradeoffCosts = Math.max(0, lotScore.singleRibasso - pefCostDrag);
  const phaseRates = ECONOMIC_PHASES.map((phase, index) => {
    const offered = unitBreakdown.phases[index].offered;
    const km = unitKm[index] ?? 0;
    return {
      phase,
      rate: km > 0 ? offered / km : 0,
      km,
      offered,
      weight: breakdown.phases[index].weight,
    };
  });
  const averageRate = unitKm.reduce((sum, km) => sum + km, 0) > 0 ? breakdown.offeredTotal / unitKm.reduce((sum, km) => sum + km, 0) : 0;
    const rateSpread = Math.max(...phaseRates.map((phase) => phase.rate)) - Math.min(...phaseRates.map((phase) => phase.rate));
    const rateSpreadRatio = averageRate > 0 ? rateSpread / averageRate : 0;
    let dominantPhase = phaseRates[0];
    for (const phase of phaseRates) {
      if (phase.weight > dominantPhase.weight) dominantPhase = phase;
    }
  const ceaCriterion = CRITERIA.find((criterion) => criterion.id === "F.1.1");
  const ceaScore = lotScore.subScores["F.1.1"];
  const ceaScoreRatio = ceaCriterion && ceaCriterion.maxPoints > 0 ? (ceaScore?.rawScore ?? 0) / ceaCriterion.maxPoints : 0;
  const stressRows = [0.0025, 0.005, 0.01].map((delta) => {
    const nextRibasso = Math.min(1, lotScore.singleRibasso + delta);
    const nextRmax = Math.max(rMax, nextRibasso);
    const nextEconomic = nextRmax > 0 ? round4(30 * (nextRibasso / nextRmax)) : 0;
    const effectiveDelta = nextRibasso - lotScore.singleRibasso;
    return {
      delta,
      lowerRevenue: breakdown.baseTotal * effectiveDelta,
      nextEconomic,
      scoreDelta: round4(nextEconomic - lotScore.singleEconomic),
    };
  });
  const comboOffer = bidder.combos[selectedPairId];
  const comboBreakdown = economicBreakdownFromOffer(pairBaseByPhase(selectedPairId), comboOffer);
  const comboUnitBreakdown = economicBreakdownFromOffer(ECONOMIC_UNIT_BASE_BY_PAIR[selectedPairId], comboOffer);
  const comboUnitKm = ECONOMIC_UNIT_KM_BY_PAIR[selectedPairId];
  const singleOfferedForPair = selectedPair.lots.reduce((sum, lotId) => {
    const lot = LOTS.find((item) => item.id === lotId);
    return lot ? sum + economicBreakdownFromOffer(lot.baseByPhase, bidder.lots[lotId]).offeredTotal : sum;
  }, 0);
  const comboSaving = singleOfferedForPair - comboBreakdown.offeredTotal;
  const guardrails = [
    {
      label: "Ribassi >= 0",
      tone: resolvedDiscounts.every((discount) => discount >= 0) ? "ok" : "warn",
      body: resolvedDiscounts.every((discount) => discount >= 0) ? "Vincolo formale rispettato." : "Correggi i valori negativi prima di usare lo scenario.",
    },
    {
      label: "Profilo fasi",
      tone: discountMode === "average" ? "ok" : phaseSpread > 1.5 ? "warn" : "ok",
      body:
        discountMode === "average"
          ? "Modalità ribasso medio unico: le tre fasi sono allineate al valore inserito."
          : phaseSpread > 1.5
            ? "Scarto oltre 1,50%: verifica tenuta PEF e motivazione industriale."
            : "Ribassi allineati fra le tre fasi.",
    },
    {
      label: "Costi analisi puntuale",
      tone: plannedTradeoffCost > 0 ? "warn" : "ok",
      body:
        plannedTradeoffCost > 0
          ? `${euroFormatter.format(plannedTradeoffCost)} di costi stimati riducono il margine del ribasso.`
          : "Nessun costo da analisi puntuale aperto sul lotto selezionato.",
    },
    {
      label: "Margine PEF simulato",
      tone: plannedTradeoffCost > 0 && ribassoAfterTradeoffCosts < lotScore.singleRibasso * 0.5 ? "warn" : "ok",
      body:
        plannedTradeoffCost > 0
          ? `Dopo i costi puntuali, il ribasso gestionale letto sul PEF scende a ${formatPercent(ribassoAfterTradeoffCosts)}.`
          : "Nessun assorbimento costi rilevato sul ribasso del lotto.",
    },
    {
      label: "Scostamento €/km",
      tone: rateSpreadRatio > 0.08 ? "warn" : "ok",
      body:
        rateSpreadRatio > 0.08
          ? `Scostamento fra fasi pari a ${formatPercent(rateSpreadRatio)} della media: verifica coerenza dei corrispettivi unitari.`
          : "Corrispettivi unitari medi coerenti fra le fasi.",
    },
    {
      label: "CEA ambientale",
      tone: ceaScoreRatio >= 0.7 ? "ok" : "warn",
      body:
        ceaScoreRatio >= 0.7
          ? "Il punteggio CEA è già robusto nello scenario corrente."
          : "Il criterio I_CEA resta sensibile: verifica flotta, metodologia All. 13.11 e costo della leva ambientale.",
    },
  ];

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

      <EconomicFormulaSections
        breakdown={breakdown}
        lotScore={lotScore}
        rMax={rMax}
        onePointDelta={onePointDelta}
        targetEconomic={targetEconomic}
        setTargetEconomic={setTargetEconomic}
        targetRibasso={targetRibasso}
        targetDelta={targetDelta}
      />

      <EconomicEditor
        title={`Ribasso singolo - ${selectedLotId}`}
        offer={lotOffer}
        baseByPhase={selectedLot.baseByPhase}
        ribasso={lotScore.singleRibasso}
        disabled={disabled}
        onModeChange={onDiscountModeChange}
        onPhaseChange={onPhaseChange}
        onAverageChange={onAverageChange}
      />

      <EconomicRiskSections
        unitBreakdown={unitBreakdown}
        unitKm={unitKm}
        ribassoAfterTradeoffCosts={ribassoAfterTradeoffCosts}
        plannedTradeoffCost={plannedTradeoffCost}
        dominantPhase={dominantPhase}
        ceaScore={ceaScore}
        ceaCriterion={ceaCriterion}
        rateSpreadRatio={rateSpreadRatio}
        averageRate={averageRate}
        stressRows={stressRows}
        guardrails={guardrails}
      />

      <section className="economic-card">
        <div className="section-title compact">
          Vista economica combinatoria
          <HelpTooltip>Legge la coppia selezionata contro le offerte singole correnti: la combinatoria deve essere migliorativa e coerente.</HelpTooltip>
        </div>
        <div className="combo-economic-grid">
          <div>
            <span>Coppia</span>
            <strong>{selectedPair.label.replace("Lotti ", "")}</strong>
          </div>
          <div>
            <span>Ribasso combinatorio</span>
            <strong>{formatPercent(comboBreakdown.ribasso)}</strong>
          </div>
          <div>
            <span>Minimo migliorativo</span>
            <strong>{comboScore ? formatPercent(comboScore.minRequiredRibasso) : "n/d"}</strong>
          </div>
          <div className={comboSaving > 0 ? "ok" : "warn"}>
            <span>Risparmio vs singole</span>
            <strong>{euroFormatter.format(comboSaving)}</strong>
          </div>
          <div>
            <span>€/km medio F1</span>
            <strong>{euroPerKmFormatter.format(comboUnitBreakdown.phases[0].offered / comboUnitKm[0])}</strong>
          </div>
          <div className={comboScore?.admissible ? "ok" : bidder.combos[selectedPairId].enabled ? "warn" : ""}>
            <span>Stato</span>
            <strong>{comboScore?.admissible ? "Ammissibile" : bidder.combos[selectedPairId].enabled ? "Da verificare" : "Non attiva"}</strong>
          </div>
        </div>
        {comboScore?.warnings.length ? (
          <div className="warning-list compact">
            {comboScore.warnings.map((warning) => (
              <div key={warning} className="inline-warning">{warning}</div>
            ))}
          </div>
        ) : (
          <div className="hint">La combinatoria è letta rispetto alle offerte singole correnti dello stesso concorrente.</div>
        )}
      </section>

      <div className="hint">I valori economici sono simulazioni operative basate su All. 18 e sui ribassi inseriti: restano distinti da offerte ufficiali e PEF reali.</div>
    </div>
    );
  }

function EconomicFormulaSections({
  breakdown,
  lotScore,
  rMax,
  onePointDelta,
  targetEconomic,
  setTargetEconomic,
  targetRibasso,
  targetDelta,
}: {
  breakdown: EconomicBreakdownModel;
  lotScore: LotScore;
  rMax: number;
  onePointDelta: number;
  targetEconomic: number;
  setTargetEconomic: (value: number) => void;
  targetRibasso: number;
  targetDelta: number;
}) {
  return (
    <div className="economic-detail-grid">
      <section className="economic-card">
        <div className="section-title compact">
          Modello All. 18 - valori complessivi
          <HelpTooltip>Controlla qui come i tre ribassi di fase producono ribasso medio, corrispettivo offerto e peso ponderato.</HelpTooltip>
        </div>
        <div className="economic-table-wrap">
          <table className="economic-table">
            <thead>
              <tr>
                <th>Fase</th>
                <th>Base</th>
                <th>Ribasso</th>
                <th>Corrispettivo</th>
                <th>Peso</th>
              </tr>
            </thead>
            <tbody>
              {ECONOMIC_PHASES.map((phase, index) => {
                const item = breakdown.phases[index];
                return (
                  <tr key={phase.id}>
                    <td>
                      <strong>{phase.label}</strong>
                      <small>{phase.period}</small>
                    </td>
                    <td>{euroFormatter.format(item.base)}</td>
                    <td>{formatInputPercent(item.discount)}</td>
                    <td>{euroFormatter.format(item.offered)}</td>
                    <td>{formatPercent(item.weight)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Totale</td>
                <td>{euroFormatter.format(breakdown.baseTotal)}</td>
                <td>{formatPercent(breakdown.ribasso)}</td>
                <td>{euroFormatter.format(breakdown.offeredTotal)}</td>
                <td>100,00%</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="hint">La tabella replica la lettura operativa del foglio valori complessivi: il ribasso medio resta ponderato sulle basi delle tre fasi.</div>
      </section>

      <section className="economic-card">
        <div className="section-title compact">
          Formula punteggio
          <HelpTooltip>Il punteggio economico dipende dal rapporto tra il ribasso medio dell'offerta e il miglior ribasso medio corrente.</HelpTooltip>
        </div>
        <div className="formula-box">
          <span>Punteggio = 30 x R(i) / Rmax</span>
          <strong>{formatPoints(lotScore.singleEconomic)} / 30,00</strong>
        </div>
        <div className="economic-kpis">
          <div>
            <span>R(i)</span>
            <strong>{formatPercent(lotScore.singleRibasso)}</strong>
          </div>
          <div>
            <span>Rmax scenario</span>
            <strong>{rMax > 0 ? formatPercent(rMax) : "n/d"}</strong>
          </div>
          <div>
            <span>Gap da Rmax</span>
            <strong>{rMax > 0 ? formatPercentPointsFromDecimal(Math.max(0, rMax - lotScore.singleRibasso)) : "n/d"}</strong>
          </div>
          <div>
            <span>+1 punto econ.</span>
            <strong>{onePointDelta > 0 ? formatPercentPointsFromDecimal(onePointDelta) : "già al massimo"}</strong>
          </div>
        </div>
        <label className="target-control">
          <span>
            Target punteggio economico
            <HelpTooltip>Inserisci il punteggio obiettivo: il simulatore stima il ribasso medio necessario rispetto all'Rmax corrente.</HelpTooltip>
          </span>
          <input
            type="number"
            aria-label="Target punteggio economico"
            min={0}
            max={30}
            step={0.5}
            value={targetEconomic}
            onChange={(event) => setTargetEconomic(Math.min(30, Math.max(0, Number(event.target.value) || 0)))}
          />
        </label>
        <div className="target-result">
          <span>Ribasso medio richiesto</span>
          <strong>{rMax > 0 ? formatPercent(targetRibasso) : "n/d"}</strong>
          <small>
            {targetDelta > 0
              ? `Servono circa ${formatPercentPointsFromDecimal(targetDelta)} aggiuntivi, pari a ${euroFormatter.format(breakdown.baseTotal * targetDelta)} di minore corrispettivo.`
              : "Il target è già raggiunto nello scenario corrente."}
          </small>
        </div>
      </section>
    </div>
  );
}

function EconomicRiskSections({
  unitBreakdown,
  unitKm,
  ribassoAfterTradeoffCosts,
  plannedTradeoffCost,
  dominantPhase,
  ceaScore,
  ceaCriterion,
  rateSpreadRatio,
  averageRate,
  stressRows,
  guardrails,
}: {
  unitBreakdown: EconomicBreakdownModel;
  unitKm: readonly number[];
  ribassoAfterTradeoffCosts: number;
  plannedTradeoffCost: number;
  dominantPhase: EconomicPhaseRate;
  ceaScore?: LotScore["subScores"][string];
  ceaCriterion?: Criterion;
  rateSpreadRatio: number;
  averageRate: number;
  stressRows: EconomicStressRow[];
  guardrails: EconomicGuardrail[];
}) {
  return (
    <div className="economic-detail-grid">
      <section className="economic-card">
        <div className="section-title compact">
          Corrispettivi unitari €/km
          <HelpTooltip>Dato di lettura gestionale basato sulle vett*km dei modelli All. 18: non entra nel calcolo del punteggio.</HelpTooltip>
        </div>
        <div className="unit-rate-grid">
          {ECONOMIC_PHASES.map((phase, index) => {
            const offered = unitBreakdown.phases[index].offered;
            const rate = unitKm[index] > 0 ? offered / unitKm[index] : 0;
            return (
              <div key={phase.id} className="unit-rate">
                <span>{phase.label}</span>
                <strong>{euroPerKmFormatter.format(rate)}</strong>
                <small>{formatPlainNumber(unitKm[index])} vett*km</small>
              </div>
            );
          })}
        </div>
        <div className="hint">Vett*km da modelli All. 18.1-18.4, foglio valori unitari. Il dato serve per leggere la flessibilità contrattuale, non cambia il punteggio.</div>
      </section>

      <section className="economic-card">
        <div className="section-title compact">
          PEF, CEA e stress All. 18
          <HelpTooltip>Unisce letture gestionali: assorbimento costi nel PEF, coerenza €/km, indice CEA e impatto di ribassi aggiuntivi.</HelpTooltip>
        </div>
        <div className="pef-grid">
          <div>
            <span>Ribasso dopo costi puntuali</span>
            <strong>{formatPercent(ribassoAfterTradeoffCosts)}</strong>
            <small>{plannedTradeoffCost > 0 ? `${euroFormatter.format(plannedTradeoffCost)} assorbiti come costo stimato` : "nessun costo puntuale aperto"}</small>
          </div>
          <div>
            <span>Fase economica prevalente</span>
            <strong>{dominantPhase?.phase.label ?? "n/d"}</strong>
            <small>{dominantPhase ? `${formatPercent(dominantPhase.weight)} del valore complessivo` : "peso non calcolabile"}</small>
          </div>
          <div>
            <span>I_CEA</span>
            <strong>{typeof ceaScore?.value === "number" ? ceaScore.value.toLocaleString("it-IT", { maximumFractionDigits: 4 }) : "n/d"}</strong>
            <small>{formatPoints(ceaScore?.rawScore ?? 0)} / {formatPoints(ceaCriterion?.maxPoints ?? 0)} pt</small>
          </div>
          <div>
            <span>Scostamento €/km fasi</span>
            <strong>{formatPercent(rateSpreadRatio)}</strong>
            <small>media {euroPerKmFormatter.format(averageRate)} / km</small>
          </div>
        </div>
        <div className="stress-title">Stress rapido ribasso</div>
        <div className="stress-grid" aria-label="Stress rapido ribasso">
          {stressRows.map((row) => (
            <div key={row.delta}>
              <span>+{formatPercentPointsFromDecimal(row.delta)}</span>
              <strong>{euroFormatter.format(row.lowerRevenue)}</strong>
              <small>punteggio econ. {formatPoints(row.nextEconomic)} ({signedPoints(row.scoreDelta)})</small>
            </div>
          ))}
        </div>
      </section>

      <section className="economic-card">
        <div className="section-title compact">
          Guardrail economici
          <HelpTooltip>Segnali rapidi per intercettare ribassi negativi, profili di fase sbilanciati o costi da analisi puntuale aperti.</HelpTooltip>
        </div>
        <div className="guardrail-list">
          {guardrails.map((item) => (
            <div key={item.label} className={`guardrail ${item.tone}`}>
              <strong>{item.label}</strong>
              <span>{item.body}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type OptimizationImpactRow = Omit<OptimizationInvestmentRow, "focus" | "efficiency">;

function OptimizationWorkbench({
  bidder,
  selectedLotId,
  config,
  result,
  onConfigChange,
  onLeverChange,
  onApplyPlan,
}: {
  bidder: Bidder;
  selectedLotId: LotId;
  config: OptimizationConfig;
  result: OptimizationResult;
  onConfigChange: (updater: (config: OptimizationConfig) => OptimizationConfig) => void;
  onLeverChange: (lotId: LotId, criterionId: string, patch: Partial<OptimizationLeverInput>) => void;
  onApplyPlan: () => void;
}) {
  const targetLots: LotId[] = [];
  if (config.scope === "active-lot") {
    if (bidder.lots[selectedLotId].enabled) targetLots.push(selectedLotId);
  } else {
    for (const lot of LOTS) {
      if (bidder.lots[lot.id].enabled) targetLots.push(lot.id);
    }
  }
  const disabledByScope = !targetLots.length;
  const technicalCriteria = CRITERIA.filter((criterion) => criterion.kind !== "D");
  const grossPlanCost = result.steps.reduce((sum, step) => sum + step.cost, 0);
  const releasedTechnicalValue = result.steps.reduce((sum, step) => sum + (step.releasedValue ?? 0), 0);
  const reallocatedValue = result.steps.reduce((sum, step) => sum + Math.min(step.cost, step.releasedValue ?? 0), 0);
  const unusedReleasedValue = Math.max(0, releasedTechnicalValue - reallocatedValue);
  const netPlanCost = Math.max(0, grossPlanCost - reallocatedValue);
  const investmentRows = buildOptimizationInvestmentRows(result.steps);
  const impactRows = buildOptimizationImpactRows(result.steps);
  const maxImpact = Math.max(0.01, ...impactRows.map((row) => Math.abs(row.objectiveDelta)));

  return (
    <div className="optimization-board">
      <OptimizationMetrics result={result} />
      <OptimizationSettingsCard config={config} onConfigChange={onConfigChange} />
      <OptimizationInvestmentDashboard rows={investmentRows} />
      <OptimizationImpactMap rows={impactRows} maxImpact={maxImpact} />
      <OptimizationPlanCard
        result={result}
        grossPlanCost={grossPlanCost}
        reallocatedValue={reallocatedValue}
        unusedReleasedValue={unusedReleasedValue}
        netPlanCost={netPlanCost}
        disabledByScope={disabledByScope}
        onApplyPlan={onApplyPlan}
      />
      <OptimizationLeverCatalog
        bidder={bidder}
        config={config}
        targetLots={targetLots}
        technicalCriteria={technicalCriteria}
        onLeverChange={onLeverChange}
      />
    </div>
  );
}

function OptimizationMetrics({ result }: { result: OptimizationResult }) {
  return (
    <div className="metric-grid">
      <div className="metric-tile">
        <span>Punteggio iniziale</span>
        <strong>{formatPoints(result.initialScore)}</strong>
      </div>
      <div className="metric-tile ok">
        <span>Dopo piano</span>
        <strong>{formatPoints(result.finalScore)}</strong>
      </div>
      <div className={"metric-tile " + (result.objectiveDelta > 0 ? "ok" : "warn")}>
        <span>Delta stimato</span>
        <strong>{signedPoints(result.objectiveDelta)}</strong>
      </div>
    </div>
  );
}

function OptimizationSettingsCard({
  config,
  onConfigChange,
}: {
  config: OptimizationConfig;
  onConfigChange: (updater: (config: OptimizationConfig) => OptimizationConfig) => void;
}) {
  return (
    <section className="optimization-card">
      <div className="section-title compact">
        <SlidersHorizontal size={16} />
        Impostazioni ottimizzazione
        <HelpTooltip>Il piano parte dall'offerta corrente e rivaluta ogni mossa tenendo fermi i concorrenti. I criteri discrezionali sono esclusi.</HelpTooltip>
      </div>
      <div className="optimization-controls">
        <label className="field compact">
          <span>Leve considerate</span>
          <select
            value={config.mode}
            onChange={(event) =>
              onConfigChange((current) => ({
                ...current,
                mode: event.target.value === "technical-only" ? "technical-only" : "technical-economic",
              }))
            }
          >
            {optimizationModeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field compact">
          <span>Obiettivo</span>
          <select
            value={config.scope}
            onChange={(event) =>
              onConfigChange((current) => ({
                ...current,
                scope: event.target.value === "active-lots" || event.target.value === "scenario" ? event.target.value : "active-lot",
              }))
            }
          >
            {optimizationScopeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="optimization-hint">
        Il piano massimizza il punteggio partendo dall'offerta corrente. Il ribasso aumenta solo se una rinuncia tecnica libera risorse sufficienti.
      </div>
    </section>
  );
}

function OptimizationInvestmentDashboard({ rows }: { rows: OptimizationInvestmentRow[] }) {
  return (
    <section className="optimization-card">
      <div className="section-title compact">
        <BarChart3 size={16} />
        Dashboard dove investire
        <HelpTooltip>Ordina le aree del piano per punti stimati, costo e rendimento. I costi sono assunzioni di scenario, non dati di gara.</HelpTooltip>
      </div>
      {rows.length ? (
        <div className="investment-dashboard">
          {rows.slice(0, 5).map((row, index) => (
            <article key={row.key} className="investment-card">
              <div>
                <span>{index + 1}</span>
                <strong>{row.label}</strong>
              </div>
              <p>{row.focus || "Area tecnica del piano consigliato"}</p>
              <dl>
                <div>
                  <dt>Punti netti</dt>
                  <dd>{signedPoints(row.objectiveDelta)}</dd>
                </div>
                <div>
                  <dt>Costo / valore</dt>
                  <dd>{euroFormatter.format(row.cost)}</dd>
                </div>
                <div>
                  <dt>€/punto</dt>
                  <dd>{row.objectiveDelta > 0 ? euroFormatter.format(row.efficiency) : "n/d"}</dd>
                </div>
                <div>
                  <dt>Mosse</dt>
                  <dd>{row.moves}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state compact">Nessuna area di investimento positiva con gli input correnti.</div>
      )}
    </section>
  );
}

function OptimizationImpactMap({ rows, maxImpact }: { rows: OptimizationImpactRow[]; maxImpact: number }) {
  return (
    <section className="optimization-card">
      <div className="section-title compact">
        <LineChart size={16} />
        Mappa impatto per ambito
        <HelpTooltip>Mostra dove il piano aggiunge o sacrifica punti tecnici e dove converte valore in punti economici.</HelpTooltip>
      </div>
      {rows.length ? (
        <div className="impact-map">
          {rows.map((row) => {
            const width = Math.min(100, Math.max(4, (Math.abs(row.objectiveDelta) / maxImpact) * 100)) + "%";
            const style = { "--impact-width": width } as CSSProperties;
            const tone = row.objectiveDelta > 0 ? "positive" : row.objectiveDelta < 0 ? "negative" : "neutral";
            return (
              <article key={row.key} className={"impact-row " + tone}>
                <div>
                  <strong>{row.label}</strong>
                  <small>{formatMoveCount(row.moves)} - {euroFormatter.format(row.cost)}</small>
                </div>
                <div className="impact-bars" style={style}>
                  <span />
                </div>
                <dl>
                  <div>
                    <dt>Tecnica</dt>
                    <dd>{signedPoints(row.technicalDelta)}</dd>
                  </div>
                  <div>
                    <dt>Economica</dt>
                    <dd>{signedPoints(row.economicDelta)}</dd>
                  </div>
                  <div>
                    <dt>Saldo</dt>
                    <dd>{signedPoints(row.objectiveDelta)}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state compact">Nessun impatto per ambito con gli input correnti.</div>
      )}
    </section>
  );
}

function OptimizationPlanCard({
  result,
  grossPlanCost,
  reallocatedValue,
  unusedReleasedValue,
  netPlanCost,
  disabledByScope,
  onApplyPlan,
}: {
  result: OptimizationResult;
  grossPlanCost: number;
  reallocatedValue: number;
  unusedReleasedValue: number;
  netPlanCost: number;
  disabledByScope: boolean;
  onApplyPlan: () => void;
}) {
  return (
    <section className="optimization-card">
      <div className="section-title compact">
        <LineChart size={16} />
        Piano consigliato
        <HelpTooltip>Il motore valuta miglioramenti tecnici e riallocazioni tecnica-ribasso. Dopo ogni mossa ricalcola tutto lo scenario.</HelpTooltip>
      </div>
      <div className="optimization-summary-grid">
        <div>
          <span>Impegno lordo del piano</span>
          <strong>{euroFormatter.format(grossPlanCost)}</strong>
          <small>Somma dei costi tecnici aggiunti e del valore economico dei ribassi prima delle riallocazioni.</small>
        </div>
        <div>
          <span>Valore riallocato da tecnica</span>
          <strong>{euroFormatter.format(reallocatedValue)}</strong>
          <small>
            Quota liberata da rinunce tecniche e assorbita dal maggiore ribasso.
            {unusedReleasedValue > 0 ? " Quota liberata non assorbita dal ribasso: " + euroFormatter.format(unusedReleasedValue) + "." : ""}
          </small>
        </div>
        <div>
          <span>Costo netto stimato</span>
          <strong>{euroFormatter.format(netPlanCost)}</strong>
          <small>Impegno lordo meno quota riallocata; i punti tecnici ed economici sono dettagliati nelle mosse.</small>
        </div>
        <div>
          <span>Mosse</span>
          <strong>{result.steps.length}</strong>
        </div>
      </div>
      {result.areas.length ? (
        <div className="area-summary">
          {result.areas.map((area) => (
            <div key={area.key}>
              <span>{area.label}</span>
              <strong>{signedPoints(area.objectiveDelta)}</strong>
              <small>{euroFormatter.format(area.cost)}</small>
            </div>
          ))}
        </div>
      ) : null}
      {result.steps.length ? (
        <div className="optimization-plan-list">
          {result.steps.map((step, index) => (
            <article key={step.id} className="optimization-step">
              <span>{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
                {step.kind === "reallocation" ? (
                  <small>
                    Riduce {step.units.toLocaleString("it-IT", { maximumFractionDigits: 2 })} {step.unitLabel} dell'offerta tecnica, {formatReallocationSummary(step)}.
                    Delta punti: {signedPoints(step.technicalDelta ?? 0)} di offerta tecnica, {signedPoints(step.economicDelta ?? 0)} di offerta economica, saldo {signedPoints(step.objectiveDelta)}.
                  </small>
                ) : (
                  <small>
                    Aggiunge {step.units.toLocaleString("it-IT", { maximumFractionDigits: 2 })} {step.unitLabel} alla proposta tecnica, con costo stimato {euroFormatter.format(step.cost)}.
                    Delta punti: {signedPoints(step.technicalDelta ?? step.objectiveDelta)} di offerta tecnica, {signedPoints(step.economicDelta ?? 0)} di offerta economica, saldo {signedPoints(step.objectiveDelta)}.
                  </small>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state compact">Nessun piano positivo con gli input correnti.</div>
      )}
      {result.warnings.map((warning) => (
        <div key={warning} className="inline-warning">{warning}</div>
      ))}
      {disabledByScope && <div className="inline-warning">Attiva almeno un lotto coerente con l'obiettivo scelto.</div>}
      <button className="apply-plan" type="button" onClick={onApplyPlan} disabled={!result.steps.length || disabledByScope}>
        Applica piano ottimizzato
      </button>
    </section>
  );
}

function OptimizationLeverCatalog({
  bidder,
  config,
  targetLots,
  technicalCriteria,
  onLeverChange,
}: {
  bidder: Bidder;
  config: OptimizationConfig;
  targetLots: LotId[];
  technicalCriteria: Criterion[];
  onLeverChange: (lotId: LotId, criterionId: string, patch: Partial<OptimizationLeverInput>) => void;
}) {
  return (
    <section className="optimization-card">
      <div className="section-title compact">
        Catalogo leve tecniche
        <HelpTooltip>Costo unitario, quantità massima e base sono input di scenario. Il simulatore sceglie quante unità applicare fino al massimo indicato.</HelpTooltip>
      </div>
      <div className="optimization-hint">
        I criteri discrezionali D sono esclusi perché non hanno una formula deterministica costo-punteggio nel disciplinare.
      </div>
      {targetLots.map((lotId) => (
        <div key={lotId} className="lever-lot-section">
          <div className="lever-lot-title">
            <strong>{lotId}</strong>
            <span>{LOTS.find((lot) => lot.id === lotId)?.label}</span>
          </div>
          <div className="lever-table-wrap">
            <table className="lever-table">
              <thead>
                <tr>
                  <th>Leva</th>
                  <th>Usa</th>
                  <th>Costo unitario</th>
                  <th>Quantità max</th>
                  <th>Base</th>
                </tr>
              </thead>
              <tbody>
                {technicalCriteria.map((criterion) => {
                  const tradeoff = bidder.lots[lotId].tradeoffs[criterion.id] ?? defaultTradeoff();
                  const lever = getOptimizationLever(config, lotId, criterion, tradeoff);
                  const needsDenominator = criterion.kind === "Q" && (criterion.input === "ratio" || Boolean(criterion.quantityInput));
                  return (
                    <tr key={criterion.id}>
                      <td>
                        <strong>{criterion.id}</strong>
                        <small>{criterion.label}</small>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={"Usa leva " + criterion.id + " sul lotto " + lotId}
                          checked={lever.enabled}
                          onChange={(event) => onLeverChange(lotId, criterion.id, { enabled: event.target.checked })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          aria-label={"Costo unitario leva " + criterion.id + " sul lotto " + lotId}
                          min={0}
                          step={1000}
                          value={lever.unitCost}
                          onChange={(event) => onLeverChange(lotId, criterion.id, { unitCost: Math.max(0, Number(event.target.value) || 0) })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          aria-label={"Quantità massima leva " + criterion.id + " sul lotto " + lotId}
                          min={0}
                          step={criterion.kind === "T" ? 1 : 0.01}
                          value={lever.maxUnits}
                          disabled={criterion.kind === "T"}
                          onChange={(event) => onLeverChange(lotId, criterion.id, { maxUnits: Math.max(0, Number(event.target.value) || 0) })}
                        />
                      </td>
                      <td>
                        {needsDenominator ? (
                          <input
                            type="number"
                            aria-label={"Base leva " + criterion.id + " sul lotto " + lotId}
                            min={0}
                            step={1}
                            value={lever.denominator}
                            onChange={(event) => onLeverChange(lotId, criterion.id, { denominator: Math.max(0, Number(event.target.value) || 0) })}
                          />
                        ) : (
                          <span className="not-applicable">non previsto</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {!targetLots.length && <div className="empty-state compact">Nessun lotto attivo per il catalogo corrente.</div>}
    </section>
  );
}

function ComboWorkbench({
  bidder,
  selectedPairId,
  comboScore,
  onPairSelect,
  onEnabledChange,
  onDiscountModeChange,
  onPhaseChange,
  onAverageChange,
  onInsertedChange,
  onPefChange,
}: {
  bidder: Bidder;
  selectedPairId: PairId;
  comboScore: ComboScore;
  onPairSelect: (pairId: PairId) => void;
  onEnabledChange: (enabled: boolean) => void;
  onDiscountModeChange: (mode: DiscountInputMode) => void;
  onPhaseChange: (index: number, value: number) => void;
  onAverageChange: (value: number) => void;
  onInsertedChange: (checked: boolean) => void;
  onPefChange: (checked: boolean) => void;
}) {
  const combo = bidder.combos[selectedPairId];
  return (
    <div className="combo-workbench">
      <div className="pair-strip" aria-label="Coppie combinatorie">
        {PAIRS.map((pair) => (
            <button key={pair.id} className={`pair-button ${pair.id === selectedPairId ? "active" : ""}`} type="button" onClick={() => onPairSelect(pair.id)}>
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
          <strong>
            Combinatoria {selectedPairId.replace("L", "").replace("+L", "+")}
            <HelpTooltip>Attiva la coppia solo se i due lotti singoli sono presentati e la proposta è migliorativa rispetto alle singole.</HelpTooltip>
          </strong>
          <label className="switch">
              <input type="checkbox" aria-label={`Attiva combinatoria ${selectedPairId}`} checked={combo.enabled} onChange={(event) => onEnabledChange(event.target.checked)} />
            <span>attiva</span>
          </label>
        </div>
        <EconomicEditor
          title="Ribasso combinatorio"
          offer={combo}
          baseByPhase={pairBaseByPhase(selectedPairId)}
          ribasso={comboScore.ribasso}
          disabled={!combo.enabled}
          onModeChange={onDiscountModeChange}
          onPhaseChange={onPhaseChange}
          onAverageChange={onAverageChange}
        />
        <div className="combo-checks">
          <label className="toggle-row">
              <input type="checkbox" aria-label={`Combinatoria ${selectedPairId} inserita in entrambe le buste`} checked={combo.insertedInBothBuste} onChange={(event) => onInsertedChange(event.target.checked)} />
            <span>
              Inserita in entrambe le buste
              <HelpTooltip>Serve a simulare il controllo formale: la combinatoria deve risultare presente dove previsto dalla gara.</HelpTooltip>
            </span>
          </label>
          <label className="toggle-row">
              <input type="checkbox" aria-label={`PEF combinatorio ${selectedPairId} presente e coerente`} checked={combo.pefCoherent} onChange={(event) => onPefChange(event.target.checked)} />
            <span>
              PEF combinatorio presente e coerente
              <HelpTooltip>Usa questo flag solo se nello scenario assumi un PEF della coppia completo e coerente con i ribassi inseriti.</HelpTooltip>
            </span>
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

type DecisionRow = {
  lot: (typeof LOTS)[number];
  assignment?: AssignmentCandidate;
  score?: number;
  alternative?: AssignmentCandidate;
  margin?: number;
};

function ResultsWorkbench({
  result,
  selectedLotId,
  bidders,
}: {
  result: SimulationResult;
  selectedLotId: LotId;
  bidders: Bidder[];
}) {
  const scoreBidders = bidders.filter((bidder) => result.lotScores[bidder.id]?.[selectedLotId]?.participates);
  const qtMax = maxQtPoints();
  const technicalMax = AMBITS.reduce((sum, ambit) => sum + ambit.maxPoints, 0);
  const economicMax = 30;
  const totalMax = technicalMax + economicMax;
  const lotSummaries = buildScenarioLotSummaries(result.selectedScenario?.assignments ?? []);
  const assignedLotCount = lotSummaries.filter(({ score }) => typeof score === "number").length;
  const decisionRows: DecisionRow[] = LOTS.map((lot) => {
    const assignment = assignmentByLot(result, lot.id);
    const score = assignment ? candidateLotScore(assignment, lot.id) : undefined;
    const alternative = result.lotRankings[lot.id].find((candidate) => candidate.id !== assignment?.id);
    const alternativeScore = alternative ? candidateLotScore(alternative, lot.id) : undefined;
    return {
      lot,
      assignment,
      score,
      alternative,
      margin: typeof score === "number" && typeof alternativeScore === "number" ? round4(score - alternativeScore) : undefined,
    };
  });
  const closeLots = decisionRows.filter((row) => typeof row.margin === "number" && Math.abs(row.margin) <= 0.5);
  const decisionNextStep = result.selectedScenario?.unassignedLots.length
    ? "Prima verifica partecipazioni, soglia e combinatorie sui lotti non assegnati: " + result.selectedScenario.unassignedLots.join(", ") + "."
    : result.selectedScenario?.drawRequired
      ? "Scenario in ex aequo: serve trattare il sorteggio come rischio operativo esplicito."
      : result.warnings.length
        ? "Leggi i warning prima di usare lo scenario: possono cambiare ammissibilità o lettura documentale."
        : closeLots.length
          ? "Scarti sotto 0,50 pt su " + closeLots.map((row) => row.lot.shortLabel).join(", ") + ": utile stressare ribassi e criteri sensibili."
          : "Scenario completo e senza warning runtime: passa al confronto con scenari salvati o all'ottimizzazione mirata.";

  return (
    <div className="results-board">
      <ResultsMetrics lotSummaries={lotSummaries} assignedLotCount={assignedLotCount} result={result} />
      <DecisionReport rows={decisionRows} decisionNextStep={decisionNextStep} />
      <AssignmentAndRanking result={result} selectedLotId={selectedLotId} />
      <SubcriteriaScoreSection
        scoreBidders={scoreBidders}
        selectedLotId={selectedLotId}
        qtMax={qtMax}
        technicalMax={technicalMax}
        economicMax={economicMax}
        totalMax={totalMax}
        result={result}
      />
    </div>
  );
}

function ResultsMetrics({
  lotSummaries,
  assignedLotCount,
  result,
}: {
  lotSummaries: ReturnType<typeof buildScenarioLotSummaries>;
  assignedLotCount: number;
  result: SimulationResult;
}) {
  return (
    <div className="metric-grid">
      <div className="metric-tile lot-score-tile">
        <span>Punteggio migliore per lotto</span>
        <div className="summary-lot-score-grid compact" aria-label="Punteggio migliore per lotto nel tab risultati">
          {lotSummaries.map(({ lot, score }) => (
            <div key={lot.id}>
              <small>{lot.shortLabel}</small>
              <strong>{typeof score === "number" ? formatPoints(score) : "n/d"}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="metric-tile">
        <span>Lotti assegnati</span>
        <strong>{assignedLotCount} / {LOTS.length}</strong>
      </div>
      <div className={"metric-tile " + (result.selectedScenario?.unassignedLots.length ? "warn" : "ok")}>
        <span>Lotti non assegnati</span>
        <strong>{result.selectedScenario?.unassignedLots.join(", ") || "nessuno"}</strong>
      </div>
    </div>
  );
}

function DecisionReport({ rows, decisionNextStep }: { rows: DecisionRow[]; decisionNextStep: string }) {
  return (
    <section className="decision-report">
      <div className="section-title compact">
        Lettura decisionale
        <HelpTooltip>Riassume subito perché lo scenario è usabile: vincitore per lotto, margine rispetto al primo candidato alternativo e prossima verifica consigliata.</HelpTooltip>
      </div>
      <div className="decision-grid">
        {rows.map((row) => (
          <article key={row.lot.id} className={"decision-card " + (row.assignment ? "assigned" : "warn")}>
            <div>
              <span>{row.lot.shortLabel}</span>
              <strong>{row.assignment?.bidderName ?? "non assegnato"}</strong>
            </div>
            <dl>
              <div>
                <dt>Punteggio</dt>
                <dd>{typeof row.score === "number" ? formatPoints(row.score) : "n/d"}</dd>
              </div>
              <div>
                <dt>Scarto dal secondo</dt>
                <dd className={typeof row.margin === "number" && row.margin < 0 ? "negative" : ""}>
                  {typeof row.margin === "number" ? signedPoints(row.margin) : "n/d"}
                </dd>
              </div>
            </dl>
            <small>
              {row.assignment
                ? (row.assignment.kind === "combo" ? "combinatoria " + row.assignment.pairId : "offerta singola") + (row.alternative ? "; alternativa: " + row.alternative.bidderName : "")
                : "nessuna offerta ammessa nello scenario"}
            </small>
          </article>
        ))}
      </div>
      <div className="decision-next-step">
        <strong>Prossima verifica</strong>
        <span>{decisionNextStep}</span>
      </div>
    </section>
  );
}

function AssignmentAndRanking({ result, selectedLotId }: { result: SimulationResult; selectedLotId: LotId }) {
  return (
    <div className="results-grid">
      <section>
        <div className="section-title compact">
          Assegnazioni scenario
          <HelpTooltip>Mostra il miglior scenario calcolato: controlla sempre lotti non assegnati e warning prima di usarlo.</HelpTooltip>
        </div>
        <div className="assignment-list">
          {result.selectedScenario?.assignments.map((assignment) => (
            <div key={assignment.id} className="assignment-row">
              <span>{assignment.lotIds.join(" + ")}</span>
              <strong>{assignment.bidderName}</strong>
              <small>{assignment.kind === "combo" ? "combinatoria" : "singola"} - {formatAssignmentLotScores(assignment)}</small>
            </div>
          ))}
          {!result.selectedScenario?.assignments.length && <div className="empty-state compact">Nessuna assegnazione ammissibile.</div>}
        </div>
      </section>

      <section>
        <div className="section-title compact">
          Classifica {selectedLotId}
          <HelpTooltip>Ordina i candidati ammessi per il lotto selezionato; le combinatorie possono comparire accanto alle offerte singole.</HelpTooltip>
        </div>
        <div className="ranking-list">
          {result.lotRankings[selectedLotId].slice(0, 8).map((candidate, index) => (
            <div key={candidate.id} className="ranking-row">
              <span>{index + 1}</span>
              <div>
                <strong>{candidate.bidderName}</strong>
                <small>{candidate.kind === "combo" ? candidate.pairId : "Offerta singola"}</small>
              </div>
              <b>{formatPoints(candidateLotScore(candidate, selectedLotId))}</b>
            </div>
          ))}
          {!result.lotRankings[selectedLotId].length && <div className="empty-state compact">Nessuna offerta ammessa sul lotto.</div>}
        </div>
      </section>
    </div>
  );
}

const subcriteriaBidderLayout = (count: number) => {
  if (count <= 2) return "few";
  if (count >= 5) return "many";
  return "medium";
};

function SubcriteriaScoreSection({
  scoreBidders,
  selectedLotId,
  qtMax,
  technicalMax,
  economicMax,
  totalMax,
  result,
}: {
  scoreBidders: Bidder[];
  selectedLotId: LotId;
  qtMax: number;
  technicalMax: number;
  economicMax: number;
  totalMax: number;
  result: SimulationResult;
}) {
  const bidderCount = scoreBidders.length;
  const layout = subcriteriaBidderLayout(bidderCount);

  return (
    <section
      className={"subcriteria-score-section layout-" + layout}
      data-bidder-count={bidderCount}
      style={{ "--score-bidder-count": bidderCount } as CSSProperties}
    >
      <div className="subcriteria-score-heading">
        <div className="section-title compact">
          Punteggi sotto criterio — {selectedLotId}
          <HelpTooltip>Confronto dei punti grezzi per sotto-criterio sul lotto selezionato. Le righe di ambito riportano anche il tecnico riparametrato.</HelpTooltip>
        </div>
        {bidderCount > 0 ? (
          <p className="subcriteria-score-meta">
            {bidderCount === 1
              ? "1 concorrente partecipa al lotto."
              : `${bidderCount} concorrenti partecipano al lotto: colonne allineate per confronto rapido.`}
            {layout === "many" ? " Scorri in orizzontale se i nomi sono lunghi." : null}
          </p>
        ) : null}
      </div>
      <div className="subcriteria-table-wrap">
        {bidderCount ? (
          <table className="subcriteria-score-table">
            <thead>
              <tr>
                <th scope="col">Criterio</th>
                <th scope="col">Max</th>
                {scoreBidders.map((bidder) => (
                  <th key={bidder.id} scope="col" title={bidder.name}>
                    <span className="subcriteria-bidder-name">{bidder.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AMBITS.map((ambit) => {
                const ambitCriteria = CRITERIA.filter((criterion) => criterion.ambit === ambit.id);
                return (
                  <Fragment key={ambit.id}>
                    <tr className="subcriteria-ambit-row">
                      <th>
                        <span>{ambit.id}</span>
                        <strong>{ambit.label}</strong>
                      </th>
                      <td>{formatPoints(ambit.maxPoints)}</td>
                      {scoreBidders.map((bidder) => {
                        const lotScore = result.lotScores[bidder.id]?.[selectedLotId];
                        return (
                          <td key={bidder.id}>
                            <strong>{formatPoints(lotScore?.riparamByAmbit[ambit.id] ?? 0)}</strong>
                            <small>grezzo {formatPoints(lotScore?.rawByAmbit[ambit.id] ?? 0)}</small>
                          </td>
                        );
                      })}
                    </tr>
                    {ambitCriteria.map((criterion) => (
                      <tr key={criterion.id}>
                        <th>
                          <span>{criterion.id}</span>
                          <strong>{criterion.label}</strong>
                        </th>
                        <td>{formatPoints(criterion.maxPoints)}</td>
                        {scoreBidders.map((bidder) => {
                          const subScore = result.lotScores[bidder.id]?.[selectedLotId]?.subScores[criterion.id];
                          const lotOffer = bidder.lots[selectedLotId];
                          return (
                            <td key={bidder.id} className={subScore?.dependencyBlocked ? "warn-cell" : ""}>
                              <strong>{formatPoints(subScore?.rawScore ?? 0)}</strong>
                              {subScore ? <small>{formatCriterionRowValue(criterion, subScore.value, lotOffer.quantityInputs?.[criterion.id])}</small> : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th>Punteggio soglia di sbarramento</th>
                <td>{formatPoints(qtMax)}</td>
                {scoreBidders.map((bidder) => {
                  const lotScore = result.lotScores[bidder.id]?.[selectedLotId];
                  return <td key={bidder.id}>{formatPoints(lotScore?.qtRaw ?? 0)}</td>;
                })}
              </tr>
              <tr>
                <th>Totale tecnico riparametrato</th>
                <td>{formatPoints(technicalMax)}</td>
                {scoreBidders.map((bidder) => {
                  const lotScore = result.lotScores[bidder.id]?.[selectedLotId];
                  return <td key={bidder.id}>{formatPoints(lotScore?.technical ?? 0)}</td>;
                })}
              </tr>
              <tr>
                <th>Offerta economica</th>
                <td>{formatPoints(economicMax)}</td>
                {scoreBidders.map((bidder) => {
                  const lotScore = result.lotScores[bidder.id]?.[selectedLotId];
                  return (
                    <td key={bidder.id}>
                      <strong>{formatPoints(lotScore?.singleEconomic ?? 0)}</strong>
                      <small>R medio {formatPercent(lotScore?.singleRibasso ?? 0)}</small>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <th>Totale offerta singola</th>
                <td>{formatPoints(totalMax)}</td>
                {scoreBidders.map((bidder) => {
                  const lotScore = result.lotScores[bidder.id]?.[selectedLotId];
                  return <td key={bidder.id}>{formatPoints(lotScore?.singleTotal ?? 0)}</td>;
                })}
              </tr>
            </tfoot>
          </table>
        ) : (
          <div className="empty-state compact">Nessun concorrente partecipa al lotto selezionato.</div>
        )}
      </div>
    </section>
  );
}

function EconomicEditor({
  title,
  offer,
  baseByPhase,
  ribasso,
  disabled,
  onModeChange,
  onPhaseChange,
  onAverageChange,
}: {
  title: string;
  offer: EconomicDiscountSource;
  baseByPhase: [number, number, number];
  ribasso: number;
  disabled?: boolean;
  onModeChange: (mode: DiscountInputMode) => void;
  onPhaseChange: (index: number, value: number) => void;
  onAverageChange: (value: number) => void;
}) {
  const mode = offer.discountInputMode ?? "phases";
  const averageInput = clampDiscountPercent(offer.averageDiscount ?? resolvePhaseDiscounts(offer)[0] ?? 0);

  return (
    <div className={`economic-editor ${disabled ? "disabled" : ""}`}>
      <div className="economic-title">
        <strong>
          {title}
          <HelpTooltip>
            Scegli se inserire tre ribassi per fase oppure un ribasso medio unico: in entrambi i casi il simulatore calcola il
            ribasso medio ponderato sulle basi economiche dei periodi.
          </HelpTooltip>
        </strong>
        <span>R medio {formatPercent(ribasso)}</span>
      </div>
      <div className="discount-mode-toggle" role="group" aria-label="Modalità inserimento ribasso">
        <button
          type="button"
          className={mode === "phases" ? "active" : ""}
          aria-pressed={mode === "phases"}
          disabled={disabled}
          onClick={() => onModeChange("phases")}
        >
          Per fase
        </button>
        <button
          type="button"
          className={mode === "average" ? "active" : ""}
          aria-pressed={mode === "average"}
          disabled={disabled}
          onClick={() => onModeChange("average")}
        >
          Ribasso medio
        </button>
      </div>
      {mode === "average" ? (
        <label className="field compact average-discount-field">
          <span>Ribasso medio (%)</span>
          <input
            type="number"
            aria-label={`${title}, ribasso medio`}
            min={0}
            max={100}
            step={0.01}
            value={averageInput}
            disabled={disabled}
            onChange={(event) => onAverageChange(Number(event.target.value))}
          />
          <small>
            Le tre fasi usano lo stesso valore. Il ribasso medio ponderato coincide con l&apos;input quando le basi sono
            uniformi; altrimenti segue le basi di fase.
          </small>
        </label>
      ) : (
        <div className="phase-grid">
          {ECONOMIC_PHASES.map((phase, index) => (
            <label className="field compact" key={phase.id}>
              <span>{phase.label}</span>
              <input
                type="number"
                aria-label={`${title}, ${phase.label}`}
                min={0}
                max={100}
                step={0.01}
                value={offer.phaseDiscounts[index]}
                disabled={disabled}
                onChange={(event) => onPhaseChange(index, Number(event.target.value))}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
