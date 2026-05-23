import { BarChart3, ClipboardList, Plus, Route, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { type BaseScenario, type BaseScenarioId } from "../data/base-scenarios";
import { LOTS, PAIRS, THRESHOLD_OPTIONS, type LotId, type PairId } from "../data/tender";
import type { Bidder, Settings, SimulationResult } from "../lib/scoring";
import type { SavedScenarioSnapshot } from "../lib/scenario-persistence";
import { HelpTooltip } from "./help-tooltip";
import { ScenarioTools } from "./scenario-panels";

type WorkspaceSidebarProps = {
  scenarioName: string;
  savedScenarios: SavedScenarioSnapshot[];
  activeSavedScenarioId?: string;
  scenarioNotice?: string;
  onScenarioNameChange: (name: string) => void;
  onNew: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDeleteSaved: (scenarioId: string) => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onLoadSaved: (scenarioId: string) => void;
  onResetBaseScenario: () => void;
  onResetTool: () => void;
  selectedBaseScenario: BaseScenario;
  visibleBaseScenarios: BaseScenario[];
  hiddenBaseScenarioCount: number;
  baseScenarioId: BaseScenarioId;
  onLoadBaseScenario: (scenario: BaseScenario) => void;
  onDeleteBaseScenario: (scenario: BaseScenario) => void;
  onRestoreBaseScenarios: () => void;
  bidders: Bidder[];
  selectedBidder?: Bidder;
  result: SimulationResult;
  settings: Settings;
  onAddBidder: () => void;
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
  onScenarioNameChange,
  onNew,
  onSave,
  onDuplicate,
  onDelete,
  onDeleteSaved,
  onExport,
  onImportFile,
  onLoadSaved,
  onResetBaseScenario,
  onResetTool,
  selectedBaseScenario,
  visibleBaseScenarios,
  hiddenBaseScenarioCount,
  baseScenarioId,
  onLoadBaseScenario,
  onDeleteBaseScenario,
  onRestoreBaseScenarios,
  bidders,
  selectedBidder,
  result,
  settings,
  onAddBidder,
  onRemoveBidder,
  onSelectBidder,
  onSelectedBidderNameChange,
  onLotParticipationChange,
  onComboParticipationChange,
  onSettingsChange,
}: WorkspaceSidebarProps) {
  const [isBaseScenariosExpanded, setBaseScenariosExpanded] = useState(false);
  const [isBaseScenarioManagementOpen, setBaseScenarioManagementOpen] = useState(false);
  const activeThresholdOption = THRESHOLD_OPTIONS.find((option) => option.value === settings.threshold) ?? THRESHOLD_OPTIONS[0];

  const restoreBaseScenarios = () => {
    onRestoreBaseScenarios();
    setBaseScenariosExpanded(true);
    setBaseScenarioManagementOpen(false);
  };

  return (
    <aside className="left-rail">
      <ScenarioTools
        scenarioName={scenarioName}
        savedScenarios={savedScenarios}
        activeSavedScenarioId={activeSavedScenarioId}
        scenarioNotice={scenarioNotice}
        onScenarioNameChange={onScenarioNameChange}
        onNew={onNew}
        onSave={onSave}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onDeleteSaved={onDeleteSaved}
        onExport={onExport}
        onImportFile={onImportFile}
        onLoadSaved={onLoadSaved}
        onResetBaseScenario={onResetBaseScenario}
        onResetTool={onResetTool}
      />

      <section className="panel base-panel">
        <div className="section-title between">
          <span>
            <ClipboardList size={18} />
            Scenari base
            <HelpTooltip>Parti da uno scenario precompilato solo come base di lavoro: non rappresenta un'offerta ufficiale.</HelpTooltip>
          </span>
          <span className="section-actions">
            <button
              className="action-button compact"
              type="button"
              onClick={() => setBaseScenariosExpanded((expanded) => !expanded)}
              aria-expanded={isBaseScenariosExpanded}
            >
              {isBaseScenariosExpanded ? "Chiudi" : "Cambia"}
            </button>
            {isBaseScenariosExpanded && (
              <button
                className="action-button compact"
                type="button"
                onClick={() => setBaseScenarioManagementOpen((open) => !open)}
                aria-pressed={isBaseScenarioManagementOpen}
              >
                {isBaseScenarioManagementOpen ? "Fine" : "Gestisci"}
              </button>
            )}
          </span>
        </div>
        <div className="active-scenario base-scenario-summary">
          <span>Scenario attivo</span>
          <strong>{selectedBaseScenario.title}</strong>
          <small>{selectedBaseScenario.body}</small>
        </div>
        {isBaseScenariosExpanded && (
          <>
            <div className="base-list">
              {visibleBaseScenarios.map((scenario) => (
                <div key={scenario.id} className={`sidebar-row-actions base-scenario-row ${scenario.id === baseScenarioId ? "selected" : ""}`}>
                    <button
                      className="saved-scenario-main base-scenario-main"
                      type="button"
                      onClick={() => onLoadBaseScenario(scenario)}
                    >
                    <span>{scenario.title}</span>
                    <small>{scenario.body}</small>
                  </button>
                  {isBaseScenarioManagementOpen && (
                      <button
                        className="icon-button mini danger"
                        type="button"
                        onClick={() => onDeleteBaseScenario(scenario)}
                        aria-label={`Elimina scenario base ${scenario.title}`}
                      title="Elimina scenario base"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              {!visibleBaseScenarios.length && <div className="empty-sidebar-note">Tutti gli scenari base sono stati eliminati dalla lista.</div>}
            </div>
            {hiddenBaseScenarioCount > 0 && (
                <button className="action-button compact" type="button" onClick={restoreBaseScenarios}>
                  Ripristina scenari base
                </button>
            )}
            <div className="hint">Profili simulati da fonti pubbliche e modelli locali: servono per confrontare scenari, non rappresentano offerte ufficiali.</div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="section-title between">
          <span>
            <Route size={18} />
            Concorrenti
            <HelpTooltip>Da qui aggiungi, rinomini, selezioni o elimini i concorrenti. La compilazione centrale lavora sempre sul concorrente attivo.</HelpTooltip>
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
                <label key={lot.id} className={selectedBidder.lots[lot.id].enabled ? lotScore.admitted ? "ok" : "warn" : ""}>
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
                <label key={pair.id} className={selectedBidder.combos[pair.id].enabled ? comboScore.admissible ? "ok" : "warn" : ""}>
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
            onChange={(event) => onSettingsChange({ threshold: Number(event.target.value) })}
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
