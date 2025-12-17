'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
    Sparkles,
    Target,
    FileText,
    BarChart3,
    TrendingUp,
    Flame,
    ChevronDown,
    ArrowRight,
    BookOpen,
    Clock,
    Award
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

/**
 * Unified Dashboard - Compact header dropdown with personalized insights
 * Shows quick stats, recommendations, and achievements
 */
export default function UnifiedDashboard() {
    const { data: session } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [recommendations, setRecommendations] = useState(null);
    const [userStats, setUserStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (session?.user) {
            fetchDashboardData();
        } else {
            setLoading(false);
        }
    }, [session]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const fetchDashboardData = async () => {
        try {
            // Fetch recommendations and user stats in parallel
            const [recsRes, statsRes] = await Promise.all([
                fetch('/api/personalization/recommendations?type=all'),
                fetch('/api/user/analytics')
            ]);

            if (recsRes.ok) {
                const recsData = await recsRes.json();
                if (recsData.success) {
                    setRecommendations(recsData.recommendations);
                }
            }

            if (statsRes.ok) {
                const statsData = await statsRes.json();
                if (statsData.success) {
                    setUserStats(statsData.statistics);
                }
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Don't render for non-authenticated users
    if (!session) return null;

    const hasRecommendations = recommendations && (
        (recommendations.pyq && recommendations.pyq.length > 0) ||
        (recommendations.essay && recommendations.essay.length > 0) ||
        (recommendations.mock_test && recommendations.mock_test.length > 0)
    );

    const userName = session.user?.name?.split(' ')[0] || 'User';
    const studyStreak = userStats?.studyStreak || 0;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Dashboard Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 border border-purple-200 dark:border-purple-700/50 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 group"
            >
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:animate-pulse" />
                <span className="text-sm font-semibold text-purple-900 dark:text-purple-100 hidden md:inline">
                    My Dashboard
                </span>
                <ChevronDown className={`w-4 h-4 text-purple-600 dark:text-purple-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                {hasRecommendations && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse" />
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-[380px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl shadow-purple-500/10 border border-purple-100 dark:border-purple-900/30 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 p-5 text-white">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="text-lg font-bold">Welcome back, {userName}! 👋</h3>
                                <p className="text-sm text-purple-100 mt-0.5">Your personalized insights</p>
                            </div>
                            <Sparkles className="w-6 h-6 text-purple-200 animate-pulse" />
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 gap-2 mt-4">
                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 text-center">
                                <Flame className="w-5 h-5 mx-auto mb-1 text-orange-300" />
                                <div className="text-xl font-bold">{studyStreak}</div>
                                <div className="text-[10px] text-purple-200">Day Streak</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 text-center">
                                <BarChart3 className="w-5 h-5 mx-auto mb-1 text-emerald-300" />
                                <div className="text-xl font-bold">{userStats?.mockTestsCompleted || 0}</div>
                                <div className="text-[10px] text-purple-200">Tests Done</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 text-center">
                                <Award className="w-5 h-5 mx-auto mb-1 text-yellow-300" />
                                <div className="text-xl font-bold">{userStats?.averageScore || 0}%</div>
                                <div className="text-[10px] text-purple-200">Avg Score</div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 max-h-[400px] overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-8 text-gray-500">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                                Loading insights...
                            </div>
                        ) : hasRecommendations ? (
                            <div className="space-y-4">
                                {/* PYQ Recommendations */}
                                {recommendations.pyq && recommendations.pyq.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Target className="w-4 h-4 text-red-600" />
                                            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Practice Areas</h4>
                                            <Badge variant="outline" className="ml-auto text-[10px] border-red-200 text-red-600 bg-red-50">
                                                Priority
                                            </Badge>
                                        </div>
                                        <div className="space-y-2">
                                            {recommendations.pyq.slice(0, 2).map((item, i) => (
                                                <Link key={i} href={`/pyq-archive?search=${encodeURIComponent(item.topic)}`}>
                                                    <div className="p-2.5 rounded-lg bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors cursor-pointer border border-red-100 dark:border-red-900/30 group">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-red-700 dark:group-hover:text-red-300">
                                                                    {item.topic}
                                                                </p>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                                    {item.reason ? item.reason.replace(/_/g, ' ') : 'Recommended'}
                                                                </p>
                                                            </div>
                                                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-red-500 flex-shrink-0 mt-0.5" />
                                                        </div>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Mock Test Recommendations */}
                                {recommendations.mock_test && recommendations.mock_test.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <BarChart3 className="w-4 h-4 text-purple-600" />
                                            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Recommended Tests</h4>
                                        </div>
                                        <Link href="/mock-tests">
                                            <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-900/10 hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-colors cursor-pointer border border-purple-100 dark:border-purple-900/30 group">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                                                            {recommendations.mock_test[0].title}
                                                        </p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                            {recommendations.mock_test[0].difficulty} • {recommendations.mock_test[0].reason?.replace(/_/g, ' ') || 'Tailored for you'}
                                                        </p>
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-purple-500" />
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                )}

                                {/* Essay Topics */}
                                {recommendations.essay && recommendations.essay.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileText className="w-4 h-4 text-emerald-600" />
                                            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Essay Topics</h4>
                                        </div>
                                        <Link href={`/writing-tools?tab=essay&topic=${encodeURIComponent(recommendations.essay[0].topic)}`}>
                                            <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer border border-emerald-100 dark:border-emerald-900/30 group">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                                                            {recommendations.essay[0].topic}
                                                        </p>
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 flex-shrink-0 mt-0.5" />
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <BookOpen className="w-8 h-8 text-purple-600" />
                                </div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Start Your Journey</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-[280px] mx-auto">
                                    Complete activities to get personalized recommendations!
                                </p>
                                <div className="flex gap-2 justify-center">
                                    <Link href="/mock-tests">
                                        <Button size="sm" variant="outline" className="text-xs">Take a Test</Button>
                                    </Link>
                                    <Link href="/pyq-archive">
                                        <Button size="sm" variant="outline" className="text-xs">Browse PYQs</Button>
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-100 dark:border-gray-800 p-3 bg-gray-50/50 dark:bg-gray-800/50">
                        <Link href="/profile">
                            <button className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/30 flex items-center justify-center gap-2 group">
                                View Full Dashboard
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
