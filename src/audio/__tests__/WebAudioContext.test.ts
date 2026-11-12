import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getAudioContext,
  resumeAudioContext,
  decodeAudioDataWithNativeContext,
  resetAudioContextForTesting,
} from '../WebAudioContext';
import { FakeAudioContext, installFakeWebAudio } from '../../test/fakeWebAudio';

describe('WebAudioContext (native provider)', () => {
  let fakeCtx: FakeAudioContext;
  let restore: () => void;

  beforeEach(() => {
    resetAudioContextForTesting();
    const installed = installFakeWebAudio();
    fakeCtx = installed.context;
    restore = installed.restore;
  });

  afterEach(() => {
    resetAudioContextForTesting();
    restore();
  });

  it('lazily creates and reuses a single AudioContext instance', () => {
    const first = getAudioContext();
    const second = getAudioContext();

    expect(first).toBe(fakeCtx);
    expect(second).toBe(first);
  });

  it('resumes a suspended AudioContext on gesture and skips resume when already running', async () => {
    expect(fakeCtx.state).toBe('suspended');

    await resumeAudioContext();
    expect(fakeCtx.state).toBe('running');
    expect(fakeCtx.resumeCount).toBe(1);

    await resumeAudioContext();
    expect(fakeCtx.resumeCount).toBe(1);
  });

  it('decodes audio data with a sliced ArrayBuffer so the caller buffer stays intact', async () => {
    const input = new Uint8Array([0x52, 0x49, 0x46, 0x46]).buffer;
    const decoded = await decodeAudioDataWithNativeContext(input);

    expect(decoded.duration).toBeGreaterThan(0);
    expect(fakeCtx.decodeCalls).toHaveLength(1);
    expect(fakeCtx.decodeCalls[0]).not.toBe(input);
    expect(fakeCtx.decodeCalls[0].byteLength).toBe(4);
  });

  it('records GainNode, DynamicsCompressorNode, and AudioBufferSourceNode routing and lifecycle in FakeAudioContext', () => {
    const ctx = getAudioContext() as unknown as FakeAudioContext;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -3;
    compressor.ratio.value = 20;
    compressor.connect(ctx.destination);

    const gain = ctx.createGain();
    gain.gain.value = 0.4;
    gain.connect(compressor);

    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 4410, 44100);
    source.connect(gain);

    let ended = false;
    source.onended = () => {
      ended = true;
      source.disconnect();
      gain.disconnect();
    };

    source.start(1.25);
    expect(source.startedAt).toBe(1.25);
    expect(source.connectedTo).toContain(gain);
    expect(gain.connectedTo).toContain(compressor);
    expect(compressor.connectedTo).toContain(ctx.destination);

    source.triggerEnded();
    expect(ended).toBe(true);
    expect(source.disconnected).toBe(true);
    expect(gain.disconnected).toBe(true);

    const source2 = ctx.createBufferSource();
    source2.start(2.0);
    source2.stop(2.5);
    expect(source2.stoppedAt).toBe(2.5);
  });
});
