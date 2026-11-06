import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('renders metronome title and metronome shell', () => {
    render(<App />);
    expect(screen.getByText('METRONONO')).toBeInTheDocument();
    expect(screen.getByText(/Smart Drum Metronome/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });
});
