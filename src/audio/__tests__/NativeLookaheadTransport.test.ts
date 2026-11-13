import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NativeLookaheadTransport,
  LOOKAHEAD_INTERVAL_MS,
  SCHEDULE_AHEAD_SEC,
} from '../NativeLookaheadTransport';
import { getAudioContext } from '../WebAudioContext';
import { FakeAudioBuffer, FakeAudioContext } from '../../test/fakeWebAudio';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { MetronomeEngine } from '../../domain/metronome/MetronomeEngine';

function fakeCtx(): FakeAudioContext {
  return getAudioContext() as unknown as FakeAudioContext;
}

describe('NativeLookaheadTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules beats within the 100ms lookahead window against AudioContext.currentTime', () => {
    const transport = new NativeLookaheadTransport();
    transport.bpm.value = 120; // 0.5s per quarter note
    const firedTimes: number[] = [];

    transport.scheduleRepeat((time) => {
      firedTimes.push(Number(time.toFixed(4)));
    }, '4n');

    // Start at currentTime = 0: beat 0 (t=0) is inside [0, 0.1) so it schedules immediately.
    transport.start();
    expect(firedTimes).toEqual([0]);

    // Advance hardware clock to 0.45s (beat 1 at 0.5s is now within 0.1s lookahead).
    fakeCtx().advanceTime(0.45);
    vi.advanceTimersByTime(LOOKAHEAD_INTERVAL_MS);
    expect(firedTimes).toEqual([0, 0.5]);

    // Advance to 0.95s (beat 2 at 1.0s is now within 0.1s lookahead).
    fakeCtx().advanceTime(0.5);
    vi.advanceTimersByTime(LOOKAHEAD_INTERVAL_MS);
    expect(firedTimes).toEqual([0, 0.5, 1.0]);

    transport.stop();
  });

  it('adjusts beat spacing dynamically when bpm changes (tempo ramps)', () => {
    const transport = new NativeLookaheadTransport();
    transport.bpm.value = 120; // 0.5s
    const firedTimes: number[] = [];

    transport.scheduleRepeat((time) => {
      firedTimes.push(Number(time.toFixed(4)));
      // Ramp to 240 BPM (0.25s per beat) after beat 0.
      if (firedTimes.length === 1) {
        transport.bpm.value = 240;
      }
    }, '4n');

    transport.start();
    expect(firedTimes).toEqual([0]);

    fakeCtx().advanceTime(0.2); // 0.2s + 0.1s lookahead = 0.3s > 0.25s
    vi.advanceTimersByTime(LOOKAHEAD_INTERVAL_MS);
    expect(firedTimes).toEqual([0, 0.25]);

    transport.stop();
  });

  it('halts the lookahead timer on stop() and does not fire further ticks', () => {
    const transport = new NativeLookaheadTransport();
    transport.bpm.value = 120;
    const cb = vi.fn();

    transport.scheduleRepeat(cb, '4n');
    transport.start();
    expect(cb).toHaveBeenCalledTimes(1);

    transport.stop();
    fakeCtx().advanceTime(2.0);
    vi.advanceTimersByTime(LOOKAHEAD_INTERVAL_MS * 10);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('drives ToneTransportScheduler Gap Clicks, stochastic muting, Playhead drawSync, and drains sources on stop()', async () => {
    const engine = new MetronomeEngine(120, '4/4');
    engine.updateVoiceConfig('subdivision', { divisions: 2, volume: 0.5 });

    const scheduler = new ToneTransportScheduler({ engine });
    const dummyBuffer = new FakeAudioBuffer(1, 2048, 44100) as unknown as AudioBuffer;
    const beats: number[] = [];
    scheduler.onBeat((b) => beats.push(b.beatIndex));

    await scheduler.start();
    scheduler.getClickPlayer()?.loadSampleBuffer?.('downbeat', dummyBuffer);
    scheduler.getClickPlayer()?.loadSampleBuffer?.('regular', dummyBuffer);
    scheduler.getClickPlayer()?.loadSampleBuffer?.('subdivision', dummyBuffer);

    // Advance one tick so beat 0 UI callback & audio fire, then advance 0.45s for beat 1.
    fakeCtx().advanceTime(0.45);
    vi.advanceTimersByTime(LOOKAHEAD_INTERVAL_MS);

    expect(beats.length).toBeGreaterThanOrEqual(1);
    expect(fakeCtx().bufferSources.length).toBeGreaterThanOrEqual(2); // downbeat + gap click

    scheduler.stop();
    for (const src of fakeCtx().bufferSources) {
      expect(src.stoppedAt).not.toBeNull();
      expect(src.disconnected).toBe(true);
    }
    expect(SCHEDULE_AHEAD_SEC).toBe(0.1);
  });

  it('supports variable-interval scheduling when scheduleRepeat callback returns next interval in seconds', () => {
    const transport = new NativeLookaheadTransport();
    transport.bpm.value = 120;
    const firedTimes: number[] = [];
    const intervals = [0.5, 0.5, 0.5, 0.375];
    let step = 0;

    transport.scheduleRepeat((time) => {
      firedTimes.push(Number(time.toFixed(4)));
      return intervals[step++ % intervals.length];
    }, '4n');

    transport.start();
    expect(firedTimes).toEqual([0]);

    for (let t = 0; t < 24; t++) {
      fakeCtx().advanceTime(0.1);
      vi.advanceTimersByTime(LOOKAHEAD_INTERVAL_MS);
    }

    expect(firedTimes.slice(0, 6)).toEqual([0, 0.5, 1, 1.5, 1.875, 2.375]);
    transport.stop();
  });

  it('schedules 15/16 Straight at 120 BPM at 0.0, 0.5, 1.0, 1.5, 1.875, 2.375 via ToneTransportScheduler', async () => {
    const engine = new MetronomeEngine(120, '15/16');
    const scheduledTimes: number[] = [];
    const mockClickPlayer = {
      play: vi.fn((_isDownbeat: boolean, time: number) => {
        scheduledTimes.push(Number(time.toFixed(4)));
      }),
      playSubdivision: vi.fn(),
    };

    const scheduler = new ToneTransportScheduler({
      engine,
      clickPlayer: mockClickPlayer,
    });

    await scheduler.start();
    for (let t = 0; t < 24; t++) {
      fakeCtx().advanceTime(0.1);
      vi.advanceTimersByTime(LOOKAHEAD_INTERVAL_MS);
    }

    expect(scheduledTimes.slice(0, 6)).toEqual([0, 0.5, 1, 1.5, 1.875, 2.375]);
    scheduler.stop();
  });
});
