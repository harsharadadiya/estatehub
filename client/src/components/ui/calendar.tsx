// shadcn/ui Calendar built on react-day-picker
import type { ComponentProps } from 'react';
import { DayPicker } from 'react-day-picker';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function Calendar({ className, classNames, showOutsideDays = false, ...props }: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-1', className)}
      classNames={{
        root: 'w-fit',
        months: 'relative flex flex-col gap-4',
        month: 'flex w-full flex-col gap-3',
        nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
        button_previous: 'z-10 inline-flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-muted disabled:cursor-default disabled:opacity-30',
        button_next: 'z-10 inline-flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-muted disabled:cursor-default disabled:opacity-30',
        month_caption: 'flex h-8 items-center justify-center',
        caption_label: 'text-sm font-bold',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 text-xs font-medium text-muted-foreground',
        week: 'mt-1 flex w-full',
        day: 'size-9 p-0 text-center text-sm',
        day_button: 'size-9 cursor-pointer rounded-md font-medium tabular hover:bg-muted disabled:cursor-not-allowed disabled:hover:bg-transparent',
        selected: '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary',
        today: '[&>button]:font-extrabold [&>button]:underline [&>button]:underline-offset-4',
        outside: 'opacity-40',
        disabled: 'text-muted-foreground/45',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClass }) =>
          orientation === 'left' ? <ChevronLeftIcon className={cn('size-4', chevronClass)} /> : <ChevronRightIcon className={cn('size-4', chevronClass)} />,
      }}
      {...props}
    />
  );
}

export { Calendar };
