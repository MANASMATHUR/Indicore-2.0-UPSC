'use client';

/**
 * Enhanced loading spinner with multiple variants
 * @param {string} variant - 'spinner' | 'dots' | 'pulse' | 'ring'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {string} text - Optional loading text
 */
export default function LoadingSpinner({
  variant = 'spinner',
  size = 'md',
  text = 'Loading Indicore',
  fullScreen = true
}) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  const dotSizes = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`${dotSizes[size]} bg-red-600 rounded-full animate-bounce`}
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        );

      case 'pulse':
        return (
          <div className="relative">
            <div className={`${sizeClasses[size]} bg-red-600 rounded-full animate-ping absolute`} />
            <div className={`${sizeClasses[size]} bg-red-600 rounded-full relative`} />
          </div>
        );

      case 'ring':
        return (
          <div className="relative">
            <div className={`${sizeClasses[size]} border-4 border-red-200 rounded-full`} />
            <div className={`${sizeClasses[size]} border-4 border-red-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0`} />
          </div>
        );

      default: // spinner
        return (
          <div className={`${sizeClasses[size]} animate-spin rounded-full border-b-4 border-red-600`} />
        );
    }
  };

  const content = (
    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl text-center space-y-4 max-w-sm mx-4">
      <div className="flex justify-center">
        {renderSpinner()}
      </div>
      {text && (
        <>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{text}</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Please wait while we set up your experience...
          </p>
        </>
      )}
      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-red-600 via-orange-600 to-red-600 animate-loading-progress bg-[length:200%_100%]" />
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-red-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}
