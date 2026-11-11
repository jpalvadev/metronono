import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MixerPanel } from '../MixerPanel';
import { ToneTransportScheduler } from '../../audio/ToneTransportScheduler';
import { AudioMixer, MIXING_CHANNELS, MixerChannelId } from '../../audio/AudioMixer';
import { DawsonEngine } from '../../domain/dawson/DawsonEngine';

/**
 * The Mixer Panel is the app's only loudness control: one row per Mixing Channel plus the
 * Master, and a Practice Preset row derived from the live mixer state. Tested at the React
 * component seam against a fake scheduler, like the Metronome and Dawson section suites.
 */

describe('MixerPanel', () => {
  let mixer: AudioMixer;
  let engine: DawsonEngine;
  let scheduler: ToneTransportScheduler;

  function renderPanel() {
    render(<MixerPanel scheduler={scheduler} />);
  }

  function pressPreset(name: 'Click Only' | 'Drums Only' | 'Full Mix') {
    fireEvent.click(screen.getByRole('button', { name }));
  }

  function litPresets(): string[] {
    return ['Click Only', 'Drums Only', 'Full Mix', 'Custom']
      .filter((name) => screen.getByRole('button', { name }).getAttribute('aria-pressed') === 'true')
      .map((name) => name.toLowerCase());
  }

  function volumes(): number[] {
    const state = mixer.getState();
    return [...MIXING_CHANNELS.map((channel) => state[channel].volume), state.master.volume];
  }

  beforeEach(() => {
    mixer = new AudioMixer();
    engine = new DawsonEngine({ mode: 'classic_bop', ostinato: 'jazz_swing' });

    scheduler = {
      getAudioMixer: () => mixer,
      getDawsonEngine: () => engine,
      getDrumKitPlayer: () => ({
        play: vi.fn(),
        triggerVoice: vi.fn(),
      }),
    } as unknown as ToneTransportScheduler;
  });

  it('renders the Custom Practice Preset chip with neutral token roles, never Warning', () => {
    // Force a mix that matches no Practice Preset so the Custom chip lights up
    mixer.setChannelMute('ostinato', true);
    renderPanel();

    const customChip = screen.getByRole('button', { name: 'Custom' });
    expect(customChip).toHaveAttribute('aria-pressed', 'true');
    expect(customChip).toHaveClass('bg-secondary');
    expect(customChip).toHaveClass('text-secondary-foreground');

    for (const el of document.body.querySelectorAll('*')) {
      expect(
        /(?:teal|rose|emerald|amber|purple|slate)-\d|bg-(?:white|black)|text-white|dark:|rgba\(|rounded(?!-none)/.test(
          el.getAttribute('class') ?? ''
        )
      ).toBe(false);
    }
  });

  it('renders the Master row and one row for every Mixing Channel', () => {
    renderPanel();

    expect(screen.getByText(/Mixer Panel/i)).toBeInTheDocument();

    expect(screen.getByTestId('mixer-row-master')).toBeInTheDocument();
    expect(screen.getByLabelText(/Master Volume/i)).toBeInTheDocument();

    expect(screen.getByTestId('mixer-row-click')).toBeInTheDocument();
    expect(screen.getByTestId('mixer-row-ostinato')).toBeInTheDocument();
    expect(screen.getByTestId('mixer-row-orchestration')).toBeInTheDocument();

    expect(screen.getByLabelText(/Click Volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ostinato Volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Orchestrated Line Volume/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Mute Click/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mute Ostinato/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mute Orchestrated Line/i })).toBeInTheDocument();
  });

  it('writes a volume slider change to the Mixing Channel it belongs to', () => {
    renderPanel();

    fireEvent.change(screen.getByLabelText(/Click Volume/i), { target: { value: '0.4' } });
    expect(mixer.getChannelVolume('click')).toBe(0.4);

    fireEvent.change(screen.getByLabelText(/Orchestrated Line Volume/i), {
      target: { value: '0.65' },
    });
    expect(mixer.getChannelVolume('orchestration')).toBe(0.65);
  });

  it('flips a Mixing Channel mute from its row and back', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /Mute Ostinato/i }));
    expect(mixer.isChannelMuted('ostinato')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Unmute Ostinato/i }));
    expect(mixer.isChannelMuted('ostinato')).toBe(false);
  });

  it('carries the Master volume and nothing else', () => {
    renderPanel();

    fireEvent.change(screen.getByLabelText(/Master Volume/i), { target: { value: '0.5' } });
    expect(mixer.getMasterVolume()).toBe(0.5);

    const masterRow = screen.getByTestId('mixer-row-master');
    expect(within(masterRow).queryByRole('button', { name: /master/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /mute master/i })).toBeNull();
  });

  it('shows each row level as the channel actually plays at', () => {
    renderPanel();

    expect(screen.getByTestId('mixer-row-ostinato')).toHaveTextContent(/80%/);

    fireEvent.click(screen.getByRole('button', { name: /Mute Ostinato/i }));
    expect(screen.getByTestId('mixer-row-ostinato')).toHaveTextContent(/MUTED/);

    fireEvent.change(screen.getByLabelText(/Click Volume/i), { target: { value: '0.3' } });
    expect(screen.getByTestId('mixer-row-click')).toHaveTextContent(/30%/);
  });

  describe('Practice Presets', () => {
    it('Click Only gives a bare Metronome: both Pads Channels muted, the Click audible', () => {
      renderPanel();

      pressPreset('Click Only');

      expect(mixer.isChannelMuted('click')).toBe(false);
      expect(mixer.isChannelMuted('ostinato')).toBe(true);
      expect(mixer.isChannelMuted('orchestration')).toBe(true);
      expect(mixer.isChannelAudible('click')).toBe(true);
      expect(mixer.isChannelAudible('ostinato')).toBe(false);
      expect(mixer.isChannelAudible('orchestration')).toBe(false);
    });

    it('Drums Only gives the orchestrated exercise: the Click is muted and both Pads Channels audible', () => {
      renderPanel();

      pressPreset('Click Only');
      pressPreset('Drums Only');

      expect(mixer.isChannelMuted('click')).toBe(true);
      expect(mixer.isChannelMuted('ostinato')).toBe(false);
      expect(mixer.isChannelMuted('orchestration')).toBe(false);
      expect(mixer.isChannelAudible('click')).toBe(false);
    });

    it('Full Mix unmutes every Mixing Channel', () => {
      renderPanel();

      pressPreset('Click Only');
      pressPreset('Full Mix');

      MIXING_CHANNELS.forEach((channel: MixerChannelId) =>
        expect(mixer.isChannelMuted(channel)).toBe(false)
      );
    });

    it('never changes a volume value, so a balance tuned by ear survives', () => {
      renderPanel();

      fireEvent.change(screen.getByLabelText(/Click Volume/i), { target: { value: '0.35' } });
      fireEvent.change(screen.getByLabelText(/Ostinato Volume/i), { target: { value: '0.9' } });
      fireEvent.change(screen.getByLabelText(/Orchestrated Line Volume/i), {
        target: { value: '0.15' },
      });
      fireEvent.change(screen.getByLabelText(/Master Volume/i), { target: { value: '0.62' } });
      const before = volumes();

      pressPreset('Click Only');
      expect(volumes()).toEqual(before);

      pressPreset('Drums Only');
      expect(volumes()).toEqual(before);

      pressPreset('Full Mix');
      expect(volumes()).toEqual(before);
    });

    it('lights the preset the live mixer state matches', () => {
      renderPanel();

      expect(litPresets()).toEqual(['full mix']);

      pressPreset('Click Only');
      expect(litPresets()).toEqual(['click only']);

      pressPreset('Drums Only');
      expect(litPresets()).toEqual(['drums only']);
    });

    it('lights Custom when hand-tuned mutes match no preset', () => {
      renderPanel();

      fireEvent.click(screen.getByRole('button', { name: /Mute Ostinato/i }));
      expect(litPresets()).toEqual(['custom']);
    });

    it('re-lights a preset when hand-tuned mutes happen to match one', () => {
      renderPanel();

      fireEvent.click(screen.getByRole('button', { name: /Mute Ostinato/i }));
      expect(litPresets()).toEqual(['custom']);

      fireEvent.click(screen.getByRole('button', { name: /Mute Orchestrated Line/i }));
      expect(litPresets()).toEqual(['click only']);
    });

    it('lights the same preset for a channel dragged to zero as for muting it', () => {
      renderPanel();

      fireEvent.change(screen.getByLabelText(/Ostinato Volume/i), { target: { value: '0' } });
      fireEvent.change(screen.getByLabelText(/Orchestrated Line Volume/i), {
        target: { value: '0' },
      });

      expect(litPresets()).toEqual(['click only']);
    });

    it('re-derives the lit preset when the mixer changes away from the panel', () => {
      renderPanel();

      act(() => {
        mixer.setChannelMute('ostinato', true);
        mixer.setChannelMute('orchestration', true);
      });

      expect(litPresets()).toEqual(['click only']);
    });

    it('holds no loudness control in the preset row', () => {
      renderPanel();

      const presetRow = screen.getByTestId('mixer-preset-row');
      expect(within(presetRow).queryAllByRole('slider')).toHaveLength(0);
    });
  });

  describe('a Mixing Channel the active Dawson System does not compose', () => {
    beforeEach(() => {
      engine.setOstinato('none');
    });

    it('renders the Ostinato row inert instead of offering a control with nothing behind it', () => {
      renderPanel();

      const row = screen.getByTestId('mixer-row-ostinato');
      expect(row).toHaveAttribute('data-composed', 'false');
      expect(row).toHaveTextContent(/No Ostinato composed/i);
      expect(within(row).queryByLabelText(/Ostinato Volume/i)).toBeNull();
      expect(within(row).queryByRole('button', { name: /Ostinato/i })).toBeNull();
    });

    it('still offers the Ostinato row when the Dawson System composes an Ostinato', () => {
      engine.setOstinato('jazz_swing');
      renderPanel();

      const row = screen.getByTestId('mixer-row-ostinato');
      expect(row).toHaveAttribute('data-composed', 'true');
      expect(within(row).getByLabelText(/Ostinato Volume/i)).toBeInTheDocument();
    });

    it('follows the Dawson System when it changes to No Ostinato', () => {
      engine.setOstinato('jazz_swing');
      renderPanel();

      expect(screen.getByTestId('mixer-row-ostinato')).toHaveAttribute('data-composed', 'true');

      act(() => {
        engine.setOstinato('none');
      });

      expect(screen.getByTestId('mixer-row-ostinato')).toHaveAttribute('data-composed', 'false');
      expect(within(screen.getByTestId('mixer-row-ostinato')).queryByLabelText(/Ostinato Volume/i)).toBeNull();
    });

    it('is left alone by a Practice Preset press', () => {
      renderPanel();

      pressPreset('Click Only');

      expect(mixer.isChannelMuted('ostinato')).toBe(false);
      expect(mixer.isChannelMuted('orchestration')).toBe(true);
    });

    it('does not keep the preset row from lighting the preset the audible channels match', () => {
      renderPanel();

      pressPreset('Click Only');
      expect(litPresets()).toEqual(['click only']);

      pressPreset('Full Mix');
      expect(litPresets()).toEqual(['full mix']);
    });
  });
});
