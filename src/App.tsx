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
  ECONOMIC_PHASES,
  ECONOMIC_UNIT_BASE_BY_LOT,
  ECONOMIC_UNIT_BASE_BY_PAIR,
  ECONOMIC_UNIT_KM_BY_LOT,
  ECONOMIC_UNIT_KM_BY_PAIR,
  LOT_CONTEXT,
  LOTS,
  PAIRS,
  PUBLIC_SOURCE_NOTES,
  THRESHOLD_OPTIONS,
  type Criterion,
  type LotId,
  type PairId,
} from "./data/tender";
import { BASE_SCENARIOS, DEFAULT_SETTINGS, type BaseScenario, type BaseScenarioId } from "./data/base-scenarios";
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
  ReportPanel,
  ScenarioComparison,
  ScenarioTools,
  StrategicSummary,
} from "./components/scenario-panels";
import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
  normalizeScenarioSnapshot,
  readStoredSavedScenarios,
  readStoredWorkspace,
  type SavedScenarioSnapshot,
  type StoredWorkspace,
} from "./lib/scenario-persistence";

const euroFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euroPerKmFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
type ThemePreference = "auto" | "light" | "dark";
type WorkspaceTab = "tecnica" | "economica" | "combinatorie" | "risultati";
type CriterionFilter = "all" | "work" | "warn" | "open";

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

const criterionFilterOptions: { value: CriterionFilter; label: string }[] = [
  { value: "all", label: "Tutti" },
  { value: "work", label: "Da lavorare" },
  { value: "warn", label: "Verifica" },
  { value: "open", label: "Scoperti" },
];

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

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

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

const formatInputPercent = (value: number) =>
  `${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const formatPercentPointsFromDecimal = (value: number) =>
  `${(value * 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`;

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

const matchesCriterionFilter = (criterion: Criterion, score: number, note: string | undefined, filter: CriterionFilter) => {
  if (filter === "all") return true;
  if (filter === "warn") return Boolean(note);
  if (filter === "open") return score <= 0 && criterion.maxPoints > 0;
  return Boolean(note) || (criterion.maxPoints > 0 && score < criterion.maxPoints * 0.9);
};

function App() {
  const [initialWorkspace] = useState(() => readStoredWorkspace());
  const [baseScenarioId, setBaseScenarioId] = useState<BaseScenarioId>(initialWorkspace?.baseScenarioId ?? "market");
  const [bidders, setBidders] = useState<Bidder[]>(() => initialWorkspace?.bidders ?? BASE_SCENARIOS[0].buildBidders());
  const [selectedBidderId, setSelectedBidderId] = useState(initialWorkspace?.selectedBidderId ?? BASE_SCENARIOS[0].defaultBidderId);
  const [selectedLotId, setSelectedLotId] = useState<LotId>(initialWorkspace?.selectedLotId ?? "L1");
  const [selectedPairId, setSelectedPairId] = useState<PairId>(initialWorkspace?.selectedPairId ?? BASE_SCENARIOS[0].defaultPairId);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("tecnica");
  const [criterionFilter, setCriterionFilter] = useState<CriterionFilter>("all");
  const [selectedAmbitId, setSelectedAmbitId] = useState(AMBITS[0].id);
  const [selectedCriterionId, setSelectedCriterionId] = useState(CRITERIA[0].id);
  const [settings, setSettings] = useState<Settings>(initialWorkspace?.settings ?? DEFAULT_SETTINGS);
  const [scenarioName, setScenarioName] = useState(initialWorkspace?.scenarioName ?? BASE_SCENARIOS[0].title);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenarioSnapshot[]>(readStoredSavedScenarios);
  const [activeSavedScenarioId, setActiveSavedScenarioId] = useState<string | undefined>(initialWorkspace?.activeSavedScenarioId);
  const [compareScenarioId, setCompareScenarioId] = useState("");
  const [scenarioNotice, setScenarioNotice] = useState("");
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
    window.localStorage.setItem(
      STORAGE_KEYS.workspace,
      JSON.stringify({
        schemaVersion: 2,
        scenarioName,
        activeSavedScenarioId,
        baseScenarioId,
        bidders,
        settings,
        selectedBidderId,
        selectedLotId,
        selectedPairId,
      } satisfies StoredWorkspace),
    );
  }, [activeSavedScenarioId, bidders, baseScenarioId, scenarioName, selectedBidderId, selectedLotId, selectedPairId, settings]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.scenarios, JSON.stringify(savedScenarios));
  }, [savedScenarios]);

  const selectedBidder = bidders.find((bidder) => bidder.id === selectedBidderId) ?? bidders[0];
  const selectedLotContext = LOT_CONTEXT[selectedLotId];
  const selectedBaseScenario = BASE_SCENARIOS.find((scenario) => scenario.id === baseScenarioId) ?? BASE_SCENARIOS[0];
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

  const focusWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (selectedLotScore?.warnings.length) {
      warnings.push(...selectedLotScore.warnings.map((warning) => `${selectedBidder?.name ?? "Offerente"} ${selectedLotId}: ${warning}`));
    }
    if (activeTab === "combinatorie" && selectedComboScore?.warnings.length) {
      warnings.push(...selectedComboScore.warnings.map((warning) => `${selectedBidder?.name ?? "Offerente"} ${selectedPairId}: ${warning}`));
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

  const updateBidder = (bidderId: string, updater: (bidder: Bidder) => Bidder) => {
    setBidders((current) => current.map((bidder) => (bidder.id === bidderId ? updater(structuredClone(bidder)) : bidder)));
  };

  const loadBaseScenario = (scenario: BaseScenario) => {
    setBaseScenarioId(scenario.id);
    setScenarioName(scenario.title);
    setActiveSavedScenarioId(undefined);
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

  const currentScenarioSnapshot = (id = activeSavedScenarioId ?? `scenario-${Date.now()}`, name = scenarioName): SavedScenarioSnapshot => ({
    schemaVersion: 2,
    id,
    name: name.trim() || "Scenario senza nome",
    savedAt: new Date().toISOString(),
    baseScenarioId,
    bidders: structuredClone(bidders),
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Simulatore gara TPL lotti 1-4</h1>
          <p>Console operativa per confrontare lotti singoli, combinatorie, soglie tecniche, ribassi e criticità documentali.</p>
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
          <ScenarioTools
            scenarioName={scenarioName}
            savedScenarios={savedScenarios}
            activeSavedScenarioId={activeSavedScenarioId}
            scenarioNotice={scenarioNotice}
            onScenarioNameChange={(name) => {
              setScenarioName(name);
              setActiveSavedScenarioId(undefined);
            }}
            onSave={saveCurrentScenario}
            onDuplicate={duplicateCurrentScenario}
            onExport={exportCurrentScenario}
            onImportFile={importScenarioFile}
            onLoadSaved={loadSavedScenario}
            onResetBaseScenario={resetCurrentBaseScenario}
          />

          <section className="panel base-panel">
            <div className="section-title">
              <ClipboardList size={18} />
              Scenari base
            </div>
            <div className="base-list">
              {BASE_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  className={`base-card ${scenario.id === baseScenarioId ? "active" : ""}`}
                  onClick={() => loadBaseScenario(scenario)}
                >
                  <strong>{scenario.title}</strong>
                  <span>{scenario.body}</span>
                </button>
              ))}
            </div>
            <div className="hint">Profili simulati da fonti pubbliche e modelli locali: servono per confrontare scenari, non rappresentano offerte ufficiali.</div>
          </section>

          <section className="panel">
            <div className="section-title">
              <SlidersHorizontal size={18} />
              Parametri
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
            <div className="hint">Soglia attiva: scenario disciplinare se resta a 37 pt. Q/T max ricostruito: {formatPoints(maxQtPoints())} punti. Le incongruenze sono nel pannello criticità.</div>
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
              <StrategicSummary
                scenarioName={scenarioName}
                selectedBidderName={selectedBidder.name}
                selectedLotLabel={selectedLotLabel}
                result={result}
                selectedLotQt={selectedLotScore?.qtRaw}
                activeSectionLabel={activeTabLabel}
                onOpenTechnical={() => setActiveTab("tecnica")}
                onOpenEconomic={() => setActiveTab("economica")}
                onOpenResults={() => setActiveTab("risultati")}
              />

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
                <div className="mobile-participation-cards" aria-label="Partecipazioni per offerente">
                  {bidders.map((bidder) => (
                    <article key={bidder.id} className={`mobile-bidder-card ${bidder.id === selectedBidder.id ? "selected" : ""}`}>
                      <button className="mobile-bidder-name" onClick={() => setSelectedBidderId(bidder.id)}>
                        {bidder.name}
                      </button>
                      <div className="mobile-check-grid">
                        {LOTS.map((lot) => {
                          const lotScore = result.lotScores[bidder.id][lot.id];
                          return (
                            <label key={lot.id} className={bidder.lots[lot.id].enabled ? lotScore.admitted ? "ok" : "warn" : ""}>
                              <span>{lot.shortLabel}</span>
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
                            </label>
                          );
                        })}
                        {PAIRS.map((pair) => {
                          const comboScore = result.comboScores[bidder.id][pair.id];
                          return (
                            <label key={pair.id} className={bidder.combos[pair.id].enabled ? comboScore.admissible ? "ok" : "warn" : ""}>
                              <span>{pair.label.replace("Lotti ", "")}</span>
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
                            </label>
                          );
                        })}
                      </div>
                    </article>
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
                        criterionFilter={criterionFilter}
                        onAmbitSelect={setSelectedAmbitId}
                        onCriterionSelect={setSelectedCriterionId}
                        onCriterionFilterChange={setCriterionFilter}
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
          <ReportPanel
            scenarioName={scenarioName}
            result={result}
            selectedLotId={selectedLotId}
            sourceCount={PUBLIC_SOURCE_NOTES.length}
            onPrint={() => window.print()}
          />

          <ScenarioComparison
            savedScenarios={savedScenarios}
            compareScenarioId={compareScenarioId}
            compareScenario={compareScenario}
            compareResult={compareResult}
            currentResult={result}
            onCompareScenarioChange={setCompareScenarioId}
          />

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
                  <b>{formatPoints(candidateLotScore(candidate, selectedLotId))}</b>
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
                  <small>
                    {note.reliability} - verificata il {note.verifiedAt}
                  </small>
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
  criterionFilter,
  onAmbitSelect,
  onCriterionSelect,
  onCriterionFilterChange,
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
  criterionFilter: CriterionFilter;
  onAmbitSelect: (ambitId: string) => void;
  onCriterionSelect: (criterionId: string) => void;
  onCriterionFilterChange: (filter: CriterionFilter) => void;
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
  const filteredParentSections = parentSections
    .map((parent) => ({
      ...parent,
      criteria: parent.criteria.filter((criterion) => {
        const subScore = lotScore.subScores[criterion.id];
        return matchesCriterionFilter(criterion, subScore?.rawScore ?? 0, subScore?.note, criterionFilter);
      }),
    }))
    .filter((parent) => parent.criteria.length > 0);
  const totalCriteria = parentSections.reduce((sum, parent) => sum + parent.criteria.length, 0);
  const filteredCriteria = filteredParentSections.reduce((sum, parent) => sum + parent.criteria.length, 0);

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
          <strong>Criteri {selectedAmbit.id}</strong>
          <span>
            {filteredCriteria} di {totalCriteria} visibili
          </span>
        </div>
        <div className="filter-pills" role="group" aria-label="Filtro criteri">
          {criterionFilterOptions.map((option) => (
            <button
              key={option.value}
              className={criterionFilter === option.value ? "active" : ""}
              onClick={() => onCriterionFilterChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
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
        {filteredParentSections.map((parent) => {
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
        {!filteredParentSections.length && <div className="empty-state compact">Nessun criterio corrisponde al filtro selezionato.</div>}
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
            </div>
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
      body: phaseSpread > 1.5 ? "Scarto oltre 1,50 p.p.: verifica tenuta PEF e motivazione industriale." : "Ribassi allineati fra le tre fasi.",
    },
    {
      label: "Costi tradeoff",
      tone: plannedTradeoffCost > 0 ? "warn" : "ok",
      body:
        plannedTradeoffCost > 0
          ? `${euroFormatter.format(plannedTradeoffCost)} di costi stimati riducono il margine del ribasso.`
          : "Nessun costo tradeoff aperto sul lotto selezionato.",
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
          <div className="section-title compact">Modello All. 18 - valori comp.</div>
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
          <div className="section-title compact">Formula punteggio</div>
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
            <span>Target punteggio economico</span>
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
          <div className="section-title compact">Corrispettivi unitari €/km</div>
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
          <div className="section-title compact">Guardrail economici</div>
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
        <div className="section-title compact">Vista economica combinatoria</div>
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
          <div className="hint">La combinatoria è letta rispetto alle offerte singole correnti dello stesso offerente.</div>
        )}
      </section>

      <div className="hint">I valori economici sono simulazioni operative basate su All. 18 e sui ribassi inseriti: restano distinti da offerte ufficiali e PEF reali.</div>
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
                <b>{formatPoints(candidateLotScore(candidate, selectedLotId))}</b>
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
