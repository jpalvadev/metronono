import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Square,
  VolumeX,
  Activity,
  TrendingUp,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ToneTransportScheduler } from '../audio/ToneTransportScheduler';
import {
  BeatEvent,
  TimeSignature,
  TempoRampConfig,
  DropoutConfig,
  MetronomeClickConfig,
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

// The subdivision voice splits each beat into equal parts so its clicks land in
// the gaps between beats; one part is the beat click alone, with no gap clicks.
function getGapClicksLabel(divisions: number): string {
  return divisions > 1 ? `Split each beat into ${divisions} parts` : 'None';
}

export const Metronome: React.FC<MetronomeProps> = ({ scheduler: customScheduler }) => {
  const scheduler = useMemo(() => customScheduler ?? new ToneTransportScheduler(), [customScheduler]);

  const [isPlaying, setIsPlaying] = useState<boolean>(() => scheduler.isPlaying());
  const [tempo, setTempoState] = useState<number>(() => scheduler.getTempo());
  const [tempInputValue, setTempInputValue] = useState<string>(() => String(scheduler.getTempo()));
  const [timeSignature, setTimeSignatureState] = useState<TimeSignature>(() => scheduler.getTimeSignature());
  const [activeBeat, setActiveBeat] = useState<number | null>(null);
  const [isTapActive, setIsTapActive] = useState<boolean>(false);

  // Advanced features state
  const [beatMask, setBeatMaskState] = useState<boolean[]>(() => scheduler.getBeatMask());
  const [rampConfig, setRampConfigState] = useState<TempoRampConfig>(() => scheduler.getTempoRampConfig());
  const [dropoutConfig, setDropoutConfigState] = useState<DropoutConfig>(() => scheduler.getDropoutConfig());
  const [clickConfig, setClickConfigState] = useState<MetronomeClickConfig>(() => scheduler.getClickConfig());
  const [isDropout, setIsDropout] = useState<boolean>(false);
  const [currentMeasure, setCurrentMeasure] = useState<number>(0);
  const [showAccents, setShowAccents] = useState<boolean>(false);

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

  const handleTimeSignatureChange = (tsStr: string) => {
    scheduler.setTimeSignature(tsStr);
    setTimeSignatureState(scheduler.getTimeSignature());
    setBeatMaskState(scheduler.getBeatMask());
  };

  // Beat Mask handlers
  const handleToggleBeat = (idx: number) => {
    scheduler.toggleBeat(idx);
    setBeatMaskState(scheduler.getBeatMask());
  };

  const handleSetPresetMask = (mask: boolean[]) => {
    scheduler.setBeatMask(mask);
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

  const handleDropoutProbabilityChange = (percent: number) => {
    const updated = {
      ...dropoutConfig,
      probability: percent / 100,
    };
    scheduler.setDropoutConfig(updated);
    setDropoutConfigState(scheduler.getDropoutConfig());
  };

  // Voice accent customization handlers
  const handleVoicePitchChange = (voice: 'downbeat' | 'regular' | 'subdivision', pitch: string) => {
    scheduler.updateVoiceConfig(voice, { pitch });
    setClickConfigState(scheduler.getClickConfig());
  };

  const handleVoiceVolumeChange = (voice: 'downbeat' | 'regular' | 'subdivision', volPercent: number) => {
    scheduler.updateVoiceConfig(voice, { volume: volPercent / 100 });
    setClickConfigState(scheduler.getClickConfig());
  };

  const handleGapClicksChange = (divisions: number) => {
    scheduler.updateVoiceConfig('subdivision', { divisions });
    setClickConfigState(scheduler.getClickConfig());
  };

  const isCurrentTimeSig = (tsStr: string) => {
    const [beats, unit] = tsStr.split('/').map(Number);
    return timeSignature.beats === beats && timeSignature.beatUnit === unit;
  };

  const rampProgress = scheduler.getRampProgress(currentMeasure, activeBeat ?? 0);

  return (
    <div className="w-full max-w-lg mx-auto p-6 bg-card border border-border rounded-xl shadow-xl flex flex-col gap-6 text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            METRONONO
          </h1>
          <p className="text-xs text-muted-foreground font-medium">Smart Drum Metronome & Training</p>
        </div>
        <Badge variant={isPlaying ? 'default' : 'secondary'} className="gap-1.5 py-1">
          <span
            className={cn('w-2 h-2 rounded-full', {
              'bg-primary animate-pulse': isPlaying,
              'bg-muted-foreground': !isPlaying,
            })}
          />
          {isPlaying ? 'ACTIVE' : 'STOPPED'}
        </Badge>
      </div>

      {/* Prominent Dropout Mode Banner when active measure is silenced */}
      {isDropout && (
        <div className="bg-amber-500/20 border-2 border-amber-500 text-amber-300 font-extrabold text-sm py-2 px-4 rounded-xl text-center tracking-widest uppercase animate-pulse shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2">
          <VolumeX className="w-5 h-5 text-amber-400 animate-bounce" />
          <span>DROPOUT / SILENT BAR</span>
        </div>
      )}

      {/* Beat Selector Buttons & Visual Playhead */}
      <div className="flex flex-col gap-2 items-center">
        <div className="flex justify-center items-center gap-3 py-1">
          {Array.from({ length: timeSignature.beats }).map((_, idx) => {
            const isDownbeat = idx === 0;
            const isActiveBeat = activeBeat === idx;
            const isBeatAudible = beatMask[idx] ?? true;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleToggleBeat(idx)}
                aria-label={`Beat ${idx + 1}: ${isBeatAudible ? 'Active' : 'Muted'}`}
                title={`Beat ${idx + 1} (${isBeatAudible ? 'Click to Mute' : 'Click to Activate'})`}
                className={cn(
                  'relative transition-all duration-100 rounded-full flex flex-col items-center justify-center font-bold text-xs border select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary',
                  isDownbeat ? 'w-12 h-12 text-sm' : 'w-10 h-10 text-xs',
                  !isBeatAudible && 'opacity-40 border-dashed border-muted-foreground',
                  isActiveBeat
                    ? isDownbeat
                      ? 'bg-primary text-primary-foreground border-primary scale-110 shadow-lg shadow-primary/40 ring-2 ring-primary'
                      : 'bg-primary/90 text-primary-foreground border-primary scale-105 shadow-md shadow-primary/30 ring-2 ring-primary'
                    : isBeatAudible
                      ? isDownbeat
                        ? 'bg-muted/70 text-foreground border-primary/40 hover:border-primary'
                        : 'bg-muted/40 text-muted-foreground border-border/60 hover:border-primary/50'
                      : 'bg-muted/20 text-muted-foreground/60'
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

        {/* Quick Beat Presets */}
        <div className="flex gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => handleSetPresetMask(Array(timeSignature.beats).fill(true))}
            className="px-2 py-0.5 rounded bg-muted/40 hover:bg-muted text-foreground border border-border/40 font-medium"
          >
            All
          </button>
          {timeSignature.beats === 4 && (
            <>
              <button
                type="button"
                onClick={() => handleSetPresetMask([false, true, false, true])}
                className="px-2 py-0.5 rounded bg-muted/40 hover:bg-muted text-primary border border-primary/30 font-medium"
              >
                2 & 4 (Jazz)
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetMask([true, false, true, false])}
                className="px-2 py-0.5 rounded bg-muted/40 hover:bg-muted text-foreground border border-border/40 font-medium"
              >
                1 & 3
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              const mask = Array(timeSignature.beats).fill(false);
              mask[0] = true;
              handleSetPresetMask(mask);
            }}
            className="px-2 py-0.5 rounded bg-muted/40 hover:bg-muted text-foreground border border-border/40 font-medium"
          >
            1 Only
          </button>
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
              className="w-full text-center py-1 px-2 text-sm bg-muted/60 border border-border rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Direct BPM input"
            />
          </div>
        </div>
      </div>

      {/* Tap Tempo & Time Signatures */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          variant="outline"
          onClick={handleTap}
          className={cn(
            'h-12 border-border font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95',
            isTapActive && 'bg-primary/20 border-primary text-primary'
          )}
        >
          <Activity className="w-4 h-4 text-primary" />
          <span>TAP TEMPO</span>
        </Button>

        <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => handleTimeSignatureChange('4/4')}
            className={cn(
              'flex-1 py-2 text-sm font-bold rounded-md transition-all select-none',
              isCurrentTimeSig('4/4')
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            4/4
          </button>
          <button
            type="button"
            onClick={() => handleTimeSignatureChange('3/4')}
            className={cn(
              'flex-1 py-2 text-sm font-bold rounded-md transition-all select-none',
              isCurrentTimeSig('3/4')
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            3/4
          </button>
        </div>
      </div>

      {/* Advanced Training: Tempo Ramp Panel */}
      <div className="bg-muted/20 border border-border/70 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">Tempo Ramp</span>
          </div>
          <Button
            size="sm"
            variant={rampConfig.enabled ? 'default' : 'outline'}
            onClick={handleToggleRamp}
            aria-label="Toggle Tempo Ramp"
            className="text-xs font-semibold h-7 px-3"
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
                  className="w-full bg-muted/60 border border-border rounded-md px-2 py-1 font-mono text-center"
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
                  className="w-full bg-muted/60 border border-border rounded-md px-2 py-1 font-mono text-center"
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
      <div className="bg-muted/20 border border-border/70 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VolumeX className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-sm font-bold">Dropout Mode</span>
              <span className="text-[11px] text-muted-foreground ml-2">Internal Clock Test</span>
            </div>
          </div>
          <Button
            size="sm"
            variant={dropoutConfig.enabled ? 'default' : 'outline'}
            onClick={handleToggleDropout}
            aria-label="Toggle Dropout Mode"
            className="text-xs font-semibold h-7 px-3"
          >
            {dropoutConfig.enabled ? 'ON' : 'OFF'}
          </Button>
        </div>

        {dropoutConfig.enabled && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border/40 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Silence Probability</span>
              <span className="font-mono text-amber-400 font-bold">
                {Math.round(dropoutConfig.probability * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={Math.round(dropoutConfig.probability * 100)}
              onChange={handleDropoutProbabilityChange}
              ariaLabel="Dropout percentage"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Random bars will be completely silenced to test whether your internal tempo drifts.
            </p>
          </div>
        )}
      </div>

      {/* Click Accents & Pitches Customization (Collapsible) */}
      <div className="bg-muted/20 border border-border/70 rounded-xl p-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setShowAccents(!showAccents)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">Click Sounds & Pitches</span>
          </div>
          {showAccents ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAccents && (
          <div className="flex flex-col gap-3 pt-2 border-t border-border/40 text-xs">
            {/* Downbeat voice */}
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label htmlFor="downbeat-pitch-input" className="block text-muted-foreground mb-1 font-medium">
                  Downbeat Pitch
                </label>
                <input
                  id="downbeat-pitch-input"
                  type="text"
                  value={clickConfig.downbeat.pitch}
                  onChange={(e) => handleVoicePitchChange('downbeat', e.target.value)}
                  aria-label="Downbeat pitch"
                  className="w-full bg-muted/60 border border-border rounded-md px-2 py-1 font-mono text-center"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  Volume ({Math.round(clickConfig.downbeat.volume * 100)}%)
                </label>
                <Slider
                  min={0}
                  max={100}
                  value={Math.round(clickConfig.downbeat.volume * 100)}
                  onChange={(v) => handleVoiceVolumeChange('downbeat', v)}
                  ariaLabel="Downbeat volume"
                />
              </div>
            </div>

            {/* Regular voice */}
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label htmlFor="regular-pitch-input" className="block text-muted-foreground mb-1 font-medium">
                  Regular Pitch
                </label>
                <input
                  id="regular-pitch-input"
                  type="text"
                  value={clickConfig.regular.pitch}
                  onChange={(e) => handleVoicePitchChange('regular', e.target.value)}
                  aria-label="Regular pitch"
                  className="w-full bg-muted/60 border border-border rounded-md px-2 py-1 font-mono text-center"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  Volume ({Math.round(clickConfig.regular.volume * 100)}%)
                </label>
                <Slider
                  min={0}
                  max={100}
                  value={Math.round(clickConfig.regular.volume * 100)}
                  onChange={(v) => handleVoiceVolumeChange('regular', v)}
                  ariaLabel="Regular volume"
                />
              </div>
            </div>

            {/* Subdivision voice */}
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label htmlFor="subdivision-pitch-input" className="block text-muted-foreground mb-1 font-medium">
                  Subdivision Pitch
                </label>
                <input
                  id="subdivision-pitch-input"
                  type="text"
                  value={clickConfig.subdivision.pitch}
                  onChange={(e) => handleVoicePitchChange('subdivision', e.target.value)}
                  aria-label="Subdivision pitch"
                  className="w-full bg-muted/60 border border-border rounded-md px-2 py-1 font-mono text-center"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1 font-medium">
                  Volume ({Math.round(clickConfig.subdivision.volume * 100)}%)
                </label>
                <Slider
                  min={0}
                  max={100}
                  value={Math.round(clickConfig.subdivision.volume * 100)}
                  onChange={(v) => handleVoiceVolumeChange('subdivision', v)}
                  ariaLabel="Subdivision volume"
                />
              </div>
            </div>

            {/* Gap Clicks: how many equal parts each beat is clicked into */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Gap clicks: {getGapClicksLabel(clickConfig.subdivision.divisions ?? 1)}
              </span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((divisions) => {
                  const isActive = (clickConfig.subdivision.divisions ?? 1) === divisions;
                  return (
                    <button
                      key={divisions}
                      type="button"
                      onClick={() => handleGapClicksChange(divisions)}
                      aria-label={`Gap clicks: ${getGapClicksLabel(divisions)}`}
                      title={divisions === 1 ? 'Beat clicks only' : 'Click the gaps between beats too'}
                      className={cn(
                        'px-2 py-0.5 rounded text-xs font-mono border border-border/40 cursor-pointer select-none transition-all',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {divisions === 1 ? 'None' : `${divisions}×`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Play / Stop Button */}
      <Button
        size="lg"
        onClick={handleTogglePlay}
        className={cn(
          'w-full h-14 text-lg font-bold tracking-wider uppercase transition-all shadow-lg',
          isPlaying
            ? 'bg-destructive/90 hover:bg-destructive text-destructive-foreground shadow-destructive/20'
            : 'bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold shadow-primary/30'
        )}
      >
        {isPlaying ? (
          <span className="flex items-center gap-2">
            <Square className="w-5 h-5 fill-current" /> STOP
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Play className="w-5 h-5 fill-current" /> PLAY
          </span>
        )}
      </Button>
    </div>
  );
};
