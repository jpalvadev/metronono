import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ReadingView } from '../ReadingView';
import { ReadingLine, createRhythmicEvent } from '../../../domain/rhythm/types';
import { BeatEvent } from '../../../domain/metronome/MetronomeEngine';

function createDummyLine(measureCount = 4): ReadingLine {
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

describe('ReadingView', () => {
  beforeEach(() => {
    // Mock ResizeObserver
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  });

  it('borrows the Status Colors for difficulty tier chips', () => {
    const line = createDummyLine(2); // tier 1
    render(<ReadingView readingLine={line} />);

    const tierBadge = screen.getByText(/^Tier 1$/);
    expect(tierBadge).toHaveClass('border-success/40');
    expect(tierBadge).toHaveClass('text-success');
    expect(tierBadge).toHaveClass('bg-success/20');

    for (const el of document.body.querySelectorAll('*')) {
      expect(
        /(?:teal|rose|emerald|amber|purple|slate)-\d|bg-(?:white|black)|text-white|dark:|rgba\(|rounded(?!-none)/.test(
          el.getAttribute('class') ?? ''
        )
      ).toBe(false);
    }
  });

  it('renders score container and SVG notation for the reading line', () => {
    const line = createDummyLine(2);
    render(<ReadingView readingLine={line} />);

    expect(screen.getByText('Dummy Line Title')).toBeInTheDocument();
    expect(screen.getByTestId('reading-score-container')).toBeInTheDocument();
    expect(document.querySelector('svg')).toBeTruthy();
  });

  it('renders playhead overlay when playback is active', () => {
    const line = createDummyLine(2);
    render(
      <ReadingView
        readingLine={line}
        isPlaying={true}
        currentMeasureIndex={0}
        currentBeatIndex={1}
      />
    );

    const cursor = screen.getByTestId('playhead-cursor');
    expect(cursor).toBeInTheDocument();
  });

  it('synchronizes with scheduler onBeat events', () => {
    const line = createDummyLine(4);
    let beatCallback: ((event: BeatEvent) => void) | null = null;

    const mockScheduler = {
      isPlaying: () => true,
      getTempo: () => 120,
      onBeat: vi.fn((cb) => {
        beatCallback = cb;
        return () => {
          beatCallback = null;
        };
      }),
    };

    render(
      <ReadingView
        readingLine={line}
        scheduler={mockScheduler as any}
        isPlaying={true}
      />
    );

    expect(mockScheduler.onBeat).toHaveBeenCalled();

    // Trigger beat 0 in measure 0
    act(() => {
      beatCallback?.({
        beatIndex: 0,
        isDownbeat: true,
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

  it('provides system paging or navigation for multi-system scores', () => {
    // 8 measures with 2 per system = 4 systems
    const line = createDummyLine(8);
    render(
      <ReadingView
        readingLine={line}
        measuresPerSystem={2}
      />
    );

    expect(screen.getByTestId('reading-view-root')).toBeInTheDocument();
  });

  it('suppresses Playhead and shows "4/4 only" indicator when time signature is not 4/4, restoring on return to 4/4', () => {
    const line = createDummyLine(4);
    let timeSigCallback: ((ts: { beats: number; beatUnit: number }) => void) | null = null;
    let currentTs = { beats: 4, beatUnit: 4 };

    const mockScheduler = {
      isPlaying: () => true,
      getTempo: () => 120,
      getTimeSignature: () => currentTs,
      onBeat: vi.fn(() => () => {}),
      onTimeSignatureChange: vi.fn((cb) => {
        timeSigCallback = cb;
        return () => {
          timeSigCallback = null;
        };
      }),
    };

    render(
      <ReadingView
        readingLine={line}
        scheduler={mockScheduler as any}
        isPlaying={true}
      />
    );

    expect(screen.getByTestId('playhead-cursor')).toBeInTheDocument();
    expect(screen.queryByText(/4\/4 only/i)).not.toBeInTheDocument();

    act(() => {
      currentTs = { beats: 7, beatUnit: 8 };
      timeSigCallback?.(currentTs);
    });

    expect(screen.getByText(/4\/4 only/i)).toBeInTheDocument();
    expect(screen.queryByTestId('playhead-cursor')).not.toBeInTheDocument();

    act(() => {
      currentTs = { beats: 4, beatUnit: 4 };
      timeSigCallback?.(currentTs);
    });

    expect(screen.queryByText(/4\/4 only/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('playhead-cursor')).toBeInTheDocument();
  });

  it('has no vertical height cap or internal scrollbars on the score wrapper', () => {
    const line = createDummyLine(16);
    render(<ReadingView readingLine={line} />);

    const root = screen.getByTestId('reading-view-root');
    for (const el of root.querySelectorAll('*')) {
      const cls = el.getAttribute('class') ?? '';
      expect(cls).not.toMatch(/\bmax-h-\[/);
      expect(cls).not.toMatch(/\boverflow-x-auto\b/);
      expect(cls).not.toMatch(/\boverflow-y-auto\b/);
    }
  });

  it('fits narrow mobile container widths (< 300px) without forcing a 300px SVG floor', () => {
    const clientWidthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(260);
    try {
      const line = createDummyLine(4);
      render(<ReadingView readingLine={line} />);

      const svg = screen.getByTestId('reading-score-container').querySelector('svg');
      expect(svg).toBeTruthy();
      expect(Number(svg?.getAttribute('width'))).toBeLessThanOrEqual(260);
    } finally {
      clientWidthSpy.mockRestore();
    }
  });

  it('renders Auto | 1 | 2 | 3 | 4 column selector defaulting to Auto', () => {
    const line = createDummyLine(4);
    render(<ReadingView readingLine={line} />);

    const autoBtn = screen.getByRole('button', { name: 'Auto' });
    const btn1 = screen.getByRole('button', { name: '1' });
    const btn2 = screen.getByRole('button', { name: '2' });
    const btn3 = screen.getByRole('button', { name: '3' });
    const btn4 = screen.getByRole('button', { name: '4' });

    expect(autoBtn).toHaveAttribute('aria-pressed', 'true');
    expect(btn1).toHaveAttribute('aria-pressed', 'false');
    expect(btn2).toHaveAttribute('aria-pressed', 'false');
    expect(btn3).toHaveAttribute('aria-pressed', 'false');
    expect(btn4).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(btn3);
    expect(btn3).toHaveAttribute('aria-pressed', 'true');
    expect(autoBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(autoBtn);
    expect(autoBtn).toHaveAttribute('aria-pressed', 'true');
    expect(btn3).toHaveAttribute('aria-pressed', 'false');
  });

  it('clamps manual column selection to the maximum columns supported by the current width', () => {
    const getDistinctSystemRowCount = () => {
      const paths = document.querySelectorAll('g[class="vf-stave"] > path');
      const ys = new Set<string>();
      paths.forEach((p) => {
        const match = (p.getAttribute('d') ?? '').match(/^M\s*-?\d+(?:\.\d+)?\s+(-?\d+(?:\.\d+)?)/);
        if (match) ys.add(match[1]);
      });
      return ys.size;
    };

    const clientWidthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    try {
      const line = createDummyLine(4);
      render(<ReadingView readingLine={line} />);

      // At 400px (< 460px), max columns is 1 -> 4 systems for 4 measures
      expect(getDistinctSystemRowCount()).toBe(4);

      // Selecting 4 columns must clamp to 1 at 400px width
      fireEvent.click(screen.getByRole('button', { name: '4' }));
      expect(getDistinctSystemRowCount()).toBe(4);
    } finally {
      clientWidthSpy.mockRestore();
    }
  });
});
