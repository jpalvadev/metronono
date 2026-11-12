import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { AudioMixer, MixerChannelId } from '../AudioMixer';
import { DrumKitPlayer } from '../DrumKitPlayer';
import { DawsonEngine } from '../../domain/dawson/DawsonEngine';
import { DrumVoice, ScheduledDrumEvent } from '../../domain/dawson/types';
import { createRhythmicEvent, ReadingLine } from '../../domain/rhythm/types';
import { fakeToneRecorder } from '../../test/fakeTone';
import { getAudioContext } from '../WebAudioContext';
import { FakeAudioBuffer, FakeAudioContext, FakeAudioNode, FakeGainNode } from '../../test/fakeWebAudio';

// "Silent" is one thing in the whole app: a Mixing Channel is silent when the volume its
// slider sets is zero, whether or not it is also muted. Everything a silent Channel drives
// goes quiet with it: its voices and its uploaded samples. The Reading Line, the beat pulses
// and the playhead keep running, and the Audition node the Channel shares keeps sounding
// a tapped voice at the Channel volume.
vi.mock('tone', async () => {
  const fake = await import('../../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

const ALL_DRUM_VOICES: DrumVoice[] = [
  'kick', 'snare', 'snare_ghost', 'tom_high', 'tom_mid', 'tom_floor',
  'ride', 'ride_bell', 'hihat_closed', 'hihat_open', 'hihat_foot', 'crash',
];

const dummyBuffer = new FakeAudioBuffer(1, 2048, 44100) as unknown as AudioBuffer;

function fakeCtx(): FakeAudioContext {
  return getAudioContext() as unknown as FakeAudioContext;
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

function routeIsAudible(node: FakeAudioNode): boolean {
  const ctx = fakeCtx();
  const route = ctx.routeTo(node, ctx.destination);
  if (!route) return false;
  return route.every((step) => {
    if (step instanceof FakeGainNode) return step.gain.value > 0;
    return true;
  });
}

function soundsThrough(label: string): boolean {
  const ctx = fakeCtx();
  const target = nodeByLabel(label);
  return ctx.bufferSources.some((src) => src.startedAt !== null && ctx.routeTo(src, target) !== null);
}

const quarterNoteLine: ReadingLine = {
  id: 'audibility-line',
  title: 'Audibility Line',
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

async function startScheduler(
  options: { drumKitPlayer?: any } = {}
): Promise<ToneTransportScheduler> {
  const engine = new DawsonEngine();
  engine.setMode('straight_rock');
  engine.setOstinato('straight_rock');

  const scheduler = new ToneTransportScheduler({
    dawsonEngine: engine,
    readingLine: quarterNoteLine,
    ...options,
  });
  await scheduler.start();

  if (!options.drumKitPlayer) {
    const player = scheduler.getDrumKitPlayer();
    for (const voice of ALL_DRUM_VOICES) {
      player.loadSampleBuffer?.(voice, dummyBuffer);
    }
    const click = scheduler.getClickPlayer();
    click?.loadSampleBuffer?.('downbeat', dummyBuffer);
    click?.loadSampleBuffer?.('regular', dummyBuffer);
    click?.loadSampleBuffer?.('subdivision', dummyBuffer);
  }
  return scheduler;
}

describe('Silent Mixing Channels (Pure Web Audio)', () => {
  beforeEach(() => {
    fakeToneRecorder.reset();
  });

  it('treats a Mixing Channel turned down to zero volume as silent', async () => {
    const scheduler = await startScheduler();
    scheduler.getAudioMixer().setChannelVolume('orchestration', 0);

    fakeToneRecorder.transport.fireRepeats(4);

    expect(sampleSourcesFor('sample:orchestration:mix')).toHaveLength(0);
    expect(sampleSourcesFor('sample:ostinato:mix').length).toBeGreaterThan(0);
    expect((nodeByLabel('mixer:orchestration') as FakeGainNode).gain.value).toBe(0);
    expect(routeIsAudible(nodeByLabel('mixer:orchestration'))).toBe(false);
    expect(routeIsAudible(nodeByLabel('mixer:ostinato'))).toBe(true);
  });

  it('plays no stroke on a muted Mixing Channel', async () => {
    const scheduler = await startScheduler();
    scheduler.getAudioMixer().setChannelMute('orchestration', true);

    fakeToneRecorder.transport.fireRepeats(4);

    expect(sampleSourcesFor('sample:orchestration:mix')).toHaveLength(0);
    expect(sampleSourcesFor('sample:ostinato:mix').length).toBeGreaterThan(0);
  });

  it('still schedules a silent Channel\u2019s events and keeps every beat and playhead pulse', async () => {
    const played: ScheduledDrumEvent[] = [];
    const mockDrumPlayer = {
      initSynths: vi.fn(() => true),
      play: vi.fn((event: ScheduledDrumEvent) => played.push(event)),
      triggerVoice: vi.fn(),
      loadSampleBuffer: vi.fn(),
      removeSampleBuffer: vi.fn(),
      hasCustomSample: vi.fn(() => false),
      clearAllCustomSamples: vi.fn(),
      dispose: vi.fn(),
    };

    const scheduler = await startScheduler({ drumKitPlayer: mockDrumPlayer });
    scheduler.getAudioMixer().setChannelMute('orchestration', true);

    const beats: number[] = [];
    scheduler.onBeat((beat) => beats.push(beat.beatIndex));

    const fired = fakeToneRecorder.transport.fireRepeats(4);

    expect(played.some((event) => event.source === 'orchestration')).toBe(true);
    expect(played.some((event) => event.source === 'ostinato')).toBe(true);
    expect(beats).toEqual(fired.map((_, index) => index % 4));
    expect(scheduler.isPlaying()).toBe(true);
  });

  it('leaves the other Channels sounding while one is silent', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    mixer.setChannelVolume('ostinato', 0);

    fakeToneRecorder.transport.fireRepeats(4);

    expect(sampleSourcesFor('sample:ostinato:mix')).toHaveLength(0);
    expect(sampleSourcesFor('sample:orchestration:mix').length).toBeGreaterThan(0);
  });

  it('plays again when a muted Channel is unmuted', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    mixer.setChannelMute('orchestration', true);

    fakeToneRecorder.transport.fireRepeats(2);
    expect(sampleSourcesFor('sample:orchestration:mix')).toHaveLength(0);

    mixer.setChannelMute('orchestration', false);
    fakeToneRecorder.transport.fireRepeats(2);

    expect(sampleSourcesFor('sample:orchestration:mix').length).toBeGreaterThan(0);
  });

  it('plays again when a silent Channel\u2019s volume is turned back up', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    mixer.setChannelVolume('orchestration', 0);

    fakeToneRecorder.transport.fireRepeats(2);
    expect(sampleSourcesFor('sample:orchestration:mix')).toHaveLength(0);

    mixer.setChannelVolume('orchestration', 0.6);
    fakeToneRecorder.transport.fireRepeats(2);

    expect(sampleSourcesFor('sample:orchestration:mix').length).toBeGreaterThan(0);
    expect((nodeByLabel('mixer:orchestration') as FakeGainNode).gain.value).toBe(0.6);
  });
});

describe('Auditioning a silent Mixing Channel (Pure Web Audio)', () => {
  beforeEach(() => {
    fakeToneRecorder.reset();
  });

  it('auditions a muted Channel voice through the Audition node that Channel shares', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    mixer.setChannelMute('orchestration', true);

    scheduler.auditionVoice('kick');

    const auditionSources = sampleSourcesFor('sample:orchestration:audition');
    expect(auditionSources).toHaveLength(1);
    expect(fakeCtx().routeTo(auditionSources[0], fakeCtx().destination)?.map((n) => n.label)).toEqual([
      undefined, // AudioBufferSourceNode
      'sample:orchestration:audition',
      'audition:orchestration',
      'mixer:master:gain',
      'mixer:master:limiter',
      'destination',
    ]);
    expect((nodeByLabel('audition:orchestration') as FakeGainNode).gain.value).toBe(0.8);
    expect((nodeByLabel('mixer:orchestration') as FakeGainNode).gain.value).toBe(0);
  });

  it('auditions a muted Click voice through the Audition node the Click Channel shares', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    mixer.setChannelMute('click', true);
    mixer.setChannelVolume('click', 0.25);

    scheduler.auditionVoice('click_regular');

    expect(soundsThrough('audition:click')).toBe(true);
    expect(soundsThrough('mixer:click')).toBe(false);
    expect((nodeByLabel('audition:click') as FakeGainNode).gain.value).toBe(0.25);
  });

  it('auditions an uploaded Click sample through the Audition node too', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    scheduler.applyCustomSampleBuffer('click_subdivision', dummyBuffer);
    mixer.setChannelMute('click', true);

    scheduler.auditionVoice('click_subdivision');

    const sampleNodes = fakeCtx().bufferSources.filter((source) => source.startedAt !== null);
    expect(sampleNodes.length).toBe(1);
    expect(fakeCtx().routeTo(sampleNodes[0], nodeByLabel('audition:click'))).not.toBeNull();
    expect((nodeByLabel('mixer:click') as FakeGainNode).gain.value).toBe(0);
  });

  it('leaves the Channel muted and silent after auditioning it', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    mixer.setChannelMute('click', true);
    mixer.setChannelMute('orchestration', true);

    scheduler.auditionVoice('click_downbeat');
    scheduler.auditionVoice('kick');

    const state = mixer.getState();
    expect(state.click.muted).toBe(true);
    expect(state.orchestration.muted).toBe(true);
    expect(mixer.isChannelMuted('click')).toBe(true);
    expect(mixer.isChannelAudible('click')).toBe(false);
    expect(mixer.isChannelAudible('orchestration')).toBe(false);
    expect((nodeByLabel('mixer:click') as FakeGainNode).gain.value).toBe(0);
    expect((nodeByLabel('mixer:orchestration') as FakeGainNode).gain.value).toBe(0);
  });

  it('silences audition when the Channel volume is turned down to zero', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    mixer.setChannelVolume('ostinato', 0);

    scheduler.auditionVoice('ride');

    expect((nodeByLabel('audition:ostinato') as FakeGainNode).gain.value).toBe(0);
    expect(routeIsAudible(nodeByLabel('audition:ostinato'))).toBe(false);

    scheduler.auditionVoice('kick');
    expect(routeIsAudible(nodeByLabel('audition:orchestration'))).toBe(true);
  });

  it('auditions each Channel at the volume its own slider sets', async () => {
    const scheduler = await startScheduler();
    const mixer = scheduler.getAudioMixer();
    const volumes: Record<MixerChannelId, number> = {
      click: 0.25,
      ostinato: 0.6,
      orchestration: 0.35,
    };
    for (const channel of ['click', 'ostinato', 'orchestration'] as MixerChannelId[]) {
      mixer.setChannelVolume(channel, volumes[channel]);
    }

    scheduler.auditionVoice('click_downbeat');
    scheduler.auditionVoice('ride');
    scheduler.auditionVoice('kick');

    expect((nodeByLabel('audition:click') as FakeGainNode).gain.value).toBe(0.25);
    expect((nodeByLabel('audition:ostinato') as FakeGainNode).gain.value).toBe(0.6);
    expect((nodeByLabel('audition:orchestration') as FakeGainNode).gain.value).toBe(0.35);
    expect(soundsThrough('audition:click')).toBe(true);
    expect(soundsThrough('audition:ostinato')).toBe(true);
    expect(soundsThrough('audition:orchestration')).toBe(true);
  });

  it('reports a Mixing Channel as audible only while it can be heard at all', () => {
    const mixer = new AudioMixer();
    mixer.initToneNodes();
    const player = new DrumKitPlayer(mixer);
    player.loadSampleBuffer('ride', dummyBuffer);

    expect(mixer.isChannelAudible('ostinato')).toBe(true);

    mixer.setChannelMute('ostinato', true);
    expect(mixer.isChannelAudible('ostinato')).toBe(false);
    expect(mixer.getChannelVolume('ostinato')).toBe(0.8);

    mixer.setChannelMute('ostinato', false);
    mixer.setChannelVolume('ostinato', 0);
    expect(mixer.isChannelAudible('ostinato')).toBe(false);
    expect(mixer.getEffectiveVolume('ostinato')).toBe(0);

    player.play(
      { timeInMeasure: 0, voice: 'ride', velocity: 0.8, dynamic: 'normal', source: 'ostinato' },
      1.0
    );
    expect(sampleSourcesFor('sample:ostinato:mix')).toHaveLength(0);
  });
});
