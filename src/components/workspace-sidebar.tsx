import { BarChart3, ChevronDown, CopyPlus, GripVertical, Plus, Route, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent, type PointerEvent } from "react";
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
  onReorderSavedScenario: (sourceScenarioId: string, targetScenarioId: string) => void;
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
  onReorderBidder: (sourceBidderId: string, targetBidderId: string) => void;
  onSelectBidder: (bidderId: string) => void;
  onSelectedBidderNameChange: (name: string) => void;
  onLotParticipationChange: (lotId: LotId, checked: boolean) => void;
  onDuplicateBidderLotOffer: (sourceLotId: LotId, targetLotId: LotId) => void;
  onExportAll: () => void;
  onComboParticipationChange: (pairId: PairId, checked: boolean) => void;
  onSettingsChange: (patch: Partial<Settings>) => void;
  selectedLotId: LotId;
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
  onReorderSavedScenario,
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
  onReorderBidder,
  onSelectBidder,
  onSelectedBidderNameChange,
  onLotParticipationChange,
  onDuplicateBidderLotOffer,
  onExportAll,
  onComboParticipationChange,
  onSettingsChange,
  selectedLotId,
}: WorkspaceSidebarProps) {
  const activeThresholdOption = THRESHOLD_OPTIONS.find((option) => option.value === settings.threshold) ?? THRESHOLD_OPTIONS[0];
  const [draggedBidderId, setDraggedBidderId] = useState<string>();
  const [dropTargetBidderId, setDropTargetBidderId] = useState<string>();
  const [openMobilePanels, setOpenMobilePanels] = useState({
    bidders: true,
    participation: true,
    settings: false,
  });

  const toggleMobilePanel = (panel: keyof typeof openMobilePanels) => {
    setOpenMobilePanels((current) => ({ ...current, [panel]: !current[panel] }));
  };

  useEffect(() => {
    if (!draggedBidderId) return undefined;
    document.addEventListener("pointerup", clearBidderDrag);
    return () => document.removeEventListener("pointerup", clearBidderDrag);
  }, [draggedBidderId]);

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

  const startBidderDrag = (event: DragEvent<HTMLButtonElement>, bidder: Bidder) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", bidder.id);
    setDraggedBidderId(bidder.id);
    setDropTargetBidderId(undefined);
  };

  const startBidderPointerDrag = (event: PointerEvent<HTMLButtonElement>, bidder: Bidder) => {
    event.preventDefault();
    setDraggedBidderId(bidder.id);
    setDropTargetBidderId(undefined);
  };

  const markBidderDropTarget = (event: DragEvent<HTMLDivElement>, bidder: Bidder) => {
    if (!draggedBidderId || draggedBidderId === bidder.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetBidderId(bidder.id);
  };

  const dropBidder = (event: DragEvent<HTMLDivElement>, bidder: Bidder) => {
    event.preventDefault();
    finishBidderDrop(bidder);
  };

  const finishBidderDrop = (bidder: Bidder) => {
    if (draggedBidderId && draggedBidderId !== bidder.id) onReorderBidder(draggedBidderId, bidder.id);
    setDraggedBidderId(undefined);
    setDropTargetBidderId(undefined);
  };

  const clearBidderDrag = () => {
    setDraggedBidderId(undefined);
    setDropTargetBidderId(undefined);
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
            const activeLots = LOTS.filter((lot) => bidder.lots[lot.id].enabled).length;
            const isSelected = bidder.id === selectedBidder?.id;
            return (
              <div
                key={bidder.id}
                className={`sidebar-row-actions ${isSelected ? "selected" : ""} ${bidder.id === draggedBidderId ? "dragging" : ""} ${bidder.id === dropTargetBidderId ? "drop-target" : ""}`}
                onDragEnter={(event) => markBidderDropTarget(event, bidder)}
                onDragOver={(event) => markBidderDropTarget(event, bidder)}
                onDrop={(event) => dropBidder(event, bidder)}
                onPointerEnter={() => {
                  if (draggedBidderId && draggedBidderId !== bidder.id) setDropTargetBidderId(bidder.id);
                }}
                onPointerUp={() => finishBidderDrop(bidder)}
              >
                <button
                  className="drag-handle"
                  type="button"
                  draggable
                  onPointerDown={(event) => startBidderPointerDrag(event, bidder)}
                  onDragStart={(event) => startBidderDrag(event, bidder)}
                  onDragEnd={clearBidderDrag}
                  aria-label={`Riordina concorrente ${bidder.name}`}
                  title="Trascina per riordinare"
                >
                  <GripVertical size={14} />
                </button>
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

      <section className={`panel mobile-collapsible-panel ${openMobilePanels.settings ? "" : "mobile-collapsed"}`}>
        <div className="section-title mobile-collapsible-title">
          <span>
            <SlidersHorizontal size={18} />
            Parametri
            <HelpTooltip>Qui scegli la soglia di sbarramento e l'eventuale deroga: cambia questi parametri quando vuoi testare una lettura più o meno selettiva.</HelpTooltip>
          </span>
          <button
            className="mobile-panel-toggle"
            type="button"
            onClick={() => toggleMobilePanel("settings")}
            aria-expanded={openMobilePanels.settings}
            aria-label={openMobilePanels.settings ? "Chiudi pannello Parametri" : "Apri pannello Parametri"}
          >
            <ChevronDown size={16} />
          </button>
        </div>
        <div className="mobile-collapsible-body">
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
        </div>
      </section>
    </aside>
  );
}
