import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ReadingLine } from '../../domain/rhythm/types';
import { ToneTransportScheduler } from '../../audio/ToneTransportScheduler';
import { BeatEvent } from '../../domain/metronome/MetronomeEngine';
import { ReadingScoreRenderer } from '../../notation/ReadingScoreRenderer';
import { ScoreLayout, PlayheadPosition, MeasureCoordinate } from '../../notation/types';
import { PlayheadOverlay } from './PlayheadOverlay';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export interface ReadingViewProps {
  readingLine: ReadingLine;
  scheduler?: ToneTransportScheduler;
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
  isPlaying = false,
  currentMeasureIndex: externalMeasureIndex,
  currentBeatIndex: externalBeatIndex,
  measuresPerSystem: propMeasuresPerSystem,
  className,
  onMeasureClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
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

  const effectiveIsPlaying = isPlaying || internalPlaying;

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

  // Render score notation whenever readingLine, containerWidth, or systemCols change
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const newLayout = renderer.render(containerRef.current, readingLine, {
        width: Math.max(300, containerWidth),
        measuresPerSystem: systemCols,
        staveSpacing: 110,
        showMeasureNumbers: true,
      });
      setLayout(newLayout);
    } catch (err) {
      console.error('Error rendering reading score:', err);
    }
  }, [renderer, readingLine, containerWidth, systemCols]);

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

    return () => {
      unsubscribeBeat();
      unsubscribePlay?.();
    };
  }, [scheduler]);

  // Smooth RAF Playhead Animation
  useEffect(() => {
    if (!layout) {
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

      // Auto-scroll to active system row
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
  }, [effectiveIsPlaying, layout, activeMeasure, activeBeat]);

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
              variant={systemCols === 1 ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[11px] rounded-none"
              onClick={() => setSystemCols(1)}
              title="1 measure per line"
            >
              1
            </Button>
            <Button
              variant={systemCols === 2 ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[11px] rounded-none"
              onClick={() => setSystemCols(2)}
              title="2 measures per line"
            >
              2
            </Button>
            <Button
              variant={systemCols === 4 ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[11px] rounded-none"
              onClick={() => setSystemCols(4)}
              title="4 measures per line"
            >
              4
            </Button>
          </div>
        </div>
      </div>

      {/* Notation Canvas with Playhead Overlay */}
      <div
        ref={scrollWrapperRef}
        onClick={() => onMeasureClick?.(normalizedMeasure)}
        className="relative w-full overflow-x-auto overflow-y-auto max-h-[460px] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent py-2"
      >
        <div className="relative min-w-full inline-block">
          {/* VexFlow SVG rendered into this container */}
          <div
            ref={containerRef}
            data-testid="reading-score-container"
            className="w-full select-none"
          />

          {/* Interactive Playhead Overlay */}
          <PlayheadOverlay
            position={playheadPos}
            activeMeasure={activeMeasureCoord}
            isVisible={effectiveIsPlaying || playheadPos !== null}
            showMeasureHighlight={true}
          />
        </div>
      </div>
    </section>
  );
};
