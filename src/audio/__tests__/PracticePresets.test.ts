import { describe, it, expect, beforeEach } from 'vitest';
import { AudioMixer, AudioMixerState, MIXING_CHANNELS } from '../AudioMixer';
import {
  ALL_CHANNELS_COMPOSED,
  ComposedChannels,
  PracticePreset,
  PRACTICE_PRESETS,
  applyPracticePreset,
  composedChannels,
  derivePracticePreset,
} from '../PracticePresets';
import { DawsonEngine } from '../../domain/dawson/DawsonEngine';

/**
 * Practice Presets are a name given to a combination of Mixing Channel mutes. They are
 * derived from the live mixer state, never stored next to it, and applying one flips mute
 * flags only. See docs/adr/0005 and GLOSSARY.md.
 */

function volumesOf(state: AudioMixerState): number[] {
  return [...MIXING_CHANNELS.map((channel) => state[channel].volume), state.master.volume];
}

describe('PracticePresets', () => {
  let mixer: AudioMixer;

  beforeEach(() => {
    mixer = new AudioMixer();
  });

  describe('derivePracticePreset', () => {
    it('derives Full Mix when every Mixing Channel can be heard', () => {
      expect(derivePracticePreset(mixer.getState())).toBe('full-mix');
    });

    it('derives Click Only when both Pads Channels are muted', () => {
      mixer.setChannelMute('ostinato', true);
      mixer.setChannelMute('orchestration', true);
      expect(derivePracticePreset(mixer.getState())).toBe('click-only');
    });

    it('derives Drums Only when the Click Channel is muted and both Pads Channels are heard', () => {
      mixer.setChannelMute('click', true);
      expect(derivePracticePreset(mixer.getState())).toBe('drums-only');
    });

    it('derives Custom when the mutes match no preset', () => {
      mixer.setChannelMute('ostinato', true);
      expect(derivePracticePreset(mixer.getState())).toBe('custom');

      mixer.setChannelMute('click', true);
      expect(derivePracticePreset(mixer.getState())).toBe('custom');
    });

    it('derives Custom when nothing at all is audible', () => {
      MIXING_CHANNELS.forEach((channel) => mixer.setChannelMute(channel, true));
      expect(derivePracticePreset(mixer.getState())).toBe('custom');
    });

    it('treats a channel dragged to zero as silent the same way as a mute', () => {
      mixer.setChannelVolume('ostinato', 0);
      mixer.setChannelVolume('orchestration', 0);
      expect(derivePracticePreset(mixer.getState())).toBe('click-only');

      mixer.setChannelMute('ostinato', true);
      mixer.setChannelVolume('ostinato', 0.6);
      mixer.setChannelVolume('orchestration', 0);
      expect(derivePracticePreset(mixer.getState())).toBe('click-only');
    });

    it('reads the preset from the state it is handed, not from anything it remembers', () => {
      mixer.setChannelMute('ostinato', true);
      mixer.setChannelMute('orchestration', true);
      const clickOnly = mixer.getState();
      mixer.setChannelMute('ostinato', false);
      mixer.setChannelMute('orchestration', false);

      expect(derivePracticePreset(clickOnly)).toBe('click-only');
      expect(derivePracticePreset(mixer.getState())).toBe('full-mix');
    });

    it('lists the three presets it can light, plus Custom', () => {
      expect(PRACTICE_PRESETS).toEqual(['click-only', 'drums-only', 'full-mix']);
    });

    describe('a Mixing Channel the active Dawson System does not compose', () => {
      let notComposed: ComposedChannels;

      beforeEach(() => {
        notComposed = { click: true, ostinato: false, orchestration: true };
      });

      it('does not keep the derived preset away from the one the audible channels match', () => {
        mixer.setChannelMute('ostinato', true);
        expect(derivePracticePreset(mixer.getState(), notComposed)).toBe('full-mix');
        expect(derivePracticePreset(mixer.getState(), ALL_CHANNELS_COMPOSED)).toBe('custom');
      });

      it('is not required to be audible for a preset to match', () => {
        expect(derivePracticePreset(mixer.getState(), notComposed)).toBe('full-mix');
      });
    });
  });

  describe('applyPracticePreset', () => {
    it('Click Only mutes both Pads Channels and leaves the Click Channel audible', () => {
      mixer.setChannelMute('ostinato', true);
      applyPracticePreset(mixer, 'click-only');
      expect(mixer.isChannelMuted('click')).toBe(false);
      expect(mixer.isChannelMuted('ostinato')).toBe(true);
      expect(mixer.isChannelMuted('orchestration')).toBe(true);
    });

    it('Drums Only mutes the Click Channel and unmutes both Pads Channels', () => {
      mixer.setChannelMute('click', true);
      mixer.setChannelMute('orchestration', true);
      applyPracticePreset(mixer, 'drums-only');
      expect(mixer.isChannelMuted('click')).toBe(true);
      expect(mixer.isChannelMuted('ostinato')).toBe(false);
      expect(mixer.isChannelMuted('orchestration')).toBe(false);
    });

    it('Full Mix unmutes every Mixing Channel', () => {
      MIXING_CHANNELS.forEach((channel) => mixer.setChannelMute(channel, true));
      applyPracticePreset(mixer, 'full-mix');
      MIXING_CHANNELS.forEach((channel) =>
        expect(mixer.isChannelMuted(channel)).toBe(false)
      );
    });

    it('leaves every volume value untouched, including the Master', () => {
      mixer.setChannelVolume('click', 0.35);
      mixer.setChannelVolume('ostinato', 0.9);
      mixer.setChannelVolume('orchestration', 0.15);
      mixer.setMasterVolume(0.62);
      const before = volumesOf(mixer.getState());

      (PRACTICE_PRESETS as PracticePreset[]).forEach((preset) => {
        applyPracticePreset(mixer, preset);
        expect(volumesOf(mixer.getState())).toEqual(before);
      });

      applyPracticePreset(mixer, 'custom');
      expect(volumesOf(mixer.getState())).toEqual(before);
    });

    it('lands on the preset it was asked for, so the preset row lights it', () => {
      applyPracticePreset(mixer, 'click-only');
      expect(derivePracticePreset(mixer.getState())).toBe('click-only');

      applyPracticePreset(mixer, 'drums-only');
      expect(derivePracticePreset(mixer.getState())).toBe('drums-only');

      applyPracticePreset(mixer, 'full-mix');
      expect(derivePracticePreset(mixer.getState())).toBe('full-mix');
    });

    it('announces the new mixer state to the mixer listeners', () => {
      const seen: AudioMixerState[] = [];
      mixer.onStateChange((state) => seen.push(state));

      applyPracticePreset(mixer, 'click-only');

      expect(seen.length).toBeGreaterThan(0);
      expect(seen[seen.length - 1].ostinato.muted).toBe(true);
    });

    it('leaves a Mixing Channel the system does not compose alone', () => {
      const notComposed: ComposedChannels = {
        click: true,
        ostinato: false,
        orchestration: true,
      };
      applyPracticePreset(mixer, 'click-only', notComposed);

      expect(mixer.isChannelMuted('ostinato')).toBe(false);
      expect(mixer.isChannelMuted('orchestration')).toBe(true);
    });
  });

  describe('composedChannels', () => {
    it('composes the Click Channel and the orchestrated line whatever the Dawson System', () => {
      const engine = new DawsonEngine({ mode: 'classic_bop', ostinato: 'none' });
      const composed = composedChannels(engine);

      expect(composed.click).toBe(true);
      expect(composed.orchestration).toBe(true);
    });

    it('does not compose the Ostinato Channel for a Dawson System with No Ostinato', () => {
      const engine = new DawsonEngine({ mode: 'classic_bop', ostinato: 'jazz_swing' });
      expect(composedChannels(engine).ostinato).toBe(true);

      engine.setOstinato('none');
      expect(composedChannels(engine).ostinato).toBe(false);
    });
  });
});
