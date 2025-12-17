/**
 * Example Integration: Current Affairs Tracking
 * Add this code to pages/api/current-affairs/digest.js
 */

// At the top of the file, add import:
import { trackInteraction } from '@/lib/personalizationHelpers';
import { v4 as uuidv4 } from 'uuid';

// After successful digest generation, add tracking:

let sessionId = req.cookies.sessionId;
if (!sessionId) {
    sessionId = uuidv4();
    res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`);
}

await trackInteraction(
    session?.user?.email || null,
    sessionId,
    'current_affairs',
    'digest_generate',
    'generate',
    {
        topic: 'Current Affairs',
        category: 'current_affairs',
        engagementScore: 7,
        customData: {
            timePeriod: timePeriod || 'daily',
            days: days,
            newsCount: newsArticles.length,
            digestLength: digest.length
        }
    }
);
