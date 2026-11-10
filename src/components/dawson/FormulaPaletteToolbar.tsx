import React from 'react';
import { Dynamic } from '../../domain/dawson/types';
import { cn } from '../../lib/utils';
import { Eraser, Music, PauseCircle } from 'lucide-react';

export type EntryTool = 'note' | 'rest' | 'eraser';

export interface PaletteDuration {
  id: string;
  label: string;
  ratio: number;
}

export const PALETTE_DURATIONS: PaletteDuration[] = [
  { id: '1/4', label: '1/4', ratio: 1.0 },
  { id: '1/8', label: '1/8', ratio: 0.5 },
  { id: '1/8_t', label: '1/8 T', ratio: 1 / 3 },
  { id: '1/16', label: '1/16', ratio: 0.25 },
  { id: '1/16_t', label: '1/16 T', ratio: 1 / 6 },
  { id: '1/32', label: '1/32', ratio: 0.125 },
];

export interface PaletteArticulation {
  id: Dynamic;
  label: string;
  symbol: string;
}

export const PALETTE_ARTICULATIONS: PaletteArticulation[] = [
  { id: 'normal', label: 'Normal', symbol: '●' },
  { id: 'accent', label: 'Accent', symbol: '>' },
  { id: 'ghost', label: 'Ghost', symbol: '( )' },
  { id: 'flam', label: 'Flam', symbol: '𝄡' },
  { id: 'drag', label: 'Drag', symbol: '𝄢' },
];

export interface FormulaPaletteToolbarProps {
  selectedDuration: number;
  onSelectDuration: (ratio: number) => void;
  activeTool: EntryTool;
  onSelectTool: (tool: EntryTool) => void;
  selectedDynamic: Dynamic;
  onSelectDynamic: (dynamic: Dynamic) => void;
  disabled?: boolean;
}

export const FormulaPaletteToolbar: React.FC<FormulaPaletteToolbarProps> = ({
  selectedDuration,
  onSelectDuration,
  activeTool,
  onSelectTool,
  selectedDynamic,
  onSelectDynamic,
  disabled = false,
}) => {
  return (
    <div
      role="toolbar"
      aria-label="Formula Notation Palette"
      className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-card/90 border border-border/80 shadow-sm text-xs"
    >
      {/* Tool Mode Selector: Note / Rest / Eraser */}
      <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectTool('note')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs transition-colors',
            activeTool === 'note'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50 shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <Music className="w-3.5 h-3.5" /> Note
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectTool('rest')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs transition-colors',
            activeTool === 'rest'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <PauseCircle className="w-3.5 h-3.5" /> Rest
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelectTool('eraser')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs transition-colors',
            activeTool === 'eraser'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <Eraser className="w-3.5 h-3.5" /> Eraser
        </button>
      </div>

      {/* Duration Selector */}
      <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
        {PALETTE_DURATIONS.map((dur) => {
          const isSelected = Math.abs(selectedDuration - dur.ratio) < 0.005;
          return (
            <button
              key={dur.id}
              type="button"
              disabled={disabled || activeTool === 'eraser'}
              onClick={() => onSelectDuration(dur.ratio)}
              className={cn(
                'px-2 py-1 rounded-md font-mono text-[11px] font-semibold transition-colors',
                isSelected
                  ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-40'
              )}
            >
              {dur.label}
            </button>
          );
        })}
      </div>

      {/* Articulations Selector */}
      <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
        {PALETTE_ARTICULATIONS.map((art) => {
          const isSelected = selectedDynamic === art.id;
          return (
            <button
              key={art.id}
              type="button"
              disabled={disabled || activeTool !== 'note'}
              onClick={() => onSelectDynamic(art.id)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
                isSelected && activeTool === 'note'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50 shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-40'
              )}
            >
              <span className="font-mono text-teal-400">{art.symbol}</span>
              <span>{art.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
