/**
 * Smart Recommendations API
 * GET /api/recommendations/smart-study
 * Returns personalized study recommendations
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import {
    getStudyNowRecommendation,
    generateDailyStudyPlan,
    getTopicPriorityRanking
} from '@/lib/smartRecommendations';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const session = await getServerSession(req, res, authOptions);
        if (!session?.user?.email) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { type = 'all' } = req.query;

        let response = {};

        if (type === 'now' || type === 'all') {
            response.studyNow = await getStudyNowRecommendation(session.user.email);
        }

        if (type === 'daily' || type === 'all') {
            response.dailyPlan = await generateDailyStudyPlan(session.user.email);
        }

        if (type === 'priority' || type === 'all') {
            response.topicPriorities = await getTopicPriorityRanking(session.user.email);
        }

        return res.status(200).json({
            success: true,
            recommendations: response,
            generatedAt: new Date()
        });
    } catch (error) {
        console.error('Smart recommendations error:', error);
        return res.status(500).json({
            error: 'Failed to generate recommendations',
            details: error.message
        });
    }
}
