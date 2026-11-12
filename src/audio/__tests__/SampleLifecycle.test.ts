import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { fakeToneRecorder, fakeAudioBuffer } from '../../test/fakeTone';

// Audio Voice Pool for custom samples (docs/adr/0011): one pooled Gain per sample
// voice slot instead of a fresh Gain per stroke, and the fresh-per-stroke
// ToneBufferSource retired (stopped + disposed) once its playback window elapsed.
vi.mock('tone', async () => {
  const fake = await import('../../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

const rideSample = fakeAudioBuffer(1, 4410, 44100); // 0.1s of playback window

function sampleGains(label: string) {
  return fakeToneRecorder.nodes.filter((n) => (n.label ?? '') === label);
}

describe('Sample stroke lifecycle', () => {
  beforeEach(() => {
    fakeToneRecorder.reset();
  });

  it('pools one Gain node per sample voice slot across strokes', async () => {
    const scheduler = new ToneTransportScheduler();
    const player = scheduler.getDrumKitPlayer();
    await scheduler.start();

    player.loadSampleBuffer?.('ride', rideSample);
    for (const time of [1.0, 2.0, 3.0, 4.0]) {
      player.play(
        { timeInMeasure: 1.0, voice: 'ride', velocity: 0.8, dynamic: 'normal', source: 'orchestration' },
        time
      );
    }

    const gains = sampleGains('sample:orchestration:mix');
    expect(gains.length).toBe(1);
    // A single gain holds every stroke's velocity as its own timed write.
    const writes = fakeToneRecorder.gainWrites(gains[0]);
    expect(writes.filter((w) => w.method === 'setValueAtTime')).toHaveLength(4);
    expect(fakeToneRecorder.bufferSources().length).toBe(4);
  });

  it('retires a stroke BufferSource once its playback window elapsed', async () => {
    const scheduler = new ToneTransportScheduler();
    const player = scheduler.getDrumKitPlayer();
    await scheduler.start();

    player.loadSampleBuffer?.('ride', rideSample);
    player.play(
      { timeInMeasure: 1.0, voice: 'ride', velocity: 0.8, dynamic: 'normal', source: 'orchestration' },
      1.0
    );
    // A stroke one second later passes the 0.1s window of the first source.
    player.play(
      { timeInMeasure: 1.0, voice: 'ride', velocity: 0.6, dynamic: 'normal', source: 'orchestration' },
      2.0
    );

    const sources = fakeToneRecorder.bufferSources();
    const retired = sources.filter((s) => s.startedAt === 1.0);
    expect(retired).toHaveLength(1);
    expect(retired[0].stoppedAt).not.toBeNull();
    expect(retired[0].disposed).toBe(true);
    // The live one is not retired before its window elapsed.
    const live = sources.find((s) => s.startedAt === 2.0);
    expect(live).not.toBeUndefined();
    expect((live as { stoppedAt: null | number }).stoppedAt).toBeNull();
  });

  it('strokes keep per-stroke velocity through the pooled gain', async () => {
    const scheduler = new ToneTransportScheduler();
    const player = scheduler.getDrumKitPlayer();
    await scheduler.start();

    player.loadSampleBuffer?.('crash', rideSample);
    player.play(
      { timeInMeasure: 1.0, voice: 'crash', velocity: 0.9, dynamic: 'normal', source: 'orchestration' },
      1.0
    );
    player.play(
      { timeInMeasure: 1.5, voice: 'crash', velocity: 0.4, dynamic: 'ghost', source: 'orchestration' },
      2.0
    );

    const gains = sampleGains('sample:orchestration:mix');
    expect(gains.length).toBe(1);
    const writes = fakeToneRecorder.gainWrites(gains[0]);
    const timed = writes.filter((w) => w.method === 'setValueAtTime');
    expect(timed.map((w) => w.value)).toEqual([0.9, 0.4]);
  });

  it('dispose drains every pending sample source', async () => {
    const scheduler = new ToneTransportScheduler();
    const player = scheduler.getDrumKitPlayer();
    await scheduler.start();

    player.loadSampleBuffer?.('ride', fakeAudioBuffer(1, 88200, 44100)); // 2s window
    player.play(
      { timeInMeasure: 1.0, voice: 'ride', velocity: 0.8, dynamic: 'normal', source: 'orchestration' },
      1.0
    );
    // Never another stroke: dispose must drain the still-pending source.
    scheduler.dispose();

    const sources = fakeToneRecorder.bufferSources();
    expect(sources).toHaveLength(1);
    expect(sources[0].stoppedAt).not.toBeNull();
    expect(sources[0].disposed).toBe(true);
  });

  it('click sample voices pool per voice and retire across beats', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();

    scheduler.applyCustomSampleBuffer('click_regular', rideSample);
    fakeToneRecorder.transport.fireRepeats(10);

    const gains = sampleGains('click-sample-gain');
    expect(gains.length).toBe(1);
    const sources = fakeToneRecorder.bufferSources();
    // Three of the ten beats are downbeats, whose custom sample lives on another
    // voice slot: the regular voice hears the other seven.
    expect(sources).toHaveLength(7);

    scheduler.dispose();
    const stillLive = sources.filter((s) => !s.disposed);
    expect(stillLive).toHaveLength(0);
  });

  it('a sample Audition preview stays on its own pooled gain, never the mix one', async () => {
    const scheduler = new ToneTransportScheduler();
    const player = scheduler.getDrumKitPlayer();
    await scheduler.start();

    player.loadSampleBuffer?.('ride', rideSample);
    player.triggerVoice?.('ride', 1.0, 1.0, 'orchestration');

    const auditionGains = sampleGains('sample:orchestration:audition');
    const mixGains = sampleGains('sample:orchestration:mix');
    expect(auditionGains.length).toBe(1);
    expect(mixGains).toHaveLength(0);

    // And the Audition gain still routes to the Audition node, not the muted Channel.
    scheduler.getAudioMixer().setChannelMute('orchestration', true);
    const auditionNode = sampleGains('audition:orchestration');
    expect(fakeToneRecorder.routeTo(auditionGains[0], auditionNode[0])).not.toBeNull();
  });
});
