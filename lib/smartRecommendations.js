/**
 * Smart Study Recommendations Engine
 * Generates personalized study recommendations based on user behavior and patterns
 */

import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import StudySession from '@/models/StudySession';
import UserInteraction from '@/models/UserInteraction';
import MockTestResult from '@/models/MockTestResult';
import { analyzeProductivityPatterns, analyzeAttentionPatterns } from '@/lib/behavioralInsights';

/**
 * Get smart study recommendations for right now
 */
export async function getStudyNowRecommendation(userEmail) {
    await connectToDatabase();

    const [user, productivityPatterns, attentionPatterns] = await Promise.all([
        User.findOne({ email: userEmail }).lean(),
        analyzeProductivityPatterns(userEmail, 30),
        analyzeAttentionPatterns(userEmail, 30)
    ]);

    const currentHour = new Date().getHours();

    // Check if current time is in peak productivity hours
    const isPeakTime = productivityPatterns.peakHours.some(p => p.hour === currentHour);

    // Get weak topics
    const weakTopics = await getWeakTopics(userEmail);

    // Get topics not studied recently
    const neglectedTopics = await getNeglectedTopics(userEmail, 7);

    // Determine what to study
    let recommendedTopic = null;
    let reason = '';
    let priority = 'medium';
    let estimatedTime = attentionPatterns.optimalSessionLength || 45;

    if (isPeakTime && weakTopics.length > 0) {
        // Peak time + weak topic = high priority
        recommendedTopic = weakTopics[0];
        reason = `This is your peak productivity time, and ${recommendedTopic.topic} needs attention`;
        priority = 'high';
        estimatedTime = Math.min(60, attentionPatterns.optimalSessionLength + 15);
    } else if (neglectedTopics.length > 0) {
        // Neglected topic
        recommendedTopic = neglectedTopics[0];
        reason = `You haven't studied ${recommendedTopic.topic} in ${recommendedTopic.daysSince} days`;
        priority = 'medium';
    } else if (weakTopics.length > 0) {
        // Weak topic
        recommendedTopic = weakTopics[0];
        reason = `Focus on improving your understanding of ${recommendedTopic.topic}`;
        priority = 'medium';
    } else {
        // General recommendation
        const nextTopic = await getNextTopicInSyllabus(userEmail);
        recommendedTopic = nextTopic;
        reason = 'Continue your syllabus coverage';
        priority = 'low';
    }

    return {
        topic: recommendedTopic?.topic || 'General Studies',
        category: recommendedTopic?.category || 'GS-1',
        reason,
        priority,
        estimatedTime,
        isPeakTime,
        sessionType: 'focused_study',
        tips: generateStudyTips(recommendedTopic, isPeakTime, attentionPatterns)
    };
}

/**
 * Generate daily study plan
 */
export async function generateDailyStudyPlan(userEmail) {
    await connectToDatabase();

    const [user, weakTopics, neglectedTopics, attentionPatterns, productivityPatterns] = await Promise.all([
        User.findOne({ email: userEmail }).lean(),
        getWeakTopics(userEmail),
        getNeglectedTopics(userEmail, 5),
        analyzeAttentionPatterns(userEmail, 30),
        analyzeProductivityPatterns(userEmail, 30)
    ]);

    const optimalSessionLength = attentionPatterns.optimalSessionLength || 45;
    const peakHours = productivityPatterns.peakHours.map(p => p.hour);

    const plan = {
        date: new Date().toDateString(),
        totalEstimatedTime: 0,
        sessions: [],
        goals: []
    };

    // Session 1: Weak topic during peak time
    if (weakTopics.length > 0 && peakHours.length > 0) {
        plan.sessions.push({
            topic: weakTopics[0].topic,
            category: weakTopics[0].category,
            type: 'focused_study',
            duration: optimalSessionLength,
            suggestedTime: `${formatHour(peakHours[0])} (Peak productivity)`,
            priority: 'high',
            activities: ['Concept revision', 'Practice questions', 'Note-making']
        });
        plan.totalEstimatedTime += optimalSessionLength;
    }

    // Session 2: Neglected topic
    if (neglectedTopics.length > 0) {
        plan.sessions.push({
            topic: neglectedTopics[0].topic,
            category: neglectedTopics[0].category,
            type: 'revision',
            duration: Math.floor(optimalSessionLength * 0.75),
            suggestedTime: 'Flexible',
            priority: 'medium',
            activities: ['Quick revision', 'PYQ practice']
        });
        plan.totalEstimatedTime += Math.floor(optimalSessionLength * 0.75);
    }

    // Session 3: New topic or general study
    const nextTopic = await getNextTopicInSyllabus(userEmail);
    if (nextTopic) {
        plan.sessions.push({
            topic: nextTopic.topic,
            category: nextTopic.category,
            type: 'new_learning',
            duration: optimalSessionLength,
            suggestedTime: 'Flexible',
            priority: 'low',
            activities: ['Introduction', 'Basic concepts', 'Examples']
        });
        plan.totalEstimatedTime += optimalSessionLength;
    }

    // Set goals
    plan.goals = [
        `Complete ${plan.sessions.length} study sessions`,
        `Focus on ${weakTopics.length > 0 ? weakTopics[0].topic : 'your weak areas'}`,
        `Study for ${plan.totalEstimatedTime} minutes total`
    ];

    return plan;
}

/**
 * Get topic priority ranking
 */
export async function getTopicPriorityRanking(userEmail) {
    await connectToDatabase();

    const [weakTopics, neglectedTopics, upcomingExamTopics] = await Promise.all([
        getWeakTopics(userEmail),
        getNeglectedTopics(userEmail, 7),
        getUpcomingExamTopics(userEmail)
    ]);

    const priorityMap = new Map();

    // Add weak topics with high priority
    weakTopics.forEach((topic, index) => {
        priorityMap.set(topic.topic, {
            ...topic,
            priorityScore: 100 - (index * 10),
            reasons: ['Weak area - needs improvement']
        });
    });

    // Add neglected topics
    neglectedTopics.forEach(topic => {
        if (priorityMap.has(topic.topic)) {
            const existing = priorityMap.get(topic.topic);
            existing.priorityScore += 20;
            existing.reasons.push(`Not studied in ${topic.daysSince} days`);
        } else {
            priorityMap.set(topic.topic, {
                ...topic,
                priorityScore: 70,
                reasons: [`Not studied in ${topic.daysSince} days`]
            });
        }
    });

    // Add upcoming exam topics
    upcomingExamTopics.forEach(topic => {
        if (priorityMap.has(topic.topic)) {
            const existing = priorityMap.get(topic.topic);
            existing.priorityScore += 30;
            existing.reasons.push('High weightage in exam');
        } else {
            priorityMap.set(topic.topic, {
                ...topic,
                priorityScore: 60,
                reasons: ['High weightage in exam']
            });
        }
    });

    // Convert to array and sort
    const rankedTopics = Array.from(priorityMap.values())
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .map((topic, index) => ({
            rank: index + 1,
            topic: topic.topic,
            category: topic.category,
            priorityScore: topic.priorityScore,
            reasons: topic.reasons,
            estimatedTime: 45 // Default
        }));

    return rankedTopics;
}

// Helper functions

export async function getWeakTopics(userEmail, limit = 5) {
    const user = await User.findOne({ email: userEmail }).lean();

    if (!user?.profile?.personalization?.topicInterests) {
        return [];
    }

    // Topics with high clarification frequency or low engagement
    const weakTopics = user.profile.personalization.topicInterests
        .filter(t => t.engagementScore < 3 || t.frequency > 5)
        .sort((a, b) => a.engagementScore - b.engagementScore)
        .slice(0, limit)
        .map(t => ({
            topic: t.topic,
            category: t.category || 'General',
            engagementScore: t.engagementScore,
            frequency: t.frequency
        }));

    return weakTopics;
}

export async function getNeglectedTopics(userEmail, daysThreshold = 7) {
    const user = await User.findOne({ email: userEmail }).lean();

    if (!user?.profile?.personalization?.topicInterests) {
        return [];
    }

    const now = new Date();
    const neglected = user.profile.personalization.topicInterests
        .filter(t => {
            if (!t.lastAsked) return false;
            const daysSince = (now - new Date(t.lastAsked)) / (1000 * 60 * 60 * 24);
            return daysSince >= daysThreshold;
        })
        .map(t => {
            const daysSince = Math.floor((now - new Date(t.lastAsked)) / (1000 * 60 * 60 * 24));
            return {
                topic: t.topic,
                category: t.category || 'General',
                daysSince,
                lastStudied: t.lastAsked
            };
        })
        .sort((a, b) => b.daysSince - a.daysSince);

    return neglected;
}

async function getUpcomingExamTopics(userEmail) {
    // This would ideally come from exam syllabus data
    // For now, return common high-weightage topics
    return [
        { topic: 'Indian Polity', category: 'GS-2', weightage: 'high' },
        { topic: 'Modern History', category: 'GS-1', weightage: 'high' },
        { topic: 'Indian Economy', category: 'GS-3', weightage: 'high' }
    ];
}

async function getNextTopicInSyllabus(userEmail) {
    // Simplified - would ideally track syllabus progression
    const topics = [
        { topic: 'Indian Polity', category: 'GS-2' },
        { topic: 'Geography', category: 'GS-1' },
        { topic: 'Economics', category: 'GS-3' },
        { topic: 'Environment', category: 'GS-3' }
    ];

    return topics[Math.floor(Math.random() * topics.length)];
}

function generateStudyTips(topic, isPeakTime, attentionPatterns) {
    const tips = [];

    if (isPeakTime) {
        tips.push('This is your peak productivity time - tackle difficult concepts now');
    }

    if (attentionPatterns.optimalSessionLength < 45) {
        tips.push('Take a short break every 30 minutes to maintain focus');
    }

    if (attentionPatterns.focusQuality === 'low') {
        tips.push('Start with easier topics to build momentum');
    }

    tips.push('Use active recall and practice questions');
    tips.push('Make concise notes for quick revision');

    return tips;
}

function formatHour(hour) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${displayHour}:00 ${period}`;
}

export default {
    getStudyNowRecommendation,
    generateDailyStudyPlan,
    getTopicPriorityRanking
};
