import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Metronome } from '../Metronome';
import { ToneTransportScheduler } from '../../audio/ToneTransportScheduler';

// Mock ToneTransportScheduler
vi.mock('../../audio/ToneTransportScheduler', () => {
  return {
    ToneTransportScheduler: vi.fn().mockImplementation(() => {
      let isPlaying = false;
      let tempo = 120;
      let timeSig = { beats: 4, beatUnit: 4 };
      let volume = 0.8;
      let beatMask = [true, true, true, true];
      let tempoRamp = { enabled: false, startBpm: 120, targetBpm: 160, durationBars: 4 };
      let dropout = { enabled: false, probability: 0.25 };
      let clickConfig = {
        downbeat: { volume: 1.0, muted: false },
        regular: { volume: 0.7, muted: false },
        subdivision: { volume: 0.5, muted: false, divisions: 1 },
      };
      const beatListeners: Array<(event: any) => void> = [];
      const dropoutListeners: Array<(isDropout: boolean) => void> = [];

      return {
        isPlaying: vi.fn(() => isPlaying),
        getTempo: vi.fn(() => tempo),
        setTempo: vi.fn((t: number) => {
          tempo = t;
        }),
        getTimeSignature: vi.fn(() => timeSig),
        setTimeSignature: vi.fn((ts: any) => {
          if (typeof ts === 'string') {
            const [b, u] = ts.split('/').map(Number);
            timeSig = { beats: b, beatUnit: u };
          } else {
            timeSig = ts;
          }
          beatMask = Array(timeSig.beats).fill(true);
        }),
        getVolume: vi.fn(() => volume),
        setVolume: vi.fn((v: number) => {
          volume = v;
        }),
        tap: vi.fn(() => {
          tempo = 140;
          return 140;
        }),
        resetTap: vi.fn(),
        getBeatMask: vi.fn(() => [...beatMask]),
        setBeatMask: vi.fn((mask: boolean[]) => {
          beatMask = [...mask];
        }),
        toggleBeat: vi.fn((idx: number) => {
          beatMask[idx] = !beatMask[idx];
        }),
        isBeatActive: vi.fn((idx: number) => beatMask[idx] ?? true),
        getTempoRampConfig: vi.fn(() => ({ ...tempoRamp })),
        setTempoRampConfig: vi.fn((config: any) => {
          tempoRamp = { ...tempoRamp, ...config };
        }),
        getRampProgress: vi.fn(() => ({ progress: 0, currentBpm: tempo, isComplete: false })),
        getDropoutConfig: vi.fn(() => ({ ...dropout })),
        setDropoutConfig: vi.fn((config: any) => {
          dropout = { ...dropout, ...config };
        }),
        getClickConfig: vi.fn(() => ({ ...clickConfig })),
        setClickConfig: vi.fn((config: any) => {
          clickConfig = { ...clickConfig, ...config };
        }),
        updateVoiceConfig: vi.fn((type: string, config: any) => {
          (clickConfig as any)[type] = { ...(clickConfig as any)[type], ...config };
        }),
        start: vi.fn(async () => {
          isPlaying = true;
        }),
        stop: vi.fn(() => {
          isPlaying = false;
        }),
        onBeat: vi.fn((cb) => {
          beatListeners.push(cb);
          return () => {
            const idx = beatListeners.indexOf(cb);
            if (idx >= 0) beatListeners.splice(idx, 1);
          };
        }),
        onDropoutChange: vi.fn((cb) => {
          dropoutListeners.push(cb);
          return () => {
            const idx = dropoutListeners.indexOf(cb);
            if (idx >= 0) dropoutListeners.splice(idx, 1);
          };
        }),
        // Helper test dispatchers
        __triggerBeat: (event: any) => {
          beatListeners.forEach((l) => l(event));
        },
        __triggerDropout: (isDropout: boolean) => {
          dropoutListeners.forEach((l) => l(isDropout));
        },
      };
    }),
  };
});

describe('Metronome Component', () => {
  let mockScheduler: any;

  beforeEach(() => {
    mockScheduler = new ToneTransportScheduler();
  });

  it('renders dropout states through the Warning token role', () => {
    render(<Metronome scheduler={mockScheduler} />);

    const warnings = document.body.querySelectorAll('[class*="text-warning"]');
    expect(warnings.length).toBeGreaterThanOrEqual(1);

    for (const el of document.body.querySelectorAll('*')) {
      expect(
        /(?:teal|rose|emerald|amber|purple|slate)-\d|bg-(?:white|black)|text-white|dark:|rgba\(|rounded(?!-none)/.test(
          el.getAttribute('class') ?? ''
        )
      ).toBe(false);
    }
  });

  it('renders tempo display, time signature options, and controls', () => {
    render(<Metronome scheduler={mockScheduler} />);

    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tap/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4/4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3/4' })).toBeInTheDocument();
  });

  it('toggles playback when Play/Stop button is clicked', async () => {
    render(<Metronome scheduler={mockScheduler} />);

    const playButton = screen.getByRole('button', { name: /play/i });
    fireEvent.click(playButton);

    expect(mockScheduler.start).toHaveBeenCalled();

    // After start, clicking Stop button stops it
    const stopButton = await screen.findByRole('button', { name: /stop/i });
    fireEvent.click(stopButton);
    expect(mockScheduler.stop).toHaveBeenCalled();
  });

  it('adjusts BPM via quick step buttons', () => {
    render(<Metronome scheduler={mockScheduler} />);

    const plusOneBtn = screen.getByRole('button', { name: '+1' });
    fireEvent.click(plusOneBtn);

    expect(mockScheduler.setTempo).toHaveBeenCalledWith(121);
    expect(screen.getByText('121')).toBeInTheDocument();
  });

  it('triggers tap tempo and updates BPM when Tap button is clicked', () => {
    render(<Metronome scheduler={mockScheduler} />);

    const tapButton = screen.getByRole('button', { name: /tap/i });
    fireEvent.click(tapButton);

    expect(mockScheduler.tap).toHaveBeenCalled();
    expect(screen.getByText('140')).toBeInTheDocument();
  });

  it('changes time signature when selecting 3/4', () => {
    render(<Metronome scheduler={mockScheduler} />);

    const threeFourBtn = screen.getByRole('button', { name: '3/4' });
    fireEvent.click(threeFourBtn);

    expect(mockScheduler.setTimeSignature).toHaveBeenCalledWith('3/4');
  });

  it('holds no loudness control of its own: volume belongs to the Mixer Panel', () => {
    render(<Metronome scheduler={mockScheduler} />);

    expect(mockScheduler.getVolume).not.toHaveBeenCalled();
    expect(mockScheduler.setVolume).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/^Volume$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^toggle mute$/i })).not.toBeInTheDocument();
    for (const label of ['Downbeat volume', 'Regular volume', 'Subdivision volume']) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
  });

  describe('Beat Selector Toggles (Beat Mask)', () => {
    it('allows toggling beat clicks on/off individually per beat', () => {
      render(<Metronome scheduler={mockScheduler} />);

      // Find beat 1 button
      const beat1Btn = screen.getByRole('button', { name: /beat 1/i });
      fireEvent.click(beat1Btn);

      expect(mockScheduler.toggleBeat).toHaveBeenCalledWith(0);
    });

    it('provides quick presets for standard feels like 2 & 4 jazz hi-hat', () => {
      render(<Metronome scheduler={mockScheduler} />);

      const jazzBtn = screen.getByRole('button', { name: /2 & 4/i });
      fireEvent.click(jazzBtn);

      expect(mockScheduler.setBeatMask).toHaveBeenCalledWith([false, true, false, true]);
    });
  });

  describe('Tempo Ramp Controls', () => {
    it('toggles Tempo Ramp mode and configures target BPM and duration', () => {
      render(<Metronome scheduler={mockScheduler} />);

      const rampToggle = screen.getByRole('button', { name: /toggle tempo ramp/i });
      fireEvent.click(rampToggle);

      expect(mockScheduler.setTempoRampConfig).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      );

      // Adjust target BPM
      const targetBpmInput = screen.getByLabelText(/target bpm/i);
      fireEvent.change(targetBpmInput, { target: { value: '160' } });
      fireEvent.blur(targetBpmInput);

      expect(mockScheduler.setTempoRampConfig).toHaveBeenCalledWith(
        expect.objectContaining({ targetBpm: 160 })
      );
    });
  });

  describe('Dropout Mode & Visual Indicators', () => {
    it('toggles Dropout Mode and adjusts dropout percentage slider', () => {
      render(<Metronome scheduler={mockScheduler} />);

      const dropoutToggle = screen.getByRole('button', { name: /toggle dropout mode/i });
      fireEvent.click(dropoutToggle);

      expect(mockScheduler.setDropoutConfig).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      );

      const dropoutSlider = screen.getByLabelText(/dropout percentage/i);
      fireEvent.change(dropoutSlider, { target: { value: '50' } });

      expect(mockScheduler.setDropoutConfig).toHaveBeenCalledWith(
        expect.objectContaining({ probability: 0.5 })
      );
    });

    it('displays eye-catching visual badge when measure is dropped out without freezing playhead', () => {
      render(<Metronome scheduler={mockScheduler} />);

      // Initially no dropout badge
      expect(screen.queryByText(/SILENT BAR/i)).not.toBeInTheDocument();

      // Trigger beat in dropout mode
      act(() => {
        mockScheduler.__triggerBeat({
          beatIndex: 1,
          isDownbeat: false,
          beatsPerMeasure: 4,
          measureIndex: 2,
          isMuted: true,
          isDropout: true,
          bpm: 120,
        });
      });

      // Visual badge is displayed!
      expect(screen.getByText(/SILENT BAR/i)).toBeInTheDocument();
      // Beat 2 (beatIndex 1) is active in playhead
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Click Sounds & Pitches Removal', () => {
    it('does not render Click Sounds & Pitches, pitch inputs, per-voice volumes, or Gap Clicks buttons', () => {
      render(<Metronome scheduler={mockScheduler} />);

      expect(screen.queryByText(/Click Sounds & Pitches/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /click sounds/i })).toBeNull();
      expect(screen.queryByLabelText(/downbeat pitch/i)).toBeNull();
      expect(screen.queryByLabelText(/regular pitch/i)).toBeNull();
      expect(screen.queryByLabelText(/subdivision pitch/i)).toBeNull();
      expect(screen.queryByLabelText(/downbeat volume/i)).toBeNull();
      expect(screen.queryByLabelText(/regular volume/i)).toBeNull();
      expect(screen.queryByLabelText(/subdivision volume/i)).toBeNull();
      expect(screen.queryByText(/Gap clicks:/i)).toBeNull();
    });
  });
});
