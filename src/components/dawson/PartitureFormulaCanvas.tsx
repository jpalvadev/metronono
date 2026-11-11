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
      // 16th note subdivision (4 per beat): 1, e, &, a
      const step4 = Math.round(subOffset * 4);
      const names = [`${beatNum}`, 'e', '&', 'a'];
      labels.push(names[step4 % 4] || `${s + 1}`);
    } else if (Math.abs(slotDuration - 0.5) < 0.05) {
      // 8th note subdivision (2 per beat): 1, &
      const step2 = Math.round(subOffset * 2);
      const names = [`${beatNum}`, '&'];
      labels.push(names[step2 % 2] || `${s + 1}`);
    } else if (Math.abs(slotDuration - 1 / 6) < 0.02) {
      // 16th note triplet (sextuplet, 6 per beat): 1, trip, let, &, trip, let
      const step6 = Math.round(subOffset * 6);
      const names = [`${beatNum}`, 'trip', 'let', '&', 'trip', 'let'];
      labels.push(names[step6 % 6] || `${s + 1}`);
    } else if (Math.abs(slotDuration - 1 / 3) < 0.03) {
      // 8th note triplet (3 per beat): 1, trip, let
      const step3 = Math.round(subOffset * 3);
      const names = [`${beatNum}`, 'trip', 'let'];
      labels.push(names[step3 % 3] || `${s + 1}`);
    } else if (Math.abs(slotDuration - 0.125) < 0.02) {
      // 32nd note subdivision (8 per beat)
      const step8 = Math.round(subOffset * 8);
      const names = [`${beatNum}`, 'e', '&', 'a', `${beatNum}`, 'e', '&', 'a'];
      labels.push(names[step8 % 8] || `${s + 1}`);
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
  const dragRef = useRef<{
    isTracking: boolean;
    isDragging: boolean;
    startX: number;
    startY: number;
    sourceSlotIndex: number;
    sourceVoice: DrumVoice | null;
    currentVoice: DrumVoice | null;
    lastSoundedVoice: DrumVoice | null;
    targetSlotIndex: number;
    isOffStave: boolean;
  }>({
    isTracking: false,
    isDragging: false,
    startX: 0,
    startY: 0,
    sourceSlotIndex: -1,
    sourceVoice: null,
    currentVoice: null,
    lastSoundedVoice: null,
    targetSlotIndex: -1,
    isOffStave: false,
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
    if (readOnly || !containerRef.current || !layoutRef.current || dragRef.current.isDragging) {
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
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
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

    let payload: { type?: string; durationRatio?: number; dynamic?: Dynamic; voice?: DrumVoice } | null = null;
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
    const drumVoice = layout.getDrumVoiceForY(y) || payload?.voice || 'snare';

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

    targetSlot.isRest = false;
    const existingIdx = targetSlot.hits.findIndex((h) => h.voice === drumVoice);
    if (existingIdx >= 0) {
      targetSlot.hits[existingIdx] = { voice: drumVoice, dynamic };
    } else {
      targetSlot.hits.push({ voice: drumVoice, dynamic });
    }

    onChangeStrokes(slotsToStrokes(slots));
  };

  // Pointer drag gestures for existing notes (transposition & horizontal slot shifts)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || !containerRef.current || !layoutRef.current) return;

    const { x, y } = getEventCoords(e);
    const layout = layoutRef.current;
    const startX = layout.stave.getNoteStartX();
    const endX = layout.stave.getNoteEndX();
    const noteWidth = Math.max(10, endX - startX);
    const slotWidth = noteWidth / totalSlots;
    const slotIndex = Math.min(totalSlots - 1, Math.max(0, Math.floor((x - startX) / slotWidth)));

    const slots = strokesToSlots(strokes, targetBeats, slotDuration);
    const slot = slots[slotIndex];

    if (slot && !slot.isRest && slot.hits && slot.hits.length > 0) {
      // Find the hit closest to clicked Y
      let closestVoice = slot.hits[0].voice;
      let minDiff = Infinity;
      slot.hits.forEach((h) => {
        const pas = DRUM_VOICE_PAS_MAP[h.voice];
        const lineY = pas ? layout.stave.getYForLine(pas.line) : y;
        const diff = Math.abs(lineY - y);
        if (diff < minDiff) {
          minDiff = diff;
          closestVoice = h.voice;
        }
      });

      dragRef.current = {
        isTracking: true,
        isDragging: false,
        startX: x,
        startY: y,
        sourceSlotIndex: slotIndex,
        sourceVoice: closestVoice,
        currentVoice: closestVoice,
        lastSoundedVoice: closestVoice,
        targetSlotIndex: slotIndex,
        isOffStave: false,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isTracking || !containerRef.current || !layoutRef.current) return;

    const { x, y } = getEventCoords(e);
    const state = dragRef.current;

    // Movement threshold to initiate drag
    if (!state.isDragging) {
      if (Math.hypot(x - state.startX, y - state.startY) > 5) {
        state.isDragging = true;
      } else {
        return;
      }
    }

    const layout = layoutRef.current;
    const startX = layout.stave.getNoteStartX();
    const endX = layout.stave.getNoteEndX();
    const noteWidth = Math.max(10, endX - startX);
    const slotWidth = noteWidth / totalSlots;
    const targetSlot = Math.min(totalSlots - 1, Math.max(0, Math.floor((x - startX) / slotWidth)));

    const isOffStave = y < -20 || y > height + 20;
    const currentVoice = layout.getDrumVoiceForY(y);

    if (!isOffStave && currentVoice && currentVoice !== state.lastSoundedVoice) {
      if (player) {
        player.triggerVoice(currentVoice, 0, dynamicToVelocity(selectedDynamic), 'orchestration');
      }
      state.lastSoundedVoice = currentVoice;
    }

    state.currentVoice = currentVoice;
    state.targetSlotIndex = targetSlot;
    state.isOffStave = isOffStave;

    const snappedX = startX + (targetSlot + 0.5) * slotWidth;
    setDragGuide({
      x: snappedX,
      y,
      voice: currentVoice,
      slotLabel: slotLabels[targetSlot],
      isOffStave,
    });
  };

  const handlePointerUp = () => {
    if (!dragRef.current.isTracking) return;

    const {
      isDragging,
      sourceSlotIndex,
      sourceVoice,
      currentVoice,
      targetSlotIndex,
      isOffStave,
    } = dragRef.current;

    dragRef.current = {
      isTracking: false,
      isDragging: false,
      startX: 0,
      startY: 0,
      sourceSlotIndex: -1,
      sourceVoice: null,
      currentVoice: null,
      lastSoundedVoice: null,
      targetSlotIndex: -1,
      isOffStave: false,
    };
    setDragGuide(null);

    // If it was just a click (movement < 5px), let handleClick handle it
    if (!isDragging || sourceSlotIndex === -1 || !sourceVoice) return;

    const slots = strokesToSlots(strokes, targetBeats, slotDuration);
    const srcSlot = slots[sourceSlotIndex];
    if (!srcSlot) return;

    if (isOffStave) {
      // Remove the dragged voice from source slot
      srcSlot.hits = srcSlot.hits.filter((h) => h.voice !== sourceVoice);
      if (srcSlot.hits.length === 0) {
        srcSlot.isRest = true;
      }
      onChangeStrokes(slotsToStrokes(slots));
      return;
    }

    const dstSlot = slots[targetSlotIndex];
    if (!dstSlot) return;

    const finalVoice = currentVoice || sourceVoice;

    // If moved to a different slot or different voice
    if (targetSlotIndex !== sourceSlotIndex || finalVoice !== sourceVoice) {
      // Remove from source slot
      srcSlot.hits = srcSlot.hits.filter((h) => h.voice !== sourceVoice);
      if (srcSlot.hits.length === 0) {
        srcSlot.isRest = true;
      }

      // Add to target slot
      dstSlot.isRest = false;
      const existing = dstSlot.hits.findIndex((h) => h.voice === finalVoice);
      if (existing === -1) {
        dstSlot.hits.push({ voice: finalVoice, dynamic: selectedDynamic });
      }
      onChangeStrokes(slotsToStrokes(slots));
    }
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
