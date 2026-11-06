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

  let mockVolume: {
    setVolume: ReturnType<typeof vi.fn>;
    getVolume: ReturnType<typeof vi.fn>;
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

    let vol = 0.8;
    mockVolume = {
      setVolume: vi.fn().mockImplementation((v: number) => {
        vol = v;
      }),
      getVolume: vi.fn().mockImplementation(() => vol),
    };

    scheduler = new ToneTransportScheduler({
      engine: new MetronomeEngine(120, '4/4'),
      transport: mockTransport as any,
      clickPlayer: mockClickPlayer,
      volumeControl: mockVolume,
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
    expect(mockClickPlayer.play).toHaveBeenCalledWith(true, 1.0);
    expect(beatListener).toHaveBeenCalledWith(expect.objectContaining({ beatIndex: 0, isDownbeat: true }));

    // Trigger second beat (time = 1.5)
    scheduledCallback!(1.5);
    expect(mockClickPlayer.play).toHaveBeenCalledWith(false, 1.5);
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

  it('sets and clamps master volume between 0 and 1', () => {
    scheduler.setVolume(0.5);
    expect(mockVolume.setVolume).toHaveBeenCalledWith(0.5);

    scheduler.setVolume(1.5);
    expect(mockVolume.setVolume).toHaveBeenCalledWith(1.0);

    scheduler.setVolume(-0.2);
    expect(mockVolume.setVolume).toHaveBeenCalledWith(0.0);
  });
});
