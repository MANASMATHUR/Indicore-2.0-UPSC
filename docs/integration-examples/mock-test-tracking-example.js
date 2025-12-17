/**
 * Example Integration: Mock Test Tracking
 * Add this code to pages/api/mock-tests/create.js and submit.js
 */

// At the top of the file, add import:
import { trackInteraction } from '@/lib/personalizationHelpers';
import { v4 as uuidv4 } from 'uuid';

// ========== In create.js ==========
// After successful mock test creation, add tracking:

let sessionId = req.cookies.sessionId;
if (!sessionId) {
    sessionId = uuidv4();
    res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`);
}

await trackInteraction(
    session?.user?.email || null,
    sessionId,
    'mock_test',
    'mock_test_create',
    'generate',
    {
        topic: subject || 'General',
        subject: subject,
        difficulty: difficulty || 'medium',
        category: 'mock_test',
        engagementScore: 9, // High engagement for creating a test
        customData: {
            examType,
            paperType,
            totalQuestions,
            duration,
            subjects: blueprint?.subjectDistribution || {}
        }
    }
);

// ========== In submit.js ==========
// After successful mock test submission, add tracking:

await trackInteraction(
    session?.user?.email || null,
    sessionId,
    'mock_test',
    'mock_test_submit',
    'submit',
    {
        topic: mockTest.subject || 'General',
        subject: mockTest.subject,
        difficulty: mockTest.difficulty || 'medium',
        category: 'mock_test',
        timeSpent: calculateTimeSpent(startTime, endTime), // Calculate from test duration
        engagementScore: 10, // Maximum engagement for completing a test
        performance: {
            score: finalScore,
            accuracy: (correctAnswers / totalQuestions) * 100,
            questionsAttempted: totalQuestions,
            questionsCorrect: correctAnswers
        },
        customData: {
            testId: mockTest._id,
            examType: mockTest.examType,
            paperType: mockTest.paperType,
            totalQuestions: mockTest.totalQuestions,
            duration: mockTest.duration,
            timeTaken: calculateTimeSpent(startTime, endTime)
        }
    }
);

function calculateTimeSpent(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    return Math.floor((new Date(endTime) - new Date(startTime)) / 1000); // in seconds
}
