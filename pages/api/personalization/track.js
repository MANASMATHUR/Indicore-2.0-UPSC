import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import { trackInteraction, trackGuestInteraction } from '@/lib/personalizationHelpers';
import { v4 as uuidv4 } from 'uuid';

/**
 * Universal tracking endpoint for all user interactions
 * POST /api/personalization/track
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        await connectToDatabase();

        const {
            interactionType,
            feature,
            action,
            metadata = {},
            deviceInfo = {}
        } = req.body;

        // Validate required fields
        if (!interactionType || !feature || !action) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['interactionType', 'feature', 'action']
            });
        }

        // Get session (if authenticated)
        const session = await getServerSession(req, res, authOptions);

        // Get or create session ID
        let sessionId = req.cookies.sessionId;
        if (!sessionId) {
            sessionId = uuidv4();
            // Set cookie for 30 days
            res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`);
        }

        // Extract device info from request
        const userAgent = req.headers['user-agent'] || '';
        const enrichedDeviceInfo = {
            userAgent,
            device: detectDevice(userAgent),
            browser: detectBrowser(userAgent),
            os: detectOS(userAgent),
            ...deviceInfo
        };

        let interaction;

        if (session?.user?.email) {
            // Authenticated user
            interaction = await trackInteraction(
                session.user.email,
                sessionId,
                interactionType,
                feature,
                action,
                metadata,
                enrichedDeviceInfo
            );
        } else {
            // Guest user
            interaction = await trackGuestInteraction(sessionId, {
                interactionType,
                feature,
                action,
                metadata,
                deviceInfo: enrichedDeviceInfo
            });
        }

        if (!interaction) {
            return res.status(500).json({ error: 'Failed to track interaction' });
        }

        return res.status(200).json({
            success: true,
            interactionId: interaction._id,
            sessionId,
            isGuest: !session?.user?.email
        });

    } catch (error) {
        console.error('Error in track endpoint:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// Helper functions
function detectDevice(userAgent) {
    if (!userAgent) return 'unknown';
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) return 'tablet';
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) return 'mobile';
    return 'desktop';
}

function detectBrowser(userAgent) {
    if (!userAgent) return 'unknown';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'unknown';
}

function detectOS(userAgent) {
    if (!userAgent) return 'unknown';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    return 'unknown';
}
