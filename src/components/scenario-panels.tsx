import {
  CopyPlus,
  Download,
  FileJson,
  GitCompareArrows,
  Plus,
  RotateCcw,
  Save,
  Upload,
  X,
} from "lucide-react";
import { useRef } from "react";
import { LOTS } from "../data/tender";
import { candidateLotScore, formatPoints, type AssignmentCandidate, type SimulationResult } from "../lib/scoring";
import type { SavedScenarioSnapshot } from "../lib/scenario-persistence";
import { HelpTooltip } from "./help-tooltip";

export type ScenarioLibraryEntry = {
  key: string;
  name: string;
  detail: string;
};

type ScenarioToolsProps = {
  scenarioName: string;
  libraryEntries: ScenarioLibraryEntry[];
  activeLibraryKey: string;
  scenarioNotice?: string;
  hiddenLibraryCount?: number;
  onScenarioNameChange: (name: string) => void;
  onNew: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
  onExportExcel: () => void;
  onImportFile: (file: File) => void;
  onLoadEntry: (entry: ScenarioLibraryEntry) => void;
  onDeleteEntry: (entry: ScenarioLibraryEntry) => void;
  onRestoreHiddenEntries?: () => void;
  onResetModel: () => void;
  onResetTool: () => void;
};

export function ScenarioTools({
  scenarioName,
  libraryEntries,
  activeLibraryKey,
  scenarioNotice,
  hiddenLibraryCount = 0,
  onScenarioNameChange,
  onNew,
  onSave,
  onDuplicate,
  onDelete,
  onExport,
  onExportExcel,
  onImportFile,
  onLoadEntry,
  onDeleteEntry,
  onRestoreHiddenEntries,
  onResetModel,
  onResetTool,
}: ScenarioToolsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="panel scenario-tools">
      <div className="section-title">
        <FileJson size={18} />
        Scenario
        <HelpTooltip>Scegli uno scenario dalla libreria, rinominalo e salvalo quando vuoi conservarlo o confrontarlo.</HelpTooltip>
      </div>
      <label className="field">
        <span>
          Nome scenario
          <HelpTooltip>Usa un nome descrittivo dell'ipotesi, per esempio soglia, lotto o strategia economica testata.</HelpTooltip>
        </span>
          <input aria-label="Nome scenario" value={scenarioName} onChange={(event) => onScenarioNameChange(event.target.value)} />
      </label>
      <div className="scenario-actions" aria-label="Azioni rapide scenario">
          <button className="icon-button" type="button" onClick={onNew} aria-label="Nuovo scenario" title="Nuovo scenario">
          <Plus size={16} />
        </button>
          <button className="icon-button primary" type="button" onClick={onSave} aria-label="Salva scenario in libreria" title="Salva in libreria">
          <Save size={16} />
        </button>
          <button className="icon-button" type="button" onClick={onDuplicate} aria-label="Duplica scenario" title="Duplica scenario">
          <CopyPlus size={16} />
        </button>
          <button
            className="icon-button danger"
            type="button"
            onClick={onDelete}
            disabled={!activeLibraryKey}
            aria-label="Elimina scenario attivo"
            title="Elimina scenario attivo"
          >
          <X size={16} />
        </button>
          <button className="icon-button" type="button" onClick={onExport} aria-label="Esporta scenario JSON completo" title="Esporta JSON completo">
          <Download size={16} />
        </button>
          <button className="icon-button" type="button" onClick={onExportExcel} aria-label="Esporta scenario Excel" title="Esporta Excel">
          <FileJson size={16} />
        </button>
          <button className="icon-button" type="button" onClick={() => fileInputRef.current?.click()} aria-label="Importa scenario JSON" title="Importa JSON">
          <Upload size={16} />
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
          aria-label="Importa scenario JSON"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) onImportFile(file);
          event.currentTarget.value = "";
        }}
      />
      <div className="field">
        <span>
          Libreria scenari
          <HelpTooltip>Apri uno scenario dalla libreria. I profili simulati non sono offerte ufficiali: servono come punto di partenza.</HelpTooltip>
        </span>
        <div className="saved-scenario-list">
          {libraryEntries.length ? (
            libraryEntries.map((entry) => (
              <div key={entry.key} className={`saved-scenario-row ${entry.key === activeLibraryKey ? "selected" : ""}`}>
                <button className="saved-scenario-main" type="button" onClick={() => onLoadEntry(entry)}>
                  <span>{entry.name}</span>
                  <small>{entry.detail}</small>
                </button>
                <button
                  className="icon-button mini danger"
                  type="button"
                  onClick={() => onDeleteEntry(entry)}
                  aria-label={`Elimina scenario ${entry.name}`}
                  title="Elimina scenario"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          ) : (
            <div className="empty-sidebar-note">Nessuno scenario in libreria</div>
          )}
        </div>
        {hiddenLibraryCount > 0 && onRestoreHiddenEntries ? (
          <button className="action-button compact" type="button" onClick={onRestoreHiddenEntries}>
            Ripristina scenari rimossi ({hiddenLibraryCount})
          </button>
        ) : null}
      </div>
      <button className="action-button subtle" type="button" onClick={onResetModel}>
        <RotateCcw size={16} />
        Ripristina modello corrente
      </button>
        <button className="action-button danger subtle" type="button" onClick={onResetTool}>
        <RotateCcw size={16} />
        Reset totale tool
      </button>
      {scenarioNotice && <div className="scenario-notice">{scenarioNotice}</div>}
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
  const currentAssignments = assignmentsByLot(currentResult.selectedScenario?.assignments ?? []);
  const compareAssignments = assignmentsByLot(compareResult?.selectedScenario?.assignments ?? []);
  const currentLotSummaries = scenarioLotSummaries(currentResult.selectedScenario?.assignments ?? []);
  const compareLotSummaries = scenarioLotSummaries(compareResult?.selectedScenario?.assignments ?? []);
  const deltaLotSummaries = LOTS.map((lot) => {
    const currentScore = currentAssignments[lot.id] ? candidateLotScore(currentAssignments[lot.id]!, lot.id) : 0;
    const compareScore = compareAssignments[lot.id] ? candidateLotScore(compareAssignments[lot.id]!, lot.id) : 0;
    return {
      lot,
      delta: currentScore - compareScore,
    };
  });
  const changedLots = LOTS.filter((lot) => {
    const current = currentAssignments[lot.id];
    const compared = compareAssignments[lot.id];
    return current?.bidderName !== compared?.bidderName || current?.kind !== compared?.kind || current?.pairId !== compared?.pairId;
  });
  const newWarnings = currentResult.warnings.filter((warning) => !(compareResult?.warnings ?? []).includes(warning));
  const resolvedWarnings = (compareResult?.warnings ?? []).filter((warning) => !currentResult.warnings.includes(warning));
  const currentTotal = LOTS.reduce((sum, lot) => {
    const assignment = currentAssignments[lot.id];
    return sum + (assignment ? candidateLotScore(assignment, lot.id) : 0);
  }, 0);
  const compareTotal = LOTS.reduce((sum, lot) => {
    const assignment = compareAssignments[lot.id];
    return sum + (assignment ? candidateLotScore(assignment, lot.id) : 0);
  }, 0);
  const totalDelta = currentTotal - compareTotal;
  const currentUnassigned = currentResult.selectedScenario?.unassignedLots.length ?? LOTS.length;
  const compareUnassigned = compareResult?.selectedScenario?.unassignedLots.length ?? LOTS.length;

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
          <div className="comparison-decision-strip" aria-label="Sintesi confronto decisionale">
            <div className={totalDelta >= 0 ? "positive" : "negative"}>
              <span>Delta totale</span>
              <strong>{formatSignedPoints(totalDelta)}</strong>
              <small>somma dei punteggi per lotto</small>
            </div>
            <div className={changedLots.length ? "warn" : "ok"}>
              <span>Assegnazioni</span>
              <strong>{changedLots.length ? changedLots.map((lot) => lot.shortLabel).join(", ") : "stabili"}</strong>
              <small>{changedLots.length ? "lotti con vincitore o forma cambiata" : "nessun cambio di vincitore"}</small>
            </div>
            <div className={newWarnings.length ? "warn" : "ok"}>
              <span>Warning nuovi</span>
              <strong>{newWarnings.length}</strong>
              <small>{resolvedWarnings.length} risolti rispetto al confronto</small>
            </div>
            <div className={currentUnassigned ? "warn" : "ok"}>
              <span>Copertura lotti</span>
              <strong>{LOTS.length - currentUnassigned} / {LOTS.length}</strong>
              <small>{compareUnassigned !== currentUnassigned ? `prima ${LOTS.length - compareUnassigned}/${LOTS.length}` : "copertura invariata"}</small>
            </div>
          </div>

          <div className="comparison-grid per-lot">
            <div>
              <span>Scenario corrente</span>
              <LotScoreGrid summaries={currentLotSummaries} />
            </div>
            <div>
              <span>{compareScenario.name}</span>
              <LotScoreGrid summaries={compareLotSummaries} />
            </div>
            <div>
              <span>Delta per lotto</span>
              <div className="summary-lot-score-grid compact" aria-label="Delta per lotto rispetto al confronto">
                {deltaLotSummaries.map(({ lot, delta }) => (
                  <div key={lot.id} className={delta >= 0 ? "positive" : "negative"}>
                    <small>{lot.shortLabel}</small>
                    <strong>
                      {delta >= 0 ? "+" : ""}
                      {formatPoints(delta)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="comparison-lots" aria-label="Delta per lotto">
            {LOTS.map((lot) => {
              const current = currentAssignments[lot.id];
              const compared = compareAssignments[lot.id];
              const currentScore = current ? candidateLotScore(current, lot.id) : 0;
              const comparedScore = compared ? candidateLotScore(compared, lot.id) : 0;
              const lotDelta = currentScore - comparedScore;
              const assignmentChanged = current?.bidderName !== compared?.bidderName || current?.kind !== compared?.kind || current?.pairId !== compared?.pairId;
              return (
                <div key={lot.id} className={assignmentChanged ? "changed" : ""}>
                  <div className="comparison-lot-card-head">
                    <span>{lot.shortLabel}</span>
                    <strong className={lotDelta >= 0 ? "positive" : "negative"}>{formatSignedPoints(lotDelta)}</strong>
                  </div>
                  <div className="comparison-lot-pair">
                    <div>
                      <span>Corrente</span>
                      <strong>{formatAssignmentLabel(current)}</strong>
                    </div>
                    <div>
                      <span>Confronto</span>
                      <strong>{formatAssignmentLabel(compared)}</strong>
                    </div>
                  </div>
                  <small>{assignmentChanged ? "assegnazione cambiata" : "assegnazione invariata"}</small>
                </div>
              );
            })}
          </div>
          <div className="comparison-warning-detail" aria-label="Dettaglio warning confronto">
            <div>
              <strong>Warning nuovi</strong>
              <WarningPreview warnings={newWarnings} emptyText="Nessun warning nuovo." />
            </div>
            <div>
              <strong>Warning risolti</strong>
              <WarningPreview warnings={resolvedWarnings} emptyText="Nessun warning risolto." />
            </div>
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

const assignmentsByLot = (assignments: AssignmentCandidate[]) =>
  Object.fromEntries(
    LOTS.map((lot) => [lot.id, assignments.find((assignment) => assignment.lotIds.includes(lot.id))]),
  ) as Partial<Record<(typeof LOTS)[number]["id"], AssignmentCandidate>>;

const formatSignedPoints = (value: number) => `${value >= 0 ? "+" : ""}${formatPoints(value)}`;

const formatAssignmentLabel = (assignment?: AssignmentCandidate) => {
  if (!assignment) return "non assegnato";
  return `${assignment.bidderName} · ${assignment.kind === "combo" ? assignment.pairId : "singola"}`;
};

const scenarioLotSummaries = (assignments: AssignmentCandidate[]) =>
  LOTS.map((lot) => {
    const assignment = assignments.find((item) => item.lotIds.includes(lot.id));
    return {
      lot,
      assignment,
      score: assignment ? candidateLotScore(assignment, lot.id) : undefined,
    };
  });

function LotScoreGrid({ summaries }: { summaries: ReturnType<typeof scenarioLotSummaries> }) {
  return (
    <div className="summary-lot-score-grid compact" aria-label="Punteggio per lotto">
      {summaries.map(({ lot, score }) => (
        <div key={lot.id}>
          <small>{lot.shortLabel}</small>
          <strong>{typeof score === "number" ? formatPoints(score) : "n/d"}</strong>
        </div>
      ))}
    </div>
  );
}

function WarningPreview({ warnings, emptyText }: { warnings: string[]; emptyText: string }) {
  if (!warnings.length) return <p>{emptyText}</p>;
  const visibleWarnings = warnings.slice(0, 3);
  const hiddenCount = warnings.length - visibleWarnings.length;

  return (
    <ul className="warning-mini-list">
      {visibleWarnings.map((warning) => (
        <li key={warning}>{warning}</li>
      ))}
      {hiddenCount > 0 && <li>Altri {hiddenCount} warning nel pannello criticità.</li>}
    </ul>
  );
}
