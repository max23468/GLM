import { BarChart3, CopyPlus, Plus, Route, SlidersHorizontal, X } from "lucide-react";
import { useMemo } from "react";
import { getBaseScenario } from "../data/base-scenarios";
import { LOTS, PAIRS, THRESHOLD_OPTIONS, type LotId, type PairId } from "../data/tender";
import { baseIdFromPresetScenarioId, type SavedScenarioSnapshot } from "../lib/scenario-persistence";
import type { Bidder, Settings, SimulationResult } from "../lib/scoring";
import { HelpTooltip } from "./help-tooltip";
import { ScenarioTools, type ScenarioLibraryEntry } from "./scenario-panels";

type WorkspaceSidebarProps = {
  scenarioName: string;
  savedScenarios: SavedScenarioSnapshot[];
  activeSavedScenarioId?: string;
  scenarioNotice?: string;
  removedPresetCount: number;
  onScenarioNameChange: (name: string) => void;
  onNew: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDeleteSaved: (scenarioId: string) => void;
  onExport: () => void;
  onExportExcel: () => void;
  onImportFile: (file: File) => void;
  onLoadSaved: (scenarioId: string) => void;
  onResetModel: () => void;
  onResetTool: () => void;
  onRestoreRemovedPresets: () => void;
  bidders: Bidder[];
  selectedBidder?: Bidder;
  result: SimulationResult;
  settings: Settings;
  onAddBidder: () => void;
  onDuplicateBidder: (bidderId: string) => void;
  onRemoveBidder: (bidderId: string) => void;
  onSelectBidder: (bidderId: string) => void;
  onSelectedBidderNameChange: (name: string) => void;
  onLotParticipationChange: (lotId: LotId, checked: boolean) => void;
  onComboParticipationChange: (pairId: PairId, checked: boolean) => void;
  onSettingsChange: (patch: Partial<Settings>) => void;
};

export function WorkspaceSidebar({
  scenarioName,
  savedScenarios,
  activeSavedScenarioId,
  scenarioNotice,
  removedPresetCount,
  onScenarioNameChange,
  onNew,
  onSave,
  onDuplicate,
  onDelete,
  onDeleteSaved,
  onExport,
  onExportExcel,
  onImportFile,
  onLoadSaved,
  onResetModel,
  onResetTool,
  onRestoreRemovedPresets,
  bidders,
  selectedBidder,
  result,
  settings,
  onAddBidder,
  onDuplicateBidder,
  onRemoveBidder,
  onSelectBidder,
  onSelectedBidderNameChange,
  onLotParticipationChange,
  onComboParticipationChange,
  onSettingsChange,
}: WorkspaceSidebarProps) {
  const activeThresholdOption = THRESHOLD_OPTIONS.find((option) => option.value === settings.threshold) ?? THRESHOLD_OPTIONS[0];

  const libraryEntries = useMemo<ScenarioLibraryEntry[]>(
    () =>
      savedScenarios.map((scenario) => {
        const presetBaseId = baseIdFromPresetScenarioId(scenario.id);
        const detail = presetBaseId
          ? getBaseScenario(presetBaseId).body
          : new Date(scenario.savedAt).toLocaleString("it-IT", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
        return {
          key: scenario.id,
          name: scenario.name,
          detail,
        };
      }),
    [savedScenarios],
  );

  const activeLibraryKey = activeSavedScenarioId ?? "";

  const loadLibraryEntry = (entry: ScenarioLibraryEntry) => {
    onLoadSaved(entry.key);
  };

  const deleteLibraryEntry = (entry: ScenarioLibraryEntry) => {
    onDeleteSaved(entry.key);
  };

  return (
    <aside className="left-rail">
      <ScenarioTools
        scenarioName={scenarioName}
        libraryEntries={libraryEntries}
        activeLibraryKey={activeLibraryKey}
        scenarioNotice={scenarioNotice}
        hiddenLibraryCount={removedPresetCount}
        onScenarioNameChange={onScenarioNameChange}
        onNew={onNew}
        onSave={onSave}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onExport={onExport}
        onExportExcel={onExportExcel}
        onImportFile={onImportFile}
        onLoadEntry={loadLibraryEntry}
        onDeleteEntry={deleteLibraryEntry}
        onRestoreHiddenEntries={onRestoreRemovedPresets}
        onResetModel={onResetModel}
        onResetTool={onResetTool}
      />

      <section className="panel">
        <div className="section-title between">
          <span>
            <Route size={18} />
            Concorrenti
            <HelpTooltip>Da qui aggiungi, duplichi, rinomini, selezioni o elimini i concorrenti. La duplicazione copia offerte, partecipazioni e combinatorie del concorrente scelto.</HelpTooltip>
          </span>
          <button className="icon-button primary" type="button" onClick={onAddBidder} aria-label="Aggiungi concorrente" title="Aggiungi concorrente">
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
              <input aria-label="Nome concorrente" value={selectedBidder.name} onChange={(event) => onSelectedBidderNameChange(event.target.value)} />
            </label>
          </div>
        )}
        <div className="offeror-list">
          {bidders.map((bidder) => {
            const activeLots = LOTS.filter((lot) => bidder.lots[lot.id].enabled).length;
            const isSelected = bidder.id === selectedBidder?.id;
            return (
              <div key={bidder.id} className={`sidebar-row-actions ${isSelected ? "selected" : ""}`}>
                <button className="offeror-row" type="button" onClick={() => onSelectBidder(bidder.id)}>
                  <span>{bidder.name}</span>
                  <small>
                    {activeLots} {activeLots === 1 ? "lotto" : "lotti"}
                  </small>
                </button>
                <button
                  className="icon-button mini"
                  type="button"
                  onClick={() => onDuplicateBidder(bidder.id)}
                  aria-label={`Duplica concorrente ${bidder.name}`}
                  title="Duplica concorrente"
                >
                  <CopyPlus size={14} />
                </button>
                <button
                  className="icon-button mini danger"
                  type="button"
                  disabled={bidders.length <= 1}
                  onClick={() => onRemoveBidder(bidder.id)}
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
                <label key={lot.id} className={selectedBidder.lots[lot.id].enabled ? (lotScore.admitted ? "ok" : "warn") : ""}>
                  <span>{lot.shortLabel}</span>
                  <input
                    type="checkbox"
                    aria-label={`Partecipa al ${lot.shortLabel} con ${selectedBidder.name}`}
                    checked={selectedBidder.lots[lot.id].enabled}
                    onChange={(event) => onLotParticipationChange(lot.id, event.target.checked)}
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
                <label key={pair.id} className={selectedBidder.combos[pair.id].enabled ? (comboScore.admissible ? "ok" : "warn") : ""}>
                  <span>{pair.label.replace("Lotti ", "")}</span>
                  <input
                    type="checkbox"
                    aria-label={`Presenta combinatoria ${pair.label.replace("Lotti ", "")} con ${selectedBidder.name}`}
                    checked={selectedBidder.combos[pair.id].enabled}
                    onChange={(event) => onComboParticipationChange(pair.id, event.target.checked)}
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
        <label className="field">
          <span>
            Soglia di sbarramento
            <HelpTooltip>Un'offerta sotto soglia non passa alla valutazione economica. Le tre opzioni corrispondono alle letture già richiamate nelle istruzioni.</HelpTooltip>
          </span>
          <select value={settings.threshold} onChange={(event) => onSettingsChange({ threshold: Number(event.target.value) })}>
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
            aria-label="Applica deroga al limite di due lotti"
            checked={settings.applyAwardLimitDerogation}
            onChange={(event) => onSettingsChange({ applyAwardLimitDerogation: event.target.checked })}
          />
          <span>Applica deroga al limite di due lotti se necessaria per evitare lotti non assegnati</span>
        </label>
        <div className="hint">Soglia attiva: scenario disciplinare se resta a 37 pt. Le letture alternative più selettive restano nel menu. Le incongruenze sono nel pannello criticità.</div>
        <div className="hint">Fonte soglia attiva: {activeThresholdOption.source}.</div>
      </section>
    </aside>
  );
}
