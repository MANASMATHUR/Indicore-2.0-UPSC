import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { contextualLayer } from '@/lib/contextual-layer';
import examKnowledge from '@/lib/exam-knowledge';
import axios from 'axios';
import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';
import Chat from '@/models/Chat';
import { Server } from 'socket.io';
import { cleanAIResponse, validateAndCleanResponse, isGarbledResponse } from '@/lib/responseCleaner';

let io = null;
const responseCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function calculateMaxTokens(message) {
  const messageLength = message.length;
  if (messageLength < 100) return 4000;
  if (messageLength < 500) return 8000;
  if (messageLength < 2000) return 12000;
  return 16000;
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const httpServer = res.socket?.server;
  if (!httpServer) {
    return res.status(500).json({ error: 'WebSocket server not available' });
  }

  if (!io) {
    io = new Server(httpServer, {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      cors: {
        origin: process.env.NEXT_PUBLIC_URL || '*',
        methods: ['GET', 'POST']
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    io.on('connection', async (socket) => {
      socket.on('chat:message', async (data) => {
        try {
          const { message, chatId, model, systemPrompt, language, sessionToken } = data;
          
          if (!message) {
            socket.emit('chat:error', { error: 'Message is required' });
            return;
          }

          const session = await getServerSession(
            { req: { headers: { cookie: `next-auth.session-token=${sessionToken}` } } },
            res,
            authOptions
          );

          if (!session) {
            socket.emit('chat:error', { error: 'Unauthorized' });
            return;
          }

          const cacheKey = `${message}-${language || 'en'}`;
          const cached = responseCache.get(cacheKey);
          if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            socket.emit('chat:chunk', { chunk: cached.response, done: true });
            return;
          }

          // Optimize: Load conversation history efficiently with lean() and field selection
          let conversationHistory = [];
          if (chatId) {
            try {
              await connectToDatabase();
              // Use lean() for faster queries, limit fields, and use indexes
              const chat = await Chat.findOne({ 
                _id: chatId, 
                userEmail: session.user.email 
              })
              .select('messages.sender messages.text messages.timestamp')
              .lean();
              
              if (chat && chat.messages && Array.isArray(chat.messages)) {
                // Filter and map more efficiently - only get last 5 messages
                const recentMessages = chat.messages.slice(-5);
                conversationHistory = recentMessages
                  .filter(msg => msg.sender && msg.text && msg.text.trim() !== message.trim())
                  .map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.text
                  }));
              }
            } catch (err) {
              // Continue without history if DB query fails - don't block the request
              console.warn('Failed to load conversation history:', err.message);
            }
          }

          let finalSystemPrompt = systemPrompt || `You are Indicore, an exam preparation assistant for UPSC, PCS, and SSC exams. 

CRITICAL REQUIREMENTS:
1. ALWAYS write complete, comprehensive answers. Never leave sentences incomplete or cut off mid-thought.
2. Write in full, well-formed sentences. Each sentence must have a subject, verb, and complete meaning.
3. Provide thorough, detailed responses that fully address the question asked.
4. Use proper paragraph structure with clear topic sentences and supporting details.
5. Ensure your response has a logical flow: introduction, main content, and conclusion where appropriate.
6. Use bullet points only when listing multiple items. Otherwise, write in paragraph form.
7. Avoid markdown headers (###) or excessive bold text. Keep formatting simple and natural.
8. Never use placeholders, incomplete phrases, or cut-off words.
9. If discussing historical topics, provide complete information including time periods, locations, characteristics, and significance.
10. Always finish your response with a complete sentence. Never end with incomplete thoughts.

ACCURACY AND FACTUAL REQUIREMENTS:
- ONLY provide information you are certain about. If you are unsure about a fact, date, or detail, clearly state that you are uncertain.
- Do NOT make up facts, dates, names, or statistics. If you don't know something, say so rather than guessing.
- When discussing exam-related topics, be precise and accurate. Do not provide incorrect information.
- If asked about specific exam questions, papers, or dates, only provide information if you are confident it is correct.
- Never fabricate or hallucinate information. It is better to admit uncertainty than to provide incorrect information.
- When discussing current affairs, clearly distinguish between confirmed facts and general knowledge.
- For PYQ (Previous Year Questions), only reference actual questions from the database. Do not create or invent questions.

Write naturally and conversationally, but ensure every response is complete, accurate, and truthful. Do not include citations or reference numbers.`;

          // Detect translation requests
          const translationMatch = message.match(/translate\s+(?:this|that|the\s+following|text)?\s*(?:to|in|into)\s+(hindi|marathi|tamil|bengali|punjabi|gujarati|telugu|malayalam|kannada|spanish|english)/i);
          if (translationMatch) {
            const targetLang = translationMatch[1].toLowerCase();
            const languageMap = {
              'hindi': 'hi', 'marathi': 'mr', 'tamil': 'ta', 'bengali': 'bn',
              'punjabi': 'pa', 'gujarati': 'gu', 'telugu': 'te', 'malayalam': 'ml',
              'kannada': 'kn', 'spanish': 'es', 'english': 'en'
            };
            const targetLangCode = languageMap[targetLang] || 'hi';
            
            // Extract text to translate
            let textToTranslate = message;
            const colonMatch = message.match(/translate[^:]*:\s*(.+)/i);
            if (colonMatch) {
              textToTranslate = colonMatch[1].trim();
            } else {
              textToTranslate = message.replace(/translate\s+(?:this|that|the\s+following|text)?\s*(?:to|in|into)\s+\w+/i, '').trim();
            }
            
            if (textToTranslate && textToTranslate.length > 0) {
              try {
                const translateModule = await import('@/pages/api/ai/translate');
                const translated = await translateModule.translateText(textToTranslate, 'auto', targetLangCode, true);
                
                if (translated && translated.trim() && translated.trim() !== textToTranslate.trim()) {
                  socket.emit('chat:response', {
                    success: true,
                    response: translated,
                    complete: true
                  });
                  return;
                }
              } catch (translationError) {
                console.warn('Translation failed, falling back to regular response:', translationError.message);
                // Fall through to regular chat handling
              }
            }
          }

          if (language && language !== 'en') {
            const languageNames = {
              hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', bn: 'Bengali',
              pa: 'Punjabi', gu: 'Gujarati', te: 'Telugu', ml: 'Malayalam',
              kn: 'Kannada', es: 'Spanish'
            };
            const langName = languageNames[language] || 'English';
            finalSystemPrompt += ` Your response MUST be entirely in ${langName}. Do not use any other language. Ensure perfect grammar and natural flow in ${langName}.`;
          }

          const needsContext = message.length > 20 && !/(pyq|previous year)/i.test(message);
          const contextualEnhancement = needsContext ? contextualLayer.generateContextualPrompt(message) : '';
          const examContext = needsContext ? examKnowledge.generateContextualPrompt(message) : '';

          const enhancedSystemPrompt = finalSystemPrompt + contextualEnhancement + examContext;

          const messagesForAPI = [
            { role: 'system', content: enhancedSystemPrompt },
            ...conversationHistory,
            { role: 'user', content: message }
          ];

          const selectedModel = model || 'sonar-pro';
          const response = await axios.post('https://api.perplexity.ai/chat/completions', {
            model: selectedModel,
            messages: messagesForAPI,
            max_tokens: calculateMaxTokens(message),
            temperature: 0.5,
            top_p: 0.9,
            stream: true
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream'
            },
            responseType: 'stream',
            timeout: 90000
          });

          let fullResponse = '';
          
          response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  // Clean and validate response asynchronously (don't block stream completion)
                  setImmediate(() => {
                    let cleanedResponse = cleanAIResponse(fullResponse);
                    let isValid = validateAndCleanResponse(cleanedResponse, 30);
                    
                    // If cleaning made response invalid, check original
                    if (!isValid && fullResponse.trim().length > 50) {
                      // Check if original is garbled
                      if (!isGarbledResponse(fullResponse)) {
                        // Try cleaning again with less strict rules
                        cleanedResponse = fullResponse.trim();
                        // Remove only obvious issues
                        cleanedResponse = cleanedResponse.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
                        cleanedResponse = cleanedResponse.replace(/\s+/g, ' ').trim();
                        
                        // Ensure it ends properly
                        if (!/[.!?]$/.test(cleanedResponse) && cleanedResponse.length > 50) {
                          cleanedResponse += '.';
                        }
                        
                        isValid = cleanedResponse;
                      }
                    }
                    
                    if (isValid && isValid.length > 30) {
                      responseCache.set(cacheKey, {
                        response: isValid,
                        timestamp: Date.now()
                      });
                      
                      // Cleanup old cache entries asynchronously
                      if (responseCache.size > 500) {
                        setImmediate(() => {
                          const now = Date.now();
                          for (const [key, value] of responseCache.entries()) {
                            if (now - value.timestamp > CACHE_TTL) {
                              responseCache.delete(key);
                            }
                          }
                        });
                      }
                    } else if (fullResponse.trim().length > 50 && !isGarbledResponse(fullResponse)) {
                      // Fallback: use original if it's not garbled and substantial
                      cleanedResponse = fullResponse.trim();
                      // Minimal cleaning
                      cleanedResponse = cleanedResponse.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
                      cleanedResponse = cleanedResponse.replace(/\s+/g, ' ').trim();
                      if (!/[.!?]$/.test(cleanedResponse)) {
                        cleanedResponse += '.';
                      }
                      responseCache.set(cacheKey, {
                        response: cleanedResponse,
                        timestamp: Date.now()
                      });
                    }
                  });
                  
                  socket.emit('chat:chunk', { chunk: '', done: true });
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                    let content = parsed.choices[0].delta.content;
                    // Light cleaning for streaming (citations only)
                    content = content.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
                    fullResponse += content;
                    socket.emit('chat:chunk', { chunk: content, done: false });
                  }
                } catch (e) {
                }
              }
            }
          });

          response.data.on('end', () => {
            socket.emit('chat:chunk', { chunk: '', done: true });
          });

          response.data.on('error', (streamError) => {
            let errorMsg = 'Streaming error occurred';
            if (streamError.response?.status === 401 || streamError.response?.status === 402) {
              errorMsg = 'API credits exhausted or invalid API key. Please check your Perplexity API key and add credits if needed.';
            }
            socket.emit('chat:error', { 
              error: errorMsg,
              code: streamError.response?.status === 401 || streamError.response?.status === 402 ? 'API_CREDITS_EXHAUSTED' : 'STREAMING_ERROR'
            });
          });

        } catch (error) {
          let errorMessage = error.response?.data?.message || error.message || 'Internal server error';
          
          if (error.response) {
            const status = error.response.status;
            if (status === 401) {
              errorMessage = 'API credits exhausted or invalid API key. Please check your Perplexity API key and add credits if needed.';
            } else if (status === 402) {
              errorMessage = 'Insufficient API credits. Please add credits to your Perplexity account to continue using this feature.';
            } else if (status === 429) {
              errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
            } else if (status === 403) {
              errorMessage = 'Access denied. Please verify your API key permissions.';
            }
          }
          
          socket.emit('chat:error', { 
            error: errorMessage,
            code: error.response?.status === 401 || error.response?.status === 402 ? 'API_CREDITS_EXHAUSTED' : 'API_ERROR'
          });
        }
      });

      socket.on('disconnect', () => {
      });
    });
  }

  res.status(200).json({ status: 'WebSocket server initialized' });
}


