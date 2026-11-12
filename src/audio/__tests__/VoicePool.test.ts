import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { DrumKitPlayer } from '../DrumKitPlayer';
import { AudioMixer } from '../AudioMixer';
import { fakeToneRecorder } from '../../test/fakeTone';

// The Audio Voice Pool (docs/adr/0011): a drum rig voice slot is a small ring of
// interchangeable synth instances cycled per stroke, so a rapid stroke never
// cancels the live attack of the previous one on the same monophonic voice.
vi.mock('tone', async () => {
  const fake = await import('../../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

function labelledNodes(label: string, kind: string) {
  return fakeToneRecorder.nodes.filter((n) => (n.label ?? '') === label && n.kind === kind);
}

function triggerTimes(node: { kind: string }, timeArgIndex: number): number[] {
  return fakeToneRecorder.triggers(node).map((t) => t.args[timeArgIndex] as number);
}

describe('Audio Voice Pool: drum rig synth rings', () => {
  beforeEach(() => {
    fakeToneRecorder.reset();
  });

  it('cycles distinct synth instances for consecutive strokes on one voice', async () => {
    const scheduler = new ToneTransportScheduler();
    const player = scheduler.getDrumKitPlayer();
    await scheduler.start();

    const hihat = labelledNodes('rig:orchestration:mix:hihat', 'MetalSynth');
    expect(hihat.length).toBeGreaterThanOrEqual(2);

    // Three 32nd-note hi-hat strokes in rapid succession, 0.05s apart.
    for (const time of [1.0, 1.05, 1.1]) {
      player.play(
        { timeInMeasure: 1.0, voice: 'hihat_closed', velocity: 0.8, dynamic: 'normal', source: 'orchestration' },
        time
      );
    }

    const times = hihat.flatMap((n) => triggerTimes(n, 2));
    expect(times.length).toBe(3);
    // Each ring member got a stroke: no single synth carries two of the three.
    const perNode = hihat.map((n) => triggerTimes(n, 2).length);
    expect(perNode).toEqual([1, 1, 1]);
    // Distinct members means distinct trigger times per member: no member repeats.
    for (const n of hihat) {
      expect(triggerTimes(n, 2).length).toBeLessThanOrEqual(1);
    }
  });

  it('long-decay cymbal voices hold three ring members', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();

    const crashes = labelledNodes('rig:orchestration:mix:crash', 'MetalSynth');
    expect(crashes.length).toBe(3);
    const rides = labelledNodes('rig:ostinato:mix:ride', 'MetalSynth');
    expect(rides.length).toBe(3);
  });

  it('no audio node is allocated per stroke', async () => {
    const scheduler = new ToneTransportScheduler();
    const player = scheduler.getDrumKitPlayer();
    await scheduler.start();

    const gainBefore = fakeToneRecorder.nodesOfKind('Gain').length;
    const metalBefore = fakeToneRecorder.nodesOfKind('MetalSynth').length;

    for (let beat = 0; beat < 8; beat++) {
      player.play(
        { timeInMeasure: 1.0, voice: 'hihat_closed', velocity: 0.8, dynamic: 'normal', source: 'orchestration' },
        beat * 0.5
      );
      player.play(
        { timeInMeasure: 1.0, voice: 'crash', velocity: 0.9, dynamic: 'normal', source: 'orchestration' },
        beat * 0.5
      );
    }

    expect(fakeToneRecorder.nodesOfKind('Gain').length).toBe(gainBefore);
    expect(fakeToneRecorder.nodesOfKind('MetalSynth').length).toBe(metalBefore);
  });

  it('a stroke on a silent Mixing Channel still allocates nothing', async () => {
    const scheduler = new ToneTransportScheduler();
    const mixer = scheduler.getAudioMixer();
    const player = scheduler.getDrumKitPlayer();
    await scheduler.start();

    mixer.setChannelMute('orchestration', true);
    const metalBefore = fakeToneRecorder.nodesOfKind('MetalSynth').length;
    for (let beat = 0; beat < 4; beat++) {
      player.play(
        { timeInMeasure: 1.0, voice: 'crash', velocity: 0.9, dynamic: 'normal', source: 'orchestration' },
        beat * 0.5
      );
    }
    expect(fakeToneRecorder.nodesOfKind('MetalSynth').length).toBe(metalBefore);
  });

  it('dispose() disposes every ring member', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();
    scheduler.dispose();

    expect(fakeToneRecorder.nodes.every((n) => n.disposed)).toBe(true);
  });

  it('audition taps cycle the audition ring, mix ring untouched', async () => {
    const mixer = new AudioMixer();
    const player = new DrumKitPlayer(mixer);
    const scheduler = new ToneTransportScheduler({ audioMixer: mixer, drumKitPlayer: player });
    await scheduler.start();

    const auditionHiHat = labelledNodes('rig:orchestration:audition:hihat', 'MetalSynth');
    expect(auditionHiHat.length).toBeGreaterThanOrEqual(2);

    player.triggerVoice('hihat_closed', 1.0, 0.8, 'orchestration');
    player.triggerVoice('hihat_closed', 1.1, 0.8, 'orchestration');

    for (const n of auditionHiHat) {
      expect(fakeToneRecorder.triggers(n).length).toBeLessThanOrEqual(1);
    }
    const mixHiHat = labelledNodes('rig:orchestration:mix:hihat', 'MetalSynth');
    expect(mixHiHat.reduce((total, n) => total + fakeToneRecorder.triggers(n).length, 0)).toBe(0);
  });
});
