import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import { PartitureFormulaCanvas } from '../PartitureFormulaCanvas';
import { OrchestratedStroke } from '../../../domain/dawson/types';
import { IDrumKitPlayer } from '../../../audio/types';

describe('PartitureFormulaCanvas', () => {
  let mockPlayer: IDrumKitPlayer;
  let mockTriggerVoice: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockTriggerVoice = vi.fn();
    mockPlayer = {
      play: vi.fn(),
      triggerVoice: mockTriggerVoice,
    };
  });

  it('renders SVG stave into container', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 0.5, hits: [{ voice: 'snare', dynamic: 'normal' }] },
    ];
    const onChangeStrokes = vi.fn();

    render(
      <PartitureFormulaCanvas
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        activeTool="note"
        selectedDuration={0.5}
        selectedDynamic="normal"
        player={mockPlayer}
        width={500}
      />
    );

    expect(screen.getByTestId('partiture-formula-canvas')).toBeInTheDocument();
  });

  it('renders the canvas container with one-style token roles', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 0.5, hits: [{ voice: 'snare', dynamic: 'normal' }] },
    ];
    const onChangeStrokes = vi.fn();

    render(
      <PartitureFormulaCanvas
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        activeTool="note"
        selectedDuration={0.5}
        selectedDynamic="normal"
        player={mockPlayer}
        width={500}
        playheadBeat={0.5}
      />
    );

    // Card surface replaces the hardcoded white/slate container
    const canvas = screen.getByTestId('partiture-formula-canvas');
    expect(canvas).toHaveClass('bg-card');
    expect(canvas).toHaveClass('text-foreground');
    expect(canvas).toHaveClass('border-border');
    expect(canvas).toHaveClass('rounded-none');

    // Playhead (when laid out) is the Accent with the one shared glow
    const playhead = screen.queryByTestId('audition-playhead');
    if (playhead) {
      expect(playhead).toHaveClass('bg-primary');
      expect(playhead).toHaveClass('playhead-glow');
    }

    // Zero raw palette classes, scrim literals, or rgba glow literals
    for (const el of document.body.querySelectorAll('*')) {
      expect(
        /(?:teal|rose|emerald|amber|purple|slate)-\d|bg-(?:white|black)|text-white|dark:|rgba\(|rounded(?!-none)/.test(
          el.getAttribute('class') ?? ''
        )
      ).toBe(false);
    }
  });

  it('stamps a note on the clicked drum voice line and plays one-shot audio', () => {
    const strokes: OrchestratedStroke[] = [];
    const onChangeStrokes = vi.fn();

    render(
      <PartitureFormulaCanvas
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        activeTool="note"
        selectedDuration={0.5}
        selectedDynamic="accent"
        player={mockPlayer}
        width={500}
      />
    );

    const canvas = screen.getByTestId('partiture-formula-canvas');

    // Simulate clicking on the canvas at X=100 (beat ~0), Y=60 (snare line ~1.5)
    fireEvent.click(canvas, {
      clientX: 100,
      clientY: 60,
    });

    // Check one-shot audio was triggered with voice and accent velocity (1.0)
    expect(mockTriggerVoice).toHaveBeenCalled();
    expect(onChangeStrokes).toHaveBeenCalledTimes(1);

    const updatedStrokes: OrchestratedStroke[] = onChangeStrokes.mock.calls[0][0];
    expect(updatedStrokes.length).toBeGreaterThan(0);
    expect(updatedStrokes[0].hits.some((h) => h.dynamic === 'accent')).toBe(true);
  });

  it('appends to chord when clicking another voice line at the same offset (unison stacking)', () => {
    // Existing single kick note at beat 0
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 0.5, hits: [{ voice: 'kick', dynamic: 'accent' }] },
    ];
    const onChangeStrokes = vi.fn();

    render(
      <PartitureFormulaCanvas
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        activeTool="note"
        selectedDuration={0.5}
        selectedDynamic="accent"
        player={mockPlayer}
        width={500}
      />
    );

    const canvas = screen.getByTestId('partiture-formula-canvas');

    // Click near beat 0 but on Crash line (Y=20)
    fireEvent.click(canvas, {
      clientX: 80,
      clientY: 20,
    });

    expect(onChangeStrokes).toHaveBeenCalledTimes(1);
    const updatedStrokes: OrchestratedStroke[] = onChangeStrokes.mock.calls[0][0];

    // Stroke at beat 0 should now be a chord with both kick and the newly stamped voice
    expect(updatedStrokes[0].hits.length).toBe(2);
    expect(updatedStrokes[0].hits.some((h) => h.voice === 'kick')).toBe(true);
  });

  it('creates an explicit rest in Rest mode', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 0.5, hits: [{ voice: 'snare', dynamic: 'normal' }] },
    ];
    const onChangeStrokes = vi.fn();

    render(
      <PartitureFormulaCanvas
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        activeTool="rest"
        selectedDuration={0.25}
        selectedDynamic="normal"
        player={mockPlayer}
        width={500}
      />
    );

    const canvas = screen.getByTestId('partiture-formula-canvas');
    fireEvent.click(canvas, {
      clientX: 80,
      clientY: 60,
    });

    expect(onChangeStrokes).toHaveBeenCalledTimes(1);
    const updatedStrokes: OrchestratedStroke[] = onChangeStrokes.mock.calls[0][0];
    expect(updatedStrokes[0].isRest).toBe(true);
    expect(updatedStrokes[0].hits).toHaveLength(0);
    // In rest mode, no audio sample should be played
    expect(mockTriggerVoice).not.toHaveBeenCalled();
  });

  it('removes clicked voice in Eraser mode and converts to rest if chord becomes empty', () => {
    // 2 hits in unison chord (kick + crash)
    const chordStrokes: OrchestratedStroke[] = [
      {
        durationRatio: 0.5,
        hits: [
          { voice: 'kick', dynamic: 'accent' },
          { voice: 'crash', dynamic: 'accent' },
        ],
      },
    ];
    const onChangeStrokes = vi.fn();

    const { rerender } = render(
      <PartitureFormulaCanvas
        strokes={chordStrokes}
        onChangeStrokes={onChangeStrokes}
        activeTool="eraser"
        selectedDuration={0.5}
        selectedDynamic="normal"
        player={mockPlayer}
        width={500}
      />
    );

    const canvas = screen.getByTestId('partiture-formula-canvas');

    // Click near beat 0 on Crash line (Y=20)
    fireEvent.click(canvas, {
      clientX: 80,
      clientY: 20,
    });

    expect(onChangeStrokes).toHaveBeenCalledTimes(1);
    const updatedStrokes: OrchestratedStroke[] = onChangeStrokes.mock.calls[0][0];

    // Crash should be removed, leaving only Kick
    expect(updatedStrokes[0].hits).toHaveLength(1);
    expect(updatedStrokes[0].hits[0].voice).toBe('kick');

    // Now test erasing the last remaining voice -> converts slice into a rest
    onChangeStrokes.mockClear();
    rerender(
      <PartitureFormulaCanvas
        strokes={updatedStrokes}
        onChangeStrokes={onChangeStrokes}
        activeTool="eraser"
        selectedDuration={0.5}
        selectedDynamic="normal"
        player={mockPlayer}
        width={500}
      />
    );

    // Click on Kick line (line 3.5 ~ Y=60)
    fireEvent.click(canvas, {
      clientX: 80,
      clientY: 60,
    });

    expect(onChangeStrokes).toHaveBeenCalledTimes(1);
    const finalStrokes: OrchestratedStroke[] = onChangeStrokes.mock.calls[0][0];
    expect(finalStrokes[0].isRest).toBe(true);
    expect(finalStrokes[0].hits).toHaveLength(0);
  });

  // Note-Anchored Interpolation regression net at the component seam (docs/adr/0012):
  // the audition Playhead must land on the notehead VexFlow actually drew, even
  // inside a triplet group where the old linear mapping drifted.
  it('lands the audition playhead exactly on a triplet notehead', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 1 / 3, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      { durationRatio: 1 / 3, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      { durationRatio: 1 / 3, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      { durationRatio: 1.0, hits: [{ voice: 'crash', dynamic: 'normal' }] },
    ];

    render(
      <PartitureFormulaCanvas
        strokes={strokes}
        onChangeStrokes={vi.fn()}
        activeTool="note"
        selectedDuration={1 / 3}
        selectedDynamic="normal"
        player={mockPlayer}
        width={500}
        targetBeats={2}
        playheadBeat={1 / 3}
      />
    );
    // A hover gesture mirrors a live session: React re-renders with the layout
    // ref already set, so the audition Playhead is laid out through the deepened seam.
    const canvasEl = screen.getByTestId('partiture-formula-canvas');
    fireEvent.mouseMove(canvasEl, { clientX: 40, clientY: 40 });

    const canvas = screen.getByTestId('partiture-formula-canvas');
    const playhead = screen.getByTestId('audition-playhead');
    const style = playhead.getAttribute('style') ?? '';
    const leftMatch = /left:\s*([0-9.]+)px/.exec(style);
    expect(leftMatch).toBeTruthy();
    const playheadLeft = Number((leftMatch as RegExpExecArray)[1]);

    // Rendered SVG ground truth: VexFlow 5 places each notehead in a
    // vf-stavenote group whose glyph text carries the absolute x.
    const svg = canvas.querySelector('svg');
    expect(svg).toBeTruthy();
    const glyphXs: number[] = [];
    for (const noteGroup of (svg as Element | null)?.querySelectorAll('g.vf-stavenote') ?? []) {
      const glyph = noteGroup.querySelector('text');
      const x = glyph?.getAttribute('x');
      if (x) glyphXs.push(Number(x));
    }
    expect(glyphXs.length).toBe(4);

    // The Playhead for beat offset 1/3 lands on the second stroke's notehead
    // (sub-pixel tolerance covers glyph justification, not metric drift).
    expect(Math.abs(glyphXs[1] - playheadLeft)).toBeLessThanOrEqual(2);
  });

  // Continuous Metric Timeline (docs/adr/0013): a mixed figure (1/3 swing
  // beside 1/4 straight) must survive editing without the measure being
  // re-quantized onto the selected grid.
  it('keeps mixed 1/3 and 1/4 figures without re-quantizing on edit', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 1 / 3, hits: [{ voice: 'ride', dynamic: 'normal' }] },
      { durationRatio: 1 / 3, isRest: true, hits: [] },
      { durationRatio: 0.25, hits: [{ voice: 'tom_floor', dynamic: 'normal' }] },
    ];
    const onChangeStrokes = vi.fn();

    render(
      <PartitureFormulaCanvas
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        activeTool="note"
        selectedDuration={0.5}
        selectedDynamic="accent"
        player={mockPlayer}
        width={500}
        targetBeats={1.0}
      />
    );

    const canvas = screen.getByTestId('partiture-formula-canvas');

    // Click over the 0.25 event (offset 2/3) toward the right of the measure.
    fireEvent.click(canvas, {
      clientX: 380,
      clientY: 60,
    });

    expect(onChangeStrokes).toHaveBeenCalledTimes(1);
    const updated: OrchestratedStroke[] = onChangeStrokes.mock.calls[0][0];
    const durations = updated.map((s) => s.durationRatio);
    expect(durations).toEqual([1 / 3, 1 / 3, 0.25]);
    expect(updated[1].isRest).toBe(true);
    expect(updated[1].hits).toHaveLength(0);
    // The stamped voice merges into the nearest event as a chord.
    expect(updated[2].hits).toHaveLength(2);
    expect(updated[2].hits.some((h) => h.voice === 'tom_floor')).toBe(true);
  });

  // Continuous Metric Timeline end-to-end (docs/adr/0013): the same mixed
  // figure edited by a POINTER DRAG preserves every fractional ratio.
  it('edits a mixed 1/3 + 1/4 figure by drag without losing either ratio', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 1 / 3, hits: [{ voice: 'ride', dynamic: 'normal' }] },
      { durationRatio: 1 / 3, isRest: true, hits: [] },
      { durationRatio: 0.25, hits: [{ voice: 'kick', dynamic: 'normal' }] },
    ];
    const onChangeStrokes = vi.fn();

    render(
      <PartitureFormulaCanvas
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        activeTool="note"
        selectedDuration={0.25}
        selectedDynamic="normal"
        player={mockPlayer}
        width={500}
        targetBeats={1.0}
      />
    );

    const canvas = screen.getByTestId('partiture-formula-canvas');

    const firePointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', x: number, y: number) => {
      const event = createEvent[type](canvas);
      Object.assign(event, { clientX: x, clientY: y });
      fireEvent(canvas, event);
    };

    // Pointer down on the downbeat ride notehead, drag right to the 0.5
    // metric position and release: the ride event moves there while the
    // 1/4 kick keeps its fractional history (total 1/3 + 1/3 + 0.25).
    firePointer('pointerDown', 80, 60);
    firePointer('pointerMove', 280, 60);
    firePointer('pointerUp', 280, 60);

    expect(onChangeStrokes).toHaveBeenCalledTimes(1);
    const updated: OrchestratedStroke[] = onChangeStrokes.mock.calls[0][0];
    const durations = updated.map((s) => s.durationRatio);
    // Nothing re-quantized: the 1/3 durations survive the drag.
    expect(durations.filter((d) => Math.abs(d - 1 / 3) < 0.001)).toHaveLength(2);
    expect(durations.filter((d) => Math.abs(d - 0.25) < 0.001)).toHaveLength(2);
    // The moved voice landed on a sounding event, not in a colliding slot.
    const soundingEvents = updated.filter((s) => !s.isRest && s.hits.length > 0);
    expect(soundingEvents).toHaveLength(2);
    expect(soundingEvents.every((s) => s.hits.length === 1)).toBe(true);
  });
});
