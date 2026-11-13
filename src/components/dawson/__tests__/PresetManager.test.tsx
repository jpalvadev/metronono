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

  describe('Ostinatos Tab & Factory Protection', () => {
    it('displays 3 tabs (Sistemas, Fórmulas, Ostinatos) and navigates to Ostinatos tab', () => {
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

      const sistemasTab = screen.getByRole('button', { name: /Sistemas/i });
      const formulasTab = screen.getByRole('button', { name: /Fórmulas/i });
      const ostinatosTab = screen.getByRole('button', { name: /Ostinatos/i });

      expect(sistemasTab).toBeInTheDocument();
      expect(formulasTab).toBeInTheDocument();
      expect(ostinatosTab).toBeInTheDocument();

      // Navigate to Ostinatos tab
      fireEvent.click(ostinatosTab);

      // Verify factory ostinatos are listed with factory badges
      expect(screen.getByText('Jazz Swing')).toBeInTheDocument();
      expect(screen.getByText('Corcheas en Hi-Hat')).toBeInTheDocument();
      expect(screen.getAllByText(/Built-in|Fábrica/i).length).toBeGreaterThanOrEqual(2);
    });

    it('disables deletion for factory ostinatos and allows deletion for custom ostinatos', () => {
      presetManager.saveOstinato({
        id: 'user_songo',
        name: 'User Songo',
        timeSignature: [4, 4],
        strokes: [{ durationRatio: 1.0, hits: [{ voice: 'kick', dynamic: 'normal' }] }],
        isCustom: true,
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

      const ostinatosTab = screen.getByRole('button', { name: /Ostinatos/i });
      fireEvent.click(ostinatosTab);

      // Factory ostinato delete button should not be present or should be disabled
      const deleteJazzBtn = screen.queryByTestId('delete-ostinato-jazz_swing');
      if (deleteJazzBtn) {
        expect(deleteJazzBtn).toBeDisabled();
      } else {
        expect(deleteJazzBtn).toBeNull();
      }

      // Custom ostinato can be deleted
      const deleteCustomBtn = screen.getByTestId('delete-ostinato-user_songo');
      expect(deleteCustomBtn).toBeEnabled();
      fireEvent.click(deleteCustomBtn);

      expect(presetManager.getOstinato('user_songo')).toBeUndefined();
    });

    it('opens 4/4 editor when clicking Nuevo Ostinato', () => {
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

      const ostinatosTab = screen.getByRole('button', { name: /Ostinatos/i });
      fireEvent.click(ostinatosTab);

      const newOstinatoBtn = screen.getByRole('button', { name: /Nuevo Ostinato|New Ostinato/i });
      fireEvent.click(newOstinatoBtn);

      // Dialog opens
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('protects factory presets by cloning as (Copia) when editing a built-in preset', () => {
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

      const ostinatosTab = screen.getByRole('button', { name: /Ostinatos/i });
      fireEvent.click(ostinatosTab);

      // Click Editar on factory Jazz Swing
      const editJazzBtn = screen.getByTestId('edit-ostinato-jazz_swing');
      fireEvent.click(editJazzBtn);

      // Click Save in editor dialog
      const saveBtn = screen.getByRole('button', { name: /Save Formula|Guardar/i });
      fireEvent.click(saveBtn);

      // Original factory preset remains untouched
      expect(presetManager.getOstinato('jazz_swing')).toBeDefined();
      expect(presetManager.getOstinato('jazz_swing')?.isCustom).not.toBe(true);

      // A new copy with (Copia) was saved
      const allOstinatos = presetManager.getAllOstinatos();
      const copied = allOstinatos.find((o) => o.name.includes('(Copia)'));
      expect(copied).toBeDefined();
      expect(copied?.isCustom).toBe(true);
    });

    it('allows duplicating an ostinato directly via Duplicate action', () => {
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

      const ostinatosTab = screen.getByRole('button', { name: /Ostinatos/i });
      fireEvent.click(ostinatosTab);

      const dupBtn = screen.getByTestId('duplicate-ostinato-jazz_swing');
      fireEvent.click(dupBtn);

      const allOstinatos = presetManager.getAllOstinatos();
      const duplicated = allOstinatos.find((o) => o.name === 'Jazz Swing (Copia)');
      expect(duplicated).toBeDefined();
      expect(duplicated?.isCustom).toBe(true);
    });
  });

  describe('Formulas Tab Defensive Rendering', () => {
    it('renders formulas without crashing when a stroke has missing or empty hits', () => {
      presetManager.saveFormula({
        id: 'corrupt_short',
        name: 'Corrupt Short Formula',
        trigger: 'short',
        strokes: [
          { durationRatio: 0.25 } as unknown as { durationRatio: number; hits: [] },
          { durationRatio: 0.25, hits: [{ voice: 'snare', dynamic: 'normal' }] },
        ],
      });
      presetManager.saveFormula({
        id: 'corrupt_long',
        name: 'Corrupt Long Formula',
        trigger: 'long',
        strokes: [
          { durationRatio: 0.5 } as unknown as { durationRatio: number; hits: [] },
          { durationRatio: 0.5, hits: [] },
        ],
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

      const formulasTab = screen.getByRole('button', { name: /Formulas/i });
      fireEvent.click(formulasTab);

      expect(screen.getByText('Corrupt Short Formula')).toBeInTheDocument();
      expect(screen.getByText('Corrupt Long Formula')).toBeInTheDocument();
      expect(screen.getAllByText('rest').length).toBeGreaterThanOrEqual(3);
    });
  });
});
