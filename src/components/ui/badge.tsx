import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors uppercase',
        {
          'border-transparent bg-teal-500/15 text-teal-400': variant === 'default',
          'border-transparent bg-muted text-muted-foreground': variant === 'secondary',
          'border-border text-foreground': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  );
}
