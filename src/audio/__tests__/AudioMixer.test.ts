import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioMixer } from '../AudioMixer';

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

  describe('Gain Node Automation', () => {
    it('applies gain ramps to custom injected gain nodes', () => {
      const mockGainNode = {
        gain: {
          value: 0.8,
          rampTo: vi.fn(),
        },
      };

      const customMixer = new AudioMixer({
        channelNodes: {
          click: mockGainNode as any,
          ostinato: mockGainNode as any,
          orchestration: mockGainNode as any,
        },
      });

      customMixer.setChannelVolume('click', 0.5);
      expect(mockGainNode.gain.rampTo).toHaveBeenCalledWith(0.5, expect.any(Number));

      customMixer.setChannelMute('click', true);
      expect(mockGainNode.gain.rampTo).toHaveBeenCalledWith(0, expect.any(Number));
    });
  });
});
