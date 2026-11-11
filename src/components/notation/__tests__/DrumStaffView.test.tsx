import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DrumStaffView } from '../DrumStaffView';
import { ReadingLine, createRhythmicEvent } from '../../../domain/rhythm/types';
import { DawsonEngine } from '../../../domain/dawson/DawsonEngine';
import { BeatEvent } from '../../../domain/metronome/MetronomeEngine';

function createDummyLine(measureCount = 2): ReadingLine {
  const measures = Array.from({ length: measureCount }, (_, mIdx) => ({
    index: mIdx,
    timeSignature: [4, 4] as [4, 4],
    events: [
      createRhythmicEvent({ id: `m${mIdx}-e0`, durationBeats: 1.0 }),
      createRhythmicEvent({ id: `m${mIdx}-e1`, durationBeats: 1.0 }),
      createRhythmicEvent({ id: `m${mIdx}-e2`, durationBeats: 1.0 }),
      createRhythmicEvent({ id: `m${mIdx}-e3`, durationBeats: 1.0 }),
    ],
    totalBeats: 4.0,
  }));

  return {
    id: 'dummy-line',
    title: 'Dummy Line Title',
    tier: 1,
    measures,
  };
}

describe('DrumStaffView', () => {
  let mockScheduler: any;
  let mockDawsonEngine: DawsonEngine;
  let beatCallback: ((event: BeatEvent) => void) | null = null;

  beforeEach(() => {
    // Mock ResizeObserver
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;

    mockDawsonEngine = new DawsonEngine({ mode: 'classic_bop', ostinato: 'jazz_swing' });

    mockScheduler = {
      isPlaying: vi.fn(() => false),
      getTempo: vi.fn(() => 120),
      getDawsonEngine: vi.fn(() => mockDawsonEngine),
      getDrumKitPlayer: vi.fn(() => ({
        triggerVoice: vi.fn(),
      })),
      onBeat: vi.fn((cb) => {
        beatCallback = cb;
        return () => {
          beatCallback = null;
        };
      }),
      onPlayStateChange: vi.fn(() => () => {}),
    };
  });

  it('renders 5-line drum staff container and SVG notation', () => {
    const line = createDummyLine(2);
    render(
      <DrumStaffView
        readingLine={line}
        dawsonEngine={mockDawsonEngine}
        scheduler={mockScheduler}
      />
    );

    expect(screen.getByTestId('drum-staff-view-root')).toBeInTheDocument();
    expect(screen.getByTestId('drum-score-container')).toBeInTheDocument();
    expect(document.querySelector('svg')).toBeTruthy();
  });

  it('renders View Mode Toggle and switches between Reading View and Drum Staff View', () => {
    const line = createDummyLine(2);
    const onViewModeChange = vi.fn();

    const { rerender } = render(
      <DrumStaffView
        readingLine={line}
        dawsonEngine={mockDawsonEngine}
        scheduler={mockScheduler}
        viewMode="drum_staff"
        onViewModeChange={onViewModeChange}
        showViewToggle={true}
      />
    );

    const toggleReading = screen.getByRole('button', { name: /reading view/i });
    const toggleDrum = screen.getByRole('button', { name: /drum staff/i });

    expect(toggleReading).toBeInTheDocument();
    expect(toggleDrum).toBeInTheDocument();

    // Click Reading View
    fireEvent.click(toggleReading);
    expect(onViewModeChange).toHaveBeenCalledWith('reading');

    // If rerendered with viewMode="reading"
    rerender(
      <DrumStaffView
        readingLine={line}
        dawsonEngine={mockDawsonEngine}
        scheduler={mockScheduler}
        viewMode="reading"
        onViewModeChange={onViewModeChange}
        showViewToggle={true}
      />
    );

    // In Reading View, reading score container is shown
    expect(screen.getByTestId('reading-score-container')).toBeInTheDocument();
  });

  it('allows selecting drum voices and auditions sound on click', () => {
    const line = createDummyLine(1);
    const triggerVoiceSpy = vi.fn();
    mockScheduler.getDrumKitPlayer = vi.fn(() => ({
      triggerVoice: triggerVoiceSpy,
    }));

    render(
      <DrumStaffView
        readingLine={line}
        dawsonEngine={mockDawsonEngine}
        scheduler={mockScheduler}
      />
    );

    // Select Snare voice
    const snareBtn = screen.getByTestId('voice-btn-snare');
    expect(snareBtn).toBeInTheDocument();
    fireEvent.click(snareBtn);

    // Immediate audition triggered
    expect(triggerVoiceSpy).toHaveBeenCalledWith('snare', 0, expect.any(Number));
  });

  it('allows interactive step toggling to add or remove drum hits', () => {
    const line = createDummyLine(1);
    const onMeasureChange = vi.fn();

    render(
      <DrumStaffView
        readingLine={line}
        dawsonEngine={mockDawsonEngine}
        scheduler={mockScheduler}
        onMeasureChange={onMeasureChange}
      />
    );

    // Select Kick voice
    const kickBtn = screen.getByTestId('voice-btn-kick');
    fireEvent.click(kickBtn);

    // Toggle step 4 (Beat 2 downbeat)
    const step4Btn = screen.getByTestId('grid-step-4');
    expect(step4Btn).toBeInTheDocument();
    fireEvent.click(step4Btn);

    // Should update measures and call onMeasureChange
    expect(onMeasureChange).toHaveBeenCalled();
  });

  it('synchronizes playhead overlay when playback is active', () => {
    const line = createDummyLine(2);
    mockScheduler.isPlaying = vi.fn(() => true);

    render(
      <DrumStaffView
        readingLine={line}
        dawsonEngine={mockDawsonEngine}
        scheduler={mockScheduler}
        isPlaying={true}
      />
    );

    expect(mockScheduler.onBeat).toHaveBeenCalled();

    // Trigger beat 1 in measure 0
    act(() => {
      beatCallback?.({
        beatIndex: 1,
        isDownbeat: false,
        beatsPerMeasure: 4,
        measureIndex: 0,
        isMuted: false,
        isDropout: false,
        bpm: 120,
      });
    });

    const cursor = screen.getByTestId('playhead-cursor');
    expect(cursor).toBeInTheDocument();
  });

  it('provides quick preset grooves (e.g. Basic Rock, Jazz Swing, Funk 16ths)', () => {
    const line = createDummyLine(1);
    const onMeasureChange = vi.fn();

    render(
      <DrumStaffView
        readingLine={line}
        dawsonEngine={mockDawsonEngine}
        scheduler={mockScheduler}
        onMeasureChange={onMeasureChange}
      />
    );

    // Click Basic Rock groove preset
    const rockPresetBtn = screen.getByRole('button', { name: /basic rock/i });
    expect(rockPresetBtn).toBeInTheDocument();
    fireEvent.click(rockPresetBtn);

    expect(onMeasureChange).toHaveBeenCalled();
  });
});
