import React, { useState, useCallback, useMemo } from 'react';
import { ToneTransportScheduler } from '../audio/ToneTransportScheduler';
import {
  DawsonMode,
  OstinatoType,
  SubdivisionFormula,
  DawsonSystem,
} from '../domain/dawson/types';
import {
  DawsonPresetManager,
  resolveStrokeOffsets,
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

  const [mode, setMode] = useState<DawsonMode>(() => engine.getMode());
  const [ostinato, setOstinato] = useState<OstinatoType>(() => engine.getOstinato());
  const [activeSystemId, setActiveSystemId] = useState<string>(() => engine.getSystem()?.id ?? 'classic_bop');
  const [shortFormula, setShortFormula] = useState<SubdivisionFormula>(() => engine.getShortFormula());
  const [longFormula, setLongFormula] = useState<SubdivisionFormula>(() => engine.getLongFormula());

  // Modal dialog states
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
  const [isFormulaDialogOpen, setIsFormulaDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<SubdivisionFormula | null>(null);
  const [formulaDefaultTrigger, setFormulaDefaultTrigger] = useState<'short' | 'long'>('short');

  const handleModeChange = useCallback(
    (newMode: DawsonMode) => {
      setMode(newMode);
      engine.setMode(newMode);
      setActiveSystemId(newMode);
      setShortFormula(engine.getShortFormula());
      setLongFormula(engine.getLongFormula());

      if (newMode === 'straight_rock') {
        engine.setOstinato('straight_rock');
        setOstinato('straight_rock');
      } else if ((newMode === 'classic_bop' || newMode === 'inverted_bop') && ostinato === 'straight_rock') {
        engine.setOstinato('jazz_swing');
        setOstinato('jazz_swing');
      }
    },
    [engine, ostinato]
  );

  const handleSelectSystem = useCallback(
    (system: DawsonSystem) => {
      engine.setSystem(system);
      setActiveSystemId(system.id);
      setShortFormula(system.shortFormula);
      setLongFormula(system.longFormula);
      setOstinato(system.ostinatoId);
      setMode(engine.getMode());
      setIsPresetManagerOpen(false);
    },
    [engine]
  );

  const handleOstinatoChange = useCallback(
    (newOstinato: OstinatoType) => {
      setOstinato(newOstinato);
      engine.setOstinato(newOstinato);
    },
    [engine]
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

  const handleOpenFormulaEditor = useCallback(
    (formula: SubdivisionFormula, trigger: 'short' | 'long') => {
      setEditingFormula(formula);
      setFormulaDefaultTrigger(trigger);
      setIsFormulaDialogOpen(true);
    },
    []
  );

  const handleSaveFormulaFromDialog = useCallback(
    (updatedFormula: SubdivisionFormula) => {
      presetManager.saveFormula(updatedFormula);
      if (updatedFormula.trigger === 'short') {
        engine.setShortFormula(updatedFormula);
        setShortFormula(updatedFormula);
      } else {
        engine.setLongFormula(updatedFormula);
        setLongFormula(updatedFormula);
      }
      setIsFormulaDialogOpen(false);
    },
    [engine, presetManager]
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

        {/* Ostinato Quick Selector */}
        <div className="flex items-center gap-1 bg-secondary/40 p-1 rounded-none border border-border self-start sm:self-auto">
          <span className="text-[11px] font-medium text-muted-foreground px-1.5 uppercase font-mono">Ostinato:</span>
          <Button
            variant={ostinato === 'jazz_swing' ? 'default' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-[11px] rounded-none"
            onClick={() => handleOstinatoChange('jazz_swing')}
          >
            Jazz Swing
          </Button>
          <Button
            variant={ostinato === 'straight_rock' ? 'default' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-[11px] rounded-none"
            onClick={() => handleOstinatoChange('straight_rock')}
          >
            Straight 8ths
          </Button>
          <Button
            variant={ostinato === 'none' ? 'destructive' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-[11px] rounded-none"
            onClick={() => handleOstinatoChange('none')}
          >
            No Ostinato
          </Button>
        </div>
      </div>

      {/* Dawson Interpretation System Selector */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground/90 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            Interpretation System
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPresetManagerOpen(true)}
            className="h-6 text-[11px] border-border gap-1.5 rounded-none"
          >
            <Sliders className="w-3 h-3 text-primary" />
            Manage Systems & Formulas
          </Button>
        </div>

        {/* System Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {/* Classic Bop */}
          <button
            type="button"
            onClick={() => handleModeChange('classic_bop')}
            className={cn(
              'flex flex-col items-start p-3 rounded-none border text-left transition-all',
              activeSystemId === 'classic_bop' || (mode === 'classic_bop' && activeSystemId === 'classic_bop')
                ? 'bg-secondary border-primary ring-1 ring-primary'
                : 'bg-secondary/30 border-border hover:bg-secondary/60'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-semibold uppercase text-foreground">Classic Bop</span>
              {activeSystemId === 'classic_bop' && (
                <span className="w-1.5 h-1.5 rounded-none bg-primary" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Shorts (≤ 8th) → <strong className="text-primary">Snare</strong>
              <br />
              Longs (≥ Qtr) → <strong className="text-rose-400">Kick</strong>
            </p>
          </button>

          {/* Inverted Bop */}
          <button
            type="button"
            onClick={() => handleModeChange('inverted_bop')}
            className={cn(
              'flex flex-col items-start p-3 rounded-none border text-left transition-all',
              activeSystemId === 'inverted_bop' || (mode === 'inverted_bop' && activeSystemId === 'inverted_bop')
                ? 'bg-secondary border-primary ring-1 ring-primary'
                : 'bg-secondary/30 border-border hover:bg-secondary/60'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-semibold uppercase text-foreground">Inverted Bop</span>
              {activeSystemId === 'inverted_bop' && (
                <span className="w-1.5 h-1.5 rounded-none bg-primary" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Shorts (≤ 8th) → <strong className="text-rose-400">Kick</strong>
              <br />
              Longs (≥ Qtr) → <strong className="text-primary">Snare</strong>
            </p>
          </button>

          {/* Straight Rock */}
          <button
            type="button"
            onClick={() => handleModeChange('straight_rock')}
            className={cn(
              'flex flex-col items-start p-3 rounded-none border text-left transition-all',
              activeSystemId === 'straight_rock'
                ? 'bg-secondary border-primary ring-1 ring-primary'
                : 'bg-secondary/30 border-border hover:bg-secondary/60'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-semibold uppercase text-foreground">Straight Rock</span>
              {activeSystemId === 'straight_rock' && (
                <span className="w-1.5 h-1.5 rounded-none bg-primary" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              8th Hi-Hat Groove
              <br />
              Shorts → <strong className="text-primary">Snare</strong>, Longs →{' '}
              <strong className="text-rose-400">Kick</strong>
            </p>
          </button>

          {/* Tony Williams F-L-R Triplet */}
          <button
            type="button"
            data-testid="system-btn-tony_williams_flr"
            onClick={() => {
              const sys = presetManager.getSystem('tony_williams_flr');
              if (sys) handleSelectSystem(sys);
            }}
            className={cn(
              'flex flex-col items-start p-3 rounded-none border text-left transition-all',
              activeSystemId === 'tony_williams_flr'
                ? 'bg-secondary border-primary ring-1 ring-primary'
                : 'bg-secondary/30 border-border hover:bg-secondary/60'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-semibold uppercase text-foreground">Tony Williams</span>
              {activeSystemId === 'tony_williams_flr' && (
                <span className="w-1.5 h-1.5 rounded-none bg-primary" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Shorts → <strong className="text-primary">F-L-R Triplet</strong>
              <br />
              Longs → <strong className="text-rose-400">Kick</strong>
            </p>
          </button>

          {/* Linear Diddle Fusion */}
          <button
            type="button"
            data-testid="system-btn-linear_diddle_fusion"
            onClick={() => {
              const sys = presetManager.getSystem('linear_diddle_fusion');
              if (sys) handleSelectSystem(sys);
            }}
            className={cn(
              'flex flex-col items-start p-3 rounded-none border text-left transition-all',
              activeSystemId === 'linear_diddle_fusion'
                ? 'bg-secondary border-primary ring-1 ring-primary'
                : 'bg-secondary/30 border-border hover:bg-secondary/60'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-semibold uppercase text-foreground">Linear Fusion</span>
              {activeSystemId === 'linear_diddle_fusion' && (
                <span className="w-1.5 h-1.5 rounded-none bg-primary" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Shorts → <strong className="text-primary">Snare</strong>
              <br />
              Longs → <strong className="text-amber-500">Linear Diddle</strong>
            </p>
          </button>
        </div>
      </div>

      {/* Active Subdivision Formulas Display & Customization Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-secondary/20 p-3 rounded-none border border-border">
        {/* Short Note Formula Card */}
        <div className="bg-secondary/30 border border-border rounded-none p-3 flex flex-col justify-between gap-2.5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Short Formula
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {shortFormula.name}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground rounded-none">
                {shortFormula.strokes.length} stroke{shortFormula.strokes.length === 1 ? '' : 's'}
              </Badge>
            </div>

            {/* Strokes mini-summary */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {shortFormula.strokes.map((s, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded-none bg-secondary border border-border text-[10px] font-mono text-foreground"
                >
                  {s.isRest ? 'rest' : s.hits.map((h) => h.voice).join('+')}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleAuditionFormula(shortFormula)}
              className="h-6 px-2 text-[11px] text-primary gap-1 rounded-none"
            >
              <Play className="w-3 h-3 fill-current" /> Audition
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenFormulaEditor(shortFormula, 'short')}
              className="h-6 px-2 text-[11px] border-border gap-1 rounded-none"
            >
              <Edit3 className="w-3 h-3" /> Customize
            </Button>
          </div>
        </div>

        {/* Long Note Formula Card */}
        <div className="bg-secondary/30 border border-border rounded-none p-3 flex flex-col justify-between gap-2.5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                  Long Formula
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {longFormula.name}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground rounded-none">
                {longFormula.strokes.length} stroke{longFormula.strokes.length === 1 ? '' : 's'}
              </Badge>
            </div>

            {/* Strokes mini-summary */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {longFormula.strokes.map((s, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded-none bg-secondary border border-border text-[10px] font-mono text-foreground"
                >
                  {s.isRest ? 'rest' : s.hits.map((h) => h.voice).join('+')}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleAuditionFormula(longFormula)}
              className="h-6 px-2 text-[11px] text-rose-400 gap-1 rounded-none"
            >
              <Play className="w-3 h-3 fill-current" /> Audition
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenFormulaEditor(longFormula, 'long')}
              className="h-6 px-2 text-[11px] border-border gap-1 rounded-none"
            >
              <Edit3 className="w-3 h-3" /> Customize
            </Button>
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

      {/* Formula Editor Modal Dialog */}
      {isFormulaDialogOpen && (
        <FormulaEditorDialog
          open={isFormulaDialogOpen}
          onClose={() => setIsFormulaDialogOpen(false)}
          formula={editingFormula}
          defaultTrigger={formulaDefaultTrigger}
          onSave={handleSaveFormulaFromDialog}
          player={player}
        />
      )}
    </div>
  );
};
