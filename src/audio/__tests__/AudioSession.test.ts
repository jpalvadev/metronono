import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { MetronomeEngine } from '../../domain/metronome/MetronomeEngine';
import { createRhythmicEvent } from '../../domain/rhythm/types';
import { fakeToneRecorder, fakeAudioBuffer } from '../../test/fakeTone';

// A full practice session through the transport interface alone (docs/adr/0011):
// 16+ fired beats with an ostinato active and a custom sample voice loaded must
// keep node creation bounded, resolve the domain once per cycled measure, retire
// every sample source, and leave nothing on the destination after dispose.
vi.mock('tone', async () => {
  const fake = await import('../../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

describe('Zero-allocation audio session', () => {
  beforeEach(() => {
    fakeToneRecorder.reset();
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

    // A two-measure line mixing straight figures and a triplet beat.
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

    // A custom sample on a drum voice: strokes spawn sources but no fresh gains.
    scheduler.applyCustomSampleBuffer('ride', fakeAudioBuffer(1, 44100, 44100)); // 1s window

    await scheduler.start();
    const resolvesAfterStart = dawson.resolveCalls;
    expect(resolvesAfterStart).toBe(2);

    const gainsAtStart = fakeToneRecorder.nodesOfKind('Gain').length;
    const synthAtStart =
      fakeToneRecorder.nodesOfKind('MembraneSynth').length +
      fakeToneRecorder.nodesOfKind('MetalSynth').length +
      fakeToneRecorder.nodesOfKind('NoiseSynth').length +
      fakeToneRecorder.nodesOfKind('Synth').length;

    fakeToneRecorder.transport.fireRepeats(16);

    // One resolve per cycled measure: sixteen beats = four measures over a two-measure plan.
    expect(dawson.resolveCalls).toBe(2);

    // Bounded graph: the sample voice's gain is pooled on first stroke (one
    // creation), then reused for every later stroke; synths never regrow.
    const gains = fakeToneRecorder.nodesOfKind('Gain');
    expect(gains.length).toBe(gainsAtStart + 1);
    expect(gains.filter((n) => (n.label ?? '') === 'sample:ostinato:mix')).toHaveLength(1);
    expect(
      fakeToneRecorder.nodesOfKind('MembraneSynth').length +
      fakeToneRecorder.nodesOfKind('MetalSynth').length +
      fakeToneRecorder.nodesOfKind('NoiseSynth').length +
      fakeToneRecorder.nodesOfKind('Synth').length
    ).toBe(synthAtStart);

    // Sources retired as their windows elapsed: at 200 bpm beats are 0.3s apart,
    // so every 1s-window source started before the last few beats is gone.
    const sources = fakeToneRecorder.bufferSources();
    expect(sources.length).toBeGreaterThan(0);
    const stillLive = sources.filter((s) => !s.disposed);
    expect(stillLive.length).toBeLessThan(sources.length);

    // Dispose disconnects everything feeding the destination.
    scheduler.dispose();
    expect(fakeToneRecorder.destination.incoming).toHaveLength(0);
  });
});
