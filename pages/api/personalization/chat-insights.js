import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import connectToDatabase from '@/lib/mongodb';
import UserInteraction from '@/models/UserInteraction';
import User from '@/models/User';
import Chat from '@/models/Chat';

/**
 * Get chat insights and analytics for dashboard
 * GET /api/personalization/chat-insights
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('Chat insights API called');
        await connectToDatabase();
        console.log('DB Connected in insights');

        const session = await getServerSession(req, res, authOptions);
        if (!session?.user?.email) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = await User.findOne({ email: session.user.email }).lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get chat interactions from last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Get BOTH: New tracked interactions AND existing chat conversations
        const chatInteractions = await UserInteraction.find({
            userEmail: session.user.email,
            interactionType: 'chat',
            timestamp: { $gte: thirtyDaysAgo }
        })
            .sort({ timestamp: -1 })
            .limit(200)
            .lean();
        // const chatInteractions = []; // TEMPORARY MOCK

        // ALSO get existing chat conversations (from before tracking was added)
        const existingChats = await Chat.find({
            userEmail: session.user.email,
            createdAt: { $gte: thirtyDaysAgo }
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        // Function to extract topic from message text
        const extractTopicFromText = (text) => {
            if (!text) return 'General Discussion';
            const lowerText = text.toLowerCase();

            if (lowerText.includes('polity') || lowerText.includes('constitution') || lowerText.includes('government') || lowerText.includes('federal')) return 'Polity';
            if (lowerText.includes('history') || lowerText.includes('ancient') || lowerText.includes('medieval') || lowerText.includes('modern')) return 'History';
            if (lowerText.includes('geography') || lowerText.includes('climate') || lowerText.includes('map')) return 'Geography';
            if (lowerText.includes('economy') || lowerText.includes('economic') || lowerText.includes('finance') || lowerText.includes('gdp')) return 'Economics';
            if (lowerText.includes('science') || lowerText.includes('technology') || lowerText.includes('physics') || lowerText.includes('chemistry')) return 'Science & Technology';
            if (lowerText.includes('environment') || lowerText.includes('ecology') || lowerText.includes('biodiversity') || lowerText.includes('climate change')) return 'Environment';
            if (lowerText.includes('current affairs') || lowerText.includes('news') || lowerText.includes('recent')) return 'Current Affairs';
            if (lowerText.includes('ethics') || lowerText.includes('integrity') || lowerText.includes('moral')) return 'Ethics';
            if (lowerText.includes('essay') || lowerText.includes('writing')) return 'Essay Writing';
            if (lowerText.includes('interview') || lowerText.includes('daf') || lowerText.includes('personality')) return 'Interview Prep';

            return 'General Discussion';
        };

        // Convert existing chats to interaction format
        const chatAsInteractions = existingChats.map(chat => {
            const userMessages = (chat.messages || []).filter(m => m.sender === 'user');
            const topic = userMessages.length > 0 ? extractTopicFromText(userMessages[0].text) : 'General Discussion';

            return {
                timestamp: chat.createdAt,
                metadata: {
                    topic,
                    messageLength: userMessages.reduce((sum, m) => sum + (m.text?.length || 0), 0),
                    responseLength: 0,
                    isPyqQuery: false,
                    isFollowUp: (chat.messages?.length || 0) > 2,
                    engagementScore: Math.min(10, 5 + Math.floor((chat.messages?.length || 0) / 2))
                }
            };
        });

        // Combine both sources
        const allInteractions = [...chatInteractions, ...chatAsInteractions];

        if (!allInteractions || allInteractions.length === 0) {
            return res.status(200).json({
                success: true,
                hasData: false,
                insights: {
                    totalConversations: 0,
                    topTopics: [],
                    recentTopics: [],
                    favoriteSubjects: [],
                    questionTypes: [],
                    studyPattern: null,
                    averageEngagement: 0
                }
            });
        }

        // Analyze interactions
        const topicCounts = {};
        const subjectCounts = {};
        const questionTypes = {
            pyq: 0,
            general: 0,
            followUp: 0
        };
        let totalEngagement = 0;
        const dailyActivity = {};

        allInteractions.forEach(interaction => {
            const metadata = interaction.metadata || {};

            // Count topics
            if (metadata.topic) {
                topicCounts[metadata.topic] = (topicCounts[metadata.topic] || 0) + 1;

                // Group by subject
                const subject = metadata.topic;
                subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
            }

            // Question types
            if (metadata.isPyqQuery) {
                questionTypes.pyq++;
            } else if (metadata.isFollowUp) {
                questionTypes.followUp++;
            } else {
                questionTypes.general++;
            }

            // Engagement
            if (metadata.engagementScore) {
                totalEngagement += metadata.engagementScore;
            }

            // Daily activity
            const date = new Date(interaction.timestamp).toISOString().split('T')[0];
            dailyActivity[date] = (dailyActivity[date] || 0) + 1;
        });

        // Get top topics (sorted by frequency)
        const topTopics = Object.entries(topicCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic, count]) => ({
                topic,
                count,
                percentage: Math.round((count / allInteractions.length) * 100)
            }));

        // Get recent unique topics (last 10)
        const recentTopics = allInteractions
            .filter(i => i.metadata?.topic)
            .map(i => i.metadata.topic)
            .filter((topic, index, self) => self.indexOf(topic) === index)
            .slice(0, 10);

        // Favorite subjects (subjects with > 5 interactions)
        const favoriteSubjects = Object.entries(subjectCounts)
            .filter(([_, count]) => count >= 3)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([subject, count]) => ({
                subject,
                count,
                engagement: 'high' // Could be calculated based on scores
            }));

        // Study pattern analysis
        const morningChats = allInteractions.filter(i => {
            const hour = new Date(i.timestamp).getHours();
            return hour >= 5 && hour < 12;
        }).length;

        const afternoonChats = allInteractions.filter(i => {
            const hour = new Date(i.timestamp).getHours();
            return hour >= 12 && hour < 17;
        }).length;

        const eveningChats = allInteractions.filter(i => {
            const hour = new Date(i.timestamp).getHours();
            return hour >= 17 && hour < 22;
        }).length;

        const nightChats = allInteractions.filter(i => {
            const hour = new Date(i.timestamp).getHours();
            return hour >= 22 || hour < 5;
        }).length;

        const peakTime =
            morningChats > afternoonChats && morningChats > eveningChats && morningChats > nightChats ? 'Morning' :
                afternoonChats > eveningChats && afternoonChats > nightChats ? 'Afternoon' :
                    eveningChats > nightChats ? 'Evening' : 'Night';

        const studyPattern = {
            peakTime,
            distribution: {
                morning: morningChats,
                afternoon: afternoonChats,
                evening: eveningChats,
                night: nightChats
            },
            mostActiveDay: Object.entries(dailyActivity)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || null,
            consistency: Object.keys(dailyActivity).length // Days with activity
        };

        // Average engagement
        const averageEngagement = allInteractions.length > 0
            ? Math.round((totalEngagement / allInteractions.length) * 10) / 10
            : 0;

        // Question type distribution
        const totalQuestions = questionTypes.pyq + questionTypes.general + questionTypes.followUp;
        const questionTypeDistribution = [
            {
                type: 'PYQ Queries',
                count: questionTypes.pyq,
                percentage: totalQuestions > 0 ? Math.round((questionTypes.pyq / totalQuestions) * 100) : 0
            },
            {
                type: 'General Questions',
                count: questionTypes.general,
                percentage: totalQuestions > 0 ? Math.round((questionTypes.general / totalQuestions) * 100) : 0
            },
            {
                type: 'Follow-ups',
                count: questionTypes.followUp,
                percentage: totalQuestions > 0 ? Math.round((questionTypes.followUp / totalQuestions) * 100) : 0
            }
        ];

        // DIFFICULTY ANALYSIS
        const difficultyLevel = analyzeDifficultyLevel(allInteractions, existingChats);

        return res.status(200).json({
            success: true,
            hasData: true,
            insights: {
                totalConversations: allInteractions.length,
                topTopics,
                recentTopics,
                favoriteSubjects,
                questionTypes: questionTypeDistribution,
                studyPattern,
                averageEngagement,
                last7Days: Object.keys(dailyActivity).slice(-7).length,
                streak: calculateStreak(dailyActivity),
                difficultyLevel // NEW
            }
        });

    } catch (error) {
        console.error('Error in chat insights endpoint:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

/**
 * Calculate consecutive days streak
 */
function calculateStreak(dailyActivity) {
    const sortedDates = Object.keys(dailyActivity).sort((a, b) => new Date(b) - new Date(a));

    if (sortedDates.length === 0) return 0;

    let streak = 1;
    const today = new Date().toISOString().split('T')[0];

    // Check if there's activity today or yesterday
    if (sortedDates[0] !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (sortedDates[0] !== yesterdayStr) {
            return 0; // Streak broken
        }
    }

    // Count consecutive days
    for (let i = 1; i < sortedDates.length; i++) {
        const currentDate = new Date(sortedDates[i - 1]);
        const prevDate = new Date(sortedDates[i]);
        const diffDays = Math.floor((currentDate - prevDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

/**
 * Analyze difficulty level from chat patterns
 */
function analyzeDifficultyLevel(allInteractions, existingChats) {
    if (allInteractions.length === 0) {
        return {
            current: 'beginner',
            trend: 'stable',
            score: 0
        };
    }

    let complexityScore = 0;
    let questionCount = 0;

    // Analyze question complexity from chat messages
    existingChats.forEach(chat => {
        const userMessages = (chat.messages || []).filter(m => m.sender === 'user');

        userMessages.forEach(msg => {
            if (!msg.text) return;
            questionCount++;

            const text = msg.text.toLowerCase();
            const length = msg.text.length;

            // Beginner patterns (score: 0-2)
            if (/^(what is|who is|when|where|define|explain\s+basic)/i.test(text)) {
                complexityScore += 1;
            }
            // Intermediate patterns (score: 3-5)
            else if (/how|why|compare|difference|relate|application|example/i.test(text)) {
                complexityScore += 3;
            }
            // Advanced patterns (score: 6-10)
            else if (/critically|analyze|evaluate|assess|implications|impact|significance|debate|argue/i.test(text)) {
                complexityScore += 7;
            }
            // Default based on length
            else if (length > 100) {
                complexityScore += 4;
            } else {
                complexityScore += 2;
            }

            // Bonus for follow-up questions (shows deep engagement)
            if (chat.messages.length > 4) {
                complexityScore += 1;
            }
        });
    });

    // Calculate average complexity
    const avgComplexity = questionCount > 0 ? complexityScore / questionCount : 0;

    // Determine level
    let current;
    if (avgComplexity < 2.5) {
        current = 'beginner';
    } else if (avgComplexity < 5) {
        current = 'intermediate';
    } else {
        current = 'advanced';
    }

    // Calculate trend (compare recent vs older interactions)
    const halfPoint = Math.floor(allInteractions.length / 2);
    const oldEngagement = allInteractions.slice(0, halfPoint)
        .reduce((sum, i) => sum + (i.metadata?.engagementScore || 0), 0) / (halfPoint || 1);
    const recentEngagement = allInteractions.slice(halfPoint)
        .reduce((sum, i) => sum + (i.metadata?.engagementScore || 0), 0) / (allInteractions.length - halfPoint || 1);

    let trend;
    if (recentEngagement > oldEngagement * 1.3) {
        trend = 'improving';
    } else if (recentEngagement < oldEngagement * 0.7) {
        trend = 'declining';
    } else {
        trend = 'stable';
    }

    return {
        current,
        trend,
        score: Math.round(avgComplexity * 10) / 10,
        details: {
            avgComplexity: Math.round(avgComplexity * 10) / 10,
            totalQuestions: questionCount,
            oldEngagement: Math.round(oldEngagement * 10) / 10,
            recentEngagement: Math.round(recentEngagement * 10) / 10
        }
    };
}
