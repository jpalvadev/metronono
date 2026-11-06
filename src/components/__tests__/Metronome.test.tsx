import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
      const listeners: Array<(event: any) => void> = [];

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
        start: vi.fn(async () => {
          isPlaying = true;
        }),
        stop: vi.fn(() => {
          isPlaying = false;
        }),
        onBeat: vi.fn((cb) => {
          listeners.push(cb);
          return () => {
            const idx = listeners.indexOf(cb);
            if (idx >= 0) listeners.splice(idx, 1);
          };
        }),
      };
    }),
  };
});

describe('Metronome Component', () => {
  let mockScheduler: any;

  beforeEach(() => {
    mockScheduler = new ToneTransportScheduler();
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

  it('adjusts master volume via volume slider', () => {
    render(<Metronome scheduler={mockScheduler} />);

    const volumeSlider = screen.getByLabelText(/volume/i);
    fireEvent.change(volumeSlider, { target: { value: '50' } });

    expect(mockScheduler.setVolume).toHaveBeenCalledWith(0.5);
  });
});
