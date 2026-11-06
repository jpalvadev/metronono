import React from 'react';
import { PlayheadPosition, MeasureCoordinate } from '../../notation/types';
import { cn } from '../../lib/utils';

export interface PlayheadOverlayProps {
  position: PlayheadPosition | null;
  activeMeasure?: MeasureCoordinate;
  isVisible: boolean;
  showMeasureHighlight?: boolean;
  className?: string;
}

export const PlayheadOverlay: React.FC<PlayheadOverlayProps> = ({
  position,
  activeMeasure,
  isVisible,
  showMeasureHighlight = true,
  className,
}) => {
  if (!isVisible || !position) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none overflow-visible',
        className
      )}
    >
      {/* Optional subtle active measure bounding box */}
      {showMeasureHighlight && activeMeasure && (
        <div
          data-testid="measure-highlight"
          className="absolute rounded border border-teal-500/30 bg-teal-500/10 pointer-events-none transition-all duration-100 ease-out"
          style={{
            left: `${activeMeasure.x}px`,
            top: `${activeMeasure.y}px`,
            width: `${activeMeasure.width}px`,
            height: `${activeMeasure.height}px`,
          }}
        />
      )}

      {/* Vertical playhead cursor line */}
      <div
        data-testid="playhead-cursor"
        className="absolute pointer-events-none w-1 -ml-0.5 rounded-full bg-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.9)] z-20"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          height: `${position.height}px`,
        }}
      >
        {/* Top locator diamond */}
        <div className="absolute -top-1.5 -left-1 w-3 h-3 bg-teal-300 rotate-45 rounded-[1px] shadow-sm" />
      </div>
    </div>
  );
};
