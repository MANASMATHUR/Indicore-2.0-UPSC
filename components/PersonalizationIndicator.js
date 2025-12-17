import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

/**
 * PersonalizationIndicator Component
 * Shows a visible indicator that content is personalized
 *
 * @param {Object} props
 * @param {boolean} props.visible - Whether the indicator is visible
 * @param {string} props.reason - Reason for personalization (e.g. "Based on your weak areas")
 * @param {string} props.type - Type of content (e.g. "questions", "topics")
 * @param {string} props.className - Additional classes
 */
export default function PersonalizationIndicator({
    visible = true,
    reason = "Based on your recent performance",
    type = "content",
    className = ""
}) {
    if (!visible) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30 border border-violet-200 dark:border-violet-700/50 shadow-sm ${className}`}
        >
            <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400 animate-pulse" />
            <div className="flex flex-col">
                <span className="text-xs font-bold text-violet-800 dark:text-violet-200 uppercase tracking-wider">
                    Personalized {type}
                </span>
                {reason && (
                    <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400">
                        {reason}
                    </span>
                )}
            </div>
        </motion.div>
    );
}
