/**
 * Comprehensive Dashboard API
 * GET /api/dashboard/personalized
 * Returns all personalization data in one call
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { generateBehavioralInsights } from '@/lib/behavioralInsights';
import { getStudyNowRecommendation, generateDailyStudyPlan } from '@/lib/smartRecommendations';
import { generateSmartNudges } from '@/lib/smartNudges';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import StudySession from '@/models/StudySession';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const session = await getServerSession(req, res, authOptions);
        if (!session?.user?.email) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        await connectToDatabase();

        // Fetch all data in parallel
        const [user, behavioralInsights, studyNow, dailyPlan, nudges, recentSessions] = await Promise.all([
            User.findOne({ email: session.user.email }).lean(),
            generateBehavioralInsights(session.user.email, 30),
            getStudyNowRecommendation(session.user.email),
            generateDailyStudyPlan(session.user.email),
            generateSmartNudges(session.user.email),
            StudySession.find({ userEmail: session.user.email })
                .sort({ startTime: -1 })
                .limit(7)
                .lean()
        ]);

        // Calculate quick stats
        const totalStudyTime = recentSessions.reduce((sum, s) => sum + s.duration, 0);
        const avgFocusScore = recentSessions.length > 0
            ? recentSessions.reduce((sum, s) => sum + (s.focusScore || 0.5), 0) / recentSessions.length
            : 0.5;

        const response = {
            user: {
                name: user?.name,
                email: user?.email,
                streak: user?.statistics?.studyStreak || 0,
                totalStudyTime: user?.statistics?.totalStudyTime || 0
            },
            quickStats: {
                last7DaysStudyTime: Math.round(totalStudyTime),
                avgFocusScore: avgFocusScore.toFixed(2),
                sessionsThisWeek: recentSessions.length
            },
            behavioralInsights,
            recommendations: {
                studyNow,
                dailyPlan
            },
            nudges,
            generatedAt: new Date()
        };

        return res.status(200).json({
            success: true,
            dashboard: response
        });
    } catch (error) {
        console.error('Dashboard API error:', error);
        return res.status(500).json({
            error: 'Failed to load dashboard data',
            details: error.message
        });
    }
}
