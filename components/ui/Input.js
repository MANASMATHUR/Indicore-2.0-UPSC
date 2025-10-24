'use client';

import { forwardRef } from 'react';

const Input = forwardRef(({ 
  label,
  error,
  helperText,
  className = '',
  ...props 
}, ref) => {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`
          w-full px-4 py-3 border rounded-xl 
          text-sm placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500
          disabled:opacity-50 disabled:cursor-not-allowed
          bg-white/90 dark:bg-gray-800/90 
          border-gray-300/50 dark:border-gray-600/50
          text-gray-900 dark:text-gray-100
          transition-all duration-200
          backdrop-blur-sm
          hover:shadow-sm focus:shadow-md
          ${error ? 'border-red-500 focus:ring-red-500/20' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
