import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ToneTransportScheduler } from '../audio/ToneTransportScheduler';
import {
  DawsonMode,
  OstinatoType,
  DrumVoice,
  ScheduledDrumEvent,
  SubdivisionFormula,
  DawsonSystem,
} from '../domain/dawson/types';
import {
  DawsonPresetManager,
  resolveStrokeOffsets,
} from '../domain/dawson/SubdivisionFormula';
import { DrumLane } from '../audio/DrumKitPlayer';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Disc,
  Sliders,
  Activity,
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

  // Pad illumination states
  const [activeKick, setActiveKick] = useState(false);
  const [activeSnare, setActiveSnare] = useState(false);
  const [activeRide, setActiveRide] = useState(false);
  const [activeHihat, setActiveHihat] = useState(false);

  // Listen for scheduled real-time drum hits
  useEffect(() => {
    const unsub = scheduler.onDrumHit((event: ScheduledDrumEvent) => {
      const v = event.voice;
      if (v === 'kick') {
        setActiveKick(true);
        setTimeout(() => setActiveKick(false), 120);
      } else if (v === 'snare' || v === 'snare_ghost') {
        setActiveSnare(true);
        setTimeout(() => setActiveSnare(false), 120);
      } else if (v === 'ride' || v === 'ride_bell') {
        setActiveRide(true);
        setTimeout(() => setActiveRide(false), 120);
      } else if (v.startsWith('hihat')) {
        setActiveHihat(true);
        setTimeout(() => setActiveHihat(false), 120);
      }
    });

    return unsub;
  }, [scheduler]);

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

  const handlePadAudition = useCallback(
    (voice: DrumVoice, channel: DrumLane) => {
      // A pad tap is an audition tap on the Mixing Channel that pad belongs to.
      player.triggerVoice(voice, 0, 0.9, channel);
      if (voice === 'kick') {
        setActiveKick(true);
        setTimeout(() => setActiveKick(false), 120);
      } else if (voice === 'snare') {
        setActiveSnare(true);
        setTimeout(() => setActiveSnare(false), 120);
      } else if (voice === 'ride') {
        setActiveRide(true);
        setTimeout(() => setActiveRide(false), 120);
      } else if (voice === 'hihat_foot' || voice === 'hihat_closed') {
        setActiveHihat(true);
        setTimeout(() => setActiveHihat(false), 120);
      }
    },
    [player]
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
          <Disc className="w-4 h-4 text-accent animate-[spin_12s_linear_infinite]" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                Alan Dawson Orchestration & Drum Monitor
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
            <Layers className="w-3.5 h-3.5 text-accent" />
            Interpretation System
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPresetManagerOpen(true)}
            className="h-6 text-[11px] border-border gap-1.5 rounded-none"
          >
            <Sliders className="w-3 h-3" />
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
                ? 'bg-secondary border-accent ring-1 ring-accent'
                : 'bg-secondary/30 border-border hover:bg-secondary/60'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-semibold uppercase text-foreground">Classic Bop</span>
              {activeSystemId === 'classic_bop' && (
                <span className="w-1.5 h-1.5 rounded-none bg-accent" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Shorts (≤ 8th) → <strong className="text-accent">Snare</strong>
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
                ? 'bg-secondary border-accent ring-1 ring-accent'
                : 'bg-secondary/30 border-border hover:bg-secondary/60'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-semibold uppercase text-foreground">Inverted Bop</span>
              {activeSystemId === 'inverted_bop' && (
                <span className="w-1.5 h-1.5 rounded-none bg-accent" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Shorts (≤ 8th) → <strong className="text-rose-400">Kick</strong>
              <br />
              Longs (≥ Qtr) → <strong className="text-accent">Snare</strong>
            </p>
          </button>

          {/* Straight Rock */}
          <button
            type="button"
            onClick={() => handleModeChange('straight_rock')}
            className={cn(
              'flex flex-col items-start p-3 rounded-none border text-left transition-all',
              activeSystemId === 'straight_rock'
                ? 'bg-secondary border-accent ring-1 ring-accent'
                : 'bg-secondary/30 border-border hover:bg-secondary/60'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-semibold uppercase text-foreground">Straight Rock</span>
              {activeSystemId === 'straight_rock' && (
                <span className="w-1.5 h-1.5 rounded-none bg-accent" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              8th Hi-Hat Groove
              <br />
              Shorts → <strong className="text-accent">Snare</strong>, Longs →{' '}
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
                ? 'bg-secondary border-accent ring-1 ring-accent'
                : 'bg-secondary/30 border-border hover:bg-secondary/60'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-semibold uppercase text-foreground">Tony Williams</span>
              {activeSystemId === 'tony_williams_flr' && (
                <span className="w-1.5 h-1.5 rounded-none bg-accent" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Shorts → <strong className="text-accent">F-L-R Triplet</strong>
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
                ? 'bg-secondary border-accent ring-1 ring-accent'
                : 'bg-secondary/30 border-border hover:bg-secondary/60'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-xs font-semibold uppercase text-foreground">Linear Fusion</span>
              {activeSystemId === 'linear_diddle_fusion' && (
                <span className="w-1.5 h-1.5 rounded-none bg-accent" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Shorts → <strong className="text-accent">Snare</strong>
              <br />
              Longs → <strong className="text-amber-400">Linear Diddle</strong>
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
                <span className="text-xs font-bold text-accent uppercase tracking-wider">
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
              className="h-6 px-2 text-[11px] text-accent gap-1 rounded-none"
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

      {/* Visual Drum Kit Monitor: pad illumination plus audition taps per Mixing Channel */}
      <div className="flex flex-col gap-2.5 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground/90 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-accent" />
              Real-Time Drum Monitor
            </label>
            <span className="text-[10px] text-muted-foreground font-mono">Click pad to audition</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 bg-secondary/20 p-2.5 rounded-none border border-border">
            {/* Ride Cymbal (RH) */}
            <button
              type="button"
              data-testid="drum-pad-ride"
              data-active={activeRide ? 'true' : 'false'}
              onClick={() => handlePadAudition('ride', 'ostinato')}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-none border transition-all duration-75 select-none',
                activeRide
                  ? 'bg-amber-500/25 border-amber-400 scale-[1.02] shadow-sm'
                  : 'bg-secondary/40 border-border hover:bg-secondary/70'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-none flex items-center justify-center border font-bold text-xs mb-1 transition-colors',
                  activeRide
                    ? 'border-amber-400 bg-amber-400 text-black'
                    : 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                )}
              >
                RH
              </div>
              <span className="text-xs font-semibold text-foreground">Ride Cymbal</span>
              <span className="text-[10px] text-muted-foreground font-mono">Spang-a-lang</span>
            </button>

            {/* Snare Drum (LH) */}
            <button
              type="button"
              data-testid="drum-pad-snare"
              data-active={activeSnare ? 'true' : 'false'}
              onClick={() => handlePadAudition('snare', 'orchestration')}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-none border transition-all duration-75 select-none',
                activeSnare
                  ? 'bg-accent/25 border-accent scale-[1.02] shadow-sm'
                  : 'bg-secondary/40 border-border hover:bg-secondary/70'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-none flex items-center justify-center border font-bold text-xs mb-1 transition-colors',
                  activeSnare
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-border text-accent bg-accent/10'
                )}
              >
                LH
              </div>
              <span className="text-xs font-semibold text-foreground">Snare Drum</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {shortFormula.name}
              </span>
            </button>

            {/* Bass Drum / Kick (RF) */}
            <button
              type="button"
              data-testid="drum-pad-kick"
              data-active={activeKick ? 'true' : 'false'}
              onClick={() => handlePadAudition('kick', 'orchestration')}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-none border transition-all duration-75 select-none',
                activeKick
                  ? 'bg-rose-500/25 border-rose-400 scale-[1.02] shadow-sm'
                  : 'bg-secondary/40 border-border hover:bg-secondary/70'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-none flex items-center justify-center border font-bold text-xs mb-1 transition-colors',
                  activeKick
                    ? 'border-rose-400 bg-rose-400 text-white'
                    : 'border-rose-500/40 text-rose-400 bg-rose-500/10'
                )}
              >
                RF
              </div>
              <span className="text-xs font-semibold text-foreground">Bass Drum</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {longFormula.name}
              </span>
            </button>

            {/* Hi-Hat Pedal (LF) */}
            <button
              type="button"
              data-testid="drum-pad-hihat"
              data-active={activeHihat ? 'true' : 'false'}
              onClick={() => handlePadAudition('hihat_foot', 'ostinato')}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-none border transition-all duration-75 select-none',
                activeHihat
                  ? 'bg-purple-500/25 border-purple-400 scale-[1.02] shadow-sm'
                  : 'bg-secondary/40 border-border hover:bg-secondary/70'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-none flex items-center justify-center border font-bold text-xs mb-1 transition-colors',
                  activeHihat
                    ? 'border-purple-400 bg-purple-400 text-white'
                    : 'border-purple-500/40 text-purple-400 bg-purple-500/10'
                )}
              >
                LF
              </div>
              <span className="text-xs font-semibold text-foreground">Hi-Hat Pedal</span>
              <span className="text-[10px] text-muted-foreground font-mono">Beats 2 & 4 Chick</span>
            </button>
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
