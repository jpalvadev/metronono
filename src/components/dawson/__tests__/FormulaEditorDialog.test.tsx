import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FormulaEditorDialog } from '../FormulaEditorDialog';
import { SubdivisionFormula } from '../../../domain/dawson/types';
import { IDrumKitPlayer } from '../../../audio/types';

describe('FormulaEditorDialog Component (Partiture Drum Staff)', () => {
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
      {
        durationRatio: 0.25,
        hits: [
          { voice: 'kick', dynamic: 'accent' },
          { voice: 'crash', dynamic: 'accent' },
        ],
      },
      { durationRatio: 0.25, hits: [{ voice: 'snare', dynamic: 'normal' }] },
    ],
    isCustom: true,
  };

  beforeEach(() => {
    mockTriggerVoice = vi.fn();
    mockPlayer = {
      play: vi.fn(),
      triggerVoice: mockTriggerVoice,
    };
    mockOnSave = vi.fn();
    mockOnDelete = vi.fn();
    mockOnClose = vi.fn();
  });

  it('renders partiture staff dialog with formula details, duration budget, and palette', () => {
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
    expect(screen.getByTestId('duration-budget-indicator')).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: /Formula Notation Palette/i })).toBeInTheDocument();
    expect(screen.getByTestId('partiture-formula-canvas')).toBeInTheDocument();
  });

  it('reflects duration budget status (balanced, remaining, overflow)', () => {
    const { rerender } = render(
      <FormulaEditorDialog
        open={true}
        onClose={mockOnClose}
        formula={sampleFormula} // total duration = 0.5 for short trigger = balanced!
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText(/Budget Balanced/i)).toBeInTheDocument();

    // Rerender with under-budget formula
    const underBudgetFormula: SubdivisionFormula = {
      ...sampleFormula,
      strokes: [
        { durationRatio: 0.25, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      ], // 0.25 vs 0.5
    };
    rerender(
      <FormulaEditorDialog
        open={true}
        onClose={mockOnClose}
        formula={underBudgetFormula}
        onSave={mockOnSave}
      />
    );
    expect(screen.getByText(/0.25 beats remaining/i)).toBeInTheDocument();

    // Rerender with over-budget formula
    const overBudgetFormula: SubdivisionFormula = {
      ...sampleFormula,
      strokes: [
        { durationRatio: 0.5, hits: [{ voice: 'snare', dynamic: 'normal' }] },
        { durationRatio: 0.25, hits: [{ voice: 'snare', dynamic: 'normal' }] },
      ], // 0.75 vs 0.5
    };
    rerender(
      <FormulaEditorDialog
        open={true}
        onClose={mockOnClose}
        formula={overBudgetFormula}
        onSave={mockOnSave}
      />
    );
    expect(screen.getByText(/Overflow/i)).toBeInTheDocument();
  });

  it('updates formula metadata (name, trigger, description)', () => {
    render(
      <FormulaEditorDialog
        open={true}
        onClose={mockOnClose}
        formula={sampleFormula}
        onSave={mockOnSave}
      />
    );

    const nameInput = screen.getByLabelText(/Formula Name/i);
    fireEvent.change(nameInput, { target: { value: 'Renamed Formula' } });

    const descInput = screen.getByLabelText(/Description/i);
    fireEvent.change(descInput, { target: { value: 'New description' } });

    // Switch to Long trigger
    const longBtn = screen.getByRole('button', { name: /^Long \(≥ 1 Beat\)$/i });
    fireEvent.click(longBtn);

    const saveBtn = screen.getByRole('button', { name: /Save Formula/i });
    fireEvent.click(saveBtn);

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    const saved: SubdivisionFormula = mockOnSave.mock.calls[0][0];
    expect(saved.name).toBe('Renamed Formula');
    expect(saved.description).toBe('New description');
    expect(saved.trigger).toBe('long');
  });

  it('auditions formula in rhythm, triggering simultaneous unisons at offset 0', () => {
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

    const auditionBtn = screen.getByRole('button', { name: /Audition Formula/i });
    fireEvent.click(auditionBtn);

    // Initial stroke is kick + crash unison: both should play immediately at offset 0
    expect(mockTriggerVoice).toHaveBeenCalledWith('kick', 0, expect.any(Number), 'orchestration');
    expect(mockTriggerVoice).toHaveBeenCalledWith('crash', 0, expect.any(Number), 'orchestration');

    // Advance timers for second stroke (~150ms at 100 BPM for 0.25 beat)
    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(mockTriggerVoice).toHaveBeenCalledWith('snare', 0, expect.any(Number), 'orchestration');

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
      />
    );

    const deleteBtn = screen.getByRole('button', { name: /Delete Formula/i });
    fireEvent.click(deleteBtn);

    expect(mockOnDelete).toHaveBeenCalledWith('custom_test_formula');
    expect(mockOnClose).toHaveBeenCalled();
  });
});
