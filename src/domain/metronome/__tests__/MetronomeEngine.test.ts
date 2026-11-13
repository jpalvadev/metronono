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

  describe('Beat Mask & Mute per Beat', () => {
    it('initializes with all beats active according to time signature', () => {
      expect(engine.getBeatMask()).toEqual([true, true, true, true]);
    });

    it('allows toggling individual beats (e.g. jazz hi-hat 2 & 4 feel)', () => {
      engine.toggleBeat(0); // Mute beat 1
      engine.toggleBeat(2); // Mute beat 3
      expect(engine.getBeatMask()).toEqual([false, true, false, true]);
      expect(engine.isBeatActive(0)).toBe(false);
      expect(engine.isBeatActive(1)).toBe(true);
      expect(engine.isBeatActive(2)).toBe(false);
      expect(engine.isBeatActive(3)).toBe(true);
    });

    it('allows setting custom beat mask directly', () => {
      engine.setBeatMask([true, false, true, false]);
      expect(engine.getBeatMask()).toEqual([true, false, true, false]);
    });

    it('adapts beat mask length when time signature changes', () => {
      engine.setTimeSignature('3/4');
      expect(engine.getBeatMask()).toEqual([true, true, true]);

      engine.setBeatMask([false, true, false]);
      engine.setTimeSignature('4/4');
      expect(engine.getBeatMask()).toEqual([false, true, false, true]);
    });
  });

  describe('Click Sound & Accent Customization', () => {
    it('provides sensible default click volumes and mute flags without pitch', () => {
      const config = engine.getClickConfig();
      expect(config.downbeat).toEqual({ volume: 1.0, muted: false });
      expect(config.regular).toEqual({ volume: 0.7, muted: false });
      expect(config.subdivision).toEqual({ volume: 0.5, muted: false, divisions: 1 });
      expect('pitch' in config.downbeat).toBe(false);
      expect('pitch' in config.regular).toBe(false);
      expect('pitch' in config.subdivision).toBe(false);
    });

    it('allows updating voice volume', () => {
      engine.updateVoiceConfig('downbeat', { volume: 0.9 });
      engine.updateVoiceConfig('regular', { volume: 0.6 });
      engine.updateVoiceConfig('subdivision', { volume: 0.4 });

      const config = engine.getClickConfig();
      expect(config.downbeat).toEqual({ volume: 0.9, muted: false });
      expect(config.regular).toEqual({ volume: 0.6, muted: false });
      expect(config.subdivision).toEqual({ volume: 0.4, muted: false, divisions: 1 });
    });

    it('allows replacing full click config', () => {
      engine.setClickConfig({
        downbeat: { volume: 0.8 },
      });
      expect(engine.getClickConfig().downbeat).toEqual({ volume: 0.8, muted: false });
      // Preserves untouched regular
      expect(engine.getClickConfig().regular.volume).toBe(0.7);
    });
  });

  describe('Gap Clicks (Subdivision Divisions)', () => {
    it('splits each beat into a configured number of equal parts', () => {
      engine.updateVoiceConfig('subdivision', { divisions: 3 });
      expect(engine.getClickConfig().subdivision).toEqual({ volume: 0.5, muted: false, divisions: 3 });
    });

    it('defaults to one part, which means no gap clicks', () => {
      expect(engine.getClickConfig().subdivision.divisions).toBe(1);
    });

    it('preserves the division count when only volume is changed', () => {
      engine.updateVoiceConfig('subdivision', { divisions: 4 });
      engine.updateVoiceConfig('subdivision', { volume: 0.8 });
      expect(engine.getClickConfig().subdivision).toEqual({ volume: 0.8, muted: false, divisions: 4 });
    });

    it('clamps the division count to whole parts between 1 and 8', () => {
      engine.updateVoiceConfig('subdivision', { divisions: 0 });
      expect(engine.getClickConfig().subdivision.divisions).toBe(1);
      engine.updateVoiceConfig('subdivision', { divisions: 20.6 });
      expect(engine.getClickConfig().subdivision.divisions).toBe(8);
    });
  });

  describe('Per-Voice Click Mute & Config Subscription', () => {
    it('initializes downbeat, regular, and subdivision voices with muted: false', () => {
      const config = engine.getClickConfig();
      expect(config.downbeat.muted).toBe(false);
      expect(config.regular.muted).toBe(false);
      expect(config.subdivision.muted).toBe(false);
    });

    it('preserves stored volume and divisions when setting muted on any click voice', () => {
      engine.updateVoiceConfig('downbeat', { volume: 0.85 });
      engine.updateVoiceConfig('downbeat', { muted: true });
      expect(engine.getClickConfig().downbeat.muted).toBe(true);
      expect(engine.getClickConfig().downbeat.volume).toBe(0.85);

      engine.updateVoiceConfig('subdivision', { volume: 0.4, divisions: 6 });
      engine.updateVoiceConfig('subdivision', { muted: true });
      expect(engine.getClickConfig().subdivision.muted).toBe(true);
      expect(engine.getClickConfig().subdivision.volume).toBe(0.4);
      expect(engine.getClickConfig().subdivision.divisions).toBe(6);
    });

    it('notifies registered listeners on click config changes and supports unsubscribe', () => {
      const received: Array<ReturnType<MetronomeEngine['getClickConfig']>> = [];
      const unsubscribe = engine.onClickConfigChange((cfg) => received.push(cfg));

      engine.updateVoiceConfig('downbeat', { muted: true });
      engine.setClickConfig({ regular: { volume: 0.3 } });
      expect(received).toHaveLength(2);
      expect(received[0].downbeat.muted).toBe(true);
      expect(received[1].regular.volume).toBe(0.3);

      unsubscribe();
      engine.updateVoiceConfig('subdivision', { divisions: 5 });
      expect(received).toHaveLength(2);
    });
  });

  describe('Tempo Ramp Calculation', () => {
    it('starts with ramp disabled by default', () => {
      const ramp = engine.getTempoRampConfig();
      expect(ramp.enabled).toBe(false);
    });

    it('computes interpolated BPM linearly over specified bars', () => {
      // 4 bars of 4/4 = 16 beats. Ramp 100 -> 140 BPM (+40 BPM over 16 beats = +2.5 BPM/beat)
      engine.setTempoRampConfig({
        enabled: true,
        startBpm: 100,
        targetBpm: 140,
        durationBars: 4,
      });

      // Bar 0, beat 0: start BPM
      expect(engine.calculateRampBpm(0, 0)).toBe(100);

      // Bar 1, beat 0 (beat 4/16 = 25% progress): 100 + 40 * 0.25 = 110
      expect(engine.calculateRampBpm(1, 0)).toBe(110);

      // Bar 2, beat 0 (beat 8/16 = 50% progress): 100 + 40 * 0.5 = 120
      expect(engine.calculateRampBpm(2, 0)).toBe(120);

      // Bar 3, beat 0 (beat 12/16 = 75% progress): 100 + 40 * 0.75 = 130
      expect(engine.calculateRampBpm(3, 0)).toBe(130);

      // Bar 4, beat 0 (beat 16/16 = 100% progress): reaches target BPM
      expect(engine.calculateRampBpm(4, 0)).toBe(140);

      // Subsequent bars clamp at target BPM
      expect(engine.calculateRampBpm(5, 0)).toBe(140);
    });

    it('provides ramp progress ratio and completion state', () => {
      engine.setTempoRampConfig({
        enabled: true,
        startBpm: 120,
        targetBpm: 160,
        durationBars: 2, // 8 beats total in 4/4
      });

      const p0 = engine.getRampProgress(0, 0);
      expect(p0.progress).toBe(0);
      expect(p0.currentBpm).toBe(120);
      expect(p0.isComplete).toBe(false);

      const pHalf = engine.getRampProgress(1, 0); // beat 4/8 = 0.5
      expect(pHalf.progress).toBe(0.5);
      expect(pHalf.currentBpm).toBe(140);
      expect(pHalf.isComplete).toBe(false);

      const pDone = engine.getRampProgress(2, 0); // beat 8/8 = 1.0
      expect(pDone.progress).toBe(1.0);
      expect(pDone.currentBpm).toBe(160);
      expect(pDone.isComplete).toBe(true);
    });
  });

  describe('Stochastic Dropout Mode', () => {
    it('is disabled by default with default probability of 25%', () => {
      const config = engine.getDropoutConfig();
      expect(config.enabled).toBe(false);
      expect(config.probability).toBe(0.25);
    });

    it('never mutes measures when disabled or probability is 0', () => {
      engine.setDropoutConfig({ enabled: false, probability: 1.0 });
      expect(engine.shouldMuteMeasure(0)).toBe(false);
      expect(engine.shouldMuteMeasure(1)).toBe(false);

      engine.setDropoutConfig({ enabled: true, probability: 0 });
      expect(engine.shouldMuteMeasure(0)).toBe(false);
    });

    it('always mutes measures when probability is 1.0 and enabled', () => {
      engine.setDropoutConfig({ enabled: true, probability: 1.0 });
      expect(engine.shouldMuteMeasure(0)).toBe(true);
      expect(engine.shouldMuteMeasure(1)).toBe(true);
      expect(engine.shouldMuteMeasure(10)).toBe(true);
    });

    it('produces deterministic dropout gating when seed is specified', () => {
      engine.setDropoutConfig({ enabled: true, probability: 0.5, seed: 1337 });

      // Measure 0 with seed 1337 always produces the same outcome
      const outcome0 = engine.shouldMuteMeasure(0);
      const outcome1 = engine.shouldMuteMeasure(1);
      const outcome2 = engine.shouldMuteMeasure(2);

      // Re-query with same seed
      expect(engine.shouldMuteMeasure(0, 1337)).toBe(outcome0);
      expect(engine.shouldMuteMeasure(1, 1337)).toBe(outcome1);
      expect(engine.shouldMuteMeasure(2, 1337)).toBe(outcome2);
    });

    it('consistently returns the same decision for all queries within the same measure in a session', () => {
      engine.setDropoutConfig({ enabled: true, probability: 0.5 });
      // Call multiple times without explicit seed
      const firstDecision = engine.shouldMuteMeasure(3);
      expect(engine.shouldMuteMeasure(3)).toBe(firstDecision);
      expect(engine.shouldMuteMeasure(3)).toBe(firstDecision);
    });
  });

  describe('NextBeat Event Properties & Mute Gating', () => {
    it('includes measureIndex, isMuted, isDropout, and bpm in BeatEvent', () => {
      engine.reset();
      const b0 = engine.nextBeat();
      expect(b0.beatIndex).toBe(0);
      expect(b0.measureIndex).toBe(0);
      expect(b0.isMuted).toBe(false);
      expect(b0.isDropout).toBe(false);
      expect(b0.bpm).toBe(120);

      engine.nextBeat(); // 1
      engine.nextBeat(); // 2
      engine.nextBeat(); // 3
      const m1b0 = engine.nextBeat(); // Next measure
      expect(m1b0.beatIndex).toBe(0);
      expect(m1b0.measureIndex).toBe(1);
    });

    it('flags isMuted=true when beat is disabled in beatMask', () => {
      engine.setBeatMask([false, true, false, true]); // 2 & 4 feel
      engine.reset();

      const b0 = engine.nextBeat();
      expect(b0.beatIndex).toBe(0);
      expect(b0.isMuted).toBe(true);

      const b1 = engine.nextBeat();
      expect(b1.beatIndex).toBe(1);
      expect(b1.isMuted).toBe(false);

      const b2 = engine.nextBeat();
      expect(b2.beatIndex).toBe(2);
      expect(b2.isMuted).toBe(true);

      const b3 = engine.nextBeat();
      expect(b3.beatIndex).toBe(3);
      expect(b3.isMuted).toBe(false);
    });

    it('flags isMuted=true and isDropout=true for all beats in a dropped out measure', () => {
      engine.setDropoutConfig({ enabled: true, probability: 1.0 }); // 100% dropout
      engine.reset();

      for (let i = 0; i < 4; i++) {
        const beat = engine.nextBeat();
        expect(beat.isDropout).toBe(true);
        expect(beat.isMuted).toBe(true);
        expect(beat.beatIndex).toBe(i); // timing and playhead indices still advance accurately!
      }
    });

    it('dynamically updates bpm in nextBeat when tempo ramp is active', () => {
      engine.setTempoRampConfig({
        enabled: true,
        startBpm: 100,
        targetBpm: 140,
        durationBars: 4, // 16 beats, +2.5 bpm per beat
      });
      engine.reset();

      const b0 = engine.nextBeat();
      expect(b0.bpm).toBe(100);

      // Advance 4 beats (measure 1 beat 0)
      engine.nextBeat();
      engine.nextBeat();
      engine.nextBeat();
      const b4 = engine.nextBeat();
      expect(b4.bpm).toBe(110);
      expect(engine.getTempo()).toBe(110);
    });
  });
});
