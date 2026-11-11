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
      ostinatoId: 'jazz_swing',
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
