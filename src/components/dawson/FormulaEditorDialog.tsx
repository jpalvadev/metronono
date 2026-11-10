import React, { useState, useEffect, useMemo } from 'react';
import {
  SubdivisionFormula,
  OrchestratedStroke,
  DrumVoice,
  Dynamic,
  DrumHit,
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

  useEffect(() => {
    if (formula) {
      setName(formula.name);
      setTrigger(formula.trigger);
      setDescription(formula.description || '');
      setStrokes(formula.strokes.map((s) => ({ ...s, hits: s.hits ? [...s.hits] : [] })));
    } else {
      setName(trigger === 'short' ? 'New Short Formula' : 'New Long Formula');
      setTrigger(defaultTrigger);
      setDescription('');
      setStrokes([
        {
          durationRatio: defaultTrigger === 'short' ? 0.5 : 1.0,
          hits: [
            {
              voice: defaultTrigger === 'short' ? 'snare' : 'kick',
              dynamic: 'normal',
            },
          ],
        },
      ]);
    }
  }, [formula, defaultTrigger, open]);

  const totalDuration = useMemo(() => calculateFormulaDuration(strokes), [strokes]);

  if (!open) return null;

  const handleAddStroke = () => {
    const defaultRatio = 0.25;
    const defaultVoice: DrumVoice = trigger === 'short' ? 'snare' : 'kick';

    setStrokes((prev) => [
      ...prev,
      {
        durationRatio: defaultRatio,
        hits: [
          {
            voice: defaultVoice,
            dynamic: 'normal',
          },
        ],
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

  const handleUpdateHit = (index: number, updates: Partial<DrumHit>) => {
    setStrokes((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const currentHit =
          s.hits && s.hits.length > 0
            ? s.hits[0]
            : { voice: 'snare' as DrumVoice, dynamic: 'normal' as Dynamic };
        return {
          ...s,
          hits: [{ ...currentHit, ...updates }],
        };
      })
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
    if (!player || stroke.isRest || !stroke.hits) return;
    stroke.hits.forEach((hit) => {
      const vel = dynamicToVelocity(hit.dynamic);
      player.triggerVoice(hit.voice, 0, vel, 'orchestration');
    });
  };

  const handleAuditionFormula = () => {
    if (!player || strokes.length === 0 || isAuditioning) return;
    setIsAuditioning(true);

    const tempoBpm = 100;
    const beatDurationMs = (60 / tempoBpm) * 1000;
    const resolved = resolveStrokeOffsets(strokes, 0);

    let maxDelay = 0;
    resolved.forEach(({ stroke, offset }) => {
      if (stroke.isRest || !stroke.hits) return;
      const delayMs = offset * beatDurationMs;
      if (delayMs > maxDelay) maxDelay = delayMs;
      stroke.hits.forEach((hit) => {
        const vel = dynamicToVelocity(hit.dynamic);
        if (delayMs <= 0) {
          player.triggerVoice(hit.voice, 0, vel, 'orchestration');
        } else {
          setTimeout(() => {
            player.triggerVoice(hit.voice, 0, vel, 'orchestration');
          }, delayMs);
        }
      });
    });

    setTimeout(() => {
      setIsAuditioning(false);
    }, maxDelay + 250);
  };

  const handleSave = () => {
    if (strokes.length === 0) return;
    const formulaId =
      formula?.id ||
      `formula_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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
    if (formula && formula.isCustom && onDelete) {
      onDelete(formula.id);
      onClose();
    }
  };

  const expectedDuration = trigger === 'short' ? 0.5 : 1.0;
  const isBudgetMatched = Math.abs(totalDuration - expectedDuration) < 0.01;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="formula-editor-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
    >
      <div className="relative w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 id="formula-editor-title" className="text-sm font-bold text-foreground">
                Subdivision Formula Editor
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Define phrases, rudiments, and custom substitutions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Metadata Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="formula-name-input" className="text-xs font-semibold text-foreground">
                Formula Name
              </label>
              <input
                id="formula-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tony Williams Triplet"
                className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                Trigger Classification
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTrigger('short')}
                  className={cn(
                    'py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all text-center',
                    trigger === 'short'
                      ? 'bg-teal-500/20 border-teal-500 text-teal-300 ring-1 ring-teal-500/40'
                      : 'bg-muted/30 border-border/70 text-muted-foreground hover:bg-muted/60'
                  )}
                >
                  Short Note (&lt; 1 Beat)
                </button>
                <button
                  type="button"
                  onClick={() => setTrigger('long')}
                  className={cn(
                    'py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all text-center',
                    trigger === 'long'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-1 ring-rose-500/40'
                      : 'bg-muted/30 border-border/70 text-muted-foreground hover:bg-muted/60'
                  )}
                >
                  Long Note (≥ 1 Beat)
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="formula-desc-input" className="text-xs font-semibold text-foreground">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="formula-desc-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Explosive linear fill on the snare and high tom"
              className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Duration Budget Banner */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Total Duration:</span>
              <span className="font-mono text-teal-400 font-bold">{totalDuration} beats</span>
              <span className="text-muted-foreground">
                (target: {expectedDuration} {expectedDuration === 1.0 ? 'beat' : 'beats'})
              </span>
            </div>
            {isBudgetMatched ? (
              <Badge variant="outline" className="text-[11px] bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                Budget Balanced
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[11px] bg-amber-500/10 border-amber-500/30 text-amber-400">
                Duration Mismatch
              </Badge>
            )}
          </div>

          {/* Stroke Sequence Builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Sub-beat Strokes ({strokes.length})
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Ordered sequence of sounding hits and articulations
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAddStroke}
                className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Stroke
              </Button>
            </div>

            <div className="space-y-2.5">
              {strokes.map((stroke, index) => {
                const primaryHit =
                  stroke.hits && stroke.hits.length > 0
                    ? stroke.hits[0]
                    : { voice: 'snare' as DrumVoice, dynamic: 'normal' as Dynamic };
                return (
                  <div
                    key={index}
                    data-testid={`stroke-item-${index}`}
                    className="p-3 rounded-xl bg-card border border-border/80 shadow-sm flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center font-mono text-[10px] font-bold">
                          {index + 1}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          Stroke #{index + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          data-testid={`audition-stroke-${index}`}
                          onClick={() => handleAuditionStroke(stroke)}
                          title="Audition Stroke"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-teal-400 hover:bg-muted/50 transition-colors"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveStroke(index, 'up')}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === strokes.length - 1}
                          onClick={() => handleMoveStroke(index, 'down')}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete stroke ${index + 1}`}
                          onClick={() => handleRemoveStroke(index)}
                          title="Remove Stroke"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stroke Form Grid: Voice, Dynamic, Duration */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {/* Voice Selector */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Drum Voice
                        </span>
                        <select
                          value={primaryHit.voice}
                          aria-label={`Stroke ${index + 1} voice`}
                          onChange={(e) =>
                            handleUpdateHit(index, {
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
                                handleUpdateHit(index, { dynamic: d.id })
                              }
                              className={cn(
                                'px-2 py-1 rounded text-[10px] font-medium border shrink-0 transition-colors',
                                primaryHit.dynamic === d.id
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
                        <div className="grid grid-cols-3 gap-1">
                          {PRESET_DURATIONS.map((dur) => (
                            <button
                              key={dur.label}
                              type="button"
                              onClick={() =>
                                handleUpdateStroke(index, {
                                  durationRatio: dur.ratio,
                                })
                              }
                              className={cn(
                                'py-1 rounded font-mono text-[11px] border transition-colors',
                                Math.abs(stroke.durationRatio - dur.ratio) < 0.001
                                  ? 'bg-teal-500/20 border-teal-500 text-teal-300 ring-1 ring-teal-500/40'
                                  : 'bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/60'
                              )}
                            >
                              {dur.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAuditionFormula}
              disabled={isAuditioning || strokes.length === 0}
              className="text-xs border-teal-500/30 text-teal-400 hover:bg-teal-500/10 gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isAuditioning ? 'Playing...' : 'Audition Formula'}
            </Button>
            {formula && formula.isCustom && onDelete && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="h-9 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Formula
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={strokes.length === 0}
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold"
            >
              Save Formula
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
