import { describe, it, expect, beforeEach } from 'vitest';
import { MetronomeEngine } from '../MetronomeEngine';

describe('MetronomeEngine', () => {
  let engine: MetronomeEngine;

  beforeEach(() => {
    engine = new MetronomeEngine();
  });

  describe('Tempo Management', () => {
    it('initializes with default tempo of 120 BPM', () => {
      expect(engine.getTempo()).toBe(120);
    });

    it('sets valid tempo between 30 and 300 BPM', () => {
      engine.setTempo(144);
      expect(engine.getTempo()).toBe(144);
    });

    it('clamps tempo to minimum 30 BPM when lower value provided', () => {
      engine.setTempo(15);
      expect(engine.getTempo()).toBe(30);
    });

    it('clamps tempo to maximum 300 BPM when higher value provided', () => {
      engine.setTempo(450);
      expect(engine.getTempo()).toBe(300);
    });

    it('rounds floating tempo values to integer BPM', () => {
      engine.setTempo(125.7);
      expect(engine.getTempo()).toBe(126);
    });
  });

  describe('Time Signature & Beat Tracking', () => {
    it('initializes with 4/4 time signature', () => {
      expect(engine.getTimeSignature()).toEqual({ beats: 4, beatUnit: 4 });
    });

    it('can update time signature to 3/4', () => {
      engine.setTimeSignature({ beats: 3, beatUnit: 4 });
      expect(engine.getTimeSignature()).toEqual({ beats: 3, beatUnit: 4 });
    });

    it('parses string time signatures like "4/4" and "3/4"', () => {
      engine.setTimeSignature('3/4');
      expect(engine.getTimeSignature()).toEqual({ beats: 3, beatUnit: 4 });
    });

    it('identifies beat 0 as downbeat in 4/4', () => {
      engine.reset();
      const tick = engine.nextBeat();
      expect(tick.beatIndex).toBe(0);
      expect(tick.isDownbeat).toBe(true);
    });

    it('identifies beats 1, 2, 3 as non-downbeat in 4/4', () => {
      engine.reset();
      engine.nextBeat(); // beat 0
      const tick1 = engine.nextBeat();
      expect(tick1.beatIndex).toBe(1);
      expect(tick1.isDownbeat).toBe(false);

      const tick2 = engine.nextBeat();
      expect(tick2.beatIndex).toBe(2);
      expect(tick2.isDownbeat).toBe(false);

      const tick3 = engine.nextBeat();
      expect(tick3.beatIndex).toBe(3);
      expect(tick3.isDownbeat).toBe(false);
    });

    it('wraps beat counter back to 0 at the end of the measure', () => {
      engine.setTimeSignature('4/4');
      engine.reset();
      engine.nextBeat(); // 0
      engine.nextBeat(); // 1
      engine.nextBeat(); // 2
      engine.nextBeat(); // 3
      const tickWrap = engine.nextBeat(); // Should be 0
      expect(tickWrap.beatIndex).toBe(0);
      expect(tickWrap.isDownbeat).toBe(true);
    });

    it('wraps beat counter back to 0 at beat 3 in 3/4 time', () => {
      engine.setTimeSignature('3/4');
      engine.reset();
      expect(engine.nextBeat().beatIndex).toBe(0);
      expect(engine.nextBeat().beatIndex).toBe(1);
      expect(engine.nextBeat().beatIndex).toBe(2);
      const wrap = engine.nextBeat();
      expect(wrap.beatIndex).toBe(0);
      expect(wrap.isDownbeat).toBe(true);
    });
  });

  describe('Tap Tempo Calculator', () => {
    it('returns null on the first tap because interval cannot be computed', () => {
      const bpm = engine.tap(1000);
      expect(bpm).toBeNull();
    });

    it('calculates 120 BPM when two taps are 500ms apart', () => {
      engine.tap(1000);
      const bpm = engine.tap(1500);
      expect(bpm).toBe(120);
      expect(engine.getTempo()).toBe(120);
    });

    it('averages intervals over multiple taps', () => {
      // 600ms = 100 BPM
      engine.tap(0);
      engine.tap(600);
      const bpm = engine.tap(1200);
      expect(bpm).toBe(100);
      expect(engine.getTempo()).toBe(100);
    });

    it('resets tap history if interval exceeds 2000ms (2 seconds)', () => {
      engine.tap(1000);
      engine.tap(1500); // 120 BPM
      // Wait 2500ms before next tap
      const bpm = engine.tap(4000);
      expect(bpm).toBeNull(); // Reset, treating 4000 as first tap
    });

    it('clamps calculated tap BPM to [30, 300]', () => {
      // Extremely fast taps (100ms = 600 BPM) -> clamped to 300
      engine.tap(0);
      const bpmFast = engine.tap(100);
      expect(bpmFast).toBe(300);

      // Extremely slow taps (2500ms is timeout, but 1900ms = ~31.5 BPM)
      engine.resetTap();
      engine.tap(0);
      const bpmSlow = engine.tap(1950);
      expect(bpmSlow).toBe(31);
    });
  });
});
