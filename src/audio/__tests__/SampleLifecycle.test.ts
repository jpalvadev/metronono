import { describe, it, expect, beforeEach } from 'vitest';
import { AudioMixer } from '../AudioMixer';
import { DrumKitPlayer } from '../DrumKitPlayer';
import { getAudioContext } from '../WebAudioContext';
import { FakeAudioContext, FakeAudioBuffer, FakeGainNode } from '../../test/fakeWebAudio';

function fakeCtx(): FakeAudioContext {
  return getAudioContext() as unknown as FakeAudioContext;
}

const rideSample = new FakeAudioBuffer(1, 4410, 44100) as unknown as AudioBuffer;
const crashSample = new FakeAudioBuffer(1, 8820, 44100) as unknown as AudioBuffer;

describe('Sample stroke lifecycle (Pure Web Audio)', () => {
  let mixer: AudioMixer;
  let player: DrumKitPlayer;

  beforeEach(() => {
    mixer = new AudioMixer();
    mixer.initToneNodes();
    player = new DrumKitPlayer(mixer);
  });

  it('creates an independent AudioBufferSourceNode and per-hit GainNode for overlapping hits on the same voice', () => {
    player.loadSampleBuffer('ride', rideSample);

    player.play(
      { timeInMeasure: 1.0, voice: 'ride', velocity: 0.9, dynamic: 'accent', source: 'orchestration' },
      1.0
    );
    player.play(
      { timeInMeasure: 1.25, voice: 'ride', velocity: 0.35, dynamic: 'ghost', source: 'orchestration' },
      1.05
    );

    const ctx = fakeCtx();
    expect(ctx.bufferSources).toHaveLength(2);
    const [firstSource, secondSource] = ctx.bufferSources;

    expect(firstSource.startedAt).toBe(1.0);
    expect(secondSource.startedAt).toBe(1.05);
    // Neither overlapping hit stops or disconnects the other early.
    expect(firstSource.stoppedAt).toBeNull();
    expect(firstSource.disconnected).toBe(false);

    const firstGain = firstSource.connectedTo[0] as FakeGainNode;
    const secondGain = secondSource.connectedTo[0] as FakeGainNode;
    expect(firstGain).not.toBe(secondGain);
    expect(firstGain.gain.value).toBe(0.9);
    expect(secondGain.gain.value).toBe(0.35);

    // Both route through the Orchestration Mixing Channel to destination.
    expect(ctx.routeTo(firstSource, ctx.destination)).not.toBeNull();
    expect(ctx.routeTo(secondSource, ctx.destination)).not.toBeNull();
    expect(firstGain.connectedTo).toContain(mixer.getChannelNode('orchestration'));
  });

  it('self-disconnects source and per-hit GainNode when onended fires', () => {
    player.loadSampleBuffer('crash', crashSample);
    player.play(
      { timeInMeasure: 1.0, voice: 'crash', velocity: 0.8, dynamic: 'normal', source: 'orchestration' },
      2.0
    );

    const ctx = fakeCtx();
    const source = ctx.bufferSources[0];
    const hitGain = source.connectedTo[0] as FakeGainNode;

    expect(source.disconnected).toBe(false);
    expect(hitGain.disconnected).toBe(false);

    source.triggerEnded();

    expect(source.disconnected).toBe(true);
    expect(hitGain.disconnected).toBe(true);
  });

  it('stops and disconnects all still-active sources immediately on stopPendingSamples()', () => {
    player.loadSampleBuffer('ride', rideSample);
    player.play(
      { timeInMeasure: 1.0, voice: 'ride', velocity: 0.8, dynamic: 'normal', source: 'ostinato' },
      3.0
    );
    player.play(
      { timeInMeasure: 2.0, voice: 'ride', velocity: 0.6, dynamic: 'normal', source: 'ostinato' },
      3.5
    );

    const ctx = fakeCtx();
    expect(ctx.bufferSources).toHaveLength(2);

    player.stopPendingSamples();

    for (const source of ctx.bufferSources) {
      expect(source.stoppedAt).not.toBeNull();
      expect(source.disconnected).toBe(true);
    }
  });

  it('routes triggerVoice audition taps through the channel Audition node even when muted', () => {
    mixer.setChannelMute('orchestration', true);
    player.loadSampleBuffer('snare', rideSample);

    player.triggerVoice('snare', 0, 0.75, 'orchestration');

    const ctx = fakeCtx();
    expect(ctx.bufferSources).toHaveLength(1);
    const source = ctx.bufferSources[0];
    const hitGain = source.connectedTo[0] as FakeGainNode;
    expect(hitGain.connectedTo).toContain(mixer.getAuditionNode('orchestration'));
    expect(hitGain.connectedTo).not.toContain(mixer.getChannelNode('orchestration'));
  });
});
