import React, { useState, useMemo } from 'react';
import {
  OrchestratedStroke,
  Dynamic,
  DrumVoice,
} from '../../domain/dawson/types';
import { IDrumKitPlayer } from '../../audio/types';
import { FormulaPaletteToolbar, EntryTool } from './FormulaPaletteToolbar';
import {
  PartitureFormulaCanvas,
  dynamicToVelocity,
  getSlotLabels,
  eventsFromStrokes,
  commitEvents,
  getEventIndexForTime,
} from './PartitureFormulaCanvas';
import { DRUM_VOICE_PAS_MAP } from '../../notation/DrumVoicePAS';
import { cn } from '../../lib/utils';
import { RotateCcw, Volume2 } from 'lucide-react';

export interface PartitureFormulaEditorProps {
  strokes: OrchestratedStroke[];
  onChangeStrokes: (strokes: OrchestratedStroke[]) => void;
  targetBeats?: number;
  player?: IDrumKitPlayer;
  width?: number;
  height?: number;
  readOnly?: boolean;
  playheadBeat?: number | null;
}

const PRIMARY_EDITOR_VOICES: Array<{ voice: DrumVoice; label: string; badge: string }> = [
  { voice: 'snare', label: 'Snare', badge: 'LH' },
  { voice: 'kick', label: 'Kick', badge: 'RF' },
  { voice: 'hihat_closed', label: 'Hi-Hat', badge: 'RH' },
  { voice: 'hihat_open', label: 'HH Open', badge: 'RH' },
  { voice: 'ride', label: 'Ride', badge: 'RH' },
  { voice: 'tom_high', label: 'High Tom', badge: 'RH' },
  { voice: 'tom_floor', label: 'Floor Tom', badge: 'RH' },
  { voice: 'crash', label: 'Crash', badge: 'RH' },
];

export function detectStrokeDuration(strokes: OrchestratedStroke[]): number {
  if (!strokes || strokes.length === 0) return 0.25;
  // If any stroke is a 16th triplet (sextuplet)
  if (strokes.some((s) => Math.abs(s.durationRatio - 1 / 6) < 0.02)) {
    return 1 / 6;
  }
  // If any stroke is an 8th triplet
  if (strokes.some((s) => Math.abs(s.durationRatio - 1 / 3) < 0.03)) {
    return 1 / 3;
  }
  // If any stroke is 32nd note
  if (strokes.some((s) => Math.abs(s.durationRatio - 0.125) < 0.02)) {
    return 0.125;
  }
  // If any stroke is 8th note
  if (strokes.some((s) => Math.abs(s.durationRatio - 0.5) < 0.05)) {
    return 0.5;
  }
  if (strokes.every((s) => Math.abs(s.durationRatio - 1.0) < 0.05)) {
    return 1.0;
  }
  return 0.25;
}

export const PartitureFormulaEditor: React.FC<PartitureFormulaEditorProps> = ({
  strokes,
  onChangeStrokes,
  targetBeats = 1.0,
  player,
  width = 560,
  height = 170,
  readOnly = false,
  playheadBeat = null,
}) => {
  const [activeTool, setActiveTool] = useState<EntryTool>('note');
  const [selectedDuration, setSelectedDuration] = useState<number>(() => detectStrokeDuration(strokes));
  const [selectedDynamic, setSelectedDynamic] = useState<Dynamic>('normal');
  const [activeVoice, setActiveVoice] = useState<DrumVoice>('snare');

  // Sync selectedDuration if formula strokes change externally with different duration
  const detectedDuration = useMemo(() => detectStrokeDuration(strokes), [strokes]);
  const prevDetectedRef = React.useRef(detectedDuration);
  React.useEffect(() => {
    if (detectedDuration !== prevDetectedRef.current) {
      prevDetectedRef.current = detectedDuration;
      setSelectedDuration(detectedDuration);
    }
  }, [detectedDuration]);

  // Calculate subdivision slot grid
  const slotDuration = selectedDuration > 0 ? selectedDuration : 0.25;
  const totalSlots = Math.max(1, Math.round(targetBeats / slotDuration));
  const slotLabels = useMemo(
    () => getSlotLabels(totalSlots, slotDuration, targetBeats),
    [totalSlots, slotDuration, targetBeats]
  );

  // The subdivision bar is a QUANTIZED DISPLAY over the continuous events
  // (docs/adr/0013): each step shows the event nearest its time within half a
  // grid step; the events themselves keep their exact fractional offsets.
  const currentSlots = useMemo(() => {
    const events = eventsFromStrokes(strokes, targetBeats);
    const halfGrid = slotDuration / 2;
    return Array.from({ length: totalSlots }, (_, s) => {
      const stepTime = Math.round(s * slotDuration * 1000) / 1000;
      const eventIndex = getEventIndexForTime(stepTime, events, halfGrid);
      const event = eventIndex >= 0 ? events[eventIndex] : null;
      return {
        slotIndex: s,
        beatOffset: stepTime,
        durationRatio: event ? event.durationRatio : slotDuration,
        hits: event && !event.isRest ? [...event.hits] : [],
        isRest: !event || event.isRest,
      };
    });
  }, [strokes, targetBeats, slotDuration]);

  // Handle slot step click from the subdivision bar: the Quantization Adapter
  // (docs/adr/0013) turns the step into a time, finds the event nearest it,
  // and creates a NEW event snapped to the step only when none is nearby.
  const handleToggleSlot = (slotIndex: number) => {
    if (readOnly) return;
    const workingEvents = eventsFromStrokes(strokes, targetBeats).map((event) => ({
      ...event,
      hits: [...event.hits],
    }));
    const stepTime = Math.round(slotIndex * slotDuration * 1000) / 1000;
    const halfGrid = slotDuration / 2;
    let targetIdx = getEventIndexForTime(stepTime, workingEvents, halfGrid);

    if (activeTool === 'eraser' || activeTool === 'rest') {
      if (targetIdx >= 0) {
        workingEvents[targetIdx].hits = [];
        workingEvents[targetIdx].isRest = true;
      }
      onChangeStrokes(commitEvents(workingEvents, targetBeats, true));
      return;
    }

    // Active tool === 'note': toggle activeVoice on the nearest event
    if (player) {
      player.triggerVoice(activeVoice, 0, dynamicToVelocity(selectedDynamic), 'orchestration');
    }

    let targetEvent = targetIdx >= 0 ? workingEvents[targetIdx] : null;
    if (!targetEvent) {
      targetEvent = {
        beatOffset: stepTime,
        durationRatio: slotDuration,
        hits: [],
        isRest: false,
      };
      workingEvents.push(targetEvent);
    }

    if (targetEvent.isRest || targetEvent.hits.length === 0) {
      targetEvent.hits = [{ voice: activeVoice, dynamic: selectedDynamic }];
      targetEvent.isRest = false;
    } else {
      const existingIdx = targetEvent.hits.findIndex((h) => h.voice === activeVoice);
      if (existingIdx >= 0) {
        if (targetEvent.hits.length > 1) {
          targetEvent.hits.splice(existingIdx, 1);
        } else {
          targetEvent.hits = [];
          targetEvent.isRest = true;
        }
      } else {
        targetEvent.hits.push({ voice: activeVoice, dynamic: selectedDynamic });
      }
    }

    onChangeStrokes(commitEvents(workingEvents, targetBeats, true));
  };

  const handleClearAll = () => {
    if (readOnly) return;
    onChangeStrokes([
      { durationRatio: targetBeats, isRest: true, hits: [] },
    ]);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Top Palette Toolbar */}
      <FormulaPaletteToolbar
        selectedDuration={selectedDuration}
        onSelectDuration={setSelectedDuration}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        selectedDynamic={selectedDynamic}
        onSelectDynamic={setSelectedDynamic}
        disabled={readOnly}
      />

      {/* Interactive 5-line PAS Percussion Canvas */}
      <PartitureFormulaCanvas
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        activeTool={activeTool}
        selectedDuration={selectedDuration}
        selectedDynamic={selectedDynamic}
        targetBeats={targetBeats}
        player={player}
        width={width}
        height={height}
        readOnly={readOnly}
        playheadBeat={playheadBeat}
      />

      {/* Interactive Subdivision Slot Grid Bar */}
      <div className="flex flex-col gap-2.5 p-3 rounded-none bg-card/90 border border-border/80 shadow-xs text-xs">
        {/* Voice Selector Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-primary" />
            <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Active Voice:
            </span>
            <span className="font-mono font-bold text-primary text-xs">
              {DRUM_VOICE_PAS_MAP[activeVoice]?.label || activeVoice}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {PRIMARY_EDITOR_VOICES.map(({ voice, label, badge }) => (
              <button
                key={voice}
                type="button"
                disabled={readOnly}
                draggable={!readOnly}
                onDragStart={(e) => {
                  const payload = JSON.stringify({
                    type: 'drum-voice',
                    voice,
                    dynamic: selectedDynamic,
                  });
                  e.dataTransfer.setData('application/json', payload);
                  e.dataTransfer.setData('text/plain', payload);
                }}
                onClick={() => {
                  setActiveVoice(voice);
                  if (player) {
                    player.triggerVoice(voice, 0, dynamicToVelocity(selectedDynamic), 'orchestration');
                  }
                }}
                className={cn(
                  'cursor-grab active:cursor-grabbing px-2 py-0.5 rounded-none text-[11px] font-medium transition-all flex items-center gap-1 border',
                  activeVoice === voice
                    ? 'bg-primary text-primary-foreground font-semibold border-primary shadow-xs'
                    : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/80'
                )}
                title={`Select or drag ${label} onto any slot on the staff`}
              >
                <span>{label}</span>
                <span className="text-[9px] opacity-75 font-mono">({badge})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Subdivision Step Buttons */}
        <div className="flex flex-col gap-1 pt-1.5 border-t border-border/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              Compass Subdivision Slots ({totalSlots} slots • {targetBeats} {targetBeats === 1.0 ? 'beat' : 'beats'}):
            </span>
            <button
              type="button"
              disabled={readOnly}
              onClick={handleClearAll}
              className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" /> Clear All
            </button>
          </div>

          <div
            className="grid gap-1.5 w-full select-none"
            style={{
              gridTemplateColumns: `repeat(${totalSlots}, minmax(0, 1fr))`,
            }}
          >
            {currentSlots.map((slot, s) => {
              const hits = slot.isRest ? [] : slot.hits || [];
              const hasActiveVoice = hits.some((h) => h.voice === activeVoice);
              const isBeatDownbeat = (s * slotDuration) % 1.0 < 0.01;
              const slotLabel = slotLabels[s] || `${s + 1}`;
              const targetOffset = slot.beatOffset;

              return (
                <button
                  key={s}
                  type="button"
                  data-testid={`slot-step-${s}`}
                  disabled={readOnly}
                  onClick={() => handleToggleSlot(s)}
                  className={cn(
                    'h-11 rounded-none border flex flex-col items-center justify-between p-1 transition-all text-[10px] font-mono',
                    hasActiveVoice
                      ? 'bg-primary border-primary text-primary-foreground font-bold shadow-xs scale-[1.02]'
                      : hits.length > 0
                      ? 'bg-secondary border-border text-secondary-foreground'
                      : isBeatDownbeat
                      ? 'bg-card border-border/80 text-foreground hover:bg-primary/10'
                      : 'bg-muted/30 border-border/40 text-muted-foreground hover:bg-primary/10'
                  )}
                  title={`Slot ${slotLabel} (offset ${targetOffset} beats)`}
                >
                  <span className="font-bold">{slotLabel}</span>
                  <div className="flex items-center gap-0.5 truncate max-w-full">
                    {hits.map((h, hIdx) => (
                      <span
                        key={hIdx}
                        className={cn(
                          'text-[8px] uppercase px-1 rounded-none font-bold',
                          h.voice === activeVoice
                            ? 'bg-primary/70 text-primary-foreground'
                            : 'bg-muted-foreground/40 text-muted-foreground'
                        )}
                      >
                        {h.voice.slice(0, 2)}
                      </span>
                    ))}
                    {hits.length === 0 && (
                      <span className="text-[9px] opacity-40">𝄽</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
