import { motion } from 'framer-motion';
import { cardVariants } from '@/lib/animations';
import React, { forwardRef } from 'react';

const AnimatedCard = forwardRef(({
    children,
    className = '',
    onClick,
    delay = 0,
    ...props
}, ref) => {
    return (
        <motion.div
            ref={ref}
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
});

AnimatedCard.displayName = 'AnimatedCard';

export default AnimatedCard;
