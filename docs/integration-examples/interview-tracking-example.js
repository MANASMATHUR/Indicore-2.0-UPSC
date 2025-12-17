/**
 * Example Integration: Interview Prep Tracking
 * Add this code to pages/api/interview/generate-questions.js
 */

// At the top of the file, add import:
import { trackInteraction } from '@/lib/personalizationHelpers';
import { v4 as uuidv4 } from 'uuid';

// After successful question generation, add tracking:

let sessionId = req.cookies.sessionId;
if (!sessionId) {
    sessionId = uuidv4();
    res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`);
}

await trackInteraction(
    session?.user?.email || null,
    sessionId,
    'interview',
    'interview_questions',
    'generate',
    {
        topic: 'Interview Preparation',
        category: 'interview',
        engagementScore: 9, // High engagement for interview prep
        customData: {
            dafUploaded: !!dafText,
            questionCount: questions.length,
            questionTypes: questions.map(q => q.type)
        }
    }
);
