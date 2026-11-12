import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { MetronomeEngine } from '../../domain/metronome/MetronomeEngine';
import { createRhythmicEvent } from '../../domain/rhythm/types';
import type { Measure } from '../../domain/rhythm/types';
import { getAudioContext } from '../WebAudioContext';
import { LOOKAHEAD_INTERVAL_MS } from '../NativeLookaheadTransport';
import { FakeAudioBuffer, FakeAudioContext } from '../../test/fakeWebAudio';
import { DrumVoice } from '../../domain/dawson/types';

const ALL_DRUM_VOICES: DrumVoice[] = [
  'kick', 'snare', 'snare_ghost', 'tom_high', 'tom_mid', 'tom_floor',
  'ride', 'ride_bell', 'hihat_closed', 'hihat_open', 'hihat_foot', 'crash',
];

function fakeCtx(): FakeAudioContext {
  return getAudioContext() as unknown as FakeAudioContext;
}

function advanceBeats(count: number, bpm = 120): void {
  const ctx = fakeCtx();
  const beatSec = 60 / bpm;
  for (let i = 0; i < count; i++) {
    ctx.advanceTime(beatSec);
    vi.advanceTimersByTime(LOOKAHEAD_INTERVAL_MS);
  }
}

const dummyBuffer = new FakeAudioBuffer(1, 2048, 44100) as unknown as AudioBuffer;

function loadAllDrumSamples(scheduler: ToneTransportScheduler) {
  const player = scheduler.getDrumKitPlayer();
  for (const voice of ALL_DRUM_VOICES) {
    player.loadSampleBuffer?.(voice, dummyBuffer);
  }
}

function sampleSourcesWithLabel(label: string) {
  return fakeCtx().bufferSources.filter((s) => (s.connectedTo[0]?.label ?? '') === label);
}

describe('Measure Plan lookahead scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves the domain once per measure instead of once per beat', async () => {
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
      engine: new MetronomeEngine(120, '4/4'),
    });
    scheduler.setDawsonEngine(dawson);
    const measure = (index: number): Measure => ({
      index,
      timeSignature: [4, 4],
      totalBeats: 4,
      events: [
        createRhythmicEvent({ durationBeats: 1.0, durationType: 'quarter' }),
        createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
        createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
        createRhythmicEvent({ durationBeats: 2.0, durationType: 'half' }),
      ],
    });
    scheduler.setReadingLine({
      id: 'plan-line',
      title: 'Plan Line',
      tier: 1,
      measures: [measure(0), measure(1)],
    });

    await scheduler.start();
    expect(dawson.resolveCalls).toBe(2);

    advanceBeats(6);
    expect(dawson.resolveCalls).toBe(2);

    advanceBeats(6);
    expect(dawson.resolveCalls).toBe(2);
    scheduler.dispose();
  });

  it('hears an ostinato edited mid-session without restarting', async () => {
    const { DawsonEngine } = await import('../../domain/dawson/DawsonEngine');
    const dawson = new DawsonEngine({ mode: 'classic_bop', ostinato: 'jazz_swing' });

    const scheduler = new ToneTransportScheduler({
      engine: new MetronomeEngine(120, '4/4'),
    });
    scheduler.setDawsonEngine(dawson);
    scheduler.setReadingLine({
      id: 'plan-line',
      title: 'Plan Line',
      tier: 1,
      measures: [
        {
          index: 0,
          timeSignature: [4, 4],
          totalBeats: 4,
          events: [createRhythmicEvent({ durationBeats: 4.0, durationType: 'whole' })],
        },
      ],
    });

    loadAllDrumSamples(scheduler);
    await scheduler.start();

    const ostinatoRideCount = () => sampleSourcesWithLabel('sample:ostinato:mix').length;

    advanceBeats(3);
    const ridesBeforeEdit = ostinatoRideCount();
    expect(ridesBeforeEdit).toBeGreaterThan(0);

    dawson.setOstinato('none');
    advanceBeats(4);
    expect(ostinatoRideCount()).toBe(ridesBeforeEdit);
    scheduler.dispose();
  });

  it('strokes land on the same audio-clock instants as the per-beat resolve did', async () => {
    const { DawsonEngine } = await import('../../domain/dawson/DawsonEngine');
    const dawson = new DawsonEngine({ mode: 'classic_bop', ostinato: 'none' });

    const scheduler = new ToneTransportScheduler({
      engine: new MetronomeEngine(120, '4/4'),
    });
    scheduler.setDawsonEngine(dawson);
    scheduler.setReadingLine({
      id: 'plan-line',
      title: 'Plan Line',
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

    loadAllDrumSamples(scheduler);
    await scheduler.start(); // Fires beat 0 at t=0 (kick)
    const orchSources = () => sampleSourcesWithLabel('sample:orchestration:mix');
    expect(orchSources().length).toBeGreaterThan(0);
    expect(orchSources()[0].startedAt).toBeCloseTo(0, 5);

    advanceBeats(2); // Fires beat 1 (0.5, 0.75) and beat 2 (1.0)
    expect(orchSources().map((s) => s.startedAt)).toEqual([0, 0.5, 0.75, 1]);
    scheduler.dispose();
  });

  it('a reading line swapped mid-session retargets the next measures', async () => {
    const { DawsonEngine } = await import('../../domain/dawson/DawsonEngine');
    const dawson = new DawsonEngine({ mode: 'classic_bop', ostinato: 'none' });

    const scheduler = new ToneTransportScheduler({ engine: new MetronomeEngine(120, '4/4') });
    scheduler.setDawsonEngine(dawson);
    scheduler.setReadingLine({
      id: 'line-a',
      title: 'Line A',
      tier: 1,
      measures: [
        {
          index: 0,
          timeSignature: [4, 4],
          totalBeats: 4,
          events: [createRhythmicEvent({ durationBeats: 4.0, durationType: 'whole' })],
        },
      ],
    });

    scheduler.getDrumKitPlayer().loadSampleBuffer?.('kick', dummyBuffer);
    await scheduler.start(); // Fires beat 0 (kick)
    const kicksBeforeSwap = sampleSourcesWithLabel('sample:orchestration:mix').length;
    expect(kicksBeforeSwap).toBeGreaterThan(0);

    scheduler.setReadingLine({
      id: 'line-b',
      title: 'Line B',
      tier: 1,
      measures: [
        {
          index: 0,
          timeSignature: [4, 4],
          totalBeats: 4,
          events: [
            createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
            createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
            createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
            createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
            createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
            createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
            createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
            createRhythmicEvent({ durationBeats: 0.5, durationType: '8th' }),
          ],
        },
      ],
    });

    advanceBeats(4);
    expect(sampleSourcesWithLabel('sample:orchestration:mix').length).toBe(kicksBeforeSwap);
    scheduler.dispose();
  });

  it('tempo changes never rebuild the plan', async () => {
    const { DawsonEngine } = await import('../../domain/dawson/DawsonEngine');
    class CountingDawson extends DawsonEngine {
      public resolveCalls = 0;
      public resolveMeasure(measure: any, measureIndex?: number) {
        this.resolveCalls += 1;
        return super.resolveMeasure(measure, measureIndex);
      }
    }
    const dawson = new CountingDawson({ mode: 'classic_bop', ostinato: 'jazz_swing' });
    const scheduler = new ToneTransportScheduler({ engine: new MetronomeEngine(120, '4/4') });
    scheduler.setDawsonEngine(dawson);
    scheduler.setReadingLine({
      id: 'plan-line',
      title: 'Plan Line',
      tier: 1,
      measures: [
        {
          index: 0,
          timeSignature: [4, 4],
          totalBeats: 4,
          events: [createRhythmicEvent({ durationBeats: 4.0, durationType: 'whole' })],
        },
      ],
    });

    await scheduler.start();
    expect(dawson.resolveCalls).toBe(1);
    scheduler.setTempo(180);
    scheduler.tap(1_000);
    scheduler.tap(1_400);
    advanceBeats(8, 150);
    expect(dawson.resolveCalls).toBe(1);
    scheduler.dispose();
  });
});
