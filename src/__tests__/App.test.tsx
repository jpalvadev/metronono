import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  beforeEach(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  });

  it('renders metronome title, click controls, and reading training section', () => {
    render(<App />);
    expect(screen.getByText('METRONONO')).toBeInTheDocument();
    expect(screen.getByText(/Smart Drum Metronome/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();

    // Reading Training Section
    expect(screen.getByText(/Single-Line Reading Training/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /procedural generator/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ted reed library/i })).toBeInTheDocument();
    expect(screen.getByTestId('reading-view-root')).toBeInTheDocument();

    // Alan Dawson Orchestration Section
    expect(screen.getByText(/Alan Dawson Orchestration & Drum Monitor/i)).toBeInTheDocument();
    expect(screen.getByText(/Classic Bop/i)).toBeInTheDocument();
    expect(screen.getByText(/Inverted Bop/i)).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-kick')).toBeInTheDocument();
    expect(screen.getByTestId('drum-pad-snare')).toBeInTheDocument();
  });

  it('mounts the Mixer Panel directly below the Metronome panel', () => {
    render(<App />);

    const mixerPanel = screen.getByRole('heading', { name: /Mixer Panel/i });
    const metronomePanel = screen.getByText(/Smart Drum Metronome/i);
    const orchestrationSection = screen.getByRole('heading', { name: /Alan Dawson Orchestration/i });

    expect(mixerPanel).toBeInTheDocument();
    // The Mixer Panel sits after the Metronome panel and before the orchestration section.
    expect(mixerPanel.compareDocumentPosition(metronomePanel) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(mixerPanel.compareDocumentPosition(orchestrationSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('exposes the mixing-channel loudness controls exactly once, in the Mixer Panel', () => {
    render(<App />);

    for (const label of ['Master Volume', 'Click Volume', 'Ostinato Volume', 'Orchestrated Line Volume']) {
      expect(screen.getAllByLabelText(label)).toHaveLength(1);
    }
    for (const channel of ['Click', 'Ostinato', 'Orchestrated Line']) {
      expect(screen.getAllByRole('button', { name: `Mute ${channel}` })).toHaveLength(1);
    }
    expect(screen.getByTestId('mixer-preset-row')).toBeInTheDocument();
  });

  it('switches between 1-line Reading View and 5-line Drum Staff View via View Mode toggle', () => {
    render(<App />);

    expect(screen.getByTestId('reading-view-root')).toBeInTheDocument();

    // Click Drum Staff View toggle
    const drumStaffToggle = screen.getByRole('button', { name: /drum staff/i });
    expect(drumStaffToggle).toBeInTheDocument();
    fireEvent.click(drumStaffToggle);

    // 5-line drum staff view should be rendered
    expect(screen.getByTestId('drum-staff-view-root')).toBeInTheDocument();
    expect(screen.getByTestId('drum-score-container')).toBeInTheDocument();

    // Click Reading View toggle back
    const readingToggle = screen.getByRole('button', { name: /reading view/i });
    fireEvent.click(readingToggle);

    expect(screen.getByTestId('reading-view-root')).toBeInTheDocument();
  });
});
