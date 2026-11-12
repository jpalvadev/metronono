import React, { useRef, useLayoutEffect, useCallback, useState, useEffect } from 'react';
import { OrchestratedStroke } from '../../domain/dawson/types';
import { DrumStaffFormulaRenderer } from '../../notation/DrumStaffFormulaRenderer';
import { cn } from '../../lib/utils';

export interface DrumStaffViewerProps {
  strokes?: OrchestratedStroke[];
  isSilenced?: boolean;
  targetBeats?: number;
  height?: number;
  className?: string;
  silenceLabel?: string;
}

export const DrumStaffViewer: React.FC<DrumStaffViewerProps> = ({
  strokes = [],
  isSilenced = false,
  targetBeats = 4,
  height = 140,
  className,
  silenceLabel = 'Silencio',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DrumStaffFormulaRenderer>(new DrumStaffFormulaRenderer());
  const [containerWidth, setContainerWidth] = useState<number>(300);

  const effectiveSilenced = isSilenced || strokes.length === 0;

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        const clientWidth = containerRef.current.clientWidth;
        if (clientWidth > 0) {
          setContainerWidth(clientWidth);
        }
      }
    };

    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            setContainerWidth(Math.round(entry.contentRect.width));
          }
        }
      });

      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  const renderStave = useCallback(() => {
    if (!containerRef.current) return;

    const renderStrokes: OrchestratedStroke[] = effectiveSilenced
      ? [{ durationRatio: targetBeats, isRest: true, hits: [] }]
      : strokes;

    try {
      rendererRef.current.render(containerRef.current, renderStrokes, {
        width: Math.max(200, containerWidth),
        height,
        targetBeats,
      });
    } catch {
      // Safe fallback
    }
  }, [containerWidth, effectiveSilenced, height, strokes, targetBeats]);

  useLayoutEffect(() => {
    renderStave();
  }, [renderStave]);

  return (
    <div
      className={cn(
        'relative w-full rounded-none border border-border bg-card p-2 flex flex-col items-center justify-center overflow-hidden',
        className
      )}
    >
      {effectiveSilenced && (
        <div className="absolute top-2 right-2 z-10">
          <span className="inline-flex items-center rounded-none border border-border bg-secondary/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shadow-sm">
            {silenceLabel}
          </span>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full flex justify-center items-center select-none"
        style={{ minHeight: height }}
      />
    </div>
  );
};
