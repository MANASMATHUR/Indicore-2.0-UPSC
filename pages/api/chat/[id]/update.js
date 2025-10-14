import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Chat from '@/models/Chat';

export default async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await connectToDatabase();

    const { id } = req.query;
    const { name, pinned } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Chat ID is required' });
    }

    // Find the chat and verify ownership
    const chat = await Chat.findOne({ 
      _id: id, 
      userEmail: session.user.email 
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Prepare update object
    const updateData = {};
    
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Chat name cannot be empty' });
      }
      if (name.trim().length > 100) {
        return res.status(400).json({ error: 'Chat name is too long (max 100 characters)' });
      }
      updateData.name = name.trim();
    }

    if (pinned !== undefined) {
      updateData.pinned = Boolean(pinned);
    }

    // Update the chat
    const updatedChat = await Chat.findOneAndUpdate(
      { _id: id, userEmail: session.user.email },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedChat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    return res.status(200).json({ 
      success: true, 
      chat: {
        _id: updatedChat._id,
        name: updatedChat.name,
        pinned: updatedChat.pinned,
        lastMessageAt: updatedChat.lastMessageAt,
        createdAt: updatedChat.createdAt
      }
    });

  } catch (error) {
    console.error('Chat update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
