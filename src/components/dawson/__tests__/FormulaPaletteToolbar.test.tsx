import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormulaPaletteToolbar } from '../FormulaPaletteToolbar';

describe('FormulaPaletteToolbar', () => {
  it('renders palette chips with token roles (Accent/Warning/Destructive by meaning)', () => {
    const onSelectDuration = vi.fn();
    const onSelectTool = vi.fn();
    const onSelectDynamic = vi.fn();

    render(
      <FormulaPaletteToolbar
        selectedDuration={0.25}
        onSelectDuration={onSelectDuration}
        activeTool="note"
        onSelectTool={onSelectTool}
        selectedDynamic="normal"
        onSelectDynamic={onSelectDynamic}
      />
    );

    const noteToolBtn = screen.getByRole('button', { name: /^Note$/ });
    expect(noteToolBtn).toHaveClass('bg-primary/20');
    expect(noteToolBtn).toHaveClass('text-primary');
    expect(noteToolBtn).toHaveClass('border-primary/50');

    const selectedDurationBtn = screen.getByRole('button', { name: /^1\/16$/ });
    expect(selectedDurationBtn).toHaveClass('bg-primary');
    expect(selectedDurationBtn).toHaveClass('text-primary-foreground');

    // Square-corner standard across the toolbar chrome
    const toolbar = screen.getByRole('toolbar', { name: /Formula Notation Palette/ });
    expect(toolbar).toHaveClass('rounded-none');

    for (const el of document.body.querySelectorAll('*')) {
      expect(
        /(?:teal|rose|emerald|amber|purple|slate)-\d|bg-white|text-white|dark:|rgba\(/.test(
          el.getAttribute('class') ?? ''
        )
      ).toBe(false);
    }
  });

  it('renders all duration buttons and triggers onSelectDuration', () => {
    const onSelectDuration = vi.fn();
    const onSelectTool = vi.fn();
    const onSelectDynamic = vi.fn();

    render(
      <FormulaPaletteToolbar
        selectedDuration={0.25}
        onSelectDuration={onSelectDuration}
        activeTool="note"
        onSelectTool={onSelectTool}
        selectedDynamic="normal"
        onSelectDynamic={onSelectDynamic}
      />
    );

    // Verify all 6 durations are present
    expect(screen.getByRole('button', { name: /^1\/4$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^1\/8$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^1\/8 T$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^1\/16$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^1\/16 T$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^1\/32$/i })).toBeInTheDocument();

    // Click 1/8 Triplet
    fireEvent.click(screen.getByRole('button', { name: /^1\/8 T$/i }));
    expect(onSelectDuration).toHaveBeenCalledWith(expect.closeTo(1 / 3, 3));
  });

  it('renders tool mode toggles (Note, Rest, Eraser) and switches tools', () => {
    const onSelectDuration = vi.fn();
    const onSelectTool = vi.fn();
    const onSelectDynamic = vi.fn();

    render(
      <FormulaPaletteToolbar
        selectedDuration={0.25}
        onSelectDuration={onSelectDuration}
        activeTool="note"
        onSelectTool={onSelectTool}
        selectedDynamic="normal"
        onSelectDynamic={onSelectDynamic}
      />
    );

    const restBtn = screen.getByRole('button', { name: /Rest/i });
    const eraserBtn = screen.getByRole('button', { name: /Eraser/i });

    fireEvent.click(restBtn);
    expect(onSelectTool).toHaveBeenCalledWith('rest');

    fireEvent.click(eraserBtn);
    expect(onSelectTool).toHaveBeenCalledWith('eraser');
  });

  it('renders dynamic articulations and triggers onSelectDynamic', () => {
    const onSelectDuration = vi.fn();
    const onSelectTool = vi.fn();
    const onSelectDynamic = vi.fn();

    render(
      <FormulaPaletteToolbar
        selectedDuration={0.25}
        onSelectDuration={onSelectDuration}
        activeTool="note"
        onSelectTool={onSelectTool}
        selectedDynamic="normal"
        onSelectDynamic={onSelectDynamic}
      />
    );

    const accentBtn = screen.getByRole('button', { name: /Accent/i });
    const ghostBtn = screen.getByRole('button', { name: /Ghost/i });
    const flamBtn = screen.getByRole('button', { name: /Flam/i });
    const dragBtn = screen.getByRole('button', { name: /Drag/i });

    fireEvent.click(accentBtn);
    expect(onSelectDynamic).toHaveBeenCalledWith('accent');

    fireEvent.click(ghostBtn);
    expect(onSelectDynamic).toHaveBeenCalledWith('ghost');

    fireEvent.click(flamBtn);
    expect(onSelectDynamic).toHaveBeenCalledWith('flam');

    fireEvent.click(dragBtn);
    expect(onSelectDynamic).toHaveBeenCalledWith('drag');
  });
});
