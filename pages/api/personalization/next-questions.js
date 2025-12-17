import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import Chat from '@/models/Chat';
import User from '@/models/User';

/**
 * Smart Next Question Suggestions API
 * Analyzes user's chat history to suggest relevant next questions
 * GET /api/personalization/next-questions
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

        const user = await User.findOne({ email: session.user.email }).lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get recent chats (last 10)
        const recentChats = await Chat.find({
            userEmail: session.user.email
        })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        if (recentChats.length === 0) {
            // No chat history - suggest starter questions
            return res.status(200).json({
                success: true,
                suggestions: getStarterQuestions()
            });
        }

        // Analyze recent topics
        const recentTopics = extractTopicsFromChats(recentChats);
        const currentLevel = determineCurrentLevel(recentChats);

        // Get all discussed subjects
        const discussedSubjects = new Set();
        recentTopics.forEach(topic => discussedSubjects.add(topic));

        // Find gaps (subjects not discussed)
        const ALL_SUBJECTS = ['Polity', 'History', 'Geography', 'Economics', 'Science & Technology', 'Environment', 'Ethics', 'Current Affairs'];
        const gaps = ALL_SUBJECTS.filter(s => !discussedSubjects.has(s));

        // Generate suggestions
        const suggestions = [];

        // 1. Follow-up on recent topic (if any deep dive detected)
        const lastTopic = recentTopics[0];
        if (lastTopic && recentChats[0].messages?.length > 4) {
            suggestions.push({
                question: generateFollowUpQuestion(lastTopic, currentLevel),
                reason: `Continue exploring ${lastTopic}`,
                type: 'follow_up',
                topic: lastTopic,
                priority: 'high'
            });
        }

        // 2. Related topic progression
        if (lastTopic) {
            const relatedTopic = getRelatedTopic(lastTopic);
            if (relatedTopic) {
                suggestions.push({
                    question: generateQuestionForTopic(relatedTopic, currentLevel),
                    reason: `Natural progression from ${lastTopic}`,
                    type: 'progression',
                    topic: relatedTopic,
                    priority: 'medium'
                });
            }
        }

        // 3. Fill study gaps
        if (gaps.length > 0) {
            const gapSubject = gaps[0]; // Pick first gap
            suggestions.push({
                question: generateQuestionForTopic(gapSubject, currentLevel),
                reason: `You haven't discussed ${gapSubject} yet`,
                type: 'gap_fill',
                topic: gapSubject,
                priority: 'high'
            });
        }

        // 4. Level-appropriate challenge
        if (currentLevel === 'intermediate') {
            suggestions.push({
                question: generateAdvancedQuestion(lastTopic || 'Polity'),
                reason: 'Challenge yourself with an advanced question',
                type: 'level_up',
                topic: lastTopic || 'Polity',
                priority: 'medium'
            });
        }

        // 5. PYQ-style question
        suggestions.push({
            question: generatePYQStyleQuestion(lastTopic || recentTopics[0] || 'Polity'),
            reason: 'Practice with PYQ-style question',
            type: 'pyq_practice',
            topic: lastTopic || recentTopics[0] || 'Polity',
            priority: 'medium'
        });

        return res.status(200).json({
            success: true,
            suggestions: suggestions.slice(0, 5), // Return top 5
            context: {
                recentTopics: recentTopics.slice(0, 3),
                currentLevel,
                gaps: gaps.slice(0, 3)
            }
        });

    } catch (error) {
        console.error('Error in next-questions endpoint:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// Helper functions
function extractTopicsFromChats(chats) {
    const topics = [];
    chats.forEach(chat => {
        const userMessages = (chat.messages || []).filter(m => m.sender === 'user');
        userMessages.forEach(msg => {
            const topic = extractTopicFromText(msg.text);
            if (topic !== 'General Discussion') {
                topics.push(topic);
            }
        });
    });
    return topics;
}

function extractTopicFromText(text) {
    if (!text) return 'General Discussion';
    const lowerText = text.toLowerCase();

    if (lowerText.includes('polity') || lowerText.includes('constitution') || lowerText.includes('government')) return 'Polity';
    if (lowerText.includes('history') || lowerText.includes('ancient') || lowerText.includes('medieval')) return 'History';
    if (lowerText.includes('geography') || lowerText.includes('climate') || lowerText.includes('map')) return 'Geography';
    if (lowerText.includes('economy') || lowerText.includes('economic') || lowerText.includes('finance')) return 'Economics';
    if (lowerText.includes('science') || lowerText.includes('technology')) return 'Science & Technology';
    if (lowerText.includes('environment') || lowerText.includes('ecology')) return 'Environment';
    if (lowerText.includes('ethics') || lowerText.includes('integrity')) return 'Ethics';
    if (lowerText.includes('current affairs') || lowerText.includes('news')) return 'Current Affairs';

    return 'General Discussion';
}

function determineCurrentLevel(chats) {
    let avgComplexity = 0;
    let count = 0;

    chats.forEach(chat => {
        (chat.messages || []).filter(m => m.sender === 'user').forEach(msg => {
            if (!msg.text) return;
            count++;

            const text = msg.text.toLowerCase();
            if (/^(what is|who is|when|where|define)/i.test(text)) {
                avgComplexity += 1;
            } else if (/how|why|compare|difference/i.test(text)) {
                avgComplexity += 3;
            } else if (/critically|analyze|evaluate|assess/i.test(text)) {
                avgComplexity += 7;
            } else {
                avgComplexity += 2;
            }
        });
    });

    const avg = count > 0 ? avgComplexity / count : 0;
    return avg < 2.5 ? 'beginner' : avg < 5 ? 'intermediate' : 'advanced';
}

function getRelatedTopic(topic) {
    const relations = {
        'Polity': 'Judiciary System',
        'History': 'Art & Culture',
        'Geography': 'Environment',
        'Economics': 'Current Affairs',
        'Science & Technology': 'Environment',
        'Environment': 'Geography',
        'Ethics': 'Governance',
        'Current Affairs': 'Economics'
    };
    return relations[topic] || null;
}

function generateFollowUpQuestion(topic, level) {
    const questions = {
        'Polity': {
            'beginner': 'What are the key features of Indian federalism?',
            'intermediate': 'How does the Indian federal system differ from the US model?',
            'advanced': 'Critically analyze the challenges to federalism in India with recent examples.'
        },
        'History': {
            'beginner': 'What were the main causes of the Indian independence movement?',
            'intermediate': 'How did the Non-Cooperation Movement shape Indian nationalism?',
            'advanced': 'Evaluate the role of economic factors in India\'s freedom struggle.'
        },
        'Geography': {
            'beginner': 'What are the major physiographic divisions of India?',
            'intermediate': 'How does the monsoon system affect Indian agriculture?',
            'advanced': 'Analyze the impact of climate change on India\'s water security.'
        },
        'Economics': {
            'beginner': 'What is GDP and how is it calculated?',
            'intermediate': 'How does fiscal policy impact economic growth?',
            'advanced': 'Critically evaluate India\'s economic liberalization policies since 1991.'
        }
    };

    return questions[topic]?.[level] || `Tell me more about ${topic}`;
}

function generateQuestionForTopic(topic, level) {
    return generateFollowUpQuestion(topic, level);
}

function generateAdvancedQuestion(topic) {
    const questions = {
        'Polity': 'Critically analyze the effectiveness of the separation of powers in India.',
        'History': 'Evaluate the socio-economic impact of British colonial policies on modern India.',
        'Geography': 'Analyze the strategic importance of India\'s maritime boundaries.',
        'Economics': 'Assess the impact of globalization on India\'s agricultural sector.'
    };
    return questions[topic] || `Critically analyze recent developments in ${topic}`;
}

function generatePYQStyleQuestion(topic) {
    const questions = {
        'Polity': 'Discuss the role and significance of the Election Commission of India.',
        'History': 'Examine the impact of the Quit India Movement on the freedom struggle.',
        'Geography': 'Explain the concept of sustainable development in the Indian context.',
        'Economics': 'Analyze the role of NITI Aayog in India\'s planning process.'
    };
    return questions[topic] || `Discuss the significance of ${topic} in the UPSC context`;
}

function getStarterQuestions() {
    return [
        {
            question: 'What is the structure of the Indian Constitution?',
            reason: 'Start with fundamental Polity concepts',
            type: 'starter',
            topic: 'Polity',
            priority: 'high'
        },
        {
            question: 'Explain the concept of Indian federalism',
            reason: 'Core topic for UPSC preparation',
            type: 'starter',
            topic: 'Polity',
            priority: 'high'
        },
        {
            question: 'What are the major physiographic divisions of India?',
            reason: 'Essential Geography foundation',
            type: 'starter',
            topic: 'Geography',
            priority: 'medium'
        },
        {
            question: 'How does GDP measurement work in India?',
            reason: 'Important Economics concept',
            type: 'starter',
            topic: 'Economics',
            priority: 'medium'
        },
        {
            question: 'What was the impact of the Quit India Movement?',
            reason: 'Key History topic',
            type: 'starter',
            topic: 'History',
            priority: 'medium'
        }
    ];
}
