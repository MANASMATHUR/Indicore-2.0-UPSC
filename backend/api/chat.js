const express = require('express');
const router = express.Router();
const { 
  createChatForEmail, 
  getChatById, 
  addMessageToChat, 
  listChatsByEmail 
} = require('../utils/store');
const generateChatName = require('../utils/generateChatName');
const { generateAIResponse } = require('../utils/ai'); 

// ✅ Create a new chat
router.post('/', async (req, res) => {
  try {
    const { email, text = '', language = 'en' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required to create a new chat' });

    // Generate chat name (fallback to "New Chat")
    const chatName = await generateChatName(text.trim() || 'New Chat', language);
    const newChat = await createChatForEmail(email, chatName);

    // Add first user message if present
    if (text.trim()) {
      await addMessageToChat(newChat._id, {
        role: 'user',
        content: text,
        language,
        timestamp: new Date().toISOString()
      });
    }

    return res.json(newChat);
  } catch (err) {
    console.error('Create chat error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Send a message in an existing chat
router.post('/:id/messages', async (req, res) => {
  try {
    const { id: chatId } = req.params;
    const { content, language = 'en' } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: 'Message content is required' });

    // Add user message
    await addMessageToChat(chatId, {
      role: 'user',
      content,
      language,
      timestamp: new Date().toISOString()
    });

    // Generate AI response (safe fallback)
    let aiResponse;
    try {
      aiResponse = await generateAIResponse(content, language);
      if (!aiResponse || !aiResponse.trim()) {
        aiResponse = "I'm here, but I couldn’t generate a proper response. Can you rephrase?";
      }
    } catch (err) {
      console.error("AI generation error:", err);
      aiResponse = "⚠️ Sorry, something went wrong with my response. Please try again.";
    }

    // Add AI message
    await addMessageToChat(chatId, {
      role: 'assistant',
      content: aiResponse,
      language,
      timestamp: new Date().toISOString()
    });

    // Return updated chat
    const updatedChat = await getChatById(chatId);
    return res.json(updatedChat);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Get all chats for a user (with last message preview)
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
          lastMessageRole: lastMessage?.role || null,
          lastMessageContent: lastMessage?.content || '',
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

//  Get single chat by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const chat = await getChatById(id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (err) {
    console.error('Chat GET error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
