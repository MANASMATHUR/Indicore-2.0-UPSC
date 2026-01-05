'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Highlighter, Trash2, Search, Calendar, MessageSquare, ChevronRight, ExternalLink } from 'lucide-react';
import Header from '@/components/layout/Header';
import { getAllHighlights, removeHighlight } from '@/lib/highlightService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/ToastProvider';

export default function HighlightsPage() {
    const [highlights, setHighlights] = useState([]);
    const [filterColor, setFilterColor] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const { showToast } = useToast();

    useEffect(() => {
        setHighlights(getAllHighlights());
    }, []);

    const handleDelete = (id, chatId, messageIndex) => {
        if (confirm('Delete this highlight?')) {
            removeHighlight(chatId, messageIndex, id);
            setHighlights(getAllHighlights());
            showToast('Highlight deleted', { type: 'success' });
        }
    };

    const COLORS = [
        { name: 'all', label: 'All Colors', bg: 'bg-slate-200 dark:bg-slate-700' },
        { name: 'yellow', label: 'Yellow', bg: 'bg-yellow-400' },
        { name: 'green', label: 'Green', bg: 'bg-green-400' },
        { name: 'pink', label: 'Pink', bg: 'bg-pink-400' },
        { name: 'blue', label: 'Blue', bg: 'bg-blue-400' },
        { name: 'orange', label: 'Orange', bg: 'bg-orange-400' }
    ];

    const filteredHighlights = highlights.filter(h => {
        const matchesColor = filterColor === 'all' || h.color === filterColor;
        const matchesSearch = h.text.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesColor && matchesSearch;
    });

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
            <Header />

            <main className="max-w-6xl mx-auto px-4 pt-24 pb-12">
                <header className="mb-10 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-bold mb-4 border border-red-200 dark:border-red-800"
                    >
                        <Highlighter className="w-4 h-4" />
                        STUDY COMPENDIUM
                    </motion.div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
                        Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-600">Highlights</span> Library
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto">
                        A centralized repository of all your key takeaways, concept definitions, and critical facts highlighted during your chat sessions.
                    </p>
                </header>

                {/* Filters & Search */}
                <section className="sticky top-20 z-10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md pb-6">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="relative w-full md:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search in highlights..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 bg-slate-50 dark:bg-slate-900 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-red-500"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2 justify-center">
                            {COLORS.map((color) => (
                                <button
                                    key={color.name}
                                    onClick={() => setFilterColor(color.name)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border-2 ${filterColor === color.name
                                            ? 'border-red-500 scale-105 shadow-md shadow-red-500/10'
                                            : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                                        } ${color.name === 'all' ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : color.bg}`}
                                >
                                    {color.label.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Highlights List */}
                <div className="mt-8 space-y-6">
                    {filteredHighlights.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                            <div className="text-6xl mb-4 grayscale filter opacity-50">🖍️</div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">No highlights found</h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-2">Start highlighting important points in the chat to build your library!</p>
                            <Button variant="outline" className="mt-6 border-red-500 text-red-600 hover:bg-red-50" asChild>
                                <a href="/chat">GO TO CHAT</a>
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6">
                            <AnimatePresence mode="popLayout">
                                {filteredHighlights.map((h, idx) => (
                                    <motion.article
                                        key={h.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="group relative bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:border-red-200 dark:hover:border-red-900/50 transition-all"
                                    >
                                        <div className="flex items-start justify-between gap-4 mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full highlight-${h.color}`} />
                                                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(h.timestamp).toLocaleDateString()}</span>
                                                    <span className="flex items-center gap-1 underline underline-offset-2"><MessageSquare className="w-3 h-3" /> Chat Link Available</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(h.id, h.chatId, h.messageIndex)}
                                                className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <p className={`text-lg sm:text-xl font-medium leading-relaxed bg-gradient-to-r from-transparent to-transparent highlight-${h.color} group-hover:from-transparent transition-all rounded px-1`}>
                                            "{h.text}"
                                        </p>

                                        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                            <a
                                                href={`/chat?id=${h.chatId}`}
                                                className="inline-flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 transition-colors"
                                            >
                                                VIEW CONTEXT <ExternalLink className="w-3 h-3" />
                                            </a>
                                            <div className="text-[10px] font-bold text-slate-300 dark:text-slate-600 tracking-tighter">
                                                ID: {h.id.substring(0, 8)}
                                            </div>
                                        </div>
                                    </motion.article>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
