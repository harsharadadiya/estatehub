import type { ComponentProps } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

const Popover = (props: ComponentProps<typeof PopoverPrimitive.Root>) => <PopoverPrimitive.Root {...props} />;
const PopoverTrigger = (props: ComponentProps<typeof PopoverPrimitive.Trigger>) => <PopoverPrimitive.Trigger {...props} />;

function PopoverContent({ className, align = 'center', sideOffset = 8, ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[1200] rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl outline-none',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
