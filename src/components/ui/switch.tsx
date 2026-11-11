import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/components/lib/utils';

/**
 * shadcn/ui Switch — Radix-based toggle styled with the broker terminal
 * palette (`border-broker-surface`, `bg-broker-panel`, `bg-broker-green`).
 *
 * Used on the Profile screen for the notifications toggle. All other
 * interactive shadcn primitives in this codebase follow the same pattern.
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-[20px] w-[34px] shrink-0 cursor-pointer items-center rounded-full border border-broker-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broker-green focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:bg-broker-green data-[state=unchecked]:bg-broker-panel',
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-broker-text shadow ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0'
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
