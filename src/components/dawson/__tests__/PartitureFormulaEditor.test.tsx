import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PartitureFormulaEditor } from '../PartitureFormulaEditor';
import { OrchestratedStroke } from '../../../domain/dawson/types';
import { IDrumKitPlayer } from '../../../audio/types';

describe('PartitureFormulaEditor', () => {
  it('renders both the toolbar palette and canvas', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 0.5, hits: [{ voice: 'snare', dynamic: 'normal' }] },
    ];
    const onChangeStrokes = vi.fn();
    const mockPlayer: IDrumKitPlayer = {
      play: vi.fn(),
      triggerVoice: vi.fn(),
    };

    render(
      <PartitureFormulaEditor
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        player={mockPlayer}
      />
    );

    expect(screen.getByRole('toolbar', { name: /Formula Notation Palette/i })).toBeInTheDocument();
    expect(screen.getByTestId('partiture-formula-canvas')).toBeInTheDocument();
  });

  it('renders the editor chrome entirely with token roles', () => {
    const strokes: OrchestratedStroke[] = [
      { durationRatio: 0.5, hits: [{ voice: 'snare', dynamic: 'normal' }] },
    ];
    const onChangeStrokes = vi.fn();
    const mockPlayer: IDrumKitPlayer = {
      play: vi.fn(),
      triggerVoice: vi.fn(),
    };

    render(
      <PartitureFormulaEditor
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        player={mockPlayer}
      />
    );

    // Active voice chip and occupied slot are Accent-filled
    const snareVoiceBtn = screen.getByRole('button', { name: /Snare/ });
    expect(snareVoiceBtn).toHaveClass('bg-primary');
    expect(snareVoiceBtn).toHaveClass('text-primary-foreground');
    expect(snareVoiceBtn).toHaveClass('border-primary');
    const activeSlot = screen.getByTestId('slot-step-0');
    expect(activeSlot).toHaveClass('bg-primary');
    expect(activeSlot).toHaveClass('rounded-none');

    // Clear All is a Destructive affordance
    const clearBtn = screen.getByRole('button', { name: /Clear All/ });
    expect(clearBtn).toHaveClass('hover:text-destructive');

    // Zero raw palette classes anywhere in the editor (also second palettes like purple)
    for (const el of document.body.querySelectorAll('*')) {
      expect(
        /(?:teal|rose|emerald|amber|purple|slate)-\d|bg-(?:white|black)|text-white|dark:|rgba\(|rounded(?!-none)/.test(
          el.getAttribute('class') ?? ''
        )
      ).toBe(false);
    }
  });

  it('allows selecting tools in the palette and stamping notes on the canvas', () => {
    const strokes: OrchestratedStroke[] = [];
    const onChangeStrokes = vi.fn();
    const mockTriggerVoice = vi.fn();
    const mockPlayer: IDrumKitPlayer = {
      play: vi.fn(),
      triggerVoice: mockTriggerVoice,
    };

    render(
      <PartitureFormulaEditor
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        player={mockPlayer}
      />
    );

    // Select Accent
    const accentBtn = screen.getByRole('button', { name: /Accent/i });
    fireEvent.click(accentBtn);

    // Select 1/8 note duration
    const eighthBtn = screen.getByRole('button', { name: /^1\/8$/i });
    fireEvent.click(eighthBtn);

    // Click canvas to stamp
    const canvas = screen.getByTestId('partiture-formula-canvas');
    fireEvent.click(canvas, {
      clientX: 80,
      clientY: 60,
    });

    expect(mockTriggerVoice).toHaveBeenCalled();
    expect(onChangeStrokes).toHaveBeenCalledTimes(1);
    const updated = onChangeStrokes.mock.calls[0][0];
    expect(updated[0].durationRatio).toBe(0.5);
    expect(updated[0].hits[0].dynamic).toBe('accent');
  });

  it('renders subdivision slot step buttons and toggles active voice on slot click', () => {
    const strokes: OrchestratedStroke[] = [];
    const onChangeStrokes = vi.fn();
    const mockTriggerVoice = vi.fn();
    const mockPlayer: IDrumKitPlayer = {
      play: vi.fn(),
      triggerVoice: mockTriggerVoice,
    };

    render(
      <PartitureFormulaEditor
        strokes={strokes}
        onChangeStrokes={onChangeStrokes}
        targetBeats={1.0}
        player={mockPlayer}
      />
    );

    // 1 beat @ 1/16 has 4 slots (0, 1, 2, 3)
    const slot0 = screen.getByTestId('slot-step-0');
    const slot1 = screen.getByTestId('slot-step-1');
    const slot2 = screen.getByTestId('slot-step-2');
    const slot3 = screen.getByTestId('slot-step-3');

    expect(slot0).toBeInTheDocument();
    expect(slot1).toBeInTheDocument();
    expect(slot2).toBeInTheDocument();
    expect(slot3).toBeInTheDocument();

    // Select Kick voice
    const kickVoiceBtn = screen.getByRole('button', { name: /Kick/i });
    fireEvent.click(kickVoiceBtn);
    expect(mockTriggerVoice).toHaveBeenCalledWith('kick', 0, expect.any(Number), 'orchestration');

    // Click slot 0 to place Kick on downbeat
    fireEvent.click(slot0);

    expect(onChangeStrokes).toHaveBeenCalledTimes(1);
    const updated = onChangeStrokes.mock.calls[0][0];
    expect(updated[0].hits[0].voice).toBe('kick');
  });
});
