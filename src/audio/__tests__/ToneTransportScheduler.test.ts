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
    };

    scheduler = new ToneTransportScheduler({
      engine: new MetronomeEngine(120, '4/4'),
      transport: mockTransport as any,
      clickPlayer: mockClickPlayer,
      drawSync: (fn) => fn(), // Immediate execution in tests
    });
  });

  it('initializes with default tempo and volume', () => {
    expect(scheduler.getTempo()).toBe(120);
    expect(scheduler.getVolume()).toBe(0.8);
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
    expect(mockClickPlayer.play).toHaveBeenCalledWith(true, 1.0, 1.0, 'A6');
    expect(beatListener).toHaveBeenCalledWith(expect.objectContaining({ beatIndex: 0, isDownbeat: true }));

    // Trigger second beat (time = 1.5)
    scheduledCallback!(1.5);
    expect(mockClickPlayer.play).toHaveBeenCalledWith(false, 1.5, 0.7, 'E5');
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
    scheduler.setTimeSignature('3/4');
    expect(scheduler.getTimeSignature()).toEqual({ beats: 3, beatUnit: 4 });
    expect(mockTransport.timeSignature).toBe(3);
  });

  it('sets and clamps the Mixer Master volume between 0 and 1', () => {
    scheduler.setVolume(0.5);
    expect(scheduler.getVolume()).toBe(0.5);
    expect(scheduler.getAudioMixer().getMasterVolume()).toBe(0.5);

    scheduler.setVolume(1.5);
    expect(scheduler.getVolume()).toBe(1.0);

    scheduler.setVolume(-0.2);
    expect(scheduler.getVolume()).toBe(0.0);
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
      expect(mockClickPlayer.play).toHaveBeenCalledWith(false, 1.5, expect.any(Number), expect.any(String));
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

    it('passes customized click pitch and volume to click player', async () => {
      scheduler.setClickConfig({
        downbeat: { pitch: 'C7', volume: 0.95 },
        regular: { pitch: 'G4', volume: 0.45 },
      });

      await scheduler.start();

      // Downbeat (beat 0)
      scheduledCallback!(1.0);
      expect(mockClickPlayer.play).toHaveBeenCalledWith(true, 1.0, 0.95, 'C7');

      // Regular beat (beat 1)
      scheduledCallback!(1.5);
      expect(mockClickPlayer.play).toHaveBeenCalledWith(false, 1.5, 0.45, 'G4');
    });

    it('schedules Dawson drum events in sync with beat ticks on audio clock', async () => {
      const mockDrumPlayer = {
        initSynths: vi.fn(() => true),
        play: vi.fn(),
        triggerVoice: vi.fn(),
        onDrumHit: vi.fn(),
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

      const drumHitListener = vi.fn();
      scheduler.onDrumHit(drumHitListener);

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
      expect(drumHitListener).toHaveBeenCalledWith(expect.objectContaining({ voice: 'ride' }));
      expect(drumHitListener).toHaveBeenCalledWith(expect.objectContaining({ voice: 'kick' }));

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
});
