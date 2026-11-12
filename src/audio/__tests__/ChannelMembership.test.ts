import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { DrumKitPlayer } from '../DrumKitPlayer';
import { AudioMixer, MIXING_CHANNELS } from '../AudioMixer';
import { DawsonEngine } from '../../domain/dawson/DawsonEngine';
import { DrumVoice, ScheduledDrumEvent } from '../../domain/dawson/types';
import { createRhythmicEvent, ReadingLine } from '../../domain/rhythm/types';
import { getAudioContext } from '../WebAudioContext';
import { LOOKAHEAD_INTERVAL_MS } from '../NativeLookaheadTransport';
import { FakeAudioBuffer, FakeAudioContext, FakeAudioNode, FakeGainNode } from '../../test/fakeWebAudio';

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

function nodeByLabel(label: string): FakeAudioNode {
  const ctx = fakeCtx();
  const all: FakeAudioNode[] = [...ctx.gains, ...ctx.compressors];
  const node = all.find((created) => created.label === label);
  if (!node) throw new Error(`no node labelled '${label}' in the recorded native graph`);
  return node;
}

function sampleSourcesFor(label: string) {
  return fakeCtx().bufferSources.filter((s) => (s.connectedTo[0]?.label ?? '') === label);
}

const dummyBuffer = new FakeAudioBuffer(1, 2048, 44100) as unknown as AudioBuffer;

const quarterNoteLine: ReadingLine = {
  id: 'membership-line',
  title: 'Membership Line',
  tier: 1,
  measures: [
    {
      index: 0,
      timeSignature: [4, 4],
      totalBeats: 4.0,
      events: [1, 2, 3, 4].map(() =>
        createRhythmicEvent({ isRest: false, durationBeats: 1.0, durationType: 'quarter' })
      ),
    },
  ],
};

function event(overrides: Partial<ScheduledDrumEvent> = {}): ScheduledDrumEvent {
  return {
    timeInMeasure: 0,
    voice: 'kick',
    velocity: 0.9,
    dynamic: 'normal',
    source: 'orchestration',
    ...overrides,
  };
}

async function schedulerWithComposition(): Promise<ToneTransportScheduler> {
  const engine = new DawsonEngine();
  engine.setMode('straight_rock');
  engine.setOstinato('straight_rock');

  const scheduler = new ToneTransportScheduler();
  scheduler.setDawsonEngine(engine);
  scheduler.setReadingLine(quarterNoteLine);
  const player = scheduler.getDrumKitPlayer();
  for (const voice of ALL_DRUM_VOICES) {
    player.loadSampleBuffer?.(voice, dummyBuffer);
  }
  await scheduler.start();
  return scheduler;
}

describe('Mixing Channel membership (Pure Web Audio)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays each composed stroke on the Mixing Channel its event source names', async () => {
    const scheduler = await schedulerWithComposition();

    advanceBeats(3);

    expect(sampleSourcesFor('sample:ostinato:mix').length).toBeGreaterThan(0);
    expect(sampleSourcesFor('sample:orchestration:mix').length).toBeGreaterThan(0);

    expect(sampleSourcesFor('sample:ostinato:audition')).toHaveLength(0);
    expect(sampleSourcesFor('sample:orchestration:audition')).toHaveLength(0);

    expect(fakeCtx().destination.incoming).toHaveLength(1);
    scheduler.dispose();
  });

  it('follows the source, not the voice name: an orchestrated ride is heard on Orchestration', async () => {
    const scheduler = new ToneTransportScheduler();
    const mixer = scheduler.getAudioMixer();
    const player = scheduler.getDrumKitPlayer();
    player.loadSampleBuffer?.('ride', dummyBuffer);
    await scheduler.start();

    mixer.setChannelVolume('orchestration', 0.3);
    mixer.setChannelVolume('ostinato', 0.9);

    player.play(event({ voice: 'ride', source: 'orchestration' }), 1.0);

    expect(sampleSourcesFor('sample:orchestration:mix')).toHaveLength(1);
    expect(sampleSourcesFor('sample:ostinato:mix')).toHaveLength(0);
    expect((nodeByLabel('mixer:orchestration') as FakeGainNode).gain.value).toBe(0.3);
    const hitGain = sampleSourcesFor('sample:orchestration:mix')[0].connectedTo[0];
    expect(hitGain.connectedTo).toContain(nodeByLabel('mixer:orchestration'));
    scheduler.dispose();
  });

  it('mutes Orchestration without touching the Ostinato, and the other way around', async () => {
    const scheduler = await schedulerWithComposition();
    const mixer = scheduler.getAudioMixer();

    advanceBeats(2);
    const ostinatoBefore = sampleSourcesFor('sample:ostinato:mix').length;
    const orchestrationBefore = sampleSourcesFor('sample:orchestration:mix').length;
    expect(ostinatoBefore).toBeGreaterThan(0);
    expect(orchestrationBefore).toBeGreaterThan(0);

    mixer.setChannelMute('orchestration', true);
    advanceBeats(2);

    expect(sampleSourcesFor('sample:orchestration:mix')).toHaveLength(orchestrationBefore);
    expect(sampleSourcesFor('sample:ostinato:mix').length).toBeGreaterThan(ostinatoBefore);

    mixer.setChannelMute('orchestration', false);
    mixer.setChannelMute('ostinato', true);
    const orchestrationUnmuted = sampleSourcesFor('sample:orchestration:mix').length;
    const ostinatoMuted = sampleSourcesFor('sample:ostinato:mix').length;
    advanceBeats(2);

    expect(sampleSourcesFor('sample:ostinato:mix')).toHaveLength(ostinatoMuted);
    expect(sampleSourcesFor('sample:orchestration:mix').length).toBeGreaterThan(orchestrationUnmuted);
    scheduler.dispose();
  });

  it('routes an uploaded click sample through the Click Mixing Channel and obeys its mute', async () => {
    const scheduler = new ToneTransportScheduler();
    const mixer = scheduler.getAudioMixer();
    await scheduler.start();

    scheduler.applyCustomSampleBuffer('click_regular', dummyBuffer);
    advanceBeats(2);

    const clickSources = sampleSourcesFor('click:mix:regular');
    expect(clickSources.length).toBeGreaterThan(0);
    const ctx = fakeCtx();
    for (const src of clickSources) {
      const hitGain = src.connectedTo[0];
      expect(hitGain.connectedTo).toContain(nodeByLabel('mixer:click'));
      const route = ctx.routeTo(hitGain, ctx.destination);
      expect(route?.map((node) => node.label)).toEqual([
        'click:mix:regular',
        'mixer:click',
        'mixer:master:gain',
        'mixer:master:limiter',
        'destination',
      ]);
    }

    mixer.setChannelMute('click', true);
    expect((nodeByLabel('mixer:click') as FakeGainNode).gain.value).toBe(0);
    advanceBeats(2);
    expect(ctx.destination.incoming).toHaveLength(1);

    mixer.setChannelMute('click', false);
    mixer.setChannelVolume('click', 0.25);
    expect((nodeByLabel('mixer:click') as FakeGainNode).gain.value).toBe(0.25);
    scheduler.dispose();
  });

  it('keeps voice-name inference only for a bare Audition call with no composed context', () => {
    const mixer = new AudioMixer();
    mixer.initToneNodes();
    const player = new DrumKitPlayer(mixer);
    player.loadSampleBuffer('ride', dummyBuffer);
    player.loadSampleBuffer('kick', dummyBuffer);

    player.triggerVoice('ride', 0, 0.9);
    player.triggerVoice('kick', 0, 0.9);
    expect(sampleSourcesFor('sample:ostinato:audition')).toHaveLength(1);
    expect(sampleSourcesFor('sample:orchestration:audition')).toHaveLength(1);

    player.triggerVoice('ride', 0, 0.9, 'orchestration');
    expect(sampleSourcesFor('sample:orchestration:audition')).toHaveLength(2);
    expect(sampleSourcesFor('sample:ostinato:audition')).toHaveLength(1);

    player.play(event({ voice: 'ride', source: 'orchestration' }), 1.0);
    expect(sampleSourcesFor('sample:orchestration:mix')).toHaveLength(1);
    expect(sampleSourcesFor('sample:ostinato:mix')).toHaveLength(0);
  });

  it('names a Mixing Channel for every composed stroke it schedules', async () => {
    const engine = new DawsonEngine();
    engine.setMode('straight_rock');
    engine.setOstinato('straight_rock');

    const sources: Array<ScheduledDrumEvent['source']> = [];
    const capturingPlayer = {
      initSynths: vi.fn(() => true),
      play: vi.fn((ev: ScheduledDrumEvent) => {
        sources.push(ev.source);
      }),
      triggerVoice: vi.fn(),
      dispose: vi.fn(),
    };

    const scheduler = new ToneTransportScheduler();
    scheduler.setDawsonEngine(engine);
    scheduler.setReadingLine(quarterNoteLine);
    scheduler.setDrumKitPlayer(capturingPlayer);
    await scheduler.start();

    advanceBeats(3);

    expect(sources.length).toBeGreaterThan(0);
    expect(new Set(sources)).toEqual(new Set(['ostinato', 'orchestration']));
    expect(sources.every((source) => MIXING_CHANNELS.includes(source))).toBe(true);
    scheduler.dispose();
  });
});
