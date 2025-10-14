const express = require('express');
const router = express.Router();
const { listChatsByEmail, getChatById } = require('../utils/store');

// Get all chats for a user
router.get('/', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email query parameter is required' });

    const chats = await listChatsByEmail(email);

    const enrichedChats = await Promise.all(
      chats.map(async (chat) => {
        const fullChat = await getChatById(chat._id);
        const lastMessage = fullChat?.messages?.slice(-1)[0] || null;

        return {
          ...('toObject' in chat ? chat.toObject() : chat),
          lastMessageRole: lastMessage?.role || null,       // role instead of sender
          lastMessageContent: lastMessage?.content || '',   // content instead of text
          lastMessageLanguage: lastMessage?.language || 'en'
        };
      })
    );

    res.json(enrichedChats);
  } catch (err) {
    console.error('List chats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
