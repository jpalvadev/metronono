import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioMixer, MIXING_CHANNELS } from '../AudioMixer';
import { fakeToneRecorder } from '../../test/fakeTone';

vi.mock('tone', async () => {
  const fake = await import('../../test/fakeTone');
  return { ...fake.fakeToneModule, default: fake.fakeToneModule };
});

function nodeByLabel(label: string) {
  const node = fakeToneRecorder.nodes.find((created) => created.label === label);
  if (!node) throw new Error(`no node labelled '${label}' in the recorded graph`);
  return node;
}

describe('AudioMixer', () => {
  let mixer: AudioMixer;

  beforeEach(() => {
    fakeToneRecorder.reset();
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
      expect(state.master.volume).toBe(0.8);
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

    it('controls master volume', () => {
      mixer.setMasterVolume(0.6);
      expect(mixer.getMasterVolume()).toBe(0.6);

      mixer.setMasterVolume(2.0);
      expect(mixer.getMasterVolume()).toBe(1.0);
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
        click: expect.objectContaining({ volume: 0.9, muted: false })
      }));

      mixer.toggleChannelMute('click');
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        click: expect.objectContaining({ volume: 0.9, muted: true })
      }));

      unsubscribe();
      mixer.setChannelVolume('click', 0.2);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('Mixing Channel Graph', () => {
    it('has no nodes and refuses to hand one out before the graph is built', () => {
      expect(mixer.isGraphInitialized()).toBe(false);
      expect(() => mixer.getChannelNode('click')).toThrow();
      expect(() => mixer.getAuditionNode('click')).toThrow();
      expect(() => mixer.getMasterNode()).toThrow();
      expect(fakeToneRecorder.destination.incoming).toHaveLength(0);
    });

    it('builds the three Mixing Channel nodes and the Audition nodes onto the Master', () => {
      expect(mixer.initToneNodes()).toBe(true);
      expect(mixer.isGraphInitialized()).toBe(true);

      const master = nodeByLabel('mixer:master');
      for (const channel of MIXING_CHANNELS) {
        const main = nodeByLabel(`mixer:${channel}`);
        const audition = nodeByLabel(`audition:${channel}`);
        expect(fakeToneRecorder.connectedTo(main)).toContain(master);
        expect(fakeToneRecorder.connectedTo(audition)).toContain(master);
        expect(fakeToneRecorder.gainValue(main)).toBe(0.8);
        expect(fakeToneRecorder.gainValue(audition)).toBe(0.8);
      }

      // The Master is the only connection to the audio destination.
      expect(fakeToneRecorder.connectedTo(master)).toContain(fakeToneRecorder.destination);
      expect(fakeToneRecorder.destination.incoming).toHaveLength(1);
      expect(fakeToneRecorder.destination.incoming[0]).toBe(master);
    });

    it('keeps the nodes it already built when initToneNodes is called again', () => {
      expect(mixer.initToneNodes()).toBe(true);
      const clickNode = mixer.getChannelNode('click');

      expect(mixer.initToneNodes()).toBe(true);
      expect(mixer.getChannelNode('click')).toBe(clickNode);
      expect(fakeToneRecorder.nodes.filter((n) => n.label === 'mixer:master')).toHaveLength(1);
    });

    it('writes volume changes on the Mixing Channel node and its Audition node', () => {
      mixer.initToneNodes();
      mixer.setChannelVolume('ostinato', 0.3);

      expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:ostinato'))).toBe(0.3);
      expect(fakeToneRecorder.lastGainWrite(nodeByLabel('mixer:ostinato'))?.value).toBe(0.3);
      expect(fakeToneRecorder.gainValue(nodeByLabel('audition:ostinato'))).toBe(0.3);
    });

    it('silences only the Mixing Channel node when the channel is muted', () => {
      mixer.initToneNodes();
      mixer.setChannelVolume('orchestration', 0.45);
      mixer.setChannelMute('orchestration', true);

      expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:orchestration'))).toBe(0.0);
      expect(fakeToneRecorder.lastGainWrite(nodeByLabel('mixer:orchestration'))?.value).toBe(0);
      // The Audition node keeps the channel volume so a tap is still heard.
      expect(fakeToneRecorder.gainValue(nodeByLabel('audition:orchestration'))).toBe(0.45);
      expect(mixer.isChannelAudible('orchestration')).toBe(false);
      expect(mixer.getChannelVolume('orchestration')).toBe(0.45);
    });

    it('builds a muted channel silent from the start', () => {
      mixer.setChannelMute('click', true);
      mixer.initToneNodes();

      expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:click'))).toBe(0);
      expect(fakeToneRecorder.gainValue(nodeByLabel('audition:click'))).toBe(0.8);
    });

    it('writes master loudness on the Master node', () => {
      mixer.initToneNodes();
      mixer.setMasterVolume(0.4);

      expect(fakeToneRecorder.gainValue(nodeByLabel('mixer:master'))).toBe(0.4);
      expect(fakeToneRecorder.lastGainWrite(nodeByLabel('mixer:master'))?.value).toBe(0.4);
    });

    it('disconnects every node it owns on dispose', () => {
      mixer.initToneNodes();
      mixer.dispose();

      expect(fakeToneRecorder.destination.incoming).toHaveLength(0);
      expect(mixer.isGraphInitialized()).toBe(false);
      expect(() => mixer.getChannelNode('click')).toThrow();
    });
  });
});
