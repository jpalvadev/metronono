import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import { PartitureFormulaCanvas } from '../PartitureFormulaCanvas';
import { OrchestratedStroke } from '../../../domain/dawson/types';
import { IDrumKitPlayer } from '../../../audio/types';

function dispatchDrop(
  element: Element,
  coords: { clientX: number; clientY: number },
  dataTransferObj?: { getData: (type: string) => string }
) {
  const event = createEvent.drop(element);
  Object.assign(event, coords, {
    dataTransfer: dataTransferObj || {
      getData: () => '',
    },
  });
  fireEvent(element, event);
}

function dispatchDragOver(
  element: Element,
  coords: { clientX: number; clientY: number }
) {
  const event = createEvent.dragOver(element);
  Object.assign(event, coords);
  fireEvent(element, event);
}

function dispatchPointer(
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  element: Element,
  coords: { clientX: number; clientY: number; pointerId?: number }
) {
  const event = createEvent[type](element);
  Object.assign(event, coords);
  fireEvent(element, event);
}

describe('PartitureFormulaCanvas Drag-and-Drop & Transposition', () => {
  let mockPlayer: IDrumKitPlayer;
  let mockTriggerVoice: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockTriggerVoice = vi.fn();
    mockPlayer = {
      play: vi.fn(),
      triggerVoice: mockTriggerVoice,
    };
  });

  it('renders drag affordances with the Accent Playhead and shared glow', () => {
    const strokes: OrchestratedStroke[] = [];
    const onChangeStrokes = vi.fn();

    render(
      <PartitureFormulaCanvas
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        activeTool="note"
        selectedDuration={0.25}
        selectedDynamic="accent"
        player={mockPlayer}
        width={500}
      />
    );

    const canvas = screen.getByTestId('partiture-formula-canvas');
    dispatchDragOver(canvas, { clientX: 80, clientY: 55 });

    // The snap guide is the Playhead treatment: Accent + shared glow utility
    const guides = document.body.querySelectorAll('[class*="playhead-glow"]');
    expect(guides.length).toBeGreaterThanOrEqual(1);
    expect(guides[0].className.includes('bg-primary')).toBe(true);

    for (const el of document.body.querySelectorAll('*')) {
      expect(
        /(?:teal|rose|emerald|amber|purple|slate)-\d|bg-white|text-white|dark:|rgba\(/.test(
          el.getAttribute('class') ?? ''
        )
      ).toBe(false);
    }
  });

  it('drops a palette token onto the stave inserting note at targeted line and column', () => {
    const strokes: OrchestratedStroke[] = [];
    const onChangeStrokes = vi.fn();

    render(
      <PartitureFormulaCanvas
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        activeTool="note"
        selectedDuration={0.25}
        selectedDynamic="accent"
        player={mockPlayer}
        width={500}
      />
    );

    const canvas = screen.getByTestId('partiture-formula-canvas');

    // Dragover near Crash line (Y=55)
    dispatchDragOver(canvas, { clientX: 80, clientY: 55 });

    // Drop on Crash line (Y=55) with palette payload
    dispatchDrop(
      canvas,
      { clientX: 80, clientY: 55 },
      {
        getData: () =>
          JSON.stringify({
            type: 'palette-note',
            durationRatio: 0.25,
            dynamic: 'accent',
          }),
      }
    );

    expect(onChangeStrokes).toHaveBeenCalledTimes(1);
    const updated = onChangeStrokes.mock.calls[0][0];
    expect(updated).toHaveLength(1);
    expect(updated[0].hits[0].voice).toBe('crash');
    expect(updated[0].hits[0].dynamic).toBe('accent');
  });

  it('drags an existing note vertically to transpose drum voice and plays sound on crossing', () => {
    // Single snare hit at beat 0 (snare is at Y=80)
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

    const canvas = screen.getByTestId('partiture-formula-canvas');

    // Pointer down on Snare line (Y=80)
    dispatchPointer('pointerDown', canvas, { clientX: 80, clientY: 80 });

    // Drag pointer down to Kick line (Y=100)
    dispatchPointer('pointerMove', canvas, { clientX: 80, clientY: 100 });

    // Audio feedback should trigger for kick when crossing into kick line
    expect(mockTriggerVoice).toHaveBeenCalledWith('kick', 0, expect.any(Number), 'orchestration');

    // Pointer up to complete transposition
    dispatchPointer('pointerUp', canvas, { clientX: 80, clientY: 100 });

    expect(onChangeStrokes).toHaveBeenCalledTimes(1);
    const updated = onChangeStrokes.mock.calls[0][0];
    expect(updated[0].hits[0].voice).toBe('kick');
  });

  it('drags an existing note horizontally to shift metric timing along snap grid', () => {
    // 2 16th notes: kick at beat 0, snare at beat 0.25
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 0.25, hits: [{ voice: 'kick', dynamic: 'normal' }] },
      { durationRatio: 0.25, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      { durationRatio: 0.5, isRest: true, hits: [] },
    ];
    const onChangeStrokes = vi.fn();

    render(
      <PartitureFormulaCanvas
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        activeTool="note"
        selectedDuration={0.25}
        selectedDynamic="normal"
        targetBeats={1.0}
        player={mockPlayer}
        width={500}
      />
    );

    const canvas = screen.getByTestId('partiture-formula-canvas');

    // Pointer down on Kick note at beat 0 (X=80, Y=100)
    dispatchPointer('pointerDown', canvas, { clientX: 80, clientY: 100 });

    // Drag horizontally to beat 0.5 (X=280)
    dispatchPointer('pointerMove', canvas, { clientX: 280, clientY: 100 });
    dispatchPointer('pointerUp', canvas, { clientX: 280, clientY: 100 });

    expect(onChangeStrokes).toHaveBeenCalledTimes(1);
    const updated = onChangeStrokes.mock.calls[0][0];
    expect(updated.length).toBeGreaterThanOrEqual(2);
  });

  it('removes a note when dragged completely off the stave (drag-off removal)', () => {
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

    const canvas = screen.getByTestId('partiture-formula-canvas');

    // Pointer down on note at Y=80
    dispatchPointer('pointerDown', canvas, { clientX: 80, clientY: 80 });

    // Drag far above stave (Y = -50)
    dispatchPointer('pointerMove', canvas, { clientX: 80, clientY: -50 });
    dispatchPointer('pointerUp', canvas, { clientX: 80, clientY: -50 });

    expect(onChangeStrokes).toHaveBeenCalledTimes(1);
    const updated = onChangeStrokes.mock.calls[0][0];
    expect(updated[0].isRest).toBe(true);
    expect(updated[0].hits).toHaveLength(0);
  });

  it('renders visual snap and staff line guide indicators while dragging', () => {
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

    const canvas = screen.getByTestId('partiture-formula-canvas');

    // Pointer down and drag
    dispatchPointer('pointerDown', canvas, { clientX: 80, clientY: 80 });
    dispatchPointer('pointerMove', canvas, { clientX: 120, clientY: 100 });

    expect(screen.getByTestId('drag-target-guide')).toBeInTheDocument();

    dispatchPointer('pointerUp', canvas, { clientX: 120, clientY: 100 });

    expect(screen.queryByTestId('drag-target-guide')).not.toBeInTheDocument();
  });
});
