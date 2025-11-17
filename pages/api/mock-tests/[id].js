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
    const { id } = req.query;

    await connectToDatabase();

    const test = await MockTest.findById(id);

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    // Check access
    if (!test.isPublic && test.createdBy.toString() !== session.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.status(200).json({ test });
  } catch (error) {
    console.error('Error fetching test:', error);
    return res.status(500).json({ error: 'Failed to fetch test', details: error.message });
  }
}

