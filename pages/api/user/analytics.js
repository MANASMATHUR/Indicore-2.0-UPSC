import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import Chat from '@/models/Chat';
import MockTest from '@/models/MockTest';
import UserInteraction from '@/models/UserInteraction';

/**
 * API endpoint for user analytics and insights
 * Provides comprehensive study patterns, performance metrics, and behavioral insights
 */
export default async function handler(req, res) {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await connectToDatabase();

        if (req.method === 'GET') {
            const { period = '30' } = req.query; // days
            const daysAgo = parseInt(period, 10);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - daysAgo);

            const user = await User.findOne({ email: session.user.email })
                .select('profile statistics preferences')
                .lean();

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Get recent chats for engagement analysis
            const recentChats = await Chat.find({
                userEmail: session.user.email,
                lastMessageAt: { $gte: startDate }
            })
                .select('messages lastMessageAt createdAt')
                .lean();

            // Get ACTUAL mock test data from database
            const mockTests = await MockTest.find({
                createdBy: user._id
            })
                .select('totalMarks questions userAnswers score createdAt')
                .lean();

            // Calculate actual mock test stats
            const mockTestsCompleted = mockTests.length;
            const mockTestScores = mockTests
                .map(test => {
                    // Calculate score if not already stored
                    if (test.score !== undefined) return test.score;

                    // Calculate from userAnswers if available
                    if (test.userAnswers && test.questions) {
                        let correct = 0;
                        test.questions.forEach((q, idx) => {
                            if (q.questionType === 'mcq' && test.userAnswers[idx] === q.correctAnswer) {
                                correct++;
                            }
                        });
                        return test.questions.length > 0 ? (correct / test.questions.length) * 100 : 0;
                    }
                    return 0;
                })
                .filter(score => score > 0);

            const averageScore = mockTestScores.length > 0
                ? Math.round(mockTestScores.reduce((sum, score) => sum + score, 0) / mockTestScores.length)
                : 0;

            // Get chat interactions for study time calculation
            console.log('Fetching interactions in analytics...');
            const chatInteractions = await UserInteraction.find({
                userEmail: session.user.email,
                interactionType: 'chat',
                timestamp: { $gte: startDate }
            })
                .limit(1000)
                .lean();

            console.log(`Fetched ${chatInteractions.length} interactions`);
            const totalTimeSpent = chatInteractions.reduce((sum, interaction) => {
                return sum + (interaction.metadata?.timeSpent || 5); // Estimate 5 min per chat if not tracked
            }, 0);

            // Calculate study streak (days with activity)
            const activityDates = new Set();
            [...recentChats, ...chatInteractions, ...mockTests].forEach(item => {
                const date = new Date(item.createdAt || item.timestamp || item.lastMessageAt);
                activityDates.add(date.toISOString().split('T')[0]);
            });

            // Calculate consecutive day streak
            let studyStreak = 0;
            const today = new Date().toISOString().split('T')[0];
            const sortedDates = Array.from(activityDates).sort((a, b) => new Date(b) - new Date(a));

            if (sortedDates.length > 0 && (sortedDates[0] === today || isYesterday(sortedDates[0]))) {
                studyStreak = 1;
                for (let i = 1; i < sortedDates.length; i++) {
                    const prevDate = new Date(sortedDates[i - 1]);
                    const currDate = new Date(sortedDates[i]);
                    const diffDays = Math.floor((prevDate - currDate) / (1000 * 60 * 60 * 24));

                    if (diffDays === 1) {
                        studyStreak++;
                    } else {
                        break;
                    }
                }
            }

            // Calculate analytics
            const analytics = {
                overview: {
                    totalStudyTime: totalTimeSpent,
                    totalQuestions: user.statistics?.totalQuestions || mockTests.reduce((sum, test) => sum + (test.questions?.length || 0), 0),
                    totalChats: recentChats.length,
                    studyStreak: studyStreak,
                    lastStudyDate: sortedDates.length > 0 ? new Date(sortedDates[0]) : user.statistics?.lastStudyDate
                },

                studyPatterns: {
                    preferredTimeOfDay: user.profile?.personalization?.studyPatterns?.preferredTimeOfDay || [],
                    averageSessionLength: user.profile?.personalization?.studyPatterns?.averageSessionLength || 0,
                    consistencyScore: calculateConsistencyScore(user.statistics?.weeklyStats || []),
                    peakProductivityHours: getPeakHours(user.profile?.personalization?.studyPatterns?.preferredTimeOfDay || [])
                },

                performance: {
                    overall: averageScore,
                    bySubject: user.profile?.performanceMetrics?.subjectWiseScores || [],
                    pyq: user.profile?.performanceMetrics?.pyqPerformance || {
                        totalAttempted: 0,
                        totalCorrect: 0,
                        accuracyRate: 0
                    },
                    mockTests: {
                        totalTests: mockTestsCompleted,
                        averageScore: averageScore,
                        improvementTrend: mockTestScores.length >= 2 ?
                            (mockTestScores[mockTestScores.length - 1] > mockTestScores[0] ? 'improving' :
                                mockTestScores[mockTestScores.length - 1] < mockTestScores[0] ? 'declining' : 'stable') :
                            'stable'
                    },
                    essays: user.profile?.performanceMetrics?.essayPerformance || {
                        totalEssays: 0,
                        averageScore: 0
                    }
                },

                engagement: {
                    totalSessions: recentChats.length,
                    averageMessagesPerSession: calculateAverageMessages(recentChats),
                    topicsCovered: user.statistics?.topicsCovered || [],
                    topInterests: getTopInterests(user.profile?.personalization?.topicInterests || []),
                    engagementTrend: calculateEngagementTrend(recentChats)
                },

                progress: {
                    currentTopics: user.profile?.learningPath?.currentTopics?.length || 0,
                    completedTopics: user.profile?.learningPath?.completedTopics?.length || 0,
                    plannedTopics: user.profile?.learningPath?.plannedTopics?.length || 0,
                    recentCompletions: getRecentCompletions(user.profile?.learningPath?.completedTopics || [], daysAgo)
                },

                goals: {
                    activeShortTerm: (user.profile?.goals?.shortTerm || []).filter(g => !g.completed).length,
                    activeLongTerm: (user.profile?.goals?.longTerm || []).filter(g => !g.completed).length,
                    completedGoals: (user.profile?.goals?.shortTerm || []).filter(g => g.completed).length +
                        (user.profile?.goals?.longTerm || []).filter(g => g.completed).length,
                    achievements: (user.profile?.goals?.achievements || []).length
                },

                insights: generateInsights(user, recentChats)
            };

            // Return in the format expected by dashboard
            return res.status(200).json({
                success: true,
                statistics: {
                    studyStreak: studyStreak,
                    mockTestsCompleted: mockTestsCompleted,
                    averageScore: averageScore,
                    totalTimeSpent: totalTimeSpent,
                    totalChats: recentChats.length,
                    totalQuestions: analytics.overview.totalQuestions
                },
                analytics // Include full analytics for backward compatibility
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Analytics API error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}

// Helper functions
function isYesterday(dateStr) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return dateStr === yesterday.toISOString().split('T')[0];
}

function calculateConsistencyScore(weeklyStats) {
    if (!weeklyStats || weeklyStats.length === 0) return 0;

    const recentWeeks = weeklyStats.slice(-4);
    if (recentWeeks.length === 0) return 0;

    const studyDays = recentWeeks.filter(w => w.studyTime > 0).length;
    return Math.round((studyDays / recentWeeks.length) * 100);
}

function getPeakHours(timeData) {
    if (!timeData || timeData.length === 0) return [];

    const sorted = [...timeData].sort((a, b) => b.frequency - a.frequency);
    return sorted.slice(0, 3).map(t => ({
        hour: t.hour,
        label: formatHour(t.hour),
        frequency: t.frequency
    }));
}

function formatHour(hour) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${displayHour}:00 ${period}`;
}

function calculateAverageMessages(chats) {
    if (!chats || chats.length === 0) return 0;

    const totalMessages = chats.reduce((sum, chat) => {
        return sum + (chat.messages?.length || 0);
    }, 0);

    return Math.round(totalMessages / chats.length);
}

function getTopInterests(topicInterests) {
    if (!topicInterests || topicInterests.length === 0) return [];

    return topicInterests
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5)
        .map(t => ({
            topic: t.topic,
            frequency: t.frequency,
            engagementScore: t.engagementScore || 0
        }));
}

function calculateEngagementTrend(recentChats) {
    if (!recentChats || recentChats.length < 2) return 'stable';

    const halfPoint = Math.floor(recentChats.length / 2);
    const firstHalf = recentChats.slice(0, halfPoint);
    const secondHalf = recentChats.slice(halfPoint);

    const firstAvg = firstHalf.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0) / secondHalf.length;

    if (secondAvg > firstAvg * 1.2) return 'increasing';
    if (secondAvg < firstAvg * 0.8) return 'decreasing';
    return 'stable';
}

function getRecentCompletions(completedTopics, daysAgo) {
    if (!completedTopics || completedTopics.length === 0) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

    return completedTopics.filter(t => {
        const completedDate = new Date(t.completedAt);
        return completedDate >= cutoffDate;
    }).length;
}

function generateInsights(user, recentChats) {
    const insights = [];

    // Study consistency insight
    const studyStreak = user.statistics?.studyStreak || 0;
    if (studyStreak >= 7) {
        insights.push({
            type: 'positive',
            category: 'consistency',
            message: `Great job! You're on a ${studyStreak}-day study streak! 🔥`,
            priority: 1
        });
    } else if (studyStreak < 3) {
        insights.push({
            type: 'suggestion',
            category: 'consistency',
            message: 'Try to build a consistent study routine. Daily practice improves retention!',
            priority: 2
        });
    }

    // Performance insight
    const weakAreas = user.profile?.personalization?.recommendations?.weakAreas || [];
    if (weakAreas.length > 0) {
        insights.push({
            type: 'suggestion',
            category: 'improvement',
            message: `Focus on ${weakAreas[0].topic} - you've asked many follow-up questions on this topic.`,
            priority: 1
        });
    }

    // Goal progress insight
    const activeGoals = (user.profile?.goals?.shortTerm || []).filter(g => !g.completed).length;
    if (activeGoals === 0) {
        insights.push({
            type: 'suggestion',
            category: 'goals',
            message: 'Set some short-term goals to track your daily or weekly progress!',
            priority: 2
        });
    }

    // Learning path insight
    const currentTopics = user.profile?.learningPath?.currentTopics || [];
    if (currentTopics.length > 5) {
        insights.push({
            type: 'warning',
            category: 'focus',
            message: `You're studying ${currentTopics.length} topics simultaneously. Consider focusing on fewer topics for better retention.`,
            priority: 1
        });
    }

    // Engagement insight
    if (recentChats.length > 20) {
        insights.push({
            type: 'positive',
            category: 'engagement',
            message: `Excellent engagement! You've had ${recentChats.length} study sessions recently. Keep it up! 🌟`,
            priority: 1
        });
    }

    return insights.sort((a, b) => a.priority - b.priority);
}
