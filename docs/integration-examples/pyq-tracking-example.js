/**
 * Example Integration: PYQ Search Tracking
 * Add this code to pages/api/pyq/search.js
 */

// At the top of the file, add import:
import { trackInteraction } from '@/lib/personalizationHelpers';
import { v4 as uuidv4 } from 'uuid';

// In the handler function, after successful PYQ search, add tracking:

// Get or create session ID
let sessionId = req.cookies.sessionId;
if (!sessionId) {
    sessionId = uuidv4();
    res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`);
}

// Track the search interaction
await trackInteraction(
    session?.user?.email || null,
    sessionId,
    'pyq',
    'pyq_search',
    'search',
    {
        topic: query || theme, // Search query or theme
        subject: theme,
        category: 'pyq_search',
        engagementScore: results.length > 0 ? 8 : 5, // Higher if results found
        customData: {
            query,
            theme,
            exam,
            year,
            resultsCount: results.length,
            fromYear,
            toYear
        }
    },
    {
        userAgent: req.headers['user-agent']
    }
);

// If user clicks on a specific PYQ to view details, track that too:
// (This would be in a separate endpoint or when user requests analysis)
await trackInteraction(
    session?.user?.email || null,
    sessionId,
    'pyq',
    'pyq_view',
    'view',
    {
        topic: pyq.theme,
        subject: pyq.theme,
        category: 'pyq',
        timeSpent: 0, // Can be tracked from frontend
        customData: {
            pyqId: pyq._id,
            exam: pyq.exam,
            year: pyq.year,
            paper: pyq.paper
        }
    }
);
