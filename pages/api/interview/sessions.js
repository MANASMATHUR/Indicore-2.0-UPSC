import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import InterviewSession from '@/models/InterviewSession';

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

    const { limit = 20 } = req.query;

    const sessions = await InterviewSession.find({ userId: session.user.id })
      .sort({ completedAt: -1 })
      .limit(parseInt(limit));

    return res.status(200).json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch sessions', details: error.message });
  }
}

