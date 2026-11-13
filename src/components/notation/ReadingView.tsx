import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ReadingLine, ReadingFeel } from '../../domain/rhythm/types';
import { ToneTransportScheduler } from '../../audio/ToneTransportScheduler';
import { BeatEvent } from '../../domain/metronome/MetronomeEngine';
import { ReadingScoreRenderer, getAutoMeasuresPerSystem } from '../../notation/ReadingScoreRenderer';
import { ScoreLayout, PlayheadPosition, MeasureCoordinate } from '../../notation/types';
import { PlayheadOverlay } from './PlayheadOverlay';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export interface ReadingViewProps {
  readingLine: ReadingLine;
  scheduler?: ToneTransportScheduler;
  readingFeel?: ReadingFeel;
  isPlaying?: boolean;
  currentMeasureIndex?: number;
  currentBeatIndex?: number;
  measuresPerSystem?: number;
  className?: string;
  onMeasureClick?: (measureIndex: number) => void;
}

export const ReadingView: React.FC<ReadingViewProps> = ({
  readingLine,
  scheduler,
  readingFeel: propReadingFeel,
  isPlaying = false,
  currentMeasureIndex: externalMeasureIndex,
  currentBeatIndex: externalBeatIndex,
  measuresPerSystem: propMeasuresPerSystem,
  className,
  onMeasureClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderer = useMemo(() => new ReadingScoreRenderer(), []);

  const [containerWidth, setContainerWidth] = useState<number>(750);
  const [layout, setLayout] = useState<ScoreLayout | null>(null);

  // Active playback state
  const [activeMeasure, setActiveMeasure] = useState<number>(externalMeasureIndex ?? 0);
  const [activeBeat, setActiveBeat] = useState<number>(externalBeatIndex ?? 0);
  const [internalPlaying, setInternalPlaying] = useState<boolean>(
    () => scheduler?.isPlaying() ?? isPlaying
  );
  const [playheadPos, setPlayheadPos] = useState<PlayheadPosition | null>(null);
  const [timeSignature, setTimeSignature] = useState(() =>
    scheduler?.getTimeSignature?.() ?? { beats: 4, beatUnit: 4 }
  );
  const [readingFeel, setReadingFeel] = useState<ReadingFeel>(() =>
    propReadingFeel ?? scheduler?.getReadingFeel?.() ?? 'straight'
  );

  useEffect(() => {
    if (propReadingFeel !== undefined) {
      setReadingFeel(propReadingFeel);
    }
  }, [propReadingFeel]);

  useEffect(() => {
    const unsubFeel = scheduler?.onReadingFeelChange?.((feel) => {
      setReadingFeel(feel);
    });
    return () => {
      unsubFeel?.();
    };
  }, [scheduler]);

  const isFourFour = timeSignature.beats === 4 && timeSignature.beatUnit === 4;
  const effectiveIsPlaying = isFourFour && (isPlaying || internalPlaying);

  // Measures per system (columns)
  const [systemCols, setSystemCols] = useState<number | undefined>(propMeasuresPerSystem);

  // Track beat timing for RAF interpolation
  const beatTimeRef = useRef<{ timestamp: number; beat: number; bpm: number }>({
    timestamp: performance.now(),
    beat: 0,
    bpm: 120,
  });

  // Keep external props in sync if passed
  useEffect(() => {
    if (externalMeasureIndex !== undefined) {
      setActiveMeasure(externalMeasureIndex);
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

  // Measure container width responsively
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const measured = containerRef.current.clientWidth;
        if (measured > 0) {
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

  const maxColsForWidth = getAutoMeasuresPerSystem(containerWidth);
  const effectiveMeasuresPerSystem =
    systemCols !== undefined ? Math.min(systemCols, maxColsForWidth) : undefined;

  // Render score notation whenever readingLine, containerWidth, effectiveMeasuresPerSystem, or readingFeel change
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const newLayout = renderer.render(containerRef.current, readingLine, {
        width: containerWidth,
        measuresPerSystem: effectiveMeasuresPerSystem,
        staveSpacing: 110,
        showMeasureNumbers: true,
        readingFeel,
      });
      setLayout(newLayout);
    } catch (err) {
      console.error('Error rendering reading score:', err);
    }
  }, [renderer, readingLine, containerWidth, effectiveMeasuresPerSystem, readingFeel]);

  // Subscribe to scheduler's beat events
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

    const unsubscribeTimeSig = scheduler.onTimeSignatureChange?.((ts) => {
      setTimeSignature(ts);
    });

    return () => {
      unsubscribeBeat();
      unsubscribePlay?.();
      unsubscribeTimeSig?.();
    };
  }, [scheduler]);

  // Smooth RAF Playhead Animation
  useEffect(() => {
    if (!layout || !isFourFour) {
      setPlayheadPos(null);
      return;
    }

    // Set immediate position for current measure & beat
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

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [effectiveIsPlaying, layout, isFourFour, activeMeasure, activeBeat]);

  const activeMeasureCoord: MeasureCoordinate | undefined = useMemo(() => {
    if (!layout) return undefined;
    return layout.getMeasureCoordinate(activeMeasure);
  }, [layout, activeMeasure]);

  const tierBadgeColor = useMemo(() => {
    switch (readingLine.tier) {
      case 1:
        return 'border-success/40 text-success bg-success/20';
      case 2:
        return 'border-warning/40 text-warning bg-warning/20';
      case 3:
        return 'border-destructive/40 text-destructive bg-destructive/20';
    }
  }, [readingLine.tier]);

  const totalMeasures = readingLine.measures.length;
  const normalizedMeasure = ((activeMeasure % totalMeasures) + totalMeasures) % totalMeasures;

  return (
    <section
      data-testid="reading-view-root"
      className={cn(
        'w-full flex flex-col bg-card border border-border rounded-none p-4 md:p-6 shadow-sm transition-colors',
        className
      )}
    >
      {/* Header bar: Title, Tier, Measure & Beat indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className={cn('text-xs font-semibold px-2 py-0.5 rounded-none', tierBadgeColor)}>
            Tier {readingLine.tier}
          </Badge>
          <h2 className="text-sm md:text-base font-semibold tracking-tight text-foreground truncate max-w-xs md:max-w-md">
            {readingLine.title}
          </h2>
          {!isFourFour && (
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-warning text-warning bg-warning/10 rounded-none"
            >
              4/4 only
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Active Measure & Beat Indicator */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-muted-foreground">Bar:</span>
            <span className="font-bold text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-none">
              {normalizedMeasure + 1} / {totalMeasures}
            </span>
            <span className="text-muted-foreground ml-1">Beat:</span>
            <span className="font-bold text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-none">
              {activeBeat + 1}
            </span>
          </div>

          {/* Stave columns / measures per line selector */}
          <div className="hidden sm:flex items-center gap-1 border border-border rounded-none p-0.5 bg-muted/20">
            <Button
              variant={systemCols === undefined ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[11px] rounded-none"
              aria-pressed={systemCols === undefined}
              onClick={() => setSystemCols(undefined)}
              title="Automatic measures per line"
            >
              Auto
            </Button>
            {[1, 2, 3, 4].map((cols) => (
              <Button
                key={cols}
                variant={systemCols === cols ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[11px] rounded-none"
                aria-pressed={systemCols === cols}
                onClick={() => setSystemCols(cols)}
                title={`${cols} ${cols === 1 ? 'measure' : 'measures'} per line`}
              >
                {cols}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Notation Canvas with Playhead Overlay */}
      <div
        onClick={() => onMeasureClick?.(normalizedMeasure)}
        className="relative w-full min-w-0 py-2"
      >
        <div className="relative w-full min-w-0">
          {/* VexFlow SVG rendered into this container */}
          <div
            ref={containerRef}
            data-testid="reading-score-container"
            className="w-full min-w-0 select-none"
          />

          {/* Interactive Playhead Overlay */}
          <PlayheadOverlay
            position={playheadPos}
            activeMeasure={activeMeasureCoord}
            isVisible={isFourFour && (effectiveIsPlaying || playheadPos !== null)}
            showMeasureHighlight={true}
          />
        </div>
      </div>
    </section>
  );
};
