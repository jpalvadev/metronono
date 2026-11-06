import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Square, Volume2, Volume1, VolumeX, Activity } from 'lucide-react';
import { ToneTransportScheduler } from '../audio/ToneTransportScheduler';
import { BeatEvent, TimeSignature } from '../domain/metronome/MetronomeEngine';
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
  const [volume, setVolumeState] = useState<number>(() => scheduler.getVolume());
  const [activeBeat, setActiveBeat] = useState<number | null>(null);
  const [isTapActive, setIsTapActive] = useState<boolean>(false);

  const activeBeatTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = scheduler.onBeat((event: BeatEvent) => {
      setActiveBeat(event.beatIndex);
      if (activeBeatTimeoutRef.current !== null) {
        window.clearTimeout(activeBeatTimeoutRef.current);
      }
      activeBeatTimeoutRef.current = window.setTimeout(() => {
        setActiveBeat(null);
      }, 120);
    });

    return () => {
      unsubscribe();
      if (activeBeatTimeoutRef.current !== null) {
        window.clearTimeout(activeBeatTimeoutRef.current);
      }
    };
  }, [scheduler]);

  const handleTogglePlay = async () => {
    if (isPlaying) {
      scheduler.stop();
      setIsPlaying(false);
      setActiveBeat(null);
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
  };

  const handleVolumeChange = (newVolPercent: number) => {
    const fraction = newVolPercent / 100;
    scheduler.setVolume(fraction);
    setVolumeState(fraction);
  };

  const toggleMute = () => {
    if (volume > 0) {
      scheduler.setVolume(0);
      setVolumeState(0);
    } else {
      scheduler.setVolume(0.8);
      setVolumeState(0.8);
    }
  };

  const isCurrentTimeSig = (tsStr: string) => {
    const [beats, unit] = tsStr.split('/').map(Number);
    return timeSignature.beats === beats && timeSignature.beatUnit === unit;
  };

  const volumePercent = Math.round(volume * 100);

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-card border border-border rounded-2xl shadow-xl flex flex-col gap-6 text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-teal-400 flex items-center gap-2">
            METRONONO
          </h1>
          <p className="text-xs text-muted-foreground font-medium">Smart Drum Metronome</p>
        </div>
        <Badge variant={isPlaying ? 'default' : 'secondary'} className="gap-1.5 py-1">
          <span
            className={cn('w-2 h-2 rounded-full', {
              'bg-teal-400 animate-pulse': isPlaying,
              'bg-muted-foreground': !isPlaying,
            })}
          />
          {isPlaying ? 'ACTIVE' : 'STOPPED'}
        </Badge>
      </div>

      {/* Beat Indicators */}
      <div className="flex justify-center items-center gap-3 py-2">
        {Array.from({ length: timeSignature.beats }).map((_, idx) => {
          const isDownbeat = idx === 0;
          const isActive = activeBeat === idx;

          return (
            <div
              key={idx}
              className={cn(
                'transition-all duration-100 rounded-full flex items-center justify-center font-bold text-xs border select-none',
                isDownbeat ? 'w-10 h-10' : 'w-8 h-8',
                isActive
                  ? isDownbeat
                    ? 'bg-teal-400 text-teal-950 border-teal-300 scale-110 shadow-lg shadow-teal-500/40'
                    : 'bg-teal-500 text-teal-950 border-teal-400 scale-105 shadow-md shadow-teal-500/30'
                  : isDownbeat
                    ? 'bg-muted/70 text-foreground border-teal-500/30'
                    : 'bg-muted/40 text-muted-foreground border-border/60'
              )}
            >
              {idx + 1}
            </div>
          );
        })}
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
            <span className="text-xs font-medium text-teal-400 tracking-wider uppercase mt-1">
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
              className="w-full text-center py-1 px-2 text-sm bg-muted/60 border border-border rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
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
            isTapActive && 'bg-teal-500/20 border-teal-500 text-teal-300'
          )}
        >
          <Activity className="w-4 h-4 text-teal-400" />
          <span>TAP TEMPO</span>
        </Button>

        <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => handleTimeSignatureChange('4/4')}
            className={cn(
              'flex-1 py-2 text-sm font-bold rounded-md transition-all select-none',
              isCurrentTimeSig('4/4')
                ? 'bg-teal-600 text-white shadow-sm'
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
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            3/4
          </button>
        </div>
      </div>

      {/* Master Volume */}
      <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border/60">
        <button
          type="button"
          onClick={toggleMute}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          title={volume === 0 ? 'Unmute' : 'Mute'}
          aria-label="Toggle mute"
        >
          {volume === 0 ? (
            <VolumeX className="w-5 h-5 text-destructive" />
          ) : volume < 0.5 ? (
            <Volume1 className="w-5 h-5 text-teal-400" />
          ) : (
            <Volume2 className="w-5 h-5 text-teal-400" />
          )}
        </button>
        <Slider
          min={0}
          max={100}
          value={volumePercent}
          onChange={handleVolumeChange}
          ariaLabel="Volume"
        />
        <span className="text-xs font-mono font-medium text-muted-foreground w-10 text-right">
          {volumePercent}%
        </span>
      </div>

      {/* Main Play / Stop Button */}
      <Button
        size="lg"
        onClick={handleTogglePlay}
        className={cn(
          'w-full h-14 text-lg font-bold tracking-wider uppercase transition-all shadow-lg',
          isPlaying
            ? 'bg-red-500/90 hover:bg-red-600 text-white shadow-red-500/20'
            : 'bg-teal-500 hover:bg-teal-400 text-teal-950 font-extrabold shadow-teal-500/30'
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
