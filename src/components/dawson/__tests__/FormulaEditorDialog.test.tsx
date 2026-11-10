import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FormulaEditorDialog } from '../FormulaEditorDialog';
import { SubdivisionFormula } from '../../../domain/dawson/types';
import { IDrumKitPlayer } from '../../../audio/types';

describe('FormulaEditorDialog Component', () => {
  let mockPlayer: IDrumKitPlayer;
  let mockTriggerVoice: ReturnType<typeof vi.fn>;
  let mockOnSave: ReturnType<typeof vi.fn>;
  let mockOnDelete: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;

  const sampleFormula: SubdivisionFormula = {
    id: 'custom_test_formula',
    name: 'Custom Bop Triplet',
    trigger: 'short',
    strokes: [
      { durationRatio: 0.1667, hits: [{ voice: 'kick', dynamic: 'accent' }] },
      { durationRatio: 0.1667, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      { durationRatio: 0.1667, hits: [{ voice: 'tom_high', dynamic: 'ghost' }] },
    ],
    isCustom: true,
  };

  beforeEach(() => {
    mockTriggerVoice = vi.fn();
    mockPlayer = {
      play: vi.fn(),
      triggerVoice: mockTriggerVoice,
      onDrumHit: vi.fn().mockReturnValue(() => {}),
    };
    mockOnSave = vi.fn();
    mockOnDelete = vi.fn();
    mockOnClose = vi.fn();
  });

  it('renders dialog with formula details and stroke list', () => {
    render(
      <FormulaEditorDialog
        open={true}
        onClose={mockOnClose}
        formula={sampleFormula}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
        player={mockPlayer}
      />
    );

    expect(screen.getByText(/Subdivision Formula Editor/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Custom Bop Triplet')).toBeInTheDocument();
    expect(screen.getByText(/Total Duration:/i)).toBeInTheDocument();

    // 3 strokes rendered
    const strokeItems = screen.getAllByTestId(/^stroke-item-/);
    expect(strokeItems).toHaveLength(3);
  });

  it('adds a new stroke when clicking Add Stroke', () => {
    render(
      <FormulaEditorDialog
        open={true}
        onClose={mockOnClose}
        formula={sampleFormula}
        onSave={mockOnSave}
        player={mockPlayer}
      />
    );

    const addBtn = screen.getByRole('button', { name: /Add Stroke/i });
    fireEvent.click(addBtn);

    const strokeItems = screen.getAllByTestId(/^stroke-item-/);
    expect(strokeItems).toHaveLength(4);
  });

  it('removes a stroke when clicking delete on that stroke', () => {
    render(
      <FormulaEditorDialog
        open={true}
        onClose={mockOnClose}
        formula={sampleFormula}
        onSave={mockOnSave}
        player={mockPlayer}
      />
    );

    const deleteStrokeBtns = screen.getAllByLabelText(/Delete stroke/i);
    expect(deleteStrokeBtns).toHaveLength(3);

    fireEvent.click(deleteStrokeBtns[1]); // delete stroke 2

    const strokeItems = screen.getAllByTestId(/^stroke-item-/);
    expect(strokeItems).toHaveLength(2);
  });

  it('modifies stroke attributes (voice, dynamic)', () => {
    render(
      <FormulaEditorDialog
        open={true}
        onClose={mockOnClose}
        formula={sampleFormula}
        onSave={mockOnSave}
        player={mockPlayer}
      />
    );

    // Change dynamic on stroke 0 to flam
    const dynamicFlamBtn = screen.getByTestId('stroke-0-dynamic-flam');
    fireEvent.click(dynamicFlamBtn);

    // Change voice on stroke 0 to tom_floor
    const voiceSelect = screen.getByLabelText(/Stroke 1 voice/i);
    fireEvent.change(voiceSelect, { target: { value: 'tom_floor' } });

    // Save and verify onSave received updated stroke
    const saveBtn = screen.getByRole('button', { name: /Save Formula/i });
    fireEvent.click(saveBtn);

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    const savedFormula: SubdivisionFormula = mockOnSave.mock.calls[0][0];
    expect(savedFormula.strokes[0].hits[0].voice).toBe('tom_floor');
    expect(savedFormula.strokes[0].hits[0].dynamic).toBe('flam');
  });

  it('auditions an individual stroke via player', () => {
    render(
      <FormulaEditorDialog
        open={true}
        onClose={mockOnClose}
        formula={sampleFormula}
        onSave={mockOnSave}
        player={mockPlayer}
      />
    );

    const auditionStroke0Btn = screen.getByTestId('audition-stroke-0');
    fireEvent.click(auditionStroke0Btn);

    expect(mockTriggerVoice).toHaveBeenCalledWith('kick', 0, expect.any(Number), 'orchestration');
  });

  it('auditions entire formula sequentially', () => {
    vi.useFakeTimers();

    render(
      <FormulaEditorDialog
        open={true}
        onClose={mockOnClose}
        formula={sampleFormula}
        onSave={mockOnSave}
        player={mockPlayer}
      />
    );

    const auditionFormulaBtn = screen.getByRole('button', { name: /Audition Formula/i });
    fireEvent.click(auditionFormulaBtn);

    // First stroke plays immediately
    expect(mockTriggerVoice).toHaveBeenCalledTimes(1);
    expect(mockTriggerVoice).toHaveBeenLastCalledWith('kick', 0, expect.any(Number), 'orchestration');

    // Advance timer to trigger second stroke (~100ms at 100 BPM)
    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(mockTriggerVoice).toHaveBeenCalledTimes(2);
    expect(mockTriggerVoice).toHaveBeenLastCalledWith('snare', 0, expect.any(Number), 'orchestration');

    // Advance timer to trigger third stroke (~200ms at 100 BPM)
    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(mockTriggerVoice).toHaveBeenCalledTimes(3);
    expect(mockTriggerVoice).toHaveBeenLastCalledWith('tom_high', 0, expect.any(Number), 'orchestration');

    vi.useRealTimers();
  });

  it('allows deleting a custom formula', () => {
    render(
      <FormulaEditorDialog
        open={true}
        onClose={mockOnClose}
        formula={sampleFormula}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
        player={mockPlayer}
      />
    );

    const deleteBtn = screen.getByRole('button', { name: /Delete Formula/i });
    fireEvent.click(deleteBtn);

    expect(mockOnDelete).toHaveBeenCalledWith('custom_test_formula');
    expect(mockOnClose).toHaveBeenCalled();
  });
});
