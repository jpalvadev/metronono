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
} from './PartitureFormulaCanvas';
import { resolveStrokeOffsets } from '../../domain/dawson/SubdivisionFormula';
import { DRUM_VOICE_PAS_MAP } from '../../notation/DrumStaffRenderer';
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
  const [selectedDuration, setSelectedDuration] = useState<number>(0.25);
  const [selectedDynamic, setSelectedDynamic] = useState<Dynamic>('normal');
  const [activeVoice, setActiveVoice] = useState<DrumVoice>('snare');

  // Calculate subdivision slot grid
  const slotDuration = selectedDuration > 0 ? selectedDuration : 0.25;
  const totalSlots = Math.max(1, Math.round(targetBeats / slotDuration));
  const slotLabels = useMemo(
    () => getSlotLabels(totalSlots, slotDuration, targetBeats),
    [totalSlots, slotDuration, targetBeats]
  );

  const resolved = useMemo(() => resolveStrokeOffsets(strokes, 0), [strokes]);

  // Handle slot step click from the subdivision bar
  const handleToggleSlot = (slotIndex: number) => {
    if (readOnly) return;
    const targetOffset = Math.round(slotIndex * slotDuration * 1000) / 1000;

    let strokeIndex = -1;
    for (let i = 0; i < resolved.length; i++) {
      const { stroke, offset } = resolved[i];
      if (
        Math.abs(offset - targetOffset) < 0.05 ||
        (targetOffset >= offset - 0.02 && targetOffset < offset + stroke.durationRatio - 0.02)
      ) {
        strokeIndex = i;
        break;
      }
    }

    if (activeTool === 'eraser') {
      if (strokeIndex !== -1) {
        const next = strokes.map((s, i) =>
          i === strokeIndex ? { ...s, isRest: true, hits: [] } : s
        );
        onChangeStrokes(next);
      }
      return;
    }

    if (activeTool === 'rest') {
      if (strokeIndex !== -1) {
        const next = strokes.map((s, i) =>
          i === strokeIndex ? { durationRatio: slotDuration, isRest: true, hits: [] } : s
        );
        onChangeStrokes(next);
      } else {
        onChangeStrokes([
          ...strokes,
          { durationRatio: slotDuration, isRest: true, hits: [] },
        ]);
      }
      return;
    }

    // Active tool === 'note': toggle activeVoice on this slot
    if (player) {
      player.triggerVoice(activeVoice, 0, dynamicToVelocity(selectedDynamic), 'orchestration');
    }

    if (strokeIndex !== -1) {
      const stroke = strokes[strokeIndex];
      let hits = stroke.hits ? [...stroke.hits] : [];

      if (stroke.isRest || hits.length === 0) {
        hits = [{ voice: activeVoice, dynamic: selectedDynamic }];
      } else {
        const existingIdx = hits.findIndex((h) => h.voice === activeVoice);
        if (existingIdx >= 0) {
          if (hits.length > 1) {
            hits.splice(existingIdx, 1);
          } else {
            hits = [];
          }
        } else {
          hits.push({ voice: activeVoice, dynamic: selectedDynamic });
        }
      }

      const next = strokes.map((s, i) =>
        i === strokeIndex ? { ...s, isRest: hits.length === 0, hits } : s
      );
      onChangeStrokes(next);
    } else {
      if (strokes.length === 0 && slotIndex === 0) {
        onChangeStrokes([
          {
            durationRatio: slotDuration,
            isRest: false,
            hits: [{ voice: activeVoice, dynamic: selectedDynamic }],
          },
        ]);
      } else if (slotIndex > 0 && strokes.length === 0) {
        onChangeStrokes([
          { durationRatio: targetOffset, isRest: true, hits: [] },
          {
            durationRatio: slotDuration,
            isRest: false,
            hits: [{ voice: activeVoice, dynamic: selectedDynamic }],
          },
        ]);
      } else {
        onChangeStrokes([
          ...strokes,
          {
            durationRatio: slotDuration,
            isRest: false,
            hits: [{ voice: activeVoice, dynamic: selectedDynamic }],
          },
        ]);
      }
    }
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
      <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-card/90 border border-border/80 shadow-xs text-xs">
        {/* Voice Selector Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-teal-400" />
            <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Active Voice:
            </span>
            <span className="font-mono font-bold text-teal-400 text-xs">
              {DRUM_VOICE_PAS_MAP[activeVoice]?.label || activeVoice}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {PRIMARY_EDITOR_VOICES.map(({ voice, label, badge }) => (
              <button
                key={voice}
                type="button"
                disabled={readOnly}
                onClick={() => {
                  setActiveVoice(voice);
                  if (player) {
                    player.triggerVoice(voice, 0, dynamicToVelocity(selectedDynamic), 'orchestration');
                  }
                }}
                className={cn(
                  'px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 border',
                  activeVoice === voice
                    ? 'bg-teal-600 text-white font-semibold border-teal-500 shadow-xs'
                    : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/80'
                )}
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
              className="text-[10px] text-muted-foreground hover:text-rose-400 flex items-center gap-1 transition-colors"
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
            {Array.from({ length: totalSlots }).map((_, s) => {
              const targetOffset = Math.round(s * slotDuration * 1000) / 1000;
              const matching = resolved.find(
                (r) =>
                  Math.abs(r.offset - targetOffset) < 0.05 ||
                  (targetOffset >= r.offset - 0.02 &&
                    targetOffset < r.offset + r.stroke.durationRatio - 0.02)
              );

              const hits = matching?.stroke?.hits || [];
              const hasActiveVoice = hits.some((h) => h.voice === activeVoice);
              const isBeatDownbeat = (s * slotDuration) % 1.0 < 0.01;
              const slotLabel = slotLabels[s] || `${s + 1}`;

              return (
                <button
                  key={s}
                  type="button"
                  data-testid={`slot-step-${s}`}
                  disabled={readOnly}
                  onClick={() => handleToggleSlot(s)}
                  className={cn(
                    'h-11 rounded-lg border flex flex-col items-center justify-between p-1 transition-all text-[10px] font-mono',
                    hasActiveVoice
                      ? 'bg-teal-600 border-teal-500 text-white font-bold shadow-xs scale-[1.02]'
                      : hits.length > 0
                      ? 'bg-purple-950/40 border-purple-500/50 text-purple-200'
                      : isBeatDownbeat
                      ? 'bg-card border-border/80 text-foreground hover:bg-teal-500/10'
                      : 'bg-muted/30 border-border/40 text-muted-foreground hover:bg-teal-500/10'
                  )}
                  title={`Slot ${slotLabel} (offset ${targetOffset} beats)`}
                >
                  <span className="font-bold">{slotLabel}</span>
                  <div className="flex items-center gap-0.5 truncate max-w-full">
                    {hits.map((h, hIdx) => (
                      <span
                        key={hIdx}
                        className={cn(
                          'text-[8px] uppercase px-1 rounded font-bold',
                          h.voice === activeVoice
                            ? 'bg-teal-900/60 text-white'
                            : 'bg-purple-800/60 text-purple-100'
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
