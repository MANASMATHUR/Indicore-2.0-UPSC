/**
 * Example Integration: Flashcard Tracking
 * Add this code to pages/api/flashcards/generate.js
 */

// At the top of the file, add import:
import { trackInteraction } from '@/lib/personalizationHelpers';
import { v4 as uuidv4 } from 'uuid';

// After successful flashcard generation, add tracking:

let sessionId = req.cookies.sessionId;
if (!sessionId) {
    sessionId = uuidv4();
    res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`);
}

await trackInteraction(
    session?.user?.email || null,
    sessionId,
    'flashcard',
    'flashcard_generate',
    'generate',
    {
        topic: topic || 'General',
        category: 'flashcard',
        engagementScore: 7,
        customData: {
            topic,
            flashcardCount: flashcards.length,
            source: 'notes' // or 'manual', 'ai_generated'
        }
    }
);
