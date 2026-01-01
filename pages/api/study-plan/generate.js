/**
 * 30-Day Study Plan API
 * GET /api/study-plan/generate
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { generate30DayPlan } from '@/lib/studyPlanGenerator';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const session = await getServerSession(req, res, authOptions);
        if (!session?.user?.email) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const plan = await generate30DayPlan(session.user.email);

        return res.status(200).json({
            success: true,
            plan,
            generatedAt: new Date()
        });
    } catch (error) {
        console.error('30-day plan generation error:', error);
        return res.status(500).json({
            error: 'Failed to generate study plan',
            details: error.message
        });
    }
}
