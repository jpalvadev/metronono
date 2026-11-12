import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ToneTransportScheduler } from '../audio/ToneTransportScheduler';
import {
  OstinatoType,
  OstinatoPattern,
  SubdivisionFormula,
  DawsonSystem,
} from '../domain/dawson/types';
import {
  DawsonPresetManager,
  resolveStrokeOffsets,
  FACTORY_OSTINATOS,
} from '../domain/dawson/SubdivisionFormula';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Disc,
  Sliders,
  Layers,
  Edit3,
  Play,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { FormulaEditorDialog } from './dawson/FormulaEditorDialog';
import { PresetManager } from './dawson/PresetManager';
import { DrumStaffViewer } from './dawson/DrumStaffViewer';

export interface DawsonOrchestrationSectionProps {
  scheduler: ToneTransportScheduler;
  presetManager?: DawsonPresetManager;
  className?: string;
}

export const DawsonOrchestrationSection: React.FC<DawsonOrchestrationSectionProps> = ({
  scheduler,
  presetManager: externalPresetManager,
  className,
}) => {
  const engine = useMemo(() => scheduler.getDawsonEngine(), [scheduler]);
  const player = useMemo(() => scheduler.getDrumKitPlayer(), [scheduler]);

  const presetManager = useMemo(
    () => externalPresetManager ?? new DawsonPresetManager(),
    [externalPresetManager]
  );

  const [ostinato, setOstinato] = useState<OstinatoType>(() => engine.getOstinato());
  const [activeSystemId, setActiveSystemId] = useState<string>(() => engine.getSystem()?.id ?? 'snare_and_kick');
  const [shortFormula, setShortFormula] = useState<SubdivisionFormula>(() => engine.getShortFormula());
  const [longFormula, setLongFormula] = useState<SubdivisionFormula>(() => engine.getLongFormula());

  // Listen to engine changes
  useEffect(() => {
    return engine.onChange(() => {
      setOstinato(engine.getOstinato());
      const sys = engine.getSystem();
      setActiveSystemId(sys ? sys.id : 'none');
      setShortFormula(engine.getShortFormula());
      setLongFormula(engine.getLongFormula());
    });
  }, [engine]);

  // Modal dialog states
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
  const [isFormulaDialogOpen, setIsFormulaDialogOpen] = useState(false);
  const [isEditingOstinato, setIsEditingOstinato] = useState(false);
  const [editingFormula, setEditingFormula] = useState<SubdivisionFormula | null>(null);
  const [editingTargetBeats, setEditingTargetBeats] = useState<number | undefined>(undefined);
  const [formulaDefaultTrigger, setFormulaDefaultTrigger] = useState<'short' | 'long'>('short');

  const activeOstinatoPattern = useMemo(() => {
    if (ostinato === 'none') return undefined;
    return engine.getOstinatoPattern();
  }, [engine, ostinato]);

  const allOstinatos = useMemo(() => presetManager.getAllOstinatos(), [presetManager]);
  const customOstinatos = useMemo(() => allOstinatos.filter((o) => o.isCustom), [allOstinatos]);

  const allSystems = useMemo(() => presetManager.getAllSystems(), [presetManager]);
  const customSystems = useMemo(() => allSystems.filter((s) => s.isCustom), [allSystems]);
  const legacySystems = useMemo(
    () =>
      allSystems.filter(
        (s) =>
          !s.isCustom &&
          s.id !== 'snare_and_kick' &&
          s.id !== 'hihat_foot_and_kick'
      ),
    [allSystems]
  );

  const handleSelectSystem = useCallback(
    (system: DawsonSystem) => {
      engine.setSystem(system);
      setActiveSystemId(system.id);
      setShortFormula(system.shortFormula);
      setLongFormula(system.longFormula);
      setIsPresetManagerOpen(false);
    },
    [engine]
  );

  const handleSelectSystemId = useCallback(
    (systemId: string) => {
      setActiveSystemId(systemId);
      if (systemId === 'none') {
        engine.setSystem('none');
      } else {
        const found = presetManager.getSystem(systemId);
        if (found) {
          engine.setSystem(found);
          setShortFormula(found.shortFormula);
          setLongFormula(found.longFormula);
        }
      }
    },
    [engine, presetManager]
  );

  const handleOstinatoChange = useCallback(
    (newOstinato: OstinatoType) => {
      setOstinato(newOstinato);
      if (newOstinato === 'none') {
        engine.setOstinato('none');
      } else {
        const found = presetManager.getOstinato(newOstinato);
        if (found) {
          engine.setOstinato(found);
        } else {
          engine.setOstinato(newOstinato);
        }
      }
    },
    [engine, presetManager]
  );

  const handleAuditionFormula = useCallback(
    (formula: SubdivisionFormula) => {
      if (!player || formula.strokes.length === 0) return;
      const tempoBpm = 100;
      const beatDurationMs = (60 / tempoBpm) * 1000;
      const resolved = resolveStrokeOffsets(formula.strokes, 0);

      resolved.forEach(({ stroke, offset }) => {
        if (stroke.isRest || !stroke.hits) return;
        const delayMs = offset * beatDurationMs;
        stroke.hits.forEach((hit) => {
          const vel = engine.dynamicToVelocity(hit.dynamic);
          if (delayMs <= 0) {
            player.triggerVoice(hit.voice, 0, vel, 'orchestration');
          } else {
            setTimeout(() => {
              player.triggerVoice(hit.voice, 0, vel, 'orchestration');
            }, delayMs);
          }
        });
      });
    },
    [player, engine]
  );

  const handleAuditionOstinato = useCallback(() => {
    if (!player || ostinato === 'none' || !activeOstinatoPattern || activeOstinatoPattern.strokes.length === 0) {
      return;
    }
    const tempoBpm = 100;
    const beatDurationMs = (60 / tempoBpm) * 1000;
    const resolved = resolveStrokeOffsets(activeOstinatoPattern.strokes, 0);

    resolved.forEach(({ stroke, offset }) => {
      if (stroke.isRest || !stroke.hits) return;
      const delayMs = offset * beatDurationMs;
      stroke.hits.forEach((hit) => {
        const vel = engine.dynamicToVelocity(hit.dynamic);
        if (delayMs <= 0) {
          player.triggerVoice(hit.voice, 0, vel, 'ostinato');
        } else {
          setTimeout(() => {
            player.triggerVoice(hit.voice, 0, vel, 'ostinato');
          }, delayMs);
        }
      });
    });
  }, [player, ostinato, activeOstinatoPattern, engine]);

  const handleOpenFormulaEditor = useCallback(
    (formula: SubdivisionFormula, trigger: 'short' | 'long') => {
      setEditingFormula(formula);
      setFormulaDefaultTrigger(trigger);
      setEditingTargetBeats(trigger === 'short' ? 0.5 : 1.0);
      setIsEditingOstinato(false);
      setIsFormulaDialogOpen(true);
    },
    []
  );

  const handleEditOstinato = useCallback(() => {
    const pattern = activeOstinatoPattern || FACTORY_OSTINATOS.jazz_swing;
    setEditingFormula({
      id: pattern.id,
      name: pattern.name,
      trigger: 'long',
      strokes: pattern.strokes,
      isCustom: pattern.isCustom,
      description: pattern.description,
    });
    setFormulaDefaultTrigger('long');
    setEditingTargetBeats(4.0);
    setIsEditingOstinato(true);
    setIsFormulaDialogOpen(true);
  }, [activeOstinatoPattern]);

  const handleSaveFormulaFromDialog = useCallback(
    (updated: SubdivisionFormula) => {
      if (isEditingOstinato) {
        const ostinatoToSave: OstinatoPattern = {
          id: updated.id,
          name: updated.name,
          timeSignature: [4, 4],
          strokes: updated.strokes,
          description: updated.description,
          isCustom: true,
        };
        presetManager.saveOstinato(ostinatoToSave);
        engine.setOstinato(ostinatoToSave);
        setOstinato(ostinatoToSave.id);
      } else {
        presetManager.saveFormula(updated);
        if (updated.trigger === 'short') {
          engine.setShortFormula(updated);
          setShortFormula(updated);
        } else {
          engine.setLongFormula(updated);
          setLongFormula(updated);
        }
      }
      setIsFormulaDialogOpen(false);
    },
    [engine, isEditingOstinato, presetManager]
  );

  return (
    <div
      className={cn(
        'w-full flex flex-col gap-4 bg-card border border-border rounded-none p-5 shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Disc className="w-4 h-4 text-primary animate-[spin_12s_linear_infinite]" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                Alan Dawson Orchestration
              </h2>
              <Badge variant="outline" className="text-[10px] font-mono rounded-none">
                Tone.js
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Dynamic voice routing over continuous ostinatos
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsPresetManagerOpen(true)}
          className="h-7 text-xs border-border gap-1.5 rounded-none self-start sm:self-auto"
        >
          <Sliders className="w-3.5 h-3.5 text-primary" />
          Manage Systems, Formulas & Ostinatos
        </Button>
      </div>

      {/* Two-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Ostinato */}
        <div className="flex flex-col gap-3 p-3.5 rounded-none border border-border bg-card shadow-xs">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground/90 uppercase tracking-wider flex items-center gap-1.5">
              <Disc className="w-3.5 h-3.5 text-primary" />
              Ostinato
            </label>
            <select
              data-testid="ostinato-select"
              value={ostinato}
              onChange={(e) => handleOstinatoChange(e.target.value as OstinatoType)}
              className="w-full bg-background border border-border rounded-none px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            >
              <option value="none">Ninguno</option>
              <optgroup label="Presets de Fábrica">
                <option value="jazz_swing">Jazz Swing</option>
                <option value="straight_8ths_hihat">Corcheas en Hi-Hat</option>
              </optgroup>
              {customOstinatos.length > 0 && (
                <optgroup label="Ostinatos Personalizados">
                  {customOstinatos.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Ostinato 5-line drum stave */}
          <DrumStaffViewer
            strokes={activeOstinatoPattern?.strokes}
            isSilenced={ostinato === 'none'}
            targetBeats={4}
            height={130}
          />

          {/* Ostinato Action Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-border/60">
            <div className="text-[11px] text-muted-foreground font-mono">
              {ostinato === 'none' ? 'Silenciado' : `${activeOstinatoPattern?.name ?? 'Jazz Swing'}`}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                data-testid="ostinato-audition-btn"
                variant="ghost"
                size="sm"
                disabled={ostinato === 'none'}
                onClick={handleAuditionOstinato}
                className="h-6 px-2 text-[11px] text-primary gap-1 rounded-none"
              >
                <Play className="w-3 h-3 fill-current" /> Audition
              </Button>
              <Button
                type="button"
                data-testid="ostinato-edit-btn"
                variant="outline"
                size="sm"
                onClick={handleEditOstinato}
                className="h-6 px-2 text-[11px] border-border gap-1 rounded-none"
              >
                <Edit3 className="w-3 h-3" /> Edit
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Interpretation System */}
        <div className="flex flex-col gap-3 p-3.5 rounded-none border border-border bg-card shadow-xs">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground/90 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              Interpretation System
            </label>
            <select
              data-testid="system-select"
              value={activeSystemId}
              onChange={(e) => handleSelectSystemId(e.target.value)}
              className="w-full bg-background border border-border rounded-none px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            >
              <option value="none">Ninguno</option>
              <optgroup label="Sistemas de Fábrica">
                <option value="snare_and_kick">Snare & Kick</option>
                <option value="hihat_foot_and_kick">Hi-Hat Foot & Kick</option>
              </optgroup>
              {legacySystems.length > 0 && (
                <optgroup label="Sistemas Predefinidos">
                  {legacySystems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {customSystems.length > 0 && (
                <optgroup label="Sistemas Personalizados">
                  {customSystems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Stacked Formula Staves */}
          <div className="flex flex-col gap-2.5">
            {/* Short Formula Card */}
            <div className="p-2.5 rounded-none border border-border bg-secondary/20 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-primary uppercase tracking-wider">
                  Short Formula: <span className="text-foreground font-normal">{activeSystemId === 'none' ? 'Ninguno' : shortFormula.name}</span>
                </span>
                <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground rounded-none">
                  {activeSystemId === 'none' ? '0 strokes' : `${shortFormula.strokes.length} stroke${shortFormula.strokes.length === 1 ? '' : 's'}`}
                </Badge>
              </div>

              <DrumStaffViewer
                strokes={activeSystemId === 'none' ? [] : shortFormula.strokes}
                isSilenced={activeSystemId === 'none'}
                targetBeats={0.5}
                height={120}
              />

              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/40">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={activeSystemId === 'none'}
                  onClick={() => handleAuditionFormula(shortFormula)}
                  className="h-6 px-2 text-[11px] text-primary gap-1 rounded-none"
                >
                  <Play className="w-3 h-3 fill-current" /> Audition
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={activeSystemId === 'none'}
                  onClick={() => handleOpenFormulaEditor(shortFormula, 'short')}
                  className="h-6 px-2 text-[11px] border-border gap-1 rounded-none"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </Button>
              </div>
            </div>

            {/* Long Formula Card */}
            <div className="p-2.5 rounded-none border border-border bg-secondary/20 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-destructive uppercase tracking-wider">
                  Long Formula: <span className="text-foreground font-normal">{activeSystemId === 'none' ? 'Ninguno' : longFormula.name}</span>
                </span>
                <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground rounded-none">
                  {activeSystemId === 'none' ? '0 strokes' : `${longFormula.strokes.length} stroke${longFormula.strokes.length === 1 ? '' : 's'}`}
                </Badge>
              </div>

              <DrumStaffViewer
                strokes={activeSystemId === 'none' ? [] : longFormula.strokes}
                isSilenced={activeSystemId === 'none'}
                targetBeats={1.0}
                height={120}
              />

              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/40">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={activeSystemId === 'none'}
                  onClick={() => handleAuditionFormula(longFormula)}
                  className="h-6 px-2 text-[11px] text-destructive gap-1 rounded-none"
                >
                  <Play className="w-3 h-3 fill-current" /> Audition
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={activeSystemId === 'none'}
                  onClick={() => handleOpenFormulaEditor(longFormula, 'long')}
                  className="h-6 px-2 text-[11px] border-border gap-1 rounded-none"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Manager Modal Dialog */}
      {isPresetManagerOpen && (
        <PresetManager
          open={isPresetManagerOpen}
          onClose={() => setIsPresetManagerOpen(false)}
          presetManager={presetManager}
          activeSystemId={activeSystemId}
          onSelectSystem={handleSelectSystem}
          player={player}
        />
      )}

      {/* Formula & Ostinato Editor Modal Dialog */}
      {isFormulaDialogOpen && (
        <FormulaEditorDialog
          open={isFormulaDialogOpen}
          onClose={() => setIsFormulaDialogOpen(false)}
          formula={editingFormula}
          defaultTrigger={formulaDefaultTrigger}
          targetBeats={editingTargetBeats}
          onSave={handleSaveFormulaFromDialog}
          player={player}
        />
      )}
    </div>
  );
};
