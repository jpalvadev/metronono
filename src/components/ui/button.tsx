import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md text-xs md:text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none',
          {
            'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90':
              variant === 'default',
            'bg-secondary text-secondary-foreground hover:bg-secondary/80':
              variant === 'secondary',
            'border border-border bg-card/60 text-foreground hover:bg-muted/50':
              variant === 'outline',
            'hover:bg-muted/50 text-foreground':
              variant === 'ghost',
            'bg-destructive text-destructive-foreground hover:bg-destructive/90':
              variant === 'destructive',
            'text-primary underline-offset-4 hover:underline':
              variant === 'link',
          },
          {
            'h-9 px-4 py-2': size === 'default',
            'h-7 rounded-md px-2.5 text-xs': size === 'sm',
            'h-11 rounded-lg px-6 text-base font-semibold': size === 'lg',
            'h-8 w-8 p-0': size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
