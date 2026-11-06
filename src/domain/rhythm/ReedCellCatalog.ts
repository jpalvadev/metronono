import { RhythmicCell } from './types';

export const ONE_BEAT_CELLS: readonly RhythmicCell[] = [
  // --- Tier 1 (On-beat figures) ---
  {
    id: 'C1_Q',
    name: 'Quarter note',
    tier: 1,
    spanBeats: 1.0,
    events: [{ isRest: false, durationBeats: 1.0, durationType: 'quarter' }],
  },
  {
    id: 'C1_EE',
    name: 'Two eighth notes',
    tier: 1,
    spanBeats: 1.0,
    events: [
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
    ],
  },
  {
    id: 'C1_ER',
    name: 'Eighth note, eighth rest',
    tier: 1,
    spanBeats: 1.0,
    events: [
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: true, durationBeats: 0.5, durationType: '8th' },
    ],
  },
  {
    id: 'C1_QR',
    name: 'Quarter rest',
    tier: 1,
    spanBeats: 1.0,
    events: [{ isRest: true, durationBeats: 1.0, durationType: 'quarter' }],
  },

  // --- Tier 2 (Off-beat eighth syncopations) ---
  {
    id: 'C1_RE',
    name: 'Eighth rest, eighth note',
    tier: 2,
    spanBeats: 1.0,
    events: [
      { isRest: true, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
    ],
  },

  // --- Tier 3 (Tied eighth sustain) ---
  {
    id: 'C1_TE',
    name: 'Tied eighth, eighth note',
    tier: 3,
    spanBeats: 1.0,
    events: [
      {
        isRest: false,
        durationBeats: 0.5,
        durationType: '8th',
        hasTieFromPrev: true,
      },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
    ],
  },
  {
    id: 'C1_EE_TIE',
    name: 'Two eighth notes, second tied to next',
    tier: 3,
    spanBeats: 1.0,
    events: [
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      {
        isRest: false,
        durationBeats: 0.5,
        durationType: '8th',
        hasTieToNext: true,
      },
    ],
  },
];

export const TWO_BEAT_CELLS: readonly RhythmicCell[] = [
  // --- Tier 1 (On-beat figures) ---
  {
    id: 'C2_QQ',
    name: 'Two quarter notes',
    tier: 1,
    spanBeats: 2.0,
    events: [
      { isRest: false, durationBeats: 1.0, durationType: 'quarter' },
      { isRest: false, durationBeats: 1.0, durationType: 'quarter' },
    ],
  },
  {
    id: 'C2_QEE',
    name: 'Quarter note, two eighth notes',
    tier: 1,
    spanBeats: 2.0,
    events: [
      { isRest: false, durationBeats: 1.0, durationType: 'quarter' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
    ],
  },
  {
    id: 'C2_EEQ',
    name: 'Two eighth notes, quarter note',
    tier: 1,
    spanBeats: 2.0,
    events: [
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 1.0, durationType: 'quarter' },
    ],
  },
  {
    id: 'C2_EEEE',
    name: 'Four eighth notes',
    tier: 1,
    spanBeats: 2.0,
    events: [
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
    ],
  },
  {
    id: 'C2_H',
    name: 'Half note',
    tier: 1,
    spanBeats: 2.0,
    events: [{ isRest: false, durationBeats: 2.0, durationType: 'half' }],
  },
  {
    id: 'C2_HR',
    name: 'Half rest',
    tier: 1,
    spanBeats: 2.0,
    events: [{ isRest: true, durationBeats: 2.0, durationType: 'half' }],
  },
  {
    id: 'C2_Q_QR',
    name: 'Quarter note, quarter rest',
    tier: 1,
    spanBeats: 2.0,
    events: [
      { isRest: false, durationBeats: 1.0, durationType: 'quarter' },
      { isRest: true, durationBeats: 1.0, durationType: 'quarter' },
    ],
  },
  {
    id: 'C2_QR_Q',
    name: 'Quarter rest, quarter note',
    tier: 1,
    spanBeats: 2.0,
    events: [
      { isRest: true, durationBeats: 1.0, durationType: 'quarter' },
      { isRest: false, durationBeats: 1.0, durationType: 'quarter' },
    ],
  },

  // --- Tier 2 (Intra-measure syncopations and off-beat attacks) ---
  {
    id: 'C2_EQE',
    name: 'Eighth, quarter, eighth (syncopation)',
    tier: 2,
    spanBeats: 2.0,
    events: [
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 1.0, durationType: 'quarter' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
    ],
  },
  {
    id: 'C2_Q_E',
    name: 'Dotted quarter, eighth',
    tier: 2,
    spanBeats: 2.0,
    events: [
      { isRest: false, durationBeats: 1.5, durationType: 'dotted-quarter' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
    ],
  },
  {
    id: 'C2_E_Q',
    name: 'Eighth, dotted quarter',
    tier: 2,
    spanBeats: 2.0,
    events: [
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 1.5, durationType: 'dotted-quarter' },
    ],
  },
  {
    id: 'C2_REQ',
    name: 'Eighth rest, eighth, quarter',
    tier: 2,
    spanBeats: 2.0,
    events: [
      { isRest: true, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 1.0, durationType: 'quarter' },
    ],
  },
  {
    id: 'C2_QRE',
    name: 'Quarter, eighth rest, eighth',
    tier: 2,
    spanBeats: 2.0,
    events: [
      { isRest: false, durationBeats: 1.0, durationType: 'quarter' },
      { isRest: true, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
    ],
  },
  {
    id: 'C2_REQRE',
    name: 'Eighth rest, eighth, eighth rest, eighth',
    tier: 2,
    spanBeats: 2.0,
    events: [
      { isRest: true, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: true, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
    ],
  },
  {
    id: 'C2_RQ_',
    name: 'Eighth rest, dotted quarter',
    tier: 2,
    spanBeats: 2.0,
    events: [
      { isRest: true, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 1.5, durationType: 'dotted-quarter' },
    ],
  },
  {
    id: 'C2_EER_E',
    name: 'Two eighths, eighth rest, eighth',
    tier: 2,
    spanBeats: 2.0,
    events: [
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: true, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
    ],
  },
  {
    id: 'C2_RE_EE',
    name: 'Eighth rest, three eighths',
    tier: 2,
    spanBeats: 2.0,
    events: [
      { isRest: true, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
    ],
  },

  // --- Tier 3 (Cross-beat and cross-bar ties) ---
  {
    id: 'C2_EQE_TIE',
    name: 'Eighth, quarter, eighth tied to next',
    tier: 3,
    spanBeats: 2.0,
    events: [
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 1.0, durationType: 'quarter' },
      {
        isRest: false,
        durationBeats: 0.5,
        durationType: '8th',
        hasTieToNext: true,
      },
    ],
  },
  {
    id: 'C2_Q_E_TIE',
    name: 'Dotted quarter, eighth tied to next',
    tier: 3,
    spanBeats: 2.0,
    events: [
      { isRest: false, durationBeats: 1.5, durationType: 'dotted-quarter' },
      {
        isRest: false,
        durationBeats: 0.5,
        durationType: '8th',
        hasTieToNext: true,
      },
    ],
  },
  {
    id: 'C2_TEQE',
    name: 'Tied eighth from prev, quarter, eighth',
    tier: 3,
    spanBeats: 2.0,
    events: [
      {
        isRest: false,
        durationBeats: 0.5,
        durationType: '8th',
        hasTieFromPrev: true,
      },
      { isRest: false, durationBeats: 1.0, durationType: 'quarter' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
    ],
  },
  {
    id: 'C2_TE_Q',
    name: 'Tied eighth from prev, dotted quarter',
    tier: 3,
    spanBeats: 2.0,
    events: [
      {
        isRest: false,
        durationBeats: 0.5,
        durationType: '8th',
        hasTieFromPrev: true,
      },
      { isRest: false, durationBeats: 1.5, durationType: 'dotted-quarter' },
    ],
  },
  {
    id: 'C2_TE_EE',
    name: 'Tied eighth from prev, three eighths',
    tier: 3,
    spanBeats: 2.0,
    events: [
      {
        isRest: false,
        durationBeats: 0.5,
        durationType: '8th',
        hasTieFromPrev: true,
      },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
      { isRest: false, durationBeats: 0.5, durationType: '8th' },
    ],
  },
  {
    id: 'C2_TEQE_TIE',
    name: 'Tied eighth from prev, quarter, eighth tied to next',
    tier: 3,
    spanBeats: 2.0,
    events: [
      {
        isRest: false,
        durationBeats: 0.5,
        durationType: '8th',
        hasTieFromPrev: true,
      },
      { isRest: false, durationBeats: 1.0, durationType: 'quarter' },
      {
        isRest: false,
        durationBeats: 0.5,
        durationType: '8th',
        hasTieToNext: true,
      },
    ],
  },
];

export const REED_CELLS: readonly RhythmicCell[] = [
  ...ONE_BEAT_CELLS,
  ...TWO_BEAT_CELLS,
];

const CELLS_BY_ID = new Map<string, RhythmicCell>(
  REED_CELLS.map((cell) => [cell.id, cell])
);

export function getCellById(id: string): RhythmicCell | undefined {
  return CELLS_BY_ID.get(id);
}

/**
 * Returns cells allowed for the specified difficulty tier.
 * If cumulative is true (default), returns all cells up to and including the given tier.
 * If cumulative is false, returns strictly cells of that tier.
 */
export function getCellsByTier(
  tier: 1 | 2 | 3,
  cumulative = true
): readonly RhythmicCell[] {
  if (cumulative) {
    return REED_CELLS.filter((cell) => cell.tier <= tier);
  }
  return REED_CELLS.filter((cell) => cell.tier === tier);
}
