import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { ReadingLine } from '../../domain/rhythm/types';
import { ToneTransportScheduler } from '../../audio/ToneTransportScheduler';
import { BeatEvent } from '../../domain/metronome/MetronomeEngine';
import {
  DrumStaffRenderer,
  DrumScoreMeasure,
  DrumScoreLayout,
  DRUM_VOICE_PAS_MAP,
} from '../../notation/DrumStaffRenderer';
import { PlayheadPosition, MeasureCoordinate } from '../../notation/types';
import { PlayheadOverlay } from './PlayheadOverlay';
import { ReadingView } from './ReadingView';
import { DawsonEngine } from '../../domain/dawson/DawsonEngine';
import { DrumVoice, ScheduledDrumEvent } from '../../domain/dawson/types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Music,
  FileMusic,
  RotateCcw,
  Trash2,
  Layers,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type NotationViewMode = 'reading' | 'drum_staff';

export interface DrumStaffViewProps {
  readingLine?: ReadingLine;
  dawsonEngine?: DawsonEngine;
  scheduler?: ToneTransportScheduler;
  isPlaying?: boolean;
  currentMeasureIndex?: number;
  currentBeatIndex?: number;
  measuresPerSystem?: number;
  className?: string;
  initialMeasures?: DrumScoreMeasure[];
  onMeasureChange?: (measures: DrumScoreMeasure[]) => void;
  viewMode?: NotationViewMode;
  onViewModeChange?: (mode: NotationViewMode) => void;
  showViewToggle?: boolean;
}

const PRIMARY_VOICES: Array<{ voice: DrumVoice; label: string; badge: string }> = [
  { voice: 'kick', label: 'Kick', badge: 'RF' },
  { voice: 'snare', label: 'Snare', badge: 'LH' },
  { voice: 'hihat_closed', label: 'Hi-Hat', badge: 'RH' },
  { voice: 'ride', label: 'Ride', badge: 'RH' },
  { voice: 'tom_high', label: 'High Tom', badge: 'RH' },
  { voice: 'tom_mid', label: 'Mid Tom', badge: 'RH' },
  { voice: 'tom_floor', label: 'Floor Tom', badge: 'RH' },
  { voice: 'crash', label: 'Crash', badge: 'RH' },
  { voice: 'hihat_foot', label: 'Hi-Hat Foot', badge: 'LF' },
];

export const DrumStaffView: React.FC<DrumStaffViewProps> = ({
  readingLine,
  dawsonEngine: externalDawsonEngine,
  scheduler,
  isPlaying = false,
  currentMeasureIndex: externalMeasureIndex,
  currentBeatIndex: externalBeatIndex,
  measuresPerSystem: propMeasuresPerSystem,
  className,
  initialMeasures,
  onMeasureChange,
  viewMode: propViewMode,
  onViewModeChange,
  showViewToggle = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const renderer = useMemo(() => new DrumStaffRenderer(), []);

  const [containerWidth, setContainerWidth] = useState<number>(750);
  const [layout, setLayout] = useState<DrumScoreLayout | null>(null);

  // View Mode: 'reading' (1 line) vs 'drum_staff' (5 lines)
  const [internalViewMode, setInternalViewMode] = useState<NotationViewMode>(
    propViewMode ?? 'drum_staff'
  );
  const activeViewMode = propViewMode ?? internalViewMode;

  const handleToggleViewMode = (mode: NotationViewMode) => {
    setInternalViewMode(mode);
    onViewModeChange?.(mode);
  };

  const dawsonEngine = useMemo(() => {
    return externalDawsonEngine ?? scheduler?.getDawsonEngine?.() ?? new DawsonEngine();
  }, [externalDawsonEngine, scheduler]);

  // Generate initial drum measures from DawsonEngine or initialMeasures
  const defaultMeasures = useMemo<DrumScoreMeasure[]>(() => {
    if (initialMeasures && initialMeasures.length > 0) {
      return initialMeasures;
    }
    if (readingLine && readingLine.measures.length > 0) {
      return readingLine.measures.map((m) => ({
        measureIndex: m.index,
        timeSignature: m.timeSignature,
        events: dawsonEngine.resolveMeasure(m, m.index),
      }));
    }
    // Fallback single empty measure
    return [
      {
        measureIndex: 0,
        timeSignature: [4, 4],
        events: [],
      },
    ];
  }, [initialMeasures, readingLine, dawsonEngine]);

  const [measures, setMeasures] = useState<DrumScoreMeasure[]>(defaultMeasures);

  // When readingLine or dawsonEngine changes, update measures if not user-customized
  useEffect(() => {
    if (readingLine && readingLine.measures.length > 0) {
      const resolved = readingLine.measures.map((m) => ({
        measureIndex: m.index,
        timeSignature: m.timeSignature,
        events: dawsonEngine.resolveMeasure(m, m.index),
      }));
      setMeasures(resolved);
      onMeasureChange?.(resolved);
    }
  }, [readingLine, dawsonEngine, onMeasureChange]);

  // Synchronize reactively when DawsonEngine configuration changes (mode, system, ostinato, formulas)
  useEffect(() => {
    if (!dawsonEngine?.onChange) return;

    const unsubscribe = dawsonEngine.onChange(() => {
      if (readingLine && readingLine.measures.length > 0) {
        const resolved = readingLine.measures.map((m) => ({
          measureIndex: m.index,
          timeSignature: m.timeSignature,
          events: dawsonEngine.resolveMeasure(m, m.index),
        }));
        setMeasures(resolved);
        onMeasureChange?.(resolved);
      }
    });

    return unsubscribe;
  }, [dawsonEngine, readingLine, onMeasureChange]);

  // Active playback state
  const [activeMeasure, setActiveMeasure] = useState<number>(externalMeasureIndex ?? 0);
  const [activeBeat, setActiveBeat] = useState<number>(externalBeatIndex ?? 0);
  const [internalPlaying, setInternalPlaying] = useState<boolean>(
    () => scheduler?.isPlaying() ?? isPlaying
  );
  const [playheadPos, setPlayheadPos] = useState<PlayheadPosition | null>(null);

  const effectiveIsPlaying = isPlaying || internalPlaying;

  // Selected Voice and Selected Measure for Interactive Editing
  const [selectedVoice, setSelectedVoice] = useState<DrumVoice>('snare');
  const [editingMeasureIndex, setEditingMeasureIndex] = useState<number>(0);

  // Measures per system
  const [systemCols, setSystemCols] = useState<number | undefined>(propMeasuresPerSystem);

  // Timing ref for playhead RAF
  const beatTimeRef = useRef<{ timestamp: number; beat: number; bpm: number }>({
    timestamp: performance.now(),
    beat: 0,
    bpm: 120,
  });

  // Audition a voice
  const auditionVoice = useCallback(
    (voice: DrumVoice) => {
      try {
        const player = scheduler?.getDrumKitPlayer?.();
        if (player) {
          player.triggerVoice(voice, 0, 0.85);
        }
      } catch {
        // Safe audio playback
      }
    },
    [scheduler]
  );

  // Keep external props in sync
  useEffect(() => {
    if (externalMeasureIndex !== undefined) {
      setActiveMeasure(externalMeasureIndex);
      setEditingMeasureIndex(externalMeasureIndex);
    }
  }, [externalMeasureIndex]);

  useEffect(() => {
    if (externalBeatIndex !== undefined) {
      setActiveBeat(externalBeatIndex);
    }
  }, [externalBeatIndex]);

  useEffect(() => {
    if (propMeasuresPerSystem) {
      setSystemCols(propMeasuresPerSystem);
    }
  }, [propMeasuresPerSystem]);

  // Responsive width measuring
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const measured = containerRef.current.clientWidth;
        if (measured > 100) {
          setContainerWidth(measured);
        }
      }
    };

    updateWidth();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateWidth();
      });
      resizeObserver.observe(containerRef.current);
    } else {
      window.addEventListener('resize', updateWidth);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', updateWidth);
      }
    };
  }, []);

  // Render 5-line drum score
  useEffect(() => {
    if (activeViewMode !== 'drum_staff') return;
    if (!containerRef.current) return;

    try {
      const newLayout = renderer.render(containerRef.current, measures, {
        width: Math.max(300, containerWidth),
        measuresPerSystem: systemCols,
        staveHeight: 110,
        staveSpacing: 140,
        showMeasureNumbers: true,
      });
      setLayout(newLayout);
    } catch (err) {
      console.error('Error rendering drum staff score:', err);
    }
  }, [renderer, measures, containerWidth, systemCols, activeViewMode]);

  // Scheduler subscriptions
  useEffect(() => {
    if (!scheduler) return;

    if (typeof scheduler.isPlaying === 'function') {
      setInternalPlaying(scheduler.isPlaying());
    }

    const unsubscribeBeat = scheduler.onBeat((event: BeatEvent) => {
      setActiveMeasure(event.measureIndex);
      setActiveBeat(event.beatIndex);
      beatTimeRef.current = {
        timestamp: performance.now(),
        beat: event.beatIndex,
        bpm: event.bpm || 120,
      };
    });

    const unsubscribePlay = scheduler.onPlayStateChange?.((playing: boolean) => {
      setInternalPlaying(playing);
    });

    return () => {
      unsubscribeBeat();
      unsubscribePlay?.();
    };
  }, [scheduler]);

  // Smooth RAF Playhead Animation
  useEffect(() => {
    if (activeViewMode !== 'drum_staff' || !layout) {
      setPlayheadPos(null);
      return;
    }

    const initialPos = layout.getPlayheadPosition(activeMeasure, activeBeat);
    setPlayheadPos(initialPos);

    if (!effectiveIsPlaying) {
      return;
    }

    let animationFrameId: number;

    const animate = () => {
      const now = performance.now();
      const { timestamp, beat, bpm } = beatTimeRef.current;
      const beatDurationMs = (60 / bpm) * 1000;
      const elapsed = Math.max(0, now - timestamp);
      const subBeat = Math.min(0.96, elapsed / beatDurationMs);
      const smoothBeat = beat + subBeat;

      const pos = layout.getPlayheadPosition(activeMeasure, smoothBeat);
      setPlayheadPos(pos);

      if (pos && scrollWrapperRef.current) {
        const wrapper = scrollWrapperRef.current;
        const currentScroll = wrapper.scrollTop;
        const targetScroll = Math.max(0, pos.y - 40);
        if (Math.abs(currentScroll - targetScroll) > 120) {
          wrapper.scrollTo({ top: targetScroll, behavior: 'smooth' });
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [effectiveIsPlaying, layout, activeMeasure, activeBeat, activeViewMode]);

  // Interactive step toggle for active voice and active measure
  const handleToggleStep = useCallback(
    (step: number, voice: DrumVoice = selectedVoice) => {
      const targetTime = step * 0.25;

      setMeasures((prevMeasures) => {
        const newMeasures = prevMeasures.map((m, idx) => {
          if (idx !== editingMeasureIndex) return m;

          // Check if this hit already exists at targetTime
          const existingIdx = m.events.findIndex(
            (e) =>
              e.voice === voice && Math.abs(e.timeInMeasure - targetTime) < 0.125
          );

          let updatedEvents: ScheduledDrumEvent[];
          if (existingIdx >= 0) {
            // Remove hit
            updatedEvents = m.events.filter((_, i) => i !== existingIdx);
          } else {
            // Add hit
            const pas = DRUM_VOICE_PAS_MAP[voice];
            const source = pas.stemVoice === 1 ? 'orchestration' : 'ostinato';
            updatedEvents = [
              ...m.events,
              {
                timeInMeasure: targetTime,
                voice,
                velocity: 0.85,
                dynamic: 'normal' as const,
                source: source as any,
                measureIndex: idx,
              },
            ].sort((a, b) => a.timeInMeasure - b.timeInMeasure);

            // Audition sound on add
            auditionVoice(voice);
          }

          return {
            ...m,
            events: updatedEvents,
          };
        });

        onMeasureChange?.(newMeasures);
        return newMeasures;
      });
    },
    [editingMeasureIndex, selectedVoice, auditionVoice, onMeasureChange]
  );

  // Click on SVG Staff Canvas
  const handleStaffClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!layout || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Find clicked measure coordinate
      const clickedMeasureIdx = layout.drumMeasures.findIndex((mCoord) => {
        return (
          clickX >= mCoord.x &&
          clickX <= mCoord.x + mCoord.width &&
          clickY >= mCoord.y &&
          clickY <= mCoord.y + mCoord.height
        );
      });

      if (clickedMeasureIdx < 0) return;

      setEditingMeasureIndex(clickedMeasureIdx);

      // Determine drum voice from Y offset
      const detectedVoice = layout.getDrumVoiceForY(clickedMeasureIdx, clickY);
      // Determine 16th-note step from X offset
      const detectedStep = layout.getStepForX(clickedMeasureIdx, clickX, 16);

      if (detectedVoice && detectedStep !== null) {
        setSelectedVoice(detectedVoice);
        handleToggleStep(detectedStep, detectedVoice);
      }
    },
    [layout, handleToggleStep]
  );

  // Load preset groove into editing measure
  const handleLoadPresetGroove = useCallback(
    (grooveName: 'basic_rock' | 'jazz_swing' | 'four_on_floor' | 'funk_16ths') => {
      const presetEvents: ScheduledDrumEvent[] = [];

      switch (grooveName) {
        case 'basic_rock':
          // Ride on eighth notes
          [0, 2, 4, 6, 8, 10, 12, 14].forEach((s) => {
            presetEvents.push({
              timeInMeasure: s * 0.25,
              voice: 'ride',
              velocity: 0.8,
              dynamic: 'normal',
              source: 'ostinato',
            });
          });
          // Kick on 1 and 3
          [0, 8].forEach((s) => {
            presetEvents.push({
              timeInMeasure: s * 0.25,
              voice: 'kick',
              velocity: 0.9,
              dynamic: 'normal',
              source: 'orchestration',
            });
          });
          // Snare on 2 and 4
          [4, 12].forEach((s) => {
            presetEvents.push({
              timeInMeasure: s * 0.25,
              voice: 'snare',
              velocity: 0.9,
              dynamic: 'accent',
              source: 'orchestration',
            });
          });
          break;

        case 'jazz_swing':
          // Ride swing pattern
          [0, 4, 7, 8, 12, 15].forEach((s) => {
            presetEvents.push({
              timeInMeasure: s * 0.25,
              voice: 'ride',
              velocity: 0.85,
              dynamic: 'normal',
              source: 'ostinato',
            });
          });
          // Hi-hat foot on 2 and 4
          [4, 12].forEach((s) => {
            presetEvents.push({
              timeInMeasure: s * 0.25,
              voice: 'hihat_foot',
              velocity: 0.85,
              dynamic: 'accent',
              source: 'ostinato',
            });
          });
          // Snare comping on beat 3
          presetEvents.push({
            timeInMeasure: 2.0,
            voice: 'snare',
            velocity: 0.8,
            dynamic: 'normal',
            source: 'orchestration',
          });
          // Kick anchor on 1
          presetEvents.push({
            timeInMeasure: 0.0,
            voice: 'kick',
            velocity: 0.85,
            dynamic: 'normal',
            source: 'orchestration',
          });
          break;

        case 'four_on_floor':
          // Kick on all 4 quarter beats
          [0, 4, 8, 12].forEach((s) => {
            presetEvents.push({
              timeInMeasure: s * 0.25,
              voice: 'kick',
              velocity: 0.95,
              dynamic: 'accent',
              source: 'orchestration',
            });
          });
          // Snare on 2 and 4
          [4, 12].forEach((s) => {
            presetEvents.push({
              timeInMeasure: s * 0.25,
              voice: 'snare',
              velocity: 0.9,
              dynamic: 'normal',
              source: 'orchestration',
            });
          });
          // Upbeat hi-hat on offbeats
          [2, 6, 10, 14].forEach((s) => {
            presetEvents.push({
              timeInMeasure: s * 0.25,
              voice: 'hihat_closed',
              velocity: 0.8,
              dynamic: 'accent',
              source: 'ostinato',
            });
          });
          break;

        case 'funk_16ths':
          // Hi-hat on all 16 sixteenths
          for (let s = 0; s < 16; s++) {
            presetEvents.push({
              timeInMeasure: s * 0.25,
              voice: 'hihat_closed',
              velocity: s % 4 === 0 ? 0.85 : 0.65,
              dynamic: s % 4 === 0 ? 'accent' : 'normal',
              source: 'ostinato',
            });
          }
          // Syncopated kick: 0, 6, 10
          [0, 6, 10].forEach((s) => {
            presetEvents.push({
              timeInMeasure: s * 0.25,
              voice: 'kick',
              velocity: 0.9,
              dynamic: 'normal',
              source: 'orchestration',
            });
          });
          // Snare accents on 4, 12 and ghost on 7, 15
          [4, 12].forEach((s) => {
            presetEvents.push({
              timeInMeasure: s * 0.25,
              voice: 'snare',
              velocity: 0.95,
              dynamic: 'accent',
              source: 'orchestration',
            });
          });
          [7, 15].forEach((s) => {
            presetEvents.push({
              timeInMeasure: s * 0.25,
              voice: 'snare_ghost',
              velocity: 0.45,
              dynamic: 'ghost',
              source: 'orchestration',
            });
          });
          break;
      }

      setMeasures((prev) => {
        const updated = prev.map((m, idx) => {
          if (idx !== editingMeasureIndex) return m;
          return {
            ...m,
            events: presetEvents,
          };
        });
        onMeasureChange?.(updated);
        return updated;
      });
    },
    [editingMeasureIndex, onMeasureChange]
  );

  // Clear current measure
  const handleClearMeasure = useCallback(() => {
    setMeasures((prev) => {
      const updated = prev.map((m, idx) => {
        if (idx !== editingMeasureIndex) return m;
        return {
          ...m,
          events: [],
        };
      });
      onMeasureChange?.(updated);
      return updated;
    });
  }, [editingMeasureIndex, onMeasureChange]);

  // Reset/sync measure from Dawson orchestration
  const handleSyncFromDawson = useCallback(() => {
    if (readingLine && readingLine.measures.length > 0) {
      const resolved = readingLine.measures.map((m) => ({
        measureIndex: m.index,
        timeSignature: m.timeSignature,
        events: dawsonEngine.resolveMeasure(m, m.index),
      }));
      setMeasures(resolved);
      onMeasureChange?.(resolved);
    }
  }, [readingLine, dawsonEngine, onMeasureChange]);

  // Active measure events for 16-step grid display
  const currentMeasure = measures[editingMeasureIndex] || measures[0];
  const activeVoiceStepMap = useMemo(() => {
    const map = new Array(16).fill(false);
    if (!currentMeasure) return map;

    for (const evt of currentMeasure.events) {
      if (evt.voice === selectedVoice) {
        const step = Math.min(15, Math.max(0, Math.round(evt.timeInMeasure * 4)));
        map[step] = true;
      }
    }
    return map;
  }, [currentMeasure, selectedVoice]);

  const activeMeasureCoord: MeasureCoordinate | undefined = useMemo(() => {
    if (!layout) return undefined;
    return layout.getMeasureCoordinate(activeMeasure);
  }, [layout, activeMeasure]);

  // If in Reading View, render the 1-line ReadingView
  if (activeViewMode === 'reading' && readingLine) {
    return (
      <div className="w-full flex flex-col gap-3">
        {showViewToggle && (
          <div className="flex items-center justify-between bg-card/60 backdrop-blur border border-border/70 rounded-xl p-2.5 shadow-xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Score Notation Mode:</span>
            </div>
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
              <Button
                variant="default"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5 font-medium transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => handleToggleViewMode('reading')}
              >
                <Music className="w-3.5 h-3.5" />
                Reading View (1 line)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5 font-medium transition-all"
                onClick={() => handleToggleViewMode('drum_staff')}
              >
                <FileMusic className="w-3.5 h-3.5" />
                Drum Staff (5 lines)
              </Button>
            </div>
          </div>
        )}

        <ReadingView
          readingLine={readingLine}
          scheduler={scheduler}
          isPlaying={isPlaying}
          currentMeasureIndex={externalMeasureIndex}
          currentBeatIndex={externalBeatIndex}
          measuresPerSystem={propMeasuresPerSystem}
          className={className}
        />
      </div>
    );
  }

  const totalMeasures = measures.length;
  const normalizedMeasure = ((activeMeasure % totalMeasures) + totalMeasures) % totalMeasures;

  return (
    <section
      data-testid="drum-staff-view-root"
      className={cn(
        'w-full flex flex-col bg-card/60 backdrop-blur border border-border/70 rounded-2xl p-4 md:p-6 shadow-md transition-colors gap-4',
        className
      )}
    >
      {/* Top Header: Title, View Mode Switcher, Bar & Beat Display */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 text-xs font-semibold px-2 py-0.5">
            PAS Standard
          </Badge>
          <div>
            <h2 className="text-sm md:text-base font-semibold tracking-tight text-foreground truncate max-w-xs md:max-w-md">
              {readingLine?.title ? `${readingLine.title} — 5-Line Drum Staff` : '5-Line Drum Staff & Percussion Editor'}
            </h2>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              Hands stem up (cymbals/snare/toms), feet stem down (kick/hi-hat foot)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle Switch */}
          {showViewToggle && (
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
              <Button
                variant={activeViewMode === 'reading' ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-7 px-2.5 text-xs gap-1.5 font-medium transition-all',
                  activeViewMode === 'reading' && 'bg-primary hover:bg-primary/90 text-primary-foreground'
                )}
                onClick={() => handleToggleViewMode('reading')}
              >
                <Music className="w-3.5 h-3.5" />
                Reading View
              </Button>
              <Button
                variant={activeViewMode === 'drum_staff' ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-7 px-2.5 text-xs gap-1.5 font-medium transition-all',
                  activeViewMode === 'drum_staff' && 'bg-primary hover:bg-primary/90 text-primary-foreground'
                )}
                onClick={() => handleToggleViewMode('drum_staff')}
              >
                <FileMusic className="w-3.5 h-3.5" />
                Drum Staff
              </Button>
            </div>
          )}

          {/* Bar & Beat Indicator */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-muted-foreground">Bar:</span>
            <span className="font-bold text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded">
              {normalizedMeasure + 1} / {totalMeasures}
            </span>
            <span className="text-muted-foreground ml-1">Beat:</span>
            <span className="font-bold text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded">
              {activeBeat + 1}
            </span>
          </div>

          {/* Stave columns / measures per line selector */}
          <div className="hidden md:flex items-center gap-1 border border-border/60 rounded-lg p-0.5 bg-muted/30">
            <Button
              variant={systemCols === 1 ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => setSystemCols(1)}
              title="1 measure per line"
            >
              1
            </Button>
            <Button
              variant={systemCols === 2 ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => setSystemCols(2)}
              title="2 measures per line"
            >
              2
            </Button>
            <Button
              variant={systemCols === 4 ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => setSystemCols(4)}
              title="4 measures per line"
            >
              4
            </Button>
          </div>
        </div>
      </div>

      {/* Interactive 5-Line Percussion Score Canvas with Playhead */}
      <div
        ref={scrollWrapperRef}
        className="relative w-full overflow-x-auto overflow-y-auto max-h-[460px] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent py-2 bg-card/30 rounded-xl border border-border/40"
      >
        <div className="relative min-w-full inline-block">
          {/* VexFlow 5-line SVG rendered here */}
          <div
            ref={containerRef}
            data-testid="drum-score-container"
            onClick={handleStaffClick}
            className="w-full select-none cursor-pointer"
            title="Click staff to add/remove note at position"
          />

          {/* Real-time Playhead Overlay */}
          <PlayheadOverlay
            position={playheadPos}
            activeMeasure={activeMeasureCoord}
            isVisible={effectiveIsPlaying || playheadPos !== null}
            showMeasureHighlight={true}
          />
        </div>
      </div>

      {/* Interactive Editor Toolbar: Voice Palette, 16-Step Grid & Preset Grooves */}
      <div className="flex flex-col gap-3 bg-muted/20 border border-border/60 rounded-xl p-3 md:p-4">
        {/* Voice Palette Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Active Voice:
            </span>
            <span className="text-xs font-mono font-bold text-primary">
              {DRUM_VOICE_PAS_MAP[selectedVoice]?.label}
            </span>
          </div>

          {/* Voice Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {PRIMARY_VOICES.map(({ voice, label, badge }) => (
              <Button
                key={voice}
                type="button"
                data-testid={`voice-btn-${voice}`}
                variant={selectedVoice === voice ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectedVoice(voice);
                  auditionVoice(voice);
                }}
                className={cn(
                  'h-7 px-2 text-xs gap-1 border-border/70 transition-all',
                  selectedVoice === voice && 'bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs ring-1 ring-primary'
                )}
              >
                <span>{label}</span>
                <span className="text-[10px] opacity-75 font-mono">({badge})</span>
              </Button>
            ))}
          </div>
        </div>

        {/* 16-Step Grid for Selected Voice */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-border/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              16th Note Grid (Measure {editingMeasureIndex + 1}):
            </span>
            <div className="flex items-center gap-1">
              {measures.length > 1 && (
                <div className="flex items-center gap-1 mr-2 text-xs text-muted-foreground">
                  <span>Bar:</span>
                  {measures.map((_, idx) => (
                    <Button
                      key={idx}
                      variant={editingMeasureIndex === idx ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-5 px-1.5 text-[10px]"
                      onClick={() => setEditingMeasureIndex(idx)}
                    >
                      {idx + 1}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-16 gap-1 md:gap-1.5">
            {Array.from({ length: 16 }).map((_, step) => {
              const isActive = activeVoiceStepMap[step];
              const isBeatDownbeat = step % 4 === 0;
              const beatNumber = Math.floor(step / 4) + 1;

              return (
                <button
                  key={step}
                  type="button"
                  data-testid={`grid-step-${step}`}
                  onClick={() => handleToggleStep(step)}
                  className={cn(
                    'h-9 rounded-md border flex flex-col items-center justify-center transition-all duration-75 select-none text-[10px] font-mono',
                    isActive
                      ? 'bg-primary border-primary text-primary-foreground font-bold shadow-xs scale-[1.02]'
                      : isBeatDownbeat
                      ? 'bg-card border-border/80 hover:bg-primary/10 hover:border-primary/40 text-foreground'
                      : 'bg-muted/40 border-border/40 hover:bg-primary/10 hover:border-primary/30 text-muted-foreground'
                  )}
                  title={`Beat ${beatNumber}.${(step % 4) + 1}`}
                >
                  <span>{step + 1}</span>
                  {isBeatDownbeat && (
                    <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Groove Presets & Actions Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/40">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground mr-1">Presets:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleLoadPresetGroove('basic_rock')}
              className="h-6 px-2 text-[11px] border-border/60 hover:bg-muted"
            >
              Basic Rock
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleLoadPresetGroove('jazz_swing')}
              className="h-6 px-2 text-[11px] border-border/60 hover:bg-muted"
            >
              Jazz Swing
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleLoadPresetGroove('four_on_floor')}
              className="h-6 px-2 text-[11px] border-border/60 hover:bg-muted"
            >
              Four on Floor
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleLoadPresetGroove('funk_16ths')}
              className="h-6 px-2 text-[11px] border-border/60 hover:bg-muted"
            >
              Funk 16ths
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSyncFromDawson}
              className="h-6 px-2 text-[11px] border-primary/40 text-primary hover:bg-primary/10 gap-1"
              title="Reset score to Dawson Engine orchestration"
            >
              <RotateCcw className="w-3 h-3" />
              Sync Dawson
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearMeasure}
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-rose-400 hover:bg-rose-950/20 gap-1"
              title="Clear all drum notes in active measure"
            >
              <Trash2 className="w-3 h-3" />
              Clear Bar
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
