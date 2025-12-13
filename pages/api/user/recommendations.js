import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

/**
 * API endpoint for personalized content recommendations
 * Uses user behavior, weak areas, and interests to suggest relevant content
 */
export default async function handler(req, res) {
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await connectToDatabase();

        if (req.method === 'GET') {
            const { type = 'all' } = req.query; // all, topics, pyqs, tests, current_affairs

            const user = await User.findOne({ email: session.user.email })
                .select('profile statistics preferences')
                .lean();

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const recommendations = {
                topics: [],
                pyqs: [],
                mockTests: [],
                currentAffairs: [],
                studyPlan: []
            };

            // Topic recommendations based on weak areas and interests
            if (type === 'all' || type === 'topics') {
                recommendations.topics = generateTopicRecommendations(user);
            }

            // PYQ recommendations based on weak areas
            if (type === 'all' || type === 'pyqs') {
                recommendations.pyqs = generatePyqRecommendations(user);
            }

            // Mock test recommendations based on performance
            if (type === 'all' || type === 'tests') {
                recommendations.mockTests = generateMockTestRecommendations(user);
            }

            // Current affairs recommendations based on subject interests
            if (type === 'all' || type === 'current_affairs') {
                recommendations.currentAffairs = generateCurrentAffairsRecommendations(user);
            }

            // Personalized study plan
            if (type === 'all' || type === 'study_plan') {
                recommendations.studyPlan = generateStudyPlan(user);
            }

            return res.status(200).json(recommendations);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Recommendations API error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}

// Helper functions
function generateTopicRecommendations(user) {
    const recommendations = [];

    // Weak areas - highest priority
    const weakAreas = user.profile?.personalization?.recommendations?.weakAreas || [];
    weakAreas.forEach((area, index) => {
        if (index < 3) { // Top 3 weak areas
            recommendations.push({
                type: 'weak_area',
                subject: area.topic,
                title: `Master ${area.topic}`,
                description: 'You\'ve shown difficulty in this area. Focus here for improvement.',
                priority: 1,
                suggestions: area.improvementSuggestions || [],
                estimatedTime: '2-3 hours',
                difficulty: 'challenging'
            });
        }
    });

    // Topics from current learning path that need attention
    const currentTopics = user.profile?.learningPath?.currentTopics || [];
    currentTopics.forEach(topic => {
        if (topic.completionPercentage < 50) {
            recommendations.push({
                type: 'in_progress',
                subject: topic.subject,
                title: `Continue with ${topic.topic}`,
                description: `${topic.completionPercentage}% complete. Keep going!`,
                priority: 2,
                estimatedTime: '1-2 hours',
                difficulty: 'moderate'
            });
        }
    });

    // New topics based on interests
    const topInterests = (user.profile?.personalization?.topicInterests || [])
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 3);

    topInterests.forEach(interest => {
        recommendations.push({
            type: 'interest_based',
            subject: interest.topic,
            title: `Explore more in ${interest.topic}`,
            description: 'You\'ve shown strong interest in this area.',
            priority: 3,
            estimatedTime: '1 hour',
            difficulty: 'moderate'
        });
    });

    return recommendations
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 10);
}

function generatePyqRecommendations(user) {
    const recommendations = [];

    // Based on weak areas
    const weakAreas = user.profile?.personalization?.recommendations?.weakAreas || [];
    weakAreas.forEach((area, index) => {
        if (index < 2) {
            recommendations.push({
                type: 'weak_area_practice',
                subject: area.topic,
                title: `Practice PYQs: ${area.topic}`,
                description: 'Solve previous year questions to strengthen this weak area',
                priority: 1,
                yearRange: '2015-2024',
                estimatedQuestions: 10
            });
        }
    });

    // Based on current topics
    const currentTopics = user.profile?.learningPath?.currentTopics || [];
    currentTopics.slice(0, 2).forEach(topic => {
        recommendations.push({
            type: 'topic_practice',
            subject: topic.subject,
            title: `PYQs: ${topic.topic}`,
            description: 'Practice questions from the topic you\'re currently studying',
            priority: 2,
            yearRange: '2015-2024',
            estimatedQuestions: 8
        });
    });

    // Popular subjects based on interest
    const topInterests = (user.profile?.personalization?.topicInterests || [])
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 2);

    topInterests.forEach(interest => {
        recommendations.push({
            type: 'interest_practice',
            subject: interest.topic,
            title: `More PYQs: ${interest.topic}`,
            description: 'Continue practicing in your area of interest',
            priority: 3,
            yearRange: '2020-2024',
            estimatedQuestions: 5
        });
    });

    return recommendations
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 8);
}

function generateMockTestRecommendations(user) {
    const recommendations = [];
    const mockTestPerf = user.profile?.performanceMetrics?.mockTestPerformance;

    // Determine difficulty based on past performance
    let recommendedDifficulty = 'medium';
    if (mockTestPerf) {
        if (mockTestPerf.averageScore > 70) {
            recommendedDifficulty = 'hard';
        } else if (mockTestPerf.averageScore < 50) {
            recommendedDifficulty = 'easy';
        }
    }

    // Full-length tests
    recommendations.push({
        type: 'full_length',
        title: 'UPSC Prelims Full Test',
        description: `${recommendedDifficulty === 'hard' ? 'Advanced' : 'Standard'} difficulty based on your performance`,
        difficulty: recommendedDifficulty,
        duration: '120 minutes',
        questions: 100,
        priority: 1
    });

    // Subject-specific tests for weak areas
    const weakAreas = user.profile?.personalization?.recommendations?.weakAreas || [];
    weakAreas.slice(0, 2).forEach(area => {
        recommendations.push({
            type: 'subject_specific',
            title: `${area.topic} Practice Test`,
            description: 'Focused test to improve your weak area',
            difficulty: 'medium',
            duration: '30 minutes',
            questions: 25,
            priority: 2,
            subject: area.topic
        });
    });

    // Topic-wise tests for current learning
    const currentTopics = user.profile?.learningPath?.currentTopics || [];
    if (currentTopics.length > 0) {
        const topic = currentTopics[0];
        recommendations.push({
            type: 'topic_test',
            title: `${topic.topic} Quiz`,
            description: 'Test your understanding of the current topic',
            difficulty: 'medium',
            duration: '20 minutes',
            questions: 15,
            priority: 3,
            subject: topic.subject
        });
    }

    return recommendations
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 5);
}

function generateCurrentAffairsRecommendations(user) {
    const recommendations = [];

    // Based on top interests
    const topInterests = (user.profile?.personalization?.topicInterests || [])
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 3);

    topInterests.forEach(interest => {
        recommendations.push({
            type: 'subject_based',
            category: interest.topic,
            title: `Latest ${interest.topic} Updates`,
            description: 'Current affairs relevant to your study focus',
            priority: 1,
            relevance: 'high'
        });
    });

    // General important current affairs
    recommendations.push({
        type: 'general',
        category: 'General',
        title: 'Today\'s Top Headlines',
        description: 'Important current affairs for UPSC preparation',
        priority: 2,
        relevance: 'medium'
    });

    return recommendations
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 6);
}

function generateStudyPlan(user) {
    const plan = [];
    const currentHour = new Date().getHours();

    // Morning plan (if it's morning)
    if (currentHour < 12) {
        // Focus on weak areas in the morning
        const weakAreas = user.profile?.personalization?.recommendations?.weakAreas || [];
        if (weakAreas.length > 0) {
            plan.push({
                timeSlot: 'morning',
                duration: '2 hours',
                activity: 'Focus Session',
                subject: weakAreas[0].topic,
                description: 'Morning is best for tackling challenging topics',
                priority: 1
            });
        }
    }

    // Afternoon plan
    if (currentHour >= 12 && currentHour < 17) {
        // Practice and revision
        const currentTopics = user.profile?.learningPath?.currentTopics || [];
        if (currentTopics.length > 0) {
            plan.push({
                timeSlot: 'afternoon',
                duration: '1.5 hours',
                activity: 'Practice PYQs',
                subject: currentTopics[0].subject,
                description: 'Reinforce learning with practice questions',
                priority: 2
            });
        }
    }

    // Evening plan
    if (currentHour >= 17) {
        plan.push({
            timeSlot: 'evening',
            duration: '1 hour',
            activity: 'Current Affairs',
            subject: 'General',
            description: 'Review today\'s important updates',
            priority: 2
        });

        // Review session
        const completedTopics = user.profile?.learningPath?.completedTopics || [];
        if (completedTopics.length > 0) {
            const recentCompletion = completedTopics[completedTopics.length - 1];
            plan.push({
                timeSlot: 'evening',
                duration: '30 minutes',
                activity: 'Quick Revision',
                subject: recentCompletion.topic,
                description: 'Review recently completed topic for retention',
                priority: 3
            });
        }
    }

    // Add a break reminder
    plan.push({
        timeSlot: 'anytime',
        duration: '10-15 minutes',
        activity: 'Break',
        subject: 'Self-care',
        description: 'Take regular breaks to maintain focus and avoid burnout',
        priority: 4
    });

    return plan.sort((a, b) => a.priority - b.priority);
}
