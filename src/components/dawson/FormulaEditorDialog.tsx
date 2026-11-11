import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  SubdivisionFormula,
  OrchestratedStroke,
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
  Trash2,
  X,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { PartitureFormulaEditor } from './PartitureFormulaEditor';
import { dynamicToVelocity } from './PartitureFormulaCanvas';

export interface FormulaEditorDialogProps {
  open: boolean;
  onClose: () => void;
  formula?: SubdivisionFormula | null;
  defaultTrigger?: 'short' | 'long';
  onSave: (formula: SubdivisionFormula) => void;
  onDelete?: (formulaId: string) => void;
  player?: IDrumKitPlayer;
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
  const [playheadBeat, setPlayheadBeat] = useState<number | null>(null);

  const auditionTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Initialize or reset state when dialog opens or formula changes
  useEffect(() => {
    if (formula) {
      setName(formula.name);
      setTrigger(formula.trigger);
      setDescription(formula.description || '');
      setStrokes(
        formula.strokes.map((s) => ({
          ...s,
          hits: s.hits ? [...s.hits] : [],
        }))
      );
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
    setPlayheadBeat(null);
    setIsAuditioning(false);
  }, [formula, defaultTrigger, open]);

  // Clean up any audition timers on unmount or close
  useEffect(() => {
    return () => {
      auditionTimersRef.current.forEach(clearTimeout);
      auditionTimersRef.current = [];
    };
  }, []);

  const totalDuration = useMemo(() => calculateFormulaDuration(strokes), [strokes]);
  const expectedDuration = trigger === 'short' ? 0.5 : 1.0;
  const isBudgetMatched = Math.abs(totalDuration - expectedDuration) < 0.01;
  const isOverBudget = totalDuration > expectedDuration + 0.01;
  const isUnderBudget = totalDuration < expectedDuration - 0.01;
  const budgetRatio = Math.min(1.0, Math.max(0, totalDuration / expectedDuration));

  if (!open) return null;

  const handleAuditionFormula = () => {
    if (!player || strokes.length === 0 || isAuditioning) return;

    // Clear any previous running timers
    auditionTimersRef.current.forEach(clearTimeout);
    auditionTimersRef.current = [];

    setIsAuditioning(true);
    setPlayheadBeat(0);

    const tempoBpm = 100;
    const beatDurationMs = (60 / tempoBpm) * 1000;
    const resolved = resolveStrokeOffsets(strokes, 0);
    const formulaDuration = Math.max(expectedDuration, totalDuration);
    const totalDurationMs = formulaDuration * beatDurationMs;

    // Schedule audio playback for each stroke and unison hits
    resolved.forEach(({ stroke, offset }) => {
      if (stroke.isRest || !stroke.hits || stroke.hits.length === 0) return;
      const delayMs = offset * beatDurationMs;

      if (delayMs <= 0) {
        stroke.hits.forEach((hit) => {
          const vel = dynamicToVelocity(hit.dynamic);
          player.triggerVoice(hit.voice, 0, vel, 'orchestration');
        });
      } else {
        const timer = setTimeout(() => {
          stroke.hits.forEach((hit) => {
            const vel = dynamicToVelocity(hit.dynamic);
            player.triggerVoice(hit.voice, 0, vel, 'orchestration');
          });
        }, delayMs);
        auditionTimersRef.current.push(timer);
      }
    });

    // Animate playhead scrubbing in steps (every ~20ms)
    const stepIntervalMs = 25;
    const totalSteps = Math.ceil(totalDurationMs / stepIntervalMs);
    let step = 0;

    const playheadInterval = setInterval(() => {
      step++;
      const currentProgress = Math.min(1.0, step / totalSteps);
      const currentBeat = currentProgress * formulaDuration;
      setPlayheadBeat(currentBeat);

      if (step >= totalSteps) {
        clearInterval(playheadInterval);
        setIsAuditioning(false);
        setPlayheadBeat(null);
      }
    }, stepIntervalMs);

    // Track interval for cleanup
    auditionTimersRef.current.push(playheadInterval as unknown as NodeJS.Timeout);
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="formula-editor-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in-0"
    >
      <div className="relative w-full max-w-4xl bg-card border border-border shadow-2xl rounded-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="formula-editor-title" className="text-base font-bold text-foreground flex items-center gap-2">
                Subdivision Formula Editor
                <Badge variant="outline" className="text-[10px] font-mono border-teal-500/30 text-teal-400">
                  Partiture Drum Staff
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                Compose multi-surface drum phrases and unisons on a standard 5-line percussion staff
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

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Metadata Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label htmlFor="formula-name-input" className="text-xs font-semibold text-foreground">
                Formula Name
              </label>
              <input
                id="formula-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tony Williams Triplet / Kick + Crash Downbeat"
                className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">Trigger Classification</label>
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
                  Short (&lt; 1 Beat)
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
                  Long (≥ 1 Beat)
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
              placeholder="e.g. Accented Bass Drum and Crash Cymbal unison followed by syncopated snare fill"
              className="bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Real-time Duration Budget Indicator */}
          <div
            data-testid="duration-budget-indicator"
            className="p-3.5 rounded-xl bg-card border border-border/80 shadow-sm flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Total Duration:</span>
                <span className="font-mono text-teal-400 font-bold">{totalDuration} beats</span>
                <span className="text-muted-foreground">
                  (target budget: {expectedDuration} {expectedDuration === 1.0 ? 'beat' : 'beats'})
                </span>
              </div>

              {isBudgetMatched && (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" /> Budget Balanced
                </Badge>
              )}
              {isUnderBudget && (
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 border-amber-500/30 text-amber-400 gap-1"
                >
                  <Info className="w-3 h-3" />
                  {Math.round((expectedDuration - totalDuration) * 1000) / 1000} beats remaining
                </Badge>
              )}
              {isOverBudget && (
                <Badge
                  variant="outline"
                  className="bg-rose-500/10 border-rose-500/30 text-rose-400 gap-1"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Overflow (+{Math.round((totalDuration - expectedDuration) * 1000) / 1000} beats)
                </Badge>
              )}
            </div>

            {/* Visual Budget Progress Bar */}
            <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden relative">
              <div
                className={cn(
                  'h-full transition-all duration-300 rounded-full',
                  isBudgetMatched
                    ? 'bg-emerald-500'
                    : isOverBudget
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
                )}
                style={{ width: `${Math.min(100, budgetRatio * 100)}%` }}
              />
            </div>
          </div>

          {/* Partiture Drum Staff Editor Canvas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                Percussion Staff & Note Entry Palette
              </h3>
              <span className="text-[11px] text-muted-foreground">
                Click lines to stamp notes or drag note tokens directly onto the stave
              </span>
            </div>

            <PartitureFormulaEditor
              key={formula?.id || `formula-${trigger}`}
              strokes={strokes}
              onChangeStrokes={setStrokes}
              targetBeats={expectedDuration}
              player={player}
              width={750}
              height={175}
              playheadBeat={playheadBeat}
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20 shrink-0">
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
              {isAuditioning ? 'Auditioning...' : 'Audition Formula'}
            </Button>
            {formula && formula.isCustom && onDelete && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="h-8 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white"
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
