import {
  Measure,
  ReadingLine,
  RhythmicEvent,
  createRhythmicEvent,
} from './types';

interface MeasureSpec {
  events: Array<{
    duration: number;
    isRest?: boolean;
    tieToNext?: boolean;
    tieFromPrev?: boolean;
  }>;
}

function buildMeasure(index: number, spec: MeasureSpec): Measure {
  const events: RhythmicEvent[] = spec.events.map((evt, evtIndex) => {
    return createRhythmicEvent({
      id: `m${index}-e${evtIndex}`,
      durationBeats: evt.duration,
      isRest: evt.isRest,
      hasTieToNext: evt.tieToNext,
      hasTieFromPrev: evt.tieFromPrev,
    });
  });

  return {
    index,
    timeSignature: [4, 4],
    events,
    totalBeats: 4.0,
  };
}

function repeatMeasurePattern(
  spec: MeasureSpec,
  measureCount = 4
): Measure[] {
  const measures: Measure[] = [];
  for (let i = 0; i < measureCount; i++) {
    measures.push(buildMeasure(i, spec));
  }
  return measures;
}

// =========================================================================
// Page 33: Syncopation Set 1 (Exercises 1 - 12)
// =========================================================================
const P33_SPECS: MeasureSpec[] = [
  // Ex 1: Q, Q, E-Q-E
  {
    events: [
      { duration: 1.0 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
    ],
  },
  // Ex 2: E-Q-E, Q, Q
  {
    events: [
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 1.0 },
    ],
  },
  // Ex 3: E-Q-E, E-Q-E
  {
    events: [
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
    ],
  },
  // Ex 4: Q, E-Q-E, Q
  {
    events: [
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.0 },
    ],
  },
  // Ex 5: E-E, E-Q-E, Q
  {
    events: [
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.0 },
    ],
  },
  // Ex 6: Q, E-Q-E, E-E
  {
    events: [
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
    ],
  },
  // Ex 7: E-Q-E, E-E, Q
  {
    events: [
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 1.0 },
    ],
  },
  // Ex 8: Q, E-E, E-Q-E
  {
    events: [
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
    ],
  },
  // Ex 9: E-E, Q, E-Q-E
  {
    events: [
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
    ],
  },
  // Ex 10: E-Q-E, Q, E-E
  {
    events: [
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 0.5 },
    ],
  },
  // Ex 11: E-E, E-Q-E, E-E
  {
    events: [
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
    ],
  },
  // Ex 12: Q, Q, Q, Q
  {
    events: [
      { duration: 1.0 },
      { duration: 1.0 },
      { duration: 1.0 },
      { duration: 1.0 },
    ],
  },
];

export const REED_PAGE_33_EXERCISES: readonly ReadingLine[] = P33_SPECS.map(
  (spec, i) => {
    const num = i + 1;
    const numStr = num < 10 ? `0${num}` : `${num}`;
    return {
      id: `reed-p33-ex${numStr}`,
      title: `Ted Reed Syncopation - Page 33, Exercise ${num}`,
      tier: 2,
      measures: repeatMeasurePattern(spec, 4),
    };
  }
);

// =========================================================================
// Page 34: Syncopation Set 2 (Exercises 13 - 24)
// =========================================================================
const P34_SPECS: MeasureSpec[] = [
  // Ex 13: r8, e, q, r8, e, q
  {
    events: [
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 1.0 },
    ],
  },
  // Ex 14: q, r8, e, q, r8, e
  {
    events: [
      { duration: 1.0 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
    ],
  },
  // Ex 15: r8, e, r8, e, r8, e, r8, e (all upbeats)
  {
    events: [
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
    ],
  },
  // Ex 16: r8, e, q, q, r8, e
  {
    events: [
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 1.0 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
    ],
  },
  // Ex 17: q, q, r8, e, r8, e
  {
    events: [
      { duration: 1.0 },
      { duration: 1.0 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
    ],
  },
  // Ex 18: r8, e, r8, e, q, q
  {
    events: [
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 1.0 },
    ],
  },
  // Ex 19: r8, e, e, e, r8, e, q
  {
    events: [
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 1.0 },
    ],
  },
  // Ex 20: q, r8, e, e, e, r8, e
  {
    events: [
      { duration: 1.0 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
    ],
  },
  // Ex 21: e, e, r8, e, q, r8, e
  {
    events: [
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
    ],
  },
  // Ex 22: r8, e, q, e, e, r8, e
  {
    events: [
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
    ],
  },
  // Ex 23: r8, e, e, e, e, e, r8, e
  {
    events: [
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
    ],
  },
  // Ex 24: q, r8, e, r8, e, q
  {
    events: [
      { duration: 1.0 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 1.0 },
    ],
  },
];

export const REED_PAGE_34_EXERCISES: readonly ReadingLine[] = P34_SPECS.map(
  (spec, i) => {
    const num = i + 13;
    return {
      id: `reed-p34-ex${num}`,
      title: `Ted Reed Syncopation - Page 34, Exercise ${num}`,
      tier: 2,
      measures: repeatMeasurePattern(spec, 4),
    };
  }
);

// =========================================================================
// Page 35: Syncopation Set 3 (Exercises 25 - 36)
// =========================================================================
const P35_SPECS: MeasureSpec[] = [
  // Ex 25: qd, e, qd, e
  {
    events: [
      { duration: 1.5 },
      { duration: 0.5 },
      { duration: 1.5 },
      { duration: 0.5 },
    ],
  },
  // Ex 26: e, qd, e, qd
  {
    events: [
      { duration: 0.5 },
      { duration: 1.5 },
      { duration: 0.5 },
      { duration: 1.5 },
    ],
  },
  // Ex 27: qd, e, e, qd
  {
    events: [
      { duration: 1.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 1.5 },
    ],
  },
  // Ex 28: e, qd, qd, e
  {
    events: [
      { duration: 0.5 },
      { duration: 1.5 },
      { duration: 1.5 },
      { duration: 0.5 },
    ],
  },
  // Ex 29: q, qd, e, q
  {
    events: [
      { duration: 1.0 },
      { duration: 1.5 },
      { duration: 0.5 },
      { duration: 1.0 },
    ],
  },
  // Ex 30: qd, e, q, q
  {
    events: [
      { duration: 1.5 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 1.0 },
    ],
  },
  // Ex 31: q, e, qd, q
  {
    events: [
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.5 },
      { duration: 1.0 },
    ],
  },
  // Ex 32: e, qd, q, q
  {
    events: [
      { duration: 0.5 },
      { duration: 1.5 },
      { duration: 1.0 },
      { duration: 1.0 },
    ],
  },
  // Ex 33: qd, e, e, q, e
  {
    events: [
      { duration: 1.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
    ],
  },
  // Ex 34: e, q, e, qd, e
  {
    events: [
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.5 },
      { duration: 0.5 },
    ],
  },
  // Ex 35: e, qd, e, q, e
  {
    events: [
      { duration: 0.5 },
      { duration: 1.5 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
    ],
  },
  // Ex 36: e, q, e, e, qd
  {
    events: [
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 1.5 },
    ],
  },
];

export const REED_PAGE_35_EXERCISES: readonly ReadingLine[] = P35_SPECS.map(
  (spec, i) => {
    const num = i + 25;
    return {
      id: `reed-p35-ex${num}`,
      title: `Ted Reed Syncopation - Page 35, Exercise ${num}`,
      tier: 2,
      measures: repeatMeasurePattern(spec, 4),
    };
  }
);

// =========================================================================
// Page 36: Syncopation Set 4 (Exercises 37 - 48)
// =========================================================================
const P36_SPECS: MeasureSpec[] = [
  // Ex 37: r8, qd, r8, qd
  {
    events: [
      { duration: 0.5, isRest: true },
      { duration: 1.5 },
      { duration: 0.5, isRest: true },
      { duration: 1.5 },
    ],
  },
  // Ex 38: qd, e, r8, qd
  {
    events: [
      { duration: 1.5 },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 1.5 },
    ],
  },
  // Ex 39: r8, qd, qd, e
  {
    events: [
      { duration: 0.5, isRest: true },
      { duration: 1.5 },
      { duration: 1.5 },
      { duration: 0.5 },
    ],
  },
  // Ex 40: r8, e, qd, e, q
  {
    events: [
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 1.5 },
      { duration: 0.5 },
      { duration: 1.0 },
    ],
  },
  // Ex 41: q, r8, e, qd, e
  {
    events: [
      { duration: 1.0 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 1.5 },
      { duration: 0.5 },
    ],
  },
  // Ex 42: e, qd, r8, e, q
  {
    events: [
      { duration: 0.5 },
      { duration: 1.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 1.0 },
    ],
  },
  // Ex 43: r8, e, q, e, qd
  {
    events: [
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.5 },
    ],
  },
  // Ex 44: qd, e, r8, e, r8, e
  {
    events: [
      { duration: 1.5 },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
    ],
  },
  // Ex 45: r8, e, r8, e, e, qd
  {
    events: [
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 1.5 },
    ],
  },
  // Ex 46: e, q, e, r8, qd
  {
    events: [
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 0.5, isRest: true },
      { duration: 1.5 },
    ],
  },
  // Ex 47: r8, qd, e, q, e
  {
    events: [
      { duration: 0.5, isRest: true },
      { duration: 1.5 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
    ],
  },
  // Ex 48: qd, e, qd, e
  {
    events: [
      { duration: 1.5 },
      { duration: 0.5 },
      { duration: 1.5 },
      { duration: 0.5 },
    ],
  },
];

export const REED_PAGE_36_EXERCISES: readonly ReadingLine[] = P36_SPECS.map(
  (spec, i) => {
    const num = i + 37;
    return {
      id: `reed-p36-ex${num}`,
      title: `Ted Reed Syncopation - Page 36, Exercise ${num}`,
      tier: 2,
      measures: repeatMeasurePattern(spec, 4),
    };
  }
);

// =========================================================================
// Page 37: "Exercise One" (The Benchmark 32-Measure Solo Etude)
// =========================================================================
const P37_MEASURES_SPECS: MeasureSpec[] = [
  // Line 1 (M1 - M4)
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 1.0 }] },
  { events: [{ duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }] },

  // Line 2 (M5 - M8)
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 1.0 }, { duration: 1.0 }] },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 2.0 }] },

  // Line 3 (M9 - M12)
  { events: [{ duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }] },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }] },
  { events: [{ duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }] },

  // Line 4 (M13 - M16)
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 1.0 }] },
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }] },
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 1.0 }, { duration: 1.0 }] },

  // Line 5 (M17 - M20)
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },
  { events: [{ duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },

  // Line 6 (M21 - M24)
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }] },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 1.0 }] },
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 2.0 }] },

  // Line 7 (M25 - M28)
  { events: [{ duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 1.0 }] },
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }] },

  // Line 8 (M29 - M32)
  { events: [{ duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }] },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 2.0 }] },
];

export const REED_PAGE_37_EXERCISE_ONE: ReadingLine = {
  id: 'reed-p37-exercise-one',
  title: 'Ted Reed Syncopation - Page 37 (Exercise One)',
  tier: 2,
  measures: P37_MEASURES_SPECS.map((spec, i) => buildMeasure(i, spec)),
};

// =========================================================================
// Page 38: "Exercise Two" (32-Measure Solo Etude with Ties)
// =========================================================================
const P38_MEASURES_SPECS: MeasureSpec[] = [
  // Line 1 (M1 - M4)
  { events: [{ duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }] },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 1.0 }] },
  { events: [{ duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },
  {
    events: [
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5, tieToNext: true }, // Ties over barline to M5
    ],
  },

  // Line 2 (M5 - M8)
  {
    events: [
      { duration: 0.5, tieFromPrev: true }, // Tied from M4
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
    ],
  },
  { events: [{ duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 2.0 }] },

  // Line 3 (M9 - M12)
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }] },
  {
    events: [
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5, tieToNext: true }, // Ties to M13
    ],
  },

  // Line 4 (M13 - M16)
  {
    events: [
      { duration: 0.5, tieFromPrev: true }, // Tied from M12
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 1.0 },
      { duration: 1.0 },
    ],
  },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }] },
  { events: [{ duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 2.0 }] },

  // Line 5 (M17 - M20)
  { events: [{ duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }] },
  { events: [{ duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }] },
  {
    events: [
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5, tieToNext: true }, // Ties to M21
    ],
  },

  // Line 6 (M21 - M24)
  {
    events: [
      { duration: 0.5, tieFromPrev: true }, // Tied from M20
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
    ],
  },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }] },
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 2.0 }] },

  // Line 7 (M25 - M28)
  { events: [{ duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 1.0 }] },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }] },
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }] },
  {
    events: [
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 0.5 },
      { duration: 0.5, tieToNext: true }, // Ties to M29
    ],
  },

  // Line 8 (M29 - M32)
  {
    events: [
      { duration: 0.5, tieFromPrev: true }, // Tied from M28
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
      { duration: 1.0 },
      { duration: 0.5 },
    ],
  },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }] },
  { events: [{ duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }, { duration: 0.5 }, { duration: 1.0 }, { duration: 0.5 }] },
  { events: [{ duration: 1.0 }, { duration: 1.0 }, { duration: 2.0 }] },
];

export const REED_PAGE_38_EXERCISE_TWO: ReadingLine = {
  id: 'reed-p38-exercise-two',
  title: 'Ted Reed Syncopation - Page 38 (Exercise Two)',
  tier: 3,
  measures: P38_MEASURES_SPECS.map((spec, i) => buildMeasure(i, spec)),
};

// =========================================================================
// Library Aggregation & Retrieval
// =========================================================================
export const ALL_REED_EXERCISES: readonly ReadingLine[] = [
  ...REED_PAGE_33_EXERCISES,
  ...REED_PAGE_34_EXERCISES,
  ...REED_PAGE_35_EXERCISES,
  ...REED_PAGE_36_EXERCISES,
  REED_PAGE_37_EXERCISE_ONE,
  REED_PAGE_38_EXERCISE_TWO,
];

const EXERCISES_BY_ID = new Map<string, ReadingLine>(
  ALL_REED_EXERCISES.map((ex) => [ex.id, ex])
);

export function getAllReedExercises(): readonly ReadingLine[] {
  return ALL_REED_EXERCISES;
}

export function getReedExerciseById(id: string): ReadingLine | undefined {
  return EXERCISES_BY_ID.get(id);
}

export function getReedExercise(
  pageNumber: number,
  exerciseNumber?: number
): ReadingLine | undefined {
  if (pageNumber === 37) {
    return REED_PAGE_37_EXERCISE_ONE;
  }
  if (pageNumber === 38) {
    return REED_PAGE_38_EXERCISE_TWO;
  }

  if (exerciseNumber === undefined) {
    return undefined;
  }

  if (pageNumber === 33 && exerciseNumber >= 1 && exerciseNumber <= 12) {
    const numStr =
      exerciseNumber < 10 ? `0${exerciseNumber}` : `${exerciseNumber}`;
    return getReedExerciseById(`reed-p33-ex${numStr}`);
  }

  if (pageNumber === 34 && exerciseNumber >= 13 && exerciseNumber <= 24) {
    return getReedExerciseById(`reed-p34-ex${exerciseNumber}`);
  }

  if (pageNumber === 35 && exerciseNumber >= 25 && exerciseNumber <= 36) {
    return getReedExerciseById(`reed-p35-ex${exerciseNumber}`);
  }

  if (pageNumber === 36 && exerciseNumber >= 37 && exerciseNumber <= 48) {
    return getReedExerciseById(`reed-p36-ex${exerciseNumber}`);
  }

  return undefined;
}
