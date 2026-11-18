import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combines class names and resolves Tailwind conflicts: cn('px-2', big && 'px-4') -> 'px-4' */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
