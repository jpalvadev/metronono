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
import { MixerChannelId, AudioMixerState } from '../audio/AudioMixer';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import {
  Volume2,
  VolumeX,
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
  const mixer = useMemo(() => scheduler.getAudioMixer(), [scheduler]);
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
  const [mixerState, setMixerState] = useState<AudioMixerState>(() => mixer.getState());

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

  // Sync mixer state
  useEffect(() => {
    const unsub = mixer.onStateChange((state) => {
      setMixerState(state);
    });
    return unsub;
  }, [mixer]);

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

  const handleVolumeChange = useCallback(
    (channel: MixerChannelId, val: number) => {
      mixer.setChannelVolume(channel, val);
    },
    [mixer]
  );

  const handleMuteToggle = useCallback(
    (channel: MixerChannelId) => {
      mixer.toggleChannelMute(channel);
    },
    [mixer]
  );

  const handlePadAudition = useCallback(
    (voice: DrumVoice) => {
      player.triggerVoice(voice, 0, 0.9);
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
        const delayMs = offset * beatDurationMs;
        const vel = engine.dynamicToVelocity(stroke.dynamic);
        if (delayMs <= 0) {
          player.triggerVoice(stroke.voice, 0, vel, 'orchestration');
        } else {
          setTimeout(() => {
            player.triggerVoice(stroke.voice, 0, vel, 'orchestration');
          }, delayMs);
        }
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
        'w-full flex flex-col gap-5 bg-card/60 backdrop-blur border border-border/70 rounded-2xl p-4 md:p-6 shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Disc className="w-5 h-5 animate-[spin_12s_linear_infinite]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground tracking-tight">
                Alan Dawson Orchestration & Mixer
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono border-teal-500/40 text-teal-400">
                100% Offline Tone.js
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Dynamic voice routing over continuous jazz and rock ostinatos
            </p>
          </div>
        </div>

        {/* Ostinato Quick Selector */}
        <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/60 self-start sm:self-auto">
          <span className="text-[11px] font-medium text-muted-foreground px-2">Ostinato:</span>
          <Button
            variant={ostinato === 'jazz_swing' ? 'default' : 'ghost'}
            size="sm"
            className={cn('h-7 px-2.5 text-xs', ostinato === 'jazz_swing' && 'bg-teal-600 text-white hover:bg-teal-700')}
            onClick={() => handleOstinatoChange('jazz_swing')}
          >
            Jazz Swing
          </Button>
          <Button
            variant={ostinato === 'straight_rock' ? 'default' : 'ghost'}
            size="sm"
            className={cn('h-7 px-2.5 text-xs', ostinato === 'straight_rock' && 'bg-teal-600 text-white hover:bg-teal-700')}
            onClick={() => handleOstinatoChange('straight_rock')}
          >
            Straight 8ths
          </Button>
          <Button
            variant={ostinato === 'none' ? 'default' : 'ghost'}
            size="sm"
            className={cn('h-7 px-2.5 text-xs', ostinato === 'none' && 'bg-rose-600 text-white hover:bg-rose-700')}
            onClick={() => handleOstinatoChange('none')}
          >
            Silenced
          </Button>
        </div>
      </div>

      {/* Dawson Interpretation System Selector */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground/90 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            Interpretation System
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPresetManagerOpen(true)}
            className="h-7 text-xs border-teal-500/40 text-teal-400 hover:bg-teal-500/10 gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5" />
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
              'flex flex-col items-start p-3 rounded-xl border text-left transition-all',
              activeSystemId === 'classic_bop' || (mode === 'classic_bop' && activeSystemId === 'classic_bop')
                ? 'bg-teal-500/15 border-teal-500/60 shadow-xs ring-1 ring-teal-500/30'
                : 'bg-muted/30 border-border/60 hover:bg-muted/50 hover:border-border'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-sm font-semibold text-foreground">Classic Bop</span>
              {activeSystemId === 'classic_bop' && (
                <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Shorts (≤ 8th) → <strong className="text-teal-400">Snare</strong>
              <br />
              Longs (≥ Qtr) → <strong className="text-rose-400">Kick</strong>
            </p>
          </button>

          {/* Inverted Bop */}
          <button
            type="button"
            onClick={() => handleModeChange('inverted_bop')}
            className={cn(
              'flex flex-col items-start p-3 rounded-xl border text-left transition-all',
              activeSystemId === 'inverted_bop' || (mode === 'inverted_bop' && activeSystemId === 'inverted_bop')
                ? 'bg-teal-500/15 border-teal-500/60 shadow-xs ring-1 ring-teal-500/30'
                : 'bg-muted/30 border-border/60 hover:bg-muted/50 hover:border-border'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-sm font-semibold text-foreground">Inverted Bop</span>
              {activeSystemId === 'inverted_bop' && (
                <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Shorts (≤ 8th) → <strong className="text-rose-400">Kick</strong>
              <br />
              Longs (≥ Qtr) → <strong className="text-teal-400">Snare</strong>
            </p>
          </button>

          {/* Straight Rock */}
          <button
            type="button"
            onClick={() => handleModeChange('straight_rock')}
            className={cn(
              'flex flex-col items-start p-3 rounded-xl border text-left transition-all',
              activeSystemId === 'straight_rock'
                ? 'bg-teal-500/15 border-teal-500/60 shadow-xs ring-1 ring-teal-500/30'
                : 'bg-muted/30 border-border/60 hover:bg-muted/50 hover:border-border'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-sm font-semibold text-foreground">Straight Rock</span>
              {activeSystemId === 'straight_rock' && (
                <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              8th Hi-Hat Groove
              <br />
              Shorts → <strong className="text-teal-400">Snare</strong>, Longs →{' '}
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
              'flex flex-col items-start p-3 rounded-xl border text-left transition-all',
              activeSystemId === 'tony_williams_flr'
                ? 'bg-teal-500/15 border-teal-500/60 shadow-xs ring-1 ring-teal-500/30'
                : 'bg-muted/30 border-border/60 hover:bg-muted/50 hover:border-border'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-sm font-semibold text-foreground">Tony Williams</span>
              {activeSystemId === 'tony_williams_flr' && (
                <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Shorts → <strong className="text-teal-400">F-L-R Triplet</strong>
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
              'flex flex-col items-start p-3 rounded-xl border text-left transition-all',
              activeSystemId === 'linear_diddle_fusion'
                ? 'bg-teal-500/15 border-teal-500/60 shadow-xs ring-1 ring-teal-500/30'
                : 'bg-muted/30 border-border/60 hover:bg-muted/50 hover:border-border'
            )}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-sm font-semibold text-foreground">Linear Fusion</span>
              {activeSystemId === 'linear_diddle_fusion' && (
                <span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Shorts → <strong className="text-teal-400">Snare</strong>
              <br />
              Longs → <strong className="text-amber-400">Linear Diddle</strong>
            </p>
          </button>
        </div>
      </div>

      {/* Active Subdivision Formulas Display & Customization Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/60">
        {/* Short Note Formula Card */}
        <div className="bg-card/70 border border-border/80 rounded-lg p-3 flex flex-col justify-between gap-2.5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                  Short Formula
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {shortFormula.name}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-teal-500/30 text-teal-400">
                {shortFormula.strokes.length} stroke{shortFormula.strokes.length === 1 ? '' : 's'}
              </Badge>
            </div>

            {/* Strokes mini-summary */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {shortFormula.strokes.map((s, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded bg-muted/60 border border-border/60 text-[10px] font-mono text-foreground"
                >
                  {s.voice} <strong className="text-teal-400">({s.limb || '?'})</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleAuditionFormula(shortFormula)}
              className="h-7 px-2 text-xs text-teal-400 hover:bg-teal-500/10 gap-1"
            >
              <Play className="w-3 h-3 fill-current" /> Audition
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenFormulaEditor(shortFormula, 'short')}
              className="h-7 px-2 text-xs border-border gap-1"
            >
              <Edit3 className="w-3 h-3" /> Customize
            </Button>
          </div>
        </div>

        {/* Long Note Formula Card */}
        <div className="bg-card/70 border border-border/80 rounded-lg p-3 flex flex-col justify-between gap-2.5">
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
              <Badge variant="outline" className="text-[10px] font-mono border-rose-500/30 text-rose-400">
                {longFormula.strokes.length} stroke{longFormula.strokes.length === 1 ? '' : 's'}
              </Badge>
            </div>

            {/* Strokes mini-summary */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {longFormula.strokes.map((s, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded bg-muted/60 border border-border/60 text-[10px] font-mono text-foreground"
                >
                  {s.voice} <strong className="text-rose-400">({s.limb || '?'})</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleAuditionFormula(longFormula)}
              className="h-7 px-2 text-xs text-rose-400 hover:bg-rose-500/10 gap-1"
            >
              <Play className="w-3 h-3 fill-current" /> Audition
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenFormulaEditor(longFormula, 'long')}
              className="h-7 px-2 text-xs border-border gap-1"
            >
              <Edit3 className="w-3 h-3" /> Customize
            </Button>
          </div>
        </div>
      </div>

      {/* Middle Row: Visual Drum Monitor & 3-Channel Audio Mixer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
        {/* Visual Drum Kit Monitor (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground/90 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-teal-400" />
              Real-Time Drum Monitor
            </label>
            <span className="text-[10px] text-muted-foreground">Click pad to audition</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 bg-muted/20 p-3 rounded-xl border border-border/60">
            {/* Ride Cymbal (RH) */}
            <button
              type="button"
              data-testid="drum-pad-ride"
              data-active={activeRide ? 'true' : 'false'}
              onClick={() => handlePadAudition('ride')}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-75 select-none',
                activeRide
                  ? 'bg-amber-500/25 border-amber-400 scale-[1.03] shadow-[0_0_18px_rgba(245,158,11,0.6)] ring-2 ring-amber-400/50'
                  : 'bg-card/70 border-border/70 hover:border-amber-400/50 hover:bg-amber-500/5'
              )}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center border font-bold text-xs mb-1.5 transition-colors',
                  activeRide
                    ? 'border-amber-400 bg-amber-400 text-black'
                    : 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                )}
              >
                RH
              </div>
              <span className="text-xs font-semibold text-foreground">Ride Cymbal</span>
              <span className="text-[10px] text-muted-foreground">Spang-a-lang</span>
            </button>

            {/* Snare Drum (LH) */}
            <button
              type="button"
              data-testid="drum-pad-snare"
              data-active={activeSnare ? 'true' : 'false'}
              onClick={() => handlePadAudition('snare')}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-75 select-none',
                activeSnare
                  ? 'bg-teal-500/25 border-teal-400 scale-[1.03] shadow-[0_0_18px_rgba(45,212,191,0.6)] ring-2 ring-teal-400/50'
                  : 'bg-card/70 border-border/70 hover:border-teal-400/50 hover:bg-teal-500/5'
              )}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center border font-bold text-xs mb-1.5 transition-colors',
                  activeSnare
                    ? 'border-teal-400 bg-teal-400 text-black'
                    : 'border-teal-500/40 text-teal-400 bg-teal-500/10'
                )}
              >
                LH
              </div>
              <span className="text-xs font-semibold text-foreground">Snare Drum</span>
              <span className="text-[10px] text-muted-foreground">
                {shortFormula.name}
              </span>
            </button>

            {/* Bass Drum / Kick (RF) */}
            <button
              type="button"
              data-testid="drum-pad-kick"
              data-active={activeKick ? 'true' : 'false'}
              onClick={() => handlePadAudition('kick')}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-75 select-none',
                activeKick
                  ? 'bg-rose-500/25 border-rose-400 scale-[1.03] shadow-[0_0_18px_rgba(244,63,94,0.6)] ring-2 ring-rose-400/50'
                  : 'bg-card/70 border-border/70 hover:border-rose-400/50 hover:bg-rose-500/5'
              )}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center border font-bold text-xs mb-1.5 transition-colors',
                  activeKick
                    ? 'border-rose-400 bg-rose-400 text-white'
                    : 'border-rose-500/40 text-rose-400 bg-rose-500/10'
                )}
              >
                RF
              </div>
              <span className="text-xs font-semibold text-foreground">Bass Drum</span>
              <span className="text-[10px] text-muted-foreground">
                {longFormula.name}
              </span>
            </button>

            {/* Hi-Hat Pedal (LF) */}
            <button
              type="button"
              data-testid="drum-pad-hihat"
              data-active={activeHihat ? 'true' : 'false'}
              onClick={() => handlePadAudition('hihat_foot')}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-75 select-none',
                activeHihat
                  ? 'bg-violet-500/25 border-violet-400 scale-[1.03] shadow-[0_0_18px_rgba(168,85,247,0.6)] ring-2 ring-violet-400/50'
                  : 'bg-card/70 border-border/70 hover:border-violet-400/50 hover:bg-violet-500/5'
              )}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center border font-bold text-xs mb-1.5 transition-colors',
                  activeHihat
                    ? 'border-violet-400 bg-violet-400 text-white'
                    : 'border-violet-500/40 text-violet-400 bg-violet-500/10'
                )}
              >
                LF
              </div>
              <span className="text-xs font-semibold text-foreground">Hi-Hat Pedal</span>
              <span className="text-[10px] text-muted-foreground">Beats 2 & 4 Chick</span>
            </button>
          </div>
        </div>

        {/* 3-Channel Audio Mixer Panel (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground/90 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-teal-400" />
              3-Channel Audio Mixer
            </label>
            <span className="text-[10px] text-muted-foreground">Independent gain & mute</span>
          </div>

          <div className="flex flex-col gap-3 bg-muted/20 p-3 rounded-xl border border-border/60">
            {/* Channel 1: Metronome Click */}
            <div className="flex items-center gap-3 bg-card/60 p-2.5 rounded-lg border border-border/60">
              <Button
                variant={mixerState.click.muted ? 'destructive' : 'ghost'}
                size="sm"
                aria-label={mixerState.click.muted ? 'Unmute Click' : 'Mute Click'}
                onClick={() => handleMuteToggle('click')}
                className={cn('w-9 h-9 p-0 rounded-lg shrink-0', !mixerState.click.muted && 'text-muted-foreground hover:text-foreground')}
              >
                {mixerState.click.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-foreground">Metronome Click</span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {mixerState.click.muted ? (
                      <span className="text-rose-400 font-semibold">MUTED</span>
                    ) : (
                      `${Math.round(mixerState.click.volume * 100)}%`
                    )}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={mixerState.click.volume}
                  onChange={(val) => handleVolumeChange('click', val)}
                  ariaLabel="Click Volume"
                  className={cn(mixerState.click.muted && 'opacity-40')}
                />
              </div>
            </div>

            {/* Channel 2: Ostinato */}
            <div className="flex items-center gap-3 bg-card/60 p-2.5 rounded-lg border border-border/60">
              <Button
                variant={mixerState.ostinato.muted ? 'destructive' : 'ghost'}
                size="sm"
                aria-label={mixerState.ostinato.muted ? 'Unmute Ostinato' : 'Mute Ostinato'}
                onClick={() => handleMuteToggle('ostinato')}
                className={cn('w-9 h-9 p-0 rounded-lg shrink-0', !mixerState.ostinato.muted && 'text-muted-foreground hover:text-foreground')}
              >
                {mixerState.ostinato.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-foreground">
                    Ostinato <span className="text-[10px] text-muted-foreground font-normal">(Ride / Hi-Hat)</span>
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {mixerState.ostinato.muted ? (
                      <span className="text-rose-400 font-semibold">MUTED</span>
                    ) : (
                      `${Math.round(mixerState.ostinato.volume * 100)}%`
                    )}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={mixerState.ostinato.volume}
                  onChange={(val) => handleVolumeChange('ostinato', val)}
                  ariaLabel="Ostinato Volume"
                  className={cn(mixerState.ostinato.muted && 'opacity-40')}
                />
              </div>
            </div>

            {/* Channel 3: Orchestrated Line */}
            <div className="flex items-center gap-3 bg-card/60 p-2.5 rounded-lg border border-border/60">
              <Button
                variant={mixerState.orchestration.muted ? 'destructive' : 'ghost'}
                size="sm"
                aria-label={mixerState.orchestration.muted ? 'Unmute Orchestrated Line' : 'Mute Orchestrated Line'}
                onClick={() => handleMuteToggle('orchestration')}
                className={cn(
                  'w-9 h-9 p-0 rounded-lg shrink-0',
                  !mixerState.orchestration.muted && 'text-muted-foreground hover:text-foreground'
                )}
              >
                {mixerState.orchestration.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-foreground">
                    Orchestrated Line <span className="text-[10px] text-muted-foreground font-normal">(Snare / Kick)</span>
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {mixerState.orchestration.muted ? (
                      <span className="text-rose-400 font-semibold">MUTED</span>
                    ) : (
                      `${Math.round(mixerState.orchestration.volume * 100)}%`
                    )}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={mixerState.orchestration.volume}
                  onChange={(val) => handleVolumeChange('orchestration', val)}
                  ariaLabel="Orchestrated Line Volume"
                  className={cn(mixerState.orchestration.muted && 'opacity-40')}
                />
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
