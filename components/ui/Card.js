'use client';

import { cn } from '@/lib/utils';

/**
 * Enhanced Card component with hover effects and variants
 */
export function Card({
  className = '',
  children,
  variant = 'default',
  hoverable = false,
  ...props
}) {
  const variants = {
    default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/50 shadow-sm',
    elevated: 'bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-300',
    gradient: 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-800 dark:to-gray-900 border border-red-100 dark:border-gray-700/50',
    glass: 'bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg border border-white/30 dark:border-white/10 shadow-lg',
  };

  const hoverClass = hoverable
    ? 'transition-all duration-300 hover:scale-[1.02] hover:shadow-xl cursor-pointer'
    : '';

  return (
    <div
      className={cn(
        'rounded-lg p-6',
        variants[variant],
        hoverClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card Header
 */
export function CardHeader({ className = '', children, ...props }) {
  return (
    <div className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Card Title
 */
export function CardTitle({ className = '', children, ...props }) {
  return (
    <h3 className={cn('text-lg font-semibold text-gray-900 dark:text-gray-100', className)} {...props}>
      {children}
    </h3>
  );
}

/**
 * Card Description
 */
export function CardDescription({ className = '', children, ...props }) {
  return (
    <p className={cn('text-sm text-gray-600 dark:text-gray-400', className)} {...props}>
      {children}
    </p>
  );
}

/**
 * Card Content
 */
export function CardContent({ className = '', children, ...props }) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Card Footer
 */
export function CardFooter({ className = '', children, ...props }) {
  return (
    <div className={cn('mt-4 pt-4 border-t border-gray-200 dark:border-gray-700', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Stats Card with icon and trend
 */
export function StatsCard({
  title,
  value,
  icon,
  trend = null,
  trendUp = true,
  className = ''
}) {
  return (
    <Card variant="elevated" className={cn('', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">{value}</h3>
          {trend && (
            <div className={cn(
              'flex items-center gap-1 mt-2 text-sm',
              trendUp ? 'text-green-600' : 'text-red-600'
            )}>
              {trendUp ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" />
                </svg>
              )}
              <span>{trend}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export default Card;
