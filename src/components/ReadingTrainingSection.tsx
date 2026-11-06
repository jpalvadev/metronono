import React, { useState, useMemo, useCallback } from 'react';
import { ReadingLine } from '../domain/rhythm/types';
import { ProceduralGenerator } from '../domain/rhythm/ProceduralGenerator';
import {
  REED_PAGE_37_EXERCISE_ONE,
  REED_PAGE_38_EXERCISE_TWO,
  getReedExercise,
} from '../domain/rhythm/ReedLibrary';
import { ReadingView } from './notation/ReadingView';
import { ToneTransportScheduler } from '../audio/ToneTransportScheduler';
import { Button } from './ui/button';
import { Wand2, BookOpen, RotateCw, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

export type ReadingMode = 'generator' | 'library';

export interface ReadingTrainingSectionProps {
  scheduler?: ToneTransportScheduler;
  className?: string;
}

export const ReadingTrainingSection: React.FC<ReadingTrainingSectionProps> = ({
  scheduler,
  className,
}) => {
  const [mode, setMode] = useState<ReadingMode>('generator');

  // Generator settings
  const [tier, setTier] = useState<1 | 2 | 3>(1);
  const [measureCount, setMeasureCount] = useState<number>(4);
  const [genSeed, setGenSeed] = useState<number>(() => Math.floor(Math.random() * 100000));

  // Library settings
  const [selectedPage, setSelectedPage] = useState<number>(37);
  const [selectedExerciseNum, setSelectedExerciseNum] = useState<number>(1);

  // Procedural Reading Line
  const proceduralLine = useMemo(() => {
    const generator = new ProceduralGenerator({ tier, seed: genSeed });
    return generator.generateReadingLine({
      id: `proc-tier${tier}-${genSeed}`,
      title: `Procedural Syncopation (Tier ${tier})`,
      measureCount,
      tier,
    });
  }, [tier, measureCount, genSeed]);

  // Library Reading Line
  const libraryLine = useMemo<ReadingLine>(() => {
    if (selectedPage === 37) {
      return REED_PAGE_37_EXERCISE_ONE;
    }
    if (selectedPage === 38) {
      return REED_PAGE_38_EXERCISE_TWO;
    }
    const exercise = getReedExercise(selectedPage, selectedExerciseNum);
    return exercise ?? REED_PAGE_37_EXERCISE_ONE;
  }, [selectedPage, selectedExerciseNum]);

  const activeLine = mode === 'generator' ? proceduralLine : libraryLine;

  const handleRegenerate = useCallback(() => {
    setGenSeed(Math.floor(Math.random() * 1000000));
  }, []);

  return (
    <div className={cn('w-full flex flex-col gap-4', className)}>
      {/* Top Section Header & Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/60 backdrop-blur border border-border/70 rounded-2xl p-3 md:p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            {mode === 'generator' ? <Wand2 className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">
              Single-Line Reading Training
            </h3>
            <p className="text-xs text-muted-foreground">
              Ted Reed style rhythmic melodies with real-time playhead
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60 self-start sm:self-auto">
          <Button
            variant={mode === 'generator' ? 'default' : 'ghost'}
            size="sm"
            className={cn(
              'h-7 px-3 text-xs gap-1.5 font-medium transition-all',
              mode === 'generator' && 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
            )}
            onClick={() => setMode('generator')}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Procedural Generator
          </Button>
          <Button
            variant={mode === 'library' ? 'default' : 'ghost'}
            size="sm"
            className={cn(
              'h-7 px-3 text-xs gap-1.5 font-medium transition-all',
              mode === 'library' && 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
            )}
            onClick={() => setMode('library')}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Ted Reed Library
          </Button>
        </div>
      </div>

      {/* Mode Controls Bar */}
      {mode === 'generator' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card/40 border border-border/50 rounded-xl p-3">
          {/* Difficulty Tier Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Difficulty:</span>
            <div className="flex items-center gap-1">
              <Button
                variant={tier === 1 ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'h-7 px-2.5 text-xs',
                  tier === 1 && 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/40 font-semibold'
                )}
                onClick={() => setTier(1)}
              >
                Tier 1 (Basic)
              </Button>
              <Button
                variant={tier === 2 ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'h-7 px-2.5 text-xs',
                  tier === 2 && 'bg-amber-950/40 text-amber-400 border border-amber-500/40 font-semibold'
                )}
                onClick={() => setTier(2)}
              >
                Tier 2 (Syncopated)
              </Button>
              <Button
                variant={tier === 3 ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'h-7 px-2.5 text-xs',
                  tier === 3 && 'bg-rose-950/40 text-rose-400 border border-rose-500/40 font-semibold'
                )}
                onClick={() => setTier(3)}
              >
                Tier 3 (Advanced)
              </Button>
            </div>
          </div>

          {/* Bar count & Regenerate Button */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Bars:</span>
              <div className="flex items-center gap-1">
                {[4, 8, 16].map((count) => (
                  <Button
                    key={count}
                    variant={measureCount === count ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setMeasureCount(count)}
                  >
                    {count}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs gap-1.5 border-teal-500/40 text-teal-400 hover:bg-teal-950/30"
              onClick={handleRegenerate}
            >
              <RotateCw className="w-3.5 h-3.5" />
              Regenerate
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 bg-card/40 border border-border/50 rounded-xl p-3">
          {/* Page Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Page:</span>
            <div className="flex flex-wrap items-center gap-1">
              {[33, 34, 35, 36, 37, 38].map((page) => (
                <Button
                  key={page}
                  variant={selectedPage === page ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'h-7 px-2.5 text-xs font-medium',
                    selectedPage === page && 'bg-teal-950/40 text-teal-400 border border-teal-500/40 font-semibold'
                  )}
                  onClick={() => {
                    setSelectedPage(page);
                    if (page === 33) setSelectedExerciseNum(1);
                    if (page === 34) setSelectedExerciseNum(13);
                    if (page === 35) setSelectedExerciseNum(25);
                    if (page === 36) setSelectedExerciseNum(37);
                  }}
                >
                  Page {page} {page === 37 ? '(Solo 1)' : page === 38 ? '(Solo 2)' : ''}
                </Button>
              ))}
            </div>
          </div>

          {/* Exercise Selector for Pages 33 to 36 */}
          {selectedPage >= 33 && selectedPage <= 36 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/30">
              <span className="text-[11px] font-medium text-muted-foreground mr-1">Exercise:</span>
              {Array.from(
                { length: 12 },
                (_, i) => (selectedPage - 33) * 12 + 1 + i
              ).map((num) => (
                <Button
                  key={num}
                  variant={selectedExerciseNum === num ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'h-6 w-7 p-0 text-[11px]',
                    selectedExerciseNum === num && 'bg-teal-500/20 text-teal-300 font-bold border border-teal-500/40'
                  )}
                  onClick={() => setSelectedExerciseNum(num)}
                >
                  {num}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reading View with Real-Time Playhead */}
      <ReadingView
        readingLine={activeLine}
        scheduler={scheduler}
      />
    </div>
  );
};
