import { BarChart3, ChevronDown, CopyPlus, GripVertical, Plus, Route, X } from "lucide-react";
import { useMemo, useState } from "react";
import { getBaseScenario } from "../data/base-scenarios";
import { LOTS, PAIRS, type LotId, type PairId } from "../data/tender";
import { baseIdFromPresetScenarioId, type SavedScenarioSnapshot } from "../lib/scenario-persistence";
import type { Bidder, SimulationResult } from "../lib/scoring";
import { HelpTooltip } from "./help-tooltip";
import { ScenarioTools, type ScenarioLibraryEntry } from "./scenario-panels";
import { useSortableDrag } from "./use-sortable-drag";

type WorkspaceSidebarProps = {
  scenarioName: string;
  savedScenarios: SavedScenarioSnapshot[];
  activeSavedScenarioId?: string;
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
  onReorderSavedScenario: (sourceScenarioId: string, targetScenarioId: string) => void;
  onResetModel: () => void;
  onResetTool: () => void;
  onRestoreRemovedPresets: () => void;
  bidders: Bidder[];
  selectedBidder?: Bidder;
  result: SimulationResult;
  onAddBidder: () => void;
  onDuplicateBidder: (bidderId: string) => void;
  onRemoveBidder: (bidderId: string) => void;
  onReorderBidder: (sourceBidderId: string, targetBidderId: string) => void;
  onSelectBidder: (bidderId: string) => void;
  onSelectedBidderNameChange: (name: string) => void;
  onLotParticipationChange: (lotId: LotId, checked: boolean) => void;
  onDuplicateBidderLotOffer: (sourceLotId: LotId, targetLotId: LotId) => void;
  onExportAll: () => void;
  onComboParticipationChange: (pairId: PairId, checked: boolean) => void;
  selectedLotId: LotId;
};

export function WorkspaceSidebar({
  scenarioName,
  savedScenarios,
  activeSavedScenarioId,
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
  onReorderSavedScenario,
  onResetModel,
  onResetTool,
  onRestoreRemovedPresets,
  bidders,
  selectedBidder,
  result,
  onAddBidder,
  onDuplicateBidder,
  onRemoveBidder,
  onReorderBidder,
  onSelectBidder,
  onSelectedBidderNameChange,
  onLotParticipationChange,
  onDuplicateBidderLotOffer,
  onExportAll,
  onComboParticipationChange,
  selectedLotId,
}: WorkspaceSidebarProps) {
  const sortableBidders = useSortableDrag(onReorderBidder);
  const [openMobilePanels, setOpenMobilePanels] = useState({
    bidders: true,
    participation: true,
  });

  const toggleMobilePanel = (panel: keyof typeof openMobilePanels) => {
    setOpenMobilePanels((current) => ({ ...current, [panel]: !current[panel] }));
  };

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
        hiddenLibraryCount={removedPresetCount}
        onScenarioNameChange={onScenarioNameChange}
        onNew={onNew}
        onSave={onSave}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onExport={onExport}
        onExportAll={onExportAll}
        onExportExcel={onExportExcel}
        onImportFile={onImportFile}
        onLoadEntry={loadLibraryEntry}
        onDeleteEntry={deleteLibraryEntry}
        onReorderEntry={onReorderSavedScenario}
        onRestoreHiddenEntries={onRestoreRemovedPresets}
        onResetModel={onResetModel}
        onResetTool={onResetTool}
      />

      <section className={`panel mobile-collapsible-panel ${openMobilePanels.bidders ? "" : "mobile-collapsed"}`}>
        <div className="section-title between mobile-collapsible-title">
          <span>
            <Route size={18} />
            Concorrenti
            <HelpTooltip>Da qui aggiungi, duplichi, rinomini, selezioni o elimini i concorrenti. La duplicazione copia offerte, partecipazioni e combinatorie del concorrente scelto.</HelpTooltip>
          </span>
          <div className="section-title-actions">
            <button className="icon-button primary" type="button" onClick={onAddBidder} aria-label="Aggiungi concorrente" title="Aggiungi concorrente">
              <Plus size={17} />
            </button>
            <button
              className="mobile-panel-toggle"
              type="button"
              onClick={() => toggleMobilePanel("bidders")}
              aria-expanded={openMobilePanels.bidders}
              aria-label={openMobilePanels.bidders ? "Chiudi pannello Concorrenti" : "Apri pannello Concorrenti"}
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
        <div className="mobile-collapsible-body">
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
            const activeLots = LOTS.filter((lot) => bidder.lots[lot.id].enabled);
            const isSelected = bidder.id === selectedBidder?.id;
            const lotSummary = activeLots.length ? activeLots.map((lot) => lot.shortLabel).join(", ") : "nessun lotto";
            return (
              <div
                key={bidder.id}
                data-sortable-row
                data-sortable-id={bidder.id}
                className={`sidebar-row-actions ${isSelected ? "selected" : ""} ${bidder.id === sortableBidders.draggedId ? "dragging" : ""} ${bidder.id === sortableBidders.dropTargetId ? "drop-target" : ""}`}
                onPointerEnter={() => sortableBidders.markDropTarget(bidder.id)}
              >
                <button
                  className="drag-handle"
                  type="button"
                  onPointerDown={(event) =>
                    sortableBidders.startDrag(event, {
                      id: bidder.id,
                      title: bidder.name,
                      detail: activeLots.length ? `Lotti ${lotSummary}` : "Nessun lotto attivo",
                    })
                  }
                  aria-label={`Riordina concorrente ${bidder.name}`}
                  title="Trascina per riordinare"
                >
                  <GripVertical size={14} />
                </button>
                <button className="offeror-row" type="button" onClick={() => onSelectBidder(bidder.id)} aria-label={`Seleziona concorrente ${bidder.name}, lotti attivi: ${lotSummary}`}>
                  <span>{bidder.name}</span>
                  <small className={`offeror-lot-badges ${activeLots.length ? "" : "empty"}`} aria-hidden="true">
                    {activeLots.length
                      ? activeLots.map((lot) => <span key={lot.id}>{lot.shortLabel}</span>)
                      : <span>Nessun lotto</span>}
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
        {sortableBidders.preview && (
          <div
            className="sortable-drag-preview"
            style={{
              left: sortableBidders.preview.x,
              top: sortableBidders.preview.y,
              width: sortableBidders.preview.width,
            }}
          >
            <strong>{sortableBidders.preview.title}</strong>
            {sortableBidders.preview.detail ? <small>{sortableBidders.preview.detail}</small> : null}
          </div>
        )}
        </div>
      </section>

      {selectedBidder && (
        <section className={`panel mobile-collapsible-panel ${openMobilePanels.participation ? "" : "mobile-collapsed"}`}>
          <div className="section-title mobile-collapsible-title">
            <span>
              <BarChart3 size={18} />
              Partecipazione
              <HelpTooltip>Attiva lotti e combinatorie del concorrente selezionato. Queste opzioni si gestiscono solo dalla barra laterale.</HelpTooltip>
            </span>
            <button
              className="mobile-panel-toggle"
              type="button"
              onClick={() => toggleMobilePanel("participation")}
              aria-expanded={openMobilePanels.participation}
              aria-label={openMobilePanels.participation ? "Chiudi pannello Partecipazione" : "Apri pannello Partecipazione"}
            >
              <ChevronDown size={16} />
            </button>
          </div>
          <div className="mobile-collapsible-body">
          <div className="sidebar-participation-list" aria-label={`Partecipazione ${selectedBidder.name}`}>
          {LOTS.map((lot) => {
            const lotScore = result.lotScores[selectedBidder.id][lot.id];
            const participates = selectedBidder.lots[lot.id].enabled;
            const isSourceLot = lot.id === selectedLotId;
            const sourceLotLabel = LOTS.find((item) => item.id === selectedLotId)?.shortLabel ?? "lotto attivo";
            const lotStatus = participates ? (lotScore.admitted ? "Ammesso" : "Sotto soglia") : "Non attivo";
            return (
              <div key={lot.id} className="sidebar-participation-row">
                <label
                  className={`sidebar-lot-toggle ${participates ? (lotScore.admitted ? "ok" : "warn") : ""}`}
                  title={lot.shortLabel}
                >
                  <span className="sidebar-lot-toggle-copy">
                    <span className="sidebar-lot-toggle-name">{lot.shortLabel}</span>
                    <small>{lotStatus}</small>
                  </span>
                  <input
                    type="checkbox"
                    aria-label={`Partecipa al ${lot.shortLabel} con ${selectedBidder.name}`}
                    checked={participates}
                    onChange={(event) => onLotParticipationChange(lot.id, event.target.checked)}
                  />
                </label>
                <button
                  className="sidebar-duplicate-lot-button"
                  type="button"
                  onClick={() => onDuplicateBidderLotOffer(selectedLotId, lot.id)}
                  disabled={isSourceLot}
                  aria-label={`Copia offerta dal ${sourceLotLabel} a ${lot.shortLabel}`}
                  title={
                    isSourceLot
                      ? "Questo lotto è la sorgente: seleziona un altro lotto per incollare la copia"
                      : `Copia offerta dal ${sourceLotLabel} a ${lot.shortLabel}`
                  }
                >
                  <CopyPlus size={14} />
                  <span>{isSourceLot ? "Origine" : "Copia qui"}</span>
                </button>
              </div>
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
          </div>
        </section>
      )}

    </aside>
  );
}
