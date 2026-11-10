import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
      onDrumHit: vi.fn().mockReturnValue(() => {}),
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
});
