import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { contextualLayer } from '@/lib/contextual-layer';
import examKnowledge from '@/lib/exam-knowledge';
import { findPresetAnswer } from '@/lib/presetAnswers';
import axios from 'axios';
import connectToDatabase from '@/lib/mongodb';
import Chat from '@/models/Chat';
import pyqService from '@/lib/pyqService';

const responseCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

const UNSAFE_PATTERNS = [
  /leak|cheat|fraud|scam/i,
  /specific.*exam.*answer/i,
  /current.*year.*question/i,
  /confidential.*paper/i,
  /unauthorized.*material/i,
  /exam.*paper.*solution/i,
  /answer.*key.*leak/i
];

const PYQ_PATTERN = /(pyq|pyqs|previous year (?:question|questions|paper|papers)|past year (?:question|questions)|search.*pyq|find.*pyq)/i;

function calculateMaxTokens(message, queryType = 'general') {
  const msgLen = message.length;
  const wordCount = message.split(/\s+/).length;
  
  const isComplex = wordCount > 20 || /explain|describe|analyze|compare|discuss|elaborate/i.test(message);
  const isList = /list|enumerate|name|give.*examples/i.test(message);
  const isShort = /what is|who is|when|where|define/i.test(message);
  
  let base = 1500;
  
  if (isShort) {
    base = 800;
  } else if (isList) {
    base = 2000;
  } else if (isComplex) {
    base = 4000;
  } else {
    base = Math.min(2500, Math.max(1200, msgLen * 3));
  }
  
  if (queryType === 'pyq') {
    base = Math.max(base, 3000);
  }
  
  return Math.min(base, 8000);
}

function isResponseComplete(response) {
  const trimmed = response.trim();
  if (trimmed.length < 10) return false;
  
  const lastSent = trimmed.split(/[.!?]/).pop().trim();
  if (lastSent.length > 0 && lastSent.length < 5) return false;
  
  const incomplete = [
    /-\s*$/, /,\s*$/, /and\s*$/, /or\s*$/, /the\s*$/, /a\s*$/, /an\s*$/,
    /to\s*$/, /of\s*$/, /in\s*$/, /for\s*$/, /with\s*$/, /by\s*$/, /from\s*$/,
    /about\s*$/, /through\s*$/, /during\s*$/, /while\s*$/, /because\s*$/,
    /although\s*$/, /however\s*$/, /therefore\s*$/, /moreover\s*$/, /furthermore\s*$/,
    /additionally\s*$/, /consequently\s*$/, /meanwhile\s*$/, /otherwise\s*$/,
    /nevertheless\s*$/, /nonetheless\s*$/
  ];
  
  return !incomplete.some(p => p.test(trimmed));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { message, chatId, model, systemPrompt, language } = req.body;

    if (!message || typeof message !== 'string' || message.length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const supportedModels = ['sonar-pro', 'sonar', 'sonar-reasoning', 'sonar-reasoning-pro', 'sonar-deep-research'];
    const selectedModel = model || 'sonar-pro';
    if (!supportedModels.includes(selectedModel)) {
      return res.status(400).json({ error: 'Unsupported model' });
    }
    
    if (UNSAFE_PATTERNS.some(pattern => pattern.test(message))) {
      return res.status(400).json({ 
        error: 'Request contains potentially unsafe content. Please focus on general exam preparation topics.',
        code: 'UNSAFE_CONTENT'
      });
    }
    
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const rateLimitKey = `rate_limit_${clientIP}`;
    
    if (global.rateLimitMap && global.rateLimitMap[rateLimitKey]) {
      const lastRequest = global.rateLimitMap[rateLimitKey];
      if (Date.now() - lastRequest < 1000) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded. Please wait a moment before making another request.',
          code: 'RATE_LIMIT_EXCEEDED'
        });
      }
    }
    
    if (!global.rateLimitMap) global.rateLimitMap = {};
    global.rateLimitMap[rateLimitKey] = Date.now();
    const cacheKey = `${message}-${language || 'en'}`;
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (res.flushHeaders) res.flushHeaders();
      
      const chunks = cached.response.match(/.{1,50}/g) || [cached.response];
      for (const chunk of chunks) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        if (typeof res.flush === 'function') res.flush();
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Transfer-Encoding', 'chunked');
    if (res.flushHeaders) {
      res.flushHeaders();
    }
    if (typeof res.flush === 'function') {
      res.flush();
    }

    const presetAnswer = findPresetAnswer(message);
    if (presetAnswer) {
      const chunks = presetAnswer.match(/.{1,100}/g) || [presetAnswer];
      for (const chunk of chunks) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        if (typeof res.flush === 'function') {
          res.flush();
        }
      }
      res.write('data: [DONE]\n\n');
      if (typeof res.flush === 'function') {
        res.flush();
      }
      res.end();
      return;
    }

    const contextOptimizer = (await import('@/lib/context-optimizer')).default;

    const historyPromise = chatId ? (async () => {
      try {
        await connectToDatabase();
        const chat = await Chat.findOne({ 
          _id: chatId, 
          userEmail: session.user.email 
        }).lean();
        
        if (chat && chat.messages && Array.isArray(chat.messages)) {
          const allMessages = chat.messages
            .filter(msg => msg.sender && msg.text && msg.text.trim() !== message.trim())
            .map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.text
            }));

          if (contextOptimizer.shouldSkipContext(message, allMessages.length)) {
            return [];
          }

          if (allMessages.length > 6) {
            const summary = contextOptimizer.summarizeLongConversation(allMessages);
            const recent = allMessages.slice(-2);
            const relevant = contextOptimizer.selectRelevantContext(allMessages.slice(0, -2), message, 2);
            
            if (summary) {
              return [
                { role: 'system', content: summary },
                ...relevant,
                ...recent
              ];
            }
            return contextOptimizer.selectRelevantContext(allMessages, message, 3);
          }

          return contextOptimizer.selectRelevantContext(allMessages, message, 3);
        }
      } catch (err) {
        console.warn('Failed to load conversation history:', err.message);
      }
      return [];
    })() : Promise.resolve([]);

    let finalSystemPrompt = systemPrompt || `You are Indicore, an exam preparation assistant for UPSC, PCS, and SSC exams. Provide clear, well-structured answers that are easy to read. Use simple formatting: write in paragraphs with proper spacing, use bullet points sparingly, and avoid markdown headers (###) or excessive bold text. Keep responses natural and readable. Write in complete sentences. Do not include citations or reference numbers.`;

    if (language && language !== 'en') {
      const languageNames = {
        hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', bn: 'Bengali',
        pa: 'Punjabi', gu: 'Gujarati', te: 'Telugu', ml: 'Malayalam',
        kn: 'Kannada', es: 'Spanish'
      };

      const langName = languageNames[language] || 'English';
      finalSystemPrompt += ` Your response MUST be entirely in ${langName}. Do not use any other language. Ensure perfect grammar and natural flow in ${langName}.`;
    }

    async function tryPyqFromDb(userMsg, context = null) {
      const effectiveMsg = context ? `PYQ on ${context.theme || 'history'} from ${context.fromYear || 2021} for ${context.examCode}` : userMsg;
      if (!PYQ_PATTERN.test(effectiveMsg)) return null;
      
      return await pyqService.search(userMsg, context, language);
    }

    if (!contextOptimizer.shouldUseLLM(message)) {
      const quickResponse = contextualLayer.getQuickResponse(message);
      if (quickResponse && !quickResponse.requiresAI) {
        const responseText = quickResponse.response || quickResponse.quickResponse || '';
        const chunks = responseText.match(/.{1,100}/g) || [responseText];
        for (const chunk of chunks) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
          if (typeof res.flush === 'function') res.flush();
        }
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
    }

    const isPyqQuery = PYQ_PATTERN.test(message);
    const needsContext = !isPyqQuery && message.length > 30 && contextOptimizer.shouldUseLLM(message);

    const [rawHistory, contextualData, pyqDb] = await Promise.all([
      historyPromise,
      needsContext ? Promise.resolve({
        contextualEnhancement: contextualLayer.generateContextualPrompt(message),
        examContext: examKnowledge.generateContextualPrompt(message)
      }) : Promise.resolve({ contextualEnhancement: '', examContext: '' }),
      isPyqQuery ? tryPyqFromDb(message) : Promise.resolve(null)
    ]);

    const conversationHistory = contextOptimizer.compressContext(rawHistory);

    if (pyqDb) {
      const chunks = pyqDb.match(/.{1,100}/g) || [pyqDb];
      for (const chunk of chunks) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        if (typeof res.flush === 'function') {
          res.flush();
        }
      }
      res.write('data: [DONE]\n\n');
      if (typeof res.flush === 'function') {
        res.flush();
      }
      res.end();
      return;
    }

    const contextualEnhancement = contextualData.contextualEnhancement;
    const examContext = contextualData.examContext;

    function extractPyqContextFromHistory(history) {
      if (!history || history.length === 0) return null;
      
      for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (msg.role === 'user' && msg.content) {
          const userMsg = msg.content.toLowerCase();
          if (PYQ_PATTERN.test(userMsg)) {
        const themeMatch = userMsg.replace(/\b(upsc|pcs|ssc|exam|exams)\b/ig, '').match(/(?:on|about|of|for)\s+([^.,;\n]+)/i);
        const theme = themeMatch ? themeMatch[1].trim() : '';
            
        let fromYear = null, toYear = null;
        const range1 = userMsg.match(/from\s+(\d{4})(?:s)?\s*(?:to|\-|–|—)\s*(present|\d{4})/i);
        const decade = userMsg.match(/(\d{4})s/i);
        if (range1) {
          fromYear = parseInt(range1[1], 10);
          toYear = range1[2].toLowerCase() === 'present' ? new Date().getFullYear() : parseInt(range1[2], 10);
        } else if (decade) {
          fromYear = parseInt(decade[1], 10);
          toYear = fromYear + 9;
        }
        
            let examCode = 'UPSC';
            if (/tnpsc|tamil nadu psc/i.test(userMsg) || language === 'ta') examCode = 'TNPSC';
            else if (/mpsc|maharashtra psc/i.test(userMsg) || language === 'mr') examCode = 'MPSC';
            else if (/upsc/i.test(userMsg)) examCode = 'UPSC';
            else if (/pcs/i.test(userMsg)) examCode = 'PCS';
            
            return { theme, fromYear, toYear, examCode, originalQuery: msg.content };
          }
        }
      }
      return null;
    }

    function buildPyqPrompt(userMsg, previousContext = null) {
      if (!PYQ_PATTERN.test(userMsg) && !previousContext) return '';
      
      let theme = '';
      let fromYear = null;
      let toYear = null;
      let examCodeDetected = 'UPSC';
      
      if (previousContext) {
        theme = previousContext.theme || '';
        fromYear = previousContext.fromYear;
        toYear = previousContext.toYear;
        examCodeDetected = previousContext.examCode || 'UPSC';
        } else {
      const themeMatch = userMsg.replace(/\b(upsc|pcs|ssc|exam|exams)\b/ig, '').match(/(?:on|about|of|for)\s+([^.,;\n]+)/i);
        theme = themeMatch ? themeMatch[1].trim() : '';
      const range1 = userMsg.match(/from\s+(\d{4})(?:s)?\s*(?:to|\-|–|—)\s*(present|\d{4})/i);
      const decade = userMsg.match(/(\d{4})s/i);
      if (range1) {
        fromYear = parseInt(range1[1], 10);
        toYear = range1[2].toLowerCase() === 'present' ? new Date().getFullYear() : parseInt(range1[2], 10);
      } else if (decade) {
        fromYear = parseInt(decade[1], 10);
        toYear = fromYear + 9;
      }
      
      if (/tnpsc|tamil nadu psc/i.test(userMsg) || language === 'ta') examCodeDetected = 'TNPSC';
      else if (/mpsc|maharashtra psc/i.test(userMsg) || language === 'mr') examCodeDetected = 'MPSC';
      else if (/upsc/i.test(userMsg)) examCodeDetected = 'UPSC';
      else if (/pcs/i.test(userMsg)) examCodeDetected = 'PCS';
      }
      
      const yearLine = fromYear ? `Limit to ${fromYear}-${toYear}.` : 'Cover all available years.';
      
      return `\n\nPYQ LISTING MODE:\nReturn only formatted PYQ list, no explanations. Use simple formatting without markdown headers or excessive bold text.\n\nFormat:\n1. Start with: "Previous Year Questions (${examCodeDetected})"\n2. Topic: "Topic: ${theme}" (if provided)\n3. Year Range: "Year Range: ${fromYear || 'All'} to ${toYear || 'Present'}" (if provided)\n4. Group by year: "Year {YEAR} ({count} questions)"\n5. Question format: "{number}. [{Paper}] {Question Text}"\n6. Status: ✅ verified, ⚠️ unverified\n7. Summary: "Summary" with total count\n\nRequirements:\n- Group by year (newest first)\n- Include paper name if known\n- Keep questions under 200 chars\n- Mark uncertain as "(unverified)" or ⚠️\n- Filter by theme if provided: ${theme || 'none'}\n- ${yearLine}\n- Exam: ${examCodeDetected}\n- Prioritize verified questions\n- Use plain text formatting, avoid markdown headers (##, ###) and excessive bold (**)`;
    }

    const previousPyqContext = extractPyqContextFromHistory(conversationHistory);
    const isFollowUpQuestion = /^(give|show|get|fetch|find|search|more|another|additional|next|other|different)\s+(more|questions|pyqs|previous year|questions|pyq)/i.test(message) || 
                               /^(more|another|additional|next|other|different|continue|keep going|show more|give more)/i.test(message.trim()) ||
                               /^(more|another|additional|next|other|different)\s+(of|from|those|them|these|questions|pyqs?)/i.test(message.trim());
    
    if (isFollowUpQuestion && previousPyqContext) {
      const messageCount = conversationHistory.length;
      const estimatedOffset = Math.max(0, Math.floor((messageCount - 1) / 2) * 50);
      const contextWithOffset = { ...previousPyqContext, offset: estimatedOffset };
      const pyqDb = await tryPyqFromDb(`PYQ on ${previousPyqContext.theme || 'history'} from ${previousPyqContext.fromYear || 2021} for ${previousPyqContext.examCode}`, contextWithOffset);
      if (pyqDb) {
        const chunks = pyqDb.match(/.{1,100}/g) || [pyqDb];
        for (const chunk of chunks) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
          if (typeof res.flush === 'function') {
            res.flush();
          }
        }
        res.write('data: [DONE]\n\n');
        if (typeof res.flush === 'function') {
          res.flush();
        }
        res.end();
        return;
      }
    }
    
    const optimizedHistory = contextOptimizer.compressContext(conversationHistory);
    const hasContext = optimizedHistory.length > 0;
    const isFollowUp = /^(continue|more|another|further|elaborate|expand)/i.test(message.trim()) || optimizedHistory.length > 0;

    const pyqPrompt = buildPyqPrompt(message, previousPyqContext);
    let systemContent = contextOptimizer.optimizeSystemPrompt(finalSystemPrompt, hasContext, isFollowUp);
    
    if (pyqPrompt) {
      systemContent += pyqPrompt;
    } else if (contextualEnhancement && needsContext) {
      systemContent += contextualEnhancement.substring(0, 300);
    }

    let contextNote = '';
    if (previousPyqContext && isFollowUpQuestion) {
      contextNote = `\nContext: ${previousPyqContext.theme || 'general'} (${previousPyqContext.fromYear || 'all'}-${previousPyqContext.toYear || 'present'}), ${previousPyqContext.examCode}`;
    }

    const optimalModel = contextOptimizer.selectOptimalModel(message, hasContext && optimizedHistory.length > 2);
    const messagesForAPI = [
      { role: 'system', content: systemContent + contextNote },
      ...optimizedHistory,
      { role: 'user', content: message }
    ];

    const maxTokens = Math.min(
      Math.max(calculateMaxTokens(message, pyqPrompt ? 'pyq' : 'general'), 1500),
      pyqPrompt ? 4000 : 3000
    );

    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: optimalModel === 'sonar' ? 'sonar' : selectedModel,
      messages: messagesForAPI,
      max_tokens: maxTokens,
      temperature: pyqPrompt ? 0.2 : 0.7,
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
    
    await new Promise((resolve) => {
      const keepAlive = setInterval(() => {
        if (!res.writableEnded) res.write('');
      }, 15000);

      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              clearInterval(keepAlive);
              
              const isGarbled = /(PCSC|PCS|UPSC|SSC)\s+exams?\s+need\s+help|I'm\s+to\s+support|Let\s+me\s+know\s+I\s+can\s+you/i.test(fullResponse);
              
              const finalTrimmed = fullResponse.trim();
              let cleanedResponse = finalTrimmed;
              
              if (finalTrimmed && (finalTrimmed.endsWith('-') || finalTrimmed.endsWith(',') || finalTrimmed.match(/\s+(and|or)\s*$/i))) {
                const sentences = finalTrimmed.split(/[.!?]/).filter(s => s.trim() && s.length > 10);
                if (sentences.length > 0) {
                  cleanedResponse = sentences.join('. ') + '.';
                } else if (finalTrimmed.length > 50) {
                  cleanedResponse = finalTrimmed.slice(0, -1).trim() + '.';
                }
              }
              
              const isCutOff = !isResponseComplete(cleanedResponse) && cleanedResponse.length > 100;
              
              if (cleanedResponse.trim().length > 50 && !isGarbled && !isCutOff) {
                responseCache.set(cacheKey, {
                  response: cleanedResponse,
                  timestamp: Date.now()
                });
                
                if (responseCache.size > 500) {
                  const now = Date.now();
                  for (const [key, value] of responseCache.entries()) {
                    if (now - value.timestamp > CACHE_TTL) {
                      responseCache.delete(key);
                    }
                  }
                }
              }
              
              if (cleanedResponse !== finalTrimmed && cleanedResponse.length > 50) {
                fullResponse = cleanedResponse;
              }
              
              res.write('data: [DONE]\n\n');
              if (typeof res.flush === 'function') {
                res.flush();
              }
              res.end();
              resolve();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                let content = parsed.choices[0].delta.content;
                content = content.replace(/\[\d+\]/g, '').replace(/\[\d+,\s*\d+\]/g, '');
                content = content.replace(/\b(PCSC|PCS|UPSC|SSC)\s+exams?\s+need\s+help\s+[^.]*\./gi, '');
                content = content.replace(/\bI'm\s+to\s+support\s+[^.]*\./gi, '');
                content = content.replace(/\bLet\s+me\s+know\s+I\s+can\s+you\s+today/gi, '');
                content = content.replace(/\b(requirements?|structure?|response?|answer?|following|as follows):\s*$/gmi, '');
                fullResponse += content;
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
                if (typeof res.flush === 'function') {
                  res.flush();
                }
              }
            } catch (e) {
            }
          }
        }
      });

      response.data.on('end', () => {
        clearInterval(keepAlive);
        if (fullResponse.trim().length > 50) {
          responseCache.set(cacheKey, {
            response: fullResponse,
            timestamp: Date.now()
          });
        }
        if (!res.writableEnded) {
          res.write('data: [DONE]\n\n');
          if (typeof res.flush === 'function') {
            res.flush();
          }
          res.end();
        }
        resolve();
      });

      response.data.on('error', (error) => {
        clearInterval(keepAlive);
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
        }
        if (!res.writableEnded) {
          const errorMsg = error.response?.status === 401 
            ? 'API credits exhausted or invalid API key. Please check your Perplexity API key.'
            : 'An error occurred while processing your request.';
          res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
        resolve();
      });
    });

  } catch (error) {
    console.error('Chat stream error:', error.message);
    
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }

    if (error.response) {
      const status = error.response.status;
      let errorMessage = 'An error occurred while processing your request.';

      if (status === 401) {
        errorMessage = 'API credits exhausted or invalid API key. Please check your Perplexity API key and add credits if needed.';
      } else if (status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (status === 402) {
        errorMessage = 'Insufficient API credits. Please add credits to your Perplexity account.';
      } else if (status === 403) {
        errorMessage = 'Access denied. Please verify your API key permissions.';
      }

      res.write(`data: ${JSON.stringify({ error: errorMessage, status })}\n\n`);
      res.write('data: [DONE]\n\n');
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Internal server error. Please try again later.' })}\n\n`);
      res.write('data: [DONE]\n\n');
    }
    res.end();
  }
}

