import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { fakeToneRecorder } from '../../test/fakeTone';
import { getAudioContext } from '../WebAudioContext';
import { FakeAudioContext } from '../../test/fakeWebAudio';

// Pure Web Audio WAV engine (ADR-0014): the persistent graph at page load is ~8 native
// nodes (3 Mixing Channels + 3 Audition nodes + master headroom GainNode + master
// DynamicsCompressorNode limiter), with zero live Tone.js synth nodes.
vi.mock('tone', async () => {
  const fake = await import('../../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

function fakeCtx(): FakeAudioContext {
  return getAudioContext() as unknown as FakeAudioContext;
}

describe('Eager audio graph node budget (Pure Web Audio)', () => {
  beforeEach(() => {
    fakeToneRecorder.reset();
  });

  it('keeps the persistent audio graph under 10 native nodes with zero Tone.js synth nodes', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();

    const synthNodes = fakeToneRecorder.nodes.filter((n) =>
      ['MembraneSynth', 'MetalSynth', 'NoiseSynth', 'Synth'].includes(n.kind)
    );
    expect(synthNodes).toHaveLength(0);

    const ctx = fakeCtx();
    const persistentCount = ctx.gains.length + ctx.compressors.length;
    expect(persistentCount).toBeLessThanOrEqual(10);
    expect(persistentCount).toBe(8);
  });

  it('does not allocate extra persistent nodes on repeated audition taps', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();

    const ctx = fakeCtx();
    const persistentBefore = ctx.gains.length + ctx.compressors.length;

    const player = scheduler.getDrumKitPlayer();
    player.triggerVoice('hihat_closed', 1.0, 0.8, 'orchestration');
    player.triggerVoice('hihat_closed', 1.1, 0.8, 'orchestration');

    // No sample loaded -> silent, 0 new nodes; even with samples loaded, per-hit nodes self-clean on ended.
    expect(ctx.gains.length + ctx.compressors.length).toBe(persistentBefore);
  });
});
