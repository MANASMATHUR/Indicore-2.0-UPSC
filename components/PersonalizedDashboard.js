'use client';

import { useState, useEffect } from 'react';
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
    Star
} from 'lucide-react';

export default function PersonalizedDashboard() {
    const { data: session } = useSession();
    const [recommendations, setRecommendations] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (session?.user) {
            fetchRecommendations();
        } else {
            setLoading(false);
        }
    }, [session]);

    const fetchRecommendations = async () => {
        try {
            const response = await fetch('/api/personalization/recommendations?type=all');
            const data = await response.json();
            if (data.success && data.recommendations) {
                setRecommendations(data.recommendations);
            }
        } catch (error) {
            console.error('Error fetching dashboard recommendations:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!session || !isVisible) return null;

    if (loading) {
        return (
            <section className="py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-purple-50/30 border-y border-purple-100">
                <div className="max-w-7xl mx-auto text-center">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-gray-200 rounded w-1/4 mx-auto"></div>
                        <div className="h-32 bg-gray-100 rounded w-full"></div>
                    </div>
                </div>
            </section>
        );
    }

    // Check if we have any recommendations
    const hasRecommendations = recommendations && (
        (recommendations.pyq && recommendations.pyq.length > 0) ||
        (recommendations.essay && recommendations.essay.length > 0) ||
        (recommendations.mock_test && recommendations.mock_test.length > 0) ||
        (recommendations.weakness_map && recommendations.weakness_map.length > 0) ||
        (recommendations.daily_plan && recommendations.daily_plan.length > 0)
    );

    // Filter out if no recommendations to show (hides "Start Your Journey" empty state)
    if (!hasRecommendations) {
        return null;
    }

    return (
        <section className="py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-purple-50/30 dark:from-gray-950 dark:to-purple-900/10 border-y border-purple-100 dark:border-purple-900/20">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-lg shadow-purple-500/20 text-white">
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
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Curated recommendations and strategic analysis based on your progress
                            </p>
                        </div>
                    </div>
                </div>

                {/* Persona Banner (New Phase 3) */}
                {recommendations.persona && (
                    <StudyPersona persona={recommendations.persona} userName={session.user.name} />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Empty State */}
                    {!hasRecommendations && (
                        <div className="col-span-full bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
                            <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Sparkles className="w-8 h-8 text-purple-600" />
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
                                {recommendations.pyq.slice(0, 3).map((item, i) => (
                                    <Link key={i} href={`/pyq-archive?search=${encodeURIComponent(item.topic)}`}>
                                        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group cursor-pointer border border-transparent hover:border-red-100 dark:hover:border-red-900/30 mb-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-medium text-sm text-gray-900 dark:text-gray-100 group-hover:text-red-700 dark:group-hover:text-red-300 line-clamp-1">
                                                    {item.topic}
                                                </span>
                                                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-transform group-hover:translate-x-0.5" />
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                                {item.reason ? item.reason.replace(/_/g, ' ') : 'Recommended based on analysis'}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                                <Link href="/pyq-archive" className="inline-flex items-center text-xs font-medium text-red-600 hover:text-red-700 mt-2">
                                    View all recommendations <ArrowRight className="w-3 h-3 ml-1" />
                                </Link>
                            </CardContent>
                        </Card>
                    )}

                    {/* Mock Test Recommendations */}
                    {hasRecommendations && recommendations.mock_test && recommendations.mock_test.length > 0 && (
                        <Card className="border border-purple-100 dark:border-purple-900/30 bg-white dark:bg-gray-900 shadow-xl shadow-purple-500/5 hover:shadow-purple-500/10 transition-all duration-300">
                            <CardHeader className="pb-3 border-b border-purple-50 dark:border-purple-900/20 bg-purple-50/30 dark:bg-purple-900/10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-purple-600" />
                                        <CardTitle className="text-base text-purple-900 dark:text-purple-100">Recommended Tests</CardTitle>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-600 bg-purple-50">Adaptive</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                {recommendations.mock_test.slice(0, 2).map((test, i) => (
                                    <div key={i} className="p-3 rounded-lg border border-purple-100 dark:border-purple-900/30 bg-purple-50/20 dark:bg-purple-900/10">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-semibold text-sm text-purple-900 dark:text-purple-100">{test.title}</h4>
                                            {test.difficulty && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white dark:bg-black/20 border border-purple-200 text-purple-700 capitalize">
                                                    {test.difficulty}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                                            {test.reason ? test.reason.replace(/_/g, ' ') : 'Tailored to improve your weak areas'}
                                        </p>
                                        <Link href="/mock-tests">
                                            <Button size="sm" variant="outline" className="w-full text-xs h-8 border-purple-200 hover:bg-purple-50 hover:text-purple-700">
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
                </div>
            </div>
        </section>
    );
}
