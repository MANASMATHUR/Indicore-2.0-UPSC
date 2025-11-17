import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import InterviewSession from '@/models/InterviewSession';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { sessionName, examType, questions, overallFeedback, personalityTest, duration } = req.body;

    await connectToDatabase();

    const sessionData = {
      userId: session.user.id,
      sessionName: sessionName || 'Interview Session',
      examType: examType || 'UPSC',
      questions: questions || [],
      totalQuestions: questions?.length || 0,
      averageScore: questions?.length > 0 
        ? questions.reduce((sum, q) => sum + (q.feedback?.score || 0), 0) / questions.length 
        : 0,
      overallFeedback: overallFeedback || {},
      personalityTest: personalityTest || {},
      duration: duration || 0,
      completedAt: new Date()
    };

    const interviewSession = await InterviewSession.create(sessionData);

    return res.status(200).json({ session: interviewSession });
  } catch (error) {
    console.error('Error saving interview session:', error);
    return res.status(500).json({ error: 'Failed to save session', details: error.message });
  }
}

