import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import {
    analyzeUserBehaviorPatterns,
    getUserPerformanceStats,
    getPersonalizedRecommendations
} from '@/lib/personalizationHelpers';
import UserInteraction from '@/models/UserInteraction';
import User from '@/models/User';

/**
 * Get user behavior insights and analytics
 * GET /api/personalization/insights
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        await connectToDatabase();

        // Get session
        const session = await getServerSession(req, res, authOptions);

        if (!session?.user?.email) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Please login to view insights'
            });
        }

        const userEmail = session.user.email;

        // Get user
        const user = await User.findOne({ email: userEmail }).lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Gather all insights
        const [
            behaviorPatterns,
            performanceStats,
            recommendations,
            topicFrequency,
            recentActivity
        ] = await Promise.all([
            analyzeUserBehaviorPatterns(userEmail),
            getUserPerformanceStats(userEmail),
            getPersonalizedRecommendations(userEmail),
            UserInteraction.getTopicFrequency(user._id, 30),
            UserInteraction.getRecentInteractions(user._id, 20)
        ]);

        // Calculate study streak
        const studyStreak = await calculateStudyStreak(user._id);

        // Get interaction summary by type
        const interactionSummary = await UserInteraction.aggregate([
            {
                $match: {
                    userId: user._id,
                    timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: '$interactionType',
                    count: { $sum: 1 },
                    avgEngagement: { $avg: '$metadata.engagementScore' },
                    totalTimeSpent: { $sum: '$metadata.timeSpent' }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        return res.status(200).json({
            success: true,
            insights: {
                behaviorPatterns,
                performanceStats,
                topicFrequency,
                interactionSummary,
                studyStreak,
                recentActivity: recentActivity.slice(0, 10)
            },
            recommendations: recommendations.recommendations || {},
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in insights endpoint:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

/**
 * Calculate user's study streak
 */
async function calculateStudyStreak(userId) {
    try {
        const interactions = await UserInteraction.find({
            userId,
            timestamp: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        })
            .sort({ timestamp: -1 })
            .lean();

        if (interactions.length === 0) {
            return { currentStreak: 0, longestStreak: 0, lastStudyDate: null };
        }

        // Group by date
        const dateSet = new Set();
        interactions.forEach(int => {
            const date = new Date(int.timestamp).toISOString().split('T')[0];
            dateSet.add(date);
        });

        const dates = Array.from(dateSet).sort().reverse();

        // Calculate current streak
        let currentStreak = 0;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        if (dates[0] === today || dates[0] === yesterday) {
            currentStreak = 1;
            for (let i = 1; i < dates.length; i++) {
                const prevDate = new Date(dates[i - 1]);
                const currDate = new Date(dates[i]);
                const diffDays = Math.floor((prevDate - currDate) / (24 * 60 * 60 * 1000));

                if (diffDays === 1) {
                    currentStreak++;
                } else {
                    break;
                }
            }
        }

        // Calculate longest streak
        let longestStreak = 1;
        let tempStreak = 1;

        for (let i = 1; i < dates.length; i++) {
            const prevDate = new Date(dates[i - 1]);
            const currDate = new Date(dates[i]);
            const diffDays = Math.floor((prevDate - currDate) / (24 * 60 * 60 * 1000));

            if (diffDays === 1) {
                tempStreak++;
                longestStreak = Math.max(longestStreak, tempStreak);
            } else {
                tempStreak = 1;
            }
        }

        return {
            currentStreak,
            longestStreak,
            lastStudyDate: dates[0],
            totalStudyDays: dates.length
        };

    } catch (error) {
        console.error('Error calculating study streak:', error);
        return { currentStreak: 0, longestStreak: 0, lastStudyDate: null };
    }
}
