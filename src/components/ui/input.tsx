import * as React from 'react';
import { cn } from '@/components/lib/utils';

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-md border border-broker-surface bg-broker-panel px-3 py-2 text-broker-text ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-broker-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broker-green focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
