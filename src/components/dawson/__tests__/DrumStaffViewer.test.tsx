import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DrumStaffViewer } from '../DrumStaffViewer';
import { FACTORY_OSTINATOS } from '../../../domain/dawson/SubdivisionFormula';

describe('DrumStaffViewer Component', () => {
  it('renders a 4/4 ostinato pattern on a 5-line stave in read-only mode', () => {
    const { container } = render(
      <DrumStaffViewer
        strokes={FACTORY_OSTINATOS.jazz_swing.strokes}
        targetBeats={4}
      />
    );

    // Stave SVG should be rendered with graphical elements (clefs, stave lines, notes)
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelectorAll('rect, path').length).toBeGreaterThan(5);
    // Silence badge should not be present
    expect(screen.queryByText(/Silencio/i)).not.toBeInTheDocument();
  });

  it('renders a full rest stave with a Silencio badge when isSilenced is true', () => {
    const { container } = render(
      <DrumStaffViewer
        isSilenced={true}
        targetBeats={4}
      />
    );

    // Stave SVG should still be rendered (clean rest measure)
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelectorAll('rect, path').length).toBeGreaterThan(0);
    // Silence badge is visible
    expect(screen.getByText('Silencio')).toBeInTheDocument();
  });

  it('renders a full rest stave with a Silencio badge when strokes is empty', () => {
    const { container } = render(
      <DrumStaffViewer
        strokes={[]}
        targetBeats={4}
      />
    );

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('Silencio')).toBeInTheDocument();
  });

  it('applies one-style token roles and supports custom className', () => {
    const { container } = render(
      <DrumStaffViewer
        isSilenced={true}
        className="test-custom-viewer"
      />
    );

    const root = container.firstElementChild;
    expect(root).toHaveClass('test-custom-viewer');
  });
});
