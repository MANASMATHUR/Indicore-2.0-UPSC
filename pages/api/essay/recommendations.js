import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { getPersonalizedEssayTopics } from '@/lib/personalizationHelpers';

/**
 * Essay Topic Recommendations API
 * GET /api/essay/recommendations
 * Returns personalized essay topics based on user's strengths, goals, and interests
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { count = 5 } = req.query;

        // Get personalized essay topics
        const topics = await getPersonalizedEssayTopics(
            session.user.email,
            parseInt(count, 10)
        );

        if (topics.length === 0) {
            // Fallback to generic topics
            return res.status(200).json({
                ok: true,
                topics: [
                    { topic: 'Digital India', reason: 'current_affairs', category: 'Technology' },
                    { topic: 'Climate Change', reason: 'current_affairs', category: 'Environment' },
                    { topic: 'Women Empowerment', reason: 'social_issues', category: 'Society' },
                    { topic: 'Education Reform', reason: 'policy', category: 'Education' },
                    { topic: 'Good Governance', reason: 'polity', category: 'Governance' }
                ],
                message: 'Here are some popular essay topics. Take tests and update your profile for personalized suggestions!'
            });
        }

        return res.status(200).json({
            ok: true,
            topics,
            message: `These topics match your strengths and goals`
        });
    } catch (error) {
        console.error('Error getting essay recommendations:', error);
        return res.status(500).json({
            ok: false,
            error: 'Failed to get recommendations',
            details: error.message
        });
    }
}
