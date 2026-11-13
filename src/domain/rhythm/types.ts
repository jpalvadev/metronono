export type NoteDuration =
  | '16th'           // 0.25 beat
  | '8th'            // 0.5 beat
  | 'quarter'        // 1.0 beat
  | 'dotted-quarter' // 1.5 beats
  | 'half'           // 2.0 beats
  | 'dotted-half'    // 3.0 beats
  | 'whole';         // 4.0 beats

export type ReadingFeel = 'straight' | 'swing';

export interface RhythmicEvent {
  readonly id: string;
  readonly isRest: boolean;
  readonly durationBeats: number;
  readonly durationType: NoteDuration;
  readonly hasTieToNext: boolean;
  readonly hasTieFromPrev: boolean;
  readonly isShort: boolean;
  readonly isLong: boolean;
}

export interface Measure {
  readonly index: number;
  readonly timeSignature: [4, 4];
  readonly events: readonly RhythmicEvent[];
  readonly totalBeats: number; // Invariant: exactly 4.0
}

export interface ReadingLine {
  readonly id: string;
  readonly title: string;
  readonly tier: 1 | 2 | 3;
  readonly measures: readonly Measure[];
}

export interface CellEventTemplate {
  readonly isRest: boolean;
  readonly durationBeats: number;
  readonly durationType: NoteDuration;
  readonly hasTieToNext?: boolean;
  readonly hasTieFromPrev?: boolean;
}

export interface RhythmicCell {
  readonly id: string;
  readonly name: string;
  readonly tier: 1 | 2 | 3;
  readonly spanBeats: 1.0 | 2.0;
  readonly events: readonly CellEventTemplate[];
}

export function durationTypeToBeats(type: NoteDuration): number {
  switch (type) {
    case '16th':
      return 0.25;
    case '8th':
      return 0.5;
    case 'quarter':
      return 1.0;
    case 'dotted-quarter':
      return 1.5;
    case 'half':
      return 2.0;
    case 'dotted-half':
      return 3.0;
    case 'whole':
      return 4.0;
  }
}

export function beatsToDurationType(beats: number): NoteDuration {
  const rounded = Math.round(beats * 1000) / 1000;
  switch (rounded) {
    case 0.25:
      return '16th';
    case 0.5:
      return '8th';
    case 1.0:
      return 'quarter';
    case 1.5:
      return 'dotted-quarter';
    case 2.0:
      return 'half';
    case 3.0:
      return 'dotted-half';
    case 4.0:
      return 'whole';
    default:
      throw new Error(`Unsupported beat duration: ${beats}`);
  }
}

export function createRhythmicEvent(params: {
  id?: string;
  isRest?: boolean;
  durationBeats?: number;
  durationType?: NoteDuration;
  hasTieToNext?: boolean;
  hasTieFromPrev?: boolean;
}): RhythmicEvent {
  const isRest = !!params.isRest;
  const durationType =
    params.durationType ??
    (params.durationBeats !== undefined
      ? beatsToDurationType(params.durationBeats)
      : 'quarter');
  const durationBeats = params.durationBeats ?? durationTypeToBeats(durationType);
  const hasTieToNext = !!params.hasTieToNext;
  const hasTieFromPrev = !!params.hasTieFromPrev;

  // Short note: eighth notes (duration <= 0.5 beat)
  // Long note: quarter notes or tied notes (duration >= 1.0 beat or tied from previous)
  const isShort = !isRest && durationBeats <= 0.5;
  const isLong = !isRest && (durationBeats >= 1.0 || hasTieFromPrev);

  return {
    id: params.id ?? `event-${Math.random().toString(36).substring(2, 9)}`,
    isRest,
    durationBeats,
    durationType,
    hasTieToNext,
    hasTieFromPrev,
    isShort,
    isLong,
  };
}

export function isMeasureValid(measure: Measure): boolean {
  if (
    !measure ||
    measure.timeSignature[0] !== 4 ||
    measure.timeSignature[1] !== 4 ||
    !Array.isArray(measure.events) ||
    measure.events.length === 0
  ) {
    return false;
  }

  // Integer sixteenth pulses: 1 beat = 4 sixteenths, 4.0 beats = 16 sixteenths
  const sixteenthPulses = measure.events.reduce((sum, e) => {
    return sum + Math.round(e.durationBeats * 4);
  }, 0);

  if (sixteenthPulses !== 16) {
    return false;
  }

  const sumBeats = measure.events.reduce((sum, e) => sum + e.durationBeats, 0);
  return Math.abs(sumBeats - 4.0) < 1e-9;
}
