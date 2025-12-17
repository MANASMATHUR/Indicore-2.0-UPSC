import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Play, X, MessageSquare, ChevronRight } from 'lucide-react';

export default function ResumeBanner({ onResume, className = '' }) {
    const [resumeData, setResumeData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const checkResume = async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/personalization/resume-conversation');
                const data = await res.json();

                if (data.success && data.hasResumable) {
                    setResumeData(data);
                }
            } catch (error) {
                console.error('Error checking resume:', error);
            } finally {
                setLoading(false);
            }
        };

        checkResume();
    }, []);

    if (loading || !resumeData || !isVisible) return null;

    const { conversation, resumePrompts } = resumeData;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/50 p-4 ${className}`}
            >
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-lg text-indigo-600 dark:text-indigo-300">
                                <History className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    Resume: {conversation.topic}
                                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
                                        {conversation.timeSince}
                                    </span>
                                </h3>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 italic line-clamp-1">
                                    "{conversation.lastMessage}"
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2 pl-12">
                        {resumePrompts.map((prompt, idx) => (
                            <button
                                key={idx}
                                onClick={() => onResume(prompt.text)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-800 hover:border-indigo-300 dark:hover:border-indigo-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 transition-all hover:shadow-sm group"
                            >
                                {prompt.type === 'continue' && <Play className="w-3 h-3 text-green-500" />}
                                {prompt.type === 'expand' && <ChevronRight className="w-3 h-3 text-blue-500" />}
                                {prompt.type === 'deep_dive' && <MessageSquare className="w-3 h-3 text-purple-500" />}
                                {prompt.text}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
