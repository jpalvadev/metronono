import { describe, it, expect } from 'vitest';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { getAudioContext } from '../WebAudioContext';
import { FakeAudioContext } from '../../test/fakeWebAudio';

// Pure Web Audio WAV engine (ADR-0014): the persistent graph at page load is ~8 native
// nodes (3 Mixing Channels + 3 Audition nodes + master headroom GainNode + master
// DynamicsCompressorNode limiter), with zero live Tone.js synth nodes.

function fakeCtx(): FakeAudioContext {
  return getAudioContext() as unknown as FakeAudioContext;
}

describe('Eager audio graph node budget (Pure Web Audio)', () => {
  it('keeps the persistent audio graph under 10 native nodes', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();

    const ctx = fakeCtx();
    const persistentCount = ctx.gains.length + ctx.compressors.length;
    expect(persistentCount).toBeLessThanOrEqual(10);
    expect(persistentCount).toBe(8);
    scheduler.dispose();
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
