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
  let drumHitCallback: ((event: any) => void) | null = null;
  let mockTriggerVoice: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mixer = new AudioMixer();
    engine = new DawsonEngine({ mode: 'classic_bop', ostinato: 'jazz_swing' });
    mockTriggerVoice = vi.fn();
    player = {
      initSynths: vi.fn(() => true),
      play: vi.fn(),
      triggerVoice: mockTriggerVoice,
      onDrumHit: vi.fn(() => () => undefined),
      loadSampleBuffer: vi.fn(),
      removeSampleBuffer: vi.fn(),
      hasCustomSample: vi.fn(() => false),
      clearAllCustomSamples: vi.fn(),
    };

    scheduler = {
      getAudioMixer: () => mixer,
      getDawsonEngine: () => engine,
      getDrumKitPlayer: () => player,
      onDrumHit: vi.fn().mockImplementation((cb) => {
        drumHitCallback = cb;
        return () => {
          drumHitCallback = null;
        };
      }),
    } as unknown as ToneTransportScheduler;
  });

  it('renders system selector and drum pads, without any loudness control', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    expect(screen.getByText(/Alan Dawson Orchestration/i)).toBeInTheDocument();
    expect(screen.getByText(/Classic Bop/i)).toBeInTheDocument();
    expect(screen.getByText(/Inverted Bop/i)).toBeInTheDocument();
    expect(screen.getByText(/Straight Rock/i)).toBeInTheDocument();

    // 4 Drum pads
    expect(screen.getByTestId('drum-pad-kick')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-snare')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-ride')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-hihat')).toBeInTheDocument();

    // The embedded mixer card is gone: loudness belongs to the Mixer Panel (ticket 05).
    expect(screen.queryByText(/3-Channel Audio Mixer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Metronome Click/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Orchestrated Line/i)).not.toBeInTheDocument();
    for (const label of ['Master Volume', 'Click Volume', 'Ostinato Volume', 'Orchestrated Line Volume']) {
      expect(screen.queryByLabelText(new RegExp(label, 'i'))).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /^(Mute|Unmute) (Click|Ostinato|Orchestrated Line)$/i })).not.toBeInTheDocument();
  });

  it('offers "No Ostinato" in the ostinato selector, and it still means no Ostinato layer', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    const noOstinatoBtn = screen.getByRole('button', { name: 'No Ostinato' });
    expect(noOstinatoBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Silenced' })).not.toBeInTheDocument();

    fireEvent.click(noOstinatoBtn);
    expect(engine.getOstinato()).toBe('none');
    // Muting the Ostinato Mixing Channel is a different thing entirely.
    expect(mixer.isChannelMuted('ostinato')).toBe(false);
  });

  it('switches between Dawson orchestration modes', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    const invertedBtn = screen.getByRole('button', { name: /Inverted Bop/i });
    fireEvent.click(invertedBtn);
    expect(engine.getMode()).toBe('inverted_bop');

    const rockBtn = screen.getByRole('button', { name: /Straight Rock/i });
    fireEvent.click(rockBtn);
    expect(engine.getMode()).toBe('straight_rock');
    expect(engine.getOstinato()).toBe('straight_rock');

    const classicBtn = screen.getByRole('button', { name: /Classic Bop/i });
    fireEvent.click(classicBtn);
    expect(engine.getMode()).toBe('classic_bop');
  });

  it('triggers voice audition when clicking drum pads', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    const kickPad = screen.getByTestId('drum-pad-kick');
    fireEvent.click(kickPad);
    expect(mockTriggerVoice).toHaveBeenCalledWith('kick', expect.any(Number), expect.any(Number), 'orchestration');

    const ridePad = screen.getByTestId('drum-pad-ride');
    fireEvent.click(ridePad);
    expect(mockTriggerVoice).toHaveBeenCalledWith('ride', expect.any(Number), expect.any(Number), 'ostinato');
  });

  it('flashes the visual drum pads in real-time when drum hits arrive', () => {
    vi.useFakeTimers();
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    expect(drumHitCallback).not.toBeNull();

    // Send Snare hit event
    act(() => {
      drumHitCallback!({
        voice: 'snare',
        timeInMeasure: 1.0,
        velocity: 0.85,
        dynamic: 'normal',
        source: 'orchestration',
      });
    });

    const snarePad = screen.getByTestId('drum-pad-snare');
    expect(snarePad).toHaveAttribute('data-active', 'true');

    // Advance timer past flash duration (120ms)
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(snarePad).toHaveAttribute('data-active', 'false');

    vi.useRealTimers();
  });

  it('selects Tony Williams and Linear Fusion systems', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    const tonyBtn = screen.getByTestId('system-btn-tony_williams_flr');
    fireEvent.click(tonyBtn);

    expect(engine.getShortFormula().id).toBe('flr_triplet');
    expect(engine.getOstinato()).toBe('jazz_swing');

    const linearBtn = screen.getByTestId('system-btn-linear_diddle_fusion');
    fireEvent.click(linearBtn);

    expect(engine.getLongFormula().id).toBe('linear_diddle');
    expect(engine.getOstinato()).toBe('straight_rock');
  });

  it('opens and closes PresetManager modal', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    const manageBtn = screen.getByRole('button', { name: /Manage Systems & Formulas/i });
    fireEvent.click(manageBtn);

    expect(screen.getByText(/Dawson Systems & Formula Manager/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText(/Dawson Systems & Formula Manager/i)).not.toBeInTheDocument();
  });

  it('opens FormulaEditorDialog from customize button and auditions formula', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    // Short formula audition
    const auditionBtns = screen.getAllByRole('button', { name: /Audition/i });
    fireEvent.click(auditionBtns[0]);
    expect(mockTriggerVoice).toHaveBeenCalled();

    // Customize short formula
    const customizeBtns = screen.getAllByRole('button', { name: /Customize/i });
    fireEvent.click(customizeBtns[0]);

    expect(screen.getByText(/Subdivision Formula Editor/i)).toBeInTheDocument();
  });
});
