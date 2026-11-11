import React, { useState, useCallback, useMemo } from 'react';
import {
  DawsonSystem,
  SubdivisionFormula,
  OstinatoType,
} from '../../domain/dawson/types';
import {
  DawsonPresetManager,
} from '../../domain/dawson/SubdivisionFormula';
import { IDrumKitPlayer } from '../../audio/types';
import { FormulaEditorDialog } from './FormulaEditorDialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Sliders,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  Disc,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PresetManagerProps {
  open: boolean;
  onClose: () => void;
  presetManager: DawsonPresetManager;
  activeSystemId?: string;
  onSelectSystem: (system: DawsonSystem) => void;
  player?: IDrumKitPlayer;
}

export const PresetManager: React.FC<PresetManagerProps> = ({
  open,
  onClose,
  presetManager,
  activeSystemId,
  onSelectSystem,
  player,
}) => {
  const [systems, setSystems] = useState<DawsonSystem[]>(() =>
    presetManager.getAllSystems()
  );
  const [activeTab, setActiveTab] = useState<'systems' | 'formulas'>('systems');

  // New System Form State
  const [isCreatingSystem, setIsCreatingSystem] = useState(false);
  const [newSystemName, setNewSystemName] = useState('');
  const [selectedShortId, setSelectedShortId] = useState<string>('single_snare');
  const [selectedLongId, setSelectedLongId] = useState<string>('single_kick');
  const [selectedOstinato, setSelectedOstinato] = useState<OstinatoType>('jazz_swing');

  // Formula Editor Modal State
  const [isFormulaDialogOpen, setIsFormulaDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<SubdivisionFormula | null>(null);
  const [formulaDefaultTrigger, setFormulaDefaultTrigger] = useState<'short' | 'long'>('short');

  const refreshData = useCallback(() => {
    setSystems(presetManager.getAllSystems());
  }, [presetManager]);

  const shortFormulas = useMemo(
    () => presetManager.getFormulasByTrigger('short'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [presetManager, isFormulaDialogOpen, systems]
  );

  const longFormulas = useMemo(
    () => presetManager.getFormulasByTrigger('long'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [presetManager, isFormulaDialogOpen, systems]
  );

  if (!open) return null;

  const handleApplySystem = (system: DawsonSystem) => {
    onSelectSystem(system);
  };

  const handleDeleteSystem = (systemId: string) => {
    presetManager.deleteSystem(systemId);
    refreshData();
  };

  const handleSaveNewSystem = () => {
    const trimmedName = newSystemName.trim();
    if (!trimmedName) return;

    const shortFormula =
      presetManager.getFormula(selectedShortId) || shortFormulas[0];
    const longFormula =
      presetManager.getFormula(selectedLongId) || longFormulas[0];

    const systemId = `custom_sys_${Date.now()}`;
    const newSystem: DawsonSystem = {
      id: systemId,
      name: trimmedName,
      shortFormula,
      longFormula,
      ostinatoId: selectedOstinato,
      isCustom: true,
    };

    presetManager.saveSystem(newSystem);
    refreshData();
    setIsCreatingSystem(false);
    setNewSystemName('');
  };

  const handleOpenNewFormula = (trigger: 'short' | 'long') => {
    setEditingFormula(null);
    setFormulaDefaultTrigger(trigger);
    setIsFormulaDialogOpen(true);
  };

  const handleEditFormula = (formula: SubdivisionFormula) => {
    setEditingFormula(formula);
    setFormulaDefaultTrigger(formula.trigger);
    setIsFormulaDialogOpen(true);
  };

  const handleSaveFormula = (formula: SubdivisionFormula) => {
    presetManager.saveFormula(formula);
    refreshData();
  };

  const handleDeleteFormula = (formulaId: string) => {
    presetManager.deleteFormula(formulaId);
    refreshData();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="bg-card border border-border w-full max-w-3xl rounded-none shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-5 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-none bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Dawson Systems & Formula Manager
                </h2>
                <p className="text-xs text-muted-foreground">
                  Manage orchestration presets and custom subdivision formulas
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-none flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 px-4 md:px-6 pt-3 border-b border-border/40 bg-muted/20">
            <button
              type="button"
              onClick={() => setActiveTab('systems')}
              className={cn(
                'px-4 py-2 text-xs font-semibold border-b-2 transition-all',
                activeTab === 'systems'
                  ? 'border-teal-500 text-teal-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Interpretation Systems ({systems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('formulas')}
              className={cn(
                'px-4 py-2 text-xs font-semibold border-b-2 transition-all',
                activeTab === 'formulas'
                  ? 'border-teal-500 text-teal-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Subdivision Formulas ({shortFormulas.length + longFormulas.length})
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 md:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
            {activeTab === 'systems' ? (
              /* --- SYSTEMS TAB --- */
              <div className="flex flex-col gap-4">
                {/* Actions Row */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Select a Dawson System to orchestrate reading lines across your kit:
                  </span>
                  {!isCreatingSystem && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsCreatingSystem(true)}
                      className="h-8 gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New System
                    </Button>
                  )}
                </div>

                {/* New System Form Drawer */}
                {isCreatingSystem && (
                  <div className="bg-muted/30 border border-teal-500/40 rounded-xl p-4 flex flex-col gap-3.5">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <span className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Create Custom Dawson System
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCreatingSystem(false)}
                        className="h-6 w-6 p-0 text-muted-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {/* System Name */}
                      <div className="flex flex-col gap-1 sm:col-span-2">
                        <label
                          htmlFor="new-system-name"
                          className="text-[11px] font-semibold text-muted-foreground"
                        >
                          System Name
                        </label>
                        <input
                          id="new-system-name"
                          type="text"
                          value={newSystemName}
                          onChange={(e) => setNewSystemName(e.target.value)}
                          placeholder="e.g. Tony Williams Fusion"
                          className="bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                      {/* Ostinato Selector */}
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="new-system-ostinato"
                          className="text-[11px] font-semibold text-muted-foreground"
                        >
                          Ostinato Pattern
                        </label>
                        <select
                          id="new-system-ostinato"
                          value={selectedOstinato}
                          onChange={(e) =>
                            setSelectedOstinato(e.target.value as OstinatoType)
                          }
                          className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
                        >
                          <option value="jazz_swing">Jazz Swing Ride</option>
                          <option value="straight_rock">Straight 8ths Hi-Hat</option>
                          <option value="none">Silenced (No Ostinato)</option>
                        </select>
                      </div>

                      {/* Short Formula */}
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="new-system-short-formula"
                          className="text-[11px] font-semibold text-muted-foreground"
                        >
                          Short Notes (≤ 8th)
                        </label>
                        <select
                          id="new-system-short-formula"
                          value={selectedShortId}
                          onChange={(e) => setSelectedShortId(e.target.value)}
                          className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
                        >
                          {shortFormulas.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Long Formula */}
                      <div className="flex flex-col gap-1 sm:col-span-2">
                        <label
                          htmlFor="new-system-long-formula"
                          className="text-[11px] font-semibold text-muted-foreground"
                        >
                          Long Notes (≥ Qtr / Ties)
                        </label>
                        <select
                          id="new-system-long-formula"
                          value={selectedLongId}
                          onChange={(e) => setSelectedLongId(e.target.value)}
                          className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
                        >
                          {longFormulas.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCreatingSystem(false)}
                        className="h-8 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveNewSystem}
                        disabled={!newSystemName.trim()}
                        className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                      >
                        Save System
                      </Button>
                    </div>
                  </div>
                )}

                {/* Systems Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {systems.map((sys) => {
                    const isActive = sys.id === activeSystemId;
                    return (
                      <div
                        key={sys.id}
                        className={cn(
                          'p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all',
                          isActive
                            ? 'bg-teal-500/10 border-teal-500/60 ring-1 ring-teal-500/30'
                            : 'bg-card/70 border-border/70 hover:border-border hover:bg-muted/30'
                        )}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground">
                                {sys.name}
                              </span>
                              {sys.isCustom && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-amber-500/40 text-amber-400"
                                >
                                  Custom
                                </Badge>
                              )}
                            </div>
                            {isActive && (
                              <Badge className="bg-teal-600 text-white text-[10px] gap-1">
                                <Check className="w-3 h-3" /> Active
                              </Badge>
                            )}
                          </div>

                          {sys.description && (
                            <p className="text-xs text-muted-foreground">
                              {sys.description}
                            </p>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-muted/30 p-2.5 rounded-lg border border-border/50">
                            <div>
                              <span className="text-muted-foreground block font-medium">
                                Short Notes:
                              </span>
                              <span className="text-foreground font-semibold">
                                {sys.shortFormula.name}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block font-medium">
                                Long Notes:
                              </span>
                              <span className="text-foreground font-semibold">
                                {sys.longFormula.name}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Disc className="w-3 h-3 text-teal-400" />
                            <span>Ostinato: </span>
                            <span className="text-foreground font-medium">
                              {sys.ostinatoId === 'jazz_swing'
                                ? 'Jazz Swing Ride'
                                : sys.ostinatoId === 'straight_rock'
                                ? 'Straight 8ths'
                                : 'Silenced'}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/40">
                          <div>
                            {sys.isCustom && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                data-testid={`delete-system-${sys.id}`}
                                onClick={() => handleDeleteSystem(sys.id)}
                                className="h-7 px-2 text-xs text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </Button>
                            )}
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            data-testid={`apply-system-${sys.id}`}
                            variant={isActive ? 'secondary' : 'default'}
                            onClick={() => handleApplySystem(sys)}
                            className={cn(
                              'h-7 px-3 text-xs',
                              !isActive && 'bg-teal-600 hover:bg-teal-700 text-white'
                            )}
                          >
                            {isActive ? 'Current System' : 'Apply System'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* --- FORMULAS TAB --- */
              <div className="flex flex-col gap-6">
                {/* Short Formulas Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400">
                        Short Note Formulas (≤ 8th Note)
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Triggered on rapid syncopated 8th notes and pickup figures
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleOpenNewFormula('short')}
                      className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white gap-1"
                    >
                      <Plus className="w-3 h-3" /> New Short Formula
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {shortFormulas.map((formula) => (
                      <div
                        key={formula.id}
                        className="bg-card/70 border border-border/70 rounded-xl p-3 flex flex-col justify-between gap-2.5"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">
                              {formula.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono border-teal-500/30 text-teal-400"
                            >
                              {formula.strokes.length} stroke
                              {formula.strokes.length === 1 ? '' : 's'}
                            </Badge>
                          </div>
                          {formula.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {formula.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {formula.strokes.map((s, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/60 text-[10px] font-mono"
                              >
                                {s.isRest ? 'rest' : s.hits.map((h) => h.voice).join('+')}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/30">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditFormula(formula)}
                            className="h-7 px-2 text-xs gap-1"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Long Formulas Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">
                        Long Note Formulas (≥ Quarter Note / Tied Notes)
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Triggered on sustained quarter notes, dotted figures, and tied anchors
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleOpenNewFormula('long')}
                      className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white gap-1"
                    >
                      <Plus className="w-3 h-3" /> New Long Formula
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {longFormulas.map((formula) => (
                      <div
                        key={formula.id}
                        className="bg-card/70 border border-border/70 rounded-xl p-3 flex flex-col justify-between gap-2.5"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">
                              {formula.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono border-rose-500/30 text-rose-400"
                            >
                              {formula.strokes.length} stroke
                              {formula.strokes.length === 1 ? '' : 's'}
                            </Badge>
                          </div>
                          {formula.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {formula.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {formula.strokes.map((s, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/60 text-[10px] font-mono"
                              >
                                {s.isRest ? 'rest' : s.hits.map((h) => h.voice).join('+')}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/30">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditFormula(formula)}
                            className="h-7 px-2 text-xs gap-1"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end p-4 border-t border-border/60 bg-muted/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 px-4 text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* Formula Editor Modal */}
      {isFormulaDialogOpen && (
        <FormulaEditorDialog
          open={isFormulaDialogOpen}
          onClose={() => setIsFormulaDialogOpen(false)}
          formula={editingFormula}
          defaultTrigger={formulaDefaultTrigger}
          onSave={handleSaveFormula}
          onDelete={handleDeleteFormula}
          player={player}
        />
      )}
    </>
  );
};
