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
import { DRUM_VOICE_PAS_MAP } from '../../notation/DrumVoicePAS';
import {
  resolveStrokeOffsets,
  calculateFormulaDuration,
} from '../../domain/dawson/SubdivisionFormula';
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

// Continuous Metric Timeline (docs/adr/0013): a measure is polyphonic events
// at fractional timeInMeasure offsets — the same offsets the audio scheduler
// uses — never a coerced homogeneous slot grid.
export interface FormulaEvent {
  beatOffset: number;
  durationRatio: number;
  hits: import('../../domain/dawson/types').DrumHit[];
  isRest: boolean;
}

export function eventsFromStrokes(
  strokes: OrchestratedStroke[],
  targetBeats: number
): FormulaEvent[] {
  const resolved = resolveStrokeOffsets(strokes, 0);
  const events: FormulaEvent[] = [];
  resolved.forEach(({ stroke, offset }) => {
    if (offset >= targetBeats) return;
    const beatOffset = Math.round(Math.min(offset, targetBeats) * 1000) / 1000;
    const isRest = stroke.isRest || stroke.hits.length === 0;
    const previous = events[events.length - 1];
    if (previous && previous.beatOffset === beatOffset) {
      // Same timeInMeasure: merge into one unison chord.
      if (!isRest) {
        previous.hits = [...previous.hits, ...stroke.hits];
        previous.isRest = false;
      }
      return;
    }
    events.push({
      beatOffset,
      durationRatio: stroke.durationRatio,
      hits: [...stroke.hits],
      isRest,
    });
  });
  return events;
}

// Quantization Adapter (docs/adr/0013): ONLY newly created events get snapped
// to the current subdivision grid; existing events keep their exact offsets.
export function quantizeTime(
  time: number,
  slotDuration: number,
  targetBeats: number
): number {
  const grid = slotDuration > 0 ? slotDuration : 0.25;
  const snapped = Math.round(Math.max(0, time) / grid) * grid;
  const lastStart = Math.max(0, targetBeats - grid);
  return Math.round(Math.min(snapped, lastStart) * 1000) / 1000;
}

export function getEventIndexForTime(
  time: number,
  events: FormulaEvent[],
  tolerance: number
): number {
  let bestIdx = -1;
  let bestDiff = Infinity;
  events.forEach((event, i) => {
    const diff = Math.abs(event.beatOffset - time);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  });
  return bestDiff <= tolerance ? bestIdx : -1;
}

// Commit continuous events back to the editor's stroke list: gaps between
// events become explicit rests so the audio scheduler (which consumes the same
// stroke list) hears the events at the offsets the canvas shows.
export function commitEvents(
  events: FormulaEvent[],
  targetBeats: number,
  preserveAll: boolean
): OrchestratedStroke[] {
  const sorted = [...events].sort((a, b) => a.beatOffset - b.beatOffset);
  const hasSounding = sorted.some((event) => !event.isRest && event.hits.length > 0);
  if (sorted.length === 0) {
    return [{ durationRatio: 0.25, isRest: true, hits: [] }];
  }
  if (!hasSounding && !preserveAll) {
    const first = sorted[0];
    return [
      {
        durationRatio: first.durationRatio,
        isRest: true,
        hits: [],
      },
    ];
  }

  const strokes: OrchestratedStroke[] = [];
  let cursor = 0;
  sorted.forEach((event) => {
    // Sequential-safe: the stroke model cannot overlap, so an event earlier
    // than the running cursor is clamped forward.
    const offset = Math.max(event.beatOffset, cursor);
    const gap = offset - cursor;
    if (gap > 0.001) {
      strokes.push({
        durationRatio: Math.round(gap * 1000) / 1000,
        isRest: true,
        hits: [],
      });
    }
    strokes.push({
      durationRatio: event.durationRatio,
      isRest: event.isRest || event.hits.length === 0,
      hits: event.hits,
    });
    cursor = offset + event.durationRatio;
  });

  if (preserveAll) {
    const trailing = targetBeats - cursor;
    if (trailing > 0.001) {
      strokes.push({
        durationRatio: Math.round(trailing * 1000) / 1000,
        isRest: true,
        hits: [],
      });
    }
    return strokes;
  }

  let lastNonRestIdx = -1;
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (!strokes[i].isRest) {
      lastNonRestIdx = i;
      break;
    }
  }
  if (lastNonRestIdx === -1) {
    return [{ durationRatio: strokes[0].durationRatio, isRest: true, hits: [] }];
  }
  return strokes.slice(0, lastNonRestIdx + 1);
}

export function getSlotLabels(totalSlots: number, slotDuration: number, _targetBeats?: number): string[] {
  const labels: string[] = [];
  for (let s = 0; s < totalSlots; s++) {
    const beatOffset = s * slotDuration;
    const beatNum = Math.floor(beatOffset) + 1;
    const subOffset = beatOffset - Math.floor(beatOffset);

    if (Math.abs(slotDuration - 0.25) < 0.03) {
      const names = ['1', 'e', '&', 'a'];
      labels.push(names[Math.round(subOffset * 4) % 4]);
    } else if (Math.abs(slotDuration - 0.5) < 0.05) {
      labels.push(Math.round(subOffset * 2) === 0 ? `${beatNum}` : 'e');
    } else if (Math.abs(slotDuration - 1 / 6) < 0.02) {
      labels.push('t');
    } else if (Math.abs(slotDuration - 1 / 3) < 0.03) {
      const names = ['1', 't', 'r'];
      labels.push(names[Math.round(subOffset * 3) % 3]);
    } else if (Math.abs(slotDuration - 0.125) < 0.02) {
      const names = ['1', 'e', 'a', 's', '1', 'e', 'a', 's'];
      labels.push(names[Math.round(subOffset * 8) % 8]);
    } else if (Math.abs(slotDuration - 1 / 12) < 0.01) {
      const names = ['1', 't', 'r', 't', 'r', 't'];
      labels.push(names[Math.round(subOffset * 6) % 6]);
    } else {
      const step8 = Math.round(subOffset * 8);
      const names = ['1', 'e', 'a', 's', '1', 'e', 'a', 's'];
      labels.push(names[step8 % 8]);
    }
  }
  return labels;
}

interface DragGuideState {
  x: number;
  y: number;
  voice: DrumVoice | null;
  timeLabel?: string;
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
  const stageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DrumStaffFormulaRenderer>(new DrumStaffFormulaRenderer());
  const layoutRef = useRef<DrumStaffFormulaLayout | null>(null);

  const slotDuration = selectedDuration > 0 ? selectedDuration : 0.25;

  // Events are the canvas's working set: continuous timeInMeasure offsets.
  const events = useMemo(
    () => eventsFromStrokes(strokes, targetBeats),
    [strokes, targetBeats]
  );

  // The quantization grid is display + creation only (the Quantization Adapter
  // of docs/adr/0013): the labels of the grid the adapter snaps NEW events to.
  const totalSlots = Math.max(1, Math.round(targetBeats / slotDuration));
  const gridLabels = useMemo(
    () => getSlotLabels(totalSlots, slotDuration, targetBeats),
    [totalSlots, slotDuration, targetBeats]
  );

  const labelForTime = (time: number): string => {
    const step = Math.max(
      0,
      Math.min(totalSlots - 1, Math.round(time / slotDuration))
    );
    return gridLabels[step];
  };

  const [hoverEvent, setHoverEvent] = useState<{ eventIndex: number; voice: DrumVoice | null } | null>(null);

  const [dragGuide, setDragGuide] = useState<DragGuideState | null>(null);
  const dragRef = useRef<{
    isTracking: boolean;
    isDragging: boolean;
    startX: number;
    startY: number;
    sourceEventIndex: number;
    sourceVoice: DrumVoice | null;
    currentVoice: DrumVoice | null;
    lastSoundedVoice: DrumVoice | null;
    targetTime: number;
    isOffStave: boolean;
  }>({
    isTracking: false,
    isDragging: false,
    startX: 0,
    startY: 0,
    sourceEventIndex: -1,
    sourceVoice: null,
    currentVoice: null,
    lastSoundedVoice: null,
    targetTime: -1,
    isOffStave: false,
  });

  const resetDragRef = () => {
    dragRef.current = {
      isTracking: false,
      isDragging: false,
      startX: 0,
      startY: 0,
      sourceEventIndex: -1,
      sourceVoice: null,
      currentVoice: null,
      lastSoundedVoice: null,
      targetTime: -1,
      isOffStave: false,
    };
  };

  const getEventCoords = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.DragEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>) => {
      const rect = stageRef.current?.getBoundingClientRect() || containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
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

  // Event geometry from the RENDERED note anchors (ADR-0012 seam): neighbor
  // midpoints of strokeCoordinates, never against a slot count. Hitboxes
  // agree with noteheads even in mixed-ratio figures.
  const getEventGeometry = (
    eventIndex: number,
    anchorEvents: FormulaEvent[],
    layout: DrumStaffFormulaLayout | null
  ): { centerX: number; leftBoundary: number; rightBoundary: number; width: number } => {
    if (!layout) {
      return { centerX: 0, leftBoundary: 0, rightBoundary: 0, width: 0 };
    }
    const startX = layout.stave.getNoteStartX();
    const endX = layout.stave.getNoteEndX();
    const coords = layout.strokeCoordinates;

    const anchorXOf = (index: number): number | null => {
      if (!coords || index < 0 || index >= anchorEvents.length) return null;
      const coordinate = coords[index];
      return coordinate ? coordinate.x : null;
    };

    const eventCenterX = (event: FormulaEvent): number =>
      layout.getXForBeatOffset(event.beatOffset, targetBeats);

    const currentX = anchorXOf(eventIndex) ?? eventCenterX(anchorEvents[eventIndex]);
    const prevX = eventIndex > 0 ? anchorXOf(eventIndex - 1) ?? eventCenterX(anchorEvents[eventIndex - 1]) : startX;
    const nextX =
      eventIndex < anchorEvents.length - 1
        ? anchorXOf(eventIndex + 1) ?? eventCenterX(anchorEvents[eventIndex + 1])
        : endX;

    const leftBoundary = eventIndex === 0 ? startX : (prevX + currentX) / 2;
    const rightBoundary =
      eventIndex === anchorEvents.length - 1 ? endX : (currentX + nextX) / 2;

    return {
      centerX: currentX,
      leftBoundary,
      rightBoundary,
      width: Math.max(1, rightBoundary - leftBoundary),
    };
  };

  const commitEventsOf = useCallback(
    (updatedEvents: FormulaEvent[]) => {
      const preserveAll =
        (targetBeats !== undefined && targetBeats > 1.0) ||
        (strokes.length > 0 &&
        Math.abs(calculateFormulaDuration(strokes) - targetBeats) < 0.05);
      onChangeStrokes(commitEvents(updatedEvents, targetBeats, preserveAll));
    },
    [strokes, targetBeats, onChangeStrokes]
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

  // Gesture seam: continuous x -> timeInMeasure through the note-anchored
  // layout mapping (ADR-0012), then nearest existing event by TIME distance.
  // The half-grid tolerance is where the Quantization Adapter creates instead.
  const gestureTime = (x: number, layout: DrumStaffFormulaLayout): number =>
    layout.getBeatOffsetForX(x, targetBeats);

  const halfGridTolerance = slotDuration / 2;

  // Track hover over event and voice line
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !containerRef.current || !layoutRef.current || dragRef.current.isDragging) {
      if (hoverEvent) setHoverEvent(null);
      return;
    }
    const { x, y } = getEventCoords(e);
    const layout = layoutRef.current;
    const time = gestureTime(x, layout);
    const eventIndex =
      events.length > 0 ? getEventIndexForTime(time, events, Infinity) : -1;
    const voice = layout.getDrumVoiceForY(y);
    if (eventIndex >= 0) {
      setHoverEvent({ eventIndex, voice });
    } else {
      setHoverEvent(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverEvent(null);
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
    const time = gestureTime(x, layout);
    const workingEvents = events.map((event) => ({ ...event, hits: [...event.hits] }));
    const targetIdx = getEventIndexForTime(time, workingEvents, halfGridTolerance);

    if (activeTool === 'eraser') {
      const targetEvent = targetIdx >= 0 ? workingEvents[targetIdx] : null;
      if (targetEvent && targetEvent.hits.length > 0) {
        let minDiff = Infinity;
        let targetHit = targetEvent.hits[0];
        for (const hit of targetEvent.hits) {
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
        targetEvent.hits = targetEvent.hits.filter((h) => h !== targetHit);
        if (targetEvent.hits.length === 0) {
          targetEvent.isRest = true;
        }
        commitEventsOf(workingEvents);
      }
      return;
    }

    if (activeTool === 'rest') {
      if (targetIdx >= 0) {
        workingEvents[targetIdx].hits = [];
        workingEvents[targetIdx].isRest = true;
      } else {
        workingEvents.push({
          beatOffset: quantizeTime(time, slotDuration, targetBeats),
          durationRatio: slotDuration,
          hits: [],
          isRest: true,
        });
      }
      commitEventsOf(workingEvents);
      return;
    }

    // Active tool === 'note'
    if (player && drumVoice) {
      const vel = dynamicToVelocity(selectedDynamic);
      player.triggerVoice(drumVoice, 0, vel, 'orchestration');
    }

    let targetEvent = targetIdx >= 0 ? workingEvents[targetIdx] : null;
    if (!targetEvent) {
      // Quantization Adapter: a NEW event snaps to the subdivision grid.
      const created = {
        beatOffset: quantizeTime(time, slotDuration, targetBeats),
        durationRatio: slotDuration,
        hits: [] as import('../../domain/dawson/types').DrumHit[],
        isRest: false,
      };
      workingEvents.push(created);
      targetEvent = created;
    }

    if (targetEvent.isRest || targetEvent.hits.length === 0) {
      targetEvent.hits = [{ voice: drumVoice, dynamic: selectedDynamic }];
      targetEvent.isRest = false;
    } else {
      const existingIdx = targetEvent.hits.findIndex((h) => h.voice === drumVoice);
      if (existingIdx >= 0) {
        if (targetEvent.hits[existingIdx].dynamic === selectedDynamic && targetEvent.hits.length > 1) {
          targetEvent.hits.splice(existingIdx, 1);
        } else if (targetEvent.hits[existingIdx].dynamic === selectedDynamic) {
          targetEvent.hits = [];
          targetEvent.isRest = true;
        } else {
          targetEvent.hits[existingIdx] = { voice: drumVoice, dynamic: selectedDynamic };
        }
      } else {
        targetEvent.hits.push({ voice: drumVoice, dynamic: selectedDynamic });
      }
    }

    commitEventsOf(workingEvents);
  };

  // HTML5 Drag-and-Drop (e.g. from palette)
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (readOnly || !containerRef.current || !layoutRef.current) return;

    const { x, y } = getEventCoords(e);
    const layout = layoutRef.current;
    const voice = layout.getDrumVoiceForY(y);
    const time = gestureTime(x, layout);
    const targetIdx = getEventIndexForTime(time, events, halfGridTolerance);
    const guideX =
      targetIdx >= 0
        ? getEventGeometry(targetIdx, events, layout).centerX
        : layout.getXForBeatOffset(quantizeTime(time, slotDuration, targetBeats), targetBeats);

    setDragGuide({
      x: guideX,
      y,
      voice,
      timeLabel: labelForTime(
        targetIdx >= 0 ? events[targetIdx].beatOffset : time
      ),
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
    const time = gestureTime(x, layout);

    if (player && drumVoice) {
      player.triggerVoice(drumVoice, 0, dynamicToVelocity(dynamic), 'orchestration');
    }

    const workingEvents = events.map((event) => ({ ...event, hits: [...event.hits] }));
    let targetEvent =
      workingEvents[getEventIndexForTime(time, workingEvents, halfGridTolerance)];
    if (!targetEvent) {
      const created = {
        beatOffset: quantizeTime(time, slotDuration, targetBeats),
        durationRatio: payload?.durationRatio || slotDuration,
        hits: [] as import('../../domain/dawson/types').DrumHit[],
        isRest: false,
      };
      workingEvents.push(created);
      targetEvent = created;
    }

    targetEvent.isRest = false;
    const existingIdx = targetEvent.hits.findIndex((h) => h.voice === drumVoice);
    if (existingIdx >= 0) {
      targetEvent.hits[existingIdx] = { voice: drumVoice, dynamic };
    } else {
      targetEvent.hits.push({ voice: drumVoice, dynamic });
    }

    commitEventsOf(workingEvents);
  };

  // Pointer drag gestures for existing events (transposition & metric shifts)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || !containerRef.current || !layoutRef.current) return;

    const { x, y } = getEventCoords(e);
    const layout = layoutRef.current;
    const time = gestureTime(x, layout);
    const sourceIndex = getEventIndexForTime(time, events, halfGridTolerance);
    const sourceEvent = sourceIndex >= 0 ? events[sourceIndex] : null;

    if (sourceEvent && !sourceEvent.isRest && sourceEvent.hits.length > 0) {
      // Find the hit closest to clicked Y
      let closestVoice = sourceEvent.hits[0].voice;
      let minDiff = Infinity;
      sourceEvent.hits.forEach((h) => {
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
        sourceEventIndex: sourceIndex,
        sourceVoice: closestVoice,
        currentVoice: closestVoice,
        lastSoundedVoice: closestVoice,
        targetTime: sourceEvent.beatOffset,
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
    const time = gestureTime(x, layout);

    const isOffStave = y < -20 || y > height + 20;
    const currentVoice = layout.getDrumVoiceForY(y);

    if (!isOffStave && currentVoice && currentVoice !== state.lastSoundedVoice) {
      if (player) {
        player.triggerVoice(currentVoice, 0, dynamicToVelocity(selectedDynamic), 'orchestration');
      }
      state.lastSoundedVoice = currentVoice;
    }

    state.currentVoice = currentVoice;
    state.targetTime = time;
    state.isOffStave = isOffStave;

    const targetIdx = getEventIndexForTime(time, events, halfGridTolerance);
    const guideX =
      targetIdx >= 0
        ? getEventGeometry(targetIdx, events, layout).centerX
        : layout.getXForBeatOffset(quantizeTime(time, slotDuration, targetBeats), targetBeats);
    setDragGuide({
      x: guideX,
      y,
      voice: currentVoice,
      timeLabel:
        targetIdx >= 0
          ? labelForTime(events[targetIdx].beatOffset)
          : labelForTime(time),
      isOffStave,
    });
  };

  const handlePointerUp = () => {
    if (!dragRef.current.isTracking) return;

    const {
      isDragging,
      sourceEventIndex,
      sourceVoice,
      currentVoice,
      targetTime,
      isOffStave,
    } = dragRef.current;

    resetDragRef();
    setDragGuide(null);

    // If it was just a click (movement < 5px), let handleClick handle it
    if (!isDragging || sourceEventIndex === -1 || !sourceVoice) return;

    const workingEvents = events.map((event) => ({ ...event, hits: [...event.hits] }));
    const srcEvent = workingEvents[sourceEventIndex];
    if (!srcEvent) return;

    if (isOffStave) {
      // Remove the dragged voice from the source event
      srcEvent.hits = srcEvent.hits.filter((h) => h.voice !== sourceVoice);
      if (srcEvent.hits.length === 0) {
        srcEvent.isRest = true;
      }
      commitEventsOf(workingEvents);
      return;
    }

    const finalVoice = currentVoice || sourceVoice;
    let dstIdx = getEventIndexForTime(targetTime, workingEvents, halfGridTolerance);
    if (dstIdx === sourceEventIndex && finalVoice === sourceVoice) {
      return;
    }

    // Remove from the source event
    srcEvent.hits = srcEvent.hits.filter((h) => h.voice !== sourceVoice);
    if (srcEvent.hits.length === 0) {
      srcEvent.isRest = true;
    }

    // Add to the target event, created at the snapped grid time when new
    let dstEvent = dstIdx >= 0 ? workingEvents[dstIdx] : null;
    if (!dstEvent) {
      const created = {
        beatOffset: quantizeTime(targetTime, slotDuration, targetBeats),
        durationRatio: slotDuration,
        hits: [] as import('../../domain/dawson/types').DrumHit[],
        isRest: false,
      };
      workingEvents.push(created);
      dstEvent = created;
    }

    dstEvent.isRest = false;
    const existing = dstEvent.hits.findIndex((h) => h.voice === finalVoice);
    if (existing === -1) {
      dstEvent.hits.push({ voice: finalVoice, dynamic: selectedDynamic });
    }
    commitEventsOf(workingEvents);
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
      className={`relative w-full overflow-hidden select-none cursor-pointer rounded-none bg-card text-foreground border border-border shadow-sm flex flex-col items-center justify-center pt-2 ${
        className || ''
      }`}
      style={{ minHeight: height }}
    >
      {/* Centered Stave Stage matching exact SVG bounds */}
      <div
        ref={stageRef}
        className="relative"
        style={{ width, height }}
      >
        {/* VexFlow 5-Line Percussion Score Container */}
        <div ref={containerRef} style={{ width, height }} />

        {/* Quantization grid: display guides for the grid the adapter snaps NEW events to */}
        {layoutRef.current && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: totalSlots - 1 }).map((_, s) => {
              const boundaryX =
                layoutRef.current!.getXForBeatOffset(
                  (s + 1) * slotDuration,
                  targetBeats
                );
              const isDownbeat = ((s + 1) * slotDuration) % 1.0 < 0.01;
              return (
                <div
                  key={s}
                  className={cn(
                    'absolute top-7 bottom-3 pointer-events-none border-r transition-colors',
                    isDownbeat ? 'border-border' : 'border-dashed border-border/80'
                  )}
                  style={{ left: `${boundaryX}px` }}
                />
              );
            })}
          </div>
        )}

        {/* Hover wash + header labels follow the metric EVENT anchors */}
        {layoutRef.current && hoverEvent && hoverEvent.eventIndex >= 0 && hoverEvent.eventIndex < events.length && (
          (() => {
            const geom = getEventGeometry(hoverEvent.eventIndex, events, layoutRef.current!);
            const event = events[hoverEvent.eventIndex];
            const label = labelForTime(event.beatOffset);
            return (
              <div className="absolute inset-0 pointer-events-none">
                {/* Hover Column Wash */}
                <div
                  className="absolute top-7 bottom-3 pointer-events-none bg-primary/10 border-x border-primary/30 rounded-none transition-all"
                  style={{ left: `${geom.leftBoundary}px`, width: `${geom.width}px` }}
                />

                {/* Event Header Label */}
                <div
                  className="absolute top-1 pointer-events-none flex justify-center text-[10px] font-mono font-semibold"
                  style={{ left: `${geom.leftBoundary}px`, width: `${geom.width}px` }}
                >
                  <span
                    className={cn(
                      'px-1.5 py-0.2 rounded-none transition-colors',
                      'bg-primary text-primary-foreground font-bold shadow-xs'
                    )}
                  >
                    {label}
                  </span>
                </div>
              </div>
            );
          })()
        )}

        {/* Downbeat header labels on the quantization grid (display only) */}
        {layoutRef.current &&
          Array.from({ length: totalSlots }).map((_, s) => {
            const time = s * slotDuration;
            const isDownbeat = time % 1.0 < 0.01;
            if (!isDownbeat) {
              return null;
            }
            const startX = layoutRef.current!.stave.getNoteStartX();
            const boundaryX =
              s === 0
                ? startX
                : layoutRef.current!.getXForBeatOffset(time, targetBeats);
            const nextX =
              s === totalSlots - 1
                ? layoutRef.current!.stave.getNoteEndX()
                : layoutRef.current!.getXForBeatOffset((s + 1) * slotDuration, targetBeats);
            return (
              <div
                key={`label-${s}`}
                className="absolute top-1 pointer-events-none flex justify-center text-[10px] font-mono font-semibold"
                style={{ left: `${boundaryX}px`, width: `${Math.max(10, nextX - boundaryX)}px` }}
              >
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-none transition-colors',
                    'text-primary font-bold bg-primary/10 border border-primary/30'
                  )}
                >
                  {gridLabels[s] || `${s + 1}`}
                </span>
              </div>
            );
          })}

        {/* Animated Audition Playhead */}
        {playheadBeat !== null && playheadBeat !== undefined && layoutRef.current && (
          <div
            data-testid="audition-playhead"
            className="absolute top-0 bottom-0 w-[2px] bg-primary playhead-glow pointer-events-none transition-all duration-75"
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
              className="absolute top-0 bottom-0 w-[2px] bg-primary playhead-glow"
              style={{ left: `${dragGuide.x}px` }}
            />

            {/* Target Voice Guide / Badge */}
            {dragGuide.voice && (
              <div
                className={`absolute px-2 py-0.5 rounded-none text-[10px] font-mono font-bold shadow-md transition-all ${
                  dragGuide.isOffStave
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-primary text-primary-foreground'
                }`}
                style={{
                  left: `${dragGuide.x + 8}px`,
                  top: `${Math.max(4, Math.min(height - 24, dragGuide.y - 12))}px`,
                }}
              >
                {dragGuide.isOffStave
                  ? 'Remove'
                  : `${dragGuide.timeLabel ? `${dragGuide.timeLabel} • ` : ''}${
                      DRUM_VOICE_PAS_MAP[dragGuide.voice]?.label || dragGuide.voice
                    }`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
