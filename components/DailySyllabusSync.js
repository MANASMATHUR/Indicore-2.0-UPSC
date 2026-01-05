'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Link as LinkIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function DailySyllabusSync() {
    const [dailyNews, setDailyNews] = useState([
        { id: 1, headline: "Supreme Court stays implementation of controversial state law on reservation.", content: "A three-judge bench headed by the CJI observed that the law prima facie violates the 50% ceiling..." },
        { id: 2, headline: "India-European Union to resume free trade agreement (FTA) talks next month.", content: "Both sides aim to resolve issues related to market access and digital trade..." }
    ]);
    const [syncingId, setSyncingId] = useState(null);
    const [newsLinks, setNewsLinks] = useState({});

    const handleSyllabusLink = async (news) => {
        setSyncingId(news.id);

        // Simulate AI analysis delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock result
        const mockResult = news.id === 1 ? {
            gsPaper: "GS Paper II",
            topic: "Indian Constitution & Social Justice",
            relevance: "Directly relates to Reservation policies and Judicial Review powers under Article 14 and 16."
        } : {
            gsPaper: "GS Paper III",
            topic: "Economic Development & International Relations",
            relevance: "Impact of FTAs on domestic market access and trade balance with major economic blocs."
        };

        setNewsLinks(prev => ({ ...prev, [news.id]: mockResult }));
        setSyncingId(null);
    };

    return (
        <Card className="border border-rose-100 dark:border-rose-900/30 bg-white dark:bg-gray-900 shadow-xl shadow-rose-500/5 overflow-hidden">
            <CardHeader className="pb-3 border-b border-rose-50 dark:border-rose-900/20 bg-rose-50/30 dark:bg-rose-900/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-rose-500 rounded-lg text-white">
                            <LinkIcon className="w-4 h-4" />
                        </div>
                        <CardTitle className="text-base text-rose-900 dark:text-rose-100 font-bold uppercase tracking-tight">Daily Syllabus Sync</CardTitle>
                    </div>
                    <Badge className="bg-rose-600 text-white border-0 animate-pulse text-[10px]">LIVE UPDATES</Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium italic">
                    AI-powered mapping of today's top stories to UPSC Syllabus topics.
                </p>
                <div className="space-y-3">
                    {dailyNews.map((news) => (
                        <div key={news.id} className="group p-3 rounded-xl bg-white dark:bg-gray-800 border border-slate-100 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-700 transition-all shadow-sm">
                            <h5 className="text-[13px] font-bold text-slate-800 dark:text-slate-100 mb-2 leading-tight group-hover:text-rose-700 dark:group-hover:text-rose-400">
                                {news.headline}
                            </h5>

                            {newsLinks[news.id] ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="mt-2 p-2.5 bg-rose-50/80 dark:bg-rose-900/20 rounded-lg border border-rose-100 dark:border-rose-800/50"
                                >
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className="px-2 py-0.5 bg-rose-600 text-white text-[9px] font-black rounded uppercase shadow-sm">
                                            {newsLinks[news.id].gsPaper}
                                        </div>
                                        <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 truncate">
                                            {newsLinks[news.id].topic}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed italic">
                                        {newsLinks[news.id].relevance}
                                    </p>
                                </motion.div>
                            ) : (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleSyllabusLink(news)}
                                    disabled={syncingId === news.id}
                                    className="w-full h-8 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-dashed border-rose-200 dark:border-rose-800 rounded-lg flex items-center justify-center gap-2 group-hover:border-rose-400 transition-colors"
                                >
                                    {syncingId === news.id ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                                            <span>AI Mapping in progress...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-3.5 h-3.5" />
                                            <span>Link to UPSC Syllabus</span>
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
                <div className="pt-2 border-t border-slate-50 dark:border-slate-800">
                    <button className="w-full py-1.5 text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-widest flex items-center justify-center gap-1 opacity-70 hover:opacity-100 transition-all">
                        View All News Analysis <Sparkles className="w-3 h-3" />
                    </button>
                </div>
            </CardContent>
        </Card>
    );
}
