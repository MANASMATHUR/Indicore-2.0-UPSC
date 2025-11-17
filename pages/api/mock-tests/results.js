import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import MockTestResult from '@/models/MockTestResult';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await connectToDatabase();

    const { testId, limit = 10 } = req.query;

    const query = { userId: session.user.id };
    if (testId) {
      query.testId = testId;
    }

    const results = await MockTestResult.find(query)
      .sort({ completedAt: -1 })
      .limit(parseInt(limit))
      .populate('testId', 'title examType paperType');

    // Calculate comparison data if multiple results exist
    let comparison = null;
    if (results.length > 1 && testId) {
      const currentResult = results[0];
      const previousResults = results.slice(1, 6); // Compare with last 5 attempts

      comparison = {
        current: {
          marks: currentResult.marksObtained,
          percentage: currentResult.percentage,
          correct: currentResult.correctAnswers,
          timeSpent: currentResult.timeSpent
        },
        previous: previousResults.map(r => ({
          marks: r.marksObtained,
          percentage: r.percentage,
          correct: r.correctAnswers,
          timeSpent: r.timeSpent,
          date: r.completedAt
        })),
        improvement: {
          marks: currentResult.marksObtained - (previousResults[0]?.marksObtained || 0),
          percentage: currentResult.percentage - (previousResults[0]?.percentage || 0),
          correct: currentResult.correctAnswers - (previousResults[0]?.correctAnswers || 0)
        }
      };
    }

    return res.status(200).json({ results, comparison });
  } catch (error) {
    console.error('Error fetching results:', error);
    return res.status(500).json({ error: 'Failed to fetch results', details: error.message });
  }
}

