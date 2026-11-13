import {
  DawsonMode,
  OstinatoType,
  OstinatoPattern,
  DrumVoice,
  Dynamic,
  ScheduledDrumEvent,
  DawsonEngineOptions,
  Measure,
  ReadingLine,
  SubdivisionFormula,
  DawsonSystem,
  ReadingFeel,
} from './types';
import {
  DEFAULT_SHORT_FORMULAS,
  DEFAULT_LONG_FORMULAS,
  DEFAULT_DAWSON_SYSTEMS,
  FACTORY_DAWSON_SYSTEMS,
  FACTORY_OSTINATOS,
} from './SubdivisionFormula';

export class DawsonEngine {
  private mode: DawsonMode;
  private ostinato: OstinatoType;
  private activeOstinatoPattern?: OstinatoPattern;
  private shortFormula: SubdivisionFormula;
  private longFormula: SubdivisionFormula;
  private activeSystem?: DawsonSystem;
  private isSystemSilenced: boolean = false;
  private readingFeel: ReadingFeel = 'straight';
  private readingFeelListeners: Set<(feel: ReadingFeel) => void> = new Set();
  private changeListeners: Set<() => void> = new Set();

  public onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private notifyChange(): void {
    this.changeListeners.forEach((l) => {
      try {
        l();
      } catch {
        // Safe listener dispatch
      }
    });
  }

  constructor(options?: DawsonEngineOptions) {
    this.mode = options?.mode ?? 'classic_bop';
    this.ostinato = options?.activeOstinatoId ?? options?.ostinato ?? 'jazz_swing';
    if (this.ostinato !== 'none') {
      this.activeOstinatoPattern =
        FACTORY_OSTINATOS[this.ostinato] ||
        (this.ostinato === 'straight_rock' ? FACTORY_OSTINATOS.straight_8ths_hihat : undefined);
    }

    if (options?.system === 'none' || options?.activeSystemId === 'none') {
      this.isSystemSilenced = true;
      this.activeSystem = undefined;
      this.shortFormula = DEFAULT_SHORT_FORMULAS.single_snare;
      this.longFormula = DEFAULT_LONG_FORMULAS.single_kick;
    } else if (options?.system) {
      this.activeSystem = options.system;
      this.shortFormula = options.system.shortFormula;
      this.longFormula = options.system.longFormula;
    } else {
      this.shortFormula =
        options?.shortFormula ??
        (this.mode === 'inverted_bop'
          ? DEFAULT_SHORT_FORMULAS.single_kick
          : DEFAULT_SHORT_FORMULAS.single_snare);
      this.longFormula =
        options?.longFormula ??
        (this.mode === 'inverted_bop'
          ? DEFAULT_LONG_FORMULAS.single_snare
          : DEFAULT_LONG_FORMULAS.single_kick);
      this.activeSystem =
        this.mode === 'inverted_bop'
          ? DEFAULT_DAWSON_SYSTEMS.inverted_bop
          : FACTORY_DAWSON_SYSTEMS.snare_and_kick || DEFAULT_DAWSON_SYSTEMS.classic_bop;
    }

    if (options?.readingFeel) {
      this.readingFeel = options.readingFeel === 'swing' ? 'swing' : 'straight';
    }
  }

  public getReadingFeel(): ReadingFeel {
    return this.readingFeel;
  }

  public setReadingFeel(feel: ReadingFeel): void {
    const nextFeel: ReadingFeel = feel === 'swing' ? 'swing' : 'straight';
    if (this.readingFeel !== nextFeel) {
      this.readingFeel = nextFeel;
      this.readingFeelListeners.forEach((l) => {
        try {
          l(this.readingFeel);
        } catch {
          // Safe listener dispatch
        }
      });
      this.notifyChange();
    }
  }

  public onReadingFeelChange(listener: (feel: ReadingFeel) => void): () => void {
    this.readingFeelListeners.add(listener);
    return () => {
      this.readingFeelListeners.delete(listener);
    };
  }

  public getMode(): DawsonMode {
    return this.mode;
  }

  public setMode(mode: DawsonMode): void {
    this.mode = mode;
    if (mode === 'inverted_bop') {
      this.shortFormula = DEFAULT_SHORT_FORMULAS.single_kick;
      this.longFormula = DEFAULT_LONG_FORMULAS.single_snare;
      this.activeSystem = DEFAULT_DAWSON_SYSTEMS.inverted_bop;
    } else if (mode === 'classic_bop') {
      this.shortFormula = DEFAULT_SHORT_FORMULAS.single_snare;
      this.longFormula = DEFAULT_LONG_FORMULAS.single_kick;
      this.activeSystem = FACTORY_DAWSON_SYSTEMS.snare_and_kick || DEFAULT_DAWSON_SYSTEMS.classic_bop;
    } else if (mode === 'straight_rock') {
      this.shortFormula = DEFAULT_SHORT_FORMULAS.single_snare;
      this.longFormula = DEFAULT_LONG_FORMULAS.single_kick;
      this.setOstinato('straight_rock');
    }
    this.notifyChange();
  }

  public getOstinato(): OstinatoType {
    return this.ostinato;
  }

  public getOstinatoPattern(): OstinatoPattern | undefined {
    if (this.ostinato === 'none') return undefined;
    return (
      this.activeOstinatoPattern ||
      FACTORY_OSTINATOS[this.ostinato] ||
      (this.ostinato === 'straight_rock' ? FACTORY_OSTINATOS.straight_8ths_hihat : undefined)
    );
  }

  public setOstinato(ostinato: OstinatoType | OstinatoPattern): void {
    if (typeof ostinato === 'string') {
      this.ostinato = ostinato;
      if (ostinato === 'none') {
        this.activeOstinatoPattern = undefined;
      } else {
        this.activeOstinatoPattern =
          FACTORY_OSTINATOS[ostinato] ||
          (ostinato === 'straight_rock' ? FACTORY_OSTINATOS.straight_8ths_hihat : undefined);
      }
    } else {
      this.activeOstinatoPattern = ostinato;
      this.ostinato = ostinato.id;
    }
    this.notifyChange();
  }

  public getSystem(): DawsonSystem | undefined {
    return this.isSystemSilenced ? undefined : this.activeSystem;
  }

  public setSystem(system: DawsonSystem | 'none'): void {
    if (system === 'none') {
      this.isSystemSilenced = true;
      this.activeSystem = undefined;
    } else {
      this.isSystemSilenced = false;
      this.activeSystem = system;
      this.shortFormula = system.shortFormula;
      this.longFormula = system.longFormula;
      if (system.id === 'inverted_bop') {
        this.mode = 'inverted_bop';
      } else if (system.id === 'classic_bop' || system.id === 'snare_and_kick') {
        this.mode = 'classic_bop';
      }
    }
    this.notifyChange();
  }

  public getShortFormula(): SubdivisionFormula {
    return this.shortFormula;
  }

  public setShortFormula(formula: SubdivisionFormula): void {
    this.shortFormula = formula;
    this.notifyChange();
  }

  public getLongFormula(): SubdivisionFormula {
    return this.longFormula;
  }

  public setLongFormula(formula: SubdivisionFormula): void {
    this.longFormula = formula;
    this.notifyChange();
  }

  public dynamicToVelocity(dynamic: Dynamic): number {
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

  public getOstinatoEvents(ostinatoType?: OstinatoType | OstinatoPattern): ScheduledDrumEvent[] {
    let pattern: OstinatoPattern | undefined;

    if (ostinatoType) {
      if (typeof ostinatoType === 'string') {
        if (ostinatoType === 'none') return [];
        pattern =
          FACTORY_OSTINATOS[ostinatoType] ||
          (ostinatoType === 'straight_rock' ? FACTORY_OSTINATOS.straight_8ths_hihat : undefined);
      } else {
        pattern = ostinatoType;
      }
    } else {
      if (this.ostinato === 'none') return [];
      pattern = this.getOstinatoPattern();
    }

    if (!pattern || !pattern.strokes || pattern.strokes.length === 0) {
      return [];
    }

    const events: ScheduledDrumEvent[] = [];
    let currentOffsetBeats = 0;

    for (const stroke of pattern.strokes) {
      if (!stroke.isRest && stroke.hits && stroke.hits.length > 0) {
        for (const hit of stroke.hits) {
          events.push({
            timeInMeasure: Math.round(currentOffsetBeats * 1000) / 1000,
            voice: hit.voice,
            velocity: this.dynamicToVelocity(hit.dynamic),
            dynamic: hit.dynamic,
            source: 'ostinato',
            durationBeats: stroke.durationRatio,
          });
        }
      }
      currentOffsetBeats += stroke.durationRatio;
    }

    return events.sort((a, b) => a.timeInMeasure - b.timeInMeasure);
  }

  public resolveOrchestrationEvents(
    measure: Measure,
    measureIndex?: number
  ): ScheduledDrumEvent[] {
    if (this.isSystemSilenced) {
      return [];
    }
    const events: ScheduledDrumEvent[] = [];
    let currentOffsetBeats = 0;

    for (const event of measure.events) {
      if (!event.isRest && !event.hasTieFromPrev) {
        // Long note: duration >= 1.0, tied to next, or explicitly marked isLong
        const isLong = event.durationBeats >= 1.0 || event.hasTieToNext || event.isLong;
        const formula = isLong ? this.longFormula : this.shortFormula;

        let noteOnsetTime = currentOffsetBeats;
        if (this.readingFeel === 'swing') {
          const beat = Math.floor(currentOffsetBeats);
          const frac = currentOffsetBeats - beat;
          if (Math.abs(frac - 0.5) < 0.05) {
            noteOnsetTime = beat + 2 / 3;
          }
        }

        if (formula && formula.strokes && formula.strokes.length > 0) {
          let strokeOffset = 0;
          for (const stroke of formula.strokes) {
            const timeInMeasure = Math.round((noteOnsetTime + strokeOffset) * 1000) / 1000;
            if (!stroke.isRest && stroke.hits && stroke.hits.length > 0) {
              for (const hit of stroke.hits) {
                if (timeInMeasure < measure.totalBeats) {
                  events.push({
                    timeInMeasure,
                    voice: hit.voice,
                    velocity: this.dynamicToVelocity(hit.dynamic),
                    dynamic: hit.dynamic,
                    source: 'orchestration',
                    measureIndex,
                    durationBeats: stroke.durationRatio,
                  });
                }
              }
            }
            strokeOffset += stroke.durationRatio;
          }
        } else {
          // Fallback if formula has no strokes
          let targetVoice: DrumVoice;
          if (this.mode === 'inverted_bop') {
            targetVoice = isLong ? 'snare' : 'kick';
          } else {
            targetVoice = isLong ? 'kick' : 'snare';
          }

          const dynamic: Dynamic = 'normal';
          const velocity = this.dynamicToVelocity(dynamic);
          const roundedTime = Math.round(noteOnsetTime * 1000) / 1000;

          events.push({
            timeInMeasure: roundedTime,
            voice: targetVoice,
            velocity,
            dynamic,
            source: 'orchestration',
            measureIndex,
            durationBeats: event.durationBeats,
          });
        }
      }

      currentOffsetBeats += event.durationBeats;
    }

    return events.sort((a, b) => a.timeInMeasure - b.timeInMeasure);
  }

  public resolveMeasure(
    measure: Measure,
    measureIndex?: number
  ): ScheduledDrumEvent[] {
    const mIdx = measureIndex ?? measure.index;
    const ostinatoEvents = this.getOstinatoEvents().map((e) => ({
      ...e,
      measureIndex: mIdx,
    }));
    const orchEvents = this.resolveOrchestrationEvents(measure, mIdx);

    const merged = [...ostinatoEvents, ...orchEvents];
    return merged.sort((a, b) => {
      if (a.timeInMeasure !== b.timeInMeasure) {
        return a.timeInMeasure - b.timeInMeasure;
      }
      // Stable sort: ostinato before orchestration
      if (a.source === 'ostinato' && b.source === 'orchestration') return -1;
      if (a.source === 'orchestration' && b.source === 'ostinato') return 1;
      return 0;
    });
  }

  public resolveReadingLine(readingLine: ReadingLine): ScheduledDrumEvent[] {
    const allEvents: ScheduledDrumEvent[] = [];
    for (const measure of readingLine.measures) {
      const measureEvents = this.resolveMeasure(measure, measure.index);
      allEvents.push(...measureEvents);
    }
    return allEvents;
  }
}
