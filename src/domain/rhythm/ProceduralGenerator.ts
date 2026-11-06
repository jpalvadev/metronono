import {
  Measure,
  ReadingLine,
  RhythmicCell,
  RhythmicEvent,
  createRhythmicEvent,
} from './types';
import {
  ONE_BEAT_CELLS,
  TWO_BEAT_CELLS,
} from './ReedCellCatalog';

export interface ProceduralGeneratorConfig {
  tier?: 1 | 2 | 3;
  seed?: number;
}

export interface ReadingLineConfig {
  id: string;
  title: string;
  measureCount: number;
  tier?: 1 | 2 | 3;
}

export class Mulberry32 {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const index = Math.floor(this.next() * items.length);
    return items[index];
  }
}

export class ProceduralGenerator {
  private tier: 1 | 2 | 3;
  private prng: Mulberry32;
  private currentMeasureIndex = 0;
  private previousMeasureSignature = '';
  private pendingCrossBarTie = false;

  constructor(config?: ProceduralGeneratorConfig) {
    this.tier = config?.tier ?? 1;
    const initialSeed = config?.seed ?? Math.floor(Math.random() * 0x7fffffff);
    this.prng = new Mulberry32(initialSeed);
  }

  public setTier(tier: 1 | 2 | 3): void {
    this.tier = tier;
  }

  public getTier(): 1 | 2 | 3 {
    return this.tier;
  }

  public reset(seed?: number): void {
    this.currentMeasureIndex = 0;
    this.previousMeasureSignature = '';
    this.pendingCrossBarTie = false;
    if (seed !== undefined) {
      this.prng = new Mulberry32(seed);
    }
  }

  /**
   * Generates the next sequential Measure.
   */
  public nextMeasure(): Measure {
    const measure = this.generateSingleMeasure(
      this.currentMeasureIndex,
      this.tier
    );
    this.currentMeasureIndex++;
    return measure;
  }

  /**
   * Generates a batch of consecutive Measures.
   */
  public generateMeasures(count: number): Measure[] {
    const measures: Measure[] = [];
    for (let i = 0; i < count; i++) {
      measures.push(this.nextMeasure());
    }
    return measures;
  }

  /**
   * Generates a complete ReadingLine with the specified measure count.
   */
  public generateReadingLine(config: ReadingLineConfig): ReadingLine {
    const originalTier = this.tier;
    if (config.tier !== undefined) {
      this.tier = config.tier;
    }

    const measures = this.generateMeasures(config.measureCount);

    // Restore tier if changed
    this.tier = originalTier;

    return {
      id: config.id,
      title: config.title,
      tier: config.tier ?? this.tier,
      measures,
    };
  }

  private generateSingleMeasure(index: number, tier: 1 | 2 | 3): Measure {
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      attempts++;
      const cells = this.pickCellsForMeasure(tier, this.pendingCrossBarTie);
      const events: RhythmicEvent[] = [];

      for (const cell of cells) {
        for (const tpl of cell.events) {
          const event = createRhythmicEvent({
            id: `m${index}-e${events.length}`,
            isRest: tpl.isRest,
            durationBeats: tpl.durationBeats,
            durationType: tpl.durationType,
            hasTieToNext: !!tpl.hasTieToNext,
            hasTieFromPrev: !!tpl.hasTieFromPrev,
          });
          events.push(event);
        }
      }

      const sig = this.getMeasureSignature(events);
      if (sig !== this.previousMeasureSignature || attempts >= maxAttempts) {
        this.previousMeasureSignature = sig;
        const lastEvt = events[events.length - 1];
        this.pendingCrossBarTie = !!lastEvt.hasTieToNext;

        return {
          index,
          timeSignature: [4, 4],
          events,
          totalBeats: 4.0,
        };
      }
    }

    // Fallback if loop finishes (rare)
    return {
      index,
      timeSignature: [4, 4],
      events: [],
      totalBeats: 4.0,
    };
  }

  private pickCellsForMeasure(
    tier: 1 | 2 | 3,
    requiresTieFromPrev: boolean
  ): RhythmicCell[] {
    // 4/4 metric structures:
    // 0: [2, 2]
    // 1: [2, 1, 1]
    // 2: [1, 1, 2]
    // 3: [1, 1, 1, 1]
    // 4: [1, 2, 1]
    const structureRoll = this.prng.nextInt(0, 4);

    let spans: number[];
    switch (structureRoll) {
      case 0:
        spans = [2, 2];
        break;
      case 1:
        spans = [2, 1, 1];
        break;
      case 2:
        spans = [1, 1, 2];
        break;
      case 3:
        spans = [1, 1, 1, 1];
        break;
      default:
        spans = [1, 2, 1];
        break;
    }

    // In Tier 3, occasionally end measure with a cross-bar tie
    // (e.g. ~30% probability if not already forced)
    const shouldEndWithCrossBarTie =
      tier === 3 && this.prng.next() < 0.35;

    const chosenCells: RhythmicCell[] = [];

    for (let pos = 0; pos < spans.length; pos++) {
      const span = spans[pos];
      const isFirst = pos === 0;
      const isLast = pos === spans.length - 1;

      const needsTieFromPrev = isFirst && requiresTieFromPrev;
      const needsTieToNext = isLast && shouldEndWithCrossBarTie;

      const cell = this.selectCell({
        spanBeats: span === 1 ? 1.0 : 2.0,
        tier,
        needsTieFromPrev,
        needsTieToNext,
      });

      chosenCells.push(cell);
    }

    return chosenCells;
  }

  private selectCell(criteria: {
    spanBeats: 1.0 | 2.0;
    tier: 1 | 2 | 3;
    needsTieFromPrev: boolean;
    needsTieToNext: boolean;
  }): RhythmicCell {
    const { spanBeats, tier, needsTieFromPrev, needsTieToNext } = criteria;

    const basePool = spanBeats === 1.0 ? ONE_BEAT_CELLS : TWO_BEAT_CELLS;

    let candidatePool = basePool.filter((cell) => {
      // Tier check: must not exceed requested tier
      if (cell.tier > tier) {
        return false;
      }

      // If tie from previous is required (first cell after cross-bar tie)
      if (needsTieFromPrev) {
        return !!cell.events[0].hasTieFromPrev;
      }

      // If tie to next is required (last cell ending with cross-bar tie)
      if (needsTieToNext) {
        return !!cell.events[cell.events.length - 1].hasTieToNext;
      }

      // If neither tie is required, don't pick tied-from-prev or tied-to-next
      // unless tier === 3 and random choice permits
      const hasTiePrev = !!cell.events[0].hasTieFromPrev;
      const hasTieNext = !!cell.events[cell.events.length - 1].hasTieToNext;

      if (tier < 3 && (hasTiePrev || hasTieNext)) {
        return false;
      }

      if (hasTiePrev && !needsTieFromPrev) {
        return false;
      }

      if (hasTieNext && !needsTieToNext) {
        return false;
      }

      return true;
    });

    if (candidatePool.length === 0) {
      // Fallback
      candidatePool = basePool.filter((c) => c.tier <= tier);
    }

    // In Tier 2, boost weight of syncopated cells so syncopations appear actively
    if (tier === 2) {
      const syncopated = candidatePool.filter((c) => c.tier === 2);
      if (syncopated.length > 0 && this.prng.next() < 0.65) {
        return this.prng.pick(syncopated);
      }
    }

    return this.prng.pick(candidatePool);
  }

  private getMeasureSignature(events: readonly RhythmicEvent[]): string {
    return events
      .map(
        (e) =>
          `${e.isRest ? 'r' : 'n'}:${e.durationBeats}:${e.hasTieToNext}:${e.hasTieFromPrev}`
      )
      .join('|');
  }
}
