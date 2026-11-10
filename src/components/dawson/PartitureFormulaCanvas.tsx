import React, { useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import {
  DrumVoice,
  Dynamic,
  OrchestratedStroke,
} from '../../domain/dawson/types';
import { DRUM_VOICE_PAS_MAP } from '../../notation/DrumStaffRenderer';
import {
  DrumStaffFormulaRenderer,
  DrumStaffFormulaLayout,
} from '../../notation/DrumStaffFormulaRenderer';
import { resolveStrokeOffsets } from '../../domain/dawson/SubdivisionFormula';
import { IDrumKitPlayer } from '../../audio/types';
import { EntryTool } from './FormulaPaletteToolbar';

export interface PartitureFormulaCanvasProps {
  strokes: OrchestratedStroke[];
  onChangeStrokes: (strokes: OrchestratedStroke[]) => void;
  activeTool: EntryTool;
  selectedDuration: number;
  selectedDynamic: Dynamic;
  targetBeats?: number;
  player?: IDrumKitPlayer;
  width?: number;
  height?: number;
  readOnly?: boolean;
  className?: string;
}

export function dynamicToVelocity(dynamic: Dynamic): number {
  switch (dynamic) {
    case 'accent':
      return 1.0;
    case 'flam':
      return 0.9;
    case 'drag':
      return 0.75;
    case 'ghost':
      return 0.4;
    case 'normal':
    default:
      return 0.8;
  }
}

export const PartitureFormulaCanvas: React.FC<PartitureFormulaCanvasProps> = ({
  strokes,
  onChangeStrokes,
  activeTool,
  selectedDuration,
  selectedDynamic,
  targetBeats = 1.0,
  player,
  width = 500,
  height = 160,
  readOnly = false,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DrumStaffFormulaRenderer>(new DrumStaffFormulaRenderer());
  const layoutRef = useRef<DrumStaffFormulaLayout | null>(null);

  // Render stave onto DOM container
  const renderStave = useCallback(() => {
    if (!containerRef.current) return;
    try {
      const layout = rendererRef.current.render(containerRef.current, strokes, {
        width,
        height,
        targetBeats,
      });
      layoutRef.current = layout;
    } catch {
      // Safe fallback
    }
  }, [strokes, width, height, targetBeats]);

  useLayoutEffect(() => {
    renderStave();
  }, [renderStave]);

  useEffect(() => {
    renderStave();
  }, [renderStave]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !containerRef.current || !layoutRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const layout = layoutRef.current;
    const drumVoice = layout.getDrumVoiceForY(y) || 'snare';
    const beatOffset = layout.getBeatOffsetForX(x, targetBeats);

    const resolved = resolveStrokeOffsets(strokes, 0);

    // Locate clicked stroke or matching slice
    let strokeIndex = -1;
    for (let i = 0; i < resolved.length; i++) {
      const { stroke, offset } = resolved[i];
      if (beatOffset >= offset - 0.05 && beatOffset < offset + stroke.durationRatio) {
        strokeIndex = i;
        break;
      }
    }

    if (strokeIndex === -1 && resolved.length > 0) {
      // Check if clicked close to any stroke offset
      let closestDist = Infinity;
      resolved.forEach(({ stroke, offset }, idx) => {
        const dist = Math.abs(beatOffset - offset);
        if (dist < 0.25 && dist < closestDist) {
          closestDist = dist;
          strokeIndex = idx;
        }
      });
    }

    if (activeTool === 'eraser') {
      if (strokeIndex !== -1) {
        const stroke = strokes[strokeIndex];
        if (stroke.hits && stroke.hits.length > 0) {
          // Find the hit in this chord closest to clicked Y
          let targetHit = stroke.hits[0];
          let minDiff = Infinity;
          for (const hit of stroke.hits) {
            const pas = DRUM_VOICE_PAS_MAP[hit.voice];
            if (pas) {
              const lineY = layout.stave.getYForLine(pas.line);
              const diff = Math.abs(lineY - y);
              if (diff < minDiff) {
                minDiff = diff;
                targetHit = hit;
              }
            }
          }

          const remaining = stroke.hits.filter((h) => h !== targetHit);
          if (remaining.length > 0) {
            // Removed target voice from chord
            const next = strokes.map((s, i) =>
              i === strokeIndex ? { ...s, hits: remaining } : s
            );
            onChangeStrokes(next);
          } else {
            // All voices removed -> convert step into an equivalent rest
            const next = strokes.map((s, i) =>
              i === strokeIndex ? { ...s, isRest: true, hits: [] } : s
            );
            onChangeStrokes(next);
          }
        }
      }
      return;
    }

    if (activeTool === 'rest') {
      if (strokeIndex !== -1) {
        const next = strokes.map((s, i) =>
          i === strokeIndex
            ? { durationRatio: selectedDuration, isRest: true, hits: [] }
            : s
        );
        onChangeStrokes(next);
      } else {
        onChangeStrokes([
          ...strokes,
          { durationRatio: selectedDuration, isRest: true, hits: [] },
        ]);
      }
      return;
    }

    // Active tool === 'note'
    // Immediate one-shot audio dispatch
    if (player && drumVoice) {
      const vel = dynamicToVelocity(selectedDynamic);
      player.triggerVoice(drumVoice, 0, vel, 'orchestration');
    }

    if (strokeIndex !== -1) {
      const stroke = strokes[strokeIndex];
      let hits = stroke.hits ? [...stroke.hits] : [];

      if (stroke.isRest || hits.length === 0) {
        hits = [{ voice: drumVoice, dynamic: selectedDynamic }];
      } else {
        const existingIdx = hits.findIndex((h) => h.voice === drumVoice);
        if (existingIdx >= 0) {
          // Update dynamic on same voice
          hits[existingIdx] = { voice: drumVoice, dynamic: selectedDynamic };
        } else {
          // Unison stacking: append new voice to the chord!
          hits.push({ voice: drumVoice, dynamic: selectedDynamic });
        }
      }

      const next = strokes.map((s, i) =>
        i === strokeIndex ? { ...s, isRest: false, hits } : s
      );
      onChangeStrokes(next);
    } else {
      // Append new note stroke
      onChangeStrokes([
        ...strokes,
        {
          durationRatio: selectedDuration,
          hits: [{ voice: drumVoice, dynamic: selectedDynamic }],
        },
      ]);
    }
  };

  return (
    <div
      data-testid="partiture-formula-canvas"
      onClick={handleClick}
      className={`relative w-full overflow-hidden select-none cursor-pointer rounded-xl bg-slate-950/70 border border-border/80 flex items-center justify-center ${
        className || ''
      }`}
      style={{ minHeight: height }}
    >
      <div ref={containerRef} className="w-full flex justify-center" />
    </div>
  );
};
