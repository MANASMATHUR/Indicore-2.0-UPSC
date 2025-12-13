/**
 * Personalization Helper Functions
 * Used across the platform to provide personalized content and recommendations
 */

import connectToDatabase from './mongodb';
import User from '@/models/User';
import MockTest from '@/models/MockTest';

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

        // Get recent mock tests
        const recentTests = await MockTest.find({ createdBy: user._id })
            .sort({ createdAt: -1 })
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

        // Calculate average score
        const scores = recentTests
            .filter(test => test.score !== undefined && test.score !== null)
            .map(test => test.score);

        const averageScore = scores.length > 0
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : null;

        // Analyze weak/strong areas from test performance
        const subjectPerformance = {};
        recentTests.forEach(test => {
            if (test.questions && Array.isArray(test.questions)) {
                test.questions.forEach((q, idx) => {
                    const subject = q.subject || 'General';
                    if (!subjectPerformance[subject]) {
                        subjectPerformance[subject] = { correct: 0, total: 0 };
                    }
                    subjectPerformance[subject].total++;

                    // Check if answer was correct
                    const userAnswer = test.userAnswers?.[idx];
                    if (q.questionType === 'mcq' && userAnswer === q.correctAnswer) {
                        subjectPerformance[subject].correct++;
                    }
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

        const strongAreas = subjectScores
            .filter(s => s.accuracy >= 75 && s.total >= 3)
            .map(s => s.subject);

        return {
            averageScore: averageScore !== null ? Math.round(averageScore * 10) / 10 : null,
            weakAreas: weakAreas.length > 0 ? weakAreas : (user.profile?.weaknesses || []),
            strongAreas: strongAreas.length > 0 ? strongAreas : (user.profile?.strengths || []),
            recentPerformance: scores.slice(0, 5), // Last 5 scores
            totalTests: recentTests.length,
            subjectPerformance: subjectScores
        };
    } catch (error) {
        console.error('Error getting user performance stats:', error);
        return {
            averageScore: null,
            weakAreas: [],
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

        // Priority order:
        // 1. Test-identified weak areas
        // 2. User-declared weak areas
        // 3. Topics user hasn't practiced much (from topicInterests)
        const priorities = [];

        // Add test weak areas (highest priority)
        stats.weakAreas.forEach(area => {
            priorities.push({
                topic: area,
                reason: 'low_test_performance',
                priority: 100
            });
        });

        // Add user-declared weaknesses
        const declaredWeaknesses = user.profile?.weaknesses || [];
        declaredWeaknesses.forEach(weakness => {
            if (!priorities.find(p => p.topic.toLowerCase() === weakness.toLowerCase())) {
                priorities.push({
                    topic: weakness,
                    reason: 'user_declared',
                    priority: 80
                });
            }
        });

        // Add infrequent topics (topics user views but doesn't engage with much)
        const topicInterests = user.profile?.personalization?.topicInterests || [];
        const lowEngagement = topicInterests
            .filter(t => t.engagementScore < 5 && t.frequency > 2)
            .map(t => ({
                topic: t.topic,
                reason: 'low_engagement',
                priority: 50
            }));

        priorities.push(...lowEngagement);

        // Sort by priority and return top recommendations
        return priorities
            .sort((a, b) => b.priority - a.priority)
            .slice(0, limit)
            .map(p => ({
                topic: p.topic,
                reason: p.reason
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
            const isPolic = careerGoal.includes('IPS');
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

export default {
    getUserPerformanceStats,
    calculateOptimalDifficulty,
    getAdaptiveDifficultyMix,
    getPYQRecommendations,
    getPersonalizedEssayTopics,
    trackTopicInteraction
};
