/**
 * 30-Day Study Plan Generator
 * Creates comprehensive personalized study plan based on user history and behavioral insights
 */

import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import StudySession from '@/models/StudySession';
import MockTestResult from '@/models/MockTestResult';
import { generateBehavioralInsights } from '@/lib/behavioralInsights';
import { getTopicPriorityRanking } from '@/lib/smartRecommendations';

/**
 * Generate comprehensive 30-day study plan
 */
export async function generate30DayPlan(userEmail) {
    await connectToDatabase();

    const [user, behavioralInsights, topicPriorities, recentSessions, mockTests] = await Promise.all([
        User.findOne({ email: userEmail }).lean(),
        generateBehavioralInsights(userEmail, 30),
        getTopicPriorityRanking(userEmail),
        StudySession.find({ userEmail }).sort({ startTime: -1 }).limit(30).lean(),
        MockTestResult.find({ userEmail }).sort({ completedAt: -1 }).limit(5).lean()
    ]);

    const plan = {
        overview: generateOverview(user, behavioralInsights, recentSessions),
        weeks: [],
        goals: generateMonthlyGoals(topicPriorities, behavioralInsights),
        milestones: generateMilestones(),
        recommendations: generateRecommendations(behavioralInsights)
    };

    // Generate 4 weeks of detailed plans
    for (let week = 1; week <= 4; week++) {
        plan.weeks.push(generateWeekPlan(week, topicPriorities, behavioralInsights, user));
    }

    return plan;
}

/**
 * Generate plan overview
 */
function generateOverview(user, insights, sessions) {
    const totalStudyTime = sessions.reduce((sum, s) => sum + s.duration, 0);
    const avgDailyTime = sessions.length > 0 ? totalStudyTime / 30 : 0;

    return {
        currentStreak: user?.statistics?.studyStreak || 0,
        totalStudyTime: Math.round(totalStudyTime),
        avgDailyTime: Math.round(avgDailyTime),
        focusQuality: insights.attentionPatterns.focusQuality,
        productivityTrend: insights.productivityPatterns.productivityTrend,
        burnoutRisk: insights.burnoutRisk.riskLevel,
        learningStyle: insights.learningStyle.preferredFormat,
        targetDailyTime: calculateTargetDailyTime(avgDailyTime, insights)
    };
}

/**
 * Calculate recommended daily study time
 */
function calculateTargetDailyTime(current, insights) {
    const optimal = insights.attentionPatterns.optimalSessionLength || 45;

    // Recommend 2-3 sessions per day based on current pace
    if (current < 60) {
        return Math.min(current + 30, optimal * 2); // Gradual increase
    } else if (current > 180 && insights.burnoutRisk.riskLevel === 'high') {
        return 150; // Reduce if burnout risk
    }

    return Math.min(optimal * 3, 180); // Max 3 hours
}

/**
 * Generate monthly goals
 */
function generateMonthlyGoals(priorities, insights) {
    const goals = [];

    // Topic coverage goals
    const topPriorities = priorities.slice(0, 5);
    const topicGoals = topPriorities.length > 0
        ? topPriorities.map(p => ({
            topic: p.topic,
            target: 'Complete comprehensive revision',
            priority: p.priorityScore > 80 ? 'high' : 'medium'
        }))
        : [
            { topic: 'General Studies', target: 'Complete NCERT foundation', priority: 'high' },
            { topic: 'Current Affairs', target: 'Read monthly magazines', priority: 'medium' }
        ];

    goals.push({
        category: 'Topic Coverage',
        items: topicGoals
    });

    // Study consistency goals
    goals.push({
        category: 'Study Consistency',
        items: [
            { target: 'Maintain 25+ day study streak', priority: 'high' },
            { target: `Study ${insights.attentionPatterns.optimalSessionLength}min sessions`, priority: 'medium' },
            { target: 'Take breaks every 50 minutes', priority: 'medium' }
        ]
    });

    // Performance goals
    goals.push({
        category: 'Performance',
        items: [
            { target: 'Complete 4 full-length mock tests', priority: 'high' },
            { target: 'Improve weak areas by 20%', priority: 'high' },
            { target: 'Solve 200+ PYQs', priority: 'medium' }
        ]
    });

    return goals;
}

/**
 * Generate week plan
 */
function generateWeekPlan(weekNumber, priorities, insights, user) {
    const week = {
        weekNumber,
        title: `Week ${weekNumber}: ${getWeekTheme(weekNumber, priorities)}`,
        focus: getWeekFocus(weekNumber, priorities),
        days: []
    };

    const peakHours = insights.productivityPatterns.peakHours;
    const optimalSession = insights.attentionPatterns.optimalSessionLength;

    // Generate 7 days
    for (let day = 1; day <= 7; day++) {
        const dayNumber = (weekNumber - 1) * 7 + day;
        week.days.push(generateDayPlan(dayNumber, priorities, peakHours, optimalSession, weekNumber));
    }

    return week;
}

/**
 * Get week theme based on priorities
 */
function getWeekTheme(weekNumber, priorities) {
    const themes = [
        'Foundation Building',
        'Deep Dive & Practice',
        'Revision & Mock Tests',
        'Final Polish & Assessment'
    ];
    return themes[weekNumber - 1];
}

/**
 * Get week focus areas
 */
function getWeekFocus(weekNumber, priorities) {
    if (!priorities || priorities.length === 0) {
        return ['General Studies', 'Current Affairs'];
    }
    const topTopics = priorities.slice(0, 8);
    const startIdx = (weekNumber - 1) * 2;
    return topTopics.slice(startIdx, startIdx + 2).map(p => p.topic);
}

/**
 * Generate daily plan
 */
function generateDayPlan(dayNumber, priorities, peakHours, optimalSession, weekNumber) {
    const dayOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][(dayNumber - 1) % 7];
    const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';

    const day = {
        dayNumber,
        dayOfWeek,
        date: getDateFromDayNumber(dayNumber),
        sessions: [],
        totalTime: 0,
        goals: []
    };

    // Sunday = Rest day or light revision
    if (dayOfWeek === 'Sunday') {
        day.sessions.push({
            time: 'Flexible',
            type: 'light_revision',
            topic: 'Previous week topics',
            duration: 60,
            activities: ['Quick revision', 'Solve 10 PYQs', 'Review notes']
        });
        day.totalTime = 60;
        day.goals = ['Light revision only', 'Rest and recharge'];
        return day;
    }

    // Saturday = Mock test day (every alternate Saturday)
    if (dayOfWeek === 'Saturday' && weekNumber % 2 === 0) {
        day.sessions.push({
            time: '9:00 AM',
            type: 'mock_test',
            topic: 'Full-length Mock Test',
            duration: 180,
            activities: ['Complete mock test', 'Self-evaluation', 'Identify weak areas']
        });
        day.totalTime = 180;
        day.goals = ['Complete mock test', 'Score 60%+'];
        return day;
    }

    // Regular weekday plan
    const pLength = priorities?.length || 0;
    const topicIndex = pLength > 0 ? Math.floor((dayNumber - 1) / 3) % pLength : 0;
    const mainTopic = pLength > 0 ? priorities[topicIndex] : { topic: 'General Studies', category: 'GS' };
    const peakTime = peakHours.length > 0 ? peakHours[0].timeLabel : '9:00 AM';

    // Session 1: Main topic (peak time)
    day.sessions.push({
        time: peakTime,
        type: 'focused_study',
        topic: mainTopic?.topic || 'General Studies',
        category: mainTopic?.category || 'GS',
        duration: optimalSession,
        activities: [
            'Read NCERT/Standard book',
            'Make concise notes',
            'Solve 5-10 PYQs'
        ],
        priority: 'high'
    });

    // Session 2: Revision or secondary topic
    const secondaryTopicIndex = pLength > 0 ? (topicIndex + 3) % pLength : 0;
    const secondaryTopic = pLength > 0 ? priorities[secondaryTopicIndex] : { topic: 'Current Affairs', category: 'General' };

    day.sessions.push({
        time: 'Flexible',
        type: 'revision',
        topic: secondaryTopic?.topic || 'Current Affairs',
        category: secondaryTopic?.category || 'General',
        duration: Math.floor(optimalSession * 0.75),
        activities: [
            'Quick revision',
            'Practice questions',
            'Current affairs integration'
        ],
        priority: 'medium'
    });

    // Session 3: Current affairs (shorter session)
    if (!isWeekend) {
        day.sessions.push({
            time: 'Evening',
            type: 'current_affairs',
            topic: 'Daily Current Affairs',
            duration: 30,
            activities: [
                'Read daily news digest',
                'Make notes of important events',
                'Link to static topics'
            ],
            priority: 'medium'
        });
    }

    day.totalTime = day.sessions.reduce((sum, s) => sum + s.duration, 0);
    day.goals = [
        `Complete ${mainTopic.topic} chapter`,
        'Solve 15+ questions',
        'Review current affairs'
    ];

    return day;
}

/**
 * Generate milestones
 */
function generateMilestones() {
    return [
        {
            day: 7,
            title: 'Week 1 Complete',
            description: 'Foundation topics covered',
            checkpoints: ['2 topics completed', '50+ PYQs solved', '7-day streak maintained']
        },
        {
            day: 14,
            title: 'Week 2 Complete',
            description: 'Deep dive completed',
            checkpoints: ['4 topics mastered', 'First mock test done', '14-day streak achieved']
        },
        {
            day: 21,
            title: 'Week 3 Complete',
            description: 'Revision phase done',
            checkpoints: ['All priority topics revised', '150+ PYQs solved', '21-day streak!']
        },
        {
            day: 30,
            title: 'Month Complete! 🎉',
            description: 'Full plan executed',
            checkpoints: ['6+ topics mastered', '3-4 mock tests completed', '30-day streak achieved', 'Ready for next level']
        }
    ];
}

/**
 * Generate personalized recommendations
 */
function generateRecommendations(insights) {
    const recommendations = [];

    // Based on learning style
    if (insights.learningStyle.exampleOriented) {
        recommendations.push({
            category: 'Study Approach',
            suggestion: 'Focus on case studies and real-world examples',
            reason: 'Your learning style is example-oriented'
        });
    }

    // Based on attention patterns
    if (insights.attentionPatterns.optimalSessionLength < 45) {
        recommendations.push({
            category: 'Session Length',
            suggestion: `Keep sessions to ${insights.attentionPatterns.optimalSessionLength} minutes`,
            reason: 'This is your optimal focus duration'
        });
    }

    // Based on productivity patterns
    if (insights.productivityPatterns.peakHours.length > 0) {
        const peakTime = insights.productivityPatterns.peakHours[0].timeLabel;
        recommendations.push({
            category: 'Study Timing',
            suggestion: `Schedule difficult topics around ${peakTime}`,
            reason: 'This is your peak productivity time'
        });
    }

    // Based on burnout risk
    if (insights.burnoutRisk.riskLevel === 'high' || insights.burnoutRisk.riskLevel === 'moderate') {
        recommendations.push({
            category: 'Well-being',
            suggestion: 'Take complete rest on Sundays',
            reason: `Burnout risk is ${insights.burnoutRisk.riskLevel}`
        });
    }

    // General recommendations
    recommendations.push({
        category: 'Consistency',
        suggestion: 'Study at the same time daily to build habit',
        reason: 'Consistency improves retention and reduces decision fatigue'
    });

    recommendations.push({
        category: 'Breaks',
        suggestion: 'Take 10-minute break every 50 minutes',
        reason: 'Prevents mental fatigue and improves focus'
    });

    return recommendations;
}

/**
 * Get date from day number (relative to today)
 */
function getDateFromDayNumber(dayNumber) {
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + dayNumber - 1);

    return targetDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

export default {
    generate30DayPlan
};
