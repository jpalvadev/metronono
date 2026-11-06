import { describe, it, expect, beforeEach } from 'vitest';
import { DawsonEngine } from '../DawsonEngine';
import { createRhythmicEvent, Measure } from '../../rhythm/types';
import { REED_PAGE_37_EXERCISE_ONE } from '../../rhythm/ReedLibrary';

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
});
