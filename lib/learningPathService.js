/**
 * Learning Path Service
 * Manages user learning paths, calculates progress, and generates study plans
 */

import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

/**
 * Get user's learning path with calculated metrics
 */
export async function getLearningPath(userEmail) {
    try {
        await connectToDatabase();
        const user = await User.findOne({ email: userEmail })
            .select('profile.learningPath')
            .lean();

        if (!user || !user.profile?.learningPath) {
            return {
                currentTopics: [],
                completedTopics: [],
                plannedTopics: [],
                metrics: {
                    totalTopics: 0,
                    completedCount: 0,
                    inProgressCount: 0,
                    averageCompletion: 0
                }
            };
        }

        const learningPath = user.profile.learningPath;

        return {
            ...learningPath,
            metrics: calculateLearningMetrics(learningPath)
        };
    } catch (error) {
        console.error('Error fetching learning path:', error);
        return null;
    }
}

/**
 * Calculate learning path metrics
 */
function calculateLearningMetrics(learningPath) {
    const currentTopics = learningPath.currentTopics || [];
    const completedTopics = learningPath.completedTopics || [];
    const plannedTopics = learningPath.plannedTopics || [];

    const totalTopics = currentTopics.length + completedTopics.length;
    const averageCompletion = currentTopics.length > 0
        ? currentTopics.reduce((sum, t) => sum + (t.completionPercentage || 0), 0) / currentTopics.length
        : 0;

    return {
        totalTopics,
        completedCount: completedTopics.length,
        inProgressCount: currentTopics.length,
        plannedCount: plannedTopics.length,
        averageCompletion: Math.round(averageCompletion),
        completionRate: totalTopics > 0 ? Math.round((completedTopics.length / totalTopics) * 100) : 0
    };
}

/**
 * Suggest next topics based on current progress and weak areas
 */
export async function suggestNextTopics(userEmail, limit = 5) {
    try {
        await connectToDatabase();
        const user = await User.findOne({ email: userEmail })
            .select('profile')
            .lean();

        if (!user) return [];

        const suggestions = [];
        const learningPath = user.profile?.learningPath || {};
        const weakAreas = user.profile?.personalization?.recommendations?.weakAreas || [];
        const interests = user.profile?.personalization?.topicInterests || [];
        const currentTopics = learningPath.currentTopics || [];
        const completedTopics = learningPath.completedTopics || [];

        // Already studying or completed topics
        const studiedTopics = new Set([
            ...currentTopics.map(t => `${t.subject}:${t.topic}`),
            ...completedTopics.map(t => `${t.subject}:${t.topic}`)
        ]);

        // Priority 1: Weak areas
        weakAreas.forEach((area, index) => {
            const key = `General:${area.topic}`;
            if (!studiedTopics.has(key) && index < 2) {
                suggestions.push({
                    subject: 'General',
                    topic: area.topic,
                    reason: 'Identified as a weak area - high priority',
                    priority: 1,
                    estimatedTime: '3-4 hours',
                    difficulty: 'challenging'
                });
            }
        });

        // Priority 2: Related to current topics
        currentTopics.forEach(current => {
            const relatedTopics = getRelatedTopics(current.subject, current.topic);
            relatedTopics.forEach(related => {
                const key = `${related.subject}:${related.topic}`;
                if (!studiedTopics.has(key) && suggestions.length < limit) {
                    suggestions.push({
                        subject: related.subject,
                        topic: related.topic,
                        reason: `Related to ${current.topic} (currently studying)`,
                        priority: 2,
                        estimatedTime: '2-3 hours',
                        difficulty: 'moderate'
                    });
                }
            });
        });

        // Priority 3: Based on interests
        interests
            .sort((a, b) => b.frequency - a.frequency)
            .forEach((interest, index) => {
                const key = `${interest.category}:${interest.topic}`;
                if (!studiedTopics.has(key) && index < 3 && suggestions.length < limit) {
                    suggestions.push({
                        subject: interest.category || 'General',
                        topic: interest.topic,
                        reason: 'Based on your interests',
                        priority: 3,
                        estimatedTime: '2 hours',
                        difficulty: 'moderate'
                    });
                }
            });

        // Priority 4: Core UPSC topics not yet covered
        const coreTopics = getCoreTopics();
        coreTopics.forEach(core => {
            const key = `${core.subject}:${core.topic}`;
            if (!studiedTopics.has(key) && suggestions.length < limit) {
                suggestions.push({
                    subject: core.subject,
                    topic: core.topic,
                    reason: 'Core UPSC topic',
                    priority: 4,
                    estimatedTime: '2-3 hours',
                    difficulty: core.difficulty
                });
            }
        });

        return suggestions
            .sort((a, b) => a.priority - b.priority)
            .slice(0, limit);
    } catch (error) {
        console.error('Error suggesting next topics:', error);
        return [];
    }
}

/**
 * Generate a study plan for today/this week
 */
export async function generateStudyPlan(userEmail, period = 'daily') {
    try {
        await connectToDatabase();
        const user = await User.findOne({ email: userEmail })
            .select('profile preferences')
            .lean();

        if (!user) return null;

        const plan = {
            period,
            generatedAt: new Date(),
            sessions: []
        };

        const learningPath = user.profile?.learningPath || {};
        const currentTopics = learningPath.currentTopics || [];
        const weakAreas = user.profile?.personalization?.recommendations?.weakAreas || [];
        const studyPreferences = user.profile?.studySchedule || {};
        const dailyGoal = studyPreferences.dailyGoalMinutes || 120;

        if (period === 'daily') {
            // Morning session - tough topics (weak areas)
            if (weakAreas.length > 0) {
                plan.sessions.push({
                    time: 'Morning (8:00 AM - 10:00 AM)',
                    duration: Math.min(120, dailyGoal * 0.4),
                    activity: 'Deep Study',
                    subject: weakAreas[0].topic,
                    description: 'Focus on challenging topics when fresh',
                    tasks: [
                        'Review theory and concepts',
                        'Make notes',
                        'Identify key points'
                    ]
                });
            }

            // Afternoon session - practice
            if (currentTopics.length > 0) {
                plan.sessions.push({
                    time: 'Afternoon (2:00 PM - 4:00 PM)',
                    duration: Math.min(120, dailyGoal * 0.3),
                    activity: 'Practice & Application',
                    subject: currentTopics[0].topic,
                    description: 'Solve PYQs and practice questions',
                    tasks: [
                        'Solve 10-15 PYQs',
                        'Analyze mistakes',
                        'Review difficult questions'
                    ]
                });
            }

            // Evening session - current affairs & revision
            plan.sessions.push({
                time: 'Evening (6:00 PM - 7:30 PM)',
                duration: Math.min(90, dailyGoal * 0.3),
                activity: 'Current Affairs & Revision',
                subject: 'General',
                description: 'Stay updated and revise',
                tasks: [
                    'Read daily current affairs',
                    'Quick revision of yesterday\'s topics',
                    'Make flashcards for key facts'
                ]
            });
        } else if (period === 'weekly') {
            // Generate weekly plan
            const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

            // Distribute current topics across the week
            currentTopics.forEach((topic, index) => {
                if (index < 5) { // Mon-Fri for topics
                    plan.sessions.push({
                        day: daysOfWeek[index],
                        subject: topic.subject,
                        topic: topic.topic,
                        duration: dailyGoal,
                        focus: 'Topic completion',
                        goal: `Reach ${Math.min(topic.completionPercentage + 20, 100)}% completion`
                    });
                }
            });

            // Weekend for revision and mock tests
            plan.sessions.push({
                day: 'Saturday',
                subject: 'All subjects',
                topic: 'Weekly Revision',
                duration: dailyGoal,
                focus: 'Revision & Mock Test',
                goal: 'Complete weekly mock test and revise all topics'
            });

            plan.sessions.push({
                day: 'Sunday',
                subject: 'Weak areas',
                topic: weakAreas[0]?.topic || 'General',
                duration: dailyGoal * 0.75,
                focus: 'Weak area improvement',
                goal: 'Strengthen identified weak areas'
            });
        }

        return plan;
    } catch (error) {
        console.error('Error generating study plan:', error);
        return null;
    }
}

/**
 * Update topic progress based on activity
 */
export async function updateTopicProgress(userEmail, subject, topic, activity) {
    try {
        await connectToDatabase();
        const user = await User.findOne({ email: userEmail });

        if (!user || !user.profile?.learningPath) return null;

        const topicIndex = user.profile.learningPath.currentTopics.findIndex(
            t => t.subject === subject && t.topic === topic
        );

        if (topicIndex < 0) return null;

        const currentTopic = user.profile.learningPath.currentTopics[topicIndex];

        // Increment progress based on activity
        const progressIncrement = {
            'read_notes': 10,
            'solve_pyq': 15,
            'watch_video': 10,
            'make_flashcards': 5,
            'revision': 10,
            'practice_test': 20
        };

        const increment = progressIncrement[activity] || 10;
        currentTopic.completionPercentage = Math.min(100, currentTopic.completionPercentage + increment);
        currentTopic.lastStudied = new Date();

        // Update status based on completion
        if (currentTopic.completionPercentage >= 100) {
            currentTopic.status = 'completed';
        } else if (currentTopic.completionPercentage > 0) {
            currentTopic.status = 'in_progress';
        }

        await user.save();

        return currentTopic;
    } catch (error) {
        console.error('Error updating topic progress:', error);
        return null;
    }
}

// Helper functions
function getRelatedTopics(subject, topic) {
    // This would ideally come from a knowledge graph
    // For now, return basic related topics based on subject
    const relatedMap = {
        'Polity': [
            { subject: 'Polity', topic: 'Constitutional Bodies' },
            { subject: 'Polity', topic: 'Local Government' },
            { subject: 'Polity', topic: 'Union Government' }
        ],
        'History': [
            { subject: 'History', topic: 'Ancient India' },
            { subject: 'History', topic: 'Medieval India' },
            { subject: 'History', topic: 'Modern India' }
        ],
        'Geography': [
            { subject: 'Geography', topic: 'Physical Geography' },
            { subject: 'Geography', topic: 'Indian Geography' },
            { subject: 'Geography', topic: 'World Geography' }
        ],
        'Economics': [
            { subject: 'Economics', topic: 'Indian Economy' },
            { subject: 'Economics', topic: 'Economic Development' },
            { subject: 'Economics', topic: 'Government Budgeting' }
        ]
    };

    return relatedMap[subject] || [];
}

function getCoreTopics() {
    return [
        { subject: 'Polity', topic: 'Indian Constitution', difficulty: 'moderate' },
        { subject: 'History', topic: 'Freedom Struggle', difficulty: 'moderate' },
        { subject: 'Geography', topic: 'Physical Geography', difficulty: 'easy' },
        { subject: 'Economics', topic: 'Indian Economy Basics', difficulty: 'moderate' },
        { subject: 'Environment', topic: 'Climate Change', difficulty: 'easy' },
        { subject: 'Science', topic: 'Science & Technology', difficulty: 'moderate' },
        { subject: 'Ethics', topic: 'Ethics and Integrity', difficulty: 'moderate' },
        { subject: 'Current Affairs', topic: 'National Issues', difficulty: 'easy' }
    ];
}

export default {
    getLearningPath,
    suggestNextTopics,
    generateStudyPlan,
    updateTopicProgress
};
