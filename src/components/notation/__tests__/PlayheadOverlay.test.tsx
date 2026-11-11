import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayheadOverlay } from '../PlayheadOverlay';
import { PlayheadPosition, MeasureCoordinate } from '../../../notation/types';

describe('PlayheadOverlay', () => {
  const mockPosition: PlayheadPosition = {
    x: 120,
    y: 30,
    height: 80,
    systemIndex: 0,
    measureIndex: 1,
    beatOffset: 2.0,
  };

  const mockMeasure: MeasureCoordinate = {
    measureIndex: 1,
    systemIndex: 0,
    measureInSystem: 1,
    x: 100,
    y: 25,
    width: 200,
    height: 90,
    noteStartX: 110,
    noteEndX: 290,
    eventCoordinates: [],
  };

  it('renders nothing or is hidden when isVisible is false', () => {
    render(
      <PlayheadOverlay position={mockPosition} isVisible={false} />
    );
    expect(screen.queryByTestId('playhead-cursor')).toBeNull();
  });

  it('renders nothing when position is null', () => {
    render(
      <PlayheadOverlay position={null} isVisible={true} />
    );
    expect(screen.queryByTestId('playhead-cursor')).toBeNull();
  });

  it('renders the notation Playhead as Accent with the shared glow utility', () => {
    render(
      <PlayheadOverlay
        position={mockPosition}
        activeMeasure={mockMeasure}
        isVisible={true}
        showMeasureHighlight={true}
      />
    );

    const cursor = screen.getByTestId('playhead-cursor');
    expect(cursor).toHaveClass('bg-primary');
    expect(cursor).toHaveClass('playhead-glow');
    expect(cursor).toHaveClass('rounded-none');
    const highlight = screen.getByTestId('measure-highlight');
    expect(highlight).toHaveClass('bg-primary/10');
    expect(highlight).toHaveClass('border-primary/30');

    for (const el of document.body.querySelectorAll('*')) {
      expect(
        /(?:teal|rose|emerald|amber|purple|slate)-\d|bg-(?:white|black)|text-white|dark:|rgba\(|rounded(?!-none)/.test(
          el.getAttribute('class') ?? ''
        )
      ).toBe(false);
    }
  });

  it('renders cursor line at specified coordinates when visible', () => {
    render(
      <PlayheadOverlay position={mockPosition} isVisible={true} />
    );
    const cursor = screen.getByTestId('playhead-cursor');
    expect(cursor).toBeInTheDocument();
    expect(cursor.style.left).toBe('120px');
    expect(cursor.style.top).toBe('30px');
    expect(cursor.style.height).toBe('80px');
  });

  it('renders active measure highlight when activeMeasure is provided', () => {
    render(
      <PlayheadOverlay
        position={mockPosition}
        activeMeasure={mockMeasure}
        isVisible={true}
        showMeasureHighlight={true}
      />
    );
    const highlight = screen.getByTestId('measure-highlight');
    expect(highlight).toBeInTheDocument();
    expect(highlight.style.left).toBe('100px');
    expect(highlight.style.top).toBe('25px');
    expect(highlight.style.width).toBe('200px');
  });
});
