/**
 * Smart Nudges API
 * GET /api/nudges/generate
 * Returns personalized nudges for user
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { generateSmartNudges } from '@/lib/smartNudges';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const session = await getServerSession(req, res, authOptions);
        if (!session?.user?.email) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const nudges = await generateSmartNudges(session.user.email);

        return res.status(200).json({
            success: true,
            nudges,
            count: nudges.length,
            generatedAt: new Date()
        });
    } catch (error) {
        console.error('Smart nudges error:', error);
        return res.status(500).json({
            error: 'Failed to generate nudges',
            details: error.message
        });
    }
}
