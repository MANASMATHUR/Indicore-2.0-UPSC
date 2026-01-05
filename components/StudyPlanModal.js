'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
    Calendar,
    Target,
    TrendingUp,
    CheckCircle,
    Clock,
    BookOpen,
    Award,
    X,
    ChevronRight,
    ChevronDown,
    Sparkles,
    AlertCircle
} from 'lucide-react';

export default function StudyPlanModal({ isOpen, onClose, userEmail }) {
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [selectedDay, setSelectedDay] = useState(null);

    // Fetch plan when modal opens
    useEffect(() => {
        if (isOpen && !plan) {
            fetchPlan();
        }
    }, [isOpen, plan]);

    const fetchPlan = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/study-plan/generate');
            if (!response.ok) {
                throw new Error(`Failed to fetch plan: ${response.statusText}`);
            }
            const data = await response.json();
            if (data.success) {
                setPlan(data.plan);
            } else {
                throw new Error(data.error || 'Failed to generate plan');
            }
        } catch (err) {
            console.error('Failed to fetch plan:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-6xl max-h-[90vh] overflow-hidden bg-white dark:bg-gray-900 rounded-2xl shadow-2xl"
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-gradient-to-r from-rose-600 to-red-600 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-bold flex items-center gap-2">
                                <Calendar className="w-8 h-8" />
                                Your 30-Day Success Plan
                            </h2>
                            <p className="text-rose-100 mt-1">Personalized roadmap to exam success</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-rose-600 border-t-transparent mb-4"></div>
                            <p className="text-gray-600 dark:text-gray-400">Generating your personalized plan...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Oops! Something went wrong</h3>
                            <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">{error}</p>
                            <Button onClick={fetchPlan} variant="outline" className="border-rose-200">
                                <TrendingUp className="w-4 h-4 mr-2" />
                                Try Again
                            </Button>
                        </div>
                    ) : plan ? (
                        <div className="space-y-6">
                            {/* Overview */}
                            <Card className="border-rose-200 dark:border-rose-800">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-rose-600" />
                                        Plan Overview
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="text-center p-4 bg-rose-50 dark:bg-rose-950/30 rounded-lg">
                                            <div className="text-2xl font-bold text-rose-600">{plan.overview.currentStreak}</div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">Current Streak</div>
                                        </div>
                                        <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                                            <div className="text-2xl font-bold text-orange-600">{plan.overview.targetDailyTime}m</div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">Target Daily Time</div>
                                        </div>
                                        <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                                            <div className="text-2xl font-bold text-green-600 capitalize">{plan.overview.focusQuality}</div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">Focus Quality</div>
                                        </div>
                                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                                            <div className="text-2xl font-bold text-blue-600 capitalize">{plan.overview.productivityTrend}</div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">Trend</div>
                                        </div>
                                    </div>

                                    {plan.overview.burnoutRisk !== 'low' && (
                                        <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg flex items-start gap-2">
                                            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">
                                                    Burnout Risk: {plan.overview.burnoutRisk}
                                                </p>
                                                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                                                    Make sure to take breaks and rest on Sundays
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Monthly Goals */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Target className="w-5 h-5 text-rose-600" />
                                        Monthly Goals
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {plan.goals.map((goal, idx) => (
                                            <div key={idx}>
                                                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{goal.category}</h4>
                                                <div className="space-y-2">
                                                    {goal.items.map((item, itemIdx) => (
                                                        <div key={itemIdx} className="flex items-start gap-2">
                                                            <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${item.priority === 'high' ? 'text-rose-600' : 'text-gray-400'
                                                                }`} />
                                                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                                                {item.target || item.topic}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Weekly Plans */}
                            <div className="space-y-4">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-rose-600" />
                                    Weekly Breakdown
                                </h3>

                                {plan.weeks.map((week, weekIdx) => (
                                    <Card key={weekIdx} className="border-rose-100 dark:border-rose-900/30">
                                        <CardHeader className="cursor-pointer" onClick={() => setSelectedWeek(selectedWeek === weekIdx ? null : weekIdx)}>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <CardTitle className="text-lg">{week.title}</CardTitle>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                        Focus: {week.focus.join(', ')}
                                                    </p>
                                                </div>
                                                <ChevronRight className={`w-5 h-5 transition-transform ${selectedWeek === weekIdx ? 'rotate-90' : ''}`} />
                                            </div>
                                        </CardHeader>

                                        <AnimatePresence>
                                            {selectedWeek === weekIdx && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                >
                                                    <CardContent>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                            {week.days.map((day, dayIdx) => (
                                                                <div
                                                                    key={dayIdx}
                                                                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-rose-300 dark:hover:border-rose-700 transition-colors cursor-pointer"
                                                                    onClick={() => setSelectedDay(selectedDay === `${weekIdx}-${dayIdx}` ? null : `${weekIdx}-${dayIdx}`)}
                                                                >
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div>
                                                                            <div className="font-semibold text-gray-900 dark:text-white">Day {day.dayNumber}</div>
                                                                            <div className="text-xs text-gray-500">{day.dayOfWeek} • {day.date}</div>
                                                                        </div>
                                                                        <Badge variant="outline" className="text-xs">
                                                                            {day.totalTime}m
                                                                        </Badge>
                                                                    </div>

                                                                    {selectedDay === `${weekIdx}-${dayIdx}` && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0 }}
                                                                            animate={{ opacity: 1 }}
                                                                            className="mt-3 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3"
                                                                        >
                                                                            {day.sessions.map((session, sessionIdx) => (
                                                                                <div key={sessionIdx} className="text-xs">
                                                                                    <div className="flex items-center gap-2 mb-1">
                                                                                        <Clock className="w-3 h-3 text-rose-600" />
                                                                                        <span className="font-medium">{session.time}</span>
                                                                                        <Badge variant="outline" className="text-xs">{session.duration}m</Badge>
                                                                                    </div>
                                                                                    <div className="font-semibold text-gray-900 dark:text-white">{session.topic}</div>
                                                                                    <ul className="mt-1 space-y-0.5 text-gray-600 dark:text-gray-400">
                                                                                        {session.activities.map((activity, actIdx) => (
                                                                                            <li key={actIdx}>• {activity}</li>
                                                                                        ))}
                                                                                    </ul>
                                                                                </div>
                                                                            ))}
                                                                        </motion.div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </CardContent>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </Card>
                                ))}
                            </div>

                            {/* Milestones */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Award className="w-5 h-5 text-rose-600" />
                                        Milestones to Achieve
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {plan.milestones.map((milestone, idx) => (
                                            <div key={idx} className="flex gap-4">
                                                <div className="flex-shrink-0 w-12 h-12 bg-rose-100 dark:bg-rose-950/30 rounded-full flex items-center justify-center">
                                                    <span className="font-bold text-rose-600">D{milestone.day}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-900 dark:text-white">{milestone.title}</h4>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">{milestone.description}</p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {milestone.checkpoints.map((checkpoint, cpIdx) => (
                                                            <Badge key={cpIdx} variant="outline" className="text-xs">
                                                                {checkpoint}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Recommendations */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-rose-600" />
                                        Personalized Tips
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {plan.recommendations.map((rec, idx) => (
                                            <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                <div className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                                                    {rec.category}
                                                </div>
                                                <div className="text-xs text-gray-700 dark:text-gray-300 mb-1">
                                                    {rec.suggestion}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                                                    {rec.reason}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Plan generated based on your study history and behavioral patterns
                        </p>
                        <Button onClick={onClose} variant="primary">
                            Got it!
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
