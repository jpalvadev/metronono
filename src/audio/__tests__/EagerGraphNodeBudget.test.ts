import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToneTransportScheduler } from '../ToneTransportScheduler';
import { VOICE_POOL_SIZE, AUDITION_POOL_SIZE } from '../DrumKitPlayer';
import { fakeToneRecorder } from '../../test/fakeTone';

// The eager graph a session pays for before any gesture, bounded absolutely (docs/adr/0011
// node-budget amendment). The other audio suites only assert STABILITY across ticks (a
// doubled graph satisfies that trivially), so the doubling that made Chrome's WebAudio
// renderer refuse to play stayed green until it reached a real browser. This bound is the
// deterministic half of that rule: it goes red on the doubling itself, headless and fast.
vi.mock('tone', async () => {
  const fake = await import('../../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

const RIG_SLOTS = 9;
const AUDIBLE_LANES = 2;

function instrumentKinds() {
  return fakeToneRecorder.nodes.filter((n) =>
    ['MembraneSynth', 'MetalSynth', 'NoiseSynth'].includes(n.kind)
  );
}

describe('Eager audio graph node budget', () => {
  beforeEach(() => {
    fakeToneRecorder.reset();
  });

  it('a session pays for exactly the audible rigs at page load', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();

    expect(instrumentKinds()).toHaveLength(RIG_SLOTS * AUDIBLE_LANES * VOICE_POOL_SIZE);

    const audibleMembers = fakeToneRecorder.nodes.filter((n) => (n.label ?? '').startsWith('rig:'));
    expect(audibleMembers).toHaveLength(RIG_SLOTS * AUDIBLE_LANES * VOICE_POOL_SIZE);
  });

  it('no audition rig is paid before the gesture that hears it', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();

    expect(
      fakeToneRecorder.nodes.filter((n) =>
        (n.label ?? '').startsWith('rig:') && (n.label ?? '').includes(':audition:')
      )
    ).toHaveLength(0);
  });

  it('one gesture earns exactly one audition rig, once', async () => {
    const scheduler = new ToneTransportScheduler();
    await scheduler.start();
    const before = instrumentKinds().length;

    const player = scheduler.getDrumKitPlayer();
    player.triggerVoice('hihat_closed', 1.0, 0.8, 'orchestration');
    player.triggerVoice('hihat_closed', 1.1, 0.8, 'orchestration');

    // A single audition lane earns its ring once; a per-tap regrow would double it.
    expect(instrumentKinds()).toHaveLength(before + RIG_SLOTS * AUDITION_POOL_SIZE);
  });
});
