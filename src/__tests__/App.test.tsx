import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  beforeEach(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  });

  it('keeps the shell text-selection style on token roles', () => {
    render(<App />);

    const main = screen.getByRole('main');
    expect(main).toHaveClass('selection:bg-accent');
    expect(main).toHaveClass('selection:text-accent-foreground');

    for (const el of document.body.querySelectorAll('*')) {
      expect(
        /(?:teal|rose|emerald|amber|purple|slate)-\d|bg-(?:white|black)|text-white|dark:|rgba\(|rounded(?!-none)/.test(
          el.getAttribute('class') ?? ''
        )
      ).toBe(false);
    }
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
    expect(screen.getByText(/^Alan Dawson Orchestration$/)).toBeInTheDocument();
    expect(screen.getByText(/Classic Bop/i)).toBeInTheDocument();
    expect(screen.getByText(/Inverted Bop/i)).toBeInTheDocument();
    // The Real-Time Drum Monitor is gone from the dashboard.
    for (const pad of ['drum-pad-kick', 'drum-pad-snare', 'drum-pad-ride', 'drum-pad-hihat']) {
      expect(screen.queryByTestId(pad)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/Real-Time Drum Monitor/i)).not.toBeInTheDocument();
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

    for (const label of [
      'Downbeat Volume',
      'Regular Volume',
      'Subdivision Volume',
      'Subdivision Divisions',
      'Ostinato Volume',
      'Orchestrated Line Volume',
    ]) {
      expect(screen.getAllByLabelText(label)).toHaveLength(1);
    }
    for (const channel of ['Downbeat', 'Regular', 'Subdivision', 'Ostinato', 'Orchestrated Line']) {
      expect(screen.getAllByRole('button', { name: `Mute ${channel}` })).toHaveLength(1);
    }
    expect(screen.queryByTestId('mixer-row-click')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Click Volume')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mute Click' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Master Volume')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mixer-preset-row')).not.toBeInTheDocument();

    // The Metronome panel holds no loudness control of its own (ticket 06).
    expect(screen.queryByLabelText('Volume')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Toggle mute' })).not.toBeInTheDocument();
  });

  it('renders Reading View unconditionally without view mode toggle buttons', () => {
    render(<App />);

    expect(screen.getByTestId('reading-view-root')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /drum staff/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reading view/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('drum-staff-view-root')).not.toBeInTheDocument();
  });
});
