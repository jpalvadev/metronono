import {
  DawsonMode,
  OstinatoType,
  DrumVoice,
  Dynamic,
  ScheduledDrumEvent,
  DawsonEngineOptions,
  Measure,
  ReadingLine,
} from './types';

export class DawsonEngine {
  private mode: DawsonMode;
  private ostinato: OstinatoType;

  constructor(options?: DawsonEngineOptions) {
    this.mode = options?.mode ?? 'classic_bop';
    this.ostinato = options?.ostinato ?? 'jazz_swing';
  }

  public getMode(): DawsonMode {
    return this.mode;
  }

  public setMode(mode: DawsonMode): void {
    this.mode = mode;
  }

  public getOstinato(): OstinatoType {
    return this.ostinato;
  }

  public setOstinato(ostinato: OstinatoType): void {
    this.ostinato = ostinato;
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
          });
        }

        // Hi-hat pedal on 2 and 4 (0-based: 1.0, 3.0)
        events.push({
          timeInMeasure: 1.0,
          voice: 'hihat_foot',
          velocity: 0.85,
          dynamic: 'accent',
          source: 'ostinato',
        });
        events.push({
          timeInMeasure: 3.0,
          voice: 'hihat_foot',
          velocity: 0.85,
          dynamic: 'accent',
          source: 'ostinato',
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
        const isShort = !isLong;

        let targetVoice: DrumVoice;
        if (this.mode === 'inverted_bop') {
          targetVoice = isShort ? 'kick' : 'snare';
        } else {
          // classic_bop or straight_rock
          targetVoice = isShort ? 'snare' : 'kick';
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
