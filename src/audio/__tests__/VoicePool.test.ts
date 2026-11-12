import { describe, it, expect, beforeEach } from 'vitest';
import { AudioMixer } from '../AudioMixer';
import { DrumKitPlayer } from '../DrumKitPlayer';
import { getAudioContext } from '../WebAudioContext';
import { FakeAudioContext, FakeAudioBuffer, FakeGainNode } from '../../test/fakeWebAudio';

function fakeCtx(): FakeAudioContext {
  return getAudioContext() as unknown as FakeAudioContext;
}

const hihatSample = new FakeAudioBuffer(1, 8820, 44100) as unknown as AudioBuffer;

describe('Natural Polyphony: per-stroke native AudioBufferSourceNode + per-hit GainNode', () => {
  let mixer: AudioMixer;
  let player: DrumKitPlayer;

  beforeEach(() => {
    mixer = new AudioMixer();
    mixer.initToneNodes();
    player = new DrumKitPlayer(mixer);
    player.loadSampleBuffer('hihat_closed', hihatSample);
  });

  it('gives consecutive rapid strokes on one voice independent sources and per-hit gains without cutting tails', () => {
    const strokes = [
      { time: 1.0, velocity: 0.9 },
      { time: 1.05, velocity: 0.4 },
      { time: 1.1, velocity: 0.8 },
      { time: 1.15, velocity: 0.3 },
    ];

    for (const stroke of strokes) {
      player.play(
        {
          timeInMeasure: 1.0,
          voice: 'hihat_closed',
          velocity: stroke.velocity,
          dynamic: 'normal',
          source: 'orchestration',
        },
        stroke.time
      );
    }

    const ctx = fakeCtx();
    expect(ctx.bufferSources).toHaveLength(4);

    // Every stroke keeps its own start time and independent gain node, with none stopped early.
    ctx.bufferSources.forEach((source, index) => {
      expect(source.startedAt).toBe(strokes[index].time);
      expect(source.stoppedAt).toBeNull();
      const hitGain = source.connectedTo[0] as FakeGainNode;
      expect(hitGain.gain.value).toBe(strokes[index].velocity);
    });

    // Ending one stroke disconnects only that stroke's source and hitGain.
    ctx.bufferSources[0].triggerEnded();
    expect(ctx.bufferSources[0].disconnected).toBe(true);
    expect(ctx.bufferSources[1].disconnected).toBe(false);
  });
});
