import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { contextualLayer } from '@/lib/contextual-layer';
import examKnowledge from '@/lib/exam-knowledge';
import axios from 'axios';
import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';
import Chat from '@/models/Chat';
import User from '@/models/User';
import { Server } from 'socket.io';
import { cleanAIResponse, validateAndCleanResponse, isGarbledResponse } from '@/lib/responseCleaner';
import { extractUserInfo, updateUserProfile, formatProfileContext, detectSaveWorthyInfo, isSaveConfirmation } from '@/lib/userProfileExtractor';

let io = null;
const responseCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function calculateMaxTokens(message) {
  const messageLength = message.length;
  if (messageLength < 100) return 4000;
  if (messageLength < 500) return 10000;
  if (messageLength < 2000) return 16000;
  return 20000;
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
                // Get last 15 messages for better context (increased from 5)
                const recentMessages = chat.messages.slice(-15);
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

          // Add user profile context to system prompt
          const profileContext = userProfile ? formatProfileContext(userProfile) : '';
          if (profileContext) {
            finalSystemPrompt += `\n\nUSER CONTEXT (Remember this across all conversations):\n${profileContext}\n\nIMPORTANT: Use this user context to provide personalized responses. If the user asks about "my exam" or "prep me for exam", refer to their specific exam details from the context above. Ask follow-up questions if needed to clarify which exam they're referring to (e.g., "Are you referring to your ${userProfile.targetExam || 'exam'}?" or reference specific facts from their profile). Always remember user-specific information like exam names, subjects, dates, and preferences mentioned in previous conversations.`;
          }

          // Add instruction for memory saving prompts
          if (saveWorthyInfo && !isSaveConfirmation(message)) {
            finalSystemPrompt += `\n\nMEMORY SAVING INSTRUCTION:\nThe user just mentioned: "${saveWorthyInfo.value}". This seems like important information that should be remembered. At the END of your response, add a friendly follow-up question asking if they want to save this to memory. Use this exact format: "[Your main response]\n\n💾 I noticed you mentioned "${saveWorthyInfo.value}". Would you like me to save this to your memory so I can remember it in future conversations?"`;
          }
          
          // If user confirmed saving, add instruction to acknowledge and save
          if (isSaveConfirmation(message)) {
            finalSystemPrompt += `\n\nMEMORY SAVING CONFIRMATION:\nThe user just confirmed they want to save information to memory. Acknowledge this at the start of your response with something like "Got it! I've saved that to your memory." Then proceed with your normal response.`;
          }

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

          let enhancedSystemPrompt = finalSystemPrompt + contextualEnhancement + examContext;
          
          // Truncate system prompt if too long (Perplexity has limits)
          const maxSystemLength = 2000;
          if (enhancedSystemPrompt.length > maxSystemLength) {
            enhancedSystemPrompt = enhancedSystemPrompt.substring(0, maxSystemLength - 100) + '...';
          }

          // Ensure proper message array structure
          const messagesForAPI = [];
          if (enhancedSystemPrompt && enhancedSystemPrompt.trim().length > 0) {
            messagesForAPI.push({ role: 'system', content: enhancedSystemPrompt });
          }
          
          // Add history if available
          if (conversationHistory && conversationHistory.length > 0) {
            messagesForAPI.push(...conversationHistory);
          }
          
          // Always add user message (ensure it's not empty)
          if (!message || message.trim().length === 0) {
            ws.send(JSON.stringify({ type: 'error', message: 'Message cannot be empty' }));
            return;
          }
          
          messagesForAPI.push({ role: 'user', content: message.trim() });

          // Final validation: ensure we have at least one user message
          if (messagesForAPI.filter(m => m.role === 'user').length === 0) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
            return;
          }

          const selectedModel = model || 'sonar-pro';
          let response;
          try {
            response = await axios.post('https://api.perplexity.ai/chat/completions', {
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
          } catch (apiError) {
            let errorMessage = 'API request failed. Please try again.';
            
            if (apiError.response?.status === 400) {
              let errorText = '';
              
              try {
                if (apiError.response?.data) {
                  if (typeof apiError.response.data === 'string') {
                    errorText = apiError.response.data;
                  } else if (apiError.response.data.error?.message) {
                    errorText = apiError.response.data.error.message;
                  } else if (apiError.response.data.message) {
                    errorText = apiError.response.data.message;
                  } else if (Buffer.isBuffer(apiError.response.data)) {
                    try {
                      const parsed = JSON.parse(apiError.response.data.toString());
                      errorText = parsed.error?.message || parsed.message || '';
                    } catch (e) {
                      errorText = apiError.response.data.toString().substring(0, 200);
                    }
                  }
                }
              } catch (e) {
                errorText = apiError.message || '';
              }
              
              console.error('Perplexity API 400 error (WS):', errorText || apiError.message);
              
              if (errorText && (errorText.includes('system message') || errorText.includes('messages array'))) {
                errorMessage = 'Request format error. The system prompt may be too long. Please try a shorter question.';
              } else if (errorText && errorText.includes('user message')) {
                errorMessage = 'Invalid request format. Please try again.';
              }
            } else {
              console.error('Perplexity API error (WS):', apiError.response?.status, apiError.message);
            }
            
            ws.send(JSON.stringify({ type: 'error', message: errorMessage }));
            return;
          }

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

          response.data.on('end', async () => {
            // If user confirmed saving, save the information to profile
            if (isSaveConfirmation(message) && chatId) {
              try {
                await connectToDatabase();
                const chat = await Chat.findOne({ 
                  _id: chatId, 
                  userEmail: session.user.email 
                }).lean();
                
                if (chat && chat.messages && chat.messages.length > 1) {
                  // Get last assistant message to find what was suggested to save
                  const lastAssistantMsg = [...chat.messages].reverse().find(msg => msg.sender === 'assistant');
                  if (lastAssistantMsg && lastAssistantMsg.text) {
                    // Try to extract the fact from the assistant's previous message
                    const saveMatch = lastAssistantMsg.text.match(/mentioned[^"]*"([^"]+)"/i);
                    if (saveMatch && saveMatch[1]) {
                      const factToSave = saveMatch[1].trim();
                      const userDoc = await User.findOne({ email: session.user.email });
                      if (userDoc) {
                        if (!userDoc.profile) userDoc.profile = {};
                        if (!userDoc.profile.facts) userDoc.profile.facts = [];
                        
                        const normalizedFact = factToSave.toLowerCase().trim();
                        const exists = userDoc.profile.facts.some(f => {
                          if (!f || typeof f !== 'string') return false;
                          return f.toLowerCase().trim() === normalizedFact;
                        });
                        
                        if (!exists) {
                          userDoc.profile.facts.push(factToSave);
                          if (userDoc.profile.facts.length > 20) {
                            userDoc.profile.facts = userDoc.profile.facts.slice(-20);
                          }
                          userDoc.profile.lastUpdated = new Date();
                          await userDoc.save();
                        }
                      }
                    }
                  }
                }
              } catch (err) {
                console.warn('Failed to save to user memory:', err.message);
              }
            }
            
            // Emit save prompt info if available
            if (saveWorthyInfo && !isSaveConfirmation(message)) {
              socket.emit('chat:save-prompt', {
                description: saveWorthyInfo.description,
                type: saveWorthyInfo.type,
                value: saveWorthyInfo.value
              });
            }
            
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


