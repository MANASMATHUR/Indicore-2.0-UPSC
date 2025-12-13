/**
 * Loading Skeleton Component
 * Beautiful skeleton loaders with shimmer effect
 */

import { motion } from 'framer-motion';

export default function LoadingSkeleton({
    variant = 'text',
    lines = 3,
    className = ''
}) {
    const variants = {
        text: 'h-4 rounded',
        title: 'h-8 rounded',
        avatar: 'h-12 w-12 rounded-full',
        card: 'h-48 rounded-lg',
        button: 'h-10 w-32 rounded-lg'
    };

    const renderSkeleton = () => {
        if (variant === 'text') {
            return Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className={`skeleton-item ${variants[variant]} ${className}`}
                    style={{ width: i === lines - 1 ? '60%' : '100%' }}
                />
            ));
        }

        return <div className={`skeleton-item ${variants[variant]} ${className}`} />;
    };

    return (
        <motion.div
            className="skeleton-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            {renderSkeleton()}

            <style jsx>{`
        .skeleton-container {
          width: 100%;
        }

        .skeleton-item {
          background: linear-gradient(
            90deg,
            #f0f0f0 0%,
            #f8f8f8 50%,
            #f0f0f0 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          margin-bottom: 0.5rem;
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        @media (prefers-color-scheme: dark) {
          .skeleton-item {
            background: linear-gradient(
              90deg,
              #2a2a2a 0%,
              #3a3a3a 50%,
              #2a2a2a 100%
            );
            background-size: 200% 100%;
          }
        }
      `}</style>
        </motion.div>
    );
}
