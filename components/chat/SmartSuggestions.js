import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Sparkles, ArrowRight, RefreshCw } from 'lucide-react';

export default function SmartSuggestions({ onSelect, className = '' }) {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [context, setContext] = useState(null);

    const fetchSuggestions = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/personalization/next-questions');
            const data = await res.json();

            if (data.success) {
                const enhancedSuggestions = [
                    {
                        question: "Start a Guided Ethics (GS-4) Case Study Simulation",
                        topic: "Ethics Lab",
                        priority: "high",
                        type: "level_up",
                        reason: "Practice stakeholder & dilemma mapping"
                    },
                    ...data.suggestions
                ];
                setSuggestions(enhancedSuggestions);
                setContext(data.context);
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuggestions();
    }, []);

    if (loading || suggestions.length === 0) return null;

    return (
        <div className={`p-4 ${className}`}>
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400">
                    <Sparkles className="w-4 h-4" />
                    <span>Recommended for you</span>
                </div>
                <button
                    onClick={fetchSuggestions}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-400 transition-colors"
                    title="Refresh suggestions"
                >
                    <RefreshCw className="w-3 h-3" />
                </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
                <AnimatePresence>
                    {suggestions.map((item, idx) => (
                        <motion.button
                            key={idx}
                            initial={{ opacity: 0, scale: 0.9, x: 20 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            onClick={() => onSelect(item.question)}
                            className={`
                flex-shrink-0 w-64 p-3 text-left snap-center
                rounded-xl border transition-all duration-200 group
                ${item.priority === 'high'
                                    ? 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200 dark:from-purple-900/20 dark:to-indigo-900/20 dark:border-purple-800'
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'}
                hover:shadow-md
              `}
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <span className={`
                  text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider
                  ${item.type === 'follow_up' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                        item.type === 'gap_fill' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                                            item.type === 'level_up' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' :
                                                'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}
                `}>
                                    {item.topic}
                                </span>
                                {item.priority === 'high' && (
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                )}
                            </div>

                            <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2 mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                {item.question}
                            </h4>

                            <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400 italic truncate pr-2">
                                    {item.reason}
                                </span>
                                <ArrowRight className="w-3 h-3 text-gray-400 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </motion.button>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
