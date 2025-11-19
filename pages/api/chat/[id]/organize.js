import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import Chat from '@/models/Chat';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Chat ID is required' });
  }

  try {
    await connectToDatabase();

    const chat = await Chat.findOne({ 
      _id: id, 
      userEmail: session.user.email 
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (req.method === 'PATCH') {
      const { folder, tags, archived } = req.body;
      
      const updateData = {};
      if (folder !== undefined) updateData.folder = folder;
      if (tags !== undefined) updateData.tags = tags;
      if (archived !== undefined) updateData.archived = archived;

      Object.assign(chat, updateData);
      await chat.save();

      return res.status(200).json({ chat });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error organizing chat:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

