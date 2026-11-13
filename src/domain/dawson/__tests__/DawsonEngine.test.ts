import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DawsonEngine } from '../DawsonEngine';
import { createRhythmicEvent, Measure } from '../../rhythm/types';
import { REED_PAGE_37_EXERCISE_ONE } from '../../rhythm/ReedLibrary';
import { FACTORY_DAWSON_SYSTEMS } from '../SubdivisionFormula';

describe('DawsonEngine', () => {
  let engine: DawsonEngine;

  beforeEach(() => {
    engine = new DawsonEngine();
  });

  describe('Configuration & Defaults', () => {
    it('initializes with classic_bop mode and jazz_swing ostinato by default', () => {
      expect(engine.getMode()).toBe('classic_bop');
      expect(engine.getOstinato()).toBe('jazz_swing');
    });

    it('allows changing mode and ostinato', () => {
      engine.setMode('inverted_bop');
      expect(engine.getMode()).toBe('inverted_bop');

      engine.setOstinato('straight_rock');
      expect(engine.getOstinato()).toBe('straight_rock');

      engine.setOstinato('none');
      expect(engine.getOstinato()).toBe('none');
    });
  });

  describe('Decoupling & Silence States', () => {
    it('maintains independent ostinato and system states', () => {
      engine.setOstinato('jazz_swing');
      engine.setSystem(FACTORY_DAWSON_SYSTEMS.snare_and_kick);
      expect(engine.getOstinato()).toBe('jazz_swing');
      expect(engine.getSystem()?.id).toBe('snare_and_kick');

      // Changing ostinato does not modify active system
      engine.setOstinato('straight_8ths_hihat');
      expect(engine.getOstinato()).toBe('straight_8ths_hihat');
      expect(engine.getSystem()?.id).toBe('snare_and_kick');

      // Changing system does not modify active ostinato
      engine.setSystem(FACTORY_DAWSON_SYSTEMS.hihat_foot_and_kick);
      expect(engine.getOstinato()).toBe('straight_8ths_hihat');
      expect(engine.getSystem()?.id).toBe('hihat_foot_and_kick');
    });

    it('silences reading line when system is set to none while ostinato continues', () => {
      engine.setOstinato('jazz_swing');
      engine.setSystem('none');

      const measure: Measure = {
        index: 0,
        timeSignature: [4, 4],
        totalBeats: 4,
        events: [
          createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }),
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
        ],
      };

      // Reading line orchestration is completely silenced
      const orchEvents = engine.resolveOrchestrationEvents(measure);
      expect(orchEvents).toEqual([]);

      // Ostinato continues playing in resolveMeasure
      const resolved = engine.resolveMeasure(measure);
      expect(resolved.length).toBeGreaterThan(0);
      expect(resolved.every((e) => e.source === 'ostinato')).toBe(true);
    });

    it('silences ostinato when ostinato is set to none while orchestration continues', () => {
      engine.setOstinato('none');
      engine.setSystem(FACTORY_DAWSON_SYSTEMS.snare_and_kick);

      const measure: Measure = {
        index: 0,
        timeSignature: [4, 4],
        totalBeats: 4,
        events: [
          createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }),
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
        ],
      };

      // Ostinato events are empty
      expect(engine.getOstinatoEvents()).toEqual([]);

      // Reading line orchestration continues in resolveMeasure
      const resolved = engine.resolveMeasure(measure);
      expect(resolved.length).toBeGreaterThan(0);
      expect(resolved.every((e) => e.source === 'orchestration')).toBe(true);
    });

    it('produces no audio events when both ostinato and system are none', () => {
      engine.setOstinato('none');
      engine.setSystem('none');

      const measure: Measure = {
        index: 0,
        timeSignature: [4, 4],
        totalBeats: 4,
        events: [
          createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }),
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
        ],
      };

      expect(engine.resolveMeasure(measure)).toEqual([]);
    });

    it('correctly maps short notes to hihat_foot when using hihat_foot_and_kick system', () => {
      engine.setSystem(FACTORY_DAWSON_SYSTEMS.hihat_foot_and_kick);

      const measure: Measure = {
        index: 0,
        timeSignature: [4, 4],
        totalBeats: 4,
        events: [
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }), // Short -> hihat_foot
          createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }), // Long -> kick
        ],
      };

      const orchEvents = engine.resolveOrchestrationEvents(measure);
      expect(orchEvents).toHaveLength(2);
      expect(orchEvents[0]).toMatchObject({
        voice: 'hihat_foot',
        dynamic: 'accent',
        timeInMeasure: 0,
      });
      expect(orchEvents[1]).toMatchObject({
        voice: 'kick',
        timeInMeasure: 0.5,
      });
    });

    it('resolves custom OstinatoPattern objects set on the engine', () => {
      engine.setOstinato({
        id: 'custom_four_on_floor',
        name: 'Four On Floor',
        timeSignature: [4, 4],
        strokes: [
          { durationRatio: 1.0, hits: [{ voice: 'kick', dynamic: 'accent' }] },
          { durationRatio: 1.0, hits: [{ voice: 'kick', dynamic: 'accent' }] },
          { durationRatio: 1.0, hits: [{ voice: 'kick', dynamic: 'accent' }] },
          { durationRatio: 1.0, hits: [{ voice: 'kick', dynamic: 'accent' }] },
        ],
      });

      const events = engine.getOstinatoEvents();
      expect(events).toHaveLength(4);
      expect(events.map((e) => e.timeInMeasure)).toEqual([0, 1.0, 2.0, 3.0]);
      expect(events.every((e) => e.voice === 'kick' && e.source === 'ostinato')).toBe(true);
    });
  });

  describe('Ostinato Patterns', () => {
    it('generates jazz_swing ostinato accurately', () => {
      const events = engine.getOstinatoEvents('jazz_swing');

      // Ride cymbal on 1, 2, 2.667, 3, 4, 4.667 (0-based: 0, 1.0, 1.667, 2.0, 3.0, 3.667)
      const rideEvents = events.filter((e) => e.voice === 'ride');
      expect(rideEvents).toHaveLength(6);
      expect(rideEvents.map((e) => e.timeInMeasure)).toEqual([0, 1.0, 1.667, 2.0, 3.0, 3.667]);
      rideEvents.forEach((e) => {
        expect(e.source).toBe('ostinato');
      });

      // Hi-hat pedal on 2 and 4 (0-based: 1.0, 3.0)
      const hihatEvents = events.filter((e) => e.voice === 'hihat_foot');
      expect(hihatEvents).toHaveLength(2);
      expect(hihatEvents.map((e) => e.timeInMeasure)).toEqual([1.0, 3.0]);
      hihatEvents.forEach((e) => {
        expect(e.source).toBe('ostinato');
      });
    });

    it('generates straight_rock ostinato with hi-hat on all 8 eighths', () => {
      const events = engine.getOstinatoEvents('straight_rock');

      const hihatEvents = events.filter((e) => e.voice === 'hihat_closed');
      expect(hihatEvents).toHaveLength(8);
      expect(hihatEvents.map((e) => e.timeInMeasure)).toEqual([
        0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5,
      ]);
      hihatEvents.forEach((e) => {
        expect(e.source).toBe('ostinato');
      });
    });

    it('generates empty stream when ostinato is none', () => {
      const events = engine.getOstinatoEvents('none');
      expect(events).toHaveLength(0);
    });
  });

  describe('Orchestration Mappings', () => {
    it('maps short notes to snare and long notes to kick in classic_bop mode', () => {
      engine.setMode('classic_bop');

      // Measure: Quarter (1.0), Two Eighths (0.5, 0.5), Half (2.0)
      const measure: Measure = {
        index: 0,
        timeSignature: [4, 4],
        totalBeats: 4,
        events: [
          createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }), // Long -> Kick
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),     // Short -> Snare
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),     // Short -> Snare
          createRhythmicEvent({ durationBeats: 2.0, durationType: 'half' }),    // Long -> Kick
        ],
      };

      const orchEvents = engine.resolveOrchestrationEvents(measure);
      expect(orchEvents).toHaveLength(4);

      expect(orchEvents[0]).toMatchObject({
        timeInMeasure: 0,
        voice: 'kick',
        source: 'orchestration',
      });
      expect(orchEvents[1]).toMatchObject({
        timeInMeasure: 1.0,
        voice: 'snare',
        source: 'orchestration',
      });
      expect(orchEvents[2]).toMatchObject({
        timeInMeasure: 1.5,
        voice: 'snare',
        source: 'orchestration',
      });
      expect(orchEvents[3]).toMatchObject({
        timeInMeasure: 2.0,
        voice: 'kick',
        source: 'orchestration',
      });
    });

    it('maps short notes to kick and long notes to snare in inverted_bop mode', () => {
      engine.setMode('inverted_bop');

      const measure: Measure = {
        index: 0,
        timeSignature: [4, 4],
        totalBeats: 4,
        events: [
          createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }), // Long -> Snare
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),     // Short -> Kick
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),     // Short -> Kick
          createRhythmicEvent({ durationBeats: 2.0, durationType: 'half' }),    // Long -> Snare
        ],
      };

      const orchEvents = engine.resolveOrchestrationEvents(measure);
      expect(orchEvents).toHaveLength(4);

      expect(orchEvents[0].voice).toBe('snare');
      expect(orchEvents[1].voice).toBe('kick');
      expect(orchEvents[2].voice).toBe('kick');
      expect(orchEvents[3].voice).toBe('snare');
    });

    it('ignores rests and does not schedule drum hits for them', () => {
      const measure: Measure = {
        index: 0,
        timeSignature: [4, 4],
        totalBeats: 4,
        events: [
          createRhythmicEvent({ isRest: true, durationBeats: 1.0 }),
          createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }),
          createRhythmicEvent({ isRest: true, durationBeats: 1.0 }),
          createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }),
        ],
      };

      const orchEvents = engine.resolveOrchestrationEvents(measure);
      expect(orchEvents).toHaveLength(2);
      expect(orchEvents[0].timeInMeasure).toBe(1.0);
      expect(orchEvents[1].timeInMeasure).toBe(3.0);
    });

    it('handles tied notes properly: no attack on tieFromPrev, and treats tieToNext as long note', () => {
      engine.setMode('classic_bop');

      const measure: Measure = {
        index: 0,
        timeSignature: [4, 4],
        totalBeats: 4,
        events: [
          // Eighth note tied to next -> Long Note (Kick)
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th', hasTieToNext: true }),
          // Eighth note tied from previous -> Held, no new attack!
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th', hasTieFromPrev: true }),
          // Regular quarter note -> Long Note (Kick)
          createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }),
          // Regular half note -> Long Note (Kick)
          createRhythmicEvent({ durationBeats: 2.0, durationType: 'half' }),
        ],
      };

      const orchEvents = engine.resolveOrchestrationEvents(measure);
      expect(orchEvents).toHaveLength(3);
      expect(orchEvents[0]).toMatchObject({ timeInMeasure: 0, voice: 'kick' });
      expect(orchEvents[1]).toMatchObject({ timeInMeasure: 1.0, voice: 'kick' });
      expect(orchEvents[2]).toMatchObject({ timeInMeasure: 2.0, voice: 'kick' });
    });

    it('assigns dynamic velocities correctly', () => {
      expect(engine.dynamicToVelocity('accent')).toBeCloseTo(1.0);
      expect(engine.dynamicToVelocity('flam')).toBeCloseTo(0.9);
      expect(engine.dynamicToVelocity('normal')).toBeCloseTo(0.8);
      expect(engine.dynamicToVelocity('ghost')).toBeCloseTo(0.4);
    });
  });

  describe('Collision Resolution & Chronological Stream Ordering', () => {
    it('merges ostinato and orchestration events in strict chronological order with source tags', () => {
      engine.setMode('classic_bop');
      engine.setOstinato('jazz_swing');

      // Page 37 M1: q, q, e, q, e (offsets: 0, 1.0, 2.0, 2.5, 3.5)
      const measure: Measure = {
        index: 0,
        timeSignature: [4, 4],
        totalBeats: 4,
        events: [
          createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }), // 0.0 -> kick
          createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }), // 1.0 -> kick
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),     // 2.0 -> snare
          createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }), // 2.5 -> kick
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),     // 3.5 -> snare
        ],
      };

      const events = engine.resolveMeasure(measure);

      // Verify chronological ordering
      for (let i = 0; i < events.length - 1; i++) {
        expect(events[i].timeInMeasure).toBeLessThanOrEqual(events[i + 1].timeInMeasure);
      }

      // Check collision at beat 0: both Ride (ostinato) and Kick (orchestration) are present
      const beat0Events = events.filter((e) => e.timeInMeasure === 0);
      expect(beat0Events).toHaveLength(2);
      expect(beat0Events.some((e) => e.voice === 'ride' && e.source === 'ostinato')).toBe(true);
      expect(beat0Events.some((e) => e.voice === 'kick' && e.source === 'orchestration')).toBe(true);

      // Check collision at beat 1.0: Ride (ostinato), HiHat (ostinato), and Kick (orchestration)
      const beat1Events = events.filter((e) => e.timeInMeasure === 1.0);
      expect(beat1Events).toHaveLength(3);
      expect(beat1Events.some((e) => e.voice === 'ride' && e.source === 'ostinato')).toBe(true);
      expect(beat1Events.some((e) => e.voice === 'hihat_foot' && e.source === 'ostinato')).toBe(true);
      expect(beat1Events.some((e) => e.voice === 'kick' && e.source === 'orchestration')).toBe(true);
    });
  });

  describe('Full Reading Line Resolution', () => {
    it('resolves Ted Reed Page 37 Exercise One accurately across measures', () => {
      engine.setMode('classic_bop');
      engine.setOstinato('jazz_swing');

      const events = engine.resolveReadingLine(REED_PAGE_37_EXERCISE_ONE);
      expect(events.length).toBeGreaterThan(0);

      // Verify every event has a valid measureIndex and timeInMeasure in [0, 4)
      events.forEach((e) => {
        expect(e.measureIndex).toBeDefined();
        expect(e.timeInMeasure).toBeGreaterThanOrEqual(0);
        expect(e.timeInMeasure).toBeLessThan(4.0);
      });

      // Verify measure 0 contains both ostinato and reading line events
      const m0Events = events.filter((e) => e.measureIndex === 0);
      expect(m0Events.some((e) => e.source === 'ostinato')).toBe(true);
      expect(m0Events.some((e) => e.source === 'orchestration')).toBe(true);
    });
  });

  describe('Reading Feel (Straight vs Swing)', () => {
    it('initializes with straight feel by default and notifies on change', () => {
      expect(engine.getReadingFeel()).toBe('straight');

      const feelListener = vi.fn();
      const changeListener = vi.fn();
      const unsubFeel = engine.onReadingFeelChange(feelListener);
      const unsubChange = engine.onChange(changeListener);

      engine.setReadingFeel('swing');
      expect(engine.getReadingFeel()).toBe('swing');
      expect(feelListener).toHaveBeenCalledWith('swing');
      expect(changeListener).toHaveBeenCalledTimes(1);

      // Idempotent set should not fire listeners again
      engine.setReadingFeel('swing');
      expect(feelListener).toHaveBeenCalledTimes(1);
      expect(changeListener).toHaveBeenCalledTimes(1);

      unsubFeel();
      unsubChange();
      engine.setReadingFeel('straight');
      expect(engine.getReadingFeel()).toBe('straight');
      expect(feelListener).toHaveBeenCalledTimes(1);
    });

    it('resolves eighth-note upbeats evenly in straight feel and swung at beat + 2/3 in swing feel', () => {
      // 4 beats with 8 eighth notes
      const measure: Measure = {
        index: 0,
        timeSignature: [4, 4],
        totalBeats: 4,
        events: Array.from({ length: 8 }, () =>
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' })
        ),
      };

      // 1. Straight feel
      engine.setReadingFeel('straight');
      const straightEvents = engine.resolveOrchestrationEvents(measure);
      expect(straightEvents).toHaveLength(8);
      const straightTimes = straightEvents.map((e) => e.timeInMeasure);
      expect(straightTimes).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);

      // 2. Swing feel
      engine.setReadingFeel('swing');
      const swingEvents = engine.resolveOrchestrationEvents(measure);
      expect(swingEvents).toHaveLength(8);
      const swingTimes = swingEvents.map((e) => e.timeInMeasure);

      // Downbeats remain exact integers
      expect(swingTimes[0]).toBe(0);
      expect(swingTimes[2]).toBe(1);
      expect(swingTimes[4]).toBe(2);
      expect(swingTimes[6]).toBe(3);

      // Upbeats are transformed to beat + 2/3 (approx 0.667, 1.667, 2.667, 3.667)
      expect(swingTimes[1]).toBeCloseTo(0 + 2 / 3, 3);
      expect(swingTimes[3]).toBeCloseTo(1 + 2 / 3, 3);
      expect(swingTimes[5]).toBeCloseTo(2 + 2 / 3, 3);
      expect(swingTimes[7]).toBeCloseTo(3 + 2 / 3, 3);
    });

    it('keeps downbeat quarter notes and other non-upbeat divisions at nominal offsets', () => {
      // Beat 0: quarter note (1.0 beat)
      // Beat 1: eighth rest (0.5) + eighth note (0.5, offset 1.5)
      // Beat 2: half note (2.0 beats, offset 2.0)
      const measure: Measure = {
        index: 0,
        timeSignature: [4, 4],
        totalBeats: 4,
        events: [
          createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }),
          createRhythmicEvent({ isRest: true, durationBeats: 0.5, durationType: '8th' }),
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
          createRhythmicEvent({ durationBeats: 2.0, durationType: 'half' }),
        ],
      };

      engine.setReadingFeel('swing');
      const events = engine.resolveOrchestrationEvents(measure);
      expect(events).toHaveLength(3); // 2 notes + 1 half note (rest excluded)

      // Downbeat quarter note at 0.0
      expect(events[0].timeInMeasure).toBe(0);
      // Upbeat eighth note at 1.5 transformed to 1 + 2/3
      expect(events[1].timeInMeasure).toBeCloseTo(1 + 2 / 3, 3);
      // Downbeat half note at 2.0 remains 2.0
      expect(events[2].timeInMeasure).toBe(2);
    });

    it('dispatches multi-stroke formulas with nominal stroke durations without elastic distortion', () => {
      // Short formula with two 16th strokes (0.25 beat each)
      const doubleStrokeFormula = {
        id: 'test_double',
        name: 'Test Double',
        trigger: 'short' as const,
        strokes: [
          {
            durationRatio: 0.25,
            hits: [{ voice: 'snare' as const, dynamic: 'accent' as const }],
          },
          {
            durationRatio: 0.25,
            hits: [{ voice: 'snare' as const, dynamic: 'normal' as const }],
          },
        ],
      };

      engine.setShortFormula(doubleStrokeFormula);

      // Measure with an upbeat eighth note at beat 0.5
      const measure: Measure = {
        index: 0,
        timeSignature: [4, 4],
        totalBeats: 4,
        events: [
          createRhythmicEvent({ isRest: true, durationBeats: 0.5, durationType: '8th' }),
          createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
          createRhythmicEvent({ isRest: true, durationBeats: 3.0, durationType: 'dotted-half' }),
        ],
      };

      // Swing feel: onset shifts to 2/3 (~0.667).
      // First stroke at 0.667, second stroke at 0.667 + 0.25 = 0.917
      engine.setReadingFeel('swing');
      const events = engine.resolveOrchestrationEvents(measure);
      expect(events).toHaveLength(2);
      expect(events[0].timeInMeasure).toBeCloseTo(2 / 3, 3);
      expect(events[1].timeInMeasure).toBeCloseTo(2 / 3 + 0.25, 3);
      // Duration ratios are preserved without elastic stretching
      expect(events[0].durationBeats).toBe(0.25);
      expect(events[1].durationBeats).toBe(0.25);
    });
  });
});
