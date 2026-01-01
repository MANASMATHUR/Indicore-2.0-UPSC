/**
 * Syllabus Progress API
 * GET /api/syllabus/progress
 * 
 * Tracks user progress across exam syllabus topics
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import StudySession from '@/models/StudySession';
import MockTestResult from '@/models/MockTestResult';
import PYQ from '@/models/PYQ';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const session = await getServerSession(req, res, authOptions);
        if (!session?.user?.email) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        await connectToDatabase();

        const { exam = 'UPSC' } = req.query;
        const userEmail = session.user.email;

        // Fetch user's study sessions, mock tests, and PYQ attempts
        const [studySessions, mockTests, user] = await Promise.all([
            StudySession.find({ userEmail }).lean(),
            MockTestResult.find({ userEmail }).lean(),
            User.findOne({ email: userEmail }).lean()
        ]);

        // Calculate progress for each topic
        const topicProgress = {};

        // Define topic mappings (can be moved to a config file)
        const topicMappings = {
            'gs1-history': ['history', 'heritage', 'culture', 'ancient', 'medieval', 'modern'],
            'gs1-geography': ['geography', 'physical', 'indian geography', 'world geography'],
            'gs1-society': ['society', 'social', 'diversity', 'women', 'urbanization'],
            'gs2-polity': ['polity', 'constitution', 'governance', 'political'],
            'gs2-ir': ['international relations', 'bilateral', 'foreign policy'],
            'gs3-economy': ['economy', 'economics', 'agriculture', 'industry', 'banking'],
            'gs3-environment': ['environment', 'ecology', 'biodiversity', 'climate'],
            'gs3-security': ['security', 'internal security', 'cyber', 'disaster'],
            'gs4-ethics': ['ethics', 'integrity', 'probity', 'emotional intelligence']
        };

        // Calculate progress for each topic
        for (const [topicId, keywords] of Object.entries(topicMappings)) {
            // Count study sessions related to this topic
            const topicSessions = studySessions.filter(session => {
                const topic = (session.topic || '').toLowerCase();
                return keywords.some(keyword => topic.includes(keyword));
            });

            // Count PYQs solved for this topic
            const pyqsSolved = topicSessions.reduce((sum, session) => {
                return sum + (session.questionsAttempted || 0);
            }, 0);

            // Count mock tests covering this topic
            const topicMockTests = mockTests.filter(test => {
                const subjects = test.subjects || [];
                return keywords.some(keyword =>
                    subjects.some(subject => subject.toLowerCase().includes(keyword))
                );
            });

            // Calculate total study time for this topic
            const totalStudyTime = topicSessions.reduce((sum, session) => {
                return sum + (session.duration || 0);
            }, 0);

            // Calculate percentage based on:
            // - Study time (40%)
            // - PYQs solved (30%)
            // - Mock tests (30%)
            const studyTimeScore = Math.min((totalStudyTime / 600) * 100, 100); // 10 hours = 100%
            const pyqScore = Math.min((pyqsSolved / 50) * 100, 100); // 50 PYQs = 100%
            const mockTestScore = Math.min((topicMockTests.length / 5) * 100, 100); // 5 tests = 100%

            const percentage = Math.round(
                (studyTimeScore * 0.4) + (pyqScore * 0.3) + (mockTestScore * 0.3)
            );

            // Find last studied date
            const lastStudied = topicSessions.length > 0
                ? topicSessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0].startTime
                : null;

            topicProgress[topicId] = {
                completed: topicSessions.length,
                total: 100, // Arbitrary total for now
                percentage,
                lastStudied,
                pyqsSolved,
                mockTests: topicMockTests.length,
                studyTime: totalStudyTime
            };
        }

        // Calculate overall progress
        const overallProgress = Math.round(
            Object.values(topicProgress).reduce((sum, topic) => sum + topic.percentage, 0) /
            Object.keys(topicProgress).length
        );

        return res.status(200).json({
            success: true,
            exam,
            progress: topicProgress,
            overallProgress,
            lastUpdated: new Date()
        });

    } catch (error) {
        console.error('Syllabus progress error:', error);
        return res.status(500).json({
            error: 'Failed to fetch syllabus progress',
            details: error.message
        });
    }
}
