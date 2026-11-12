import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresetManager } from '../PresetManager';
import { DawsonPresetManager } from '../../../domain/dawson/SubdivisionFormula';
import { IDrumKitPlayer } from '../../../audio/types';

describe('PresetManager Component', () => {
  let presetManager: DawsonPresetManager;
  let mockPlayer: IDrumKitPlayer;
  let mockOnSelectSystem: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    presetManager = new DawsonPresetManager({ storagePrefix: 'test_pm_' });
    presetManager.clearCustomData();

    mockPlayer = {
      play: vi.fn(),
      triggerVoice: vi.fn(),
    };

    mockOnSelectSystem = vi.fn();
    mockOnClose = vi.fn();
  });

  it('renders the modal entirely through token roles (one style)', () => {
    presetManager.saveSystem({
      id: 'custom_styled',
      name: 'Styled Custom System',
      shortFormula: presetManager.getFormula('single_snare')!,
      longFormula: presetManager.getFormula('single_kick')!,
    });

    render(
      <PresetManager
        open={true}
        onClose={mockOnClose}
        presetManager={presetManager}
        activeSystemId="classic_bop"
        onSelectSystem={mockOnSelectSystem}
        player={mockPlayer}
      />
    );

    // Shared Modal Scrim replaces the per-modal scrim literal
    const scrim = document.body.querySelectorAll('[class*="modal-scrim"]')[0];
    expect(scrim).toBeDefined();
    expect(scrim).toHaveClass('modal-scrim');
    expect(scrim.className.includes('bg-black')).toBe(false);

    // Active tab is Accent
    const activeTabBtn = screen.getByRole('button', { name: /Interpretation Systems/ });
    expect(activeTabBtn).toHaveClass('border-primary');
    expect(activeTabBtn).toHaveClass('text-primary');

    // Apply action is Accent-filled, Delete action is Destructive
    const applyBtn = screen.getByTestId('apply-system-tony_williams_flr');
    expect(applyBtn).toHaveClass('bg-primary');
    expect(applyBtn).toHaveClass('text-primary-foreground');
    const deleteBtn = screen.getByTestId('delete-system-custom_styled');
    expect(deleteBtn).toHaveClass('text-destructive');
    expect(deleteBtn).toHaveClass('hover:bg-destructive/10');

    // Active system chip: Accent ring; Custom badge: neutral chrome, never Warning
    const activeCard = document.body.querySelectorAll('[class*="ring-primary"]')[0];
    expect(activeCard).toBeDefined();
    expect(activeCard).toHaveClass('bg-primary/10');
    expect(activeCard).toHaveClass('border-primary/60');
    const customBadge = screen.getByText(/^Custom$/);
    expect(customBadge).toHaveClass('border-border');
    expect(customBadge).toHaveClass('text-muted-foreground');
    expect(customBadge.className.includes('text-warning')).toBe(false);

    // Geometry: the app standard is square corners (rounded-none)
    const rawPalette = /(?:teal|rose|emerald|amber|purple|slate)-\d|bg-(?:white|black)|text-white|dark:|rgba\(|rounded(?!-none)/;
    for (const el of document.body.querySelectorAll('*')) {
      expect(rawPalette.test(el.className)).toBe(false);
    }
  });

  it('renders default Dawson Systems and formula library', () => {
    render(
      <PresetManager
        open={true}
        onClose={mockOnClose}
        presetManager={presetManager}
        activeSystemId="classic_bop"
        onSelectSystem={mockOnSelectSystem}
        player={mockPlayer}
      />
    );

    expect(screen.getByText(/Dawson Systems & Formula Manager/i)).toBeInTheDocument();
    expect(screen.getByText(/Classic Bop/i)).toBeInTheDocument();
    expect(screen.getByText(/Inverted Bop/i)).toBeInTheDocument();
    expect(screen.getByText(/Tony Williams F-L-R Triplet/i)).toBeInTheDocument();
    expect(screen.getByText(/Linear Diddle Fusion/i)).toBeInTheDocument();
  });

  it('selects and applies a system when clicking Apply', () => {
    render(
      <PresetManager
        open={true}
        onClose={mockOnClose}
        presetManager={presetManager}
        activeSystemId="classic_bop"
        onSelectSystem={mockOnSelectSystem}
        player={mockPlayer}
      />
    );

    const applyTonyBtn = screen.getByTestId('apply-system-tony_williams_flr');
    fireEvent.click(applyTonyBtn);

    expect(mockOnSelectSystem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tony_williams_flr' })
    );
  });

  it('allows creating a new custom Dawson System', () => {
    render(
      <PresetManager
        open={true}
        onClose={mockOnClose}
        presetManager={presetManager}
        activeSystemId="classic_bop"
        onSelectSystem={mockOnSelectSystem}
        player={mockPlayer}
      />
    );

    // Open "Create System" section
    const newSystemBtn = screen.getByRole('button', { name: /New System/i });
    fireEvent.click(newSystemBtn);

    const nameInput = screen.getByLabelText(/System Name/i);
    fireEvent.change(nameInput, { target: { value: 'My Custom Latin System' } });

    const saveSystemBtn = screen.getByRole('button', { name: /Save System/i });
    fireEvent.click(saveSystemBtn);

    expect(presetManager.getSystem('My Custom Latin System') || screen.getByText('My Custom Latin System')).toBeDefined();
  });

  it('allows deleting a custom system', () => {
    presetManager.saveSystem({
      id: 'custom_to_delete',
      name: 'Temporary System',
      shortFormula: presetManager.getFormula('single_snare')!,
      longFormula: presetManager.getFormula('single_kick')!,
    });

    render(
      <PresetManager
        open={true}
        onClose={mockOnClose}
        presetManager={presetManager}
        activeSystemId="classic_bop"
        onSelectSystem={mockOnSelectSystem}
        player={mockPlayer}
      />
    );

    expect(screen.getByText('Temporary System')).toBeInTheDocument();
    const deleteBtn = screen.getByTestId('delete-system-custom_to_delete');
    fireEvent.click(deleteBtn);

    expect(presetManager.getSystem('custom_to_delete')).toBeUndefined();
  });
});
