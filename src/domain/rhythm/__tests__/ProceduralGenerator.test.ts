import { describe, it, expect } from 'vitest';
import { ProceduralGenerator } from '../ProceduralGenerator';
import { isMeasureValid } from '../types';

describe('ProceduralGenerator', () => {
  it('generates measures that always total exactly 4.0 beats with zero drift', () => {
    const generator = new ProceduralGenerator({ tier: 2, seed: 42 });
    const measureCount = 1000;
    const measures = generator.generateMeasures(measureCount);

    expect(measures).toHaveLength(measureCount);
    for (let i = 0; i < measures.length; i++) {
      const m = measures[i];
      expect(isMeasureValid(m)).toBe(true);
      expect(m.totalBeats).toBe(4.0);

      const sum = m.events.reduce((acc, evt) => acc + evt.durationBeats, 0);
      expect(sum).toBe(4.0);
    }
  });

  it('guarantees no two consecutive measures are identical', () => {
    const generator = new ProceduralGenerator({ tier: 2, seed: 12345 });
    const measures = generator.generateMeasures(500);

    for (let i = 1; i < measures.length; i++) {
      const prev = measures[i - 1];
      const curr = measures[i];

      const prevSig = prev.events
        .map(
          (e) =>
            `${e.isRest ? 'r' : 'n'}:${e.durationBeats}:${e.hasTieToNext}:${e.hasTieFromPrev}`
        )
        .join('|');
      const currSig = curr.events
        .map(
          (e) =>
            `${e.isRest ? 'r' : 'n'}:${e.durationBeats}:${e.hasTieToNext}:${e.hasTieFromPrev}`
        )
        .join('|');

      expect(currSig).not.toBe(prevSig);
    }
  });

  it('adheres to Tier 1: strictly on-beat figures with no syncopations or ties', () => {
    const generator = new ProceduralGenerator({ tier: 1, seed: 999 });
    const measures = generator.generateMeasures(200);

    for (const m of measures) {
      expect(isMeasureValid(m)).toBe(true);
      let currentBeat = 0;

      for (const e of m.events) {
        // No ties in Tier 1
        expect(e.hasTieToNext).toBe(false);
        expect(e.hasTieFromPrev).toBe(false);

        // In Tier 1, an off-beat eighth note attack cannot be preceded by an off-beat eighth rest on beat 1.0 or 2.0
        // And quarter notes must fall on downbeats (integer beat offsets: 0, 1, 2, 3)
        if (e.durationType === 'quarter') {
          expect(Number.isInteger(Math.round(currentBeat * 10) / 10)).toBe(true);
        }

        currentBeat += e.durationBeats;
      }
    }
  });

  it('adheres to Tier 2: contains off-beat eighths and syncopated quarters, but no cross-bar ties', () => {
    const generator = new ProceduralGenerator({ tier: 2, seed: 777 });
    const measures = generator.generateMeasures(200);

    let foundSyncopation = false;
    for (const m of measures) {
      expect(isMeasureValid(m)).toBe(true);
      // No cross-bar ties in Tier 2
      expect(m.events[m.events.length - 1].hasTieToNext).toBe(false);
      expect(m.events[0].hasTieFromPrev).toBe(false);

      let currentBeat = 0;
      for (const e of m.events) {
        // Check for syncopated quarter note (starts on an off-beat e.g. 0.5, 1.5, 2.5)
        if (e.durationType === 'quarter' && !e.isRest) {
          const beatMod = currentBeat % 1.0;
          if (Math.abs(beatMod - 0.5) < 1e-4) {
            foundSyncopation = true;
          }
        }
        currentBeat += e.durationBeats;
      }
    }
    expect(foundSyncopation).toBe(true);
  });

  it('adheres to Tier 3: supports cross-bar ties and midpoint ties with correct continuation flags', () => {
    const generator = new ProceduralGenerator({ tier: 3, seed: 555 });
    const measures = generator.generateMeasures(300);

    let crossBarTieCount = 0;
    for (let i = 0; i < measures.length - 1; i++) {
      const curr = measures[i];
      const next = measures[i + 1];

      const lastEventCurr = curr.events[curr.events.length - 1];
      const firstEventNext = next.events[0];

      if (lastEventCurr.hasTieToNext) {
        crossBarTieCount++;
        // The next measure's first event MUST have hasTieFromPrev === true
        expect(firstEventNext.hasTieFromPrev).toBe(true);
      }
    }

    expect(crossBarTieCount).toBeGreaterThan(0);
  });

  it('is deterministic when initialized with the same seed', () => {
    const genA = new ProceduralGenerator({ tier: 2, seed: 123456 });
    const genB = new ProceduralGenerator({ tier: 2, seed: 123456 });

    const measuresA = genA.generateMeasures(50);
    const measuresB = genB.generateMeasures(50);

    for (let i = 0; i < 50; i++) {
      expect(measuresA[i].events.length).toBe(measuresB[i].events.length);
      for (let j = 0; j < measuresA[i].events.length; j++) {
        expect(measuresA[i].events[j].durationBeats).toBe(
          measuresB[i].events[j].durationBeats
        );
        expect(measuresA[i].events[j].isRest).toBe(
          measuresB[i].events[j].isRest
        );
      }
    }
  });

  it('flags short vs long notes correctly on all generated events', () => {
    const generator = new ProceduralGenerator({ tier: 2, seed: 888 });
    const measures = generator.generateMeasures(100);

    for (const m of measures) {
      for (const e of m.events) {
        if (e.isRest) {
          expect(e.isShort).toBe(false);
          expect(e.isLong).toBe(false);
        } else if (e.durationBeats <= 0.5) {
          expect(e.isShort).toBe(true);
          expect(e.isLong).toBe(false);
        } else if (e.durationBeats >= 1.0 || e.hasTieFromPrev) {
          expect(e.isShort).toBe(false);
          expect(e.isLong).toBe(true);
        }
      }
    }
  });

  it('generateReadingLine returns a valid ReadingLine container with correct metadata', () => {
    const generator = new ProceduralGenerator({ tier: 2, seed: 42 });
    const line = generator.generateReadingLine({
      id: 'custom-reading-line',
      title: 'Procedural Practice Line #1',
      measureCount: 16,
    });

    expect(line.id).toBe('custom-reading-line');
    expect(line.title).toBe('Procedural Practice Line #1');
    expect(line.tier).toBe(2);
    expect(line.measures).toHaveLength(16);
    expect(line.measures[0].index).toBe(0);
    expect(line.measures[15].index).toBe(15);
  });

  it('continuous generation via nextMeasure yields infinite valid stream', () => {
    const generator = new ProceduralGenerator({ tier: 1 });
    for (let i = 0; i < 50; i++) {
      const m = generator.nextMeasure();
      expect(m.index).toBe(i);
      expect(isMeasureValid(m)).toBe(true);
    }
  });
});
