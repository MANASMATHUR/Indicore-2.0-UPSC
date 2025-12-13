/**
 * Animated Button Component
 * Premium button with smooth interactions
 */

import { motion } from 'framer-motion';
import { buttonVariants } from '@/lib/animations';

export default function AnimatedButton({
    children,
    variant = 'primary',
    size = 'medium',
    onClick,
    disabled = false,
    loading = false,
    className = '',
    ...props
}) {
    const sizeClasses = {
        small: 'px-4 py-2 text-sm',
        medium: 'px-6 py-3 text-base',
        large: 'px-8 py-4 text-lg'
    };

    const variantClasses = {
        primary: 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800',
        secondary: 'bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800',
        success: 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800',
        danger: 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800',
        outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50',
        ghost: 'text-blue-600 hover:bg-blue-50'
    };

    return (
        <motion.button
            className={`
        animated-button
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
        font-medium rounded-lg
        transition-all duration-200
        shadow-md hover:shadow-lg
        flex items-center justify-center gap-2
        relative overflow-hidden
      `}
            variants={buttonVariants}
            initial="rest"
            whileHover={!disabled && !loading ? "hover" : "rest"}
            whileTap={!disabled && !loading ? "tap" : "rest"}
            onClick={!disabled && !loading ? onClick : undefined}
            disabled={disabled || loading}
            {...props}
        >
            {loading && (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            )}

            {children}

            {/* Ripple effect  */}
            <span className="absolute inset-0 overflow-hidden rounded-lg">
                <span className="ripple-effect"></span>
            </span>

            <style jsx>{`
        .ripple-effect {
          position: absolute;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .animated-button:active .ripple-effect {
          animation: ripple 0.6s ease-out;
        }

        @keyframes ripple {
          to {
            width: 300px;
            height: 300px;
            opacity: 0;
          }
        }
      `}</style>
        </motion.button>
    );
}
