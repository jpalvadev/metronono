import * as React from 'react';
import { cn } from '../../lib/utils';

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, min, max, step = 1, onChange, ariaLabel, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    };

    return (
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        aria-label={ariaLabel}
        className={cn(
          'w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-1 focus:ring-ring',
          className
        )}
        {...props}
      />
    );
  }
);
Slider.displayName = 'Slider';
