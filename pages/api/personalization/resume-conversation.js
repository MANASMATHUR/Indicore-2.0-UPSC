import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import Chat from '@/models/Chat';
import User from '@/models/User';

/**
 * Conversation Resume API
 * Detects incomplete conversations and provides context to resume
 * GET /api/personalization/resume-conversation
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        await connectToDatabase();

        const session = await getServerSession(req, res, authOptions);
        if (!session?.user?.email) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get user's most recent chat
        const lastChat = await Chat.findOne({
            userEmail: session.user.email
        })
            .sort({ lastMessageAt: -1 })
            .lean();

        if (!lastChat || !lastChat.messages || lastChat.messages.length === 0) {
            return res.status(200).json({
                success: true,
                hasResumable: false,
                message: 'No previous conversation found'
            });
        }

        // Check if conversation is recent (within last 24 hours)
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const lastMessageTime = new Date(lastChat.lastMessageAt);
        if (lastMessageTime < twentyFourHoursAgo) {
            return res.status(200).json({
                success: true,
                hasResumable: false,
                message: 'Last conversation is too old'
            });
        }

        // Analyze if conversation seems incomplete
        const isIncomplete = detectIncompleteConversation(lastChat);

        if (!isIncomplete) {
            return res.status(200).json({
                success: true,
                hasResumable: false,
                message: 'Last conversation appears complete'
            });
        }

        // Extract context from conversation
        const context = extractConversationContext(lastChat);

        // Generate resume prompts
        const resumePrompts = generateResumePrompts(context);

        return res.status(200).json({
            success: true,
            hasResumable: true,
            conversation: {
                chatId: lastChat._id,
                topic: context.topic,
                lastMessage: context.lastUserMessage,
                messageCount: lastChat.messages.length,
                timeSince: getTimeSince(lastMessageTime)
            },
            context: {
                topic: context.topic,
                summary: context.summary,
                keywords: context.keywords
            },
            resumePrompts,
            recommendedAction: getRecommendedAction(context)
        });

    } catch (error) {
        console.error('Error in resume-conversation endpoint:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// Helper functions
function detectIncompleteConversation(chat) {
    const messages = chat.messages;
    if (messages.length < 2) return false;

    const lastMessage = messages[messages.length - 1];
    const secondLastMessage = messages[messages.length - 2];

    // Conversation is incomplete if:
    // 1. Last message is from user (no AI response yet)
    if (lastMessage.sender === 'user') return true;

    // 2. AI response seems cut off or prompts for more
    if (lastMessage.sender === 'assistant') {
        const text = lastMessage.text?.toLowerCase() || '';

        // Check for incomplete sentences
        if (text.length < 50) return true;

        // Check for follow-up indicators
        const followUpIndicators = [
            'would you like to know more',
            'shall i explain',
            'would you like me to',
            'do you want to',
            'should i continue',
            'want to explore',
            'interested in learning',
            'tell me if you',
            'let me know if'
        ];

        if (followUpIndicators.some(indicator => text.includes(indicator))) {
            return true;
        }
    }

    // 3. User asked a deep question with short conversation
    if (secondLastMessage.sender === 'user' && messages.length < 6) {
        const userMsg = secondLastMessage.text?.toLowerCase() || '';
        if (userMsg.includes('explain') || userMsg.includes('how') || userMsg.includes('why')) {
            return true;
        }
    }

    return false;
}

function extractConversationContext(chat) {
    const messages = chat.messages;
    const userMessages = messages.filter(m => m.sender === 'user');
    const aiMessages = messages.filter(m => m.sender === 'assistant');

    // Get last user message
    const lastUserMessage = userMessages.length > 0
        ? userMessages[userMessages.length - 1].text
        : '';

    // Extract topic
    const topic = extractTopicFromMessages(userMessages);

    // Create summary
    const summary = createConversationSummary(messages);

    // Extract keywords
    const keywords = extractKeywordsFromMessages(messages);

    return {
        lastUserMessage,
        topic,
        summary,
        keywords,
        messageCount: messages.length,
        userMessageCount: userMessages.length,
        aiMessageCount: aiMessages.length
    };
}

function extractTopicFromMessages(messages) {
    const allText = messages.map(m => m.text || '').join(' ').toLowerCase();

    if (allText.includes('polity') || allText.includes('constitution')) return 'Polity';
    if (allText.includes('history') || allText.includes('ancient')) return 'History';
    if (allText.includes('geography') || allText.includes('climate')) return 'Geography';
    if (allText.includes('economy') || allText.includes('economic')) return 'Economics';
    if (allText.includes('science') || allText.includes('technology')) return 'Science & Technology';
    if (allText.includes('environment') || allText.includes('ecology')) return 'Environment';
    if (allText.includes('ethics') || allText.includes('integrity')) return 'Ethics';
    if (allText.includes('current affairs') || allText.includes('news')) return 'Current Affairs';

    return 'General Discussion';
}

function createConversationSummary(messages) {
    if (messages.length < 2) return 'Brief conversation';

    const firstUserMsg = messages.find(m => m.sender === 'user')?.text || '';
    const topic = extractTopicFromMessages(messages);

    return `Discussion about ${topic}: "${firstUserMsg.substring(0, 100)}${firstUserMsg.length > 100 ? '...' : ''}"`;
}

function extractKeywordsFromMessages(messages) {
    const allText = messages.map(m => m.text || '').join(' ').toLowerCase();
    const words = allText.split(/\s+/);

    // Simple frequency count
    const wordCount = {};
    words.forEach(word => {
        if (word.length > 5) {
            wordCount[word] = (wordCount[word] || 0) + 1;
        }
    });

    // Get top 5 keywords
    const sorted = Object.entries(wordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);

    return sorted;
}

function generateResumePrompts(context) {
    const prompts = [
        {
            text: `Continue our ${context.topic} discussion`,
            type: 'continue',
            action: 'resume_topic'
        },
        {
            text: `More details on: "${context.lastUserMessage.substring(0, 50)}..."`,
            type: 'expand',
            action: 'expand_last'
        }
    ];

    // Add topic-specific prompts
    if (context.topic !== 'General Discussion') {
        prompts.push({
            text: `Ask another ${context.topic} question`,
            type: 'related',
            action: 'new_related_question'
        });
    }

    // Add follow-up if conversation was short
    if (context.messageCount < 6) {
        prompts.push({
            text: `Dive deeper into ${context.topic}`,
            type: 'deep_dive',
            action: 'deep_exploration'
        });
    }

    return prompts.slice(0, 3); // Return top 3
}

function getRecommendedAction(context) {
    if (context.messageCount < 4) {
        return {
            action: 'Continue exploring this topic - you just started',
            priority: 'high',
            suggestion: 'Ask follow-up questions to deepen understanding'
        };
    }

    if (context.topic !== 'General Discussion') {
        return {
            action: `Complete your ${context.topic} learning`,
            priority: 'medium',
            suggestion: 'Review what you discussed and try related PYQs'
        };
    }

    return {
        action: 'Resume or start fresh',
        priority: 'low',
        suggestion: 'Either continue or begin a new topic'
    };
}

function getTimeSince(date) {
    const now = new Date();
    const diff = now - date;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) {
        const minutes = Math.floor(diff / (1000 * 60));
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    if (hours < 24) {
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }

    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
}
