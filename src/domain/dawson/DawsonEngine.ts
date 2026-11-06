import {
  DawsonMode,
  OstinatoType,
  DrumVoice,
  Dynamic,
  ScheduledDrumEvent,
  DawsonEngineOptions,
  Measure,
  ReadingLine,
  SubdivisionFormula,
  DawsonSystem,
} from './types';
import {
  DEFAULT_SHORT_FORMULAS,
  DEFAULT_LONG_FORMULAS,
  DEFAULT_DAWSON_SYSTEMS,
} from './SubdivisionFormula';

export class DawsonEngine {
  private mode: DawsonMode;
  private ostinato: OstinatoType;
  private shortFormula: SubdivisionFormula;
  private longFormula: SubdivisionFormula;
  private activeSystem?: DawsonSystem;
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
    this.ostinato = options?.ostinato ?? 'jazz_swing';

    if (options?.system) {
      this.activeSystem = options.system;
      this.shortFormula = options.system.shortFormula;
      this.longFormula = options.system.longFormula;
      this.ostinato = options.system.ostinatoId;
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
          : DEFAULT_DAWSON_SYSTEMS.classic_bop;
    }
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
      this.activeSystem = DEFAULT_DAWSON_SYSTEMS.classic_bop;
    } else if (mode === 'straight_rock') {
      this.shortFormula = DEFAULT_SHORT_FORMULAS.single_snare;
      this.longFormula = DEFAULT_LONG_FORMULAS.single_kick;
      this.ostinato = 'straight_rock';
    }
    this.notifyChange();
  }

  public getOstinato(): OstinatoType {
    return this.ostinato;
  }

  public setOstinato(ostinato: OstinatoType): void {
    this.ostinato = ostinato;
    this.notifyChange();
  }

  public getSystem(): DawsonSystem | undefined {
    return this.activeSystem;
  }

  public setSystem(system: DawsonSystem): void {
    this.activeSystem = system;
    this.shortFormula = system.shortFormula;
    this.longFormula = system.longFormula;
    this.ostinato = system.ostinatoId;
    if (system.id === 'inverted_bop') {
      this.mode = 'inverted_bop';
    } else if (system.id === 'classic_bop') {
      this.mode = 'classic_bop';
    } else if (system.ostinatoId === 'straight_rock') {
      this.mode = 'straight_rock';
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

  public getOstinatoEvents(ostinatoType?: OstinatoType): ScheduledDrumEvent[] {
    const ostinato = ostinatoType ?? this.ostinato;
    const events: ScheduledDrumEvent[] = [];

    switch (ostinato) {
      case 'jazz_swing':
        // Ride cymbal on 1, 2, 2.667, 3, 4, 4.667 (0-based: 0, 1.0, 1.667, 2.0, 3.0, 3.667)
        const rideBeats = [
          { time: 0, dynamic: 'normal' as Dynamic, velocity: 0.8 },
          { time: 1.0, dynamic: 'accent' as Dynamic, velocity: 0.9 },
          { time: 1.667, dynamic: 'normal' as Dynamic, velocity: 0.75 },
          { time: 2.0, dynamic: 'normal' as Dynamic, velocity: 0.8 },
          { time: 3.0, dynamic: 'accent' as Dynamic, velocity: 0.9 },
          { time: 3.667, dynamic: 'normal' as Dynamic, velocity: 0.75 },
        ];

        for (const beat of rideBeats) {
          events.push({
            timeInMeasure: beat.time,
            voice: 'ride',
            velocity: beat.velocity,
            dynamic: beat.dynamic,
            source: 'ostinato',
            limb: 'R',
          });
        }

        // Hi-hat pedal on 2 and 4 (0-based: 1.0, 3.0)
        events.push({
          timeInMeasure: 1.0,
          voice: 'hihat_foot',
          velocity: 0.85,
          dynamic: 'accent',
          source: 'ostinato',
          limb: 'LF',
        });
        events.push({
          timeInMeasure: 3.0,
          voice: 'hihat_foot',
          velocity: 0.85,
          dynamic: 'accent',
          source: 'ostinato',
          limb: 'LF',
        });
        break;

      case 'straight_rock':
        // Hi-hat closed on all 8 eighths (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5)
        const eighths = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5];
        for (const beat of eighths) {
          const isDownbeat = Number.isInteger(beat);
          events.push({
            timeInMeasure: beat,
            voice: 'hihat_closed',
            velocity: isDownbeat ? 0.8 : 0.7,
            dynamic: isDownbeat ? 'accent' : 'normal',
            source: 'ostinato',
            limb: 'R',
          });
        }
        break;

      case 'none':
      default:
        break;
    }

    return events.sort((a, b) => a.timeInMeasure - b.timeInMeasure);
  }

  public resolveOrchestrationEvents(
    measure: Measure,
    measureIndex?: number
  ): ScheduledDrumEvent[] {
    const events: ScheduledDrumEvent[] = [];
    let currentOffsetBeats = 0;

    for (const event of measure.events) {
      if (!event.isRest && !event.hasTieFromPrev) {
        // Long note: duration >= 1.0, tied to next, or explicitly marked isLong
        const isLong = event.durationBeats >= 1.0 || event.hasTieToNext || event.isLong;
        const formula = isLong ? this.longFormula : this.shortFormula;

        if (formula && formula.strokes && formula.strokes.length > 0) {
          let strokeOffset = 0;
          for (const stroke of formula.strokes) {
            const timeInMeasure = Math.round((currentOffsetBeats + strokeOffset) * 1000) / 1000;
            if (timeInMeasure < measure.totalBeats) {
              events.push({
                timeInMeasure,
                voice: stroke.voice,
                velocity: this.dynamicToVelocity(stroke.dynamic),
                dynamic: stroke.dynamic,
                source: 'orchestration',
                measureIndex,
                durationBeats: stroke.durationRatio,
                limb: stroke.limb,
              });
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
          const roundedTime = Math.round(currentOffsetBeats * 1000) / 1000;

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
