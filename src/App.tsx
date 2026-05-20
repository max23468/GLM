import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  LineChart,
  type LucideIcon,
  Monitor,
  Moon,
  Sparkles,
  Plus,
  Route,
  SlidersHorizontal,
  Sun,
  Trophy,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
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
import { BASE_SCENARIOS, DEFAULT_SETTINGS, getBaseScenario, type BaseScenario, type BaseScenarioId } from "./data/base-scenarios";
import {
  computeQuantityInputValue,
  createBidder,
  criteriaByParent,
  economicBreakdown,
  formatPercent,
  formatPoints,
  candidateLotScore,
  getQuantitativeCriterionValue,
  maxQtPoints,
  pairBaseByPhase,
  round4,
  simulate,
  type AssignmentCandidate,
  type Bidder,
  type ComboScore,
  type LotScore,
  type LotOffer,
  type QuantityInputValue,
  type Settings,
  type SimulationResult,
  type Suggestion,
  type TradeoffPlan,
} from "./lib/scoring";
import {
  ScenarioComparison,
  ScenarioTools,
  StrategicSummary,
} from "./components/scenario-panels";
import { InstructionsPage } from "./components/instructions-page";
import { HelpTooltip } from "./components/help-tooltip";
import { ReleasePanel } from "./components/release-panel";
import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
  normalizeScenarioSnapshot,
  readStoredSavedScenarios,
  readStoredWorkspace,
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

const getStoredTheme = (): ThemePreference => {
  if (typeof window === "undefined") return "auto";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.theme) ?? window.localStorage.getItem(LEGACY_STORAGE_KEYS.theme);
    return stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
  } catch {
    return "auto";
  }
};

const getStoredHiddenBaseScenarios = (): BaseScenarioId[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.hiddenBaseScenarios) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is BaseScenarioId =>
      typeof value === "string" && BASE_SCENARIOS.some((scenario) => scenario.id === value),
    );
  } catch {
    return [];
  }
};

const currentView = (): AppView => {
  if (typeof window === "undefined") return "simulatore";
  return window.location.pathname === "/istruzioni" || window.location.pathname === "/istruzioni/" ? "istruzioni" : "simulatore";
};

const makeDownloadName = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "scenario"}-${new Date().toISOString().slice(0, 10)}.json`;

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

    const ambit = AMBITS.find((item) => item.id === step.ambit);
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
      const sourceAmbit = AMBITS.find((item) => item.id === step.ambit);
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

    const ambit = AMBITS.find((item) => item.id === step.ambit);
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

const formatAssignmentLotScores = (assignment: AssignmentCandidate) =>
  assignment.lotIds.map((lotId) => `${lotId} ${formatPoints(candidateLotScore(assignment, lotId))}`).join(" · ");

const criterionStatus = (criterion: Criterion, score: number, note?: string) => {
  if (note) return { label: "Verifica", tone: "warn" };
  if (criterion.maxPoints <= 0) return { label: "n/d", tone: "muted" };
  if (score <= 0) return { label: "Scoperto", tone: "weak" };
  if (score >= criterion.maxPoints * 0.9) return { label: "Forte", tone: "ok" };
  return { label: "Parziale", tone: "mid" };
};

function App() {
  const [initialWorkspace] = useState(() => readStoredWorkspace());
  const initialBaseScenario = getBaseScenario(initialWorkspace?.baseScenarioId);
  const [view, setView] = useState<AppView>(currentView);
  const [baseScenarioId, setBaseScenarioId] = useState<BaseScenarioId>(initialBaseScenario.id);
  const [bidders, setBidders] = useState<Bidder[]>(() => initialWorkspace?.bidders ?? initialBaseScenario.buildBidders());
  const [selectedBidderId, setSelectedBidderId] = useState(initialWorkspace?.selectedBidderId ?? initialBaseScenario.defaultBidderId);
  const [selectedLotId, setSelectedLotId] = useState<LotId>(initialWorkspace?.selectedLotId ?? initialBaseScenario.defaultLotId);
  const [selectedPairId, setSelectedPairId] = useState<PairId>(initialWorkspace?.selectedPairId ?? initialBaseScenario.defaultPairId);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("tecnica");
  const [selectedAmbitId, setSelectedAmbitId] = useState(AMBITS[0].id);
  const [selectedCriterionId, setSelectedCriterionId] = useState(CRITERIA[0].id);
  const [settings, setSettings] = useState<Settings>(initialWorkspace?.settings ?? DEFAULT_SETTINGS);
  const [optimizationConfig, setOptimizationConfig] = useState<OptimizationConfig>(() => initialWorkspace?.optimization ?? initialBaseScenario.buildOptimizationConfig());
  const [scenarioName, setScenarioName] = useState(initialWorkspace?.scenarioName ?? initialBaseScenario.title);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenarioSnapshot[]>(readStoredSavedScenarios);
  const [activeSavedScenarioId, setActiveSavedScenarioId] = useState<string | undefined>(initialWorkspace?.activeSavedScenarioId);
  const [hiddenBaseScenarioIds, setHiddenBaseScenarioIds] = useState<BaseScenarioId[]>(getStoredHiddenBaseScenarios);
  const [compareScenarioId, setCompareScenarioId] = useState("");
  const [scenarioNotice, setScenarioNotice] = useState("");
  const [isSuggestionsPanelExpanded, setSuggestionsPanelExpanded] = useState(false);
  const [isWarningsPanelExpanded, setWarningsPanelExpanded] = useState(false);
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
        schemaVersion: 7,
        scenarioName,
        activeSavedScenarioId,
        baseScenarioId,
        bidders,
        optimization: optimizationConfig,
        settings,
        selectedBidderId,
        selectedLotId,
        selectedPairId,
      } satisfies StoredWorkspace),
    );
  }, [activeSavedScenarioId, bidders, baseScenarioId, optimizationConfig, scenarioName, selectedBidderId, selectedLotId, selectedPairId, settings]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.scenarios, JSON.stringify(savedScenarios));
  }, [savedScenarios]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.hiddenBaseScenarios, JSON.stringify(hiddenBaseScenarioIds));
  }, [hiddenBaseScenarioIds]);

  const selectedBidder = bidders.find((bidder) => bidder.id === selectedBidderId) ?? bidders[0];
  const selectedLot = LOTS.find((lot) => lot.id === selectedLotId) ?? LOTS[0];
  const selectedLotContext = LOT_CONTEXT[selectedLotId];
  const selectedBaseScenario = BASE_SCENARIOS.find((scenario) => scenario.id === baseScenarioId) ?? BASE_SCENARIOS[0];
  const visibleBaseScenarios = useMemo(
    () => BASE_SCENARIOS.filter((scenario) => !hiddenBaseScenarioIds.includes(scenario.id)),
    [hiddenBaseScenarioIds],
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
    applyTradeoffPlanToOffer(nextOffer, criterion, plan);

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

  const focusWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (selectedLotScore?.warnings.length) {
      warnings.push(...selectedLotScore.warnings.map((warning) => `${selectedBidder?.name ?? "Concorrente"} ${selectedLotId}: ${warning}`));
    }
    if (activeTab === "combinatorie" && selectedComboScore?.warnings.length) {
      warnings.push(...selectedComboScore.warnings.map((warning) => `${selectedBidder?.name ?? "Concorrente"} ${selectedPairId}: ${warning}`));
    }
    if (selectedBidder) {
      warnings.push(...result.warnings.filter((warning) => warning.includes(selectedBidder.name) || warning.includes(selectedLotId)).slice(0, 3));
    }
    return [...new Set(warnings)].slice(0, 5);
  }, [activeTab, result.warnings, selectedBidder, selectedComboScore, selectedLotId, selectedLotScore, selectedPairId]);

  const focusSuggestions = useMemo(() => {
    const direct = result.suggestions.filter((suggestion) => {
      if (!selectedBidder || suggestion.bidderId !== selectedBidder.id) return false;
      if (suggestion.lotId && suggestion.lotId !== selectedLotId) return false;
      if (suggestion.pairId && suggestion.pairId !== selectedPairId) return false;
      return true;
    });
    return (direct.length ? direct : result.suggestions).slice(0, 3);
  }, [result.suggestions, selectedBidder, selectedLotId, selectedPairId]);

  const rankedSuggestions = useMemo(
    () =>
      result.suggestions
        .map((suggestion, index) => ({ suggestion, index }))
        .sort((left, right) => {
          const effortDelta = suggestionEffortRank[left.suggestion.effort] - suggestionEffortRank[right.suggestion.effort];
          return effortDelta || left.index - right.index;
        })
        .map(({ suggestion }) => suggestion),
    [result.suggestions],
  );

  const updateBidder = (bidderId: string, updater: (bidder: Bidder) => Bidder) => {
    setBidders((current) => current.map((bidder) => (bidder.id === bidderId ? updater(structuredClone(bidder)) : bidder)));
  };

  const loadBaseScenario = (scenario: BaseScenario) => {
    setBaseScenarioId(scenario.id);
    setScenarioName(scenario.title);
    setActiveSavedScenarioId(undefined);
    setBidders(scenario.buildBidders());
    setOptimizationConfig(scenario.buildOptimizationConfig());
    setSettings(scenario.settings);
    setSelectedBidderId(scenario.defaultBidderId);
    setSelectedLotId(scenario.defaultLotId);
    setSelectedPairId(scenario.defaultPairId);
  };

  const deleteBaseScenario = (scenario: BaseScenario) => {
    setHiddenBaseScenarioIds((current) => (current.includes(scenario.id) ? current : [...current, scenario.id]));
    setScenarioNotice(
      scenario.id === baseScenarioId
        ? `Scenario base eliminato dalla lista: ${scenario.title}. Lo scenario corrente resta in lavoro.`
        : `Scenario base eliminato dalla lista: ${scenario.title}.`,
    );
  };

  const restoreBaseScenarios = () => {
    setHiddenBaseScenarioIds([]);
    setScenarioNotice("Scenari base ripristinati nella barra laterale.");
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
        offer.phaseDiscounts = offer.phaseDiscounts.map((discount) => Math.max(0, discount - reductionPoints)) as [number, number, number];
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

  const removeBidder = (bidderId: string) => {
    if (bidders.length <= 1) return;
    const nextBidders = bidders.filter((bidder) => bidder.id !== bidderId);
    setBidders(nextBidders);
    if (selectedBidderId === bidderId) setSelectedBidderId(nextBidders[0].id);
  };

  const currentScenarioSnapshot = (id = activeSavedScenarioId ?? `scenario-${Date.now()}`, name = scenarioName): SavedScenarioSnapshot => ({
    schemaVersion: 7,
    id,
    name: name.trim() || "Scenario senza nome",
    savedAt: new Date().toISOString(),
    baseScenarioId,
    bidders: structuredClone(bidders),
    optimization: structuredClone(optimizationConfig),
    settings: { ...settings },
    selectedBidderId: selectedBidder?.id ?? bidders[0]?.id ?? "",
    selectedLotId,
    selectedPairId,
  });

  const applyScenarioSnapshot = (scenario: SavedScenarioSnapshot) => {
    const nextBidders = structuredClone(scenario.bidders);
    setScenarioName(scenario.name);
    setActiveSavedScenarioId(scenario.id);
    setBaseScenarioId(scenario.baseScenarioId);
    setBidders(nextBidders);
    setOptimizationConfig(scenario.optimization);
    setSettings(scenario.settings);
    setSelectedBidderId(nextBidders.some((bidder) => bidder.id === scenario.selectedBidderId) ? scenario.selectedBidderId : nextBidders[0]?.id ?? "");
    setSelectedLotId(scenario.selectedLotId);
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

  const importScenarioFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const snapshot = normalizeScenarioSnapshot(parsed);
      if (!snapshot) {
        setScenarioNotice("File JSON non riconosciuto.");
        return;
      }
      const imported = { ...snapshot, id: snapshot.id || `scenario-${Date.now()}`, savedAt: new Date().toISOString() };
      setSavedScenarios((current) => [imported, ...current.filter((scenario) => scenario.id !== imported.id)]);
      applyScenarioSnapshot(imported);
      setScenarioNotice(`Importato: ${imported.name}`);
    } catch {
      setScenarioNotice("Import non riuscito: controlla il file JSON.");
    }
  };

  const loadSavedScenario = (scenarioId: string) => {
    if (!scenarioId) return;
    const scenario = savedScenarios.find((item) => item.id === scenarioId);
    if (scenario) applyScenarioSnapshot(scenario);
  };

  const resetCurrentBaseScenario = () => {
    loadBaseScenario(selectedBaseScenario);
    setScenarioNotice(`Scenario base ripristinato: ${selectedBaseScenario.title}`);
  };

  const renameCurrentScenario = (name: string) => {
    setScenarioName(name);
    if (!activeSavedScenarioId) return;
    setSavedScenarios((current) =>
      current.map((scenario) => (scenario.id === activeSavedScenarioId ? { ...scenario, name: name.trim() || "Scenario senza nome" } : scenario)),
    );
  };

  const createNewScenario = () => {
    const nextBidders = selectedBaseScenario.buildBidders();
    setScenarioName("Nuovo scenario");
    setActiveSavedScenarioId(undefined);
    setBidders(nextBidders);
    setOptimizationConfig(selectedBaseScenario.buildOptimizationConfig());
    setSettings(selectedBaseScenario.settings);
    setSelectedBidderId(nextBidders.some((bidder) => bidder.id === selectedBaseScenario.defaultBidderId) ? selectedBaseScenario.defaultBidderId : nextBidders[0]?.id ?? "");
    setSelectedLotId(selectedBaseScenario.defaultLotId);
    setSelectedPairId(selectedBaseScenario.defaultPairId);
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

  if (view === "istruzioni") {
    return <InstructionsPage onBack={navigateToSimulator} />;
  }

  return (
    <div className="app-shell">
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
          <a
            className="doc-link"
            href="/istruzioni/"
            onClick={(event) => {
              event.preventDefault();
              navigateToInstructions();
            }}
          >
            <BookOpen size={16} />
            Istruzioni
          </a>
        </div>
      </header>

      <div className="layout">
        <aside className="left-rail">
          <ScenarioTools
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
            onImportFile={importScenarioFile}
            onLoadSaved={loadSavedScenario}
            onResetBaseScenario={resetCurrentBaseScenario}
          />

          <section className="panel base-panel">
            <div className="section-title">
              <ClipboardList size={18} />
              Scenari base
              <HelpTooltip>Parti da uno scenario precompilato solo come base di lavoro: non rappresenta un'offerta ufficiale.</HelpTooltip>
            </div>
            <div className="base-list">
              {visibleBaseScenarios.map((scenario) => (
                <div key={scenario.id} className={`sidebar-row-actions base-scenario-row ${scenario.id === baseScenarioId ? "selected" : ""}`}>
                  <button
                    className="saved-scenario-main base-scenario-main"
                    onClick={() => loadBaseScenario(scenario)}
                  >
                    <span>{scenario.title}</span>
                    <small>{scenario.body}</small>
                  </button>
                  <button
                    className="icon-button mini danger"
                    onClick={() => deleteBaseScenario(scenario)}
                    aria-label={`Elimina scenario base ${scenario.title}`}
                    title="Elimina scenario base"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {!visibleBaseScenarios.length && <div className="empty-sidebar-note">Tutti gli scenari base sono stati eliminati dalla lista.</div>}
            </div>
            {hiddenBaseScenarioIds.length > 0 && (
              <button className="action-button compact" onClick={restoreBaseScenarios}>
                Ripristina scenari base
              </button>
            )}
            <div className="hint">Profili simulati da fonti pubbliche e modelli locali: servono per confrontare scenari, non rappresentano offerte ufficiali.</div>
          </section>

          <section className="panel">
            <div className="section-title between">
              <span>
                <Route size={18} />
                Concorrenti
                <HelpTooltip>Da qui aggiungi, rinomini, selezioni o elimini i concorrenti. La compilazione centrale lavora sempre sul concorrente attivo.</HelpTooltip>
              </span>
              <button className="icon-button primary" onClick={addBidder} aria-label="Aggiungi concorrente" title="Aggiungi concorrente">
                <Plus size={17} />
              </button>
            </div>
            {selectedBidder && (
              <div className="sidebar-admin-block">
                <label className="field compact">
                  <span>
                    Nome concorrente
                    <HelpTooltip>Il nome serve a rendere leggibili classifica, confronto ed export. Non incide sui punteggi.</HelpTooltip>
                  </span>
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
            )}
            <div className="offeror-list">
              {bidders.map((bidder) => {
                const activeLots = LOTS.filter((lot) => bidder.lots[lot.id].enabled).length;
                const isSelected = bidder.id === selectedBidder?.id;
                return (
                  <div key={bidder.id} className={`sidebar-row-actions ${isSelected ? "selected" : ""}`}>
                    <button className="offeror-row" onClick={() => setSelectedBidderId(bidder.id)}>
                      <span>{bidder.name}</span>
                      <small>
                        {activeLots} {activeLots === 1 ? "lotto" : "lotti"}
                      </small>
                    </button>
                    <button
                      className="icon-button mini danger"
                      disabled={bidders.length <= 1}
                      onClick={() => removeBidder(bidder.id)}
                      aria-label={`Elimina concorrente ${bidder.name}`}
                      title="Elimina concorrente"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {selectedBidder && (
            <section className="panel">
              <div className="section-title">
                <BarChart3 size={18} />
                Partecipazione
                <HelpTooltip>Attiva lotti e combinatorie del concorrente selezionato. Queste opzioni si gestiscono solo dalla barra laterale.</HelpTooltip>
              </div>
              <div className="sidebar-participation-grid" aria-label={`Partecipazione ${selectedBidder.name}`}>
                {LOTS.map((lot) => {
                  const lotScore = result.lotScores[selectedBidder.id][lot.id];
                  return (
                    <label key={lot.id} className={selectedBidder.lots[lot.id].enabled ? lotScore.admitted ? "ok" : "warn" : ""}>
                      <span>{lot.shortLabel}</span>
                      <input
                        type="checkbox"
                        checked={selectedBidder.lots[lot.id].enabled}
                        onChange={(event) =>
                          updateBidder(selectedBidder.id, (draft) => {
                            draft.lots[lot.id].enabled = event.target.checked;
                            return draft;
                          })
                        }
                      />
                    </label>
                  );
                })}
              </div>
              <div className="section-title compact">Combinatorie presentate</div>
              <div className="sidebar-participation-grid two" aria-label={`Combinatorie ${selectedBidder.name}`}>
                {PAIRS.map((pair) => {
                  const comboScore = result.comboScores[selectedBidder.id][pair.id];
                  return (
                    <label key={pair.id} className={selectedBidder.combos[pair.id].enabled ? comboScore.admissible ? "ok" : "warn" : ""}>
                      <span>{pair.label.replace("Lotti ", "")}</span>
                      <input
                        type="checkbox"
                        checked={selectedBidder.combos[pair.id].enabled}
                        onChange={(event) =>
                          updateBidder(selectedBidder.id, (draft) => {
                            draft.combos[pair.id].enabled = event.target.checked;
                            return draft;
                          })
                        }
                      />
                    </label>
                  );
                })}
              </div>
              <div className="hint">Per una combinatoria servono anche i due lotti singoli collegati.</div>
            </section>
          )}

          <section className="panel">
            <div className="section-title">
              <SlidersHorizontal size={18} />
              Parametri
              <HelpTooltip>Qui scegli la soglia di sbarramento e l'eventuale deroga: cambia questi parametri quando vuoi testare una lettura più o meno selettiva.</HelpTooltip>
            </div>
            <div className="active-scenario">
              <span>Scenario attivo</span>
              <strong>{selectedBaseScenario.title}</strong>
              <ul className="scenario-basis" aria-label="Base scenario">
                {selectedBaseScenario.basis.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <label className="field">
              <span>
                Soglia di sbarramento
                <HelpTooltip>Un'offerta sotto soglia non passa alla valutazione economica. Le tre opzioni corrispondono alle letture già richiamate nelle istruzioni.</HelpTooltip>
              </span>
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
            <div className="hint">Soglia attiva: scenario disciplinare se resta a 37 pt. Le letture alternative più selettive restano nel menu. Le incongruenze sono nel pannello criticità.</div>
          </section>
        </aside>

        <main className="workspace">
          {selectedBidder && (
            <>
              <StrategicSummary
                scenarioName={scenarioName}
                selectedBidderName={selectedBidder.name}
                selectedLotLabel={selectedLotLabel}
                result={result}
                selectedLotAdmitted={selectedLotScore?.admitted}
                activeSectionLabel={activeTabLabel}
                onOpenResults={() => setActiveTab("risultati")}
              />

              <section className="panel workbench-panel">
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
                      className={`status-badge threshold-status ${selectedLotScore.admitted ? "ok" : "fail"}`}
                      aria-label={`Soglia di sbarramento ${selectedLotScore.admitted ? "superata" : "non superata"}`}
                      title={`Soglia di sbarramento ${selectedLotScore.admitted ? "superata" : "non superata"}`}
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
                  <div className="lot-switcher-buttons" role="group" aria-label="Seleziona lotto">
                    {LOTS.map((lot) => (
                      <button
                        key={lot.id}
                        type="button"
                        className={selectedLotId === lot.id ? "active" : ""}
                        onClick={() => setSelectedLotId(lot.id)}
                        aria-pressed={selectedLotId === lot.id}
                      >
                        {lot.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>

                <ContextualActionPanel
                  warnings={focusWarnings}
                  suggestions={focusSuggestions}
                  selectedBidderName={selectedBidder.name}
                  selectedLotLabel={selectedLotLabel}
                />

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

                {!selectedBidder.lots[selectedLotId].enabled && activeTab !== "ottimizza" && activeTab !== "combinatorie" && activeTab !== "risultati" ? (
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
                        bidder={selectedBidder}
                        selectedLotId={selectedLotId}
                        selectedPairId={selectedPairId}
                        lotScore={selectedLotScore}
                        comboScore={selectedComboScore}
                        rMax={result.rMaxByLot[selectedLotId]}
                        discounts={selectedBidder.lots[selectedLotId].phaseDiscounts}
                        lotOffer={selectedBidder.lots[selectedLotId]}
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

                    {activeTab === "ottimizza" && (
                      <OptimizationWorkbench
                        bidder={selectedBidder}
                        selectedLotId={selectedLotId}
                        config={optimizationConfig}
                        result={optimizationResult}
                        onConfigChange={updateOptimizationConfig}
                        onLeverChange={updateOptimizationLever}
                        onApplyPlan={applyOptimizationPlan}
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

                    {activeTab === "risultati" && <ResultsWorkbench result={result} selectedLotId={selectedLotId} bidders={bidders} />}
                  </>
                )}
              </section>
            </>
          )}
        </main>

        <aside className="right-panel">
          <section className={`panel insight-panel ${isSuggestionsPanelExpanded ? "expanded" : ""}`}>
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

          <section className={`panel insight-panel ${isWarningsPanelExpanded ? "expanded" : ""}`}>
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
      </div>
    </div>
  );
}

function ContextualActionPanel({
  warnings,
  suggestions,
  selectedBidderName,
  selectedLotLabel,
}: {
  warnings: string[];
  suggestions: Suggestion[];
  selectedBidderName: string;
  selectedLotLabel: string;
}) {
  return (
    <section className={`contextual-panel ${warnings.length ? "has-warnings" : "clear"}`} aria-label="Azioni e avvisi sul focus corrente">
      <div className="contextual-head">
        <div>
          <span>Focus operativo</span>
          <strong>
            {selectedBidderName} su {selectedLotLabel}
          </strong>
        </div>
        <div className={`status-badge ${warnings.length ? "warn" : "ok"}`}>
          {warnings.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {warnings.length ? `${warnings.length} verifiche` : "nessun blocco"}
        </div>
      </div>
      <div className="contextual-grid">
        <div className="contextual-column">
          <span className="contextual-label">Avvisi contestuali</span>
          {warnings.length ? (
            <div className="inline-warning-list">
              {warnings.map((warning) => (
                <div key={warning} className="inline-warning-item">
                  {warning}
                </div>
              ))}
            </div>
          ) : (
            <div className="inline-ok">Nessun warning prioritario sul focus corrente.</div>
          )}
        </div>
        <div className="contextual-column">
          <span className="contextual-label">Prossime leve</span>
          {suggestions.length ? (
            <div className="inline-suggestion-list">
              {suggestions.map((suggestion) => (
                <article key={`${suggestion.title}-${suggestion.body}`} className="inline-suggestion">
                  <strong>{suggestion.title}</strong>
                  <span>
                    {formatPoints(suggestion.impact)} pt, sforzo {suggestion.effort}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className="inline-ok">Nessun suggerimento calcolato per lo scenario corrente.</div>
          )}
        </div>
      </div>
    </section>
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
  bidder,
  selectedLotId,
  selectedPairId,
  lotScore,
  comboScore,
  rMax,
  discounts,
  lotOffer,
  disabled,
  onChange,
}: {
  bidder: Bidder;
  selectedLotId: LotId;
  selectedPairId: PairId;
  lotScore: LotScore;
  comboScore?: ComboScore;
  rMax: number;
  discounts: [number, number, number];
  lotOffer: LotOffer;
  disabled?: boolean;
  onChange: (index: number, value: number) => void;
}) {
  const [targetEconomic, setTargetEconomic] = useState(30);
  const selectedLot = LOTS.find((lot) => lot.id === selectedLotId) ?? LOTS[0];
  const selectedPair = PAIRS.find((pair) => pair.id === selectedPairId) ?? PAIRS[0];
  const breakdown = economicBreakdown(selectedLot.baseByPhase, discounts);
  const unitBreakdown = economicBreakdown(ECONOMIC_UNIT_BASE_BY_LOT[selectedLotId], discounts);
  const unitKm = ECONOMIC_UNIT_KM_BY_LOT[selectedLotId];
  const targetRibasso = rMax > 0 ? round4((Math.min(30, Math.max(0, targetEconomic)) / 30) * rMax) : 0;
  const targetDelta = Math.max(0, targetRibasso - lotScore.singleRibasso);
  const onePointDelta = rMax > 0 && lotScore.singleEconomic < 30 ? rMax / 30 : 0;
  const phaseSpread = Math.max(...discounts) - Math.min(...discounts);
  const plannedTradeoffCost = CRITERIA.reduce((sum, criterion) => {
    const plan = lotOffer.tradeoffs[criterion.id];
    return sum + (plan ? tradeoffCost(criterion, plan) : 0);
  }, 0);
  const comboBreakdown = economicBreakdown(pairBaseByPhase(selectedPairId), bidder.combos[selectedPairId].phaseDiscounts);
  const comboUnitBreakdown = economicBreakdown(ECONOMIC_UNIT_BASE_BY_PAIR[selectedPairId], bidder.combos[selectedPairId].phaseDiscounts);
  const comboUnitKm = ECONOMIC_UNIT_KM_BY_PAIR[selectedPairId];
  const singleOfferedForPair = selectedPair.lots.reduce((sum, lotId) => {
    const lot = LOTS.find((item) => item.id === lotId);
    return lot ? sum + economicBreakdown(lot.baseByPhase, bidder.lots[lotId].phaseDiscounts).offeredTotal : sum;
  }, 0);
  const comboSaving = singleOfferedForPair - comboBreakdown.offeredTotal;
  const guardrails = [
    {
      label: "Ribassi >= 0",
      tone: discounts.every((discount) => discount >= 0) ? "ok" : "warn",
      body: discounts.every((discount) => discount >= 0) ? "Vincolo formale rispettato." : "Correggi i valori negativi prima di usare lo scenario.",
    },
    {
      label: "Profilo fasi",
      tone: phaseSpread > 1.5 ? "warn" : "ok",
      body: phaseSpread > 1.5 ? "Scarto oltre 1,50%: verifica tenuta PEF e motivazione industriale." : "Ribassi allineati fra le tre fasi.",
    },
    {
      label: "Costi analisi puntuale",
      tone: plannedTradeoffCost > 0 ? "warn" : "ok",
      body:
        plannedTradeoffCost > 0
          ? `${euroFormatter.format(plannedTradeoffCost)} di costi stimati riducono il margine del ribasso.`
          : "Nessun costo da analisi puntuale aperto sul lotto selezionato.",
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

      <div className="economic-detail-grid">
        <section className="economic-card">
          <div className="section-title compact">
            Modello All. 18 - valori comp.
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

      <EconomicEditor
        title={`Ribasso singolo - ${selectedLotId}`}
        discounts={discounts}
        ribasso={lotScore.singleRibasso}
        disabled={disabled}
        onChange={onChange}
      />

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
  const targetLots = config.scope === "active-lot"
    ? [selectedLotId].filter((lotId) => bidder.lots[lotId].enabled)
    : LOTS.filter((lot) => bidder.lots[lot.id].enabled).map((lot) => lot.id);
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
      <div className="metric-grid">
        <div className="metric-tile">
          <span>Punteggio iniziale</span>
          <strong>{formatPoints(result.initialScore)}</strong>
        </div>
        <div className="metric-tile ok">
          <span>Dopo piano</span>
          <strong>{formatPoints(result.finalScore)}</strong>
        </div>
        <div className={`metric-tile ${result.objectiveDelta > 0 ? "ok" : "warn"}`}>
          <span>Delta stimato</span>
          <strong>{signedPoints(result.objectiveDelta)}</strong>
        </div>
      </div>

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

      <section className="optimization-card">
        <div className="section-title compact">
          <BarChart3 size={16} />
          Dashboard dove investire
          <HelpTooltip>Ordina le aree del piano per punti stimati, costo e rendimento. I costi sono assunzioni di scenario, non dati di gara.</HelpTooltip>
        </div>
        {investmentRows.length ? (
          <div className="investment-dashboard">
            {investmentRows.slice(0, 5).map((row, index) => (
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

      <section className="optimization-card">
        <div className="section-title compact">
          <LineChart size={16} />
          Mappa impatto per ambito
          <HelpTooltip>Mostra dove il piano aggiunge o sacrifica punti tecnici e dove converte valore in punti economici.</HelpTooltip>
        </div>
        {impactRows.length ? (
          <div className="impact-map">
            {impactRows.map((row) => {
              const width = `${Math.min(100, Math.max(4, (Math.abs(row.objectiveDelta) / maxImpact) * 100))}%`;
              const style = { "--impact-width": width } as CSSProperties;
              return (
                <article key={row.key} className={`impact-row ${row.objectiveDelta > 0 ? "positive" : row.objectiveDelta < 0 ? "negative" : "neutral"}`}>
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
              {unusedReleasedValue > 0 ? ` Quota liberata non assorbita dal ribasso: ${euroFormatter.format(unusedReleasedValue)}.` : ""}
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
                      Riduce {step.units.toLocaleString("it-IT", { maximumFractionDigits: 2 })} {step.unitLabel} dell'offerta tecnica,
                      {" "}{formatReallocationSummary(step)}.
                      Delta punti: {signedPoints(step.technicalDelta ?? 0)} di offerta tecnica,{" "}
                      {signedPoints(step.economicDelta ?? 0)} di offerta economica,{" "}
                      saldo {signedPoints(step.objectiveDelta)}.
                    </small>
                  ) : (
                    <small>
                      Aggiunge {step.units.toLocaleString("it-IT", { maximumFractionDigits: 2 })} {step.unitLabel} alla proposta tecnica,
                      con costo stimato {euroFormatter.format(step.cost)}.{" "}
                      Delta punti: {signedPoints(step.technicalDelta ?? step.objectiveDelta)} di offerta tecnica,{" "}
                      {signedPoints(step.economicDelta ?? 0)} di offerta economica,{" "}
                      saldo {signedPoints(step.objectiveDelta)}.
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

        <button className="apply-plan" onClick={onApplyPlan} disabled={!result.steps.length || disabledByScope}>
          Applica piano ottimizzato
        </button>
      </section>

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
                            checked={lever.enabled}
                            onChange={(event) => onLeverChange(lotId, criterion.id, { enabled: event.target.checked })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={lever.unitCost}
                            onChange={(event) => onLeverChange(lotId, criterion.id, { unitCost: Math.max(0, Number(event.target.value) || 0) })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
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
          <strong>
            Combinatoria {selectedPairId.replace("L", "").replace("+L", "+")}
            <HelpTooltip>Attiva la coppia solo se i due lotti singoli sono presentati e la proposta è migliorativa rispetto alle singole.</HelpTooltip>
          </strong>
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
            <span>
              Inserita in entrambe le buste
              <HelpTooltip>Serve a simulare il controllo formale: la combinatoria deve risultare presente dove previsto dalla gara.</HelpTooltip>
            </span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={combo.pefCoherent} onChange={(event) => onPefChange(event.target.checked)} />
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

function ResultsWorkbench({ result, selectedLotId, bidders }: { result: SimulationResult; selectedLotId: LotId; bidders: Bidder[] }) {
  const scoreBidders = bidders;
  const scoreColumnCount = scoreBidders.length + 2;
  const qtMax = maxQtPoints();
  const technicalMax = AMBITS.reduce((sum, ambit) => sum + ambit.maxPoints, 0);
  const lotSummaries = buildScenarioLotSummaries(result.selectedScenario?.assignments ?? []);
  const assignedLotCount = lotSummaries.filter(({ score }) => typeof score === "number").length;

  return (
    <div className="results-board">
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
        <div className={`metric-tile ${result.selectedScenario?.unassignedLots.length ? "warn" : "ok"}`}>
          <span>Lotti non assegnati</span>
          <strong>{result.selectedScenario?.unassignedLots.join(", ") || "nessuno"}</strong>
        </div>
      </div>

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

      <section className="subcriteria-score-section">
        <div className="section-title compact">
          Punteggi sotto criterio - {selectedLotId}
          <HelpTooltip>Mostra i punti grezzi assegnati a ogni sotto-criterio sul lotto selezionato. La riparametrazione per ambito resta riportata nel totale tecnico.</HelpTooltip>
        </div>
        <div className="subcriteria-table-wrap">
          <table className="subcriteria-score-table" style={{ "--score-column-count": scoreColumnCount } as CSSProperties}>
            <thead>
              <tr>
                <th>Criterio</th>
                <th>Max</th>
                {scoreBidders.map((bidder) => (
                  <th key={bidder.id}>
                    <span>{bidder.name}</span>
                    <small>{bidder.lots[selectedLotId].enabled ? "attivo" : "non partecipa"}</small>
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
                      <th colSpan={scoreColumnCount}>
                        <span>{ambit.id}</span>
                        <strong>{ambit.label}</strong>
                      </th>
                    </tr>
                    {ambitCriteria.map((criterion) => (
                      <tr key={criterion.id}>
                        <th>
                          <span>{criterion.id}</span>
                          <strong>{criterion.label}</strong>
                        </th>
                        <td>{formatPoints(criterion.maxPoints)}</td>
                        {scoreBidders.map((bidder) => {
                          const lotScore = result.lotScores[bidder.id]?.[selectedLotId];
                          const subScore = lotScore?.subScores[criterion.id];
                          const lotOffer = bidder.lots[selectedLotId];
                          return (
                            <td key={bidder.id} className={!lotScore?.participates ? "muted-cell" : subScore?.dependencyBlocked ? "warn-cell" : ""}>
                              <strong>{lotScore?.participates ? formatPoints(subScore?.rawScore ?? 0) : "n/p"}</strong>
                              {lotScore?.participates && subScore ? (
                                <small>{formatCriterionRowValue(criterion, subScore.value, lotOffer.quantityInputs?.[criterion.id])}</small>
                              ) : null}
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
                  return <td key={bidder.id}>{lotScore?.participates ? formatPoints(lotScore.qtRaw) : "n/p"}</td>;
                })}
              </tr>
              <tr>
                <th>Totale tecnico riparametrato</th>
                <td>{formatPoints(technicalMax)}</td>
                {scoreBidders.map((bidder) => {
                  const lotScore = result.lotScores[bidder.id]?.[selectedLotId];
                  return <td key={bidder.id}>{lotScore?.participates ? formatPoints(lotScore.technical) : "n/p"}</td>;
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
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
        <strong>
          {title}
          <HelpTooltip>Compila i ribassi delle tre fasi. Il ribasso medio è ponderato sulle basi economiche dei periodi.</HelpTooltip>
        </strong>
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
