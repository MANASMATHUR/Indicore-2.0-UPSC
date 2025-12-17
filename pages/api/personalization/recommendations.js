import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { getPersonalizedRecommendations } from '@/lib/personalizationHelpers';

/**
 * Get personalized recommendations for user
 * GET /api/personalization/recommendations?type=pyq|essay|mock_test|current_affairs|study_schedule|all
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
                message: 'Please login to get personalized recommendations'
            });
        }

        const { type } = req.query;

        // Validate type if provided
        const validTypes = ['pyq', 'essay', 'mock_test', 'current_affairs', 'study_schedule', 'all'];
        if (type && !validTypes.includes(type)) {
            return res.status(400).json({
                error: 'Invalid type',
                validTypes
            });
        }

        const recommendationType = type === 'all' ? null : type;

        // Get recommendations
        const result = await getPersonalizedRecommendations(
            session.user.email,
            recommendationType
        );

        return res.status(200).json({
            success: true,
            ...result,
            user: session.user.email
        });

    } catch (error) {
        console.error('Error in recommendations endpoint:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
