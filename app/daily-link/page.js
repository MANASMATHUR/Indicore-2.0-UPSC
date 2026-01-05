'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Newspaper,
    Link as LinkIcon,
    BookOpen,
    ChevronRight,
    RefreshCw,
    Search,
    Filter,
    Sparkles,
    Zap
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const SAMPLE_NEWS = [
    {
        id: 1,
        headline: "Indian GDP grows at 7.2% in Q3, exceeding expectations",
        content: "The latest data from NSO indicates a robust recovery in the manufacturing sector and services. Private consumption remains a key driver of growth...",
        category: "Economy",
        date: "Dec 30, 2025"
    },
    {
        id: 2,
        headline: "Supreme Court stays new regulations on digital media platforms",
        content: "A three-judge bench of the Supreme Court has put a temporary halt on the implementation of the new digital media ethics code, citing concerns over freedom of speech...",
        category: "Polity",
        date: "Dec 29, 2025"
    },
    {
        id: 3,
        headline: "India-France sign landmark defense deal for next-gen fighter jets",
        content: "The strategic partnership between India and France reached a new milestone as both nations agreed on co-development of jet engines and underwater drones...",
        category: "International Relations",
        date: "Dec 28, 2025"
    },
    {
        id: 4,
        headline: "COP30: India pushes for 'Climate Justice' for Global South",
        content: "In the ongoing climate summit, India has called for meaningful technology transfer and affordable finance from developed nations to meet net-zero targets...",
        category: "Environment",
        date: "Dec 27, 2025"
    }
];

export default function DailyLinkPage() {
    const [news, setNews] = useState(SAMPLE_NEWS);
    const [linking, setLinking] = useState({});
    const [links, setLinks] = useState({});

    const performLink = async (newsItem) => {
        if (linking[newsItem.id]) return;

        setLinking(prev => ({ ...prev, [newsItem.id]: true }));

        try {
            const resp = await fetch('/api/ai/syllabus-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    headline: newsItem.headline,
                    content: newsItem.content
                })
            });

            const data = await resp.json();
            setLinks(prev => ({ ...prev, [newsItem.id]: data }));
        } catch (err) {
            console.error(err);
        } finally {
            setLinking(prev => ({ ...prev, [newsItem.id]: false }));
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12">
            <div className="max-w-5xl mx-auto">
                <header className="mb-12">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 mb-4"
                    >
                        <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/20 text-white">
                            <Zap size={24} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Daily Syllabus Connect</h1>
                            <p className="text-slate-500 dark:text-slate-400">Bridging Current Affairs with the UPSC Syllabus using AI</p>
                        </div>
                    </motion.div>
                </header>

                <div className="grid grid-cols-1 gap-6">
                    {news.map((item, idx) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                        >
                            <Card className="overflow-hidden border-none shadow-xl shadow-slate-200/50 dark:shadow-none dark:bg-slate-900">
                                <CardContent className="p-0">
                                    <div className="flex flex-col md:flex-row">
                                        <div className="p-6 md:w-2/3 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 border-none text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                                    {item.date}
                                                </Badge>
                                                <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-none">
                                                    {item.category}
                                                </Badge>
                                            </div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3 leading-tight">
                                                {item.headline}
                                            </h2>
                                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed line-clamp-2">
                                                {item.content}
                                            </p>

                                            {!links[item.id] ? (
                                                <Button
                                                    onClick={() => performLink(item)}
                                                    disabled={linking[item.id]}
                                                    className="mt-6 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20"
                                                >
                                                    {linking[item.id] ? (
                                                        <><RefreshCw className="mr-2 animate-spin" size={16} /> Analyzing...</>
                                                    ) : (
                                                        <><LinkIcon className="mr-2" size={16} /> Link to Syllabus</>
                                                    )}
                                                </Button>
                                            ) : (
                                                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                                                    <div className="flex items-center gap-2 text-red-600 mb-4 font-bold text-sm bg-red-50 dark:bg-red-900/20 w-fit px-3 py-1 rounded-full">
                                                        <Sparkles size={14} /> AI Analysis
                                                    </div>
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 italic mb-4">
                                                        "{links[item.id].relevance}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="md:w-1/3 p-6 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col justify-center">
                                            {links[item.id] ? (
                                                <div className="space-y-4">
                                                    <div>
                                                        <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 block mb-1">GS Paper</span>
                                                        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                                                            <BookOpen size={16} className="text-blue-500" />
                                                            {links[item.id].gsPaper}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 block mb-1">Topic</span>
                                                        <div className="text-slate-700 dark:text-slate-300 font-semibold text-sm">
                                                            {links[item.id].topic}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 block mb-1">Sub-topic</span>
                                                        <div className="text-slate-600 dark:text-slate-400 text-sm">
                                                            {links[item.id].subtopic}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-center opacity-40">
                                                    <Search size={40} className="mb-2 text-slate-300" />
                                                    <p className="text-xs font-semibold">Ready for Analysis</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
