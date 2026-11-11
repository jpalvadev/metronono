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
        <div className="flex justify-center items-center gap-2 py-1">
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
                  'relative transition-all duration-100 rounded-none flex flex-col items-center justify-center font-bold text-xs border select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring',
                  isDownbeat ? 'w-11 h-11 text-sm' : 'w-10 h-10 text-xs',
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

        {/* Quick Beat Presets */}
        <div className="flex gap-1.5 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => handleSetPresetMask(Array(timeSignature.beats).fill(true))}
            className="px-2 py-0.5 rounded-none bg-secondary hover:bg-secondary/80 text-foreground border border-border text-[11px] font-medium"
          >
            All
          </button>
          {timeSignature.beats === 4 && (
            <>
              <button
                type="button"
                onClick={() => handleSetPresetMask([false, true, false, true])}
                className="px-2 py-0.5 rounded-none bg-secondary hover:bg-secondary/80 text-primary border border-border text-[11px] font-medium"
              >
                2 & 4 (Jazz)
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetMask([true, false, true, false])}
                className="px-2 py-0.5 rounded-none bg-secondary hover:bg-secondary/80 text-foreground border border-border text-[11px] font-medium"
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
            className="px-2 py-0.5 rounded-none bg-secondary hover:bg-secondary/80 text-foreground border border-border text-[11px] font-medium"
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
              className="w-full text-center py-1 px-2 text-xs bg-secondary/60 border border-input rounded-none font-mono focus:outline-none focus:border-ring"
              aria-label="Direct BPM input"
            />
          </div>
        </div>
      </div>

      {/* Tap Tempo & Time Signatures */}
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

        <div className="flex bg-secondary/40 p-0.5 rounded-none border border-border">
          <button
            type="button"
            onClick={() => handleTimeSignatureChange('4/4')}
            className={cn(
              'flex-1 py-1.5 text-xs font-bold rounded-none transition-all select-none',
              isCurrentTimeSig('4/4')
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            4/4
          </button>
          <button
            type="button"
            onClick={() => handleTimeSignatureChange('3/4')}
            className={cn(
              'flex-1 py-1.5 text-xs font-bold rounded-none transition-all select-none',
              isCurrentTimeSig('3/4')
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            3/4
          </button>
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
            <div className="flex justify-between text-muted-foreground">
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
      <div className="bg-secondary/30 border border-border rounded-none p-3 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => setShowAccents(!showAccents)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider">Click Sounds & Pitches</span>
          </div>
          {showAccents ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showAccents && (
          <div className="flex flex-col gap-2.5 pt-2 border-t border-border text-xs">
            {/* Downbeat voice */}
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label htmlFor="downbeat-pitch-input" className="block text-muted-foreground mb-1 text-[11px] font-medium">
                  Downbeat Pitch
                </label>
                <input
                  id="downbeat-pitch-input"
                  type="text"
                  value={clickConfig.downbeat.pitch}
                  onChange={(e) => handleVoicePitchChange('downbeat', e.target.value)}
                  aria-label="Downbeat pitch"
                  className="w-full bg-secondary/50 border border-input rounded-none px-2 py-1 font-mono text-center text-xs"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1 text-[11px] font-medium">
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
                <label htmlFor="regular-pitch-input" className="block text-muted-foreground mb-1 text-[11px] font-medium">
                  Regular Pitch
                </label>
                <input
                  id="regular-pitch-input"
                  type="text"
                  value={clickConfig.regular.pitch}
                  onChange={(e) => handleVoicePitchChange('regular', e.target.value)}
                  aria-label="Regular pitch"
                  className="w-full bg-secondary/50 border border-input rounded-none px-2 py-1 font-mono text-center text-xs"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1 text-[11px] font-medium">
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
                <label htmlFor="subdivision-pitch-input" className="block text-muted-foreground mb-1 text-[11px] font-medium">
                  Subdivision Pitch
                </label>
                <input
                  id="subdivision-pitch-input"
                  type="text"
                  value={clickConfig.subdivision.pitch}
                  onChange={(e) => handleVoicePitchChange('subdivision', e.target.value)}
                  aria-label="Subdivision pitch"
                  className="w-full bg-secondary/50 border border-input rounded-none px-2 py-1 font-mono text-center text-xs"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1 text-[11px] font-medium">
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
                        'px-2 py-0.5 rounded-none text-xs font-mono border border-border cursor-pointer select-none transition-all',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
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
