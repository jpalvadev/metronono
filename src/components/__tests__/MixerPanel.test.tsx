import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MixerPanel } from '../MixerPanel';
import { ToneTransportScheduler } from '../../audio/ToneTransportScheduler';
import { AudioMixer } from '../../audio/AudioMixer';
import { DawsonEngine } from '../../domain/dawson/DawsonEngine';

/**
 * The Mixer Panel controls loudness for each Mixing Channel: Click, Ostinato, and Orchestrated Line.
 * Master volume and Practice Presets have been removed (ADR-0008).
 */

describe('MixerPanel', () => {
  let mixer: AudioMixer;
  let engine: DawsonEngine;
  let scheduler: ToneTransportScheduler;

  function renderPanel() {
    render(<MixerPanel scheduler={scheduler} />);
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

  it('renders one row for every Mixing Channel and does not render Master or Presets', () => {
    renderPanel();

    expect(screen.getByText(/Mixer Panel/i)).toBeInTheDocument();
    expect(screen.getByText(/Channel loudness controls/i)).toBeInTheDocument();

    // Master row and presets are completely removed
    expect(screen.queryByTestId('mixer-row-master')).toBeNull();
    expect(screen.queryByLabelText(/Master Volume/i)).toBeNull();
    expect(screen.queryByTestId('mixer-preset-row')).toBeNull();

    // 3 Mixing Channel rows are present
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

  it('shows each row level as the channel actually plays at', () => {
    renderPanel();

    expect(screen.getByTestId('mixer-row-ostinato')).toHaveTextContent(/80%/);

    fireEvent.click(screen.getByRole('button', { name: /Mute Ostinato/i }));
    expect(screen.getByTestId('mixer-row-ostinato')).toHaveTextContent(/MUTED/);

    fireEvent.change(screen.getByLabelText(/Click Volume/i), { target: { value: '0.3' } });
    expect(screen.getByTestId('mixer-row-click')).toHaveTextContent(/30%/);
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
  });
});
