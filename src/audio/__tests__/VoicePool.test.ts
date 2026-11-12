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

    // Four 32nd-note hi-hat strokes in rapid succession, one stroke step apart.
    const strokeStep = 0.05;
    const strokes = [1.0, 1.05, 1.1, 1.15];
    for (const time of strokes) {
      player.play(
        { timeInMeasure: 1.0, voice: 'hihat_closed', velocity: 0.8, dynamic: 'normal', source: 'orchestration' },
        time
      );
    }

    const times = hihat.flatMap((n) => triggerTimes(n, 1));
    expect(times.length).toBe(strokes.length);
    // The ring spreads the strokes: every member holds two of them...
    const perNode = hihat.map((n) => triggerTimes(n, 1));
    expect(perNode.map((member) => member.length)).toEqual([2, 2]);
    // ...and no member ever takes two consecutive strokes, so a stroke never cancels
    // the live attack of the stroke before it.
    for (const member of perNode) {
      const gaps = member.slice(1).map((time, index) => time - member[index]);
      if (gaps.length === 0) continue;
      // A member is never handed two consecutive strokes: its strokes are more than one
      // stroke step apart, so a stroke never cancels the attack before it.
      expect(Math.min(...gaps)).toBeGreaterThan(strokeStep);
    }
  });

  it('every audible voice slot holds a ring, and the eager graph holds only the audible rigs', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();

    for (const label of ['crash', 'ride', 'hihat']) {
      const members = labelledNodes(`rig:orchestration:mix:${label}`, 'MetalSynth');
      expect(members.length).toBeGreaterThanOrEqual(2);
    }

    // An Audition rig costs the same subgraphs as an audible one and is heard only at a
    // tap gesture, so it is not part of the graph a session pays for at page load.
    const auditionMembers = fakeToneRecorder.nodes.filter((node) =>
      (node.label ?? '').startsWith('rig:') && (node.label ?? '').includes(':audition:')
    );
    expect(auditionMembers).toHaveLength(0);
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

  it('an audition tap builds the audition rig it needs, mix ring untouched', async () => {
    const mixer = new AudioMixer();
    const player = new DrumKitPlayer(mixer);
    const scheduler = new ToneTransportScheduler({ audioMixer: mixer, drumKitPlayer: player });
    await scheduler.start();

    expect(
      fakeToneRecorder.nodes.some((node) => (node.label ?? '').includes('rig:orchestration:audition:'))
    ).toBe(false);

    player.triggerVoice('hihat_closed', 1.0, 0.8, 'orchestration');

    const auditionHiHat = labelledNodes('rig:orchestration:audition:hihat', 'MetalSynth');
    // The rig is earned at the tap gesture, and one member carries the single tap.
    expect(auditionHiHat.length).toBeGreaterThanOrEqual(1);
    expect(fakeToneRecorder.triggers(auditionHiHat[0] as { kind: string }).length).toBe(1);

    player.triggerVoice('hihat_closed', 1.1, 0.8, 'orchestration');

    // The rig earned at the first tap is reused rather than regrown per tap.
    expect(labelledNodes('rig:orchestration:audition:hihat', 'MetalSynth')).toHaveLength(1);
    const mixHiHat = labelledNodes('rig:orchestration:mix:hihat', 'MetalSynth');
    expect(mixHiHat.reduce((total, n) => total + fakeToneRecorder.triggers(n).length, 0)).toBe(0);
  });
});
