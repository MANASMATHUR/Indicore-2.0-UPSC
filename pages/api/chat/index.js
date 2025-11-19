import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import Chat from '@/models/Chat';
import User from '@/models/User';
import generateChatName from '@/lib/generateChatName';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  try {
    await connectToDatabase();

    if (req.method === 'GET') {
      const { archived, folder, tag } = req.query;
      
      const query = { 
        userEmail: session.user.email,
        isActive: true 
      };
      
      // Filter by archived status (default: show non-archived)
      if (archived === 'true') {
        query.archived = true;
      } else if (archived === 'false' || archived === undefined) {
        query.archived = { $ne: true };
      }
      
      // Filter by folder
      if (folder) {
        query.folder = folder;
      }
      
      // Filter by tag
      if (tag) {
        query.tags = tag;
      }
      
      const chats = await Chat.find(query)
      .sort({ pinned: -1, lastMessageAt: -1 })
      .select('_id name messages settings lastMessageAt createdAt pinned folder tags archived')
      .limit(50);

      return res.status(200).json({ chats });
    }

    if (req.method === 'POST') {
      const { chatId, message, settings, language = 'en' } = req.body;

      if (!chatId) {
        const chatCount = await Chat.countDocuments({ 
          userEmail: session.user.email,
          isActive: true 
        });

        // If a first message is provided, try generating a better name via Grok
        const fallbackName = `Chat ${chatCount + 1}`;
        const nameFromGrok = message ? await generateChatName(message, language) : null;
        const chatName = (nameFromGrok && nameFromGrok !== 'New Chat') ? nameFromGrok : fallbackName;

        const newChat = new Chat({
          userId: session.user.id,
          userEmail: session.user.email,
          name: chatName,
          messages: [],
          settings: settings || {
            language: 'en',
            model: 'sonar-pro',
            systemPrompt: 'You are a helpful Multilingual AI assistant. Your name is Indicore-Ai. Provide accurate, detailed, and well-structured responses.'
          },
          isActive: true,
          lastMessageAt: new Date()
        });

        // If there is an initial message, add it as the first user message
        if (message && String(message).trim().length > 0) {
          newChat.messages.push({
            sender: 'user',
            text: message,
            language,
            timestamp: new Date()
          });
        }

        await newChat.save();

        // Update user's question count if a message was included
        if (message && String(message).trim().length > 0) {
          await User.findOneAndUpdate(
            { email: session.user.email },
            { 
              $inc: { 
                'memory.totalQuestions': 1,
                'memory.sessionQuestions': 1 
              }
            },
            { upsert: true }
          );
        }

        return res.status(201).json({ chat: newChat });
      } else {
        const chat = await Chat.findOne({ _id: chatId, userEmail: session.user.email });
        if (!chat) return res.status(404).json({ error: 'Chat not found' });

        if (!message || String(message).trim().length === 0) {
          return res.status(400).json({ error: 'Message is required' });
        }

        // Add user message using the schema's text field
        const userMessage = {
          sender: 'user',
          text: message,
          language,
          timestamp: new Date()
        };
        chat.messages.push(userMessage);
        chat.lastMessageAt = new Date();

        // If this is effectively the first user message and the name is generic, try to rename via Grok
        const isGenericName = /^Chat\s+\d+$/i.test(chat.name || '');
        const isFirstMessage = (Array.isArray(chat.messages) ? chat.messages.length : 0) === 1;
        if (isGenericName && isFirstMessage) {
          try {
            const grokName = await generateChatName(message, language);
            if (grokName && grokName !== 'New Chat') {
              chat.name = grokName;
            }
          } catch (e) {
            // best-effort; fall back silently
          }
        }

        await chat.save();

        // Update user's question count
        await User.findOneAndUpdate(
          { email: session.user.email },
          { 
            $inc: { 
              'memory.totalQuestions': 1,
              'memory.sessionQuestions': 1 
            }
          },
          { upsert: true }
        );

        return res.status(200).json({ chat });
      }
    }
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

