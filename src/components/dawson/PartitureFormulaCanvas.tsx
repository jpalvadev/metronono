import React, { useEffect, useRef, useLayoutEffect, useCallback, useState, useMemo } from 'react';
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
import { cn } from '../../lib/utils';

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

export interface FormulaSlot {
  slotIndex: number;
  beatOffset: number;
  durationRatio: number;
  hits: import('../../domain/dawson/types').DrumHit[];
  isRest: boolean;
}

export function strokesToSlots(
  strokes: OrchestratedStroke[],
  targetBeats: number,
  slotDuration: number
): FormulaSlot[] {
  const totalSlots = Math.max(1, Math.round(targetBeats / slotDuration));
  const slots: FormulaSlot[] = Array.from({ length: totalSlots }, (_, s) => ({
    slotIndex: s,
    beatOffset: Math.round(s * slotDuration * 1000) / 1000,
    durationRatio: slotDuration,
    hits: [],
    isRest: true,
  }));

  const resolved = resolveStrokeOffsets(strokes, 0);

  resolved.forEach(({ stroke, offset }) => {
    const slotIdx = Math.min(
      totalSlots - 1,
      Math.max(0, Math.round(offset / slotDuration))
    );

    if (!stroke.isRest && stroke.hits && stroke.hits.length > 0) {
      slots[slotIdx].hits = [...stroke.hits];
      slots[slotIdx].isRest = false;
    } else if (stroke.isRest) {
      slots[slotIdx].isRest = true;
      slots[slotIdx].hits = [];
    }
  });

  return slots;
}

export function slotsToStrokes(slots: FormulaSlot[]): OrchestratedStroke[] {
  let lastNonRestIdx = -1;
  for (let i = slots.length - 1; i >= 0; i--) {
    const slot = slots[i];
    if (slot && !slot.isRest && slot.hits.length > 0) {
      lastNonRestIdx = i;
      break;
    }
  }
  if (lastNonRestIdx === -1) {
    const firstRest = slots[0];
    return [
      {
        durationRatio: firstRest ? firstRest.durationRatio : 0.25,
        isRest: true,
        hits: [],
      },
    ];
  }

  return slots.slice(0, lastNonRestIdx + 1).map((s) => ({
    durationRatio: s.durationRatio,
    isRest: s.isRest || s.hits.length === 0,
    hits: s.hits,
  }));
}

export function getSlotLabels(totalSlots: number, slotDuration: number, _targetBeats?: number): string[] {
  const labels: string[] = [];
  for (let s = 0; s < totalSlots; s++) {
    const beatOffset = s * slotDuration;
    const beatNum = Math.floor(beatOffset) + 1;
    const subOffset = beatOffset - Math.floor(beatOffset);

    if (Math.abs(slotDuration - 0.25) < 0.03) {
      // 16th note subdivision: 1, e, &, a
      const step4 = Math.round(subOffset * 4);
      const names = [`${beatNum}`, 'e', '&', 'a'];
      labels.push(names[step4 % 4] || `${s + 1}`);
    } else if (Math.abs(slotDuration - 0.5) < 0.05) {
      // 8th note subdivision: 1, &
      const step2 = Math.round(subOffset * 2);
      const names = [`${beatNum}`, '&'];
      labels.push(names[step2 % 2] || `${s + 1}`);
    } else if (Math.abs(slotDuration - 1 / 3) < 0.03 || Math.abs(slotDuration - 1 / 6) < 0.02) {
      // Triplet subdivision: 1, trip, let
      const step3 = Math.round(subOffset * 3);
      const names = [`${beatNum}`, 'trip', 'let'];
      labels.push(names[step3 % 3] || `${s + 1}`);
    } else {
      labels.push(`${s + 1}`);
    }
  }
  return labels;
}

interface DragGuideState {
  x: number;
  y: number;
  voice: DrumVoice | null;
  slotLabel?: string;
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

  // Subdivision slots calculation
  const slotDuration = selectedDuration > 0 ? selectedDuration : 0.25;
  const totalSlots = Math.max(1, Math.round(targetBeats / slotDuration));
  const slotLabels = useMemo(
    () => getSlotLabels(totalSlots, slotDuration, targetBeats),
    [totalSlots, slotDuration, targetBeats]
  );

  // Hover state for interactive slot guidelines
  const [hoverSlot, setHoverSlot] = useState<{ slotIndex: number; voice: DrumVoice | null } | null>(null);

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

  // Track hover over slot and voice line
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !containerRef.current || !layoutRef.current || dragStateRef.current.isDragging) {
      if (hoverSlot) setHoverSlot(null);
      return;
    }
    const { x, y } = getEventCoords(e);
    const layout = layoutRef.current;
    const startX = layout.stave.getNoteStartX();
    const endX = layout.stave.getNoteEndX();
    const noteWidth = Math.max(10, endX - startX);
    const slotWidth = noteWidth / totalSlots;
    const slotIndex = Math.min(totalSlots - 1, Math.max(0, Math.floor((x - startX) / slotWidth)));
    const voice = layout.getDrumVoiceForY(y);
    setHoverSlot({ slotIndex, voice });
  };

  const handleMouseLeave = () => {
    setHoverSlot(null);
  };

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

    const startX = layout.stave.getNoteStartX();
    const endX = layout.stave.getNoteEndX();
    const noteWidth = Math.max(10, endX - startX);
    const slotWidth = noteWidth / totalSlots;
    const slotIndex = Math.min(totalSlots - 1, Math.max(0, Math.floor((x - startX) / slotWidth)));

    const slots = strokesToSlots(strokes, targetBeats, slotDuration);
    const targetSlot = slots[slotIndex];
    if (!targetSlot) return;

    if (activeTool === 'eraser') {
      if (targetSlot.hits && targetSlot.hits.length > 0) {
        let minDiff = Infinity;
        let targetHit = targetSlot.hits[0];
        for (const hit of targetSlot.hits) {
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
        targetSlot.hits = targetSlot.hits.filter((h) => h !== targetHit);
        if (targetSlot.hits.length === 0) {
          targetSlot.isRest = true;
        }
        onChangeStrokes(slotsToStrokes(slots));
      }
      return;
    }

    if (activeTool === 'rest') {
      targetSlot.hits = [];
      targetSlot.isRest = true;
      onChangeStrokes(slotsToStrokes(slots));
      return;
    }

    // Active tool === 'note'
    if (player && drumVoice) {
      const vel = dynamicToVelocity(selectedDynamic);
      player.triggerVoice(drumVoice, 0, vel, 'orchestration');
    }

    if (targetSlot.isRest || targetSlot.hits.length === 0) {
      targetSlot.hits = [{ voice: drumVoice, dynamic: selectedDynamic }];
      targetSlot.isRest = false;
    } else {
      const existingIdx = targetSlot.hits.findIndex((h) => h.voice === drumVoice);
      if (existingIdx >= 0) {
        if (targetSlot.hits[existingIdx].dynamic === selectedDynamic && targetSlot.hits.length > 1) {
          targetSlot.hits.splice(existingIdx, 1);
        } else if (targetSlot.hits[existingIdx].dynamic === selectedDynamic) {
          targetSlot.hits = [];
          targetSlot.isRest = true;
        } else {
          targetSlot.hits[existingIdx] = { voice: drumVoice, dynamic: selectedDynamic };
        }
      } else {
        targetSlot.hits.push({ voice: drumVoice, dynamic: selectedDynamic });
      }
    }

    onChangeStrokes(slotsToStrokes(slots));
  };

  // HTML5 Drag-and-Drop (e.g. from palette)
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (readOnly || !containerRef.current || !layoutRef.current) return;

    const { x, y } = getEventCoords(e);
    const layout = layoutRef.current;
    const voice = layout.getDrumVoiceForY(y);

    const startX = layout.stave.getNoteStartX();
    const endX = layout.stave.getNoteEndX();
    const noteWidth = Math.max(10, endX - startX);
    const slotWidth = noteWidth / totalSlots;
    const slotIndex = Math.min(totalSlots - 1, Math.max(0, Math.floor((x - startX) / slotWidth)));
    const snappedX = startX + (slotIndex + 0.5) * slotWidth;

    setDragGuide({
      x: snappedX,
      y,
      voice,
      slotLabel: slotLabels[slotIndex],
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

    const dynamic = payload?.dynamic || selectedDynamic;
    const { x, y } = getEventCoords(e);
    const layout = layoutRef.current;
    const drumVoice = layout.getDrumVoiceForY(y) || 'snare';

    const startX = layout.stave.getNoteStartX();
    const endX = layout.stave.getNoteEndX();
    const noteWidth = Math.max(10, endX - startX);
    const slotWidth = noteWidth / totalSlots;
    const slotIndex = Math.min(totalSlots - 1, Math.max(0, Math.floor((x - startX) / slotWidth)));

    if (player && drumVoice) {
      player.triggerVoice(drumVoice, 0, dynamicToVelocity(dynamic), 'orchestration');
    }

    const slots = strokesToSlots(strokes, targetBeats, slotDuration);
    const targetSlot = slots[slotIndex];
    if (!targetSlot) return;

    if (targetSlot.isRest || targetSlot.hits.length === 0) {
      targetSlot.hits = [{ voice: drumVoice, dynamic }];
      targetSlot.isRest = false;
    } else {
      const existingIdx = targetSlot.hits.findIndex((h) => h.voice === drumVoice);
      if (existingIdx >= 0) {
        targetSlot.hits[existingIdx] = { voice: drumVoice, dynamic };
      } else {
        targetSlot.hits.push({ voice: drumVoice, dynamic });
      }
    }

    onChangeStrokes(slotsToStrokes(slots));
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
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative w-full overflow-hidden select-none cursor-pointer rounded-xl bg-white dark:bg-white text-slate-950 border border-slate-200/90 shadow-sm flex flex-col items-center justify-center pt-2 ${
        className || ''
      }`}
      style={{ minHeight: height }}
    >
      {/* Visual Subdivision Slot Grid Guidelines */}
      {layoutRef.current && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: totalSlots }).map((_, s) => {
            const startX = layoutRef.current!.stave.getNoteStartX();
            const endX = layoutRef.current!.stave.getNoteEndX();
            const noteWidth = Math.max(10, endX - startX);
            const slotWidth = noteWidth / totalSlots;
            const slotLeft = startX + s * slotWidth;
            const slotLabel = slotLabels[s] || `${s + 1}`;
            const isHovered = hoverSlot?.slotIndex === s;
            const isDownbeat = (s * slotDuration) % 1.0 < 0.01;

            return (
              <React.Fragment key={s}>
                {/* Slot Column Guideline */}
                {s > 0 && (
                  <div
                    className={cn(
                      'absolute top-7 bottom-3 pointer-events-none border-r transition-colors',
                      isDownbeat ? 'border-slate-300' : 'border-dashed border-slate-200/80'
                    )}
                    style={{ left: `${slotLeft}px` }}
                  />
                )}

                {/* Hover Column Wash */}
                {isHovered && (
                  <div
                    className="absolute top-7 bottom-3 pointer-events-none bg-teal-500/10 border-x border-teal-500/30 rounded transition-all"
                    style={{ left: `${slotLeft}px`, width: `${slotWidth}px` }}
                  />
                )}

                {/* Slot Header Label */}
                <div
                  className="absolute top-1 pointer-events-none flex justify-center text-[10px] font-mono font-semibold"
                  style={{ left: `${slotLeft}px`, width: `${slotWidth}px` }}
                >
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded transition-colors',
                      isHovered
                        ? 'bg-teal-600 text-white font-bold shadow-xs'
                        : isDownbeat
                        ? 'text-teal-700 font-bold bg-teal-50 border border-teal-200/60'
                        : 'text-slate-400'
                    )}
                  >
                    {slotLabel}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* VexFlow 5-Line Percussion Score Container */}
      <div ref={containerRef} className="w-full flex justify-center" />

      {/* Animated Audition Playhead */}
      {playheadBeat !== null && playheadBeat !== undefined && layoutRef.current && (
        <div
          data-testid="audition-playhead"
          className="absolute top-0 bottom-0 w-[2px] bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] pointer-events-none transition-all duration-75"
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
            className="absolute top-0 bottom-0 w-[2px] bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]"
            style={{ left: `${dragGuide.x}px` }}
          />

          {/* Target Voice Guide / Badge */}
          {dragGuide.voice && (
            <div
              className={`absolute px-2 py-0.5 rounded text-[10px] font-mono font-bold shadow-md transition-all ${
                dragGuide.isOffStave
                  ? 'bg-rose-500 text-white'
                  : 'bg-teal-600 text-white'
              }`}
              style={{
                left: `${dragGuide.x + 8}px`,
                top: `${Math.max(4, Math.min(height - 24, dragGuide.y - 12))}px`,
              }}
            >
              {dragGuide.isOffStave
                ? 'Remove'
                : `${dragGuide.slotLabel ? `${dragGuide.slotLabel} • ` : ''}${
                    DRUM_VOICE_PAS_MAP[dragGuide.voice]?.label || dragGuide.voice
                  }`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
