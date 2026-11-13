import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { MetronomeEngine } from '../../domain/metronome/MetronomeEngine';

describe('ToneTransportScheduler', () => {
  let mockTransport: {
    bpm: { value: number };
    timeSignature: number;
    state: 'started' | 'stopped';
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    scheduleRepeat: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  let mockClickPlayer: {
    play: ReturnType<typeof vi.fn>;
    playSubdivision: ReturnType<typeof vi.fn>;
  };

  let scheduler: ToneTransportScheduler;
  let scheduledCallback: ((time: number) => void) | null = null;

  beforeEach(() => {
    mockTransport = {
      bpm: { value: 120 },
      timeSignature: 4,
      state: 'stopped',
      start: vi.fn().mockImplementation(() => {
        mockTransport.state = 'started';
      }),
      stop: vi.fn().mockImplementation(() => {
        mockTransport.state = 'stopped';
      }),
      scheduleRepeat: vi.fn().mockImplementation((cb: (time: number) => void) => {
        scheduledCallback = cb;
        return 101;
      }),
      clear: vi.fn(),
    };

    mockClickPlayer = {
      play: vi.fn(),
      playSubdivision: vi.fn(),
    };

    scheduler = new ToneTransportScheduler({
      engine: new MetronomeEngine(120, '4/4'),
      transport: mockTransport as any,
      clickPlayer: mockClickPlayer,
      drawSync: (fn) => fn(), // Immediate execution in tests
    });
  });

  it('initializes with default tempo', () => {
    expect(scheduler.getTempo()).toBe(120);
    expect(scheduler.isPlaying()).toBe(false);
  });

  it('starts playback and schedules repeat on transport', async () => {
    await scheduler.start();
    expect(scheduler.isPlaying()).toBe(true);
    expect(mockTransport.scheduleRepeat).toHaveBeenCalledWith(expect.any(Function), '4n');
    expect(mockTransport.start).toHaveBeenCalled();
  });

  it('triggers downbeat click on beat 0 and regular click on beat 1', async () => {
    const beatListener = vi.fn();
    scheduler.onBeat(beatListener);

    await scheduler.start();
    expect(scheduledCallback).not.toBeNull();

    // Trigger first beat (time = 1.0)
    scheduledCallback!(1.0);
    expect(mockClickPlayer.play).toHaveBeenCalledWith(true, 1.0, 1.0);
    expect(beatListener).toHaveBeenCalledWith(expect.objectContaining({ beatIndex: 0, isDownbeat: true }));

    // Trigger second beat (time = 1.5)
    scheduledCallback!(1.5);
    expect(mockClickPlayer.play).toHaveBeenCalledWith(false, 1.5, 0.7);
    expect(beatListener).toHaveBeenCalledWith(expect.objectContaining({ beatIndex: 1, isDownbeat: false }));
  });

  it('stops playback and clears scheduled repeat', async () => {
    await scheduler.start();
    scheduler.stop();
    expect(scheduler.isPlaying()).toBe(false);
    expect(mockTransport.stop).toHaveBeenCalled();
    expect(mockTransport.clear).toHaveBeenCalledWith(101);
  });

  it('updates tempo and synchronizes transport bpm', () => {
    scheduler.setTempo(140);
    expect(scheduler.getTempo()).toBe(140);
    expect(mockTransport.bpm.value).toBe(140);
  });

  it('updates time signature and recalculates schedule interval if running', async () => {
    await scheduler.start();
    expect(mockTransport.scheduleRepeat).toHaveBeenCalledWith(expect.any(Function), '4n');

    scheduler.setTimeSignature('7/8');
    expect(mockTransport.timeSignature).toBe(4);
    expect(mockTransport.clear).toHaveBeenCalledWith(101);
    expect(mockTransport.scheduleRepeat).toHaveBeenLastCalledWith(expect.any(Function), '4n');

    scheduler.setTimeSignature('15/16');
    expect(mockTransport.timeSignature).toBe(4);
    expect(mockTransport.scheduleRepeat).toHaveBeenLastCalledWith(expect.any(Function), '4n');

    scheduler.setTimeSignature('21/16');
    expect(mockTransport.timeSignature).toBe(6);
    expect(mockTransport.scheduleRepeat).toHaveBeenLastCalledWith(expect.any(Function), '4n');
  });

  it('subdivides nominal quarter-note pulses for Gap Clicks and clips subdivisions at truncated measure boundaries', async () => {
    // 120 BPM (quarter = 0.5s), 7/8 -> 4 pulses: 0.5s, 0.5s, 0.5s, 0.25s
    // With divisions = 4, nominal offsets are +0.125s, +0.25s, +0.375s
    scheduler.setTimeSignature('7/8');
    scheduler.setClickConfig({ subdivision: { divisions: 4 } });
    await scheduler.start();

    // Beat 0 (0.5s): all 3 gap clicks fire
    mockClickPlayer.playSubdivision.mockClear();
    const next0 = scheduledCallback!(1.0);
    expect(next0).toBeCloseTo(0.5, 6);
    expect(mockClickPlayer.playSubdivision.mock.calls.map((c) => Number(c[0].toFixed(4)))).toEqual([
      1.125,
      1.25,
      1.375,
    ]);

    // Beat 1 & 2
    scheduledCallback!(1.5);
    scheduledCallback!(2.0);

    // Beat 3 (truncated to 0.25s): only +0.125s fires; +0.25s and +0.375s are clipped!
    mockClickPlayer.playSubdivision.mockClear();
    const next3 = scheduledCallback!(2.5);
    expect(next3).toBeCloseTo(0.25, 6);
    expect(mockClickPlayer.playSubdivision.mock.calls.map((c) => Number(c[0].toFixed(4)))).toEqual([
      2.625,
    ]);
  });


  describe('Advanced Training Features', () => {
    it('silences click playback when a beat is muted by beatMask while maintaining beat callbacks', async () => {
      const beatListener = vi.fn();
      scheduler.onBeat(beatListener);

      // Mask: beats 0 and 2 muted, beats 1 and 3 active (jazz 2 & 4 feel)
      scheduler.setBeatMask([false, true, false, true]);

      await scheduler.start();
      expect(scheduledCallback).not.toBeNull();

      // Beat 0: muted
      mockClickPlayer.play.mockClear();
      scheduledCallback!(1.0);
      expect(mockClickPlayer.play).not.toHaveBeenCalled();
      expect(beatListener).toHaveBeenCalledWith(
        expect.objectContaining({ beatIndex: 0, isMuted: true })
      );

      // Beat 1: active
      mockClickPlayer.play.mockClear();
      scheduledCallback!(1.5);
      expect(mockClickPlayer.play).toHaveBeenCalledWith(false, 1.5, expect.any(Number));
      expect(beatListener).toHaveBeenCalledWith(
        expect.objectContaining({ beatIndex: 1, isMuted: false })
      );
    });

    it('silences click playback when a measure is in dropout mode while maintaining beat callbacks and playhead', async () => {
      const beatListener = vi.fn();
      const dropoutListener = vi.fn();
      scheduler.onBeat(beatListener);
      scheduler.onDropoutChange(dropoutListener);

      // 100% dropout to ensure measure is silenced
      scheduler.setDropoutConfig({ enabled: true, probability: 1.0 });

      await scheduler.start();

      // Beat 0 of Measure 0
      mockClickPlayer.play.mockClear();
      scheduledCallback!(1.0);

      // Audio click must NOT be played
      expect(mockClickPlayer.play).not.toHaveBeenCalled();

      // But visual callbacks and playhead advance without interruption!
      expect(beatListener).toHaveBeenCalledWith(
        expect.objectContaining({ beatIndex: 0, isDropout: true, isMuted: true })
      );
      expect(dropoutListener).toHaveBeenCalledWith(true);
    });

    it('gates beat clicks and Gap Clicks on a deterministic 1 click / 1 silent bar cycle while continuing callbacks', async () => {
      const beatListener = vi.fn();
      const dropoutListener = vi.fn();
      scheduler.onBeat(beatListener);
      scheduler.onDropoutChange(dropoutListener);

      scheduler.setClickConfig({ subdivision: { divisions: 2 } });
      scheduler.setDropoutConfig({ enabled: true, probability: 0, clickBars: 1, silentBars: 1 });

      await scheduler.start();

      // Measure 0 (4 beats): audible (downbeat + regular + gap clicks)
      mockClickPlayer.play.mockClear();
      mockClickPlayer.playSubdivision.mockClear();
      for (let b = 0; b < 4; b++) {
        scheduledCallback!(1.0 + b * 0.5);
      }
      expect(mockClickPlayer.play).toHaveBeenCalledTimes(4);
      expect(mockClickPlayer.playSubdivision).toHaveBeenCalledTimes(4);

      // Measure 1 (4 beats): completely silent (neither main nor gap clicks)
      mockClickPlayer.play.mockClear();
      mockClickPlayer.playSubdivision.mockClear();
      for (let b = 0; b < 4; b++) {
        scheduledCallback!(3.0 + b * 0.5);
      }
      expect(mockClickPlayer.play).not.toHaveBeenCalled();
      expect(mockClickPlayer.playSubdivision).not.toHaveBeenCalled();
      expect(dropoutListener).toHaveBeenCalledWith(true);

      // Measure 2 beat 0: audible again
      mockClickPlayer.play.mockClear();
      mockClickPlayer.playSubdivision.mockClear();
      scheduledCallback!(5.0);
      expect(mockClickPlayer.play).toHaveBeenCalledTimes(1);
      expect(mockClickPlayer.playSubdivision).toHaveBeenCalledTimes(1);
      expect(dropoutListener).toHaveBeenCalledWith(false);
      expect(beatListener).toHaveBeenCalledTimes(9);
    });

    it('automates dynamic tempo changes to transport bpm during tempo ramp', async () => {
      scheduler.setTempoRampConfig({
        enabled: true,
        startBpm: 100,
        targetBpm: 140,
        durationBars: 4, // 16 beats total, +2.5 bpm per beat
      });

      await scheduler.start();

      // Beat 0: 100 BPM
      scheduledCallback!(1.0);
      expect(mockTransport.bpm.value).toBe(100);

      // Advance 4 beats (Bar 1, Beat 0 -> 25% through ramp)
      scheduledCallback!(1.5);
      scheduledCallback!(2.0);
      scheduledCallback!(2.5);
      scheduledCallback!(3.0);
      expect(mockTransport.bpm.value).toBe(110);
    });

    it('restores the saved pre-ramp BPM on the active transport when ramp is disabled mid-playback', async () => {
      scheduler.setTempo(92);
      await scheduler.start();

      scheduler.setTempoRampConfig({
        enabled: true,
        startBpm: 120,
        targetBpm: 160,
        durationBars: 2,
      });

      // Play a couple of beats into the ramp
      scheduledCallback!(1.0);
      scheduledCallback!(1.5);
      expect(mockTransport.bpm.value).toBeGreaterThanOrEqual(120);

      // Disable ramp -> transport BPM immediately restores to 92
      scheduler.setTempoRampConfig({ enabled: false });
      expect(scheduler.getTempo()).toBe(92);
      expect(mockTransport.bpm.value).toBe(92);
    });

    it('passes customized click volume to click player without pitch', async () => {
      scheduler.setClickConfig({
        downbeat: { volume: 0.95 },
        regular: { volume: 0.45 },
      });

      await scheduler.start();

      // Downbeat (beat 0)
      scheduledCallback!(1.0);
      expect(mockClickPlayer.play).toHaveBeenCalledWith(true, 1.0, 0.95);

      // Regular beat (beat 1)
      scheduledCallback!(1.5);
      expect(mockClickPlayer.play).toHaveBeenCalledWith(false, 1.5, 0.45);
    });

    it('schedules Dawson drum events in sync with beat ticks on audio clock', async () => {
      const mockDrumPlayer = {
        initSynths: vi.fn(() => true),
        play: vi.fn(),
        triggerVoice: vi.fn(),
        loadSampleBuffer: vi.fn(),
        removeSampleBuffer: vi.fn(),
        hasCustomSample: vi.fn(() => false),
        clearAllCustomSamples: vi.fn(),
      };

      const { DawsonEngine } = await import('../../domain/dawson/DawsonEngine');
      const { createRhythmicEvent } = await import('../../domain/rhythm/types');

      const dawsonEngine = new DawsonEngine({ mode: 'classic_bop', ostinato: 'jazz_swing' });
      scheduler.setDawsonEngine(dawsonEngine);
      scheduler.setDrumKitPlayer(mockDrumPlayer);

      // Reading line with M0: Quarter (Kick at 0), Two Eighths (Snare at 1.0, 1.5), Half (Kick at 2.0)
      scheduler.setReadingLine({
        id: 'test-line',
        title: 'Test Line',
        tier: 1,
        measures: [
          {
            index: 0,
            timeSignature: [4, 4],
            totalBeats: 4,
            events: [
              createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }),
              createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
              createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
              createRhythmicEvent({ durationBeats: 2.0, durationType: 'half' }),
            ],
          },
        ],
      });

      await scheduler.start();

      // Trigger Beat 0 at time = 10.0s (tempo 120 bpm -> beatDuration = 0.5s)
      scheduledCallback!(10.0);

      // On beat 0: Ride (ostinato at time 10.0) and Kick (orchestration at time 10.0)
      expect(mockDrumPlayer.play).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'ride', source: 'ostinato' }),
        10.0
      );
      expect(mockDrumPlayer.play).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'kick', source: 'orchestration' }),
        10.0
      );

      mockDrumPlayer.play.mockClear();

      // Trigger Beat 1 at time = 10.5s (b = 1)
      // Events in beat 1:
      // - Ostinato Ride at 1.0 (subOffset 0 -> 10.5s)
      // - Ostinato Hi-hat at 1.0 (subOffset 0 -> 10.5s)
      // - Orchestration Snare at 1.0 (subOffset 0 -> 10.5s)
      // - Orchestration Snare at 1.5 (subOffset 0.5 -> 10.5 + 0.5*0.5 = 10.75s)
      // - Ostinato Ride swing offbeat at 1.667 (subOffset 0.667 -> 10.5 + 0.667*0.5 = 10.8335s)
      scheduledCallback!(10.5);

      expect(mockDrumPlayer.play).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'ride', source: 'ostinato' }),
        10.5
      );
      expect(mockDrumPlayer.play).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'hihat_foot', source: 'ostinato' }),
        10.5
      );
      expect(mockDrumPlayer.play).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'snare', source: 'orchestration', timeInMeasure: 1.0 }),
        10.5
      );
      expect(mockDrumPlayer.play).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'snare', source: 'orchestration', timeInMeasure: 1.5 }),
        10.75
      );
      expect(mockDrumPlayer.play).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'ride', source: 'ostinato', timeInMeasure: 1.667 }),
        expect.closeTo(10.8335, 3)
      );
    });
  });

  describe('Gap Click Subdivision Scheduling', () => {
    // 120 BPM -> 0.5s beats. Gap clicks must land on the audio clock at the
    // even fractions of each beat, through the subdivision voice.
    it('plays no gap clicks while the beat is undivided', async () => {
      await scheduler.start();
      scheduledCallback!(1.0);
      expect(mockClickPlayer.play).toHaveBeenCalledWith(true, 1.0, 1.0);
      expect(mockClickPlayer.playSubdivision).not.toHaveBeenCalled();
    });

    it('clicks the gap at the middle of every beat when split into two', async () => {
      scheduler.setClickConfig({ subdivision: { divisions: 2 } });
      await scheduler.start();

      // Beat 0 at 1.0s: gap click at the half-beat 1.25s
      scheduledCallback!(1.0);
      expect(mockClickPlayer.playSubdivision).toHaveBeenCalledWith(1.25, 0.5);

      // Beat 1 at 1.5s: gap click at 1.75s
      mockClickPlayer.playSubdivision.mockClear();
      scheduledCallback!(1.5);
      expect(mockClickPlayer.playSubdivision).toHaveBeenCalledWith(1.75, 0.5);
    });

    it('splits the beat into three evenly spaced gap clicks', async () => {
      scheduler.setClickConfig({ subdivision: { divisions: 3 } });
      await scheduler.start();

      // Beat 0 at 1.0s: gap clicks at a third and two thirds of the 0.5s beat
      scheduledCallback!(1.0);
      expect(mockClickPlayer.playSubdivision).toHaveBeenCalledWith(
        expect.closeTo(1.1667, 3),
        0.5
      );
      expect(mockClickPlayer.playSubdivision).toHaveBeenCalledWith(
        expect.closeTo(1.3333, 3),
        0.5
      );
    });

    it('uses the configured subdivision volume without pitch', async () => {
      scheduler.setClickConfig({
        subdivision: { volume: 0.35, divisions: 2 },
      });
      await scheduler.start();

      scheduledCallback!(1.0);
      expect(mockClickPlayer.playSubdivision).toHaveBeenCalledWith(1.25, 0.35);
    });

    it('silences gap clicks of a beat muted by the beat mask', async () => {
      const beatListener = vi.fn();
      scheduler.onBeat(beatListener);

      scheduler.setClickConfig({ subdivision: { divisions: 4 } });
      scheduler.setBeatMask([false, true, true, true]);
      await scheduler.start();

      // Beat 0 muted: neither the beat click nor its gap clicks are heard...
      scheduledCallback!(1.0);
      expect(mockClickPlayer.play).not.toHaveBeenCalled();
      expect(mockClickPlayer.playSubdivision).not.toHaveBeenCalled();

      // ...but the beat still advances the playhead
      expect(beatListener).toHaveBeenCalledWith(
        expect.objectContaining({ beatIndex: 0, isMuted: true })
      );
    });

    it('keeps gap clicks following the beat through a tempo ramp', async () => {
      scheduler.setTempoRampConfig({
        enabled: true,
        startBpm: 60,
        targetBpm: 60,
        durationBars: 4,
      });
      scheduler.setClickConfig({ subdivision: { divisions: 2 } });
      await scheduler.start();

      // 60 BPM -> 1s beats: the gap click of the beat at 1.0s lands at 1.5s
      scheduledCallback!(1.0);
      expect(mockClickPlayer.playSubdivision).toHaveBeenCalledWith(1.5, 0.5);
    });
  });

  describe('Non-Destructive 4/4 Exercise Gate', () => {
    it('notifies onTimeSignatureChange listeners and supports unsubscribe', () => {
      const listener = vi.fn();
      const unsubscribe = scheduler.onTimeSignatureChange(listener);

      scheduler.setTimeSignature('7/8');
      expect(listener).toHaveBeenCalledWith({ beats: 7, beatUnit: 8 });

      unsubscribe();
      scheduler.setTimeSignature('4/4');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('suspends Ostinato and Dawson orchestration in non-4/4 meters and restores them on return to 4/4', async () => {
      const { DawsonEngine } = await import('../../domain/dawson/DawsonEngine');
      const { REED_PAGE_37_EXERCISE_ONE } = await import('../../domain/rhythm/ReedLibrary');
      const dawsonEngine = new DawsonEngine();
      dawsonEngine.setOstinato('jazz_swing');

      const mockDrumPlayer = {
        play: vi.fn(),
        triggerVoice: vi.fn(),
        initSynths: vi.fn(),
        dispose: vi.fn(),
      };

      scheduler.setDawsonEngine(dawsonEngine);
      scheduler.setDrumKitPlayer(mockDrumPlayer as any);
      scheduler.setReadingLine(REED_PAGE_37_EXERCISE_ONE);

      // Start in 4/4: drum events play
      await scheduler.start();
      scheduledCallback!(1.0);
      expect(mockDrumPlayer.play).toHaveBeenCalled();

      // Switch to 7/8 while playing: drum events are suspended, selections preserved
      mockDrumPlayer.play.mockClear();
      scheduler.setTimeSignature('7/8');
      scheduledCallback!(1.25);
      expect(mockDrumPlayer.play).not.toHaveBeenCalled();
      expect(dawsonEngine.getOstinato()).toBe('jazz_swing');
      expect(dawsonEngine.getSystem()).not.toBeNull();
      expect(scheduler.getReadingLine()).toBe(REED_PAGE_37_EXERCISE_ONE);

      // Return to 4/4: drum events resume automatically
      mockDrumPlayer.play.mockClear();
      scheduler.setTimeSignature('4/4');
      scheduledCallback!(2.0);
      expect(mockDrumPlayer.play).toHaveBeenCalled();

      // Switch to Triplet feel in 4/4: drum events are suspended, selections preserved
      mockDrumPlayer.play.mockClear();
      scheduler.setPulseFeel('triplet');
      scheduledCallback!(2.5);
      expect(mockDrumPlayer.play).not.toHaveBeenCalled();
      expect(dawsonEngine.getOstinato()).toBe('jazz_swing');

      // Return to Straight feel in 4/4: drum events resume automatically
      mockDrumPlayer.play.mockClear();
      scheduler.setPulseFeel('straight');
      scheduledCallback!(3.0);
      expect(mockDrumPlayer.play).toHaveBeenCalled();
    });

    it('reschedules immediately and notifies listeners when pulseFeel changes during playback', async () => {
      const feelListener = vi.fn();
      const unsub = scheduler.onPulseFeelChange(feelListener);

      scheduler.setTimeSignature('6/8');
      scheduler.setClickConfig({ subdivision: { divisions: 3 } });
      await scheduler.start();

      mockTransport.clear.mockClear();
      mockTransport.scheduleRepeat.mockClear();

      scheduler.setPulseFeel('triplet');
      expect(scheduler.getPulseFeel()).toBe('triplet');
      expect(feelListener).toHaveBeenCalledWith('triplet');
      expect(mockTransport.timeSignature).toBe(2);
      expect(mockTransport.clear).toHaveBeenCalledWith(101);
      expect(mockTransport.scheduleRepeat).toHaveBeenCalled();

      // 6/8 Triplet at 120 BPM -> 0.75s pulse, 3 divisions -> +0.25s, +0.5s
      mockClickPlayer.playSubdivision.mockClear();
      const nextInterval = scheduledCallback!(1.0);
      expect(nextInterval).toBeCloseTo(0.75, 6);
      expect(mockClickPlayer.playSubdivision.mock.calls.map((c) => Number(c[0].toFixed(4)))).toEqual([
        1.25,
        1.5,
      ]);

      unsub();
    });
  });
});
