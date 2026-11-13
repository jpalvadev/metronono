import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Metronome } from '../Metronome';
import { ToneTransportScheduler } from '../../audio/ToneTransportScheduler';
import type {
  DropoutConfig,
  MetronomeClickConfig,
  TempoRampConfig,
} from '../../domain/metronome/MetronomeEngine';

// Mock ToneTransportScheduler
vi.mock('../../audio/ToneTransportScheduler', () => {
  return {
    ToneTransportScheduler: vi.fn().mockImplementation(() => {
      let isPlaying = false;
      let tempo = 120;
      let timeSig = { beats: 4, beatUnit: 4 };
      let pulseFeel: 'straight' | 'triplet' = 'straight';
      let volume = 0.8;
      let beatMask = [true, true, true, true];
      const resizeMask = () => {
        const pulseQuarters = pulseFeel === 'triplet' ? 1.5 : 1.0;
        const pulses = Math.max(1, Math.ceil((timeSig.beats * (4 / timeSig.beatUnit) - 1e-9) / pulseQuarters));
        beatMask = Array.from({ length: pulses }, (_, i) => beatMask[i] ?? true);
      };
      let tempoRamp: TempoRampConfig = { enabled: false, startBpm: 120, targetBpm: 160, durationBars: 4, oscillate: false };
      let preRampTempo: number | null = null;
      let dropout: DropoutConfig = { enabled: false, probability: 0.25, clickBars: 0, silentBars: 0 };
      let clickConfig: MetronomeClickConfig = {
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
          resizeMask();
        }),
        getPulseFeel: vi.fn(() => pulseFeel),
        setPulseFeel: vi.fn((feel: 'straight' | 'triplet') => {
          pulseFeel = feel;
          resizeMask();
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
        setTempoRampConfig: vi.fn((config: Partial<TempoRampConfig>) => {
          const wasEnabled = tempoRamp.enabled;
          tempoRamp = { ...tempoRamp, ...config };
          if (!wasEnabled && tempoRamp.enabled) {
            preRampTempo = tempo;
          } else if (wasEnabled && !tempoRamp.enabled && preRampTempo !== null) {
            tempo = preRampTempo;
            preRampTempo = null;
          }
        }),
        getRampProgress: vi.fn(() => ({ progress: 0, currentBpm: tempo, isComplete: false, direction: 'forward' as const })),
        getDropoutConfig: vi.fn(() => ({ ...dropout })),
        setDropoutConfig: vi.fn((config: Partial<DropoutConfig>) => {
          dropout = { ...dropout, ...config };
        }),
        getClickConfig: vi.fn(() => ({ ...clickConfig })),
        setClickConfig: vi.fn((config: Partial<MetronomeClickConfig>) => {
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
    expect(screen.getByLabelText(/time signature numerator/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/time signature denominator/i)).toBeInTheDocument();
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

  it('changes time signature via numerator and denominator selectors (e.g. 7/8, 15/16, 21/16)', () => {
    render(<Metronome scheduler={mockScheduler} />);

    const numeratorInput = screen.getByLabelText(/time signature numerator/i) as HTMLInputElement;
    const denominatorSelect = screen.getByLabelText(/time signature denominator/i) as HTMLSelectElement;

    expect(numeratorInput.value).toBe('4');
    expect(denominatorSelect.value).toBe('4');

    fireEvent.change(numeratorInput, { target: { value: '7' } });
    expect(mockScheduler.setTimeSignature).toHaveBeenCalledWith({ beats: 7, beatUnit: 4 });
    expect(screen.getAllByRole('button', { name: /beat \d+:/i })).toHaveLength(7);

    fireEvent.change(denominatorSelect, { target: { value: '8' } });
    expect(mockScheduler.setTimeSignature).toHaveBeenCalledWith({ beats: 7, beatUnit: 8 });
    // 7/8 Straight -> 4 quarter-note pulse buttons
    expect(screen.getAllByRole('button', { name: /beat \d+:/i })).toHaveLength(4);

    // 15/16 Straight -> 4 quarter-note pulse buttons
    fireEvent.change(numeratorInput, { target: { value: '15' } });
    fireEvent.change(denominatorSelect, { target: { value: '16' } });
    expect(screen.getAllByRole('button', { name: /beat \d+:/i })).toHaveLength(4);

    // 21/16 Straight -> 6 quarter-note pulse buttons
    fireEvent.change(numeratorInput, { target: { value: '21' } });
    fireEvent.change(denominatorSelect, { target: { value: '16' } });
    expect(mockScheduler.setTimeSignature).toHaveBeenLastCalledWith({ beats: 21, beatUnit: 16 });
    expect(screen.getAllByRole('button', { name: /beat \d+:/i })).toHaveLength(6);

    // 6/8 Straight -> 3 quarter-note pulse buttons
    fireEvent.change(numeratorInput, { target: { value: '6' } });
    fireEvent.change(denominatorSelect, { target: { value: '8' } });
    expect(screen.getAllByRole('button', { name: /beat \d+:/i })).toHaveLength(3);

    // Large pulse count (e.g. 12/4 -> 12 buttons) uses flex-wrap
    fireEvent.change(numeratorInput, { target: { value: '12' } });
    fireEvent.change(denominatorSelect, { target: { value: '4' } });
    const beatButtons = screen.getAllByRole('button', { name: /beat \d+:/i });
    expect(beatButtons).toHaveLength(12);
    expect(beatButtons[0].parentElement?.className).toContain('flex-wrap');
  });

  it('displays Pulse Feel selector (Straight 2x8th / Triplet 3x8th) and updates beat buttons dynamically', () => {
    render(<Metronome scheduler={mockScheduler} />);

    const numeratorInput = screen.getByLabelText(/time signature numerator/i);
    const denominatorSelect = screen.getByLabelText(/time signature denominator/i);
    const pulseFeelSelect = screen.getByLabelText(/pulse feel/i) as HTMLSelectElement;

    expect(pulseFeelSelect.value).toBe('straight');

    // 6/8 Straight -> 3 buttons; 6/8 Triplet -> 2 buttons
    fireEvent.change(numeratorInput, { target: { value: '6' } });
    fireEvent.change(denominatorSelect, { target: { value: '8' } });
    expect(screen.getAllByRole('button', { name: /beat \d+:/i })).toHaveLength(3);

    fireEvent.change(pulseFeelSelect, { target: { value: 'triplet' } });
    expect(mockScheduler.setPulseFeel).toHaveBeenCalledWith('triplet');
    expect(screen.getAllByRole('button', { name: /beat \d+:/i })).toHaveLength(2);

    // 12/8 Triplet -> 4 buttons
    fireEvent.change(numeratorInput, { target: { value: '12' } });
    expect(screen.getAllByRole('button', { name: /beat \d+:/i })).toHaveLength(4);

    // 15/16 Triplet -> 3 buttons
    fireEvent.change(numeratorInput, { target: { value: '15' } });
    fireEvent.change(denominatorSelect, { target: { value: '16' } });
    expect(screen.getAllByRole('button', { name: /beat \d+:/i })).toHaveLength(3);
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

    it('does not render quick beat preset buttons (All, 2 & 4 (Jazz), 1 & 3, 1 Only)', () => {
      render(<Metronome scheduler={mockScheduler} />);

      expect(screen.queryByRole('button', { name: /^all$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /2 & 4/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /1 & 3/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /1 only/i })).not.toBeInTheDocument();
    });

    it('allows toggling individual pulse buttons in arbitrary time signatures like 21/16', () => {
      render(<Metronome scheduler={mockScheduler} />);

      const numeratorInput = screen.getByLabelText(/time signature numerator/i);
      const denominatorSelect = screen.getByLabelText(/time signature denominator/i);
      fireEvent.change(numeratorInput, { target: { value: '21' } });
      fireEvent.change(denominatorSelect, { target: { value: '16' } });

      const beat6Btn = screen.getByRole('button', { name: /beat 6:/i });
      fireEvent.click(beat6Btn);

      expect(mockScheduler.toggleBeat).toHaveBeenCalledWith(5);
    });
  });

  describe('Tempo Ramp Controls', () => {
    it('toggles Tempo Ramp mode and configures start BPM, target BPM, and duration without overwriting startBpm', () => {
      mockScheduler.setTempo(95);
      render(<Metronome scheduler={mockScheduler} />);

      const rampToggle = screen.getByRole('button', { name: /toggle tempo ramp/i });
      fireEvent.click(rampToggle);

      // Should not overwrite startBpm (120) with current Metronome tempo (95)
      expect(mockScheduler.setTempoRampConfig).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true, startBpm: 120 })
      );

      // Adjust start BPM
      const startBpmInput = screen.getByLabelText(/start bpm/i);
      fireEvent.change(startBpmInput, { target: { value: '85' } });
      expect(mockScheduler.setTempoRampConfig).toHaveBeenCalledWith(
        expect.objectContaining({ startBpm: 85 })
      );

      // Adjust target BPM
      const targetBpmInput = screen.getByLabelText(/target bpm/i);
      fireEvent.change(targetBpmInput, { target: { value: '160' } });

      expect(mockScheduler.setTempoRampConfig).toHaveBeenCalledWith(
        expect.objectContaining({ targetBpm: 160 })
      );
    });

    it('locks all manual BPM controls while Tempo Ramp is ON, shows instantaneous BPM, and restores pre-ramp BPM when OFF', () => {
      mockScheduler.setTempo(108);
      render(<Metronome scheduler={mockScheduler} />);

      const rampToggle = screen.getByRole('button', { name: /toggle tempo ramp/i });
      fireEvent.click(rampToggle);

      expect(screen.getByRole('button', { name: '-5' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '-1' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '+1' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '+5' })).toBeDisabled();
      expect(screen.getByLabelText('BPM')).toBeDisabled();
      expect(screen.getByLabelText('Direct BPM input')).toBeDisabled();
      expect(screen.getByRole('button', { name: /tap tempo/i })).toBeDisabled();

      // Simulate playback beat at instantaneous ramp BPM 142
      act(() => {
        (mockScheduler as any).__triggerBeat({
          beatIndex: 0,
          measureIndex: 1,
          isDownbeat: true,
          isMuted: false,
          isDropout: false,
          bpm: 142,
        });
      });

      expect(screen.getByText('142')).toBeInTheDocument();

      // Disable Tempo Ramp -> restores pre-ramp BPM 108 and re-enables controls
      fireEvent.click(rampToggle);
      expect(screen.getByText('108')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '-5' })).not.toBeDisabled();
      expect(screen.getByLabelText('BPM')).not.toBeDisabled();
      expect(screen.getByLabelText('Direct BPM input')).not.toBeDisabled();
      expect(screen.getByRole('button', { name: /tap tempo/i })).not.toBeDisabled();
    });

    it('renders unchecked Oscillate checkbox, toggles oscillate mode, and displays direction arrow and percentage', () => {
      render(<Metronome scheduler={mockScheduler} />);

      const rampToggle = screen.getByRole('button', { name: /toggle tempo ramp/i });
      fireEvent.click(rampToggle);

      const oscillateCheckbox = screen.getByRole('checkbox', { name: /oscillate/i }) as HTMLInputElement;
      expect(oscillateCheckbox).not.toBeChecked();
      expect(screen.getByText(/120 → 160 BPM/)).toBeInTheDocument();

      (mockScheduler.getRampProgress as ReturnType<typeof vi.fn>).mockReturnValue({
        progress: 0.75,
        currentBpm: 150,
        isComplete: false,
        direction: 'return',
      });

      fireEvent.click(oscillateCheckbox);
      expect(mockScheduler.setTempoRampConfig).toHaveBeenCalledWith(
        expect.objectContaining({ oscillate: true })
      );
      expect(oscillateCheckbox).toBeChecked();
      expect(screen.getByText(/120 ↔ 160 BPM/)).toBeInTheDocument();
      expect(screen.getByText(/← 75%/)).toBeInTheDocument();
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

    it('renders Click Bars and Silent Bars selectors above Silence Probability and updates config with clamping', () => {
      render(<Metronome scheduler={mockScheduler} />);

      fireEvent.click(screen.getByRole('button', { name: /toggle dropout mode/i }));

      const clickBarsInput = screen.getByLabelText(/^click bars$/i) as HTMLInputElement;
      const silentBarsInput = screen.getByLabelText(/^silent bars$/i) as HTMLInputElement;
      const dropoutSlider = screen.getByLabelText(/dropout percentage/i);

      // Click Bars & Silent Bars appear before the Silence Probability slider in DOM order
      expect(
        clickBarsInput.compareDocumentPosition(dropoutSlider) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        silentBarsInput.compareDocumentPosition(dropoutSlider) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();

      expect(clickBarsInput.value).toBe('0');
      expect(silentBarsInput.value).toBe('0');

      // Increment Click Bars via + button
      fireEvent.click(screen.getByRole('button', { name: /increase click bars/i }));
      expect(mockScheduler.setDropoutConfig).toHaveBeenCalledWith(
        expect.objectContaining({ clickBars: 1 })
      );
      expect(clickBarsInput.value).toBe('1');

      // Decrement Click Bars via - button
      fireEvent.click(screen.getByRole('button', { name: /decrease click bars/i }));
      expect(mockScheduler.setDropoutConfig).toHaveBeenCalledWith(
        expect.objectContaining({ clickBars: 0 })
      );

      // Type out-of-range value into Silent Bars -> clamped to 32
      fireEvent.change(silentBarsInput, { target: { value: '50' } });
      expect(mockScheduler.setDropoutConfig).toHaveBeenCalledWith(
        expect.objectContaining({ silentBars: 32 })
      );
      expect(silentBarsInput.value).toBe('32');
    });

    it('disables Silence Probability slider and shows override note when bar cycle is active, and re-enables at 0/0', () => {
      render(<Metronome scheduler={mockScheduler} />);

      fireEvent.click(screen.getByRole('button', { name: /toggle dropout mode/i }));

      const dropoutSlider = screen.getByLabelText(/dropout percentage/i) as HTMLInputElement;
      expect(dropoutSlider).not.toBeDisabled();

      // Activate Click Bars -> slider becomes disabled and override note appears
      fireEvent.click(screen.getByRole('button', { name: /increase click bars/i }));
      expect(dropoutSlider).toBeDisabled();
      expect(screen.getByText(/bar cycle active/i)).toBeInTheDocument();

      // Attempting to change the disabled slider does not update probability
      vi.mocked(mockScheduler.setDropoutConfig).mockClear();
      fireEvent.change(dropoutSlider, { target: { value: '80' } });
      expect(mockScheduler.setDropoutConfig).not.toHaveBeenCalled();

      // Return Click Bars to 0 -> slider is re-enabled and note disappears
      fireEvent.click(screen.getByRole('button', { name: /decrease click bars/i }));
      expect(dropoutSlider).not.toBeDisabled();
      expect(screen.queryByText(/bar cycle active/i)).not.toBeInTheDocument();

      // Activate Silent Bars -> slider disabled again
      fireEvent.click(screen.getByRole('button', { name: /increase silent bars/i }));
      expect(dropoutSlider).toBeDisabled();
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
      expect(screen.getByRole('button', { name: /beat 2:/i })).toBeInTheDocument();
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
