/**
 * Behavioral Insights API
 * GET /api/analytics/behavioral-insights
 * Returns comprehensive behavioral analysis for user
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { generateBehavioralInsights } from '@/lib/behavioralInsights';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const session = await getServerSession(req, res, authOptions);
        if (!session?.user?.email) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { days = 30 } = req.query;
        const daysNum = parseInt(days);

        if (isNaN(daysNum) || daysNum < 1 || daysNum > 90) {
            return res.status(400).json({ error: 'Invalid days parameter (1-90)' });
        }

        const insights = await generateBehavioralInsights(session.user.email, daysNum);

        return res.status(200).json({
            success: true,
            insights,
            generatedAt: new Date()
        });
    } catch (error) {
        console.error('Behavioral insights error:', error);
        return res.status(500).json({
            error: 'Failed to generate behavioral insights',
            details: error.message
        });
    }
}
