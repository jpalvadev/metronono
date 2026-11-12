import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioMixer, MIXING_CHANNELS } from '../AudioMixer';
import { getAudioContext } from '../WebAudioContext';
import { FakeAudioContext, FakeAudioNode, FakeGainNode } from '../../test/fakeWebAudio';

function fakeCtx(): FakeAudioContext {
  return getAudioContext() as unknown as FakeAudioContext;
}

function nodeByLabel(label: string): FakeAudioNode {
  const ctx = fakeCtx();
  const all: FakeAudioNode[] = [...ctx.gains, ...ctx.compressors];
  const node = all.find((created) => created.label === label);
  if (!node) throw new Error(`no node labelled '${label}' in the recorded native graph`);
  return node;
}

describe('AudioMixer', () => {
  let mixer: AudioMixer;

  beforeEach(() => {
    mixer = new AudioMixer();
  });

  describe('Initial State', () => {
    it('initializes click, ostinato, and orchestration channels with default volume and unmuted', () => {
      const state = mixer.getState();
      expect(state.click.volume).toBe(0.8);
      expect(state.click.muted).toBe(false);
      expect(state.ostinato.volume).toBe(0.8);
      expect(state.ostinato.muted).toBe(false);
      expect(state.orchestration.volume).toBe(0.8);
      expect(state.orchestration.muted).toBe(false);
      expect((state as any).master).toBeUndefined();
    });
  });

  describe('Volume Controls & Clamping', () => {
    it('sets volume for each individual channel within 0.0 and 1.0', () => {
      mixer.setChannelVolume('click', 0.5);
      expect(mixer.getChannelVolume('click')).toBe(0.5);

      mixer.setChannelVolume('ostinato', 0.25);
      expect(mixer.getChannelVolume('ostinato')).toBe(0.25);

      mixer.setChannelVolume('orchestration', 1.0);
      expect(mixer.getChannelVolume('orchestration')).toBe(1.0);
    });

    it('clamps volume to range [0.0, 1.0]', () => {
      mixer.setChannelVolume('click', 1.5);
      expect(mixer.getChannelVolume('click')).toBe(1.0);

      mixer.setChannelVolume('click', -0.5);
      expect(mixer.getChannelVolume('click')).toBe(0.0);
    });
  });

  describe('Mute Toggles & Effective Volume', () => {
    it('mutes and unmutes individual channels', () => {
      expect(mixer.isChannelMuted('ostinato')).toBe(false);
      expect(mixer.getEffectiveVolume('ostinato')).toBe(0.8);

      mixer.setChannelMute('ostinato', true);
      expect(mixer.isChannelMuted('ostinato')).toBe(true);
      expect(mixer.getEffectiveVolume('ostinato')).toBe(0.0);

      mixer.toggleChannelMute('ostinato');
      expect(mixer.isChannelMuted('ostinato')).toBe(false);
      expect(mixer.getEffectiveVolume('ostinato')).toBe(0.8);
    });

    it('retains configured volume when unmuting', () => {
      mixer.setChannelVolume('orchestration', 0.45);
      mixer.setChannelMute('orchestration', true);
      expect(mixer.getChannelVolume('orchestration')).toBe(0.45);
      expect(mixer.getEffectiveVolume('orchestration')).toBe(0.0);

      mixer.setChannelMute('orchestration', false);
      expect(mixer.getChannelVolume('orchestration')).toBe(0.45);
      expect(mixer.getEffectiveVolume('orchestration')).toBe(0.45);
    });
  });

  describe('State Change Listeners', () => {
    it('notifies listeners when volume or mute state changes', () => {
      const listener = vi.fn();
      const unsubscribe = mixer.onStateChange(listener);

      mixer.setChannelVolume('click', 0.9);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        click: expect.objectContaining({ volume: 0.9, muted: false }),
      }));

      mixer.toggleChannelMute('click');
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        click: expect.objectContaining({ volume: 0.9, muted: true }),
      }));

      unsubscribe();
      mixer.setChannelVolume('click', 0.2);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('Mixing Channel Graph (Pure Web Audio)', () => {
    it('has no nodes and refuses to hand one out before the graph is built', () => {
      expect(mixer.isGraphInitialized()).toBe(false);
      expect(() => mixer.getChannelNode('click')).toThrow();
      expect(() => mixer.getAuditionNode('click')).toThrow();
      expect(fakeCtx().destination.incoming).toHaveLength(0);
    });

    it('builds 8 persistent native nodes (channels + auditions -> master headroom -> brickwall limiter -> destination)', () => {
      expect(mixer.initToneNodes()).toBe(true);
      expect(mixer.isGraphInitialized()).toBe(true);

      const ctx = fakeCtx();
      expect(ctx.gains).toHaveLength(7); // 3 channels + 3 auditions + 1 master headroom
      expect(ctx.compressors).toHaveLength(1); // 1 brickwall limiter

      const masterGain = nodeByLabel('mixer:master:gain') as FakeGainNode;
      const masterLimiter = nodeByLabel('mixer:master:limiter');
      expect(masterGain.gain.value).toBe(0.4);
      expect(masterGain.connectedTo).toContain(masterLimiter);
      expect(masterLimiter.connectedTo).toContain(ctx.destination);

      for (const channel of MIXING_CHANNELS) {
        const main = nodeByLabel(`mixer:${channel}`) as FakeGainNode;
        const audition = nodeByLabel(`audition:${channel}`) as FakeGainNode;
        expect(main.connectedTo).toContain(masterGain);
        expect(audition.connectedTo).toContain(masterGain);
        expect(ctx.routeTo(main, ctx.destination)).not.toBeNull();
        expect(ctx.routeTo(audition, ctx.destination)).not.toBeNull();
        expect(main.gain.value).toBe(0.8);
        expect(audition.gain.value).toBe(0.8);
      }

      expect(ctx.destination.incoming).toHaveLength(1);
    });

    it('keeps the nodes it already built when initToneNodes is called again', () => {
      expect(mixer.initToneNodes()).toBe(true);
      const clickNode = mixer.getChannelNode('click');

      expect(mixer.initToneNodes()).toBe(true);
      expect(mixer.getChannelNode('click')).toBe(clickNode);
    });

    it('writes volume changes on the Mixing Channel node and its Audition node', () => {
      mixer.initToneNodes();
      mixer.setChannelVolume('ostinato', 0.3);

      expect((nodeByLabel('mixer:ostinato') as FakeGainNode).gain.value).toBe(0.3);
      expect((nodeByLabel('audition:ostinato') as FakeGainNode).gain.value).toBe(0.3);
    });

    it('silences only the Mixing Channel node when the channel is muted', () => {
      mixer.initToneNodes();
      mixer.setChannelVolume('orchestration', 0.45);
      mixer.setChannelMute('orchestration', true);

      expect((nodeByLabel('mixer:orchestration') as FakeGainNode).gain.value).toBe(0.0);
      // The Audition node keeps the channel volume so a tap is still heard.
      expect((nodeByLabel('audition:orchestration') as FakeGainNode).gain.value).toBe(0.45);
      expect(mixer.isChannelAudible('orchestration')).toBe(false);
      expect(mixer.getChannelVolume('orchestration')).toBe(0.45);
    });

    it('builds a muted channel silent from the start', () => {
      mixer.setChannelMute('click', true);
      mixer.initToneNodes();

      expect((nodeByLabel('mixer:click') as FakeGainNode).gain.value).toBe(0);
      expect((nodeByLabel('audition:click') as FakeGainNode).gain.value).toBe(0.8);
    });

    it('disconnects every node it owns on dispose', () => {
      mixer.initToneNodes();
      mixer.dispose();

      expect(fakeCtx().destination.incoming).toHaveLength(0);
      expect(mixer.isGraphInitialized()).toBe(false);
      expect(() => mixer.getChannelNode('click')).toThrow();
    });
  });
});
