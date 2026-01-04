/**
 * Smart Nudges Engine
 * Generates contextual, personalized nudges based on user behavior
 */

import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import StudySession from '@/models/StudySession';
import { calculateBurnoutRisk, analyzeProductivityPatterns } from '@/lib/behavioralInsights';
import { getNeglectedTopics, getWeakTopics } from '@/lib/smartRecommendations';

/**
 * Generate smart nudges for user
 */
export async function generateSmartNudges(userEmail) {
    await connectToDatabase();

    const [user, recentSessions, burnoutRisk, productivityPatterns] = await Promise.all([
        User.findOne({ email: userEmail }).lean(),
        StudySession.find({ userEmail }).sort({ startTime: -1 }).limit(10).lean(),
        calculateBurnoutRisk(userEmail, 14),
        analyzeProductivityPatterns(userEmail, 30)
    ]);

    const nudges = [];
    const currentHour = new Date().getHours();

    // 1. Peak productivity time nudge
    const isPeakTime = productivityPatterns.peakHours.some(p => p.hour === currentHour);
    if (isPeakTime && recentSessions.length > 0) {
        const lastSession = recentSessions[0];
        const hoursSinceLastStudy = (Date.now() - new Date(lastSession.endTime)) / (1000 * 60 * 60);

        if (hoursSinceLastStudy > 2) {
            nudges.push({
                type: 'peak_time',
                priority: 'high',
                icon: '🔥',
                title: 'Peak Productivity Time!',
                message: `Based on your patterns, now is your most productive time. Start a study session?`,
                action: {
                    label: 'Start Session',
                    type: 'start_study',
                    data: { suggestedDuration: 45 }
                },
                dismissible: true
            });
        }
    }

    // 2. Streak maintenance nudge
    const streak = user?.statistics?.studyStreak || 0;
    const lastStudyDate = user?.statistics?.lastStudyDate;
    if (lastStudyDate) {
        const daysSinceLastStudy = (Date.now() - new Date(lastStudyDate)) / (1000 * 60 * 60 * 24);

        if (daysSinceLastStudy >= 1 && daysSinceLastStudy < 2 && streak > 0) {
            nudges.push({
                type: 'streak_risk',
                priority: 'high',
                icon: '⚠️',
                title: 'Streak at Risk!',
                message: `Don't break your ${streak}-day streak! Study for at least 15 minutes today.`,
                action: {
                    label: 'Quick Session',
                    type: 'start_study',
                    data: { suggestedDuration: 15 }
                },
                dismissible: false
            });
        } else if (streak > 0 && streak % 7 === 0) {
            nudges.push({
                type: 'streak_milestone',
                priority: 'medium',
                icon: '🎉',
                title: 'Amazing Streak!',
                message: `${streak} days and counting! You're building great study habits.`,
                action: null,
                dismissible: true
            });
        }
    }

    // 3. Weak topic nudge
    const weakTopics = await getWeakTopics(userEmail, 3);
    if (weakTopics.length > 0) {
        const topWeakTopic = weakTopics[0];
        nudges.push({
            type: 'weak_topic',
            priority: 'medium',
            icon: '📚',
            title: 'Focus on Weak Areas',
            message: `${topWeakTopic.topic} needs attention. Spend 30 minutes reviewing concepts.`,
            action: {
                label: 'Study Now',
                type: 'study_topic',
                data: { topic: topWeakTopic.topic, category: topWeakTopic.category }
            },
            dismissible: true
        });
    }

    // 4. Neglected topic nudge
    const neglectedTopics = await getNeglectedTopics(userEmail, 5);
    if (neglectedTopics.length > 0) {
        const mostNeglected = neglectedTopics[0];
        nudges.push({
            type: 'neglected_topic',
            priority: 'medium',
            icon: '⏰',
            title: 'Topic Needs Revision',
            message: `You haven't studied ${mostNeglected.topic} in ${mostNeglected.daysSince} days. Quick revision?`,
            action: {
                label: 'Revise',
                type: 'study_topic',
                data: { topic: mostNeglected.topic, category: mostNeglected.category }
            },
            dismissible: true
        });
    }

    // 5. Burnout warning nudge
    if (burnoutRisk.riskLevel === 'high') {
        nudges.push({
            type: 'burnout_warning',
            priority: 'high',
            icon: '🛑',
            title: 'Take a Break!',
            message: `High burnout risk detected. Consider taking a rest day to recharge.`,
            action: {
                label: 'View Tips',
                type: 'view_burnout_tips',
                data: { recommendations: burnoutRisk.recommendations }
            },
            dismissible: false
        });
    } else if (burnoutRisk.riskLevel === 'moderate') {
        nudges.push({
            type: 'burnout_caution',
            priority: 'medium',
            icon: '⚡',
            title: 'Balance Your Study',
            message: `You're studying hard! Remember to take breaks and maintain balance.`,
            action: null,
            dismissible: true
        });
    }

    // 6. Performance trend nudge
    if (productivityPatterns.productivityTrend === 'declining' && recentSessions.length >= 5) {
        nudges.push({
            type: 'performance_decline',
            priority: 'medium',
            icon: '📉',
            title: 'Productivity Declining',
            message: `Your recent sessions show lower productivity. Try shorter, focused sessions.`,
            action: {
                label: 'Adjust Plan',
                type: 'view_recommendations'
            },
            dismissible: true
        });
    } else if (productivityPatterns.productivityTrend === 'improving') {
        nudges.push({
            type: 'performance_improving',
            priority: 'low',
            icon: '📈',
            title: 'Great Progress!',
            message: `Your productivity is improving! Keep up the excellent work.`,
            action: null,
            dismissible: true
        });
    }

    // 7. Break reminder nudge (if currently studying)
    const ongoingSession = await getOngoingSession(userEmail);
    if (ongoingSession) {
        const sessionDuration = (Date.now() - new Date(ongoingSession.startTime)) / (1000 * 60);
        if (sessionDuration > 50 && ongoingSession.breaksTaken === 0) {
            nudges.push({
                type: 'break_reminder',
                priority: 'high',
                icon: '☕',
                title: 'Time for a Break',
                message: `You've been studying for ${Math.floor(sessionDuration)} minutes. Take a 10-minute break.`,
                action: {
                    label: 'Start Break',
                    type: 'start_break',
                    data: { duration: 10 }
                },
                dismissible: false
            });
        }
    }

    // 8. Motivational nudge (random, low frequency)
    if (Math.random() < 0.1 && nudges.length < 3) {
        const motivationalMessages = [
            'Small daily improvements lead to stunning results!',
            'Consistency is the key to success in UPSC preparation.',
            'Every study session brings you closer to your goal.',
            'Your dedication today shapes your success tomorrow.',
            'Focus on progress, not perfection.'
        ];

        nudges.push({
            type: 'motivational',
            priority: 'low',
            icon: '💪',
            title: 'Stay Motivated',
            message: motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)],
            action: null,
            dismissible: true
        });
    }

    // Sort by priority and limit to top 5
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return nudges
        .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
        .slice(0, 5);
}

/**
 * Check if user should receive a nudge (timing optimization)
 */
export async function shouldSendNudge(userEmail, nudgeType) {
    await connectToDatabase();

    // Get user's last nudge timestamp for this type
    const user = await User.findOne({ email: userEmail }).lean();

    // Implement cooldown periods for different nudge types
    const cooldownPeriods = {
        peak_time: 4 * 60 * 60 * 1000, // 4 hours
        weak_topic: 24 * 60 * 60 * 1000, // 24 hours
        neglected_topic: 24 * 60 * 60 * 1000, // 24 hours
        burnout_warning: 48 * 60 * 60 * 1000, // 48 hours
        streak_risk: 12 * 60 * 60 * 1000, // 12 hours
        break_reminder: 0, // No cooldown - real-time
        motivational: 48 * 60 * 60 * 1000 // 48 hours
    };

    const cooldown = cooldownPeriods[nudgeType] || 24 * 60 * 60 * 1000;

    // Check last nudge time (would need to store this in user model)
    // For now, return true
    return true;
}

/**
 * Get optimal time to send nudge
 */
export function getOptimalNudgeTime(productivityPatterns) {
    // Send nudges during peak productivity hours
    if (productivityPatterns.peakHours.length > 0) {
        return productivityPatterns.peakHours[0].hour;
    }

    // Default to morning
    return 9;
}

// Helper functions

async function getOngoingSession(userEmail) {
    const recentSession = await StudySession.findOne({
        userEmail,
        endTime: { $exists: false } // Session not ended yet
    }).sort({ startTime: -1 });

    return recentSession;
}

async function getWeakTopics(userEmail, limit = 5) {
    const user = await User.findOne({ email: userEmail }).lean();

    if (!user?.profile?.personalization?.topicInterests) {
        return [];
    }

    const weakTopics = user.profile.personalization.topicInterests
        .filter(t => t.engagementScore < 3 || t.frequency > 5)
        .sort((a, b) => a.engagementScore - b.engagementScore)
        .slice(0, limit)
        .map(t => ({
            topic: t.topic,
            category: t.category || 'General',
            engagementScore: t.engagementScore,
            frequency: t.frequency
        }));

    return weakTopics;
}

async function getNeglectedTopics(userEmail, daysThreshold = 7) {
    const user = await User.findOne({ email: userEmail }).lean();

    if (!user?.profile?.personalization?.topicInterests) {
        return [];
    }

    const now = new Date();
    const neglected = user.profile.personalization.topicInterests
        .filter(t => {
            if (!t.lastAsked) return false;
            const daysSince = (now - new Date(t.lastAsked)) / (1000 * 60 * 60 * 24);
            return daysSince >= daysThreshold;
        })
        .map(t => {
            const daysSince = Math.floor((now - new Date(t.lastAsked)) / (1000 * 60 * 60 * 24));
            return {
                topic: t.topic,
                category: t.category || 'General',
                daysSince,
                lastStudied: t.lastAsked
            };
        })
        .sort((a, b) => b.daysSince - a.daysSince);

    return neglected;
}

export default {
    generateSmartNudges,
    shouldSendNudge,
    getOptimalNudgeTime
};
