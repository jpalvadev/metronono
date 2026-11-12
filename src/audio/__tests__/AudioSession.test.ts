import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { MetronomeEngine } from '../../domain/metronome/MetronomeEngine';
import { createRhythmicEvent } from '../../domain/rhythm/types';
import { getAudioContext } from '../WebAudioContext';
import { LOOKAHEAD_INTERVAL_MS } from '../NativeLookaheadTransport';
import { FakeAudioBuffer, FakeAudioContext } from '../../test/fakeWebAudio';

function fakeCtx(): FakeAudioContext {
  return getAudioContext() as unknown as FakeAudioContext;
}

describe('Zero-allocation audio session (Pure Web Audio)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds the discipline across a full session', async () => {
    const { DawsonEngine } = await import('../../domain/dawson/DawsonEngine');

    class CountingDawson extends DawsonEngine {
      public resolveCalls = 0;
      public resolveMeasure(measure: any, measureIndex?: number) {
        this.resolveCalls += 1;
        return super.resolveMeasure(measure, measureIndex);
      }
    }

    const dawson = new CountingDawson({ mode: 'classic_bop', ostinato: 'jazz_swing' });
    const scheduler = new ToneTransportScheduler({
      engine: new MetronomeEngine(200, '4/4'),
      dawsonEngine: dawson,
    });

    const straight = [
      createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }),
      createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
      createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
      createRhythmicEvent({ durationBeats: 2.0, durationType: 'half' }),
    ];
    const withTriplet = [
      createRhythmicEvent({ durationBeats: 2.0, durationType: 'half' }),
      createRhythmicEvent({ durationBeats: 1 / 3, durationType: '8th' }),
      createRhythmicEvent({ durationBeats: 1 / 3, durationType: '8th' }),
      createRhythmicEvent({ durationBeats: 1 / 3, durationType: '8th' }),
      createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }),
    ];
    scheduler.setReadingLine({
      id: 'session-line',
      title: 'Session Line',
      tier: 1,
      measures: [
        { index: 0, timeSignature: [4, 4], totalBeats: 4, events: straight },
        { index: 1, timeSignature: [4, 4], totalBeats: 4, events: withTriplet },
      ],
    });

    const rideSample = new FakeAudioBuffer(1, 44100, 44100) as unknown as AudioBuffer;
    scheduler.applyCustomSampleBuffer('ride', rideSample);

    await scheduler.start();
    expect(dawson.resolveCalls).toBe(2);

    const ctx = fakeCtx();
    const beatSec = 60 / 200;
    for (let i = 0; i < 16; i++) {
      ctx.advanceTime(beatSec);
      vi.advanceTimersByTime(LOOKAHEAD_INTERVAL_MS);
    }

    // One resolve per cycled measure: sixteen beats = four measures over a two-measure plan.
    expect(dawson.resolveCalls).toBe(2);
    expect(ctx.bufferSources.length).toBeGreaterThan(0);

    // When sources finish playing (onended), both source and per-hit GainNode disconnect.
    for (const src of ctx.bufferSources) {
      src.triggerEnded();
      expect(src.disconnected).toBe(true);
    }

    // Dispose disconnects everything feeding the destination.
    scheduler.dispose();
    expect(ctx.destination.incoming).toHaveLength(0);
  });
});
