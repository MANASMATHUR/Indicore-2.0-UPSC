'use client';

import { cn } from '@/lib/utils';

/**
 * Premium Badge Component
 * Professional badges for status, categories, tags, etc.
 */
export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}) {
  const variants = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    primary: 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-sm',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    outline: 'border-2 border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-3 py-1',
    lg: 'text-sm px-4 py-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wider transition-all duration-200',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Dot Indicator for live status
 */
export function DotIndicator({ variant = 'default', pulse = true, className = '' }) {
  const variants = {
    default: 'bg-gray-400',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full',
        variants[variant],
        pulse && 'animate-pulse',
        className
      )}
    />
  );
}

/**
 * Professional Divider
 */
export function Divider({
  orientation = 'horizontal',
  className = '',
  gradient = false
}) {
  if (orientation === 'vertical') {
    return (
      <div
        className={cn(
          'w-px h-full',
          gradient
            ? 'bg-gradient-to-b from-transparent via-gray-300 to-transparent'
            : 'bg-gray-300 dark:bg-gray-700',
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'h-px w-full',
        gradient
          ? 'bg-gradient-to-r from-transparent via-gray-300 to-transparent'
          : 'bg-gray-300 dark:bg-gray-700',
        className
      )}
    />
  );
}

/**
 * Professional Section Container
 */
export function Section({
  children,
  className = '',
  gradient = false,
  ...props
}) {
  return (
    <section
      className={cn(
        'py-16 sm:py-20',
        gradient && 'gradient-mesh',
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}

/**
 * Container with Premium Styling
 */
export function Container({
  children,
  size = 'default',
  className = '',
  ...props
}) {
  const sizes = {
    sm: 'max-w-3xl',
    default: 'max-w-7xl',
    lg: 'max-w-[1400px]',
    full: 'max-w-full',
  };

  return (
    <div
      className={cn(
        'mx-auto px-4 sm:px-6 lg:px-8',
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Professional Gradient Text
 */
export function GradientText({ children, className = '', ...props }) {
  return (
    <span
      className={cn(
        'bg-gradient-to-r from-red-600 via-orange-600 to-red-600 bg-clip-text text-transparent',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
