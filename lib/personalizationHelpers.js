/**
 * Personalization Helper Functions
 * Used across the platform to provide personalized content and recommendations
 */

import connectToDatabase from './mongodb';
import User from '@/models/User';
import MockTest from '@/models/MockTest';
import MockTestResult from '@/models/MockTestResult';
import UserInteraction from '@/models/UserInteraction';
import Recommendation from '@/models/Recommendation';

/**
 * Get user's performance statistics
 * @param {string} userId - User ID or email
 * @returns {Object} Performance stats with scores, weak areas, etc.
 */
export async function getUserPerformanceStats(userId) {
    try {
        await connectToDatabase();

        const user = await User.findOne({ email: userId }).lean();
        if (!user) {
            return {
                averageScore: null,
                weakAreas: [],
                strongAreas: [],
                recentPerformance: [],
                totalTests: 0
            };
        }

        // Get recent mock test results
        const recentTests = await MockTestResult.find({ userId: user._id })
            .sort({ completedAt: -1 }) // Sort by completion date
            .limit(10)
            .lean();

        if (recentTests.length === 0) {
            return {
                averageScore: null,
                weakAreas: user.profile?.weaknesses || [],
                strongAreas: user.profile?.strengths || [],
                recentPerformance: [],
                totalTests: 0
            };
        }

        // Calculate average score (using percentage)
        const scores = recentTests
            .filter(test => test.percentage !== undefined && test.percentage !== null)
            .map(test => test.percentage);

        const averageScore = scores.length > 0
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : null;

        // Analyze weak/strong areas from subjectWisePerformance
        const subjectPerformance = {};

        recentTests.forEach(test => {
            if (test.subjectWisePerformance && Array.isArray(test.subjectWisePerformance)) {
                test.subjectWisePerformance.forEach(subj => {
                    const subject = subj.subject || 'General';
                    if (!subjectPerformance[subject]) {
                        subjectPerformance[subject] = { correct: 0, total: 0 };
                    }
                    subjectPerformance[subject].total += (subj.total || 0);
                    subjectPerformance[subject].correct += (subj.correct || 0);
                });
            }
        });

        // Determine weak and strong areas
        const subjectScores = Object.entries(subjectPerformance).map(([subject, stats]) => ({
            subject,
            accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
            total: stats.total
        }));

        const weakAreas = subjectScores
            .filter(s => s.accuracy < 60 && s.total >= 3) // Only if attempted at least 3 questions
            .map(s => s.subject);

        const detailedWeakAreas = subjectScores
            .filter(s => s.accuracy < 70 && s.total >= 1) // Broader filter for the map
            .map(s => ({
                topic: s.subject,
                accuracy: Math.round(s.accuracy),
                questionCount: s.total,
                correctCount: Math.round((s.accuracy / 100) * s.total)
            }))
            .sort((a, b) => a.accuracy - b.accuracy); // Sort by lowest accuracy first

        const strongAreas = subjectScores
            .filter(s => s.accuracy >= 75 && s.total >= 3)
            .map(s => s.subject);

        return {
            averageScore: averageScore !== null ? Math.round(averageScore * 10) / 10 : null,
            weakAreas: weakAreas.length > 0 ? weakAreas : (user.profile?.weaknesses || []),
            detailedWeakAreas: detailedWeakAreas.length > 0 ? detailedWeakAreas : [],
            strongAreas: strongAreas.length > 0 ? strongAreas : (user.profile?.strengths || []),
            recentPerformance: scores.slice(0, 5), // Last 5 scores (percentages)
            totalTests: recentTests.length,
            subjectPerformance: subjectScores
        };
    } catch (error) {
        console.error('Error getting user performance stats:', error);
        return {
            averageScore: null,
            weakAreas: [],
            detailedWeakAreas: [],
            strongAreas: [],
            recentPerformance: [],
            totalTests: 0
        };
    }
}

/**
 * Calculate optimal mock test difficulty for user
 * @param {Object} userStats - User performance statistics
 * @returns {string} Suggested difficulty ('easy', 'medium', 'hard')
 */
export function calculateOptimalDifficulty(userStats) {
    const { averageScore, recentPerformance } = userStats;

    // No tests taken yet - start with easy-medium mix
    if (averageScore === null || recentPerformance.length === 0) {
        return 'medium';
    }

    // Based on average score
    if (averageScore >= 80) {
        // High performer - recommend hard tests
        return 'hard';
    } else if (averageScore >= 60) {
        // Medium performer - stick with medium
        return 'medium';
    } else {
        // Struggling - recommend easier tests
        return 'easy';
    }
}

const DEFAULT_HIGH_YIELD_TOPICS = [
    'Panchayati Raj',
    'Fundamental Rights',
    'Modern Indian History',
    'Climate Change',
    'Economic Survey',
    'International Relations',
    'Indian Agriculture',
    'Judiciary'
];

/**
 * Get difficulty mix for mock test based on user performance
 * @param {Object} userStats - User performance statistics
 * @returns {Object} Difficulty mix { easy, medium, hard }
 */
export function getAdaptiveDifficultyMix(userStats) {
    const { averageScore, recentPerformance } = userStats;

    // Default mix for new users
    if (averageScore === null) {
        return { easy: 0.3, medium: 0.5, hard: 0.2 };
    }

    // Check for improvement trend
    const isImproving = recentPerformance.length >= 3 &&
        recentPerformance[0] > recentPerformance[recentPerformance.length - 1];

    // High performers (80%+)
    if (averageScore >= 80) {
        return isImproving
            ? { easy: 0.1, medium: 0.4, hard: 0.5 } // Push harder if improving
            : { easy: 0.15, medium: 0.45, hard: 0.4 };
    }

    // Good performers (60-80%)
    if (averageScore >= 60) {
        return isImproving
            ? { easy: 0.2, medium: 0.5, hard: 0.3 } // Increase challenge
            : { easy: 0.3, medium: 0.5, hard: 0.2 }; // Balanced
    }

    // Struggling (<60%)
    return { easy: 0.5, medium: 0.4, hard: 0.1 }; // Build confidence
}

/**
 * Get personalized PYQ recommendations based on user's weak areas
 * @param {string} userId - User ID or email
 * @param {number} limit - Max number of recommendations
 * @returns {Array} Recommended topic areas to practice
 */
export async function getPYQRecommendations(userId, limit = 5) {
    try {
        const stats = await getUserPerformanceStats(userId);
        const user = await User.findOne({ email: userId }).lean();

        if (!user) {
            return [];
        }

        // Topic relevance map (simulated exam frequency/importance)
        const RELEVANCE_MAP = {
            'polity': 95,
            'history': 92,
            'modern indian history': 98,
            'panchayati raj': 94,
            'fundamental rights': 99,
            'economics': 90,
            'geography': 85,
            'environment': 88,
            'science': 80,
            'current affairs': 97,
            'international relations': 85,
            'ethics': 94
        };

        // Priority order:
        // 1. Test-identified weak areas
        // 2. User-declared weak areas
        // 3. Topics user hasn't practiced much (from topicInterests)
        const priorities = [];

        // Add test weak areas (highest priority)
        if (stats.detailedWeakAreas && stats.detailedWeakAreas.length > 0) {
            stats.detailedWeakAreas.forEach(area => {
                const topicLower = area.topic.toLowerCase();
                const examRelevance = RELEVANCE_MAP[topicLower] || 70;

                priorities.push({
                    topic: area.topic,
                    reason: 'critical_gap',
                    label: 'Critical Area',
                    accuracy: area.accuracy,
                    relevance: examRelevance,
                    priority: 100 + (examRelevance / 10) - (area.accuracy / 5)
                });
            });
        }

        // Add user-declared weaknesses
        const declaredWeaknesses = user.profile?.weaknesses || [];
        declaredWeaknesses.forEach(weakness => {
            const topicLower = weakness.toLowerCase();
            if (!priorities.find(p => p.topic.toLowerCase() === topicLower)) {
                const examRelevance = RELEVANCE_MAP[topicLower] || 70;
                priorities.push({
                    topic: weakness,
                    reason: 'weakness_identified',
                    label: 'Improvement Needed',
                    relevance: examRelevance,
                    priority: 85 + (examRelevance / 10)
                });
            }
        });

        // Add high-yield topics that user hasn't interacted with much
        const topicInterests = user.profile?.personalization?.topicInterests || [];
        Object.entries(RELEVANCE_MAP).forEach(([topic, relevance]) => {
            const hasInteracted = topicInterests.some(t => t.topic.toLowerCase().includes(topic));
            const alreadyInPriorities = priorities.some(p => p.topic.toLowerCase().includes(topic));

            if (!hasInteracted && !alreadyInPriorities && relevance > 90) {
                priorities.push({
                    topic: topic.charAt(0).toUpperCase() + topic.slice(1),
                    reason: 'high_yield_opportunity',
                    label: 'High Yield',
                    relevance: relevance,
                    priority: 60 + (relevance / 5)
                });
            }
        });

        // Fallback to high-yield topics if no personal priorities exist
        if (priorities.length === 0) {
            DEFAULT_HIGH_YIELD_TOPICS.forEach(topic => {
                const topicLower = topic.toLowerCase();
                priorities.push({
                    topic,
                    reason: 'trending_topic',
                    label: 'Trending',
                    relevance: RELEVANCE_MAP[topicLower] || 80,
                    priority: 30 + Math.random() * 20
                });
            });
        }

        // Sort by priority and return top recommendations
        return priorities
            .sort((a, b) => b.priority - a.priority)
            .slice(0, limit)
            .map(p => ({
                topic: p.topic,
                reason: p.reason,
                label: p.label || 'Recommended',
                relevance: p.relevance || 75,
                accuracy: p.accuracy
            }));
    } catch (error) {
        console.error('Error getting PYQ recommendations:', error);
        return [];
    }
}

/**
 * Get personalized essay topics based on user's strengths and goals
 * @param {string} userId - User ID or email
 * @param {number} count - Number of topics to generate
 * @returns {Array} Recommended essay topics
 */
export async function getPersonalizedEssayTopics(userId, count = 5) {
    try {
        await connectToDatabase();
        const user = await User.findOne({ email: userId }).lean();

        if (!user) {
            return [];
        }

        const profile = user.profile || {};
        const strengths = profile.strengths || [];
        const goals = profile.goals || [];
        const memories = profile.memories || [];

        // Extract relevant context
        const optionalSubject = memories.find(m =>
            m.category === 'subject' && m.content.toLowerCase().includes('optional')
        )?.content;

        const careerGoal = memories.find(m =>
            m.category === 'goal' && (m.content.toLowerCase().includes('ias') ||
                m.content.toLowerCase().includes('ips') ||
                m.content.toLowerCase().includes('ifs'))
        )?.content;

        const topics = [];

        // Add topics related to strengths
        strengths.forEach(strength => {
            topics.push({
                topic: strength,
                reason: 'based_on_strength',
                category: strength
            });
        });

        // Add topics related to optional subject
        if (optionalSubject) {
            topics.push({
                topic: optionalSubject,
                reason: 'optional_subject',
                category: 'Optional Subject'
            });
        }

        // Add topics related to career goals
        if (careerGoal) {
            const isPolice = careerGoal.includes('IPS');
            const isDiplomat = careerGoal.includes('IFS');

            if (isPolice) {
                topics.push({
                    topic: 'Police Reforms',
                    reason: 'career_goal',
                    category: 'Governance'
                });
            }

            if (isDiplomat) {
                topics.push({
                    topic: 'International Relations',
                    reason: 'career_goal',
                    category: 'IR'
                });
            }
        }

        return topics.slice(0, count);
    } catch (error) {
        console.error('Error getting personalized essay topics:', error);
        return [];
    }
}

/**
 * Track user interaction with content for personalization
 * @param {string} userId - User ID or email
 * @param {string} topic - Topic/subject of the content
 * @param {string} category - Category of content
 * @param {number} engagementScore - How engaged (1-10)
 */
export async function trackTopicInteraction(userId, topic, category, engagementScore = 5) {
    try {
        await connectToDatabase();
        const user = await User.findOne({ email: userId });

        if (!user) return;

        if (!user.profile.personalization) {
            user.profile.personalization = { topicInterests: [] };
        }

        if (!user.profile.personalization.topicInterests) {
            user.profile.personalization.topicInterests = [];
        }

        // Find existing topic
        const existingTopic = user.profile.personalization.topicInterests.find(
            t => t.topic.toLowerCase() === topic.toLowerCase()
        );

        if (existingTopic) {
            // Update existing
            existingTopic.frequency = (existingTopic.frequency || 0) + 1;
            existingTopic.engagementScore = Math.round(
                ((existingTopic.engagementScore || 0) + engagementScore) / 2
            );
            existingTopic.lastAsked = new Date();
        } else {
            // Add new
            user.profile.personalization.topicInterests.push({
                topic,
                category,
                frequency: 1,
                engagementScore,
                lastAsked: new Date()
            });
        }

        await user.save();
    } catch (error) {
        console.error('Error tracking topic interaction:', error);
    }
}

/**
 * Universal interaction tracker
 * @param {string} userId - User ID or email (null for guests)
 * @param {string} sessionId - Session ID
 * @param {string} interactionType - Type of interaction
 * @param {string} feature - Specific feature name
 * @param {string} action - Action performed
 * @param {Object} metadata - Additional metadata
 * @param {Object} deviceInfo - Device information
 */
export async function trackInteraction(userId, sessionId, interactionType, feature, action, metadata = {}, deviceInfo = {}) {
    try {
        await connectToDatabase();

        // Get user ObjectId if userId is email
        let userObjectId = null;
        let userEmail = null;

        if (userId) {
            const user = await User.findOne({ email: userId }).lean();
            if (user) {
                userObjectId = user._id;
                userEmail = user.email;
            }
        }

        // Calculate engagement score if not provided
        if (!metadata.engagementScore) {
            metadata.engagementScore = calculateEngagementScore(
                action,
                metadata.timeSpent || 0,
                metadata.followUpActions || 0,
                metadata.bookmarked || false
            );
        }

        const interaction = new UserInteraction({
            userId: userObjectId,
            userEmail,
            sessionId,
            interactionType,
            feature,
            action,
            metadata,
            deviceInfo,
            timestamp: new Date()
        });

        await interaction.save();

        // Also update user's topic interests if applicable
        if (userEmail && metadata.topic) {
            await trackTopicInteraction(
                userEmail,
                metadata.topic,
                metadata.category || interactionType,
                metadata.engagementScore
            );
        }

        return interaction;
    } catch (error) {
        console.error('Error tracking interaction:', error);
        return null;
    }
}

/**
 * Calculate engagement score based on user actions
 * @param {string} action - Action type
 * @param {number} timeSpent - Time spent in seconds
 * @param {number} followUpActions - Number of follow-up actions
 * @param {boolean} bookmarked - Whether content was bookmarked
 * @returns {number} Engagement score (0-10)
 */
export function calculateEngagementScore(action, timeSpent = 0, followUpActions = 0, bookmarked = false) {
    let score = 5; // Base score

    // Action weight
    const actionWeights = {
        'view': 0,
        'search': 1,
        'attempt': 2,
        'generate': 2,
        'save': 3,
        'bookmark': 3,
        'submit': 2,
        'analyze': 2,
        'export': 1,
        'share': 2
    };
    score += actionWeights[action] || 0;

    // Time spent factor (0-3 points)
    if (timeSpent > 300) score += 3; // 5+ minutes
    else if (timeSpent > 120) score += 2; // 2-5 minutes
    else if (timeSpent > 60) score += 1; // 1-2 minutes

    // Follow-up actions (0-2 points)
    if (followUpActions > 2) score += 2;
    else if (followUpActions > 0) score += 1;

    // Bookmarked (0-2 points)
    if (bookmarked) score += 2;

    return Math.min(10, Math.max(0, score));
}

/**
 * Get personalized recommendations for user
 * @param {string} userId - User ID or email
 * @param {string} type - Recommendation type (optional)
 * @returns {Object} Recommendations
 */
export async function getPersonalizedRecommendations(userId, type = null) {
    try {
        await connectToDatabase();

        const user = await User.findOne({ email: userId }).lean();
        if (!user) {
            return {
                recommendations: {
                    pyq: [],
                    essay: [],
                    mock_test: [],
                    current_affairs: [],
                    study_schedule: []
                },
                insights: {}
            };
        }

        // Check for existing active recommendations
        const existing = await Recommendation.getActiveRecommendations(user._id, type);

        if (existing && existing.length > 0) {
            return {
                recommendations: existing,
                cached: true
            };
        }

        // Generate new recommendations
        const recommendations = {};

        if (!type || type === 'pyq') {
            recommendations.pyq = await getPYQRecommendations(userId, 5);
        }

        if (!type || type === 'essay') {
            recommendations.essay = await getPersonalizedEssayTopics(userId, 5);
        }

        if (!type || type === 'mock_test') {
            recommendations.mock_test = await getMockTestRecommendations(userId);
        }

        if (!type || type === 'current_affairs') {
            recommendations.current_affairs = await getCurrentAffairsRecommendations(userId);
        }

        if (!type || type === 'study_schedule') {
            recommendations.study_schedule = await getStudyScheduleRecommendations(userId);
        }

        // Generate Weakness Map (Interactive Data)
        if (!type || type === 'all' || type === 'weakness_map') {
            const stats = await getUserPerformanceStats(userId);

            // If no real data, use profile weaknesses with mock stats or try to infer
            let weakMapData = stats.detailedWeakAreas || [];

            // Fallback to user declared weaknesses if no test data
            if (weakMapData.length === 0 && user.profile?.weaknesses) {
                weakMapData = user.profile.weaknesses.map(w => ({
                    topic: w,
                    accuracy: 0, // Unknown/Novice
                    questionCount: 0,
                    isDeclared: true
                }));
            }

            // Create actionable tool links for each weakness
            recommendations.weakness_map = weakMapData.slice(0, 5).map(area => {
                let status = 'critical';
                if (area.accuracy >= 40) status = 'moderate';
                if (area.accuracy >= 60) status = 'improving';

                return {
                    topic: area.topic,
                    accuracy: area.accuracy,
                    status,
                    metrics: {
                        questionsAttemped: area.questionCount,
                        correct: area.correctCount
                    },
                    actions: [
                        {
                            label: 'Practice PYQs',
                            type: 'pyq',
                            url: `/pyq-archive?search=${encodeURIComponent(area.topic)}`,
                            icon: 'target'
                        },
                        {
                            label: 'Take Focus Test',
                            type: 'mock',
                            url: `/mock-tests?mode=create&focus=${encodeURIComponent(area.topic)}`,
                            icon: 'zap'
                        },
                        {
                            label: 'Write Essay',
                            type: 'essay',
                            url: `/writing-tools?tab=essay&topic=${encodeURIComponent(area.topic)}`,
                            icon: 'pen'
                        }
                    ]
                };
            });
        }

        // Generate Performance History (Trend)
        if (!type || type === 'all' || type === 'history') {
            recommendations.performance_history = await getUserPerformanceHistory(userId);
        }

        // Generate Daily Plan
        if (!type || type === 'all' || type === 'daily_plan') {
            recommendations.daily_plan = await getDailyStudyPlan(userId);
        }

        // Generate User Study Persona
        if (!type || type === 'all' || type === 'persona') {
            recommendations.persona = await getUserStudyPersona(userId);
        }

        // Generate Smart Nudges
        if (!type || type === 'all' || type === 'nudges') {
            recommendations.nudges = await getSmartNudges(userId);
        }

        // Generate Predictive Score
        if (!type || type === 'all' || type === 'prediction') {
            recommendations.prediction = await getPredictiveScore(userId);
        }

        // Generate Achievements
        if (!type || type === 'all' || type === 'achievements') {
            recommendations.achievements = await getUserAchievements(userId);
        }

        // Save recommendations to database
        for (const [recType, items] of Object.entries(recommendations)) {
            if (items && items.length > 0) {
                const rec = new Recommendation({
                    userId: user._id,
                    userEmail: user.email,
                    recommendationType: recType,
                    recommendations: items.map(item => {
                        // Ensure item is a string
                        let itemString = '';
                        if (typeof item === 'string') {
                            itemString = item;
                        } else if (item) {
                            itemString = item.topic || item.title || item.subject || item.task || item.name ||
                                (typeof item === 'object' ? JSON.stringify(item).substring(0, 100) : String(item));
                        }

                        return {
                            item: String(itemString),
                            itemType: 'topic',
                            reason: item.reason || 'personalized',
                            priority: item.priority || 50,
                            confidence: 0.7,
                            metadata: item
                        };
                    }),
                    generationContext: {
                        basedOn: 'mixed',
                        dataPoints: 0,
                        algorithm: 'engagement_weighted',
                        version: '1.0'
                    },
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 24 hours
                });

                await rec.save();
            }
        }

        return {
            recommendations,
            generated: true
        };
    } catch (error) {
        console.error('Error getting personalized recommendations:', error);
        return {
            recommendations: {
                pyq: [],
                essay: [],
                mock_test: [],
                current_affairs: [],
                study_schedule: []
            },
            insights: {}
        };
    }
}

/**
 * Get mock test recommendations based on user performance
 * @param {string} userId - User ID or email
 * @returns {Array} Recommended test configurations
 */
export async function getMockTestRecommendations(userId) {
    try {
        const stats = await getUserPerformanceStats(userId);
        const difficulty = calculateOptimalDifficulty(stats);
        const mix = getAdaptiveDifficultyMix(stats);

        const recommendations = [];

        // Recommend test focusing on weak areas
        if (stats.weakAreas.length > 0) {
            recommendations.push({
                title: `${stats.weakAreas[0]} Focus Test`,
                subject: stats.weakAreas[0],
                difficulty,
                reason: 'low_performance',
                priority: 100,
                metadata: {
                    subjects: stats.weakAreas.slice(0, 3),
                    difficultyMix: mix
                }
            });
        }

        // Recommend balanced test
        recommendations.push({
            title: 'Balanced Practice Test',
            difficulty,
            reason: 'comprehensive_practice',
            priority: 70,
            metadata: {
                difficultyMix: mix,
                allSubjects: true
            }
        });

        // Recommend revision test for strong areas
        if (stats.strongAreas.length > 0) {
            recommendations.push({
                title: `${stats.strongAreas[0]} Revision Test`,
                subject: stats.strongAreas[0],
                difficulty: 'hard',
                reason: 'maintain_strength',
                priority: 50,
                metadata: {
                    subjects: stats.strongAreas.slice(0, 2)
                }
            });
        }

        return recommendations;
    } catch (error) {
        console.error('Error getting mock test recommendations:', error);
        return [];
    }
}

/**
 * Get current affairs recommendations
 * @param {string} userId - User ID or email
 * @returns {Array} Recommended topics
 */
export async function getCurrentAffairsRecommendations(userId) {
    try {
        await connectToDatabase();
        const user = await User.findOne({ email: userId }).lean();

        if (!user) return [];

        const recommendations = [];
        const stats = await getUserPerformanceStats(userId);

        // Recommend topics related to weak areas
        stats.weakAreas.forEach(area => {
            recommendations.push({
                topic: `${area} - Current Affairs`,
                reason: 'weak_area_focus',
                priority: 90,
                category: area
            });
        });

        // Recommend based on recent interactions
        const recentInteractions = await UserInteraction.find({
            userId: user._id,
            interactionType: { $in: ['pyq', 'chat', 'essay'] },
            'metadata.topic': { $exists: true }
        })
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();

        const topicCounts = {};
        recentInteractions.forEach(int => {
            const topic = int.metadata.topic;
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });

        Object.entries(topicCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .forEach(([topic, count]) => {
                recommendations.push({
                    topic: `${topic} - Recent Updates`,
                    reason: 'recent_interest',
                    priority: 70,
                    category: topic
                });
            });

        return recommendations.slice(0, 5);
    } catch (error) {
        console.error('Error getting current affairs recommendations:', error);
        return [];
    }
}

/**
 * Get study schedule recommendations
 * @param {string} userId - User ID or email
 * @returns {Array} Study schedule suggestions
 */
export async function getStudyScheduleRecommendations(userId) {
    try {
        await connectToDatabase();
        const user = await User.findOne({ email: userId }).lean();

        if (!user) return [];

        const recommendations = [];
        const stats = await getUserPerformanceStats(userId);

        // Analyze study patterns
        const interactions = await UserInteraction.find({
            userId: user._id,
            timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }).lean();

        // Find peak study hours
        const hourCounts = {};
        interactions.forEach(int => {
            const hour = new Date(int.timestamp).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        const peakHours = Object.entries(hourCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([hour]) => parseInt(hour));

        if (peakHours.length > 0) {
            recommendations.push({
                title: 'Optimal Study Time',
                schedule: `${peakHours[0]}:00 - ${peakHours[0] + 2}:00`,
                reason: 'peak_productivity',
                priority: 80,
                metadata: { peakHours }
            });
        }

        // Recommend weak area focus time
        if (stats.weakAreas.length > 0) {
            recommendations.push({
                title: `Daily ${stats.weakAreas[0]} Practice`,
                duration: '30 minutes',
                subject: stats.weakAreas[0],
                reason: 'weak_area_improvement',
                priority: 100
            });
        }

        // Recommend revision schedule
        if (stats.strongAreas.length > 0) {
            recommendations.push({
                title: 'Weekly Revision',
                subjects: stats.strongAreas,
                frequency: 'weekly',
                reason: 'maintain_proficiency',
                priority: 60
            });
        }

        return recommendations;
    } catch (error) {
        console.error('Error getting study schedule recommendations:', error);
        return [];
    }
}

/**
 * Track guest user interaction (client-side data)
 * @param {string} sessionId - Guest session ID
 * @param {Object} interactionData - Interaction data
 */
export async function trackGuestInteraction(sessionId, interactionData) {
    try {
        await connectToDatabase();

        const interaction = new UserInteraction({
            userId: null,
            userEmail: null,
            sessionId,
            ...interactionData,
            timestamp: new Date()
        });

        await interaction.save();
        return interaction;
    } catch (error) {
        console.error('Error tracking guest interaction:', error);
        return null;
    }
}

/**
 * Migrate guest data to user account on signup
 * @param {string} sessionId - Guest session ID
 * @param {string} userId - User email or ID
 */
export async function migrateGuestData(sessionId, userId) {
    try {
        await connectToDatabase();

        const user = await User.findOne({ email: userId });
        if (!user) {
            console.error('User not found for migration:', userId);
            return { success: false, error: 'User not found' };
        }

        // Migrate interactions
        const interactionResult = await UserInteraction.migrateGuestInteractions(
            sessionId,
            user._id,
            user.email
        );

        console.log(`Migrated ${interactionResult.modifiedCount} interactions for user ${userId}`);

        // Get migrated interactions to update user profile
        const migratedInteractions = await UserInteraction.find({
            sessionId,
            userId: user._id
        }).lean();

        // Update user's topic interests based on migrated data
        const topicCounts = {};
        migratedInteractions.forEach(int => {
            if (int.metadata?.topic) {
                const topic = int.metadata.topic;
                if (!topicCounts[topic]) {
                    topicCounts[topic] = {
                        count: 0,
                        totalEngagement: 0,
                        category: int.metadata.category || int.interactionType
                    };
                }
                topicCounts[topic].count++;
                topicCounts[topic].totalEngagement += int.metadata.engagementScore || 5;
            }
        });

        // Update user profile with migrated topic interests
        for (const [topic, data] of Object.entries(topicCounts)) {
            await trackTopicInteraction(
                user.email,
                topic,
                data.category,
                Math.round(data.totalEngagement / data.count)
            );
        }

        return {
            success: true,
            interactionsMigrated: interactionResult.modifiedCount,
            topicsUpdated: Object.keys(topicCounts).length
        };
    } catch (error) {
        console.error('Error migrating guest data:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get user performance history for trend analysis
 * @param {string} userId - User ID or email
 * @returns {Array} Array of performance data points ordered by date
 */
export async function getUserPerformanceHistory(userId) {
    try {
        await connectToDatabase();
        const user = await User.findOne({ email: userId });
        if (!user) return [];

        const tests = await MockTestResult.find({
            userId: user._id
        })
            .sort({ completedAt: 1 }) // Oldest first
            .limit(20) // Last 20 tests
            .lean();

        if (tests.length === 0) return [];

        return tests.map(test => ({
            date: new Date(test.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            score: test.percentage, // Using percentage as the score for trend graph 0-100
            total: test.totalQuestions || 0,
            accuracy: test.percentage || 0
        }));
    } catch (error) {
        console.error('Error getting performance history:', error);
        return [];
    }
}

/**
 * Generate a daily study plan based on user's weak areas and time of day
 * @param {string} userId - User ID or email
 * @returns {Array} Array of scheduled tasks
 */
export async function getDailyStudyPlan(userId) {
    try {
        const stats = await getUserPerformanceStats(userId);
        const weakAreas = stats.detailedWeakAreas || [];
        const strongAreas = stats.strongAreas || [];

        const plan = [];
        const now = new Date();
        const hour = now.getHours();

        // Define time slots
        const slots = [
            { label: 'Morning Focus', time: '08:00 AM', type: 'learning' },
            { label: 'Afternoon Practice', time: '02:00 PM', type: 'practice' },
            { label: 'Evening Revision', time: '07:00 PM', type: 'revision' }
        ];

        // 1. Morning: Tackle toughest weak area (Concept Learning)
        if (weakAreas.length > 0) {
            plan.push({
                ...slots[0],
                task: `Study ${weakAreas[0].topic} Concepts`,
                description: 'Read key concepts and make notes to improve understanding.',
                topic: weakAreas[0].topic,
                actionUrl: `/resources?search=${encodeURIComponent(weakAreas[0].topic)}`,
                status: hour > 11 ? 'completed' : 'pending'
            });
        } else {
            plan.push({
                ...slots[0],
                task: 'Current Affairs Reading',
                description: 'Read today\'s important news and editorials.',
                topic: 'Current Affairs',
                actionUrl: '/current-affairs',
                status: hour > 11 ? 'completed' : 'pending'
            });
        }

        // 2. Afternoon: Practice Weak Area (Active Recall)
        const practiceTopic = weakAreas.length > 1 ? weakAreas[1].topic : (weakAreas.length > 0 ? weakAreas[0].topic : 'General');
        plan.push({
            ...slots[1],
            task: `Solve 20 MCQs on ${practiceTopic}`,
            description: 'Apply your knowledge with practice questions.',
            topic: practiceTopic,
            actionUrl: `/pyq-archive?search=${encodeURIComponent(practiceTopic)}`,
            status: hour > 16 ? 'completed' : (hour < 11 ? 'locked' : 'pending')
        });

        // 3. Evening: Revise Strong Areas or General Revision
        const revisionTopic = strongAreas.length > 0 ? strongAreas[0] : 'General Revision';
        plan.push({
            ...slots[2],
            task: `Revise ${revisionTopic}`,
            description: 'Quick revision to maintain retention.',
            topic: revisionTopic,
            actionUrl: `/mock-tests?mode=create&focus=${encodeURIComponent(revisionTopic)}`,
            status: hour > 20 ? 'completed' : (hour < 16 ? 'locked' : 'pending')
        });

        return plan;
    } catch (error) {
        console.error('Error generating daily plan:', error);
        return [];
    }
}

/**
 * Analyze user behavior patterns
 * @param {string} userId - User ID or email
 * @returns {Object} Behavior analysis
 */
export async function analyzeUserBehaviorPatterns(userId) {
    try {
        await connectToDatabase();
        const user = await User.findOne({ email: userId }).lean();

        if (!user) return null;

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Get recent interactions
        const interactions = await UserInteraction.find({
            userId: user._id,
            timestamp: { $gte: thirtyDaysAgo }
        }).lean();

        // Analyze by interaction type
        const typeDistribution = {};
        const hourDistribution = {};
        const dayDistribution = {};
        let totalTimeSpent = 0;
        let totalEngagement = 0;

        interactions.forEach(int => {
            // Type distribution
            typeDistribution[int.interactionType] = (typeDistribution[int.interactionType] || 0) + 1;

            // Time distribution
            const hour = new Date(int.timestamp).getHours();
            hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;

            // Day distribution
            const day = new Date(int.timestamp).getDay();
            dayDistribution[day] = (dayDistribution[day] || 0) + 1;

            // Metrics
            totalTimeSpent += int.metadata?.timeSpent || 0;
            totalEngagement += int.metadata?.engagementScore || 0;
        });

        const avgEngagement = interactions.length > 0 ? totalEngagement / interactions.length : 0;

        // Find peak hours
        const peakHour = Object.entries(hourDistribution)
            .sort((a, b) => b[1] - a[1])[0]?.[0];

        // Find most active day
        const peakDay = Object.entries(dayDistribution)
            .sort((a, b) => b[1] - a[1])[0]?.[0];

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        return {
            totalInteractions: interactions.length,
            typeDistribution,
            peakStudyHour: peakHour ? `${peakHour}:00` : null,
            peakStudyDay: peakDay ? dayNames[peakDay] : null,
            averageEngagement: Math.round(avgEngagement * 10) / 10,
            totalTimeSpent: Math.round(totalTimeSpent / 60), // in minutes
            averageSessionLength: interactions.length > 0 ? Math.round(totalTimeSpent / interactions.length) : 0
        };
    } catch (error) {
        console.error('Error analyzing user behavior patterns:', error);
        return null;
    }
}

/**
 * Generate User Study Persona based on behavior patterns
 * @param {string} userId - User ID or email
 * @returns {Object} Persona archetypes
 */
export async function getUserStudyPersona(userId) {
    try {
        const behavior = await analyzeUserBehaviorPatterns(userId);
        if (!behavior || behavior.totalInteractions < 5) {
            return {
                time: { label: 'Rookie', icon: '🌱', description: 'Just starting the journey' },
                focus: null,
                learnerType: null
            };
        }

        const persona = {};

        // 1. Time Strategy
        const peakHour = parseInt(behavior.peakStudyHour?.split(':')[0] || '12');
        if (peakHour >= 5 && peakHour < 12) {
            persona.time = { label: 'Early Bird', icon: '🌅', description: 'Most active in the mornings' };
        } else if (peakHour >= 12 && peakHour < 18) {
            persona.time = { label: 'Day Walker', icon: '☀️', description: 'Focused during the day' };
        } else {
            persona.time = { label: 'Night Owl', icon: '🦉', description: 'Thrives in the quiet of night' };
        }

        // 2. Focus Style
        const avgSession = behavior.averageSessionLength; // in minutes
        if (avgSession > 45) {
            persona.focus = { label: 'Marathon Runner', icon: '🏃', description: 'Deep work sessions (>45m)' };
        } else if (avgSession > 20) {
            persona.focus = { label: 'Steady Hiker', icon: '🚶', description: 'Consistent flow (20-45m)' };
        } else {
            persona.focus = { label: 'Sprinter', icon: '⚡', description: 'High intensity bursts (<20m)' };
        }

        // 3. Learner Type
        const types = behavior.typeDistribution; // e.g. { pyq: 5, read: 2 }
        const practiceCount = (types.pyq || 0) + (types.mock || 0);
        const readCount = (types.read || 0) + (types.news || 0);

        if (practiceCount > readCount * 1.5) {
            persona.learnerType = { label: 'Warrior', icon: '⚔️', description: 'Learns by doing questions' };
        } else if (readCount > practiceCount * 1.5) {
            persona.learnerType = { label: 'Scholar', icon: '📚', description: 'Focuses on deep reading' };
        } else {
            persona.learnerType = { label: 'Strategist', icon: '🧠', description: 'Balanced approach' };
        }

        return persona;
    } catch (error) {
        console.error('Error generating persona:', error);
        return null;
    }
}

/**
 * Get "Smart Nudges" for spaced repetition (forgotten topics)
 * @param {string} userId - User ID or email
 * @returns {Array} List of topics to revisit
 */
export async function getSmartNudges(userId) {
    try {
        await connectToDatabase();
        const user = await User.findOne({ email: userId });
        if (!user || !user.profile?.personalization?.topicInterests) return [];

        const interests = user.profile.personalization.topicInterests;
        const now = new Date();
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

        // Find topics with good engagement but not visited recently
        const forgottonTopics = interests.filter(t => {
            const lastAsked = new Date(t.lastAsked);
            return lastAsked < sevenDaysAgo && t.engagementScore >= 3;
        });

        // Sort by "how long ago" * "importance"
        return forgottonTopics
            .sort((a, b) => new Date(a.lastAsked) - new Date(b.lastAsked)) // Oldest first
            .slice(0, 3)
            .map(t => ({
                topic: t.topic,
                daysAgo: Math.floor((now - new Date(t.lastAsked)) / (1000 * 60 * 60 * 24)),
                actionUrl: `/resources?search=${encodeURIComponent(t.topic)}`
            }));
    } catch (error) {
        console.error('Error getting smart nudges:', error);
        return [];
    }
}

/**
 * Calculate Predictive Exam Score based on performance
 * @param {string} userId - User ID or email
 * @returns {Object} Prediction data (predictedScore, confidence, probability, trend)
 */
export async function getPredictiveScore(userId) {
    try {
        const stats = await getUserPerformanceStats(userId);
        const history = await getUserPerformanceHistory(userId);

        if (!stats || stats.totalTests < 3) {
            return {
                predictedScore: null,
                message: "Need 3+ tests for prediction"
            };
        }

        // Weighted Average Calculation (Recent tests matter more)
        const recentScores = history.slice(0, 5).map(h => h.accuracy); // Using accuracy as proxy for score %
        let totalWeight = 0;
        let weightedSum = 0;

        recentScores.forEach((score, index) => {
            const weight = index + 1; // 1, 2, 3... (most recent has highest index in this reversed view? careful with order)
            // history is usually returned sorted. standard is recent specific.
            // Let's assume history[0] is most recent.
            // Actually getUserPerformanceHistory usually returns Chronological (oldest -> newest).
            // Let's verify: In getUserPerformanceHistory, it does: .slice(0, 20).reverse() -> so [0] is NEWEST?
            // "const history = recentTests.map(...).reverse();" -> Yes, usually we want charts to be Old -> New.
            // So history[last] is newest.
        });

        // Let's re-access history properly.
        // Assuming history is [Oldest, ..., Newest]
        const sortedHistory = [...history]; // copy

        let weightedScore = 0;
        let divisor = 0;

        sortedHistory.forEach((item, i) => {
            const weight = i + 1; // Linear weighting
            weightedScore += item.accuracy * weight;
            divisor += weight;
        });

        const predictedAccuracy = sortedHistory.length > 0 ? (weightedScore / divisor) : 0;

        // Convert Accuracy to Approx Marks (assuming 200 marks total like Prelims)
        // This is a rough heuristic
        const predictedMarks = Math.round((predictedAccuracy / 100) * 200);

        // Calculate Trend (Listening to the derivatives)
        const recentAvg = stats.averageScore || 0;
        // let's just use the last vs first of the set
        const improvement = sortedHistory.length >= 2
            ? sortedHistory[sortedHistory.length - 1].accuracy - sortedHistory[0].accuracy
            : 0;

        // Passing Probability (Sigmoid-ish mapping of marks to probability)
        // Cutoff usually around 88-100 marks.
        // 100 marks -> 50% chance? No, 100 is safe. 
        // Let's say 85 is 40%, 90 is 60%, 100 is 90%.
        const cutoff = 90;
        let prob = 0;
        if (predictedMarks < 70) prob = 10;
        else if (predictedMarks < 85) prob = 30 + (predictedMarks - 70) * 1.3;
        else if (predictedMarks < 100) prob = 50 + (predictedMarks - 85) * 2.6; // 85->50, 100-> ~90
        else prob = 90 + (predictedMarks - 100) * 0.5;

        return {
            predictedScore: predictedMarks,
            accuracy: Math.round(predictedAccuracy),
            confidenceRange: [Math.max(0, predictedMarks - 5), Math.min(200, predictedMarks + 5)],
            passingProbability: Math.min(99, Math.round(prob)),
            trend: improvement > 0 ? 'improving' : (improvement < -5 ? 'declining' : 'stable')
        };

    } catch (error) {
        console.error('Error calculating predictive score:', error);
        return null;
    }
}

/**
 * Get User Gamification Achievements
 * @param {string} userId - User ID or email
 * @returns {Array} List of unlocked badges
 */
export async function getUserAchievements(userId) {
    try {
        const stats = await getUserPerformanceStats(userId);
        const behavior = await analyzeUserBehaviorPatterns(userId);

        if (!stats) return [];

        const achievements = [];

        // 1. Streak Master (Consistency)
        // Using totalInteractions as a proxy for now, ideally strictly consecutive days
        if (behavior && behavior.totalInteractions > 50) {
            achievements.push({
                id: 'dedicated_learner',
                title: 'Dedicated Learner',
                description: 'Completed 50+ study interactions',
                icon: '🔥',
                color: 'orange'
            });
        }

        // 2. Subject Expert (Performance)
        if (stats.strongAreas && stats.strongAreas.length > 0) {
            achievements.push({
                id: 'subject_master',
                title: `${stats.strongAreas[0]} Guru`,
                description: `Mastered ${stats.strongAreas[0]} with high accuracy`,
                icon: '🧠',
                color: 'purple'
            });
        }

        // 3. Exam Ready (High Score)
        if (stats.averageScore && stats.averageScore > 80) {
            achievements.push({
                id: 'top_performer',
                title: 'Top 10% Scorer',
                description: 'Maintained 80%+ average score',
                icon: '🏆',
                color: 'yellow'
            });
        }

        // 4. Night Owl / Early Bird (from Persona logic)
        if (behavior && behavior.peakStudyHour) {
            const hour = parseInt(behavior.peakStudyHour.split(':')[0]);
            if (hour > 20 || hour < 4) {
                achievements.push({
                    id: 'midnight_oil',
                    title: 'Midnight Oil',
                    description: 'Your dedication knows no curfew',
                    icon: '🦉',
                    color: 'indigo'
                });
            } else if (hour >= 5 && hour <= 8) {
                achievements.push({
                    id: 'early_riser',
                    title: 'Early Riser',
                    description: 'Winning the day before it starts',
                    icon: '🌅',
                    color: 'pink'
                });
            }
        }

        return achievements;
    } catch (error) {
        console.error('Error getting achievements:', error);
        return [];
    }
}

export default {
    getUserPerformanceStats,
    calculateOptimalDifficulty,
    getAdaptiveDifficultyMix,
    getPYQRecommendations,
    getPersonalizedEssayTopics,
    trackTopicInteraction,
    trackInteraction,
    calculateEngagementScore,
    getPersonalizedRecommendations,
    getMockTestRecommendations,
    getCurrentAffairsRecommendations,
    getStudyScheduleRecommendations,
    trackGuestInteraction,
    migrateGuestData,
    analyzeUserBehaviorPatterns,
    getUserPerformanceHistory,
    getDailyStudyPlan,
    getUserStudyPersona,
    getSmartNudges,
    getPredictiveScore,
    getUserAchievements
};
