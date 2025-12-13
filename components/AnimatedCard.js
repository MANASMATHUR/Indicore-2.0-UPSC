/**
 * Animated Card Component
 * Beautiful card with hover animations and reveal effects
 */

import { motion } from 'framer-motion';
import { cardVariants } from '@/lib/animations';

export default function AnimatedCard({
    children,
    className = '',
    onClick,
    delay = 0,
    ...props
}) {
    return (
        <motion.div
            className={`animated-card ${className}`}
            variants={cardVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
            onClick={onClick}
            transition={{ delay }}
            {...props}
        >
            {children}

            <style jsx>{`
        .animated-card {
          cursor: ${onClick ? 'pointer' : 'default'};
          will-change: transform;
        }
      `}</style>
        </motion.div>
    );
}
