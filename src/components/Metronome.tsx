import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Square,
  VolumeX,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { ToneTransportScheduler } from '../audio/ToneTransportScheduler';
import {
  BeatEvent,
  TimeSignature,
  PulseFeel,
  TempoRampConfig,
  DropoutConfig,
} from '../domain/metronome/MetronomeEngine';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

export interface MetronomeProps {
  scheduler?: ToneTransportScheduler;
}

function getTempoMarking(bpm: number): string {
  if (bpm < 60) return 'Largo';
  if (bpm < 76) return 'Adagio';
  if (bpm < 108) return 'Andante';
  if (bpm < 132) return 'Moderato';
  if (bpm < 168) return 'Allegro';
  if (bpm < 200) return 'Presto';
  return 'Prestissimo';
}

export const Metronome: React.FC<MetronomeProps> = ({ scheduler: customScheduler }) => {
  const scheduler = useMemo(() => customScheduler ?? new ToneTransportScheduler(), [customScheduler]);

  const [isPlaying, setIsPlaying] = useState<boolean>(() => scheduler.isPlaying());
  const [tempo, setTempoState] = useState<number>(() => scheduler.getTempo());
  const [tempInputValue, setTempInputValue] = useState<string>(() => String(scheduler.getTempo()));
  const [timeSignature, setTimeSignatureState] = useState<TimeSignature>(() => scheduler.getTimeSignature());
  const [pulseFeel, setPulseFeelState] = useState<PulseFeel>(() => scheduler.getPulseFeel());
  const [activeBeat, setActiveBeat] = useState<number | null>(null);
  const [isTapActive, setIsTapActive] = useState<boolean>(false);

  // Advanced features state
  const [beatMask, setBeatMaskState] = useState<boolean[]>(() => scheduler.getBeatMask());
  const [rampConfig, setRampConfigState] = useState<TempoRampConfig>(() => scheduler.getTempoRampConfig());
  const [dropoutConfig, setDropoutConfigState] = useState<DropoutConfig>(() => scheduler.getDropoutConfig());
  const [isDropout, setIsDropout] = useState<boolean>(false);
  const [currentMeasure, setCurrentMeasure] = useState<number>(0);

  const activeBeatTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribeBeat = scheduler.onBeat((event: BeatEvent) => {
      setActiveBeat(event.beatIndex);
      setIsDropout(event.isDropout);
      setCurrentMeasure(event.measureIndex);
      if (event.bpm && event.bpm !== tempo) {
        setTempoState(event.bpm);
        setTempInputValue(String(event.bpm));
      }

      if (activeBeatTimeoutRef.current !== null) {
        window.clearTimeout(activeBeatTimeoutRef.current);
      }
      activeBeatTimeoutRef.current = window.setTimeout(() => {
        setActiveBeat(null);
      }, 120);
    });

    const unsubscribeDropout = scheduler.onDropoutChange((dropoutState: boolean) => {
      setIsDropout(dropoutState);
    });

    return () => {
      unsubscribeBeat();
      unsubscribeDropout();
      if (activeBeatTimeoutRef.current !== null) {
        window.clearTimeout(activeBeatTimeoutRef.current);
      }
    };
  }, [scheduler, tempo]);

  const handleTogglePlay = async () => {
    if (isPlaying) {
      scheduler.stop();
      setIsPlaying(false);
      setActiveBeat(null);
      setIsDropout(false);
    } else {
      await scheduler.start();
      setIsPlaying(true);
    }
  };

  const handleTempoChange = (newTempo: number) => {
    scheduler.setTempo(newTempo);
    const resolvedTempo = scheduler.getTempo();
    setTempoState(resolvedTempo);
    setTempInputValue(String(resolvedTempo));
  };

  const handleStepTempo = (delta: number) => {
    handleTempoChange(tempo + delta);
  };

  const handleInputBlur = () => {
    const parsed = parseInt(tempInputValue, 10);
    if (isNaN(parsed)) {
      setTempInputValue(String(tempo));
    } else {
      handleTempoChange(parsed);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    }
  };

  const handleTap = () => {
    setIsTapActive(true);
    setTimeout(() => setIsTapActive(false), 150);

    const calculatedBpm = scheduler.tap();
    if (calculatedBpm !== null) {
      setTempoState(calculatedBpm);
      setTempInputValue(String(calculatedBpm));
    }
  };

  const handleTimeSignatureChange = (beats: number, beatUnit: number) => {
    scheduler.setTimeSignature({ beats, beatUnit });
    setTimeSignatureState(scheduler.getTimeSignature());
    setBeatMaskState(scheduler.getBeatMask());
  };

  const handlePulseFeelChange = (feel: PulseFeel) => {
    scheduler.setPulseFeel(feel);
    setPulseFeelState(scheduler.getPulseFeel());
    setBeatMaskState(scheduler.getBeatMask());
  };

  // Beat Mask handlers
  const handleToggleBeat = (idx: number) => {
    scheduler.toggleBeat(idx);
    setBeatMaskState(scheduler.getBeatMask());
  };

  // Tempo Ramp handlers
  const handleToggleRamp = () => {
    const updated = {
      ...rampConfig,
      enabled: !rampConfig.enabled,
      startBpm: tempo,
    };
    scheduler.setTempoRampConfig(updated);
    setRampConfigState(scheduler.getTempoRampConfig());
  };

  const handleRampTargetChange = (targetBpm: number) => {
    const updated = { ...rampConfig, targetBpm };
    scheduler.setTempoRampConfig(updated);
    setRampConfigState(scheduler.getTempoRampConfig());
  };

  const handleRampBarsChange = (durationBars: number) => {
    const updated = { ...rampConfig, durationBars };
    scheduler.setTempoRampConfig(updated);
    setRampConfigState(scheduler.getTempoRampConfig());
  };

  // Dropout Mode handlers
  const handleToggleDropout = () => {
    const updated = {
      ...dropoutConfig,
      enabled: !dropoutConfig.enabled,
    };
    scheduler.setDropoutConfig(updated);
    setDropoutConfigState(scheduler.getDropoutConfig());
    if (!updated.enabled) {
      setIsDropout(false);
    }
  };

  const isDropoutBarCycleActive =
    dropoutConfig.clickBars > 0 || dropoutConfig.silentBars > 0;

  const handleDropoutProbabilityChange = (percent: number) => {
    if (isDropoutBarCycleActive) return;
    const updated = {
      ...dropoutConfig,
      probability: percent / 100,
    };
    scheduler.setDropoutConfig(updated);
    setDropoutConfigState(scheduler.getDropoutConfig());
  };

  const handleDropoutBarCountChange = (field: 'clickBars' | 'silentBars', rawValue: number) => {
    const clamped = Number.isFinite(rawValue)
      ? Math.max(0, Math.min(32, Math.round(rawValue)))
      : 0;
    const updated = {
      ...dropoutConfig,
      [field]: clamped,
    };
    scheduler.setDropoutConfig(updated);
    setDropoutConfigState(scheduler.getDropoutConfig());
  };

  const rampProgress = scheduler.getRampProgress(currentMeasure, activeBeat ?? 0);

  return (
    <div className="w-full h-full p-5 bg-card border border-border rounded-none shadow-sm flex flex-col justify-between gap-5 text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
            Metronome Engine
          </h2>
          <p className="text-xs text-muted-foreground">Smart Drum Metronome &middot; Clock timing, tempo and subdivision</p>
        </div>
        <Badge variant={isPlaying ? 'default' : 'outline'} className="rounded-none">
          {isPlaying ? 'ACTIVE' : 'STOPPED'}
        </Badge>
      </div>

      {/* Prominent Dropout Mode Banner when active measure is silenced */}
      {isDropout && (
        <div className="bg-warning/20 border border-warning text-warning font-bold text-xs py-1.5 px-3 rounded-none text-center tracking-wider uppercase animate-pulse flex items-center justify-center gap-2">
          <VolumeX className="w-4 h-4 text-warning" />
          <span>DROPOUT / SILENT BAR</span>
        </div>
      )}

      {/* Beat Selector Buttons & Visual Playhead */}
      <div className="flex flex-col gap-2 items-center">
        <div
          className={cn(
            'flex flex-wrap justify-center items-center py-1',
            beatMask.length > 8 ? 'gap-1.5' : 'gap-2'
          )}
        >
          {beatMask.map((isBeatAudible, idx) => {
            const isDownbeat = idx === 0;
            const isActiveBeat = activeBeat === idx;
            const isCompact = beatMask.length > 8;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleToggleBeat(idx)}
                aria-label={`Beat ${idx + 1}: ${isBeatAudible ? 'Active' : 'Muted'}`}
                title={`Beat ${idx + 1} (${isBeatAudible ? 'Click to Mute' : 'Click to Activate'})`}
                className={cn(
                  'relative transition-all duration-100 rounded-none flex flex-col items-center justify-center font-bold border select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring',
                  isCompact
                    ? 'w-8 h-8 text-[11px]'
                    : isDownbeat
                      ? 'w-11 h-11 text-sm'
                      : 'w-10 h-10 text-xs',
                  !isBeatAudible && 'opacity-30 border-dashed border-border',
                  isActiveBeat
                    ? 'bg-primary text-primary-foreground border-primary scale-105 shadow-sm'
                    : isBeatAudible
                      ? isDownbeat
                        ? 'bg-secondary text-foreground border-border hover:border-primary'
                        : 'bg-muted text-muted-foreground border-border hover:border-primary'
                      : 'bg-transparent text-muted-foreground/40'
                )}
              >
                <span>{idx + 1}</span>
                <span className="text-[9px] font-mono tracking-tighter leading-none mt-0.5">
                  {isBeatAudible ? 'ON' : 'OFF'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tempo Display & Quick Steps */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStepTempo(-5)}
            title="Decrease 5 BPM"
            className="text-xs font-mono font-semibold"
          >
            -5
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStepTempo(-1)}
            title="Decrease 1 BPM"
            className="text-xs font-mono font-semibold"
          >
            -1
          </Button>

          <div className="flex flex-col items-center px-4">
            <div className="flex items-baseline gap-1">
              <span className="text-6xl font-extrabold tracking-tighter text-foreground font-mono">
                {tempo}
              </span>
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                BPM
              </span>
            </div>
            <span className="text-xs font-medium text-primary tracking-wider uppercase mt-1">
              {getTempoMarking(tempo)}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStepTempo(1)}
            title="Increase 1 BPM"
            className="text-xs font-mono font-semibold"
          >
            +1
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStepTempo(5)}
            title="Increase 5 BPM"
            className="text-xs font-mono font-semibold"
          >
            +5
          </Button>
        </div>

        {/* BPM Continuous Slider & Manual Input */}
        <div className="w-full flex items-center gap-4 pt-2">
          <Slider
            min={30}
            max={300}
            value={tempo}
            onChange={handleTempoChange}
            ariaLabel="BPM"
          />
          <div className="w-20">
            <input
              type="number"
              min={30}
              max={300}
              value={tempInputValue}
              onChange={(e) => setTempInputValue(e.target.value)}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="w-full text-center py-1 px-2 text-xs bg-secondary/60 border border-input rounded-none font-mono focus:outline-none focus:border-ring"
              aria-label="Direct BPM input"
            />
          </div>
        </div>
      </div>

      {/* Tap Tempo, Time Signatures & Pulse Feel */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={handleTap}
            className={cn(
              'h-9 border-border font-medium text-xs flex items-center justify-center gap-2 rounded-none',
              isTapActive && 'bg-primary/20 border-primary text-primary'
            )}
          >
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span>TAP TEMPO</span>
          </Button>

          <div className="flex items-center bg-secondary/40 p-0.5 rounded-none border border-border h-9">
            <button
              type="button"
              onClick={() =>
                handleTimeSignatureChange(Math.max(1, timeSignature.beats - 1), timeSignature.beatUnit)
              }
              aria-label="Decrease numerator"
              className="px-2 h-full text-xs font-mono font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-none select-none"
            >
              -
            </button>
            <input
              type="number"
              min={1}
              max={32}
              value={timeSignature.beats}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                if (!isNaN(parsed)) {
                  handleTimeSignatureChange(parsed, timeSignature.beatUnit);
                }
              }}
              aria-label="Time signature numerator"
              className="w-10 text-center bg-transparent text-xs font-mono font-bold text-foreground focus:outline-none rounded-none"
            />
            <button
              type="button"
              onClick={() =>
                handleTimeSignatureChange(Math.min(32, timeSignature.beats + 1), timeSignature.beatUnit)
              }
              aria-label="Increase numerator"
              className="px-2 h-full text-xs font-mono font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-none select-none"
            >
              +
            </button>
            <span className="px-1 text-xs font-mono text-muted-foreground select-none">/</span>
            <select
              value={timeSignature.beatUnit}
              onChange={(e) =>
                handleTimeSignatureChange(timeSignature.beats, parseInt(e.target.value, 10))
              }
              aria-label="Time signature denominator"
              className="flex-1 h-full bg-transparent text-xs font-mono font-bold text-foreground text-center focus:outline-none rounded-none cursor-pointer px-1"
            >
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={16}>16</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between bg-secondary/40 px-2.5 rounded-none border border-border h-8">
          <label
            htmlFor="pulse-feel-select"
            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Pulse Feel
          </label>
          <select
            id="pulse-feel-select"
            value={pulseFeel}
            onChange={(e) => handlePulseFeelChange(e.target.value as PulseFeel)}
            aria-label="Pulse feel"
            className="bg-transparent text-xs font-mono font-bold text-foreground focus:outline-none rounded-none cursor-pointer px-1"
          >
            <option value="straight">Straight (2×8th)</option>
            <option value="triplet">Triplet (3×8th)</option>
          </select>
        </div>
      </div>

      {/* Advanced Training: Tempo Ramp Panel */}
      <div className="bg-secondary/30 border border-border rounded-none p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider">Tempo Ramp</span>
          </div>
          <Button
            size="sm"
            variant={rampConfig.enabled ? 'default' : 'outline'}
            onClick={handleToggleRamp}
            aria-label="Toggle Tempo Ramp"
            className="text-[11px] font-semibold h-6 px-2.5 rounded-none"
          >
            {rampConfig.enabled ? 'ON' : 'OFF'}
          </Button>
        </div>

        {rampConfig.enabled && (
          <div className="flex flex-col gap-3 pt-2 border-t border-border/40 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="target-bpm-input" className="block text-muted-foreground mb-1 font-medium">
                  Target BPM
                </label>
                <input
                  id="target-bpm-input"
                  type="number"
                  min={30}
                  max={300}
                  value={rampConfig.targetBpm}
                  onChange={(e) => handleRampTargetChange(Number(e.target.value))}
                  aria-label="Target BPM"
                  className="w-full bg-muted/60 border border-border rounded-none px-2 py-1 font-mono text-center"
                />
              </div>
              <div>
                <label htmlFor="duration-bars-input" className="block text-muted-foreground mb-1 font-medium">
                  Duration (bars)
                </label>
                <input
                  id="duration-bars-input"
                  type="number"
                  min={1}
                  max={64}
                  value={rampConfig.durationBars}
                  onChange={(e) => handleRampBarsChange(Number(e.target.value))}
                  aria-label="Duration Bars"
                  className="w-full bg-muted/60 border border-border rounded-none px-2 py-1 font-mono text-center"
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-muted-foreground text-[11px] pt-1">
              <span>
                {rampConfig.startBpm} → {rampConfig.targetBpm} BPM ({rampConfig.durationBars} bars)
              </span>
              <span className="font-mono text-primary font-semibold">
                {Math.round(rampProgress.progress * 100)}% progress
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Training: Stochastic Dropout Mode Panel */}
      <div className="bg-secondary/30 border border-border rounded-none p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <VolumeX className="w-3.5 h-3.5 text-warning" />
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider">Dropout Mode</span>
              <span className="text-[10px] text-muted-foreground ml-2">Internal Clock Test</span>
            </div>
          </div>
          <Button
            size="sm"
            variant={dropoutConfig.enabled ? 'default' : 'outline'}
            onClick={handleToggleDropout}
            aria-label="Toggle Dropout Mode"
            className="text-[11px] font-semibold h-6 px-2.5 rounded-none"
          >
            {dropoutConfig.enabled ? 'ON' : 'OFF'}
          </Button>
        </div>

        {dropoutConfig.enabled && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border text-xs">
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { field: 'clickBars', label: 'Click Bars', id: 'dropout-click-bars' },
                  { field: 'silentBars', label: 'Silent Bars', id: 'dropout-silent-bars' },
                ] as const
              ).map(({ field, label, id }) => {
                const count = dropoutConfig[field];
                return (
                  <div key={field} className="flex flex-col gap-1">
                    <label htmlFor={id} className="text-muted-foreground font-medium">
                      {label}
                    </label>
                    <div className="flex items-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleDropoutBarCountChange(field, count - 1)}
                        disabled={count <= 0}
                        aria-label={`Decrease ${label}`}
                        className="h-7 px-2 rounded-none font-mono text-xs"
                      >
                        -
                      </Button>
                      <input
                        id={id}
                        type="number"
                        min={0}
                        max={32}
                        value={count}
                        onChange={(e) => handleDropoutBarCountChange(field, Number(e.target.value))}
                        aria-label={label}
                        className="w-full h-7 bg-muted/60 border-y border-border rounded-none px-1.5 font-mono text-center text-xs focus:outline-none"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleDropoutBarCountChange(field, count + 1)}
                        disabled={count >= 32}
                        aria-label={`Increase ${label}`}
                        className="h-7 px-2 rounded-none font-mono text-xs"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              className={cn(
                'flex justify-between text-muted-foreground',
                isDropoutBarCycleActive && 'opacity-40'
              )}
            >
              <span>Silence Probability</span>
              <span className="font-mono text-warning font-bold">
                {Math.round(dropoutConfig.probability * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={Math.round(dropoutConfig.probability * 100)}
              disabled={isDropoutBarCycleActive}
              onChange={handleDropoutProbabilityChange}
              ariaLabel="Dropout percentage"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {isDropoutBarCycleActive
                ? 'Bar cycle active — random Silence Probability is disabled.'
                : 'Random bars will be completely silenced to test whether your internal tempo drifts.'}
            </p>
          </div>
        )}
      </div>

      {/* Main Play / Stop Button */}
      <Button
        size="lg"
        onClick={handleTogglePlay}
        aria-label={isPlaying ? 'Stop metronome' : 'Play metronome'}
        className={cn(
          'w-full h-10 text-xs font-semibold tracking-wider uppercase transition-all rounded-none shadow-xs',
          isPlaying
            ? 'bg-destructive/80 hover:bg-destructive text-destructive-foreground'
            : 'bg-primary hover:bg-primary/90 text-primary-foreground'
        )}
      >
        {isPlaying ? (
          <span className="flex items-center gap-1.5">
            <Square className="w-3.5 h-3.5 fill-current" /> STOP CLOCK
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5 fill-current" /> START CLOCK
          </span>
        )}
      </Button>
    </div>
  );
};
