import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { getPYQRecommendations } from '@/lib/personalizationHelpers';
import PyqService from '@/lib/pyqService';

/**
 * PYQ Recommendations API
 * GET /api/pyq/recommendations
 * Returns personalized PYQ topic recommendations based on user's weak areas
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { limit = 4 } = req.query;

        // 1. Get personalized topic recommendations
        const topicRecommendations = (await getPYQRecommendations(
            session.user.email,
            parseInt(limit, 10)
        )) || [];

        // 2. Fetch actual questions for these topics
        const pyq = PyqService;
        const allRecommendedQuestions = [];

        for (const rec of topicRecommendations) {
            const filter = pyq.buildFilter({ examCode: 'UPSC' });
            const questions = await pyq.queryDatabase(filter, rec.topic, { limit: 1 });

            if (questions && questions.length > 0) {
                // Attach the reason and enriched metadata to the question object
                allRecommendedQuestions.push({
                    ...questions[0],
                    recommendationReason: rec.reason,
                    intelligenceLabel: rec.label,
                    relevanceScore: rec.relevance,
                    accuracy: rec.accuracy
                });
            }
        }

        // 3. Fallback to sample questions if results are low
        const sampleQuestions = [
            {
                _id: 'sample_hist_1',
                question: 'Evaluate the role of the Bhakti movement in bringing about a social and cultural change in medieval India.',
                year: 2022,
                paper: 'GS-1',
                level: 'Mains',
                exam: 'UPSC',
                topicTags: ['History', 'Art & Culture', 'Medieval India'],
                difficulty: 'Medium',
                recommendationReason: 'Essential History Topic'
            },
            {
                _id: 'sample_geo_1',
                question: 'Explain the formation of the Himalayan mountains and their significance to the climate of the Indian subcontinent.',
                year: 2023,
                paper: 'GS-1',
                level: 'Mains',
                exam: 'UPSC',
                topicTags: ['Geography', 'Physical Geography', 'Indian Climate'],
                difficulty: 'Hard',
                recommendationReason: 'Core Geography Concept'
            },
            {
                _id: 'sample_pol_1',
                question: 'The 73rd Constitutional Amendment Act has been a milestone in the path of decentralization of power in India. Discuss.',
                year: 2021,
                paper: 'GS-2',
                level: 'Mains',
                exam: 'UPSC',
                topicTags: ['Polity', 'Local Governance', 'Constitution'],
                difficulty: 'Medium',
                recommendationReason: 'High-Yield Polity Topic'
            },
            {
                _id: 'sample_eco_1',
                question: 'Discuss the challenges and opportunities of the Indian economy in the context of the "Amrit Kaal" vision.',
                year: 2023,
                paper: 'GS-3',
                level: 'Mains',
                exam: 'UPSC',
                topicTags: ['Economics', 'Indian Economy', 'Infrastructure'],
                difficulty: 'Medium',
                recommendationReason: 'Trending Economics Topic'
            }
        ];

        // If we found fewer than 4 questions, add samples to fill the grid
        if (allRecommendedQuestions.length < 4) {
            const needed = 4 - allRecommendedQuestions.length;
            allRecommendedQuestions.push(...sampleQuestions.slice(0, needed));
        }

        return res.status(200).json({
            ok: true,
            recommendations: allRecommendedQuestions.slice(0, 4),
            message: allRecommendedQuestions.length > 0
                ? `Based on your profile, we found these questions for you.`
                : 'Showing essential practice questions for History and Geography.'
        });
    } catch (error) {
        console.error('Error getting PYQ recommendations:', error);
        return res.status(500).json({
            ok: false,
            error: 'Failed to get recommendations',
            details: error.message
        });
    }
}
