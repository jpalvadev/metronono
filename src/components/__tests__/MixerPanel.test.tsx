import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MixerPanel } from '../MixerPanel';
import { ToneTransportScheduler } from '../../audio/ToneTransportScheduler';
import { AudioMixer } from '../../audio/AudioMixer';
import { DawsonEngine } from '../../domain/dawson/DawsonEngine';
import { MetronomeEngine } from '../../domain/metronome/MetronomeEngine';

/**
 * The Mixer Panel controls loudness for the three click voices (Downbeat, Regular, Subdivision)
 * plus Ostinato and Orchestrated Line. No master click row or global master fader exists.
 */

describe('MixerPanel', () => {
  let mixer: AudioMixer;
  let engine: DawsonEngine;
  let metronomeEngine: MetronomeEngine;
  let scheduler: ToneTransportScheduler;

  function renderPanel() {
    render(<MixerPanel scheduler={scheduler} />);
  }

  beforeEach(() => {
    mixer = new AudioMixer();
    engine = new DawsonEngine({ mode: 'classic_bop', ostinato: 'jazz_swing' });
    metronomeEngine = new MetronomeEngine();

    scheduler = new ToneTransportScheduler({
      engine: metronomeEngine,
      audioMixer: mixer,
      dawsonEngine: engine,
    });
  });

  it('renders Downbeat, Regular, Subdivision, Ostinato, and Orchestrated Line rows without any click master row', () => {
    renderPanel();

    expect(screen.getByText(/Mixer Panel/i)).toBeInTheDocument();
    expect(screen.getByText(/Channel loudness controls/i)).toBeInTheDocument();

    // Master row, presets, and click master row are completely removed
    expect(screen.queryByTestId('mixer-row-master')).toBeNull();
    expect(screen.queryByLabelText(/Master Volume/i)).toBeNull();
    expect(screen.queryByTestId('mixer-preset-row')).toBeNull();
    expect(screen.queryByTestId('mixer-row-click')).toBeNull();
    expect(screen.queryByLabelText(/Click Volume/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Mute Click/i })).toBeNull();

    // 3 per-voice click rows + Ostinato + Orchestrated Line
    expect(screen.getByTestId('mixer-row-downbeat')).toBeInTheDocument();
    expect(screen.getByTestId('mixer-row-regular')).toBeInTheDocument();
    expect(screen.getByTestId('mixer-row-subdivision')).toBeInTheDocument();
    expect(screen.getByTestId('mixer-row-ostinato')).toBeInTheDocument();
    expect(screen.getByTestId('mixer-row-orchestration')).toBeInTheDocument();

    expect(screen.getByLabelText(/Downbeat Volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Regular Volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Subdivision Volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Subdivision Divisions/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ostinato Volume/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Orchestrated Line Volume/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Mute Downbeat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mute Regular/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mute Subdivision/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mute Ostinato/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mute Orchestrated Line/i })).toBeInTheDocument();
  });

  it('writes per-voice click volume and mute changes to MetronomeEngine and preserves volume when muted', () => {
    renderPanel();

    fireEvent.change(screen.getByLabelText(/Downbeat Volume/i), { target: { value: '0.45' } });
    expect(scheduler.getClickConfig().downbeat.volume).toBe(0.45);
    expect(screen.getByTestId('mixer-row-downbeat')).toHaveTextContent(/45%/);

    fireEvent.click(screen.getByRole('button', { name: /Mute Downbeat/i }));
    expect(scheduler.getClickConfig().downbeat.muted).toBe(true);
    expect(scheduler.getClickConfig().downbeat.volume).toBe(0.45);
    expect(screen.getByTestId('mixer-row-downbeat')).toHaveTextContent(/MUTED/);
    expect((screen.getByLabelText(/Downbeat Volume/i) as HTMLInputElement).value).toBe('0.45');

    fireEvent.click(screen.getByRole('button', { name: /Unmute Downbeat/i }));
    expect(scheduler.getClickConfig().downbeat.muted).toBe(false);
    expect(screen.getByTestId('mixer-row-downbeat')).toHaveTextContent(/45%/);

    fireEvent.change(screen.getByLabelText(/Regular Volume/i), { target: { value: '0' } });
    expect(screen.getByTestId('mixer-row-regular')).toHaveTextContent(/SILENT/);
  });

  it('controls Subdivision divisions from 1 to 8 while keeping volume and mute editable at 1', () => {
    renderPanel();

    const subRow = screen.getByTestId('mixer-row-subdivision');
    const divSlider = within(subRow).getByLabelText(/Subdivision Divisions/i) as HTMLInputElement;
    expect(divSlider.min).toBe('1');
    expect(divSlider.max).toBe('8');
    expect(divSlider.step).toBe('1');
    expect(divSlider.value).toBe('1');
    expect(subRow).toHaveTextContent(/1/);

    // At divisions === 1, volume and mute remain editable
    const subVol = within(subRow).getByLabelText(/Subdivision Volume/i) as HTMLInputElement;
    const subMute = within(subRow).getByRole('button', { name: /Mute Subdivision/i });
    expect(subVol.disabled).toBe(false);
    expect(subMute).not.toBeDisabled();

    fireEvent.change(subVol, { target: { value: '0.35' } });
    expect(scheduler.getClickConfig().subdivision.volume).toBe(0.35);

    fireEvent.change(divSlider, { target: { value: '8' } });
    expect(scheduler.getClickConfig().subdivision.divisions).toBe(8);
    expect(divSlider.value).toBe('8');
    expect(subRow).toHaveTextContent(/8/);
  });

  it('writes a volume slider change to the Ostinato or Orchestrated Line Mixing Channel', () => {
    renderPanel();

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

  it('shows each Mixing Channel row level as the channel actually plays at', () => {
    renderPanel();

    expect(screen.getByTestId('mixer-row-ostinato')).toHaveTextContent(/80%/);

    fireEvent.click(screen.getByRole('button', { name: /Mute Ostinato/i }));
    expect(screen.getByTestId('mixer-row-ostinato')).toHaveTextContent(/MUTED/);
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
