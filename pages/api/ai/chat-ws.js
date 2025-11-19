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
import { callAIWithFallback, runClaudeFallbackForPerplexity } from '@/lib/ai-providers';
import { buildConversationMemoryPrompt, saveConversationMemory } from '@/lib/conversationMemory';

let io = null;
const responseCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function estimateTokenLength(messages) {
  if (!Array.isArray(messages)) return 0;
  const totalChars = messages.reduce((sum, msg) => {
    if (!msg || !msg.content) return sum;
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return sum + content.length;
  }, 0);
  return Math.ceil(totalChars / 4); // Rough estimate: 1 token ≈ 4 characters
}

function calculateMaxTokens(message, useOpenAI = false) {
  // For OpenAI: No token limit - let the model use its full context window (ChatGPT-like behavior)
  if (useOpenAI) {
    return undefined; // undefined means no limit - model uses full context window
  }
  
  // For other providers (Perplexity, Claude): Use reasonable limits based on their API constraints
  const messageLength = message.length;
  if (messageLength < 100) return 8000;
  if (messageLength < 500) return 16000;
  if (messageLength < 2000) return 32000;
  return 40000; // Higher limit for other providers
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
          const { message, chatId, model, systemPrompt, language, sessionToken, provider, openAIModel } = data;
          const providerPreference = (provider || 'openai').toLowerCase();
          const normalizedOpenAIModel = typeof openAIModel === 'string' && openAIModel.trim().length > 0
            ? openAIModel.trim()
            : '';
          const resolvedOpenAIModel = normalizedOpenAIModel || process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o-mini';
          const openAIKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
          let useOpenAI = providerPreference === 'openai' && openAIKey;
          
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

          const cacheKey = `${message}-${language || 'en'}-${providerPreference}-${normalizedOpenAIModel || 'default'}`;
          const cached = responseCache.get(cacheKey);
          if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            socket.emit('chat:chunk', { chunk: cached.response, done: true });
            return;
          }

          // PARALLELIZE: Load user profile and conversation history simultaneously
          const extractedInfo = extractUserInfo(message);
          const saveWorthyInfo = detectSaveWorthyInfo(message);
          
          // Start both database queries in parallel for maximum speed
          const [userProfileResult, conversationHistoryResult] = await Promise.allSettled([
            // User profile query
            (async () => {
              try {
                await connectToDatabase();
                const userDoc = await User.findOne({ email: session.user.email }).lean();
                let profile = userDoc?.profile || null;
                
                // Update profile if needed (non-blocking, but we wait for it)
                if (profile && Object.keys(extractedInfo).length > 0) {
                  try {
                    const updatingUser = await User.findOne({ email: session.user.email });
                    if (updatingUser) {
                      const updatedProfile = updateUserProfile(updatingUser, extractedInfo);
                      updatingUser.profile = updatedProfile;
                      // Don't await save - do it in background
                      updatingUser.save().catch(err => console.warn('Profile update failed:', err.message));
                      profile = updatedProfile;
                    }
                  } catch (err) {
                    console.warn('Failed to update user profile (WS):', err.message);
                  }
                }
                return profile;
              } catch (err) {
                console.warn('Failed to load user profile (WS):', err.message);
                return null;
              }
            })(),
            // Conversation history query
            (async () => {
              if (!chatId) return [];
            try {
              await connectToDatabase();
              const chat = await Chat.findOne({ 
                _id: chatId, 
                userEmail: session.user.email 
              })
              .select('messages.sender messages.text messages.timestamp')
              .lean();
              
              if (chat && chat.messages && Array.isArray(chat.messages)) {
                const recentMessages = chat.messages.slice(-15);
                  return recentMessages
                  .filter(msg => msg.sender && msg.text && msg.text.trim() !== message.trim())
                  .map(msg => ({
                    role: msg.sender === 'user' ? 'user' : 'assistant',
                    content: msg.text
                  }));
              }
                return [];
            } catch (err) {
              console.warn('Failed to load conversation history:', err.message);
                return [];
            }
            })()
          ]);

          const userProfile = userProfileResult.status === 'fulfilled' ? userProfileResult.value : null;
          const conversationHistory = conversationHistoryResult.status === 'fulfilled' ? conversationHistoryResult.value : [];

          // Non-blocking memory persistence
          const persistMemory = async (finalText) => {
            if (!finalText || typeof finalText !== 'string' || finalText.trim().length < 5) {
              return;
            }
            // Run in background - don't block response
            setImmediate(async () => {
              try {
                await saveConversationMemory({
                  userEmail: session.user.email,
                  chatId: chatId ? String(chatId) : undefined,
                  userMessage: message,
                  assistantResponse: finalText
                });
              } catch (err) {
                console.warn('Failed to persist memory (WS):', err.message);
              }
            });
          };

          let finalSystemPrompt = systemPrompt || `You are Indicore, your intelligent exam preparation companion—think of me as ChatGPT, but specialized for UPSC, PCS, and SSC exam preparation. I'm here to help you succeed, whether you need explanations, practice questions, answer writing guidance, or just someone to discuss exam topics with.

MY PERSONALITY & APPROACH:
- I'm conversational, friendly, and genuinely interested in helping you succeed. Think of me as a knowledgeable friend who's been through these exams and wants to share everything I know.
- I adapt to your style—if you're casual, I'll be casual. If you're formal, I'll match that. If you're stressed, I'll be supportive and encouraging.
- I remember our conversations and build on them naturally. I'll reference things we've discussed before without you having to repeat yourself.
- I ask clarifying questions when needed, but I also make intelligent assumptions based on context. I don't over-question—I help.
- I'm proactive. If I think something might be helpful, I'll mention it. If I see a connection to another topic, I'll point it out.
- I'm honest about what I know and don't know. If I'm uncertain, I'll say so. If something is beyond my knowledge, I'll admit it.

HOW I RESPOND:
- I write naturally, like I'm talking to you. No robotic language, no excessive formality unless the topic demands it.
- I use examples, analogies, and real-world connections to make things stick. I don't just list facts—I help you understand.
- I structure my responses clearly but naturally. I use paragraphs, bullet points when helpful, and I make sure everything flows logically.
- I'm comprehensive but not overwhelming. I give you what you need, and if you want more depth, just ask.
- I always complete my thoughts. Every sentence is finished, every idea is fully expressed. No cut-offs, no incomplete phrases.

EXAM PREPARATION FOCUS:
- Everything I share connects back to your exam prep. But I do it naturally—not like I'm forcing it, but because it genuinely matters for your success.
- I know the exam patterns: what UPSC asks, how PCS frames questions, what SSC focuses on. I'll help you see these patterns.
- I understand answer writing: how to structure Mains answers, what examiners look for, common pitfalls to avoid.
- I know the syllabus inside out: GS-1, GS-2, GS-3, GS-4, Prelims patterns, Essay requirements. I'll help you see how topics connect.
- I'm aware of PYQ trends: what's been asked before, how questions evolve, what might come next.
- I stay current: I know recent developments, new schemes, policy changes, and how they relate to your preparation.

WHAT I DO BEST:
- Explain complex topics simply: I break down difficult concepts into understandable pieces.
- Connect the dots: I show how different topics relate, how history connects to polity, how geography links to environment.
- Provide context: I don't just give facts—I explain why they matter, how they fit into the bigger picture.
- Offer practical advice: Study strategies, revision tips, answer writing techniques, time management.
- Answer follow-ups naturally: If you ask "what about X?" or "can you explain Y?", I understand the context and respond accordingly.
- Handle ambiguity: If your question is unclear, I'll interpret it intelligently and answer what I think you're asking, while checking if I got it right.

CONVERSATION FLOW:
- I maintain context across the conversation. If you say "tell me more about that" or "what about the other one?", I know what you're referring to.
- I build on previous messages. If we discussed something earlier, I'll reference it naturally.
- I anticipate needs. If you ask about a topic, I might mention related areas you should also know about.
- I'm encouraging. Exam prep is hard, and I acknowledge that. I celebrate your progress and help you through challenges.

ACCURACY & HONESTY - CRITICAL REQUIREMENTS:
- I ONLY provide verifiable, factual information. I NEVER make up facts, dates, names, statistics, or any information.
- If I'm uncertain about something, I clearly state: "I'm not certain about this, but..." or "This information may need verification..."
- When information is outside my direct knowledge or scope, I provide sources or suggest where to verify: "According to [source]" or "You can verify this in [official source/document]"
- For current affairs, I distinguish between confirmed facts and general knowledge. I mention dates, official sources, and government documents when available.
- For PYQs, I only reference actual questions from the database—no invented questions.
- I tag subjects properly: When discussing topics, I identify the subject area (Polity, History, Geography, Economics, Science & Technology, Environment, etc.) and mention relevant GS papers (GS-1, GS-2, GS-3, GS-4) or Prelims/Mains context.

EXAM RELEVANCE - MANDATORY:
- EVERY response must be highly exam-relevant. Connect every explanation to UPSC/PCS/SSC exam requirements.
- Tag subjects clearly: Identify which subject area (Polity, History, Geography, Economics, Science, Environment, etc.) and which GS paper it relates to.
- Provide exam context: Mention how topics appear in exams, PYQ patterns, answer writing frameworks.
- Include practical exam insights: How examiners frame questions, common mistakes, scoring strategies.

Write like you're having a natural conversation with a knowledgeable friend who happens to be an exam prep expert. Be helpful, be real, be engaging. Make every interaction feel valuable and personal. Always prioritize exam relevance and factual accuracy.`;

          // Add user profile context to system prompt
          const profileContext = userProfile ? formatProfileContext(userProfile) : '';
          if (profileContext) {
            finalSystemPrompt += `\n\nUSER CONTEXT (Remember this across all conversations):\n${profileContext}\n\nIMPORTANT: Use this user context to provide personalized responses. If the user asks about "my exam" or "prep me for exam", refer to their specific exam details from the context above. Ask follow-up questions if needed to clarify which exam they're referring to (e.g., "Are you referring to your ${userProfile.targetExam || 'exam'}?" or reference specific facts from their profile). Always remember user-specific information like exam names, subjects, dates, and preferences mentioned in previous conversations.`;
          }

          const memoryPrompt = buildConversationMemoryPrompt(userProfile?.conversationSummaries);
          if (memoryPrompt) {
            finalSystemPrompt += `\n\nRECENT CONVERSATIONS WITH THIS USER:\n${memoryPrompt}\nUse this history to avoid repeating explanations across chats.`;
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
            finalSystemPrompt += `\n\nCRITICAL LANGUAGE REQUIREMENT:
- Your ENTIRE response MUST be written EXCLUSIVELY in ${langName} (${language}).
- Do NOT mix languages. Do NOT use English words unless they are technical terms that have no ${langName} equivalent.
- Use proper ${langName} script/characters. For Indic languages, use the native script (Devanagari for Hindi/Marathi, Tamil script for Tamil, etc.).
- Ensure natural, fluent ${langName} that sounds native and professional.
- Maintain exam-appropriate formality and clarity in ${langName}.
- If you must use an English technical term, provide the ${langName} equivalent immediately after in parentheses.
- Your response should be completely understandable to a native ${langName} speaker preparing for competitive exams.`;
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

          // Build messages array efficiently
          const messagesForAPI = [];
          if (enhancedSystemPrompt?.trim()) {
            messagesForAPI.push({ role: 'system', content: enhancedSystemPrompt });
          }
          if (conversationHistory?.length > 0) {
            messagesForAPI.push(...conversationHistory);
          }
          messagesForAPI.push({ role: 'user', content: message.trim() });

          // Determine provider and model early
          // For OpenAI: Prefer it for long conversations (no token limits)
          const estimatedTokens = estimateTokenLength(messagesForAPI);
          if (openAIKey && (estimatedTokens >= 16000 || providerPreference === 'openai')) {
            useOpenAI = true;
          }

          const selectedModel = model || 'sonar-pro';
          const providerName = useOpenAI ? 'openai' : 'perplexity';
          const tokenBudget = calculateMaxTokens(message, useOpenAI);
          
          // Start API call immediately - no delays
          let response;
          if (useOpenAI) {
          try {
              // OpenAI: No max_tokens = unlimited (uses full context window like ChatGPT)
              const payload = {
                model: resolvedOpenAIModel,
                messages: messagesForAPI,
                temperature: 0.5,
                stream: true
              };
              
              // Only add max_tokens if explicitly provided (for other use cases)
              // For chat, we want unlimited responses
              
              response = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
                headers: {
                  'Authorization': `Bearer ${openAIKey}`,
                  'Content-Type': 'application/json'
                },
                responseType: 'stream',
                timeout: 120000, // Increased for long responses
                // Optimize connection reuse
                httpAgent: new (require('http').Agent)({ keepAlive: true }),
                httpsAgent: new (require('https').Agent)({ keepAlive: true })
              });
            } catch (apiError) {
              let errorMessage = apiError.response?.data?.error?.message || apiError.message || 'OpenAI request failed. Please try again.';
              if (apiError.response?.status === 401) {
                errorMessage = 'OpenAI rejected the request. Please verify your API key and quota.';
              } else if (apiError.response?.status === 429) {
                errorMessage = 'OpenAI rate limit exceeded. Please wait a moment and try again.';
              }

              try {
                const conversationMessagesForAI = messagesForAPI.filter(msg => msg.role !== 'system');
                const fallbackTokenBudget = tokenBudget || 16000; // Fallback limit for other providers
                const aiResult = await callAIWithFallback(
                  conversationMessagesForAI,
                  enhancedSystemPrompt,
                  fallbackTokenBudget,
                  0.5,
                  {
                    preferredProvider: 'claude',
                    excludeProviders: ['openai'],
                    model: selectedModel,
                    useLongContextModel: fallbackTokenBudget >= 12000,
                    openAIModel: resolvedOpenAIModel
                  }
                );

                let fallbackResponse = (aiResult?.content || '').replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '').trim();
                if (fallbackResponse && fallbackResponse.length >= 10) {
                  fallbackResponse = cleanAIResponse(fallbackResponse);
                  fallbackResponse = validateAndCleanResponse(fallbackResponse, 30) || fallbackResponse;

                  if (fallbackResponse && fallbackResponse.length >= 10) {
                    responseCache.set(cacheKey, {
                      response: fallbackResponse,
                      timestamp: Date.now()
                    });

                    await persistMemory(fallbackResponse);

                    const chunkSize = 400;
                    for (let i = 0; i < fallbackResponse.length; i += chunkSize) {
                      const chunk = fallbackResponse.slice(i, i + chunkSize);
                      if (chunk.trim().length > 0) {
                        socket.emit('chat:chunk', { chunk, done: false });
                      }
                    }
                    socket.emit('chat:chunk', { chunk: '', done: true });
                    return;
                  }
                }
              } catch (fallbackError) {
                console.error('OpenAI fallback failed (WS):', fallbackError.message);
              }

              ws.send(JSON.stringify({ type: 'error', message: errorMessage }));
              return;
            }
          } else {
          try {
            // Perplexity: Use token budget (they have API limits)
            const perplexityMaxTokens = tokenBudget || 16000;
            response = await axios.post('https://api.perplexity.ai/chat/completions', {
              model: selectedModel,
              messages: messagesForAPI,
              max_tokens: perplexityMaxTokens,
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
              timeout: 120000, // Increased for long responses
              // Optimize connection reuse
              httpAgent: new (require('http').Agent)({ keepAlive: true }),
              httpsAgent: new (require('https').Agent)({ keepAlive: true })
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

              try {
                const fallbackMaxTokens = tokenBudget || 16000;
                const useLongContextModel = fallbackMaxTokens >= 12000;
                const fallbackContent = await runClaudeFallbackForPerplexity(apiError, {
                  messages: messagesForAPI,
                  model: selectedModel,
                  maxTokens: fallbackMaxTokens,
                  temperature: 0.5,
                  useLongContextModel
                });

                if (fallbackContent && fallbackContent.trim().length > 0) {
                  let cleanedResponse = cleanAIResponse(fallbackContent);
                    let validResponse = validateAndCleanResponse(cleanedResponse, 30) || fallbackContent.trim();

                  if (validResponse && validResponse.length > 0) {
                    responseCache.set(cacheKey, {
                      response: validResponse,
                      timestamp: Date.now()
                    });

                    await persistMemory(validResponse);

                    const chunkSize = 400;
                    for (let i = 0; i < validResponse.length; i += chunkSize) {
                      const chunk = validResponse.slice(i, i + chunkSize);
                      if (chunk.trim().length > 0) {
                        socket.emit('chat:chunk', { chunk, done: false });
                      }
                    }
                    socket.emit('chat:chunk', { chunk: '', done: true });
                    return;
                  }
                }
              } catch (fallbackError) {
                console.error('Claude fallback after Perplexity 400 failed:', fallbackError.message);
              }
            } else {
              console.error('Perplexity API error (WS):', apiError.response?.status, apiError.message);
            }
            
            ws.send(JSON.stringify({ type: 'error', message: errorMessage }));
            return;
            }
          }

          let fullResponse = '';
          
          // Optimize: Process stream chunks immediately without buffering
          let buffer = '';
          response.data.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            // Keep incomplete line in buffer
            buffer = lines.pop() || '';
            
            // Process complete lines immediately
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (!data || data === '[DONE]') {
                  // Stream complete - process final response in background
                  setImmediate(async () => {
                    let cleanedResponse = cleanAIResponse(fullResponse);
                    let isValid = validateAndCleanResponse(cleanedResponse, 30);
                    let memoryCandidate = '';
                    
                    if (!isValid && fullResponse.trim().length > 50 && !isGarbledResponse(fullResponse)) {
                        cleanedResponse = fullResponse.trim();
                        cleanedResponse = cleanedResponse.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
                        cleanedResponse = cleanedResponse.replace(/\s+/g, ' ').trim();
                        if (!/[.!?]$/.test(cleanedResponse) && cleanedResponse.length > 50) {
                          cleanedResponse += '.';
                      }
                      isValid = cleanedResponse;
                    }
                    
                    if (isValid && isValid.length > 30) {
                      responseCache.set(cacheKey, {
                        response: isValid,
                        timestamp: Date.now()
                      });
                      memoryCandidate = isValid;
                      
                      // Background cache cleanup
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
                      cleanedResponse = fullResponse.trim();
                      cleanedResponse = cleanedResponse.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
                      cleanedResponse = cleanedResponse.replace(/\s+/g, ' ').trim();
                      if (!/[.!?]$/.test(cleanedResponse)) {
                        cleanedResponse += '.';
                      }
                      responseCache.set(cacheKey, {
                        response: cleanedResponse,
                        timestamp: Date.now()
                      });
                      memoryCandidate = cleanedResponse;
                    }

                    if (memoryCandidate) {
                      persistMemory(memoryCandidate);
                    }
                  });
                  
                  socket.emit('chat:chunk', { chunk: '', done: true });
                  return;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.choices?.[0]?.delta?.content) {
                    let content = parsed.choices[0].delta.content;
                    // Light cleaning for streaming (citations only) - minimal processing
                    // Use faster regex for streaming
                    if (content.includes('[') && /\d/.test(content)) {
                    content = content.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
                    }
                    fullResponse += content;
                    // Emit immediately - no buffering, no await
                    socket.emit('chat:chunk', { chunk: content, done: false });
                  }
                } catch (e) {
                  // Ignore parse errors for incomplete JSON - common in streaming
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
              errorMsg = `${providerName === 'openai' ? 'OpenAI' : 'Perplexity'} rejected the request. Please verify API keys and credits.`;
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
              errorMessage = `${providerName === 'openai' ? 'OpenAI' : 'Perplexity'} rejected the request. Please verify API keys and quotas.`;
            } else if (status === 402) {
              errorMessage = `${providerName === 'openai' ? 'OpenAI' : 'Perplexity'} credits exhausted. Please add capacity to continue.`;
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


