import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReadingTrainingSection } from '../ReadingTrainingSection';

describe('ReadingTrainingSection', () => {
  beforeEach(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  });

  it('borrows the Status Colors for difficulty tier chips', () => {
    render(<ReadingTrainingSection />);

    const tier1Btn = screen.getByRole('button', { name: /Tier 1/ });
    expect(tier1Btn).toHaveClass('bg-success/40');
    expect(tier1Btn).toHaveClass('text-success');
    expect(tier1Btn).toHaveClass('border-success/40');

    for (const el of document.body.querySelectorAll('*')) {
      expect(
        /(?:teal|rose|emerald|amber|purple|slate)-\d|bg-(?:white|black)|text-white|dark:|rgba\(|rounded(?!-none)/.test(
          el.getAttribute('class') ?? ''
        )
      ).toBe(false);
    }
  });

  it('renders mode switch buttons for Generator and Library', () => {
    render(<ReadingTrainingSection />);

    expect(screen.getByRole('button', { name: /procedural generator/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ted reed library/i })).toBeInTheDocument();
  });

  it('supports selecting different difficulty tiers in generator mode', () => {
    render(<ReadingTrainingSection />);

    const tier2Btn = screen.getByRole('button', { name: /tier 2/i });
    fireEvent.click(tier2Btn);

    expect(screen.getByRole('heading', { name: /tier 2/i })).toBeInTheDocument();
  });

  it('regenerates new procedural exercises on Regenerate button click', () => {
    render(<ReadingTrainingSection />);

    const regenerateBtn = screen.getByRole('button', { name: /regenerate/i });
    expect(regenerateBtn).toBeInTheDocument();
    fireEvent.click(regenerateBtn);

    // Reading view root is rendered with pattern
    expect(screen.getByTestId('reading-view-root')).toBeInTheDocument();
  });

  it('switches to Ted Reed Library mode and loads classic exercises', () => {
    render(<ReadingTrainingSection />);

    // Click Ted Reed Library mode
    const libraryTabBtn = screen.getByRole('button', { name: /ted reed library/i });
    fireEvent.click(libraryTabBtn);

    // Verify Page selector buttons are visible
    expect(screen.getByRole('button', { name: /page 37/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /page 38/i })).toBeInTheDocument();

    // Select Page 37 (Exercise One)
    const page37Btn = screen.getByRole('button', { name: /page 37/i });
    fireEvent.click(page37Btn);

    expect(screen.getByRole('heading', { name: /Page 37 \(Exercise One\)/i })).toBeInTheDocument();
    expect(screen.getByText(/32/i)).toBeInTheDocument(); // 32 measures
  });

  it('loads Page 38 Exercise Two when selected', () => {
    render(<ReadingTrainingSection />);

    const libraryTabBtn = screen.getByRole('button', { name: /ted reed library/i });
    fireEvent.click(libraryTabBtn);

    const page38Btn = screen.getByRole('button', { name: /page 38/i });
    fireEvent.click(page38Btn);

    expect(screen.getByRole('heading', { name: /Page 38 \(Exercise Two\)/i })).toBeInTheDocument();
  });
});
