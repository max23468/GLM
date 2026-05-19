import {
  AlertTriangle,
  CopyPlus,
  Download,
  FileJson,
  GitCompareArrows,
  Printer,
  RotateCcw,
  Save,
  Trophy,
  Upload,
} from "lucide-react";
import { useRef } from "react";
import { LOTS } from "../data/tender";
import { formatPoints, type SimulationResult } from "../lib/scoring";
import type { SavedScenarioSnapshot } from "../lib/scenario-persistence";

type ScenarioToolsProps = {
  scenarioName: string;
  savedScenarios: SavedScenarioSnapshot[];
  activeSavedScenarioId?: string;
  scenarioNotice?: string;
  onScenarioNameChange: (name: string) => void;
  onSave: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onLoadSaved: (scenarioId: string) => void;
  onResetBaseScenario: () => void;
};

export function ScenarioTools({
  scenarioName,
  savedScenarios,
  activeSavedScenarioId,
  scenarioNotice,
  onScenarioNameChange,
  onSave,
  onDuplicate,
  onExport,
  onImportFile,
  onLoadSaved,
  onResetBaseScenario,
}: ScenarioToolsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="panel scenario-tools">
      <div className="section-title">
        <FileJson size={18} />
        Scenario
      </div>
      <label className="field">
        <span>Nome scenario</span>
        <input value={scenarioName} onChange={(event) => onScenarioNameChange(event.target.value)} />
      </label>
      <div className="scenario-actions">
        <button className="action-button primary" onClick={onSave}>
          <Save size={16} />
          Salva
        </button>
        <button className="action-button" onClick={onDuplicate}>
          <CopyPlus size={16} />
          Duplica
        </button>
        <button className="action-button" onClick={onExport}>
          <Download size={16} />
          Esporta
        </button>
        <button className="action-button" onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} />
          Importa
        </button>
      </div>
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) onImportFile(file);
          event.currentTarget.value = "";
        }}
      />
      <label className="field">
        <span>Scenari salvati</span>
        <select value={activeSavedScenarioId ?? ""} onChange={(event) => onLoadSaved(event.target.value)} disabled={!savedScenarios.length}>
          <option value="">{savedScenarios.length ? "Seleziona scenario salvato" : "Nessuno scenario salvato"}</option>
          {savedScenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.name}
            </option>
          ))}
        </select>
      </label>
      <button className="action-button subtle" onClick={onResetBaseScenario}>
        <RotateCcw size={16} />
        Ripristina scenario base
      </button>
      {scenarioNotice && <div className="scenario-notice">{scenarioNotice}</div>}
    </section>
  );
}

type StrategicSummaryProps = {
  scenarioName: string;
  selectedBidderName?: string;
  selectedLotLabel: string;
  result: SimulationResult;
  selectedLotQt?: number;
  onOpenResults: () => void;
};

export function StrategicSummary({
  scenarioName,
  selectedBidderName,
  selectedLotLabel,
  result,
  selectedLotQt,
  onOpenResults,
}: StrategicSummaryProps) {
  const selected = result.selectedScenario;
  const assignmentsByLot = LOTS.map((lot) => {
    const assignment = selected?.assignments.find((item) => item.lotIds.includes(lot.id));
    return {
      lot,
      assignment,
    };
  });

  return (
    <section className="strategic-summary" aria-label="Riepilogo strategico">
      <div className="strategic-heading">
        <div>
          <span>Scenario</span>
          <strong>{scenarioName}</strong>
        </div>
        <div className="summary-score">
          <span>Totale migliore</span>
          <strong>{selected ? formatPoints(selected.totalScore) : "n/d"}</strong>
        </div>
        <button className="action-button compact" onClick={onOpenResults}>
          <Trophy size={16} />
          Risultati
        </button>
      </div>
      <div className="strategic-grid">
        {assignmentsByLot.map(({ lot, assignment }) => (
          <div key={lot.id} className={`strategic-lot ${assignment ? "assigned" : "open"}`}>
            <span>{lot.shortLabel}</span>
            <strong>{assignment?.bidderName ?? "non assegnato"}</strong>
            <small>{assignment ? (assignment.kind === "combo" ? assignment.pairId : "singola") : "verifica scenario"}</small>
          </div>
        ))}
      </div>
      <div className="strategic-footer">
        <span>
          Focus: {selectedBidderName ?? "n/d"} su {selectedLotLabel}
          {typeof selectedLotQt === "number" ? `, Q/T ${formatPoints(selectedLotQt)}` : ""}
        </span>
        {result.warnings[0] ? (
          <span className="summary-warning">
            <AlertTriangle size={14} />
            {result.warnings[0]}
          </span>
        ) : (
          <span>Nessun warning scenario prioritario.</span>
        )}
      </div>
    </section>
  );
}

type ScenarioComparisonProps = {
  savedScenarios: SavedScenarioSnapshot[];
  compareScenarioId: string;
  compareScenario?: SavedScenarioSnapshot;
  compareResult?: SimulationResult;
  currentResult: SimulationResult;
  onCompareScenarioChange: (scenarioId: string) => void;
};

export function ScenarioComparison({
  savedScenarios,
  compareScenarioId,
  compareScenario,
  compareResult,
  currentResult,
  onCompareScenarioChange,
}: ScenarioComparisonProps) {
  const currentTotal = currentResult.selectedScenario?.totalScore ?? 0;
  const compareTotal = compareResult?.selectedScenario?.totalScore ?? 0;
  const delta = currentTotal - compareTotal;

  return (
    <section className="panel comparison-panel">
      <div className="section-title">
        <GitCompareArrows size={18} />
        Confronto scenari
      </div>
      <label className="field">
        <span>Scenario salvato da confrontare</span>
        <select value={compareScenarioId} onChange={(event) => onCompareScenarioChange(event.target.value)} disabled={!savedScenarios.length}>
          <option value="">{savedScenarios.length ? "Seleziona scenario" : "Salva uno scenario per confrontare"}</option>
          {savedScenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.name}
            </option>
          ))}
        </select>
      </label>
      {compareScenario && compareResult ? (
        <div className="comparison-grid">
          <div>
            <span>Scenario corrente</span>
            <strong>{formatPoints(currentTotal)}</strong>
          </div>
          <div>
            <span>{compareScenario.name}</span>
            <strong>{formatPoints(compareTotal)}</strong>
          </div>
          <div className={delta >= 0 ? "positive" : "negative"}>
            <span>Differenza</span>
            <strong>
              {delta >= 0 ? "+" : ""}
              {formatPoints(delta)}
            </strong>
          </div>
        </div>
      ) : (
        <div className="empty-state compact">Salva o importa uno scenario, poi selezionalo qui per vedere la differenza.</div>
      )}
    </section>
  );
}

type ReportPanelProps = {
  scenarioName: string;
  result: SimulationResult;
  selectedLotId: string;
  sourceCount: number;
  onPrint: () => void;
};

export function ReportPanel({ scenarioName, result, selectedLotId, sourceCount, onPrint }: ReportPanelProps) {
  return (
    <section className="panel report-panel">
      <div className="section-title">
        <Printer size={18} />
        Report scenario
      </div>
      <div className="report-summary">
        <div>
          <span>Scenario</span>
          <strong>{scenarioName}</strong>
        </div>
        <div>
          <span>Punteggio migliore</span>
          <strong>{result.selectedScenario ? formatPoints(result.selectedScenario.totalScore) : "n/d"}</strong>
        </div>
        <div>
          <span>Classifica attiva</span>
          <strong>{selectedLotId}</strong>
        </div>
        <div>
          <span>Fonti collegate</span>
          <strong>{sourceCount}</strong>
        </div>
      </div>
      <button className="action-button primary" onClick={onPrint}>
        <Printer size={16} />
        Stampa / salva PDF
      </button>
    </section>
  );
}
