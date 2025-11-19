'use client';

import { cn } from '@/lib/utils';

export function Skeleton({ className }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-gray-200/80 dark:bg-gray-700/70',
        className
      )}
    />
  );
}

export function SkeletonLine({ className }) {
  return (
    <div
      className={cn(
        'h-3 w-full animate-pulse rounded-full bg-gray-200/80 dark:bg-gray-700/70',
        className
      )}
    />
  );
}

