import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioMixer } from '../AudioMixer';
import { DrumKitPlayer } from '../DrumKitPlayer';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { fakeToneRecorder } from '../../test/fakeTone';

// A real click and a real composed drum hit must reach the audio destination through the
// Mixing Channel they belong to, on a graph the Transport builds eagerly. See docs/adr/0005.
vi.mock('tone', async () => {
  const fake = await import('../../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

function nodeByLabel(label: string) {
  const node = fakeToneRecorder.nodes.find((created) => created.label === label);
  if (!node) throw new Error(`no node labelled '${label}' in the recorded graph`);
  return node;
}

describe('Transport audio graph', () => {
  beforeEach(() => {
    fakeToneRecorder.reset();
  });

  it('routes both the built-in click and the built-in drum voices to the audio destination', async () => {
    const scheduler = new ToneTransportScheduler();
    const mixer = scheduler.getAudioMixer();
    const player = scheduler.getDrumKitPlayer();

    // A caller may read both before anything ever plays.
    expect(mixer).toBeDefined();
    expect(player).toBeDefined();

    await scheduler.start();

    const master = nodeByLabel('mixer:master');
    for (const channel of ['click', 'ostinato', 'orchestration'] as const) {
      const main = nodeByLabel(`mixer:${channel}`);
      const audition = nodeByLabel(`audition:${channel}`);
      expect(fakeToneRecorder.connectedTo(main)).toContain(master);
      expect(fakeToneRecorder.connectedTo(audition)).toContain(master);
    }
    expect(fakeToneRecorder.destination.incoming).toEqual([master]);

    // The built-in click plays through the Click channel node.
    fakeToneRecorder.transport.fireRepeats();

    const clickChannel = nodeByLabel('mixer:click');
    const clickVoices = fakeToneRecorder.nodes.filter((created) =>
      (created.label ?? '').startsWith('click:')
    );
    expect(clickVoices.length).toBeGreaterThan(0);
    for (const click of clickVoices) {
      expect(fakeToneRecorder.routeTo(click, clickChannel)).not.toBeNull();
      expect(fakeToneRecorder.routeTo(click, master)).not.toBeNull();
      expect(fakeToneRecorder.routeTo(click, fakeToneRecorder.destination)).not.toBeNull();
    }
  });

  it('routes a composed drum hit through the Mixing Channel of its source', async () => {
    const scheduler = new ToneTransportScheduler();
    const player = scheduler.getDrumKitPlayer();

    await scheduler.start();
    player.play({ timeInMeasure: 0, voice: 'kick', velocity: 0.9, dynamic: 'normal', source: 'orchestration' }, 1.0);

    const kick = nodeByLabel('rig:orchestration:mix:kick');
    const master = nodeByLabel('mixer:master');
    expect(fakeToneRecorder.triggers(kick).length).toBeGreaterThan(0);
    expect(fakeToneRecorder.routeTo(kick, nodeByLabel('mixer:orchestration'))).not.toBeNull();
    expect(fakeToneRecorder.routeTo(kick, master)).not.toBeNull();
  });

  it('builds the graph once even when start is called again', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();
    await scheduler.start();

    expect(fakeToneRecorder.nodes.filter((created) => created.label === 'mixer:master')).toHaveLength(1);
    expect(fakeToneRecorder.destination.incoming).toHaveLength(1);
  });

  it('gives a Mixer it is handed the eager graph instead of building a second one', () => {
    const mixer = new AudioMixer();
    const player = new DrumKitPlayer(mixer);
    const scheduler = new ToneTransportScheduler({ audioMixer: mixer, drumKitPlayer: player });

    expect(scheduler.getAudioMixer()).toBe(mixer);
    expect(scheduler.getDrumKitPlayer()).toBe(player);
    // Reading the graph built the rigs: an instrument exists for each channel line.
    expect(fakeToneRecorder.nodes.filter((created) => created.label === 'mixer:master')).toHaveLength(1);
    expect(fakeToneRecorder.nodes.some((created) => created.label === 'rig:orchestration:mix:kick')).toBe(true);
  });

  it('hands the Master loudness through the Transport volume control', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();

    scheduler.setVolume(0.4);
    expect(scheduler.getVolume()).toBe(0.4);
    expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:master'))).toBe(0.4);
  });

  it('disconnects the graph it owns on dispose', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();
    scheduler.dispose();

    expect(fakeToneRecorder.destination.incoming).toHaveLength(0);
  });
});
