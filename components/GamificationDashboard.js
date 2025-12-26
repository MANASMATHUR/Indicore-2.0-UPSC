'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
    Trophy,
    Star,
    Zap,
    Target,
    Award,
    Flame,
    BookOpen,
    CheckCircle,
    Lock,
    Sparkles,
    TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GamificationDashboard({ userStats }) {
    const [achievements, setAchievements] = useState([]);
    const [userLevel, setUserLevel] = useState(1);
    const [xp, setXp] = useState(0);
    const [xpToNextLevel, setXpToNextLevel] = useState(100);
    const [showCelebration, setShowCelebration] = useState(false);

    useEffect(() => {
        calculateGamificationData();
    }, [userStats]);

    const calculateGamificationData = () => {
        const mockTestsCompleted = userStats?.mockTestsCompleted || 0;
        const studyStreak = userStats?.studyStreak || 0;
        const averageScore = userStats?.averageScore || 0;

        // Calculate XP and Level
        const totalXP = (mockTestsCompleted * 50) + (studyStreak * 10) + (averageScore * 2);
        const level = Math.floor(totalXP / 100) + 1;
        const currentXP = totalXP % 100;
        const nextLevelXP = 100;

        setUserLevel(level);
        setXp(currentXP);
        setXpToNextLevel(nextLevelXP);

        // Define all achievements
        const allAchievements = [
            {
                id: 'first_steps',
                title: 'First Steps',
                description: 'Complete your first mock test',
                icon: Target,
                unlocked: mockTestsCompleted >= 1,
                progress: Math.min(mockTestsCompleted, 1),
                total: 1,
                xpReward: 50,
                rarity: 'common'
            },
            {
                id: 'dedicated_learner',
                title: 'Dedicated Learner',
                description: 'Maintain a 7-day study streak',
                icon: Flame,
                unlocked: studyStreak >= 7,
                progress: Math.min(studyStreak, 7),
                total: 7,
                xpReward: 100,
                rarity: 'rare'
            },
            {
                id: 'test_master',
                title: 'Test Master',
                description: 'Complete 10 mock tests',
                icon: Trophy,
                unlocked: mockTestsCompleted >= 10,
                progress: Math.min(mockTestsCompleted, 10),
                total: 10,
                xpReward: 200,
                rarity: 'epic'
            },
            {
                id: 'high_achiever',
                title: 'High Achiever',
                description: 'Score 80% or above',
                icon: Star,
                unlocked: averageScore >= 80,
                progress: Math.min(averageScore, 80),
                total: 80,
                xpReward: 150,
                rarity: 'rare'
            },
            {
                id: 'consistency_king',
                title: 'Consistency King',
                description: 'Achieve a 30-day streak',
                icon: Award,
                unlocked: studyStreak >= 30,
                progress: Math.min(studyStreak, 30),
                total: 30,
                xpReward: 300,
                rarity: 'legendary'
            },
            {
                id: 'perfect_score',
                title: 'Perfect Score',
                description: 'Score 100% on a mock test',
                icon: Sparkles,
                unlocked: averageScore >= 100,
                progress: Math.min(averageScore, 100),
                total: 100,
                xpReward: 500,
                rarity: 'legendary'
            }
        ];

        setAchievements(allAchievements);

        // Check for new achievements
        const newlyUnlocked = allAchievements.filter(a => a.unlocked && a.progress === a.total);
        if (newlyUnlocked.length > 0) {
            setShowCelebration(true);
            setTimeout(() => setShowCelebration(false), 3000);
        }
    };

    const getRarityColor = (rarity) => {
        switch (rarity) {
            case 'common': return 'from-gray-400 to-gray-600';
            case 'rare': return 'from-blue-400 to-blue-600';
            case 'epic': return 'from-purple-400 to-purple-600';
            case 'legendary': return 'from-yellow-400 to-orange-500';
            default: return 'from-gray-400 to-gray-600';
        }
    };

    const getRarityBadgeColor = (rarity) => {
        switch (rarity) {
            case 'common': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
            case 'rare': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
            case 'epic': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
            case 'legendary': return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const unlockedAchievements = achievements.filter(a => a.unlocked);
    const lockedAchievements = achievements.filter(a => !a.unlocked);

    return (
        <div className="space-y-6">
            {/* Celebration Animation */}
            <AnimatePresence>
                {showCelebration && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 50 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -50 }}
                        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-2xl border-4 border-yellow-400"
                    >
                        <div className="text-center">
                            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                Achievement Unlocked!
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Keep up the great work!
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Level & XP Card */}
            <Card className="border-rose-100 dark:border-rose-900/30 shadow-xl rounded-2xl overflow-hidden bg-gradient-to-br from-rose-500 to-red-600">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30">
                                <Zap className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <div className="text-white/80 text-sm font-medium">Current Level</div>
                                <div className="text-4xl font-black text-white">
                                    {userLevel}
                                </div>
                            </div>
                        </div>
                        <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-4 py-2 text-sm">
                            {xp} / {xpToNextLevel} XP
                        </Badge>
                    </div>

                    {/* XP Progress Bar */}
                    <div>
                        <div className="flex justify-between text-xs text-white/80 mb-2">
                            <span>Progress to Level {userLevel + 1}</span>
                            <span>{Math.round((xp / xpToNextLevel) * 100)}%</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden backdrop-blur-sm">
                            <motion.div
                                className="h-3 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${(xp / xpToNextLevel) * 100}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Achievements Grid */}
            <Card className="border-rose-100 dark:border-rose-900/30 shadow-xl rounded-2xl overflow-hidden">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-600" />
                        Achievements
                        <Badge variant="secondary" className="ml-2">
                            {unlockedAchievements.length} / {achievements.length}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Unlocked Achievements */}
                    {unlockedAchievements.length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-rose-600" />
                                Unlocked ({unlockedAchievements.length})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {unlockedAchievements.map((achievement, idx) => {
                                    const Icon = achievement.icon;
                                    return (
                                        <motion.div
                                            key={achievement.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: idx * 0.1 }}
                                            className="p-4 rounded-xl bg-gradient-to-br from-white to-rose-50/50 dark:from-gray-800 dark:to-rose-950/20 border-2 border-rose-200 dark:border-rose-800 hover:shadow-lg transition-all duration-300"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getRarityColor(achievement.rarity)} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                                                    <Icon className="w-6 h-6 text-white" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h5 className="font-bold text-gray-900 dark:text-white text-sm">
                                                            {achievement.title}
                                                        </h5>
                                                        <Badge className={`text-xs px-2 py-0 ${getRarityBadgeColor(achievement.rarity)}`}>
                                                            {achievement.rarity}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                                        {achievement.description}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles className="w-3 h-3 text-yellow-600" />
                                                        <span className="text-xs font-semibold text-yellow-600">
                                                            +{achievement.xpReward} XP
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Locked Achievements */}
                    {lockedAchievements.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Lock className="w-4 h-4 text-gray-400" />
                                Locked ({lockedAchievements.length})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {lockedAchievements.map((achievement, idx) => {
                                    const Icon = achievement.icon;
                                    const progressPercent = (achievement.progress / achievement.total) * 100;

                                    return (
                                        <motion.div
                                            key={achievement.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: idx * 0.1 }}
                                            className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 opacity-75 hover:opacity-100 transition-all duration-300"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                                    <Icon className="w-6 h-6 text-gray-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h5 className="font-bold text-gray-700 dark:text-gray-300 text-sm">
                                                            {achievement.title}
                                                        </h5>
                                                        <Lock className="w-3 h-3 text-gray-400" />
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                        {achievement.description}
                                                    </p>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                                                            <span>Progress</span>
                                                            <span>{achievement.progress} / {achievement.total}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                                            <div
                                                                className="h-1.5 bg-gradient-to-r from-rose-500 to-red-500 rounded-full transition-all duration-500"
                                                                style={{ width: `${progressPercent}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="border-rose-100 dark:border-rose-900/30 bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/20 dark:to-rose-900/20">
                    <CardContent className="p-4 text-center">
                        <Trophy className="w-8 h-8 text-rose-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {unlockedAchievements.length}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                            Achievements
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-red-100 dark:border-red-900/30 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/20">
                    <CardContent className="p-4 text-center">
                        <Zap className="w-8 h-8 text-red-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {userLevel}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                            Current Level
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-yellow-100 dark:border-yellow-900/30 bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-950/20 dark:to-yellow-900/20">
                    <CardContent className="p-4 text-center">
                        <Star className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {xp}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                            Total XP
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
