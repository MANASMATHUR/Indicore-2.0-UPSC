/**
 * Page Transition Component
 * Smooth page transitions using Framer Motion
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/router';
import { pageVariants } from '@/lib/animations';

export default function PageTransition({ children }) {
    const router = useRouter();

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={router.pathname}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{ width: '100%', minHeight: '100vh' }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
