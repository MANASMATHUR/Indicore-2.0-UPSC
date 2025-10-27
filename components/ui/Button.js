'use client';

import { forwardRef } from 'react';

const Button = forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  disabled = false, 
  loading = false,
  className = '',
  onClick,
  type = 'button',
  ...props 
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 focus-visible:ring-4';
  
  const variants = {
    primary: 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 focus:ring-red-500 shadow-md hover:shadow-lg hover:scale-105 dark:from-red-600 dark:to-red-700 dark:hover:from-red-700 dark:hover:to-red-800',
    secondary: 'bg-white/90 text-gray-700 border border-gray-300/50 hover:bg-gray-50 focus:ring-gray-500 shadow-sm hover:shadow-md backdrop-blur-sm dark:bg-slate-800/90 dark:text-gray-200 dark:border-slate-600/50 dark:hover:bg-slate-700/90 dark:focus:ring-slate-500',
    danger: 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 focus:ring-red-500 shadow-md hover:shadow-lg dark:from-red-700 dark:to-red-800 dark:hover:from-red-800 dark:hover:to-red-900',
    ghost: 'text-gray-600 hover:text-gray-800 hover:bg-gray-100/80 focus:ring-gray-500 backdrop-blur-sm dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-slate-700/80 dark:focus:ring-slate-500',
    icon: 'p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100/80 rounded-xl transition-all duration-200 hover:scale-105 backdrop-blur-sm dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-slate-700/80'
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'p-2.5'
  };

  const variantStyles = variants[variant] || variants.primary;
  const sizeStyles = sizes[size] || sizes.md;

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
