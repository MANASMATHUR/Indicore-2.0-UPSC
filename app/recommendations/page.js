'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RecommendationsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [recommendations, setRecommendations] = useState(null);
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/signin?callbackUrl=/recommendations');
            return;
        }

        if (status === 'authenticated') {
            fetchRecommendations();
            fetchInsights();
        }
    }, [status, router]);

    const fetchRecommendations = async () => {
        try {
            const response = await fetch('/api/personalization/recommendations');
            if (!response.ok) throw new Error('Failed to fetch recommendations');
            const data = await response.json();
            setRecommendations(data.recommendations);
        } catch (err) {
            setError(err.message);
        }
    };

    const fetchInsights = async () => {
        try {
            const response = await fetch('/api/personalization/insights');
            if (!response.ok) throw new Error('Failed to fetch insights');
            const data = await response.json();
            setInsights(data.insights);
        } catch (err) {
            console.warn('Failed to fetch insights:', err);
        } finally {
            setLoading(false);
        }
    };

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-slate-400">Loading your personalized recommendations...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 dark:text-red-400 mb-4">⚠️ {error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gradient mb-2">
                        ✨ Personalized For You
                    </h1>
                    <p className="text-gray-600 dark:text-slate-400">
                        AI-powered recommendations based on your study patterns and performance
                    </p>
                </div>

                {/* Study Streak */}
                {insights?.studyStreak && (
                    <div className="mb-8 bg-white dark:bg-slate-800 rounded-xl shadow-card p-6 border border-gray-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                    🔥 Study Streak
                                </h3>
                                <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                                    {insights.studyStreak.currentStreak} days
                                </p>
                                <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                                    Longest: {insights.studyStreak.longestStreak} days • Total: {insights.studyStreak.totalStudyDays} days
                                </p>
                            </div>
                            <div className="text-6xl">🎯</div>
                        </div>
                    </div>
                )}

                {/* PYQ Recommendations */}
                {recommendations?.pyq && recommendations.pyq.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                            📚 Recommended PYQs
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recommendations.pyq.slice(0, 6).map((rec, idx) => (
                                <div
                                    key={idx}
                                    className="bg-white dark:bg-slate-800 rounded-xl shadow-card p-6 border border-gray-200 dark:border-slate-700 hover:shadow-lg transition-shadow"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="font-semibold text-gray-900 dark:text-white">
                                            {rec.topic}
                                        </h3>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${rec.priority >= 8 ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                                rec.priority >= 6 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                            }`}>
                                            {rec.priority >= 8 ? 'High' : rec.priority >= 6 ? 'Medium' : 'Low'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                                        💡 {rec.reason}
                                    </p>
                                    <Link
                                        href={`/pyq-search?topic=${encodeURIComponent(rec.topic)}`}
                                        className="inline-block w-full text-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                                    >
                                        Practice Now
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Essay Recommendations */}
                {recommendations?.essay && recommendations.essay.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                            📝 Suggested Essay Topics
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {recommendations.essay.slice(0, 4).map((rec, idx) => (
                                <div
                                    key={idx}
                                    className="bg-white dark:bg-slate-800 rounded-xl shadow-card p-6 border border-gray-200 dark:border-slate-700 hover:shadow-lg transition-shadow"
                                >
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                                        {rec.topic}
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                                        💡 {rec.reason}
                                    </p>
                                    <Link
                                        href={`/essay-builder?topic=${encodeURIComponent(rec.topic)}`}
                                        className="inline-block w-full text-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                                    >
                                        Start Writing
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Mock Test Recommendation */}
                {recommendations?.mockTest && (
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                            🎯 Next Mock Test
                        </h2>
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card p-6 border border-gray-200 dark:border-slate-700">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                        {recommendations.mockTest.subject || 'General Studies'}
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
                                        💡 {recommendations.mockTest.reason}
                                    </p>
                                    {recommendations.mockTest.difficulty && (
                                        <div className="flex gap-2 mb-4">
                                            <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-medium">
                                                Easy: {Math.round(recommendations.mockTest.difficulty.easy * 100)}%
                                            </span>
                                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-xs font-medium">
                                                Medium: {Math.round(recommendations.mockTest.difficulty.medium * 100)}%
                                            </span>
                                            <span className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-medium">
                                                Hard: {Math.round(recommendations.mockTest.difficulty.hard * 100)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="text-5xl">📊</div>
                            </div>
                            <Link
                                href="/mock-tests"
                                className="inline-block w-full text-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                            >
                                Create Test
                            </Link>
                        </div>
                    </div>
                )}

                {/* Current Affairs Recommendation */}
                {recommendations?.currentAffairs && recommendations.currentAffairs.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                            📰 Current Affairs Focus
                        </h2>
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-card p-6 border border-gray-200 dark:border-slate-700">
                            <ul className="space-y-3">
                                {recommendations.currentAffairs.slice(0, 5).map((rec, idx) => (
                                    <li key={idx} className="flex items-start">
                                        <span className="text-indigo-600 dark:text-indigo-400 mr-2">•</span>
                                        <div>
                                            <span className="font-medium text-gray-900 dark:text-white">{rec.category}</span>
                                            <p className="text-sm text-gray-600 dark:text-slate-400">💡 {rec.reason}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <Link
                                href="/current-affairs-digest"
                                className="inline-block w-full text-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium mt-4"
                            >
                                Generate Digest
                            </Link>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {(!recommendations || Object.keys(recommendations).length === 0) && (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">🎯</div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            Start Your Learning Journey
                        </h3>
                        <p className="text-gray-600 dark:text-slate-400 mb-6">
                            Use the platform to get personalized recommendations based on your study patterns
                        </p>
                        <div className="flex gap-4 justify-center">
                            <Link href="/pyq-search" className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                                Search PYQs
                            </Link>
                            <Link href="/mock-tests" className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                                Create Mock Test
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
