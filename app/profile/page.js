'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
    Sparkles,
    Target,
    FileText,
    BarChart3,
    TrendingUp,
    Flame,
    BookOpen,
    Clock,
    Award,
    Calendar,
    Brain,
    ChevronRight,
    ArrowRight,
    Activity,
    MessageSquare,
    CheckCircle,
    AlertCircle,
    Users,
    Zap,
    Trophy,
    Star,
    TrendingDown,
    Lightbulb,
    HelpCircle
} from 'lucide-react';
import AnimatedCard from '@/components/AnimatedCard';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [recommendations, setRecommendations] = useState(null);
    const [userStats, setUserStats] = useState(null);
    const [recentActivity, setRecentActivity] = useState([]);
    const [chatInsights, setChatInsights] = useState(null);
    const [resumableChat, setResumableChat] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login?redirect=/profile');
            return;
        }

        if (session?.user) {
            fetchDashboardData();
        }
    }, [session, status, router]);

    const fetchDashboardData = async () => {
        try {
            const [recsRes, statsRes, chatRes, resumeRes] = await Promise.all([
                fetch('/api/personalization/recommendations?type=all'),
                fetch('/api/user/analytics'),
                fetch('/api/personalization/chat-insights'),
                fetch('/api/personalization/resume-conversation')
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

            if (chatRes.ok) {
                const chatData = await chatRes.json();
                if (chatData.success && chatData.hasData) {
                    setChatInsights(chatData.insights);
                }
            }

            if (resumeRes.ok) {
                const resumeData = await resumeRes.json();
                if (resumeData.success && resumeData.hasResumable) {
                    setResumableChat(resumeData);
                }
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (status === 'loading' || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    if (!session) return null;

    const userName = session.user?.name || 'User';
    const userEmail = session.user?.email || '';
    const studyStreak = userStats?.studyStreak || 0;
    const mockTestsCompleted = userStats?.mockTestsCompleted || 0;
    const averageScore = userStats?.averageScore || 0;
    const totalTimeSpent = userStats?.totalTimeSpent || 0;

    const hasRecommendations = recommendations && (
        (recommendations.pyq && recommendations.pyq.length > 0) ||
        (recommendations.essay && recommendations.essay.length > 0) ||
        (recommendations.mock_test && recommendations.mock_test.length > 0)
    );

    // Calculate progress percentage (simple heuristic based on activity)
    const progressPercentage = Math.min(
        Math.round((mockTestsCompleted * 10) + (studyStreak * 2)),
        100
    );

    // AI COACH  - Mapping weak areas to features
    const getAICoachRecommendation = () => {
        if (!chatInsights || !chatInsights.difficultyLevel) return [];

        const streak = studyStreak;
        const score = averageScore;

        const isWeakInTopic = (topic) => {
            return topic && score < 40;
        };

        const coachInsights = [];

        // 1. Streak Motivation
        if (streak > 0) {
            coachInsights.push({
                type: 'motivation',
                title: 'Keep the momentum!',
                text: `You've studied for ${streak} consecutive days. Consistency is the secret to UPSC success.`,
                icon: <Zap className="w-5 h-5 text-yellow-500" />,
                action: 'Continue Session'
            });
        }

        // 2. Feature Mapping (History/Polity/etc)
        const historyData = chatInsights.topTopics?.find(t => t.topic === 'History');
        if (historyData && isWeakInTopic('History')) {
            coachInsights.push({
                type: 'feature_map',
                title: 'History Deep Dive',
                text: 'History seems to be a focus area but could use more practice. Try writing a History Essay or practicing specific PYQs.',
                icon: <FileText className="w-5 h-5 text-purple-500" />,
                links: [
                    { label: 'History Essay', href: '/writing-tools?tab=essay&topic=Modern Indian History' },
                    { label: 'History PYQs', href: '/pyq-archive?search=History' }
                ]
            });
        }

        // 3. General "Weak Area" detection from chatInsights (if available)
        const favoriteSubject = chatInsights.favoriteSubjects?.[0]?.subject;
        if (favoriteSubject && score < 50) {
            coachInsights.push({
                type: 'improvement',
                title: `Master ${favoriteSubject}`,
                text: `You're discussing ${favoriteSubject} a lot. Turn that interest into results with a targeted Mock Test.`,
                icon: <Target className="w-5 h-5 text-red-500" />,
                links: [{ label: 'Practice Test', href: '/mock-tests' }]
            });
        }

        // Fallback for new users
        if (coachInsights.length === 0) {
            coachInsights.push({
                type: 'onboarding',
                title: 'Ready to Start?',
                text: 'Take your first Mock Test to see where you stand and get personalized study tips.',
                icon: <Sparkles className="w-5 h-5 text-purple-500" />,
                links: [{ label: 'First Mock Test', href: '/mock-tests' }]
            });
        }

        return coachInsights;
    };

    const coachInsights = getAICoachRecommendation();

    // Dynamic Greeting Logic
    const getDynamicGreeting = () => {
        const hour = new Date().getHours();
        let timeGreeting = "Good Morning";
        if (hour >= 12 && hour < 17) timeGreeting = "Good Afternoon";
        else if (hour >= 17) timeGreeting = "Good Evening";

        const topTopic = chatInsights?.topTopics?.[0]?.topic;

        if (studyStreak >= 3) {
            return {
                title: `You're on fire, ${userName.split(' ')[0]}! 🔥`,
                subtitle: `${studyStreak} days streak and counting. Ready to conquer ${topTopic || 'the syllabus'} today?`
            };
        }

        if (topTopic) {
            return {
                title: `${timeGreeting}, ${userName.split(' ')[0]}! 👋`,
                subtitle: `Continuing your study in ${topTopic}? You're making great progress.`
            };
        }

        return {
            title: `Welcome back, ${userName.split(' ')[0]}! 👋`,
            subtitle: userEmail
        };
    };

    const greeting = getDynamicGreeting();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-indigo-50/20 dark:from-gray-950 dark:via-purple-950/20 dark:to-indigo-950/10">
            {/* Header / Hero */}
            <div className="relative bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-700 text-white py-14 px-4 sm:px-6 lg:px-8 overflow-hidden">
                {/* Decorative background elements */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                    <div className="absolute -top-24 -left-24 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-400 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                </div>

                <div className="max-w-7xl mx-auto relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="flex items-start justify-between"
                    >
                        <div>
                            <h1 className="text-4xl md:text-5xl font-extrabold mb-3 tracking-tight">
                                {greeting.title}
                            </h1>
                            <p className="text-purple-100 text-xl font-medium opacity-90 max-w-2xl">
                                {greeting.subtitle}
                            </p>
                        </div>
                        <motion.div
                            animate={{
                                scale: [1, 1.1, 1],
                                rotate: [0, 5, -5, 0]
                            }}
                            transition={{ duration: 4, repeat: Infinity }}
                        >
                            <Sparkles className="w-14 h-14 text-purple-200" />
                        </motion.div>
                    </motion.div>

                    {/* Quick Stats Bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                            <div className="flex items-center gap-3">
                                <Flame className="w-8 h-8 text-orange-300" />
                                <div>
                                    <div className="text-3xl font-bold">{studyStreak}</div>
                                    <div className="text-sm text-purple-200">Day Streak</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                            <div className="flex items-center gap-3">
                                <BarChart3 className="w-8 h-8 text-emerald-300" />
                                <div>
                                    <div className="text-3xl font-bold">{mockTestsCompleted}</div>
                                    <div className="text-sm text-purple-200">Tests Completed</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                            <div className="flex items-center gap-3">
                                <Award className="w-8 h-8 text-yellow-300" />
                                <div>
                                    <div className="text-3xl font-bold">{averageScore}%</div>
                                    <div className="text-sm text-purple-200">Avg Score</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                            <div className="flex items-center gap-3">
                                <Clock className="w-8 h-8 text-blue-300" />
                                <div>
                                    <div className="text-3xl font-bold">{Math.round(totalTimeSpent / 60) || 0}h</div>
                                    <div className="text-sm text-purple-200">Study Time</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* AI Coach Insights (Personalized Section) */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <Brain className="w-5 h-5 text-purple-600" />
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">AI Coach Insights</h2>
                                <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">New</Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <AnimatePresence mode="popLayout">
                                    {coachInsights.map((insight, idx) => (
                                        <AnimatedCard
                                            key={idx}
                                            delay={idx * 0.1}
                                            className="h-full bg-white dark:bg-gray-900 border border-purple-100 dark:border-purple-900/30 rounded-2xl shadow-md overflow-hidden"
                                        >
                                            <div className="p-5 flex flex-col h-full">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                                                        {insight.icon}
                                                    </div>
                                                    <h3 className="font-bold text-gray-900 dark:text-gray-100">{insight.title}</h3>
                                                </div>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-grow leading-relaxed">
                                                    {insight.text}
                                                </p>
                                                <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-gray-50 dark:border-gray-800">
                                                    {insight.links ? insight.links.map((link, lIdx) => (
                                                        <Link key={lIdx} href={link.href} className="flex-1">
                                                            <Button size="sm" variant="outline" className="w-full text-xs font-semibold py-1 hover:bg-purple-600 hover:text-white transition-all">
                                                                {link.label}
                                                            </Button>
                                                        </Link>
                                                    )) : (
                                                        <Button size="sm" className="w-full text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white">
                                                            {insight.action}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </AnimatedCard>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </section>

                        {/* Pick Up Where You Left Off */}
                        {resumableChat && (
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <Clock className="w-5 h-5 text-indigo-600" />
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Pick Up Where You Left Off</h2>
                                </div>
                                <AnimatedCard className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200 dark:border-indigo-900/40 rounded-2xl overflow-hidden glassmorphism">
                                    <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge className="bg-indigo-600 text-white border-0">{resumableChat.conversation.topic}</Badge>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">{resumableChat.conversation.timeSince}</span>
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">
                                                "{resumableChat.conversation.lastMessage}"
                                            </h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {resumableChat.recommendedAction.suggestion}
                                            </p>
                                        </div>
                                        <div className="flex gap-3 w-full md:w-auto">
                                            <Link href={`/chat?id=${resumableChat.conversation.chatId}`} className="flex-1 md:flex-none">
                                                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 px-8">
                                                    Resume Discussion
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </AnimatedCard>
                            </section>
                        )}

                        {/* Study Progress */}
                        <Card className="border-purple-100 dark:border-purple-900/30 shadow-xl rounded-2xl overflow-hidden glassmorphism">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-purple-600" />
                                    Your Study Progress
                                </CardTitle>
                                <CardDescription>Track your journey to success</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Overall Progress
                                            </span>
                                            <span className="text-sm font-semibold text-purple-600">
                                                {progressPercentage}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-purple-600 to-indigo-600 h-3 rounded-full transition-all duration-500"
                                                style={{ width: `${progressPercentage}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Predictive Score Trend */}
                                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white dark:bg-purple-900/40 rounded-lg shadow-sm">
                                                <TrendingUp className="w-4 h-4 text-purple-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Score Trend</div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {averageScore > 0 ? `Target: ${Math.min(100, Math.round(averageScore * 1.1))}% next test` : 'Start mock tests to see trend'}
                                                </div>
                                            </div>
                                        </div>
                                        {averageScore > 0 && (
                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0 flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" />
                                                Improving
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 pt-4">
                                        <div className="text-center">
                                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                                                <CheckCircle className="w-6 h-6 text-green-600" />
                                            </div>
                                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {mockTestsCompleted}
                                            </div>
                                            <div className="text-xs text-gray-600 dark:text-gray-400">Completed</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                                                <Activity className="w-6 h-6 text-yellow-600" />
                                            </div>
                                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {studyStreak}
                                            </div>
                                            <div className="text-xs text-gray-600 dark:text-gray-400">Active Days</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                                                <Trophy className="w-6 h-6 text-purple-600" />
                                            </div>
                                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {averageScore}%
                                            </div>
                                            <div className="text-xs text-gray-600 dark:text-gray-400">Best Score</div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Chat Insights Section */}
                        {chatInsights && chatInsights.totalConversations > 0 && (
                            <Card className="border-indigo-100 dark:border-indigo-900/30 shadow-lg overflow-hidden">
                                <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
                                    <CardTitle className="flex items-center gap-2">
                                        <MessageSquare className="w-5 h-5 text-indigo-600" />
                                        Chat Insights
                                    </CardTitle>
                                    <CardDescription>Your AI conversation patterns and learning analytics</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    {/* Stats Overview */}
                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                        <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                            <div className="text-2xl font-bold text-indigo-600">{chatInsights.totalConversations}</div>
                                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Conversations</div>
                                        </div>
                                        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                            <div className="text-2xl font-bold text-purple-600">{chatInsights.last7Days}</div>
                                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Last 7 Days</div>
                                        </div>
                                        <div className="text-center p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                                            <div className="text-2xl font-bold text-pink-600">{chatInsights.averageEngagement.toFixed(1)}</div>
                                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Avg Engagement</div>
                                        </div>
                                    </div>

                                    {/* DIFFICULTY BADGE */}
                                    {chatInsights.difficultyLevel && (
                                        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your Learning Level</div>
                                                    <div className="flex items-center gap-3">
                                                        <Badge
                                                            className={`text-lg px-4 py-1 ${chatInsights.difficultyLevel.current === 'beginner' ? 'bg-green-100 text-green-800 border-green-300' :
                                                                chatInsights.difficultyLevel.current === 'intermediate' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                                                    'bg-purple-100 text-purple-800 border-purple-300'
                                                                }`}
                                                        >
                                                            {chatInsights.difficultyLevel.current.charAt(0).toUpperCase() + chatInsights.difficultyLevel.current.slice(1)}
                                                        </Badge>
                                                        {chatInsights.difficultyLevel.trend === 'improving' && (
                                                            <div className="flex items-center gap-1 text-green-600 text-sm">
                                                                <TrendingUp className="w-4 h-4" />
                                                                <span>Improving!</span>
                                                            </div>
                                                        )}
                                                        {chatInsights.difficultyLevel.trend === 'declining' && (
                                                            <div className="flex items-center gap-1 text-orange-600 text-sm">
                                                                <TrendingDown className="w-4 h-4" />
                                                                <span>Needs focus</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-3xl font-bold text-purple-600">
                                                        {chatInsights.difficultyLevel.score}
                                                    </div>
                                                    <div className="text-xs text-gray-500">Complexity Score</div>
                                                </div>
                                            </div>
                                            {chatInsights.difficultyLevel.current === 'beginner' && (
                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                                                    💡 Focus on understanding core concepts. Try asking "how" and "why" questions to deepen your knowledge!
                                                </p>
                                            )}
                                            {chatInsights.difficultyLevel.current === 'intermediate' && (
                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                                                    📈 Great progress! Ready for analytical and comparative questions. Challenge yourself with complex topics!
                                                </p>
                                            )}
                                            {chatInsights.difficultyLevel.current === 'advanced' && (
                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                                                    🎓 Excellent! You're asking advanced-level questions. Focus on critical analysis and application!
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Top Topics */}
                                    {chatInsights.topTopics && chatInsights.topTopics.length > 0 && (
                                        <div className="mb-6">
                                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
                                                <Brain className="w-4 h-4 text-indigo-600" />
                                                Top Discussion Topics
                                            </h4>
                                            <div className="space-y-2">
                                                {chatInsights.topTopics.map((topic, idx) => (
                                                    <div key={idx} className="flex items-center gap-3">
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                                    {topic.topic}
                                                                </span>
                                                                <span className="text-xs text-gray-500">
                                                                    {topic.count} chats
                                                                </span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                                <div
                                                                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                                                                    style={{ width: `${topic.percentage}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Favorite Subjects */}
                                    {chatInsights.favoriteSubjects && chatInsights.favoriteSubjects.length > 0 && (
                                        <div className="mb-6">
                                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
                                                <Star className="w-4 h-4 text-yellow-600" />
                                                Favorite Subjects
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {chatInsights.favoriteSubjects.map((subject, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg"
                                                    >
                                                        <div className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                                                            {subject.subject}
                                                        </div>
                                                        <div className="text-xs text-indigo-600 dark:text-indigo-400">
                                                            {subject.count} discussions
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Study Pattern */}
                                    {chatInsights.studyPattern && (
                                        <div className="mb-6">
                                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-blue-600" />
                                                Study Pattern
                                            </h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Peak Study Time</div>
                                                    <div className="text-lg font-bold text-blue-600">
                                                        {chatInsights.studyPattern.peakTime}
                                                    </div>
                                                </div>
                                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Active Days</div>
                                                    <div className="text-lg font-bold text-green-600">
                                                        {chatInsights.studyPattern.consistency} days
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Question Types */}
                                    {chatInsights.questionTypes && chatInsights.questionTypes.length > 0 && (
                                        <div>
                                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
                                                <BarChart3 className="w-4 h-4 text-purple-600" />
                                                Question Types
                                            </h4>
                                            <div className="grid grid-cols-3 gap-2">
                                                {chatInsights.questionTypes.map((qt, idx) => (
                                                    <div key={idx} className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                                                            {qt.percentage}%
                                                        </div>
                                                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                            {qt.type}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}


                    </div>

                    {/* Right Sidebar */}
                    <div className="space-y-6">
                        {/* Quick Actions */}
                        <Card className="border-purple-100 dark:border-purple-900/30 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-yellow-600" />
                                    Quick Actions
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Link href="/chat">
                                    <Button variant="outline" className="w-full justify-start" size="sm">
                                        <MessageSquare className="w-4 h-4 mr-2" />
                                        Start AI Chat
                                    </Button>
                                </Link>
                                <Link href="/mock-tests">
                                    <Button variant="outline" className="w-full justify-start" size="sm">
                                        <BarChart3 className="w-4 h-4 mr-2" />
                                        Take Mock Test
                                    </Button>
                                </Link>
                                <Link href="/pyq-archive">
                                    <Button variant="outline" className="w-full justify-start" size="sm">
                                        <Target className="w-4 h-4 mr-2" />
                                        Browse PYQs
                                    </Button>
                                </Link>
                                <Link href="/writing-tools">
                                    <Button variant="outline" className="w-full justify-start" size="sm">
                                        <FileText className="w-4 h-4 mr-2" />
                                        Writing Tools
                                    </Button>
                                </Link>
                                <Link href="/current-affairs">
                                    <Button variant="outline" className="w-full justify-start" size="sm">
                                        <Calendar className="w-4 h-4 mr-2" />
                                        Current Affairs
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>

                        {/* Study Streak */}
                        <Card className="border-orange-100 dark:border-orange-900/30 shadow-lg bg-gradient-to-br from-orange-50/50 to-red-50/50 dark:from-orange-950/20 dark:to-red-950/20">
                            <CardContent className="pt-6">
                                <div className="text-center">
                                    <Flame className="w-16 h-16 text-orange-500 mx-auto mb-3" />
                                    <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                                        {studyStreak}
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                        Day Study Streak
                                    </p>
                                    {studyStreak > 0 ? (
                                        <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                                            🔥 Keep it going! Don't break the streak!
                                        </p>
                                    ) : (
                                        <p className="text-xs text-gray-500">
                                            Start studying today to begin your streak!
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Predictive Milestone */}
                        <Card className="border-purple-100 dark:border-purple-900/30 shadow-lg bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 rounded-2xl">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-yellow-600" />
                                    Next Milestone
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1.5 font-medium">
                                            <span className="text-gray-600 dark:text-gray-400">7-Day Streak Badge</span>
                                            <span className="text-purple-600">{studyStreak}/7 days</span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000"
                                                style={{ width: `${(studyStreak / 7) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    {mockTestsCompleted < 10 && (
                                        <div>
                                            <div className="flex justify-between text-xs mb-1.5 font-medium">
                                                <span className="text-gray-600 dark:text-gray-400">PYQ Explorer Badge</span>
                                                <span className="text-indigo-600">{mockTestsCompleted}/10 tests</span>
                                            </div>
                                            <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 transition-all duration-1000"
                                                    style={{ width: `${(mockTestsCompleted / 10) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <div className="pt-2">
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 italic text-center">
                                            "You're remarkably consistent. The next milestone is just {7 - (studyStreak % 7)} days away!"
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Performance Insights */}
                        <Card className="border-purple-100 dark:border-purple-900/30 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Brain className="w-5 h-5 text-purple-600" />
                                    Insights
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <Star className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            Your average score is {averageScore}%
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                            {averageScore >= 70 ? 'Excellent work! Keep it up!' : 'Keep practicing to improve!'}
                                        </p>
                                    </div>
                                </div>
                                {studyStreak >= 7 && (
                                    <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                7-day streak achieved!
                                            </p>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                Consistency is key to success
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {mockTestsCompleted === 0 && (
                                    <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                Take your first mock test
                                            </p>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                Tests help identify weak areas
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
