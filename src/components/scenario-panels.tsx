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
import { candidateLotScore, formatPoints, type AssignmentCandidate, type SimulationResult } from "../lib/scoring";
import type { SavedScenarioSnapshot } from "../lib/scenario-persistence";
import { HelpTooltip } from "./help-tooltip";

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
        <HelpTooltip>Rinomina lo scenario prima di salvarlo: il nome resta nella libreria, nel confronto e negli export JSON.</HelpTooltip>
      </div>
      <label className="field">
        <span>
          Nome scenario
          <HelpTooltip>Usa un nome descrittivo dell'ipotesi, per esempio soglia, lotto o strategia economica testata.</HelpTooltip>
        </span>
        <input value={scenarioName} onChange={(event) => onScenarioNameChange(event.target.value)} />
      </label>
      <div className="scenario-actions">
        <button className="action-button primary" onClick={onSave}>
          <Save size={16} />
          Salva in libreria
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
      <div className="autosave-note">
        <strong>Workspace autosalvato</strong>
        <span>Le modifiche restano in questo browser. Salva in libreria per confrontarle o esportarle.</span>
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
        <span>
          Scenari salvati
          <HelpTooltip>La libreria resta nel browser corrente. Per archiviare o condividere uno scenario, usa sempre Esporta.</HelpTooltip>
        </span>
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
  activeSectionLabel: string;
  onOpenTechnical: () => void;
  onOpenEconomic: () => void;
  onOpenResults: () => void;
};

export function StrategicSummary({
  scenarioName,
  selectedBidderName,
  selectedLotLabel,
  result,
  selectedLotQt,
  activeSectionLabel,
  onOpenTechnical,
  onOpenEconomic,
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
        <div className="summary-actions" aria-label="Azioni rapide">
          <button className="action-button compact" onClick={onOpenTechnical}>
            Tecnica
          </button>
          <button className="action-button compact" onClick={onOpenEconomic}>
            Economica
          </button>
          <button className="action-button compact primary" onClick={onOpenResults}>
            <Trophy size={16} />
            Risultati
          </button>
        </div>
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
          Focus: {selectedBidderName ?? "n/d"} su {selectedLotLabel}, sezione {activeSectionLabel}
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
  const currentAssignments = assignmentsByLot(currentResult.selectedScenario?.assignments ?? []);
  const compareAssignments = assignmentsByLot(compareResult?.selectedScenario?.assignments ?? []);
  const changedLots = LOTS.filter((lot) => {
    const current = currentAssignments[lot.id];
    const compared = compareAssignments[lot.id];
    return current?.bidderName !== compared?.bidderName || current?.kind !== compared?.kind || current?.pairId !== compared?.pairId;
  });
  const newWarnings = currentResult.warnings.filter((warning) => !(compareResult?.warnings ?? []).includes(warning));
  const resolvedWarnings = (compareResult?.warnings ?? []).filter((warning) => !currentResult.warnings.includes(warning));

  return (
    <section className="panel comparison-panel">
      <div className="section-title">
        <GitCompareArrows size={18} />
        Confronto scenari
        <HelpTooltip>Salva prima una fotografia dello scenario, poi selezionala qui per leggere delta di punteggio e assegnazioni.</HelpTooltip>
      </div>
      <label className="field">
        <span>
          Scenario salvato da confrontare
          <HelpTooltip>Il confronto usa uno scenario già salvato o importato nella libreria del browser.</HelpTooltip>
        </span>
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
        <>
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
          <div className="comparison-lots" aria-label="Delta per lotto">
            {LOTS.map((lot) => {
              const current = currentAssignments[lot.id];
              const compared = compareAssignments[lot.id];
              const currentScore = current ? candidateLotScore(current, lot.id) : 0;
              const comparedScore = compared ? candidateLotScore(compared, lot.id) : 0;
              const lotDelta = currentScore - comparedScore;
              return (
                <div key={lot.id} className={current?.bidderName === compared?.bidderName && current?.kind === compared?.kind ? "" : "changed"}>
                  <span>{lot.shortLabel}</span>
                  <strong>{current?.bidderName ?? "non assegnato"}</strong>
                  <small>
                    {lotDelta >= 0 ? "+" : ""}
                    {formatPoints(lotDelta)} pt rispetto al confronto
                  </small>
                </div>
              );
            })}
          </div>
          <div className="comparison-notes">
            <span>{changedLots.length ? `Assegnazioni cambiate: ${changedLots.map((lot) => lot.shortLabel).join(", ")}` : "Assegnazioni invariate per tutti i lotti."}</span>
            <span>{newWarnings.length ? `Nuovi warning: ${newWarnings.length}` : "Nessun nuovo warning rispetto allo scenario confrontato."}</span>
            <span>{resolvedWarnings.length ? `Warning risolti: ${resolvedWarnings.length}` : "Nessun warning risolto nel confronto."}</span>
          </div>
        </>
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
  const assignments = result.selectedScenario?.assignments ?? [];
  const topWarnings = result.warnings.slice(0, 3);
  return (
    <section className="panel report-panel">
      <div className="section-title">
        <Printer size={18} />
        Report scenario
        <HelpTooltip>Usa il report per stampare o salvare in PDF una sintesi dopo aver controllato warning e lotti non assegnati.</HelpTooltip>
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
      <div className="report-executive">
        <div>
          <span>Assegnazioni</span>
          <strong>{assignments.length ? assignments.map((item) => item.lotIds.join("+")).join(", ") : "n/d"}</strong>
        </div>
        <div>
          <span>Criticità scenario</span>
          <strong>{topWarnings.length ? `${topWarnings.length} da verificare` : "nessuna prioritaria"}</strong>
        </div>
        <p>
          Output esplorativo: scenari base e profili simulati non rappresentano offerte ufficiali. Verificare documenti e fonti prima di usare il report come base decisionale.
        </p>
      </div>
    </section>
  );
}

const assignmentsByLot = (assignments: AssignmentCandidate[]) =>
  Object.fromEntries(
    LOTS.map((lot) => [lot.id, assignments.find((assignment) => assignment.lotIds.includes(lot.id))]),
  ) as Partial<Record<(typeof LOTS)[number]["id"], AssignmentCandidate>>;
