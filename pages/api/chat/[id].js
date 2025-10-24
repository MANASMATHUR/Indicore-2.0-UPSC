import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Chat from '@/models/Chat';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    if (req.method === 'GET') {
      // Get specific chat
      const chat = await Chat.findOne({ 
        _id: id, 
        userEmail: session.user.email 
      });

      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      return res.status(200).json({ chat });
    }

    if (req.method === 'PUT') {
      // Update chat (rename, settings, add assistant message, etc.)
      const { name, settings, message, language = 'en' } = req.body;
      
      const updateData = {};
      if (name) updateData.name = name;
      if (settings) updateData.settings = settings;

      const chat = await Chat.findOneAndUpdate(
        { _id: id, userEmail: session.user.email },
        updateData,
        { new: true }
      );

      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      // If adding a message (AI response)
      if (message) {
        chat.messages.push({
          sender: 'assistant',
          text: message,
          language,
          timestamp: new Date()
        });
        chat.lastMessageAt = new Date();
        await chat.save();
      }

      return res.status(200).json({ chat });
    }

    if (req.method === 'DELETE') {
      // Soft delete chat
      const chat = await Chat.findOneAndUpdate(
        { _id: id, userEmail: session.user.email },
        { isActive: false },
        { new: true }
      );

      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      return res.status(200).json({ message: 'Chat deleted successfully' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
