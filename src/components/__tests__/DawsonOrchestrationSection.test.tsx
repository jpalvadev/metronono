import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DawsonOrchestrationSection } from '../DawsonOrchestrationSection';
import { ToneTransportScheduler } from '../../audio/ToneTransportScheduler';
import { AudioMixer } from '../../audio/AudioMixer';
import { DawsonEngine } from '../../domain/dawson/DawsonEngine';
import { DrumKitPlayer } from '../../audio/DrumKitPlayer';

describe('DawsonOrchestrationSection', () => {
  let scheduler: ToneTransportScheduler;
  let mixer: AudioMixer;
  let engine: DawsonEngine;
  let player: DrumKitPlayer;
  let drumHitCallback: ((event: any) => void) | null = null;
  let mockTriggerVoice: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mixer = new AudioMixer();
    engine = new DawsonEngine({ mode: 'classic_bop', ostinato: 'jazz_swing' });
    mockTriggerVoice = vi.fn();
    player = new DrumKitPlayer({
      synthTrigger: mockTriggerVoice,
    });

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

  it('renders system selector, mixer channels, and drum pads', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    expect(screen.getByText(/Alan Dawson Orchestration/i)).toBeInTheDocument();
    expect(screen.getByText(/Classic Bop/i)).toBeInTheDocument();
    expect(screen.getByText(/Inverted Bop/i)).toBeInTheDocument();
    expect(screen.getByText(/Straight Rock/i)).toBeInTheDocument();

    // 3 Mixer channels
    expect(screen.getByText(/Metronome Click/i)).toBeInTheDocument();
    expect(screen.getByText(/3-Channel Audio Mixer/i)).toBeInTheDocument();
    expect(screen.getByText(/Orchestrated Line/i)).toBeInTheDocument();

    // 4 Drum pads
    expect(screen.getByTestId('drum-pad-kick')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-snare')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-ride')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-hihat')).toBeInTheDocument();
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

  it('controls channel volume and mute toggles via mixer panel', () => {
    render(<DawsonOrchestrationSection scheduler={scheduler} />);

    const clickSlider = screen.getByLabelText(/Click Volume/i);
    fireEvent.change(clickSlider, { target: { value: '0.4' } });
    expect(mixer.getChannelVolume('click')).toBe(0.4);

    const ostinatoMuteBtn = screen.getByRole('button', { name: /Mute Ostinato/i });
    fireEvent.click(ostinatoMuteBtn);
    expect(mixer.isChannelMuted('ostinato')).toBe(true);

    // Unmute
    const ostinatoUnmuteBtn = screen.getByRole('button', { name: /Unmute Ostinato/i });
    fireEvent.click(ostinatoUnmuteBtn);
    expect(mixer.isChannelMuted('ostinato')).toBe(false);
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
});
