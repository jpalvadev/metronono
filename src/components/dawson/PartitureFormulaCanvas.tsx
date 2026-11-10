import React, { useEffect, useRef, useLayoutEffect, useCallback, useState } from 'react';
import {
  DrumVoice,
  Dynamic,
  OrchestratedStroke,
} from '../../domain/dawson/types';
import {
  DrumStaffFormulaRenderer,
  DrumStaffFormulaLayout,
} from '../../notation/DrumStaffFormulaRenderer';
import { DRUM_VOICE_PAS_MAP } from '../../notation/DrumStaffRenderer';
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
  playheadBeat?: number | null;
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

interface DragGuideState {
  x: number;
  y: number;
  voice: DrumVoice | null;
  isOffStave: boolean;
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
  playheadBeat = null,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DrumStaffFormulaRenderer>(new DrumStaffFormulaRenderer());
  const layoutRef = useRef<DrumStaffFormulaLayout | null>(null);

  // Dragging state
  const [dragGuide, setDragGuide] = useState<DragGuideState | null>(null);
  const dragStateRef = useRef<{
    isDragging: boolean;
    strokeIndex: number;
    initialVoice: DrumVoice | null;
    currentVoice: DrumVoice | null;
    lastSoundedVoice: DrumVoice | null;
    isOffStave: boolean;
    initialBeat: number;
    currentBeat: number;
    hasMoved: boolean;
  }>({
    isDragging: false,
    strokeIndex: -1,
    initialVoice: null,
    currentVoice: null,
    lastSoundedVoice: null,
    isOffStave: false,
    initialBeat: 0,
    currentBeat: 0,
    hasMoved: false,
  });

  const getEventCoords = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.DragEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
      const native = (e.nativeEvent as unknown as Record<string, unknown>) || {};
      const clientX =
        typeof e.clientX === 'number' && !isNaN(e.clientX)
          ? e.clientX
          : typeof native.clientX === 'number'
          ? native.clientX
          : 80;
      const clientY =
        typeof e.clientY === 'number' && !isNaN(e.clientY)
          ? e.clientY
          : typeof native.clientY === 'number'
          ? native.clientY
          : 80;
      return {
        x: clientX - (rect.left || 0),
        y: clientY - (rect.top || 0),
      };
    },
    []
  );

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

  // Click-to-stamp handler (only if not dragging)
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !containerRef.current || !layoutRef.current) return;
    if (dragStateRef.current.hasMoved) {
      dragStateRef.current.hasMoved = false;
      return;
    }

    const { x, y } = getEventCoords(e);
    const layout = layoutRef.current;
    const drumVoice = layout.getDrumVoiceForY(y) || 'snare';
    const beatOffset = layout.getBeatOffsetForX(x, targetBeats);

    const resolved = resolveStrokeOffsets(strokes, 0);

    let strokeIndex = -1;
    for (let i = 0; i < resolved.length; i++) {
      const { stroke, offset } = resolved[i];
      if (beatOffset >= offset - 0.05 && beatOffset < offset + stroke.durationRatio) {
        strokeIndex = i;
        break;
      }
    }

    if (strokeIndex === -1 && resolved.length > 0) {
      let closestDist = Infinity;
      resolved.forEach(({ offset }, idx) => {
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
            const next = strokes.map((s, i) =>
              i === strokeIndex ? { ...s, hits: remaining } : s
            );
            onChangeStrokes(next);
          } else {
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
          hits[existingIdx] = { voice: drumVoice, dynamic: selectedDynamic };
        } else {
          hits.push({ voice: drumVoice, dynamic: selectedDynamic });
        }
      }

      const next = strokes.map((s, i) =>
        i === strokeIndex ? { ...s, isRest: false, hits } : s
      );
      onChangeStrokes(next);
    } else {
      onChangeStrokes([
        ...strokes,
        {
          durationRatio: selectedDuration,
          hits: [{ voice: drumVoice, dynamic: selectedDynamic }],
        },
      ]);
    }
  };

  // HTML5 Drag-and-Drop (e.g. from palette)
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (readOnly || !containerRef.current || !layoutRef.current) return;

    const { x, y } = getEventCoords(e);
    const layout = layoutRef.current;
    const voice = layout.getDrumVoiceForY(y);

    setDragGuide({
      x,
      y,
      voice,
      isOffStave: y < 0 || y > height,
    });
  };

  const handleDragLeave = () => {
    setDragGuide(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragGuide(null);
    if (readOnly || !containerRef.current || !layoutRef.current) return;

    let payload: { type?: string; durationRatio?: number; dynamic?: Dynamic } | null = null;
    try {
      const raw =
        e.dataTransfer?.getData('application/json') ||
        e.dataTransfer?.getData('text/plain');
      if (raw) payload = JSON.parse(raw);
    } catch {
      payload = null;
    }

    const durationRatio = payload?.durationRatio || selectedDuration;
    const dynamic = payload?.dynamic || selectedDynamic;

    const { x, y } = getEventCoords(e);
    const layout = layoutRef.current;
    const drumVoice = layout.getDrumVoiceForY(y) || 'snare';
    const beatOffset = layout.getBeatOffsetForX(x, targetBeats);

    // Audio feedback on drop
    if (player && drumVoice) {
      player.triggerVoice(drumVoice, 0, dynamicToVelocity(dynamic), 'orchestration');
    }

    const resolved = resolveStrokeOffsets(strokes, 0);
    let strokeIndex = -1;
    for (let i = 0; i < resolved.length; i++) {
      const { stroke, offset } = resolved[i];
      if (beatOffset >= offset - 0.05 && beatOffset < offset + stroke.durationRatio) {
        strokeIndex = i;
        break;
      }
    }

    if (strokeIndex !== -1) {
      const stroke = strokes[strokeIndex];
      let hits = stroke.hits ? [...stroke.hits] : [];
      if (stroke.isRest || hits.length === 0) {
        hits = [{ voice: drumVoice, dynamic }];
      } else {
        const existingIdx = hits.findIndex((h) => h.voice === drumVoice);
        if (existingIdx >= 0) {
          hits[existingIdx] = { voice: drumVoice, dynamic };
        } else {
          hits.push({ voice: drumVoice, dynamic });
        }
      }
      onChangeStrokes(
        strokes.map((s, i) => (i === strokeIndex ? { ...s, isRest: false, hits } : s))
      );
    } else {
      onChangeStrokes([
        ...strokes,
        {
          durationRatio,
          hits: [{ voice: drumVoice, dynamic }],
        },
      ]);
    }
  };

  // Pointer drag gestures for existing notes (transposition & horizontal shifts)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || !containerRef.current || !layoutRef.current) return;

    const { x, y } = getEventCoords(e);
    const layout = layoutRef.current;
    const beatOffset = layout.getBeatOffsetForX(x, targetBeats);
    const resolved = resolveStrokeOffsets(strokes, 0);

    let foundIndex = -1;
    for (let i = 0; i < resolved.length; i++) {
      const { stroke, offset } = resolved[i];
      if (beatOffset >= offset - 0.15 && beatOffset < offset + stroke.durationRatio + 0.15) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex !== -1 && !strokes[foundIndex].isRest) {
      const stroke = strokes[foundIndex];
      const initialVoice = stroke.hits && stroke.hits.length > 0 ? stroke.hits[0].voice : null;

      dragStateRef.current = {
        isDragging: true,
        strokeIndex: foundIndex,
        initialVoice,
        currentVoice: initialVoice,
        lastSoundedVoice: initialVoice,
        isOffStave: false,
        initialBeat: resolved[foundIndex].offset,
        currentBeat: resolved[foundIndex].offset,
        hasMoved: false,
      };

      setDragGuide({
        x,
        y,
        voice: initialVoice,
        isOffStave: false,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.isDragging || !containerRef.current || !layoutRef.current) return;

    dragStateRef.current.hasMoved = true;
    const { x, y } = getEventCoords(e);
    const layout = layoutRef.current;

    const isOffStave = y < -20 || y > height + 20;
    const currentVoice = layout.getDrumVoiceForY(y);
    const beatOffset = layout.getBeatOffsetForX(x, targetBeats);
    const snappedBeat = Math.round(beatOffset / selectedDuration) * selectedDuration;

    // Trigger one-shot audio on line crossing
    if (
      !isOffStave &&
      currentVoice &&
      currentVoice !== dragStateRef.current.lastSoundedVoice
    ) {
      if (player) {
        player.triggerVoice(currentVoice, 0, dynamicToVelocity(selectedDynamic), 'orchestration');
      }
      dragStateRef.current.lastSoundedVoice = currentVoice;
    }

    dragStateRef.current.currentVoice = currentVoice;
    dragStateRef.current.isOffStave = isOffStave;
    dragStateRef.current.currentBeat = snappedBeat;

    setDragGuide({
      x,
      y,
      voice: currentVoice,
      isOffStave,
    });
  };

  const handlePointerUp = () => {
    if (!dragStateRef.current.isDragging) return;

    const {
      strokeIndex,
      currentVoice,
      isOffStave,
      hasMoved,
      initialBeat,
      currentBeat,
    } = dragStateRef.current;

    dragStateRef.current.isDragging = false;
    setDragGuide(null);

    if (!hasMoved || strokeIndex === -1 || strokeIndex >= strokes.length) return;

    if (isOffStave) {
      // Drag-off removal: convert to rest or remove
      const stroke = strokes[strokeIndex];
      if (stroke.hits && stroke.hits.length > 1) {
        const remaining = stroke.hits.slice(1);
        onChangeStrokes(
          strokes.map((s, i) => (i === strokeIndex ? { ...s, hits: remaining } : s))
        );
      } else {
        onChangeStrokes(
          strokes.map((s, i) => (i === strokeIndex ? { ...s, isRest: true, hits: [] } : s))
        );
      }
      return;
    }

    // Update note with transposition or metric shift
    const stroke = strokes[strokeIndex];
    let hits = stroke.hits ? [...stroke.hits] : [];

    if (currentVoice && hits.length > 0) {
      hits = [{ ...hits[0], voice: currentVoice }, ...hits.slice(1)];
    }

    let updated = strokes.map((s, i) =>
      i === strokeIndex ? { ...s, hits } : s
    );

    // If horizontal shift occurred, reorder strokes
    if (Math.abs(currentBeat - initialBeat) >= 0.05) {
      const movedStroke = { ...updated[strokeIndex] };
      const otherStrokes = updated.filter((_, i) => i !== strokeIndex);
      if (currentBeat > initialBeat) {
        updated = [...otherStrokes, movedStroke];
      } else {
        updated = [movedStroke, ...otherStrokes];
      }
    }

    onChangeStrokes(updated);
  };

  return (
    <div
      data-testid="partiture-formula-canvas"
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative w-full overflow-hidden select-none cursor-pointer rounded-xl bg-slate-950/70 border border-border/80 flex items-center justify-center ${
        className || ''
      }`}
      style={{ minHeight: height }}
    >
      <div ref={containerRef} className="w-full flex justify-center" />

      {/* Animated Audition Playhead */}
      {playheadBeat !== null && playheadBeat !== undefined && layoutRef.current && (
        <div
          data-testid="audition-playhead"
          className="absolute top-0 bottom-0 w-[2px] bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.9)] pointer-events-none transition-all duration-75"
          style={{
            left: `${layoutRef.current.getXForBeatOffset(playheadBeat, targetBeats)}px`,
          }}
        />
      )}

      {/* Visual Snap & Target Guide Overlay */}
      {dragGuide && (
        <div
          data-testid="drag-target-guide"
          className="absolute inset-0 pointer-events-none"
        >
          {/* Vertical Snap Guide Line */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-teal-400/60 shadow-[0_0_8px_rgba(45,212,191,0.6)]"
            style={{ left: `${dragGuide.x}px` }}
          />

          {/* Target Voice Guide / Badge */}
          {dragGuide.voice && (
            <div
              className={`absolute px-2 py-0.5 rounded text-[10px] font-mono font-bold shadow-md transition-all ${
                dragGuide.isOffStave
                  ? 'bg-rose-500/90 text-white'
                  : 'bg-teal-500/90 text-slate-950'
              }`}
              style={{
                left: `${dragGuide.x + 8}px`,
                top: `${Math.max(4, Math.min(height - 24, dragGuide.y - 12))}px`,
              }}
            >
              {dragGuide.isOffStave ? 'Remove' : dragGuide.voice}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
