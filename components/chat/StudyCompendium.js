'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Highlighter, BookOpen, ChevronRight, MessageSquare, Trash2, ExternalLink, Calendar } from 'lucide-react';
import { getAllHighlights, removeHighlight } from '@/lib/highlightService';
import { Button } from '@/components/ui/Button';

export default function StudyCompendium({ compact = false }) {
    const [highlights, setHighlights] = useState([]);

    useEffect(() => {
        setHighlights(getAllHighlights());
    }, []);

    const handleDelete = (h) => {
        if (confirm('Delete this highlight?')) {
            removeHighlight(h.chatId, h.messageIndex, h.id);
            setHighlights(getAllHighlights());
        }
    };

    if (highlights.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 ${compact ? 'py-4' : 'py-10'}`}>
                <Highlighter className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500 font-medium">No highlights yet</p>
                {!compact && (
                    <p className="text-xs text-slate-400 mt-1">Start highlighting text in your chats to build your study compendium!</p>
                )}
            </div>
        );
    }

    if (compact) {
        return (
            <div className="space-y-2">
                {highlights.slice(0, 3).map((h) => (
                    <div key={h.id} className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm hover:border-red-200 dark:hover:border-red-900/50 transition-all group">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className={`w-2 h-2 rounded-full highlight-${h.color}`} />
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                {new Date(h.timestamp).toLocaleDateString()}
                            </span>
                        </div>
                        <p className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2 italic font-medium">
                            "{h.text}"
                        </p>
                        <div className="mt-1.5 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <a href={`/chat?id=${h.chatId}`} className="text-[9px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                                VIEW CONTEXT <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                            <button onClick={() => handleDelete(h)} className="text-slate-400 hover:text-red-500">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
                {highlights.map((h) => (
                    <motion.div
                        key={h.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all group relative"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className={`w-3 h-3 rounded-full highlight-${h.color} shadow-sm`} />
                            <div className="flex gap-2">
                                <a href={`/chat?id=${h.chatId}`} className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-red-600 transition-colors" title="View Context">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                </a>
                                <button onClick={() => handleDelete(h)} className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                        <p className="text-sm text-slate-900 dark:text-slate-100 font-medium leading-relaxed italic line-clamp-3">
                            "{h.text}"
                        </p>
                        <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(h.timestamp).toLocaleDateString()}</span>
                            <span className="text-slate-200 dark:text-slate-700">|</span>
                            <span className="truncate max-w-[100px]">ID: {h.id.substring(0, 8)}</span>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
