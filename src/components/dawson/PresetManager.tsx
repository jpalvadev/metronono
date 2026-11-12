import React, { useState, useCallback, useMemo } from 'react';
import {
  DawsonSystem,
  SubdivisionFormula,
  OstinatoPattern,
} from '../../domain/dawson/types';
import {
  DawsonPresetManager,
  resolveStrokeOffsets,
} from '../../domain/dawson/SubdivisionFormula';
import { IDrumKitPlayer } from '../../audio/types';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Play,
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
import { dynamicToVelocity } from './PartitureFormulaCanvas';
import { FormulaEditorDialog } from './FormulaEditorDialog';

export interface PresetManagerProps {
  open: boolean;
  onClose: () => void;
  presetManager: DawsonPresetManager;
  activeSystemId: string;
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
  const [ostinatos, setOstinatos] = useState<OstinatoPattern[]>(() =>
    presetManager.getAllOstinatos()
  );
  const [activeTab, setActiveTab] = useState<'systems' | 'formulas' | 'ostinatos'>('systems');

  // New System Form State
  const [isCreatingSystem, setIsCreatingSystem] = useState(false);
  const [newSystemName, setNewSystemName] = useState('');
  const [selectedShortId, setSelectedShortId] = useState<string>('single_snare');
  const [selectedLongId, setSelectedLongId] = useState<string>('single_kick');

  // Formula & Ostinato Editor Modal State
  const [isFormulaDialogOpen, setIsFormulaDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<SubdivisionFormula | null>(null);
  const [editingOstinato, setEditingOstinato] = useState<OstinatoPattern | null>(null);
  const [formulaDefaultTrigger, setFormulaDefaultTrigger] = useState<'short' | 'long'>('short');
  const [formulaTargetBeats, setFormulaTargetBeats] = useState<number | undefined>(undefined);

  const refreshData = useCallback(() => {
    setSystems(presetManager.getAllSystems());
    setOstinatos(presetManager.getAllOstinatos());
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
      isCustom: true,
    };

    presetManager.saveSystem(newSystem);
    refreshData();
    setIsCreatingSystem(false);
    setNewSystemName('');
  };

  const handleOpenNewFormula = (trigger: 'short' | 'long') => {
    setEditingOstinato(null);
    setEditingFormula(null);
    setFormulaDefaultTrigger(trigger);
    setFormulaTargetBeats(trigger === 'short' ? 0.5 : 1.0);
    setIsFormulaDialogOpen(true);
  };

  const handleEditFormula = (formula: SubdivisionFormula) => {
    setEditingOstinato(null);
    setEditingFormula(formula);
    setFormulaDefaultTrigger(formula.trigger);
    setFormulaTargetBeats(formula.trigger === 'short' ? 0.5 : 1.0);
    setIsFormulaDialogOpen(true);
  };

  const handleSaveFormulaOrOstinato = (savedFormula: SubdivisionFormula) => {
    if (formulaTargetBeats === 4) {
      let saveName = savedFormula.name;
      let saveId = savedFormula.id;
      if (editingOstinato && !editingOstinato.isCustom) {
        if (!saveName.includes('(Copia)')) {
          saveName = `${saveName} (Copia)`;
        }
        saveId = `custom_ost_${editingOstinato.id}_${Date.now()}`;
      }
      presetManager.saveOstinato({
        id: saveId,
        name: saveName,
        timeSignature: [4, 4],
        strokes: savedFormula.strokes,
        description: savedFormula.description,
        isCustom: true,
      });
      refreshData();
    } else {
      presetManager.saveFormula(savedFormula);
      refreshData();
    }
    setIsFormulaDialogOpen(false);
    setEditingOstinato(null);
  };

  const handleDeleteFormula = (formulaId: string) => {
    presetManager.deleteFormula(formulaId);
    refreshData();
  };

  // Ostinato actions
  const handleOpenNewOstinato = () => {
    setEditingOstinato(null);
    setEditingFormula({
      id: `custom_ost_${Date.now()}`,
      name: 'Nuevo Ostinato',
      trigger: 'long',
      strokes: [
        { durationRatio: 1.0, isRest: true, hits: [] },
        { durationRatio: 1.0, isRest: true, hits: [] },
        { durationRatio: 1.0, isRest: true, hits: [] },
        { durationRatio: 1.0, isRest: true, hits: [] },
      ],
      isCustom: true,
    });
    setFormulaDefaultTrigger('long');
    setFormulaTargetBeats(4);
    setIsFormulaDialogOpen(true);
  };

  const handleEditOstinato = (ost: OstinatoPattern) => {
    setEditingOstinato(ost);
    setEditingFormula({
      id: ost.id,
      name: ost.name,
      trigger: 'long',
      strokes: ost.strokes,
      description: ost.description,
      isCustom: ost.isCustom,
    });
    setFormulaDefaultTrigger('long');
    setFormulaTargetBeats(4);
    setIsFormulaDialogOpen(true);
  };

  const handleDeleteOstinato = (ostId: string) => {
    presetManager.deleteOstinato(ostId);
    refreshData();
  };

  const handleAuditionOstinato = (ost: OstinatoPattern) => {
    if (!player || ost.strokes.length === 0) return;
    const tempoBpm = 100;
    const beatDurationMs = (60 / tempoBpm) * 1000;
    const resolved = resolveStrokeOffsets(ost.strokes, 0);

    resolved.forEach(({ stroke, offset }) => {
      if (stroke.isRest || !stroke.hits) return;
      const delayMs = offset * beatDurationMs;
      stroke.hits.forEach((hit) => {
        const vel = dynamicToVelocity(hit.dynamic);
        if (delayMs <= 0) {
          player.triggerVoice(hit.voice, 0, vel, 'ostinato');
        } else {
          setTimeout(() => {
            player.triggerVoice(hit.voice, 0, vel, 'ostinato');
          }, delayMs);
        }
      });
    });
  };

  const handleAuditionFormula = (formula: SubdivisionFormula) => {
    if (!player || formula.strokes.length === 0) return;
    const tempoBpm = 100;
    const beatDurationMs = (60 / tempoBpm) * 1000;
    const resolved = resolveStrokeOffsets(formula.strokes, 0);

    resolved.forEach(({ stroke, offset }) => {
      if (stroke.isRest || !stroke.hits) return;
      const delayMs = offset * beatDurationMs;
      stroke.hits.forEach((hit) => {
        const vel = dynamicToVelocity(hit.dynamic);
        if (delayMs <= 0) {
          player.triggerVoice(hit.voice, 0, vel, 'orchestration');
        } else {
          setTimeout(() => {
            player.triggerVoice(hit.voice, 0, vel, 'orchestration');
          }, delayMs);
        }
      });
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-scrim animate-in fade-in duration-150">
        <div className="bg-card border border-border w-full max-w-3xl rounded-none shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-5 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-none bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
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
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Sistemas / Interpretation Systems ({systems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('formulas')}
              className={cn(
                'px-4 py-2 text-xs font-semibold border-b-2 transition-all',
                activeTab === 'formulas'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Fórmulas / Subdivision Formulas ({shortFormulas.length + longFormulas.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ostinatos')}
              className={cn(
                'px-4 py-2 text-xs font-semibold border-b-2 transition-all',
                activeTab === 'ostinatos'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Ostinatos ({ostinatos.length})
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 md:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
            {activeTab === 'systems' && (
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
                      className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/80 text-primary-foreground rounded-none"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New System
                    </Button>
                  )}
                </div>

                {/* New System Form Drawer */}
                {isCreatingSystem && (
                  <div className="bg-muted/30 border border-primary/40 rounded-none p-4 flex flex-col gap-3.5">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Create Custom Dawson System
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCreatingSystem(false)}
                        className="h-6 w-6 p-0 text-muted-foreground rounded-none"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="system-name-input"
                          className="text-[11px] font-semibold text-muted-foreground uppercase"
                        >
                          System Name
                        </label>
                        <input
                          id="system-name-input"
                          type="text"
                          value={newSystemName}
                          onChange={(e) => setNewSystemName(e.target.value)}
                          placeholder="e.g. Bop Songo Fusion"
                          className="bg-card border border-border rounded-none px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="short-formula-select"
                          className="text-[11px] font-semibold text-primary uppercase"
                        >
                          Short Formula
                        </label>
                        <select
                          id="short-formula-select"
                          value={selectedShortId}
                          onChange={(e) => setSelectedShortId(e.target.value)}
                          className="bg-card border border-border rounded-none px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {shortFormulas.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor="long-formula-select"
                          className="text-[11px] font-semibold text-destructive uppercase"
                        >
                          Long Formula
                        </label>
                        <select
                          id="long-formula-select"
                          value={selectedLongId}
                          onChange={(e) => setSelectedLongId(e.target.value)}
                          className="bg-card border border-border rounded-none px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {longFormulas.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCreatingSystem(false)}
                        className="h-7 text-xs rounded-none"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveNewSystem}
                        disabled={!newSystemName.trim()}
                        className="h-7 text-xs bg-primary hover:bg-primary/80 text-primary-foreground gap-1.5 rounded-none"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Save System
                      </Button>
                    </div>
                  </div>
                )}

                {/* Systems Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {systems.map((sys) => {
                    const isActive = activeSystemId === sys.id;
                    return (
                      <div
                        key={sys.id}
                        className={cn(
                          'p-4 rounded-none border flex flex-col justify-between gap-3 transition-all',
                          isActive
                            ? 'bg-primary/10 border-primary/60 ring-1 ring-primary'
                            : 'bg-card border-border hover:border-border/80'
                        )}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-foreground">
                              {sys.name}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {sys.isCustom ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-mono border-border text-muted-foreground rounded-none"
                                >
                                  Custom
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-mono border-primary/40 text-primary bg-primary/5 rounded-none"
                                >
                                  Built-in
                                </Badge>
                              )}
                            </div>
                          </div>

                          {sys.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {sys.description}
                            </p>
                          )}

                          {/* Formulas Breakdown */}
                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-muted/30 p-2.5 rounded-none border border-border/50">
                            <div>
                              <span className="text-primary font-semibold block uppercase text-[10px]">
                                Short
                              </span>
                              <span className="text-foreground truncate block font-medium">
                                {sys.shortFormula?.name || 'Snare'}
                              </span>
                            </div>
                            <div>
                              <span className="text-destructive font-semibold block uppercase text-[10px]">
                                Long
                              </span>
                              <span className="text-foreground truncate block font-medium">
                                {sys.longFormula?.name || 'Kick'}
                              </span>
                            </div>
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
                                className="h-7 px-2 text-destructive hover:bg-destructive/10 gap-1 text-xs rounded-none"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
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
                              'h-7 px-3 text-xs rounded-none',
                              !isActive && 'bg-primary hover:bg-primary/80 text-primary-foreground'
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
            )}

            {activeTab === 'formulas' && (
              /* --- FORMULAS TAB --- */
              <div className="flex flex-col gap-6">
                {/* Short Formulas Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
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
                      className="h-7 text-xs bg-primary hover:bg-primary/80 text-primary-foreground gap-1 rounded-none"
                    >
                      <Plus className="w-3 h-3" /> New Short Formula
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {shortFormulas.map((formula) => (
                      <div
                        key={formula.id}
                        className="bg-card/70 border border-border/70 rounded-none p-3 flex flex-col justify-between gap-2.5"
                      >
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-foreground">
                              {formula.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] font-mono rounded-none',
                                formula.isCustom
                                  ? 'border-border text-muted-foreground'
                                  : 'border-primary/40 text-primary bg-primary/5'
                              )}
                            >
                              {formula.isCustom ? 'Custom' : 'Built-in'}
                            </Badge>
                          </div>
                          {formula.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {formula.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1 flex-wrap">
                            {formula.strokes.map((s, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded-none bg-muted/50 border border-border/60 text-[10px] font-mono"
                              >
                                {s.isRest ? 'rest' : s.hits.map((h) => h.voice).join('+')}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-border/40">
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAuditionFormula(formula)}
                              className="h-6 px-2 text-[11px] text-primary gap-1 rounded-none"
                            >
                              <Play className="w-3 h-3 fill-current" /> Audition
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditFormula(formula)}
                              className="h-6 px-2 text-[11px] border-border gap-1 rounded-none"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </Button>
                          </div>

                          {formula.isCustom && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteFormula(formula.id)}
                              className="h-6 px-1.5 text-destructive hover:bg-destructive/10 rounded-none"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Long Formulas Section */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-destructive">
                        Long Note Formulas (≥ Quarter Note)
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Triggered on anchored quarter notes, tied syncopations, and half notes
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleOpenNewFormula('long')}
                      className="h-7 text-xs bg-primary hover:bg-primary/80 text-primary-foreground gap-1 rounded-none"
                    >
                      <Plus className="w-3 h-3" /> New Long Formula
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {longFormulas.map((formula) => (
                      <div
                        key={formula.id}
                        className="bg-card/70 border border-border/70 rounded-none p-3 flex flex-col justify-between gap-2.5"
                      >
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-foreground">
                              {formula.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] font-mono rounded-none',
                                formula.isCustom
                                  ? 'border-border text-muted-foreground'
                                  : 'border-destructive/40 text-destructive bg-destructive/5'
                              )}
                            >
                              {formula.isCustom ? 'Custom' : 'Built-in'}
                            </Badge>
                          </div>
                          {formula.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {formula.description}
                            </p>
                          )}
                          <div className="flex items-center gap-1 flex-wrap">
                            {formula.strokes.map((s, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded-none bg-muted/50 border border-border/60 text-[10px] font-mono"
                              >
                                {s.isRest ? 'rest' : s.hits.map((h) => h.voice).join('+')}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-border/40">
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAuditionFormula(formula)}
                              className="h-6 px-2 text-[11px] text-destructive gap-1 rounded-none"
                            >
                              <Play className="w-3 h-3 fill-current" /> Audition
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditFormula(formula)}
                              className="h-6 px-2 text-[11px] border-border gap-1 rounded-none"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </Button>
                          </div>

                          {formula.isCustom && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteFormula(formula.id)}
                              className="h-6 px-1.5 text-destructive hover:bg-destructive/10 rounded-none"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ostinatos' && (
              /* --- OSTINATOS TAB --- */
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Manage 4/4 background ostinatos and cymbal/foot independence loops:
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleOpenNewOstinato}
                    className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/80 text-primary-foreground rounded-none"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Ostinato
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ostinatos.map((ost) => (
                    <div
                      key={ost.id}
                      className="p-3.5 rounded-none border border-border bg-card/70 flex flex-col justify-between gap-3"
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-foreground uppercase tracking-wide flex items-center gap-1.5">
                            <Disc className="w-3.5 h-3.5 text-primary" />
                            {ost.name}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-mono rounded-none',
                              ost.isCustom
                                ? 'border-border text-muted-foreground'
                                : 'border-primary/40 text-primary bg-primary/5'
                            )}
                          >
                            {ost.isCustom ? 'Custom' : 'Fábrica / Built-in'}
                          </Badge>
                        </div>
                        {ost.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {ost.description}
                          </p>
                        )}
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Compass: {ost.timeSignature ? `${ost.timeSignature[0]}/${ost.timeSignature[1]}` : '4/4'} ({ost.strokes.length} strokes)
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAuditionOstinato(ost)}
                            className="h-6 px-2 text-[11px] text-primary gap-1 rounded-none"
                          >
                            <Play className="w-3 h-3 fill-current" /> Audition
                          </Button>
                          <Button
                            type="button"
                            data-testid={`edit-ostinato-${ost.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditOstinato(ost)}
                            className="h-6 px-2 text-[11px] border-border gap-1 rounded-none"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
                          </Button>
                        </div>

                        {ost.isCustom ? (
                          <Button
                            type="button"
                            data-testid={`delete-ostinato-${ost.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteOstinato(ost.id)}
                            className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10 gap-1 rounded-none"
                          >
                            <Trash2 className="w-3 h-3" /> Eliminar
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            data-testid={`delete-ostinato-${ost.id}`}
                            variant="ghost"
                            size="sm"
                            disabled
                            className="h-6 px-2 text-[11px] text-muted-foreground opacity-40 rounded-none cursor-not-allowed"
                          >
                            <Trash2 className="w-3 h-3" /> Eliminar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
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
              className="h-9 px-4 text-xs rounded-none"
            >
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* Formula & Ostinato Editor Modal */}
      {isFormulaDialogOpen && (
        <FormulaEditorDialog
          open={isFormulaDialogOpen}
          onClose={() => setIsFormulaDialogOpen(false)}
          formula={editingFormula}
          defaultTrigger={formulaDefaultTrigger}
          targetBeats={formulaTargetBeats}
          onSave={handleSaveFormulaOrOstinato}
          onDelete={editingOstinato ? handleDeleteOstinato : handleDeleteFormula}
          player={player}
        />
      )}
    </>
  );
};
