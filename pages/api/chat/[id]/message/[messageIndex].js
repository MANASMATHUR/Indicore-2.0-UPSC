import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import Chat from '@/models/Chat';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id, messageIndex } = req.query;
  const index = parseInt(messageIndex, 10);

  if (!id || isNaN(index)) {
    return res.status(400).json({ error: 'Invalid chat ID or message index' });
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

    if (!chat.messages || index < 0 || index >= chat.messages.length) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (req.method === 'GET') {
      return res.status(200).json({ message: chat.messages[index] });
    }

    if (req.method === 'PATCH') {
      // Bookmark/unbookmark message
      const { bookmarked } = req.body;
      
      if (typeof bookmarked !== 'boolean') {
        return res.status(400).json({ error: 'bookmarked must be a boolean' });
      }

      if (!chat.messages[index].metadata) {
        chat.messages[index].metadata = {};
      }
      chat.messages[index].metadata.bookmarked = bookmarked;
      
      await chat.save();
      return res.status(200).json({ message: chat.messages[index] });
    }

    if (req.method === 'PUT') {
      // Edit message (only user messages)
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'text is required' });
      }

      if (chat.messages[index].sender !== 'user') {
        return res.status(403).json({ error: 'Only user messages can be edited' });
      }

      chat.messages[index].text = text;
      chat.messages[index].metadata = chat.messages[index].metadata || {};
      chat.messages[index].metadata.editedAt = new Date();
      
      await chat.save();
      return res.status(200).json({ message: chat.messages[index] });
    }

    if (req.method === 'DELETE') {
      // Delete message
      chat.messages.splice(index, 1);
      chat.lastMessageAt = chat.messages.length > 0 
        ? chat.messages[chat.messages.length - 1].timestamp 
        : new Date();
      
      await chat.save();
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error handling message action:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

