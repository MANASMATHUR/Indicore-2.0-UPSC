/**
 * Behavioral Insights Engine
 * Deep analysis of user study patterns, learning behavior, and productivity metrics
 */

import connectToDatabase from '@/lib/mongodb';
import StudySession from '@/models/StudySession';
import Chat from '@/models/Chat';
import UserInteraction from '@/models/UserInteraction';
import User from '@/models/User';

/**
 * Analyze user's learning style based on interaction patterns
 */
export async function analyzeLearningStyle(userEmail, days = 30) {
    await connectToDatabase();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const [chats, interactions] = await Promise.all([
        Chat.find({
            userEmail,
            createdAt: { $gte: cutoffDate }
        }).lean(),
        UserInteraction.find({
            userEmail,
            timestamp: { $gte: cutoffDate }
        }).lean()
    ]);

    const analysis = {
        preferredFormat: 'mixed',
        visualLearner: false,
        exampleOriented: false,
        theoryOriented: false,
        deepDiveApproach: false,
        breadthFirstApproach: false,
        discussionBased: false,
        confidence: 0
    };

    let totalMessages = 0;
    let exampleRequests = 0;
    let theoryQuestions = 0;
    let followUpDepth = 0;
    let topicSwitches = 0;
    let previousTopic = null;

    chats.forEach(chat => {
        if (!chat.messages || !Array.isArray(chat.messages)) return;

        chat.messages.forEach(msg => {
            if (msg.sender === 'user') {
                totalMessages++;
                const text = (msg.text || '').toLowerCase();

                // Detect example requests
                if (/example|instance|case study|illustration|demonstrate/.test(text)) {
                    exampleRequests++;
                }

                // Detect theory questions
                if (/explain|define|what is|concept|theory|principle/.test(text)) {
                    theoryQuestions++;
                }

                // Detect follow-up depth
                if (/more|further|elaborate|detail|deep|comprehensive/.test(text)) {
                    followUpDepth++;
                }

                // Detect topic switches
                const currentTopic = extractTopicFromText(text);
                if (currentTopic && previousTopic && currentTopic !== previousTopic) {
                    topicSwitches++;
                }
                previousTopic = currentTopic;
            }
        });
    });

    if (totalMessages > 0) {
        const exampleRatio = exampleRequests / totalMessages;
        const theoryRatio = theoryQuestions / totalMessages;
        const deepDiveRatio = followUpDepth / totalMessages;
        const switchRatio = topicSwitches / totalMessages;

        // Determine learning style
        analysis.exampleOriented = exampleRatio > 0.3;
        analysis.theoryOriented = theoryRatio > 0.4;
        analysis.deepDiveApproach = deepDiveRatio > 0.2 && switchRatio < 0.3;
        analysis.breadthFirstApproach = switchRatio > 0.3;

        // Determine preferred format
        if (analysis.exampleOriented && analysis.deepDiveApproach) {
            analysis.preferredFormat = 'case_study_based';
        } else if (analysis.theoryOriented && analysis.deepDiveApproach) {
            analysis.preferredFormat = 'comprehensive_theory';
        } else if (analysis.breadthFirstApproach) {
            analysis.preferredFormat = 'concise_overview';
        } else {
            analysis.preferredFormat = 'balanced_mixed';
        }

        analysis.confidence = Math.min(totalMessages / 50, 1); // Higher confidence with more data
    }

    return analysis;
}

/**
 * Calculate attention span and focus patterns
 */
export async function analyzeAttentionPatterns(userEmail, days = 30) {
    await connectToDatabase();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const sessions = await StudySession.find({
        userEmail,
        startTime: { $gte: cutoffDate }
    }).sort({ startTime: -1 }).lean();

    if (sessions.length === 0) {
        return {
            averageSessionLength: 0,
            optimalSessionLength: 30,
            attentionSpan: 'unknown',
            focusQuality: 'unknown',
            breakFrequency: 'unknown',
            recommendations: []
        };
    }

    // Calculate metrics
    const sessionLengths = sessions.map(s => s.duration);
    const focusScores = sessions.map(s => s.focusScore || 0.5);
    const breakCounts = sessions.map(s => s.breaksTaken || 0);

    const avgSessionLength = sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length;
    const avgFocusScore = focusScores.reduce((a, b) => a + b, 0) / focusScores.length;
    const avgBreaks = breakCounts.reduce((a, b) => a + b, 0) / breakCounts.length;

    // Find optimal session length (where focus score is highest)
    const sessionsByLength = {};
    sessions.forEach(s => {
        const bucket = Math.floor(s.duration / 15) * 15; // 15-min buckets
        if (!sessionsByLength[bucket]) {
            sessionsByLength[bucket] = { totalFocus: 0, count: 0 };
        }
        sessionsByLength[bucket].totalFocus += s.focusScore || 0.5;
        sessionsByLength[bucket].count += 1;
    });

    let optimalLength = 30;
    let maxAvgFocus = 0;
    Object.entries(sessionsByLength).forEach(([length, data]) => {
        const avgFocus = data.totalFocus / data.count;
        if (avgFocus > maxAvgFocus && data.count >= 3) {
            maxAvgFocus = avgFocus;
            optimalLength = parseInt(length);
        }
    });

    // Determine attention span category
    let attentionSpan = 'medium';
    if (avgSessionLength < 20) attentionSpan = 'short';
    else if (avgSessionLength > 60) attentionSpan = 'long';

    // Focus quality
    let focusQuality = 'moderate';
    if (avgFocusScore < 0.4) focusQuality = 'low';
    else if (avgFocusScore > 0.7) focusQuality = 'high';

    // Break frequency
    let breakFrequency = 'moderate';
    if (avgBreaks < 1) breakFrequency = 'low';
    else if (avgBreaks > 3) breakFrequency = 'high';

    // Generate recommendations
    const recommendations = [];
    if (avgFocusScore < 0.5) {
        recommendations.push('Consider shorter study sessions to maintain focus');
    }
    if (avgSessionLength > optimalLength + 15) {
        recommendations.push(`Your optimal session length is ${optimalLength} minutes - try breaking longer sessions`);
    }
    if (avgBreaks < 1 && avgSessionLength > 45) {
        recommendations.push('Take regular breaks during long sessions to maintain productivity');
    }

    return {
        averageSessionLength: Math.round(avgSessionLength),
        optimalSessionLength: optimalLength,
        attentionSpan,
        focusQuality,
        breakFrequency,
        averageFocusScore: avgFocusScore.toFixed(2),
        recommendations
    };
}

/**
 * Detect productivity patterns and peak performance times
 */
export async function analyzeProductivityPatterns(userEmail, days = 30) {
    await connectToDatabase();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const sessions = await StudySession.find({
        userEmail,
        startTime: { $gte: cutoffDate }
    }).lean();

    const hourlyData = {};
    const dailyData = {};

    sessions.forEach(session => {
        const hour = new Date(session.startTime).getHours();
        const day = new Date(session.startTime).toLocaleDateString('en-US', { weekday: 'long' });

        // Hourly analysis
        if (!hourlyData[hour]) {
            hourlyData[hour] = {
                sessions: 0,
                totalProductivity: 0,
                totalFocus: 0,
                totalDuration: 0
            };
        }
        hourlyData[hour].sessions += 1;
        hourlyData[hour].totalProductivity += session.productivityScore || 0.5;
        hourlyData[hour].totalFocus += session.focusScore || 0.5;
        hourlyData[hour].totalDuration += session.duration;

        // Daily analysis
        if (!dailyData[day]) {
            dailyData[day] = {
                sessions: 0,
                totalProductivity: 0,
                totalDuration: 0
            };
        }
        dailyData[day].sessions += 1;
        dailyData[day].totalProductivity += session.productivityScore || 0.5;
        dailyData[day].totalDuration += session.duration;
    });

    // Find peak hours
    const peakHours = Object.entries(hourlyData)
        .map(([hour, data]) => ({
            hour: parseInt(hour),
            avgProductivity: data.totalProductivity / data.sessions,
            avgFocus: data.totalFocus / data.sessions,
            sessionCount: data.sessions,
            totalTime: data.totalDuration
        }))
        .sort((a, b) => b.avgProductivity - a.avgProductivity)
        .slice(0, 3);

    // Find peak days
    const peakDays = Object.entries(dailyData)
        .map(([day, data]) => ({
            day,
            avgProductivity: data.totalProductivity / data.sessions,
            sessionCount: data.sessions,
            totalTime: data.totalDuration
        }))
        .sort((a, b) => b.avgProductivity - a.avgProductivity);

    // Determine productivity trend
    const recentSessions = sessions.slice(0, 10);
    const olderSessions = sessions.slice(-10);

    const recentAvg = recentSessions.reduce((sum, s) => sum + (s.productivityScore || 0.5), 0) / recentSessions.length;
    const olderAvg = olderSessions.reduce((sum, s) => sum + (s.productivityScore || 0.5), 0) / olderSessions.length;

    let trend = 'stable';
    if (recentAvg > olderAvg + 0.1) trend = 'improving';
    else if (recentAvg < olderAvg - 0.1) trend = 'declining';

    return {
        peakHours: peakHours.map(h => ({
            hour: h.hour,
            timeLabel: formatHour(h.hour),
            productivity: h.avgProductivity.toFixed(2),
            focus: h.avgFocus.toFixed(2),
            sessions: h.sessionCount
        })),
        peakDays: peakDays.map(d => ({
            day: d.day,
            productivity: d.avgProductivity.toFixed(2),
            sessions: d.sessionCount,
            totalMinutes: Math.round(d.totalTime)
        })),
        productivityTrend: trend,
        overallProductivity: (sessions.reduce((sum, s) => sum + (s.productivityScore || 0.5), 0) / sessions.length).toFixed(2)
    };
}

/**
 * Calculate burnout risk score
 */
export async function calculateBurnoutRisk(userEmail, days = 14) {
    await connectToDatabase();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const [sessions, user] = await Promise.all([
        StudySession.find({
            userEmail,
            startTime: { $gte: cutoffDate }
        }).sort({ startTime: -1 }).lean(),
        User.findOne({ email: userEmail }).lean()
    ]);

    let riskScore = 0;
    const riskFactors = [];

    if (sessions.length === 0) {
        return { riskScore: 0, riskLevel: 'low', factors: [], recommendations: [] };
    }

    // Factor 1: Excessive study hours
    const totalHours = sessions.reduce((sum, s) => sum + s.duration, 0) / 60;
    const avgHoursPerDay = totalHours / days;
    if (avgHoursPerDay > 8) {
        riskScore += 25;
        riskFactors.push('Studying more than 8 hours per day on average');
    } else if (avgHoursPerDay > 6) {
        riskScore += 15;
        riskFactors.push('High daily study hours');
    }

    // Factor 2: Declining focus scores
    const recentFocus = sessions.slice(0, 5).reduce((sum, s) => sum + (s.focusScore || 0.5), 0) / 5;
    const olderFocus = sessions.slice(-5).reduce((sum, s) => sum + (s.focusScore || 0.5), 0) / 5;
    if (recentFocus < olderFocus - 0.2) {
        riskScore += 20;
        riskFactors.push('Significant decline in focus quality');
    }

    // Factor 3: Insufficient breaks
    const avgBreaks = sessions.reduce((sum, s) => sum + (s.breaksTaken || 0), 0) / sessions.length;
    if (avgBreaks < 0.5) {
        riskScore += 15;
        riskFactors.push('Not taking enough breaks');
    }

    // Factor 4: Inconsistent study pattern
    const dailyStudy = {};
    sessions.forEach(s => {
        const date = new Date(s.startTime).toDateString();
        dailyStudy[date] = (dailyStudy[date] || 0) + s.duration;
    });
    const studyDays = Object.keys(dailyStudy).length;
    if (studyDays < days * 0.5) {
        riskScore += 10;
        riskFactors.push('Inconsistent study schedule');
    }

    // Factor 5: Late night studying
    const lateNightSessions = sessions.filter(s => {
        const hour = new Date(s.startTime).getHours();
        return hour >= 23 || hour < 5;
    });
    if (lateNightSessions.length > sessions.length * 0.3) {
        riskScore += 15;
        riskFactors.push('Frequent late-night study sessions');
    }

    // Factor 6: No rest days
    if (studyDays >= days - 1) {
        riskScore += 15;
        riskFactors.push('Not taking rest days');
    }

    // Determine risk level
    let riskLevel = 'low';
    if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 35) riskLevel = 'moderate';

    // Generate recommendations
    const recommendations = [];
    if (riskLevel === 'high' || riskLevel === 'moderate') {
        recommendations.push('Take a complete rest day to recharge');
        recommendations.push('Reduce daily study hours to 4-6 hours');
        recommendations.push('Ensure 7-8 hours of sleep');
    }
    if (avgBreaks < 1) {
        recommendations.push('Take a 10-minute break every 45-60 minutes');
    }
    if (lateNightSessions.length > 0) {
        recommendations.push('Avoid studying late at night - maintain a consistent sleep schedule');
    }

    return {
        riskScore,
        riskLevel,
        factors: riskFactors,
        recommendations,
        metrics: {
            avgHoursPerDay: avgHoursPerDay.toFixed(1),
            studyDaysInPeriod: studyDays,
            avgBreaksPerSession: avgBreaks.toFixed(1),
            lateNightSessionPercentage: ((lateNightSessions.length / sessions.length) * 100).toFixed(0)
        }
    };
}

/**
 * Comprehensive behavioral insights
 */
export async function generateBehavioralInsights(userEmail, days = 30) {
    const [learningStyle, attentionPatterns, productivityPatterns, burnoutRisk] = await Promise.all([
        analyzeLearningStyle(userEmail, days),
        analyzeAttentionPatterns(userEmail, days),
        analyzeProductivityPatterns(userEmail, days),
        calculateBurnoutRisk(userEmail, 14)
    ]);

    return {
        learningStyle,
        attentionPatterns,
        productivityPatterns,
        burnoutRisk,
        generatedAt: new Date(),
        dataQuality: learningStyle.confidence > 0.5 ? 'high' : 'moderate'
    };
}

// Helper functions
function extractTopicFromText(text) {
    const topicMap = {
        'polity': /polity|constitution|parliament|judiciary|governance/i,
        'economics': /economics|economy|gdp|inflation|fiscal|monetary/i,
        'geography': /geography|climate|rivers|mountains|agriculture/i,
        'history': /history|ancient|medieval|modern|independence/i,
        'environment': /environment|climate change|pollution|biodiversity/i,
        'science': /science|physics|chemistry|biology|technology/i
    };

    for (const [topic, pattern] of Object.entries(topicMap)) {
        if (pattern.test(text)) return topic;
    }
    return null;
}

function formatHour(hour) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${displayHour}:00 ${period}`;
}

export default {
    analyzeLearningStyle,
    analyzeAttentionPatterns,
    analyzeProductivityPatterns,
    calculateBurnoutRisk,
    generateBehavioralInsights
};
