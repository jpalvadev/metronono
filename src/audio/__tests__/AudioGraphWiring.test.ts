import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioMixer } from '../AudioMixer';
import { DrumKitPlayer } from '../DrumKitPlayer';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { fakeToneRecorder } from '../../test/fakeTone';
import { getAudioContext } from '../WebAudioContext';
import { FakeAudioBuffer, FakeAudioContext, FakeAudioNode } from '../../test/fakeWebAudio';

// A real click and a real composed drum hit must reach the audio destination through the
// Mixing Channel they belong to, on a graph the Transport builds eagerly (ADR-0005 / ADR-0014).
vi.mock('tone', async () => {
  const fake = await import('../../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

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

const dummyBuffer = new FakeAudioBuffer(1, 2048, 44100) as unknown as AudioBuffer;

describe('Transport audio graph (Pure Web Audio)', () => {
  beforeEach(() => {
    fakeToneRecorder.reset();
  });

  it('routes both click samples and drum samples to the audio destination through their Mixing Channels', async () => {
    const scheduler = new ToneTransportScheduler();
    const mixer = scheduler.getAudioMixer();
    const player = scheduler.getDrumKitPlayer();

    expect(mixer).toBeDefined();
    expect(player).toBeDefined();

    await scheduler.start();

    const ctx = fakeCtx();
    const masterGain = nodeByLabel('mixer:master:gain');
    for (const channel of ['click', 'ostinato', 'orchestration'] as const) {
      const main = nodeByLabel(`mixer:${channel}`);
      const audition = nodeByLabel(`audition:${channel}`);
      expect(main.connectedTo).toContain(masterGain);
      expect(audition.connectedTo).toContain(masterGain);
      expect(ctx.routeTo(main, ctx.destination)).not.toBeNull();
      expect(ctx.routeTo(audition, ctx.destination)).not.toBeNull();
    }
    expect(ctx.destination.incoming).toHaveLength(1);

    // Load click sample buffers and fire a repeat tick.
    scheduler.getClickPlayer()?.loadSampleBuffer?.('downbeat', dummyBuffer);
    scheduler.getClickPlayer()?.loadSampleBuffer?.('regular', dummyBuffer);
    fakeToneRecorder.transport.fireRepeats();

    const clickChannel = nodeByLabel('mixer:click');
    const clickSources = ctx.bufferSources.filter((s) =>
      (s.connectedTo[0]?.label ?? '').startsWith('click:mix:')
    );
    expect(clickSources.length).toBeGreaterThan(0);
    for (const src of clickSources) {
      expect(ctx.routeTo(src, clickChannel)).not.toBeNull();
      expect(ctx.routeTo(src, ctx.destination)).not.toBeNull();
    }

    // A previewed click voice is wired onto the Audition node Click shares.
    scheduler.auditionVoice('click_regular');
    const auditionSources = ctx.bufferSources.filter((s) =>
      (s.connectedTo[0]?.label ?? '').startsWith('click:audition:')
    );
    expect(auditionSources.length).toBeGreaterThan(0);
    for (const src of auditionSources) {
      expect(ctx.routeTo(src, nodeByLabel('audition:click'))).not.toBeNull();
      expect(ctx.routeTo(src, clickChannel)).toBeNull();
    }
  });

  it('routes a composed drum hit through the Mixing Channel of its source', async () => {
    const scheduler = new ToneTransportScheduler();
    const player = scheduler.getDrumKitPlayer();
    player.loadSampleBuffer?.('kick', dummyBuffer);

    await scheduler.start();
    player.play({ timeInMeasure: 0, voice: 'kick', velocity: 0.9, dynamic: 'normal', source: 'orchestration' }, 1.0);

    const ctx = fakeCtx();
    expect(ctx.bufferSources).toHaveLength(1);
    const kickSource = ctx.bufferSources[0];
    expect(ctx.routeTo(kickSource, nodeByLabel('mixer:orchestration'))).not.toBeNull();
    expect(ctx.routeTo(kickSource, ctx.destination)).not.toBeNull();
  });

  it('builds the graph once even when start is called again', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();
    await scheduler.start();

    expect(fakeCtx().destination.incoming).toHaveLength(1);
  });

  it('gives a Mixer it is handed the eager graph instead of building a second one', () => {
    const mixer = new AudioMixer();
    const player = new DrumKitPlayer(mixer);
    const scheduler = new ToneTransportScheduler({ audioMixer: mixer, drumKitPlayer: player });

    expect(scheduler.getAudioMixer()).toBe(mixer);
    expect(scheduler.getDrumKitPlayer()).toBe(player);
    expect(fakeCtx().destination.incoming).toHaveLength(1);
    expect(mixer.isGraphInitialized()).toBe(true);
  });

  it('disconnects the graph it owns on dispose', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();
    scheduler.dispose();

    expect(fakeCtx().destination.incoming).toHaveLength(0);
  });
});
