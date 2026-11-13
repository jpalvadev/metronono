import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DawsonOrchestrationSection } from '../DawsonOrchestrationSection';
import { ToneTransportScheduler } from '../../audio/ToneTransportScheduler';
import { AudioMixer } from '../../audio/AudioMixer';
import { DawsonEngine } from '../../domain/dawson/DawsonEngine';
import { IDrumKitPlayer } from '../../audio/DrumKitPlayer';

describe('DawsonOrchestrationSection', () => {
  let scheduler: ToneTransportScheduler;
  let mixer: AudioMixer;
  let engine: DawsonEngine;
  let player: IDrumKitPlayer;
  let mockTriggerVoice: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mixer = new AudioMixer();
    engine = new DawsonEngine({ mode: 'classic_bop', ostinato: 'jazz_swing' });
    mockTriggerVoice = vi.fn();
    player = {
      initSynths: vi.fn(() => true),
      play: vi.fn(),
      triggerVoice: mockTriggerVoice,
      loadSampleBuffer: vi.fn(),
      removeSampleBuffer: vi.fn(),
      hasCustomSample: vi.fn(() => false),
      clearAllCustomSamples: vi.fn(),
    };

    scheduler = {
      getAudioMixer: () => mixer,
      getDawsonEngine: () => engine,
      getDrumKitPlayer: () => player,
    } as unknown as ToneTransportScheduler;
  });

  it('renders kick highlights and status text with token roles only', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    const kickHighlights = document.body.querySelectorAll('[class*="text-destructive"]');
    expect(kickHighlights.length).toBeGreaterThanOrEqual(1);

    for (const el of document.body.querySelectorAll('*')) {
      expect(
        /(?:teal|rose|emerald|amber|purple|slate)-\d|bg-(?:white|black)|text-white|dark:|rgba\(|rounded(?!-none)/.test(
          el.getAttribute('class') ?? ''
        )
      ).toBe(false);
    }
  });

  it('renders system selector without drum pads or monitor, and without any loudness control', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    expect(screen.getByText(/^Alan Dawson Orchestration$/)).toBeInTheDocument();
    expect(screen.getByTestId('system-select')).toBeInTheDocument();

    // The Real-Time Drum Monitor is gone: no pads, no monitor header, no audition prompt.
    for (const pad of ['drum-pad-kick', 'drum-pad-snare', 'drum-pad-ride', 'drum-pad-hihat']) {
      expect(screen.queryByTestId(pad)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/Real-Time Drum Monitor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Click pad to audition/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Drum Monitor/i)).not.toBeInTheDocument();

    // The embedded mixer card is gone: loudness belongs to the Mixer Panel (ticket 05).
    expect(screen.queryByText(/3-Channel Audio Mixer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Metronome Click/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Orchestrated Line/i)).not.toBeInTheDocument();
    for (const label of ['Master Volume', 'Click Volume', 'Ostinato Volume', 'Orchestrated Line Volume']) {
      expect(screen.queryByLabelText(new RegExp(label, 'i'))).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /^(Mute|Unmute) (Click|Ostinato|Orchestrated Line)$/i })).not.toBeInTheDocument();
  });

  describe('Two-Column Decoupled Layout & Inline Staves', () => {
    it('renders header with Tone.js badge and Manage Systems, Formulas & Ostinatos button', () => {
      render(<DawsonOrchestrationSection scheduler={scheduler} />);

      expect(screen.getByText(/Alan Dawson Orchestration/i)).toBeInTheDocument();
      expect(screen.getByText('Tone.js')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Manage Systems, Formulas & Ostinatos/i })
      ).toBeInTheDocument();
    });

    it('renders Ostinato and System dropdowns including Ninguno and factory presets', () => {
      render(<DawsonOrchestrationSection scheduler={scheduler} />);

      const ostinatoSelect = screen.getByTestId('ostinato-select') as HTMLSelectElement;
      expect(ostinatoSelect).toBeInTheDocument();
      expect(ostinatoSelect.value).toBe('jazz_swing');

      const systemSelect = screen.getByTestId('system-select') as HTMLSelectElement;
      expect(systemSelect).toBeInTheDocument();

      // Check options in ostinato dropdown
      const ostinatoOptions = Array.from(ostinatoSelect.options).map((o) => o.text);
      expect(ostinatoOptions).toContain('Ninguno');
      expect(ostinatoOptions).toContain('Jazz Swing');
      expect(ostinatoOptions).toContain('Corcheas en Hi-Hat');

      // Check options in system dropdown
      const systemOptions = Array.from(systemSelect.options).map((o) => o.text);
      expect(systemOptions).toContain('Ninguno');
      expect(systemOptions).toContain('Snare & Kick');
      expect(systemOptions).toContain('Hi-Hat Foot & Kick');
    });

    it('updates ostinato independently without mutating interpretation system', () => {
      render(<DawsonOrchestrationSection scheduler={scheduler} />);

      const ostinatoSelect = screen.getByTestId('ostinato-select') as HTMLSelectElement;
      const systemSelect = screen.getByTestId('system-select') as HTMLSelectElement;

      // Select Corcheas en Hi-Hat
      fireEvent.change(ostinatoSelect, { target: { value: 'straight_8ths_hihat' } });
      expect(engine.getOstinato()).toBe('straight_8ths_hihat');
      expect(ostinatoSelect.value).toBe('straight_8ths_hihat');

      // Interpretation system remains unchanged
      expect(systemSelect.value).not.toBe('none');

      // Select Ninguno in Ostinato dropdown
      fireEvent.change(ostinatoSelect, { target: { value: 'none' } });
      expect(engine.getOstinato()).toBe('none');
      // Silencio badge should now appear on the ostinato staff
      expect(screen.getByText('Silencio')).toBeInTheDocument();
    });

    it('updates interpretation system independently without mutating ostinato', () => {
      render(<DawsonOrchestrationSection scheduler={scheduler} />);

      const ostinatoSelect = screen.getByTestId('ostinato-select') as HTMLSelectElement;
      const systemSelect = screen.getByTestId('system-select') as HTMLSelectElement;

      // Select Hi-Hat Foot & Kick
      fireEvent.change(systemSelect, { target: { value: 'hihat_foot_and_kick' } });
      expect(engine.getSystem()?.id).toBe('hihat_foot_and_kick');
      // Ostinato preserved!
      expect(engine.getOstinato()).toBe('jazz_swing');
      expect(ostinatoSelect.value).toBe('jazz_swing');

      // Select Ninguno in System dropdown
      fireEvent.change(systemSelect, { target: { value: 'none' } });
      expect(engine.getSystem()).toBeUndefined();
      expect(systemSelect.value).toBe('none');
      // Ostinato still preserved!
      expect(engine.getOstinato()).toBe('jazz_swing');
    });

    it('does not render Audition buttons on the main view (auditioning lives in Manage Systems, Formulas & Ostinatos)', () => {
      render(<DawsonOrchestrationSection scheduler={scheduler} />);

      expect(screen.queryByTestId('ostinato-audition-btn')).not.toBeInTheDocument();
      expect(screen.queryAllByRole('button', { name: /\bAudition\b/i })).toHaveLength(0);
    });

    it('does not render Edit buttons on the main view (editing lives in Manage Systems, Formulas & Ostinatos)', () => {
      render(<DawsonOrchestrationSection scheduler={scheduler} />);

      expect(screen.queryByTestId('ostinato-edit-btn')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /\bEdit\b/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Manage Systems, Formulas & Ostinatos/i })
      ).toBeInTheDocument();
    });
  });

  it('offers "Ninguno" in the ostinato selector, and it still means no Ostinato layer', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    const ostinatoSelect = screen.getByTestId('ostinato-select') as HTMLSelectElement;
    fireEvent.change(ostinatoSelect, { target: { value: 'none' } });

    expect(engine.getOstinato()).toBe('none');
    // Muting the Ostinato Mixing Channel is a different thing entirely.
    expect(mixer.isChannelMuted('ostinato')).toBe(false);
  });

  it('retires pad auditioning and pad illumination entirely', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    // No pads to click, no hit subscriptions to flash them: auditioning lives in
    // PresetManager and the Sample Bank only.
    expect(screen.queryByTestId(/drum-pad-/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Click pad to audition/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Beats 2 & 4 Chick/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Spang-a-lang/i)).not.toBeInTheDocument();
  });

  it('selects preset systems from dropdown without affecting ostinato', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    const systemSelect = screen.getByTestId('system-select') as HTMLSelectElement;
    fireEvent.change(systemSelect, { target: { value: 'hihat_foot_and_kick' } });

    expect(engine.getSystem()?.id).toBe('hihat_foot_and_kick');
    expect(engine.getOstinato()).toBe('jazz_swing');
  });

  it('opens and closes PresetManager modal', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    const manageBtn = screen.getByRole('button', { name: /Manage Systems, Formulas & Ostinatos/i });
    fireEvent.click(manageBtn);

    expect(screen.getByText(/Dawson Systems & Formula Manager/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText(/Dawson Systems & Formula Manager/i)).not.toBeInTheDocument();
  });

  it('retains auditioning inside the PresetManager dialog when opened', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    // Main view has zero Audition buttons
    expect(screen.queryAllByRole('button', { name: /\bAudition\b/i })).toHaveLength(0);

    // Open PresetManager dialog
    const manageBtn = screen.getByRole('button', { name: /Manage Systems, Formulas & Ostinatos/i });
    fireEvent.click(manageBtn);

    // Switch to Ostinatos tab where patterns can be auditioned
    const ostinatosTab = screen.getByRole('button', { name: /^Ostinatos/i });
    fireEvent.click(ostinatosTab);

    // Audition buttons are present inside the dialog
    const dialogAuditionBtns = screen.getAllByRole('button', { name: /\bAudition\b/i });
    expect(dialogAuditionBtns.length).toBeGreaterThan(0);

    // Trigger audition inside dialog
    fireEvent.click(dialogAuditionBtns[0]);
    expect(mockTriggerVoice).toHaveBeenCalled();
  });

  it('suspends controls with a "4/4 only" indicator in non-4/4 meters and preserves selections on return to 4/4', () => {
    const scheduler = new ToneTransportScheduler();
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    const ostinatoSelect = screen.getByTestId('ostinato-select') as HTMLSelectElement;
    const systemSelect = screen.getByTestId('system-select') as HTMLSelectElement;
    fireEvent.change(ostinatoSelect, { target: { value: 'jazz_swing' } });
    expect(ostinatoSelect.value).toBe('jazz_swing');

    expect(screen.queryByText(/4\/4 only/i)).not.toBeInTheDocument();

    act(() => {
      scheduler.setTimeSignature('7/8');
    });

    expect(screen.getByText(/4\/4 only/i)).toBeInTheDocument();
    expect(ostinatoSelect).toBeDisabled();
    expect(systemSelect).toBeDisabled();

    act(() => {
      scheduler.setTimeSignature('4/4');
    });

    expect(screen.queryByText(/4\/4 only/i)).not.toBeInTheDocument();
    expect(ostinatoSelect).not.toBeDisabled();
    expect(systemSelect).not.toBeDisabled();
    expect(ostinatoSelect.value).toBe('jazz_swing');

    // Triplet pulse feel in 4/4 also suspends Dawson orchestration
    act(() => {
      scheduler.setPulseFeel('triplet');
    });
    expect(screen.getByText(/4\/4 only/i)).toBeInTheDocument();
    expect(ostinatoSelect).toBeDisabled();
    expect(systemSelect).toBeDisabled();

    act(() => {
      scheduler.setPulseFeel('straight');
    });
    expect(screen.queryByText(/4\/4 only/i)).not.toBeInTheDocument();
    expect(ostinatoSelect).not.toBeDisabled();
    expect(systemSelect).not.toBeDisabled();
  });
});
