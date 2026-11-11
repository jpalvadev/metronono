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
          'inline-flex items-center justify-center rounded-none text-xs font-medium transition-all duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-[1px] select-none',
          {
            'bg-primary text-primary-foreground shadow-xs hover:bg-primary/80':
              variant === 'default',
            'bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-border':
              variant === 'secondary',
            'border border-border bg-transparent text-foreground hover:bg-secondary/50':
              variant === 'outline',
            'hover:bg-secondary/50 text-muted-foreground hover:text-foreground':
              variant === 'ghost',
            'bg-destructive/20 text-destructive border border-destructive/40 hover:bg-destructive/30':
              variant === 'destructive',
            'text-accent underline-offset-4 hover:underline':
              variant === 'link',
          },
          {
            'h-8 px-3': size === 'default',
            'h-7 px-2.5 text-[11px]': size === 'sm',
            'h-9 px-4 text-xs font-semibold': size === 'lg',
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
