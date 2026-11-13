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
  ({ className, value, min, max, step = 1, onChange, ariaLabel, disabled, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
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
        disabled={disabled}
        onChange={handleChange}
        aria-label={ariaLabel}
        className={cn(
          'w-full lyra-slider block',
          disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
          className
        )}
        {...props}
      />
    );
  }
);
Slider.displayName = 'Slider';
