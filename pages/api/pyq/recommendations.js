import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { getPYQRecommendations } from '@/lib/personalizationHelpers';

/**
 * PYQ Recommendations API
 * GET /api/pyq/recommendations
 * Returns personalized PYQ topic recommendations based on user's weak areas
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
        const { limit = 5 } = req.query;

        // Get personalized recommendations
        const recommendations = await getPYQRecommendations(
            session.user.email,
            parseInt(limit, 10)
        );

        return res.status(200).json({
            ok: true,
            recommendations,
            message: recommendations.length > 0
                ? `Based on your performance, we recommend focusing on these ${recommendations.length} areas`
                : 'Keep taking tests to get personalized recommendations!'
        });
    } catch (error) {
        console.error('Error getting PYQ recommendations:', error);
        return res.status(500).json({
            ok: false,
            error: 'Failed to get recommendations',
            details: error.message
        });
    }
}
