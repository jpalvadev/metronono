import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { MetronomeEngine } from '../../domain/metronome/MetronomeEngine';
import { createRhythmicEvent } from '../../domain/rhythm/types';
import type { Measure } from '../../domain/rhythm/types';
import { fakeToneRecorder } from '../../test/fakeTone';

// The Lookahead Scheduler must resolve a Measure Plan before the tick: the domain
// engine is consulted once per measure, never once per beat, and composition
// edits (ostinato, system, reading line) retarget later measures without restart.
// See docs/adr/0011 and GLOSSARY ("Measure Plan").
vi.mock('tone', async () => {
  const fake = await import('../../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

function nodeByLabel(label: string) {
  const node = fakeToneRecorder.nodes.find((created) => created.label === label);
  if (!node) throw new Error(`no node labelled '${label}' in the recorded graph`);
  return node;
}

describe('Measure Plan lookahead scheduling', () => {
  beforeEach(() => {
    fakeToneRecorder.reset();
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
    // A two-measure reading line: the plan holds exactly two measures.
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

    // Six beats = one and a half cycles of the two-measure plan.
    fakeToneRecorder.transport.fireRepeats(6);
    expect(dawson.resolveCalls).toBe(2);

    // Six more beats without a second resolve per beat.
    fakeToneRecorder.transport.fireRepeats(6);
    expect(dawson.resolveCalls).toBe(2);
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

    await scheduler.start();

    const ostinatoRideCount = () =>
      fakeToneRecorder.nodes
        .filter((n) => (n.label ?? '') === 'rig:ostinato:mix:ride')
        .reduce((total, n) => total + fakeToneRecorder.triggers(n).length, 0);

    // Before the edit the jazz-swing ostinato ride keeps sounding.
    fakeToneRecorder.transport.fireRepeats(4);
    const ridesBeforeEdit = ostinatoRideCount();
    expect(ridesBeforeEdit).toBeGreaterThan(0);

    // A plain domain edit while playing must retarget the following measures:
    // no further ostinato ride strokes are added.
    dawson.setOstinato('none');
    fakeToneRecorder.transport.fireRepeats(4);
    expect(ostinatoRideCount()).toBe(ridesBeforeEdit);
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

    await scheduler.start();
    // Beat 0 at time 0: the long note puts the kick orchestration on the downbeat.
    fakeToneRecorder.transport.fireRepeats(1);
    const kick = nodeByLabel('rig:orchestration:mix:kick');
    const kickTriggers = fakeToneRecorder.triggers(kick);
    expect(kickTriggers[0].method).toBe('triggerAttackRelease');
    expect(kickTriggers[0].args[2]).toBeCloseTo(0, 5);

    // Beat 1 at 0.5s: short notes put snares at 0.5 and 0.75 (subOffset 0 and 0.5 × 0.5s).
    // The snare slot is a rig pair (MembraneSynth + NoiseSynth sharing the slot label);
    // the membrane member takes a pitch first, so its audio time is args[2].
    fakeToneRecorder.transport.fireRepeats(3);
    const snares = fakeToneRecorder.nodes.filter((n) => (n.label ?? '') === 'rig:orchestration:mix:snare' && n.kind === 'MembraneSynth');
    const snareTimes = snares.flatMap((n) => fakeToneRecorder.triggers(n).map((t) => t.args[2]));
    expect(snareTimes).toEqual([0.5, 0.75]);
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

    await scheduler.start();
    fakeToneRecorder.transport.fireRepeats(1);
    const kick = nodeByLabel('rig:orchestration:mix:kick');
    const kicksBeforeSwap = fakeToneRecorder.triggers(kick).length;
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
          // Eight short notes: snares, no kick.
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

    fakeToneRecorder.transport.fireRepeats(4);
    // No new kick strokes after the swap: line B is all short notes.
    expect(fakeToneRecorder.triggers(kick).length).toBe(kicksBeforeSwap);
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
    fakeToneRecorder.transport.fireRepeats(8);
    expect(dawson.resolveCalls).toBe(1);
  });
});
