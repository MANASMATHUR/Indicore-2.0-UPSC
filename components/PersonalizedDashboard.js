'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import PersonalizationIndicator from '@/components/PersonalizationIndicator';
import WeaknessMap from '@/components/WeaknessMap';
import PerformanceGraph from '@/components/PerformanceGraph';
import DailyPlan from '@/components/DailyPlan';
import StudyPersona from '@/components/StudyPersona';
import SmartNudges from '@/components/SmartNudges';
import PredictiveScore from '@/components/PredictiveScore';
import AchievementWall from '@/components/AchievementWall';
import SyllabusProgressTracker from '@/components/SyllabusProgressTracker';
import DailySyllabusSync from '@/components/DailySyllabusSync';
import ResumeSession from '@/components/ResumeSession';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import DashboardError, { NetworkStatus } from '@/components/DashboardError';
import useDashboardData, { formatLastUpdated } from '@/hooks/useDashboardData';
import useKeyboardShortcuts, { KeyboardShortcutsHelp } from '@/hooks/useKeyboardShortcuts';
import StudyCompendium from '@/components/chat/StudyCompendium';
import { highlighter as HighlighterIcon } from 'lucide-react';
import {
    Sparkles,
    ArrowRight,
    BookOpen,
    FileText,
    BarChart3,
    TrendingUp,
    Target,
    Brain,
    X,
    ChevronRight,
    Star,
    RefreshCw,
    Clock,
    Highlighter
} from 'lucide-react';

export default function PersonalizedDashboard() {
    const { data: session } = useSession();
    const [isVisible, setIsVisible] = useState(true);
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

    // Use custom hook for data fetching with caching and auto-refresh
    const {
        data: recommendations,
        loading,
        error,
        lastUpdated,
        isRefreshing,
        isOnline,
        refresh,
        clearCacheAndRefresh
    } = useDashboardData({
        refreshInterval: 5 * 60 * 1000, // 5 minutes
        enableAutoRefresh: true,
        enableCache: true
    });

    // Keyboard shortcuts
    useKeyboardShortcuts({
        'r': () => refresh(),
        '?': () => setShowShortcutsHelp(true),
        'Escape': () => setShowShortcutsHelp(false)
    });

    if (!session || !isVisible) return null;

    // Show loading skeleton
    if (loading && !recommendations) {
        return <DashboardSkeleton />;
    }

    // Show error state
    if (error && !recommendations) {
        return (
            <>
                <NetworkStatus isOnline={isOnline} />
                <DashboardError
                    error={error}
                    onRetry={refresh}
                    type={error.type}
                />
            </>
        );
    }

    // Check if we have any recommendations
    const hasRecommendations = recommendations && (
        (recommendations.pyq && recommendations.pyq.length > 0) ||
        (recommendations.essay && recommendations.essay.length > 0) ||
        (recommendations.mock_test && recommendations.mock_test.length > 0) ||
        (recommendations.weakness_map && recommendations.weakness_map.length > 0) ||
        (recommendations.daily_plan && recommendations.daily_plan.length > 0) ||
        (recommendations.syllabus)
    );

    // We always show the dashboard now, even without recommendations, 
    // so new users can see the "Active Intelligence" row and empty state.

    return (
        <section className="py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-rose-50/30 dark:from-gray-950 dark:to-rose-900/10 border-y border-rose-100 dark:border-rose-900/20">
            <div className="max-w-7xl mx-auto">
                {/* Network Status Indicator */}
                <NetworkStatus isOnline={isOnline} />

                {/* Keyboard Shortcuts Help */}
                <KeyboardShortcutsHelp
                    isOpen={showShortcutsHelp}
                    onClose={() => setShowShortcutsHelp(false)}
                />

                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-rose-500 to-red-600 rounded-lg shadow-lg shadow-rose-500/20 text-white">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                For You
                                <PersonalizationIndicator
                                    visible={true}
                                    size="sm"
                                    className="ml-2"
                                />
                            </h2>
                            <div className="flex items-center gap-3 mt-1">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Curated recommendations and strategic analysis based on your progress
                                </p>
                                {lastUpdated && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                        <Clock className="w-3 h-3" />
                                        {formatLastUpdated(lastUpdated)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Refresh Button */}
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={refresh}
                            disabled={isRefreshing}
                            variant="outline"
                            size="sm"
                            className="border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-900/20"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                            {isRefreshing ? 'Refreshing...' : 'Refresh'}
                        </Button>
                        <Button
                            onClick={() => setShowShortcutsHelp(true)}
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            title="Keyboard shortcuts (?)"
                        >
                            <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded">?</kbd>
                        </Button>
                    </div>
                </div>

                {/* Persona Banner (New Phase 3) */}
                {recommendations?.persona && (
                    <StudyPersona persona={recommendations.persona} userName={session.user.name} />
                )}

                {/* Active Intelligence Section (New) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="lg:col-span-1">
                        <ResumeSession />
                    </div>
                    <div className="lg:col-span-2">
                        <DailySyllabusSync />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Empty State */}
                    {!hasRecommendations && (
                        <div className="col-span-full bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
                            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Sparkles className="w-8 h-8 text-rose-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                Start Your Journey
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto mb-6">
                                We need a little more data to generate personalized recommendations.
                                Take a mock test or explore PYQs to get started!
                            </p>
                            <div className="flex gap-4 justify-center">
                                <Link href="/mock-tests">
                                    <Button variant="primary">Take a Mock Test</Button>
                                </Link>
                                <Link href="/pyq-archive">
                                    <Button variant="outline">Browse PYQs</Button>
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Phase 4: Prediction & Achievements (Row 1) */}
                    {hasRecommendations && (
                        <>
                            {recommendations.prediction && (
                                <div className="col-span-full md:col-span-1 lg:col-span-1 min-h-[200px]">
                                    <PredictiveScore prediction={recommendations.prediction} />
                                </div>
                            )}
                            {recommendations.achievements && (
                                <div className="col-span-full md:col-span-1 lg:col-span-1 min-h-[200px]">
                                    <AchievementWall achievements={recommendations.achievements} />
                                </div>
                            )}
                            {/* Fills remaining space or pushes next items */}
                            {!recommendations.prediction && !recommendations.achievements && (
                                <div className="hidden"></div>
                            )}

                            {/* Syllabus Progress Tracker (New) */}
                            {recommendations.syllabus && (
                                <div className="col-span-full mb-6">
                                    <SyllabusProgressTracker
                                        exam="UPSC"
                                        userProgress={recommendations.syllabus}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {/* Strategic Map */}
                    {hasRecommendations && recommendations.weakness_map && recommendations.weakness_map.length > 0 && (
                        <div className="col-span-full lg:col-span-1 mb-2">
                            {/* WeaknessMap fills remaining space in row 1 if possible, else wraps */}
                        </div>
                    )}
                    {hasRecommendations && recommendations.weakness_map && recommendations.weakness_map.length > 0 && (
                        <div className="col-span-full mb-2">
                            <WeaknessMap data={recommendations.weakness_map} />
                        </div>
                    )}

                    {/* Row 2: Performance Graph & Daily Plan */}
                    {hasRecommendations && (
                        <>
                            {/* Performance Graph */}
                            <div className="col-span-full lg:col-span-2 min-h-[300px]">
                                <PerformanceGraph data={recommendations.performance_history || []} />
                            </div>

                            {/* Daily Plan with Fallback to Smart Nudges if no plan */}
                            <div className="col-span-full lg:col-span-1 min-h-[300px] flex flex-col gap-6">
                                <DailyPlan plan={recommendations.daily_plan || []} />

                                {/* Smart Nudges (Phase 3) */}
                                {recommendations.nudges && recommendations.nudges.length > 0 && (
                                    <SmartNudges nudges={recommendations.nudges} />
                                )}
                            </div>
                        </>
                    )}

                    {/* PYQ Recommendations */}
                    {hasRecommendations && recommendations.pyq && recommendations.pyq.length > 0 && (
                        <Card className="border border-red-100 dark:border-red-900/30 bg-white dark:bg-gray-900 shadow-xl shadow-red-500/5 hover:shadow-red-500/10 transition-all duration-300">
                            <CardHeader className="pb-3 border-b border-red-50 dark:border-red-900/20 bg-red-50/30 dark:bg-red-900/10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Target className="w-4 h-4 text-red-600" />
                                        <CardTitle className="text-base text-red-900 dark:text-red-100">Practice Areas</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] border-red-200 text-red-600 bg-red-50">High Priority</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                <AnimatePresence>
                                    {recommendations.pyq.slice(0, 3).map((item, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                        >
                                            <Link href={`/pyq-archive?search=${encodeURIComponent(item.topic)}`}>
                                                <div className="p-3.5 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 hover:to-red-50 dark:hover:to-red-900/10 transition-all duration-300 group cursor-pointer border border-gray-100 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-800 shadow-sm hover:shadow-md mb-2 relative overflow-hidden">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest ${item.intelligenceLabel === 'Critical Area' ? 'bg-red-600 text-white' :
                                                                item.intelligenceLabel === 'High Yield' ? 'bg-amber-500 text-white' :
                                                                    'bg-indigo-600 text-white'
                                                                }`}>
                                                                {item.intelligenceLabel || 'Topic'}
                                                            </span>
                                                            {item.relevanceScore > 90 && (
                                                                <Badge variant="outline" className="text-[9px] border-red-500/20 text-red-600 bg-red-500/5">
                                                                    MOST RELEVANT
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-gray-400 tabular-nums">{item.relevanceScore}%</span>
                                                    </div>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-sm text-gray-900 dark:text-gray-100 group-hover:text-red-700 dark:group-hover:text-red-300 line-clamp-1">
                                                            {item.topic}
                                                        </span>
                                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-500 transition-all group-hover:translate-x-1" />
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 italic">
                                                        {item.reason ? item.reason.replace(/_/g, ' ') : 'Analysis suggests this is a high-priority area.'}
                                                    </p>

                                                    {/* Micro-sparkle decor */}
                                                    <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-red-500/5 blur-lg rounded-full group-hover:bg-red-500/10 transition-colors" />
                                                </div>
                                            </Link>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                                <Link href="/pyq-archive" className="inline-flex items-center text-xs font-medium text-red-600 hover:text-red-700 mt-2">
                                    View all recommendations <ArrowRight className="w-3 h-3 ml-1" />
                                </Link>
                            </CardContent>
                        </Card>
                    )}

                    {/* Mock Test Recommendations */}
                    {hasRecommendations && recommendations.mock_test && recommendations.mock_test.length > 0 && (
                        <Card className="border border-lime-100 dark:border-lime-900/30 bg-white dark:bg-gray-900 shadow-xl shadow-lime-500/5 hover:shadow-lime-500/10 transition-all duration-300">
                            <CardHeader className="pb-3 border-b border-lime-50 dark:border-lime-900/20 bg-lime-50/30 dark:bg-lime-900/10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-lime-600" />
                                        <CardTitle className="text-base text-lime-900 dark:text-lime-100">Recommended Tests</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] border-lime-200 text-lime-600 bg-lime-50">Adaptive</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                {recommendations.mock_test.slice(0, 2).map((test, i) => (
                                    <div key={i} className="p-3 rounded-lg border border-lime-100 dark:border-lime-900/30 bg-lime-50/20 dark:bg-lime-900/10">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-semibold text-sm text-lime-900 dark:text-lime-100">{test.title}</h4>
                                            {test.difficulty && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white dark:bg-black/20 border border-lime-200 text-lime-700 capitalize">
                                                    {test.difficulty}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                                            {test.reason ? test.reason.replace(/_/g, ' ') : 'Tailored to improve your weak areas'}
                                        </p>
                                        <Link href="/mock-tests">
                                            <Button size="sm" variant="outline" className="w-full text-xs h-8 border-lime-200 hover:bg-lime-50 hover:text-lime-700">
                                                Take Test
                                            </Button>
                                        </Link>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Essay Topics */}
                    {hasRecommendations && recommendations.essay && recommendations.essay.length > 0 && (
                        <Card className="border border-emerald-100 dark:border-emerald-900/30 bg-white dark:bg-gray-900 shadow-xl shadow-emerald-500/5 hover:shadow-emerald-500/10 transition-all duration-300">
                            <CardHeader className="pb-3 border-b border-emerald-50 dark:border-emerald-900/20 bg-emerald-50/30 dark:bg-emerald-900/10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-emerald-600" />
                                        <CardTitle className="text-base text-emerald-900 dark:text-emerald-100">Essay Topics</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-600 bg-emerald-50">Personalized</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                {recommendations.essay.slice(0, 3).map((essay, i) => (
                                    <Link key={i} href={`/writing-tools?tab=essay&topic=${encodeURIComponent(essay.topic)}`}>
                                        <div className="flex gap-3 p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors cursor-pointer group">
                                            <div className="mt-1 min-w-[24px] h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">
                                                {essay.topic.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-emerald-700 transition-colors line-clamp-2">
                                                    {essay.topic}
                                                </h4>
                                                <p className="text-xs text-emerald-600/80 mt-0.5">
                                                    Match: {essay.match_reason || 'General Interest'}
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                                <Link href="/writing-tools" className="inline-flex items-center text-xs font-medium text-emerald-600 hover:text-emerald-700 mt-2 pl-2">
                                    Go to Essay Builder <ArrowRight className="w-3 h-3 ml-1" />
                                </Link>
                            </CardContent>
                        </Card>
                    )}

                    {/* Study Compendium Highlights (NEW) */}
                    <Card className="col-span-full border border-rose-100 dark:border-rose-900/30 bg-white dark:bg-gray-900 shadow-xl shadow-rose-500/5">
                        <CardHeader className="pb-3 border-b border-rose-50 dark:border-rose-900/20 bg-rose-50/30 dark:bg-rose-900/10 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Highlighter className="w-5 h-5 text-rose-600" />
                                <div>
                                    <CardTitle className="text-lg text-rose-900 dark:text-rose-100 uppercase tracking-tight">Study Compendium</CardTitle>
                                    <CardDescription>All your saved highlights and key insights</CardDescription>
                                </div>
                            </div>
                            <Link href="/highlights">
                                <Button variant="outline" size="sm" className="border-rose-200 text-rose-600 hover:bg-rose-50">
                                    Manage Library <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </Link>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <StudyCompendium />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>
    );
}
