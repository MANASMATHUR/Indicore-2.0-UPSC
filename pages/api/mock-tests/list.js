import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import MockTest from '@/models/MockTest';

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

    const { examType, paperType, subject, limit = 20 } = req.query;

    const query = {
      $or: [
        { isPublic: true },
        { createdBy: session.user.id }
      ]
    };

    if (examType) query.examType = examType;
    if (paperType) query.paperType = paperType;
    if (subject) query.subject = subject;

    const tests = await MockTest.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('-questions'); // Don't send questions in list

    return res.status(200).json({ tests });
  } catch (error) {
    console.error('Error fetching tests:', error);
    return res.status(500).json({ error: 'Failed to fetch tests', details: error.message });
  }
}

