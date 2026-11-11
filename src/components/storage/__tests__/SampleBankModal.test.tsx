import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SampleBankModal } from '../SampleBankModal';
import { StorageManager } from '../../../storage/StorageManager';
import { InMemoryStorageAdapter } from '../../../storage/InMemoryStorageAdapter';
import { ToneTransportScheduler } from '../../../audio/ToneTransportScheduler';

describe('SampleBankModal', () => {
  let storageManager: StorageManager;
  let scheduler: ToneTransportScheduler;
  let onClose: () => void;

  beforeEach(async () => {
    const memoryAdapter = new InMemoryStorageAdapter();
    storageManager = new StorageManager({ defaultAdapter: memoryAdapter });
    await storageManager.init();

    scheduler = new ToneTransportScheduler({ storageManager });
    onClose = vi.fn();
  });

  it('renders the modal entirely through token roles (one style)', async () => {
    render(
      <SampleBankModal
        isOpen={true}
        onClose={onClose}
        storageManager={storageManager}
        scheduler={scheduler}
      />
    );

    const classTokens = () => {
      const tokens = new Set<string>();
      for (const el of document.body.querySelectorAll('*')) {
        for (const token of (el.getAttribute('class') ?? '').split(/\s+/)) tokens.add(token);
      }
      return tokens;
    };

    // Shared Modal Scrim + Accent iconography
    let tokens = classTokens();
    expect(tokens.has('modal-scrim')).toBe(true);
    expect(tokens.has('text-primary')).toBe(true);
    // Reset affordance is Destructive by meaning
    expect(tokens.has('hover:text-destructive')).toBe(true);

    // Uploading a sample paints Success notification + Custom Sample badge tokens
    const file = new File(['mock-audio-bytes'], 'token_kick.wav', { type: 'audio/wav' });
    const kickInput = screen.getByTestId('upload-kick') as HTMLInputElement;
    fireEvent.change(kickInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText(/token_kick\.wav/i)).toBeInTheDocument();
    });

    tokens = classTokens();
    expect(tokens.has('bg-success/10')).toBe(true);
    expect(tokens.has('border-success/30')).toBe(true);
    expect(tokens.has('text-success')).toBe(true);
    expect(tokens.has('bg-primary/20')).toBe(true);

    // No raw palette classes, scrim literals, or dark: variants survive
    const rawPalette = /(?:teal|rose|emerald|amber|purple|slate)-\d|bg-(?:white|black)|text-white|dark:|rgba\(|rounded(?!-none)/;
    for (const el of document.body.querySelectorAll('*')) {
      expect(rawPalette.test(el.getAttribute('class') ?? '')).toBe(false);
    }
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SampleBankModal
        isOpen={false}
        onClose={onClose}
        storageManager={storageManager}
        scheduler={scheduler}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders drum voices and metronome sounds when isOpen is true', () => {
    render(
      <SampleBankModal
        isOpen={true}
        onClose={onClose}
        storageManager={storageManager}
        scheduler={scheduler}
      />
    );

    // Modal title
    expect(screen.getByText(/Sample Bank & Storage/i)).toBeInTheDocument();

    // Drum voices present
    expect(screen.getByText('Kick Drum')).toBeInTheDocument();
    expect(screen.getByText('Snare Drum')).toBeInTheDocument();
    expect(screen.getByText('Ride Cymbal')).toBeInTheDocument();

    // Metronome voices present
    expect(screen.getByText('Downbeat Click')).toBeInTheDocument();
    expect(screen.getByText('Upbeat / Regular Click')).toBeInTheDocument();
  });

  it('allows auditioning a voice', () => {
    const auditionSpy = vi.spyOn(scheduler, 'auditionVoice').mockImplementation(() => {});

    render(
      <SampleBankModal
        isOpen={true}
        onClose={onClose}
        storageManager={storageManager}
        scheduler={scheduler}
      />
    );

    // Click audition button for Kick
    const auditionButtons = screen.getAllByRole('button', { name: /audition/i });
    expect(auditionButtons.length).toBeGreaterThan(0);
    fireEvent.click(auditionButtons[0]);

    expect(auditionSpy).toHaveBeenCalled();
  });

  it('handles uploading a custom audio file and resetting it', async () => {
    render(
      <SampleBankModal
        isOpen={true}
        onClose={onClose}
        storageManager={storageManager}
        scheduler={scheduler}
      />
    );

    const file = new File(['mock-audio-bytes'], 'punchy_kick.wav', { type: 'audio/wav' });

    const kickInput = screen.getByTestId('upload-kick') as HTMLInputElement;
    fireEvent.change(kickInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/punchy_kick\.wav/i)).toBeInTheDocument();
    });

    // Reset button should now be enabled and active
    const resetKickButton = screen.getByTestId('reset-kick');
    fireEvent.click(resetKickButton);

    await waitFor(() => {
      expect(screen.queryByText(/punchy_kick\.wav/i)).not.toBeInTheDocument();
    });
  });

  it('triggers export library archive generation', async () => {
    const exportSpy = vi.spyOn(storageManager, 'exportArchive').mockResolvedValue(new Blob(['dummy-zip']));

    // Mock URL.createObjectURL and URL.revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();

    render(
      <SampleBankModal
        isOpen={true}
        onClose={onClose}
        storageManager={storageManager}
        scheduler={scheduler}
      />
    );

    const exportBtn = screen.getByRole('button', { name: /export library/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalled();
    });
  });

  it('triggers link local directory if supported', async () => {
    vi.spyOn(storageManager, 'isFileSystemAccessSupported').mockReturnValue(true);
    const linkSpy = vi.spyOn(storageManager, 'linkLocalDirectory').mockResolvedValue(true);

    render(
      <SampleBankModal
        isOpen={true}
        onClose={onClose}
        storageManager={storageManager}
        scheduler={scheduler}
      />
    );

    const linkBtn = screen.getByRole('button', { name: /link local folder/i });
    fireEvent.click(linkBtn);

    await waitFor(() => {
      expect(linkSpy).toHaveBeenCalled();
    });
  });
});
