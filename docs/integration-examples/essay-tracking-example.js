/**
 * Example Integration: Essay Generation Tracking
 * Add this code to pages/api/essay/generate.js
 */

// At the top of the file, add import:
import { trackInteraction } from '@/lib/personalizationHelpers';
import { v4 as uuidv4 } from 'uuid';

// After successful essay generation, add tracking:

let sessionId = req.cookies.sessionId;
if (!sessionId) {
    sessionId = uuidv4();
    res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`);
}

await trackInteraction(
    session?.user?.email || null,
    sessionId,
    'essay',
    'essay_generate',
    'generate',
    {
        topic: topic,
        category: 'essay',
        engagementScore: 8,
        wordCount: generatedEssay.length,
        customData: {
            topic,
            wordLimit: wordLimit || 1000,
            language: language || 'en',
            essayType: 'generated'
        }
    }
);
