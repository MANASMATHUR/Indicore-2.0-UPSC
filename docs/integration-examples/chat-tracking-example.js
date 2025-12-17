/**
 * Example Integration: Chat API Tracking
 * Add this code to pages/api/ai/chat.js
 */

// At the top of the file, add import:
import { trackInteraction } from '@/lib/personalizationHelpers';
import { v4 as uuidv4 } from 'uuid';

// In the chatHandler function, after successful response generation, add tracking:

// Get or create session ID
let sessionId = req.cookies.sessionId;
if (!sessionId) {
    sessionId = uuidv4();
    res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`);
}

// Track the interaction
await trackInteraction(
    session?.user?.email || null,
    sessionId,
    'chat',
    'chat_message',
    'generate',
    {
        topic: extractTopicFromMessage(message), // You can create this helper
        category: 'general',
        timeSpent: 0, // Can be calculated from start time
        engagementScore: 7, // Base score for chat
        followUpActions: conversationHistory.length > 0 ? 1 : 0,
        customData: {
            model,
            language,
            messageLength: message.length,
            isPyqQuery: initialMessageIsPyq
        }
    },
    {
        userAgent: req.headers['user-agent'],
        device: detectDevice(req.headers['user-agent'])
    }
);

// Helper function to extract topic (add to the file)
function extractTopicFromMessage(message) {
    // Simple topic extraction - can be enhanced with AI
    const topics = {
        'polity': /polity|constitution|parliament|judiciary|governance/i,
        'history': /history|ancient|medieval|modern|freedom|struggle/i,
        'geography': /geography|climate|monsoon|river|mountain/i,
        'economics': /economics|economy|gdp|inflation|fiscal/i,
        'environment': /environment|ecology|biodiversity|climate change/i,
        'science': /science|technology|innovation|research/i
    };

    for (const [topic, pattern] of Object.entries(topics)) {
        if (pattern.test(message)) {
            return topic;
        }
    }

    return 'general';
}
