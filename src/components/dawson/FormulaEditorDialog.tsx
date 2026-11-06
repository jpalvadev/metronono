import React, { useState, useEffect, useMemo } from 'react';
import {
  SubdivisionFormula,
  OrchestratedStroke,
  DrumVoice,
  Limb,
  Dynamic,
} from '../../domain/dawson/types';
import {
  calculateFormulaDuration,
  resolveStrokeOffsets,
} from '../../domain/dawson/SubdivisionFormula';
import { IDrumKitPlayer } from '../../audio/types';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Play,
  Plus,
  Trash2,
  X,
  Volume2,
  ChevronUp,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FormulaEditorDialogProps {
  open: boolean;
  onClose: () => void;
  formula?: SubdivisionFormula | null;
  defaultTrigger?: 'short' | 'long';
  onSave: (formula: SubdivisionFormula) => void;
  onDelete?: (formulaId: string) => void;
  player?: IDrumKitPlayer;
}

const VOICES: Array<{ id: DrumVoice; label: string }> = [
  { id: 'snare', label: 'Snare' },
  { id: 'kick', label: 'Kick' },
  { id: 'tom_high', label: 'Tom 1 (High)' },
  { id: 'tom_mid', label: 'Tom 2 (Mid)' },
  { id: 'tom_floor', label: 'Floor Tom' },
  { id: 'ride', label: 'Ride Cymbal' },
  { id: 'ride_bell', label: 'Ride Bell' },
  { id: 'hihat_closed', label: 'Hi-Hat Closed' },
  { id: 'hihat_open', label: 'Hi-Hat Open' },
  { id: 'hihat_foot', label: 'Hi-Hat Foot' },
  { id: 'crash', label: 'Crash Cymbal' },
  { id: 'snare_ghost', label: 'Snare (Ghost)' },
];

const LIMBS: Array<{ id: Limb; label: string; desc: string }> = [
  { id: 'R', label: 'R', desc: 'Right Hand' },
  { id: 'L', label: 'L', desc: 'Left Hand' },
  { id: 'RF', label: 'RF', desc: 'Right Foot (Kick)' },
  { id: 'LF', label: 'LF', desc: 'Left Foot (Hi-Hat)' },
];

const DYNAMICS: Array<{ id: Dynamic; label: string; velocity: number }> = [
  { id: 'accent', label: 'Accent', velocity: 1.0 },
  { id: 'normal', label: 'Normal', velocity: 0.8 },
  { id: 'ghost', label: 'Ghost', velocity: 0.4 },
  { id: 'flam', label: 'Flam', velocity: 0.9 },
  { id: 'drag', label: 'Drag', velocity: 0.75 },
];

const PRESET_DURATIONS: Array<{ label: string; ratio: number }> = [
  { label: '1/4', ratio: 1.0 },
  { label: '1/8', ratio: 0.5 },
  { label: '1/8 T', ratio: 1 / 3 },
  { label: '1/16', ratio: 0.25 },
  { label: '1/16 T', ratio: 1 / 6 },
  { label: '1/32', ratio: 0.125 },
];

function dynamicToVelocity(dynamic: Dynamic): number {
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

export const FormulaEditorDialog: React.FC<FormulaEditorDialogProps> = ({
  open,
  onClose,
  formula,
  defaultTrigger = 'short',
  onSave,
  onDelete,
  player,
}) => {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<'short' | 'long'>(defaultTrigger);
  const [description, setDescription] = useState('');
  const [strokes, setStrokes] = useState<OrchestratedStroke[]>([]);
  const [isAuditioning, setIsAuditioning] = useState(false);

  // Initialize form when opening or formula changes
  useEffect(() => {
    if (formula) {
      setName(formula.name);
      setTrigger(formula.trigger);
      setDescription(formula.description || '');
      setStrokes(formula.strokes.map((s) => ({ ...s })));
    } else {
      setName(trigger === 'short' ? 'New Short Formula' : 'New Long Formula');
      setTrigger(defaultTrigger);
      setDescription('');
      setStrokes([
        {
          durationRatio: defaultTrigger === 'short' ? 0.5 : 1.0,
          voice: defaultTrigger === 'short' ? 'snare' : 'kick',
          limb: defaultTrigger === 'short' ? 'L' : 'RF',
          dynamic: 'normal',
        },
      ]);
    }
  }, [formula, defaultTrigger, open]);

  const totalDuration = useMemo(() => calculateFormulaDuration(strokes), [strokes]);

  if (!open) return null;

  const handleAddStroke = () => {
    const defaultRatio = trigger === 'short' ? 0.25 : 0.25;
    const defaultVoice: DrumVoice = trigger === 'short' ? 'snare' : 'kick';
    const defaultLimb: Limb = trigger === 'short' ? 'L' : 'RF';

    setStrokes((prev) => [
      ...prev,
      {
        durationRatio: defaultRatio,
        voice: defaultVoice,
        limb: defaultLimb,
        dynamic: 'normal',
      },
    ]);
  };

  const handleRemoveStroke = (index: number) => {
    setStrokes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateStroke = (index: number, updates: Partial<OrchestratedStroke>) => {
    setStrokes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...updates } : s))
    );
  };

  const handleMoveStroke = (index: number, direction: 'up' | 'down') => {
    setStrokes((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleAuditionStroke = (stroke: OrchestratedStroke) => {
    if (!player) return;
    const vel = dynamicToVelocity(stroke.dynamic);
    player.triggerVoice(stroke.voice, 0, vel, 'orchestration');
  };

  const handleAuditionFormula = () => {
    if (!player || strokes.length === 0 || isAuditioning) return;
    setIsAuditioning(true);

    const tempoBpm = 100;
    const beatDurationMs = (60 / tempoBpm) * 1000;
    const resolved = resolveStrokeOffsets(strokes, 0);

    let maxDelay = 0;
    resolved.forEach(({ stroke, offset }) => {
      const delayMs = offset * beatDurationMs;
      if (delayMs > maxDelay) maxDelay = delayMs;
      const vel = dynamicToVelocity(stroke.dynamic);
      if (delayMs <= 0) {
        player.triggerVoice(stroke.voice, 0, vel, 'orchestration');
      } else {
        setTimeout(() => {
          player.triggerVoice(stroke.voice, 0, vel, 'orchestration');
        }, delayMs);
      }
    });

    setTimeout(() => {
      setIsAuditioning(false);
    }, maxDelay + 250);
  };

  const handleSave = () => {
    if (strokes.length === 0) return;
    const formulaId = formula?.id || `formula_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const updatedFormula: SubdivisionFormula = {
      id: formulaId,
      name: name.trim() || 'Custom Formula',
      trigger,
      description: description.trim() || undefined,
      strokes,
      isCustom: true,
    };
    onSave(updatedFormula);
    onClose();
  };

  const handleDelete = () => {
    if (formula?.id && onDelete) {
      onDelete(formula.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Dialog Header */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Subdivision Formula Editor
              </h2>
              <p className="text-xs text-muted-foreground">
                Define multi-limb linear phrases, rudiments, and custom substitutions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dialog Body (Scrollable) */}
        <div className="p-4 md:p-6 overflow-y-auto flex flex-col gap-5">
          {/* Formula Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border/60">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground/80">
                Formula Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tony Williams F-L-R Triplet"
                className="bg-card border border-border/80 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              />
            </div>

            {/* Trigger Target */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground/80">
                Trigger On
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTrigger('short')}
                  className={cn(
                    'py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all',
                    trigger === 'short'
                      ? 'bg-teal-500/15 border-teal-500 text-teal-400 font-semibold ring-1 ring-teal-500/30'
                      : 'bg-card border-border/70 text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  Short Note (≤ 8th)
                </button>
                <button
                  type="button"
                  onClick={() => setTrigger('long')}
                  className={cn(
                    'py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all',
                    trigger === 'long'
                      ? 'bg-teal-500/15 border-teal-500 text-teal-400 font-semibold ring-1 ring-teal-500/30'
                      : 'bg-card border-border/70 text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  Long Note (≥ Qtr / Ties)
                </button>
              </div>
            </div>
          </div>

          {/* Stroke Builder Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                Formula Strokes ({strokes.length})
              </span>
              <Badge variant="outline" className="font-mono text-[11px] border-teal-500/30 text-teal-400">
                Total Duration: {totalDuration} beats
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAuditionFormula}
                disabled={isAuditioning || strokes.length === 0}
                className="h-8 gap-1.5 text-xs border-teal-500/40 text-teal-400 hover:bg-teal-500/10"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {isAuditioning ? 'Playing...' : 'Audition Formula'}
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleAddStroke}
                className="h-8 gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Stroke
              </Button>
            </div>
          </div>

          {/* Stroke List */}
          <div className="flex flex-col gap-3">
            {strokes.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border/80 rounded-xl">
                <p className="text-sm text-muted-foreground">
                  No strokes in this formula. Click "Add Stroke" to create one.
                </p>
              </div>
            ) : (
              strokes.map((stroke, index) => (
                <div
                  key={index}
                  data-testid={`stroke-item-${index}`}
                  className="bg-card/90 border border-border/80 rounded-xl p-3 md:p-4 flex flex-col gap-3 shadow-xs"
                >
                  {/* Stroke Header: Index, Audition, Ordering, Delete */}
                  <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-teal-500/15 text-teal-400 font-mono text-xs font-bold flex items-center justify-center border border-teal-500/30">
                        #{index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid={`audition-stroke-${index}`}
                        aria-label={`Audition stroke ${index + 1}`}
                        onClick={() => handleAuditionStroke(stroke)}
                        className="h-7 px-2 text-xs text-teal-400 hover:bg-teal-500/10 gap-1"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        Audition
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={index === 0}
                        onClick={() => handleMoveStroke(index, 'up')}
                        aria-label={`Move stroke ${index + 1} up`}
                        className="w-7 h-7 p-0"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={index === strokes.length - 1}
                        onClick={() => handleMoveStroke(index, 'down')}
                        aria-label={`Move stroke ${index + 1} down`}
                        className="w-7 h-7 p-0"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveStroke(index)}
                        aria-label={`Delete stroke ${index + 1}`}
                        className="w-7 h-7 p-0 text-rose-400 hover:bg-rose-500/10 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Stroke Form Grid: Voice, Limb, Dynamic, Duration */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {/* Voice Selector */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Drum Voice
                      </span>
                      <select
                        value={stroke.voice}
                        aria-label={`Stroke ${index + 1} voice`}
                        onChange={(e) =>
                          handleUpdateStroke(index, {
                            voice: e.target.value as DrumVoice,
                          })
                        }
                        className="bg-muted/40 border border-border/80 rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        {VOICES.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Limb Selector */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Physical Limb
                      </span>
                      <div className="grid grid-cols-4 gap-1">
                        {LIMBS.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            data-testid={`stroke-${index}-limb-${l.id}`}
                            title={l.desc}
                            onClick={() =>
                              handleUpdateStroke(index, { limb: l.id })
                            }
                            className={cn(
                              'py-1 rounded font-mono font-semibold text-[11px] border transition-colors',
                              stroke.limb === l.id
                                ? 'bg-teal-500/20 border-teal-500 text-teal-300 ring-1 ring-teal-500/40'
                                : 'bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/60'
                            )}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dynamic Selector */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        Dynamic Articulation
                      </span>
                      <div className="flex items-center gap-1 overflow-x-auto">
                        {DYNAMICS.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            data-testid={`stroke-${index}-dynamic-${d.id}`}
                            onClick={() =>
                              handleUpdateStroke(index, { dynamic: d.id })
                            }
                            className={cn(
                              'px-2 py-1 rounded text-[10px] font-medium border shrink-0 transition-colors',
                              stroke.dynamic === d.id
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/40'
                                : 'bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/60'
                            )}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration Ratio Selector */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Duration Ratio
                        </span>
                        <span className="font-mono text-[10px] text-teal-400">
                          {Math.round(stroke.durationRatio * 1000) / 1000}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {PRESET_DURATIONS.map((p) => {
                          const isActive =
                            Math.abs(stroke.durationRatio - p.ratio) < 0.005;
                          return (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() =>
                                handleUpdateStroke(index, {
                                  durationRatio: p.ratio,
                                })
                              }
                              className={cn(
                                'flex-1 py-1 rounded font-mono text-[10px] border transition-colors',
                                isActive
                                  ? 'bg-teal-500/20 border-teal-500 text-teal-300 ring-1 ring-teal-500/30'
                                  : 'bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/60'
                              )}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dialog Footer */}
        <div className="flex items-center justify-between p-4 md:p-5 border-t border-border/60 bg-muted/10">
          <div>
            {formula?.isCustom && onDelete && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="h-9 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white"
              >
                Delete Formula
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 px-3.5 text-xs border-border"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={strokes.length === 0}
              className="h-9 px-4 text-xs bg-teal-600 hover:bg-teal-700 text-white"
            >
              Save Formula
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
