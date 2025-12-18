'use client';

/**
 * Skeleton loader component for content loading states
 * Provides a more engaging loading experience than spinners
 */
export function Skeleton({ className = '', variant = 'default', ...props }) {
  const variants = {
    default: 'bg-gray-200 dark:bg-gray-700',
    text: 'h-4 w-full bg-gray-200 dark:bg-gray-700 rounded',
    title: 'h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded',
    circle: 'rounded-full bg-gray-200 dark:bg-gray-700',
    card: 'h-32 w-full bg-gray-200 dark:bg-gray-700 rounded-lg',
  };

  return (
    <div
      className={`animate-pulse ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

/**
 * Skeleton for chat messages
 */
export function SkeletonChatMessage() {
  return (
    <div className="flex gap-3 p-4">
      <Skeleton variant="circle" className="w-10 h-10" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="title" />
        <Skeleton variant="text" />
        <Skeleton variant="text" className="w-5/6" />
      </div>
    </div>
  );
}

/**
 * Skeleton for cards
 */
export function SkeletonCard() {
  return (
    <div className="border rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" className="w-12 h-12" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="title" className="w-1/2" />
          <Skeleton variant="text" className="w-1/3" />
        </div>
      </div>
      <Skeleton variant="card" />
      <div className="space-y-2">
        <Skeleton variant="text" />
        <Skeleton variant="text" className="w-4/5" />
      </div>
    </div>
  );
}

/**
 * Skeleton for table rows
 */
export function SkeletonTableRow({ columns = 4 }) {
  return (
    <tr className="border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton variant="text" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton for list items
 */
export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 p-3 border-b">
      <Skeleton variant="circle" className="w-8 h-8" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-2/3" />
        <Skeleton variant="text" className="w-1/2" />
      </div>
    </div>
  );
}

/**
 * Skeleton for dashboard stats
 */
export function SkeletonStat() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-3 shadow">
      <Skeleton variant="text" className="w-1/2" />
      <Skeleton className="h-8 w-1/3 rounded" />
      <Skeleton variant="text" className="w-2/3" />
    </div>
  );
}

export default Skeleton;
