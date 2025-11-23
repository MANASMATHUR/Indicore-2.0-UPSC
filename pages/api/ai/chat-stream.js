import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { contextualLayer } from '@/lib/contextual-layer';
import examKnowledge from '@/lib/exam-knowledge';
import { findPresetAnswer } from '@/lib/presetAnswers';
import connectToDatabase from '@/lib/mongodb';
import Chat from '@/models/Chat';
import User from '@/models/User';
import pyqService from '@/lib/pyqService';
import axios from 'axios';
import { cleanAIResponse, validateAndCleanResponse, isGarbledResponse } from '@/lib/responseCleaner';
import { extractUserInfo, updateUserProfile, formatProfileContext, extractConversationFacts } from '@/lib/userProfileExtractor';
import { buildConversationMemoryPrompt, saveConversationMemory } from '@/lib/conversationMemory';
import { getPyqContext, setPyqContext, clearPyqContext } from '@/lib/pyqContextCache';
import { callAIWithFallback } from '@/lib/ai-providers';

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

const PYQ_PATTERN = /(pyq|pyqs|previous\s+year\s+(?:question|questions|paper|papers)|past\s+year\s+(?:question|questions)|search.*pyq|find.*pyq|(?:give|show|get|fetch|list|bring|tell|need|want)\s+(?:me\s+)?(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs|questions?|qs)|(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs))/i;

function calculateMaxTokens(message, queryType = 'general', useOpenAI = false) {
  // For OpenAI: No token limit - let the model use its full context window (ChatGPT-like behavior)
  if (useOpenAI) {
    return undefined; // undefined means no limit - model uses full context window
  }
  
  // For other providers: Use higher limits for long conversations
  if (queryType === 'pyq') {
    return 40000;
  }
  return 40000; // Increased for longer conversations
}

function estimateTokenLength(messages) {
  if (!Array.isArray(messages)) return 0;
  const totalChars = messages.reduce((sum, msg) => {
    if (!msg || !msg.content) return sum;
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return sum + content.length;
  }, 0);
  return Math.ceil(totalChars / 4); // rough char→token estimate
}

function isResponseComplete(response) {
  const trimmed = response.trim();
  if (trimmed.length < 10) return false;
  
  const sentences = trimmed.split(/[.!?]/).filter(s => s.trim().length > 0);
  const lastSent = sentences.length > 0 ? sentences[sentences.length - 1].trim() : trimmed.trim();
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
    const { message, chatId, model, systemPrompt, language, provider, openAIModel } = req.body;
    const STREAMING_FALLBACK_MESSAGE = "I couldn't generate a full answer this time, but I'm still here—please rephrase or ask again so I can try once more.";
    const pyqContextKey = `${session.user.email}:${chatId || 'stream'}`;
    const providerPreference = (provider || 'openai').toLowerCase();
    const normalizedOpenAIModel = typeof openAIModel === 'string' && openAIModel.trim().length > 0
      ? openAIModel.trim()
      : '';
    const resolvedOpenAIModel = normalizedOpenAIModel || process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o-mini';
    const openAIKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
    let useOpenAI = providerPreference === 'openai' && openAIKey;

    const persistMemory = async (finalText) => {
      if (!finalText || typeof finalText !== 'string' || finalText.trim().length < 5) {
        return;
      }
      await saveConversationMemory({
        userEmail: session.user.email,
        chatId: chatId ? String(chatId) : undefined,
        userMessage: message,
        assistantResponse: finalText
      });
    };

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
    const cacheKey = `${message}-${language || 'en'}-${model || 'sonar-pro'}-${providerPreference}-${normalizedOpenAIModel || 'default'}`;
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

    const translationMatch = message.match(/translate\s+(?:this|that|the\s+following|text)?\s*(?:to|in|into)\s+(hindi|marathi|tamil|bengali|punjabi|gujarati|telugu|malayalam|kannada|spanish|english)/i);
    if (translationMatch) {
      const targetLang = translationMatch[1].toLowerCase();
      const languageMap = {
        'hindi': 'hi', 'marathi': 'mr', 'tamil': 'ta', 'bengali': 'bn',
        'punjabi': 'pa', 'gujarati': 'gu', 'telugu': 'te', 'malayalam': 'ml',
        'kannada': 'kn', 'spanish': 'es', 'english': 'en'
      };
      const targetLangCode = languageMap[targetLang] || 'hi';
      
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
            const chunks = translated.match(/.{1,100}/g) || [translated];
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
        } catch (translationError) {
          console.warn('Translation failed, falling back to regular response:', translationError.message);
        }
      }
    }

    const allowPresetAnswers = process.env.ENABLE_PRESET_ANSWERS !== 'false';
    if (allowPresetAnswers) {
      const presetAnswer = findPresetAnswer(message);
      if (presetAnswer) {
        const cleanedPreset = cleanAIResponse(presetAnswer);
        const finalPreset = validateAndCleanResponse(cleanedPreset, 30) || cleanedPreset || presetAnswer;
        const chunks = finalPreset.match(/.{1,100}/g) || [finalPreset];
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

    const contextOptimizer = (await import('@/lib/context-optimizer')).default;

    const userProfilePromise = (async () => {
      try {
        await connectToDatabase();
        const user = await User.findOne({ email: session.user.email }).lean();
        return user?.profile || null;
      } catch (err) {
        console.warn('Failed to load user profile:', err.message);
        return null;
      }
    })();

    const extractedInfo = extractUserInfo(message);
    
    let userProfile = await userProfilePromise;
    if (Object.keys(extractedInfo).length > 0) {
      try {
        await connectToDatabase();
        const user = await User.findOne({ email: session.user.email });
        if (user) {
          const updatedProfile = updateUserProfile(user, extractedInfo);
          user.profile = updatedProfile;
          await user.save();
          userProfile = updatedProfile;
        }
      } catch (err) {
        console.warn('Failed to update user profile:', err.message);
      }
    }

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

    let finalSystemPrompt = systemPrompt || `You are Indicore, your intelligent exam preparation companion—think of me as ChatGPT, but specialized for UPSC, PCS, and SSC exam preparation. I'm here to help you succeed, whether you need explanations, practice questions, answer writing guidance, or just someone to discuss exam topics with. I can also help with general questions, but I always keep exam relevance in mind.

RESPONSE QUALITY STANDARDS - CRITICAL:
- Provide comprehensive, well-researched answers that match or exceed ChatGPT's quality
- Be thorough but concise—cover all important aspects without unnecessary verbosity
- Use clear, logical structure: introduction → main points → examples → conclusion
- Include relevant facts, data, dates, and sources when available
- Connect concepts to real-world applications and current affairs
- Anticipate follow-up questions and address related topics proactively
- When solving PYQ questions, provide complete, exam-ready answers with proper structure
- For Mains questions, structure answers with Introduction, Body (with sub-points), and Conclusion
- For Prelims questions, provide clear explanations with key facts highlighted
- Always verify information accuracy—never guess or make up facts

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

    const profileContext = userProfile ? formatProfileContext(userProfile) : '';
    if (profileContext) {
      finalSystemPrompt += profileContext;
    }

    const memoryPrompt = buildConversationMemoryPrompt(userProfile?.conversationSummaries);
    if (memoryPrompt) {
      finalSystemPrompt += `\n\nRECENT CONVERSATIONS WITH THIS USER:\n${memoryPrompt}\nUse this to maintain continuity even in new chat threads.`;
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

    async function tryPyqFromDb(userMsg, context = null) {
      const fallbackMsg = context ? `PYQ on ${context.theme || 'history'} from ${context.fromYear || 2021} for ${context.examCode || 'UPSC'}` : userMsg;
      const effectiveMsg = context?.originalQuery || fallbackMsg;
      const contextPayload = context ? { ...context } : null;
      if (contextPayload && typeof contextPayload.offset !== 'number') {
        contextPayload.offset = contextPayload.offset || 0;
      }

      const hasPyqKeyword = /(pyq|pyqs|previous\s+year|past\s+year)/i.test(effectiveMsg);
      const hasPyqIntent = /(?:give|show|get|fetch|list|bring|tell|need|want)\s+(?:me\s+)?(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs|questions?|qs)/i.test(effectiveMsg);
      const hasSubjectPyq = /(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs)/i.test(effectiveMsg);

      if (!context && !hasPyqKeyword && !hasPyqIntent && !hasSubjectPyq) {
        return null;
      }

      try {
        const result = await pyqService.search(effectiveMsg, contextPayload, language);
        if (!result) {
          console.log('PYQ search returned null for query:', userMsg.substring(0, 50));
        } else {
          console.log('PYQ search found results, length:', result.count);
          if (chatId) {
            setPyqContext(pyqContextKey, {
              ...result.context,
              originalQuery: result.context.originalQuery || effectiveMsg
            });
        }
          return result.content;
        }
      } catch (error) {
        console.error('PYQ search error:', error.message);
      }

      if (context && chatId) {
        clearPyqContext(pyqContextKey);
      }
      return null;
    }

    const quickResponse = contextualLayer.getQuickResponse(message);
    if (quickResponse && !quickResponse.requiresAI && contextOptimizer.shouldUseLLM(message) === false) {
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

    // Check for solve requests first (before checking for new PYQ queries)
    // This prevents "solve the pyqs you just gave me" from being treated as a new PYQ search
    // Check for solve requests early to prevent them from being treated as new PYQ queries
    // We need to check context before the Promise.all to avoid unnecessary PYQ searches
    const rawHistoryForSolve = await historyPromise;
    const conversationHistoryForSolve = contextOptimizer.compressContext(rawHistoryForSolve);
    const cachedPyqContextForSolve = chatId ? getPyqContext(pyqContextKey) : null;
    const historyPyqContextForSolve = extractPyqContextFromHistory(conversationHistoryForSolve);
    const previousPyqContextForSolve = cachedPyqContextForSolve || historyPyqContextForSolve;
    const PYQ_SOLVE_REGEX_EARLY = /^(?:solve|answer|explain|provide\s+(?:answers?|solutions?)|give\s+(?:answers?|solutions?)|how\s+to\s+(?:solve|answer)|what\s+(?:are|is)\s+the\s+(?:answers?|solutions?))(?:\s+(?:these|those|the|these\s+questions?|those\s+questions?|the\s+questions?|them|all\s+of\s+them|the\s+pyqs?|pyqs?|questions?|you\s+just\s+(?:gave|provided|showed|listed)))?$/i;
    const isSolveRequestEarly = previousPyqContextForSolve && PYQ_SOLVE_REGEX_EARLY.test(message.trim());
    
    const hasPyqKeyword = /(pyq|pyqs|previous\s+year|past\s+year)/i.test(message);
    const hasPyqIntent = /(?:give|show|get|fetch|list|bring|tell|need|want)\s+(?:me\s+)?(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs|questions?|qs)/i.test(message);
    const hasSubjectPyq = /(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs)/i.test(message);
    // Only treat as new PYQ query if it's NOT a solve request
    const isPyqQuery = !isSolveRequestEarly && (hasPyqKeyword || hasPyqIntent || hasSubjectPyq);
    
    const needsContext = !isPyqQuery && message.length > 10;

    // Reuse the history we already fetched for solve detection
    const [contextualData, pyqDb] = await Promise.all([
      needsContext ? Promise.resolve({
        contextualEnhancement: contextualLayer.generateContextualPrompt(message),
        examContext: examKnowledge.generateContextualPrompt(message)
      }) : Promise.resolve({ contextualEnhancement: '', examContext: '' }),
      isPyqQuery ? tryPyqFromDb(message) : Promise.resolve(null)
    ]);

    // Use the history we already processed
    const conversationHistory = conversationHistoryForSolve;
    const cachedPyqContext = cachedPyqContextForSolve;

    if (isPyqQuery) {
      if (pyqDb && pyqDb.trim().length > 50) {
        // CRITICAL: Preserve newlines - only clean artifacts, don't remove structure
        let cleanedPyq = pyqDb;
        
        // Remove citation patterns and UI artifacts but preserve newlines
        cleanedPyq = cleanedPyq.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
        cleanedPyq = cleanedPyq.replace(/From\s+result[^.!?\n]*/gi, '');
        cleanedPyq = cleanedPyq.replace(/\([A-Z][a-zA-Z\s]{3,}\):\s*(?=\s*[a-z])/g, '');
        cleanedPyq = cleanedPyq.replace(/🌐\s*Translate\s+to[^\n]*/gi, '');
        cleanedPyq = cleanedPyq.replace(/\d{1,2}:\d{2}\s*(?:AM|PM)\s*/gi, '');
        // Only normalize excessive blank lines (4+ to 2), preserve structure
        cleanedPyq = cleanedPyq.replace(/\n{4,}/g, '\n\n');
        
        // Trim only leading/trailing whitespace, preserve internal newlines
        cleanedPyq = cleanedPyq.trim();
        
        // Ensure we still have newlines after cleaning
        if (!cleanedPyq.includes('\n') && pyqDb.includes('\n')) {
          console.warn('WARNING: Cleaning removed all newlines, using original');
          cleanedPyq = pyqDb;
        }
        const chunks = cleanedPyq.match(/.{1,100}/g) || [cleanedPyq];
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
      } else {
        const parsed = pyqService.parseQuery(message, language);
        const noResultsMessage = `## Previous Year Questions (${parsed.examCode || 'UPSC'})\n\n**Topic:** ${parsed.theme || 'General'}\n\nNo questions were found in the database for the given criteria.\n\n### Suggestions:\n\n- Try a different topic or subject\n- Check if the spelling is correct\n- Try a broader search term\n- Use formats like "PYQ on economics" or "history pyqs"`;
        const chunks = noResultsMessage.match(/.{1,100}/g) || [noResultsMessage];
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

    const contextualEnhancement = contextualData.contextualEnhancement;
    const examContext = contextualData.examContext;

    function extractPyqContextFromHistory(history) {
      if (!history || history.length === 0) return null;
      
      for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (msg.role === 'user' && msg.content) {
          const userMsg = msg.content;
          const hasPyqKeyword = /(pyq|pyqs|previous\s+year|past\s+year)/i.test(userMsg);
          const hasPyqIntent = /(?:give|show|get|fetch|list|bring|tell|need|want)\s+(?:me\s+)?(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs|questions?|qs)/i.test(userMsg);
          const hasSubjectPyq = /(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs)/i.test(userMsg);
          
          if (hasPyqKeyword || hasPyqIntent || hasSubjectPyq) {
            const parsed = pyqService.parseQuery(userMsg, language);
            const theme = parsed.theme || '';
            const fromYear = parsed.fromYear;
            const toYear = parsed.toYear;
            const examCode = parsed.examCode || 'UPSC';
            
            return { theme, fromYear, toYear, examCode, originalQuery: msg.content };
          }
        }
      }
      return null;
    }

    function buildPyqPrompt(userMsg, previousContext = null) {
      if (!previousContext) {
        const hasPyqKeyword = /(pyq|pyqs|previous\s+year|past\s+year)/i.test(userMsg);
        const hasPyqIntent = /(?:give|show|get|fetch|list|bring|tell|need|want)\s+(?:me\s+)?(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs|questions?|qs)/i.test(userMsg);
        const hasSubjectPyq = /(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs)/i.test(userMsg);
        if (!hasPyqKeyword && !hasPyqIntent && !hasSubjectPyq) {
          return '';
        }
      }
      
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
        const parsed = pyqService.parseQuery(userMsg, language);
        theme = parsed.theme || '';
        fromYear = parsed.fromYear;
        toYear = parsed.toYear;
        examCodeDetected = parsed.examCode || 'UPSC';
      }
      
      const yearLine = fromYear ? `Limit to ${fromYear}-${toYear}.` : 'Cover all available years.';
      
      return `\n\nPYQ LISTING MODE:\nYou are providing Previous Year Questions (PYQ) from the database. Your task is to format and present questions in a clear, organized, and complete manner.

CRITICAL REQUIREMENTS - RESPONSE QUALITY:
1. ALWAYS write complete, well-formed responses. Never leave responses incomplete or cut off mid-thought.
2. Use simple, clean formatting without markdown headers (##, ###) or excessive bold text.
3. Ensure all questions are properly formatted and complete with proper punctuation.
4. Group questions logically by year (newest first).
5. ONLY include questions that are actually in the database. Do NOT invent or create questions.
6. If the database returns no questions, clearly state: "No questions were found for the given criteria. Please try adjusting your search parameters."
7. Every sentence must be grammatically complete. Never end with incomplete phrases.
8. Ensure the response has a clear structure: header, topic info, questions grouped by year, and summary.
9. Write in full, complete sentences. Do not use placeholders or incomplete phrases.

ACCURACY REQUIREMENTS:
- ONLY list questions that are actually provided in the database response.
- Do NOT make up, invent, or create questions that are not in the database.
- Do NOT fabricate question numbers, papers, or years.
- If unsure about any question details, mark it as "(unverified)" or use ⚠️ symbol.
- Be honest if no questions match the criteria rather than creating fake questions.
- Verify question text matches what's in the database - do not paraphrase or modify.

RESPONSE FORMAT STRUCTURE:
1. Header: Start with "Previous Year Questions (${examCodeDetected})"
2. Topic Information: "Topic: ${theme}" (if provided, otherwise skip this line)
3. Year Range: "Year Range: ${fromYear || 'All'} to ${toYear || 'Present'}" (if provided)
4. Questions Section: Group by year with clear headers
   - Format: "Year {YEAR} ({count} questions)"
   - Each question: "{number}. [{Paper}] {Question Text}"
   - Use proper numbering (1, 2, 3...)
   - Include paper name in brackets if available
   - Keep question text complete and accurate
5. Summary: End with "Summary: Total {count} questions found" or similar

FORMATTING REQUIREMENTS:
- Group by year (newest first)
- Include paper name if known (e.g., [GS Paper 1], [Prelims])
- Keep questions under 200 characters when possible, but prioritize completeness
- Mark uncertain questions as "(unverified)" or use ⚠️ symbol
- Filter by theme if provided: ${theme || 'none'}
- ${yearLine}
- Exam: ${examCodeDetected}
- Prioritize verified questions
- Use plain text formatting only (no markdown)
- Ensure proper spacing between sections
- Use consistent numbering and formatting throughout

PRESENTATION & CLEAN STRUCTURE:
- Insert a blank line between sections (header, topic info, each year group, summary) so the response never appears as one dense block.
- Use consistent numbering within each year and restart numbering for each new year section.
- Keep summaries concise (2-3 bullet points) and visually separated from the question list.

COMPLETENESS REQUIREMENTS:
- Always end with a complete sentence or summary
- Never cut off mid-question or mid-sentence
- Ensure all questions are fully displayed
- Include all relevant information (year, paper, question text)
- Provide a clear summary at the end

Remember: Your goal is to present questions clearly and completely. If no questions are found, state that clearly. If questions are found, format them properly and ensure the response is complete and well-structured.`;
    }

    // Use the context we already extracted earlier (avoid duplicate extraction)
    const previousPyqContext = previousPyqContextForSolve;
    const isSolveRequest = isSolveRequestEarly;
    
    const isFollowUpQuestion = /^(give|show|get|fetch|find|search|more|another|additional|next|other|different)\s+(more|questions|pyqs|previous year|questions|pyq)/i.test(message) || 
                               /^(more|another|additional|next|other|different|continue|keep going|show more|give more)/i.test(message.trim()) ||
                               /^(more|another|additional|next|other|different)\s+(of|from|those|them|these|questions|pyqs?)/i.test(message.trim());
    
    if (isFollowUpQuestion && previousPyqContext) {
      const messageCount = conversationHistory.length;
      const estimatedOffset = Math.max(0, Math.floor((messageCount - 1) / 2) * 50);
      const contextWithOffset = { ...previousPyqContext };
      contextWithOffset.offset = typeof previousPyqContext.offset === 'number'
        ? previousPyqContext.offset
        : (cachedPyqContext?.offset ?? estimatedOffset);
      const followUpQuery = previousPyqContext.originalQuery || message;
      const pyqDb = await tryPyqFromDb(followUpQuery, contextWithOffset);
      if (pyqDb && pyqDb.trim().length > 50) {
        // CRITICAL: Preserve newlines - only clean artifacts, don't remove structure
        // Consistent with main PYQ handler above
        let cleanedPyq = pyqDb;
        
        // Remove citation patterns and UI artifacts but preserve newlines
        cleanedPyq = cleanedPyq.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
        cleanedPyq = cleanedPyq.replace(/From\s+result[^.!?\n]*/gi, '');
        cleanedPyq = cleanedPyq.replace(/\([A-Z][a-zA-Z\s]{3,}\):\s*(?=\s*[a-z])/g, '');
        cleanedPyq = cleanedPyq.replace(/🌐\s*Translate\s+to[^\n]*/gi, '');
        cleanedPyq = cleanedPyq.replace(/\d{1,2}:\d{2}\s*(?:AM|PM)\s*/gi, '');
        // Normalize excessive blank lines (4+ to 2) - consistent with main handler
        cleanedPyq = cleanedPyq.replace(/\n{4,}/g, '\n\n');
        
        // Trim only leading/trailing whitespace, preserve internal newlines
        cleanedPyq = cleanedPyq.trim();
        
        // Ensure we still have newlines after cleaning
        if (!cleanedPyq.includes('\n') && pyqDb.includes('\n')) {
          console.warn('WARNING: Cleaning removed all newlines, using original');
          cleanedPyq = pyqDb;
        }
        
        const chunks = cleanedPyq.match(/.{1,100}/g) || [cleanedPyq];
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
      } else if (isFollowUpQuestion && previousPyqContext) {
        if (chatId) {
          clearPyqContext(pyqContextKey);
        }
        const noResultsMessage = `## Previous Year Questions (${previousPyqContext.examCode || 'UPSC'})\n\n**Topic:** ${previousPyqContext.theme || 'General'}\n\nNo additional questions were found in the database.\n\nYou've reached the end of the available questions for this topic.\n\n### Try:\n\n- A different topic or subject\n- A different year range\n- A broader search term`;
        const chunks = noResultsMessage.match(/.{1,100}/g) || [noResultsMessage];
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
    
    // If solving questions, fetch the PYQs again to include in context
    let pyqContextForSolving = null;
    if (isSolveRequest && previousPyqContext) {
      try {
        // Use the original query from context, not the current message
        const solvePyqResult = await tryPyqFromDb(previousPyqContext.originalQuery, previousPyqContext);
        if (solvePyqResult) {
          pyqContextForSolving = solvePyqResult;
        }
      } catch (error) {
        console.warn('Failed to fetch PYQs for solving:', error.message);
      }
      
      // If context fetch failed, we can't proceed with solve request
      // Return an error response instead of sending confusing message to AI
      if (!pyqContextForSolving) {
        const errorMessage = 'I apologize, but I couldn\'t retrieve the questions you asked about earlier. Please ask for the questions again, or provide the specific questions you\'d like me to solve.';
        const chunks = errorMessage.match(/.{1,100}/g) || [errorMessage];
        for (const chunk of chunks) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ final: true })}\n\n`);
        res.write('data: [DONE]\n\n');
        return;
      }
    }
    
    // conversationHistory is already compressed (from line 465), don't compress again
    const optimizedHistory = conversationHistory;
    const hasContext = optimizedHistory.length > 0;
    const isFollowUp = /^(continue|more|another|further|elaborate|expand)/i.test(message.trim()) || optimizedHistory.length > 0;

    // Only build PYQ listing prompt if this is NOT a solve request
    // Solve requests should get answer/solution instructions, not listing instructions
    const pyqPrompt = !isSolveRequest ? buildPyqPrompt(message, previousPyqContext) : null;
    let systemContent = contextOptimizer.optimizeSystemPrompt(finalSystemPrompt, hasContext, isFollowUp);
    
    // If solving questions, enhance the user message with PYQ context
    // Note: pyqContextForSolving is guaranteed to be non-null here because we return early if it's null
    let userMessage = message;
    if (isSolveRequest) {
      userMessage = `The user previously asked for PYQs and I provided the following questions:\n\n${pyqContextForSolving}\n\nNow the user is asking: "${message}"\n\nPlease provide comprehensive, well-structured answers/solutions to these questions. For each question:\n1. Provide a clear, detailed answer\n2. Explain key concepts and context\n3. Include relevant examples and current affairs connections\n4. Structure answers in exam-appropriate format (for Mains questions)\n5. Highlight important points that examiners look for\n6. Connect to broader syllabus topics where relevant`;
    }
    
    if (pyqPrompt) {
      systemContent += pyqPrompt;
    } else if (contextualEnhancement && needsContext) {
      systemContent += contextualEnhancement.substring(0, 300);
    }

    let contextNote = '';
    if (previousPyqContext && isFollowUpQuestion && typeof previousPyqContext === 'object') {
      contextNote = `\nContext: ${previousPyqContext.theme || 'general'} (${previousPyqContext.fromYear || 'all'}-${previousPyqContext.toYear || 'present'}), ${previousPyqContext.examCode || ''}`;
    }

    // Truncate system prompt if too long (Perplexity has limits)
    const maxSystemLength = 1400;
    let finalSystemContent = systemContent + contextNote;
    if (finalSystemContent.length > maxSystemLength) {
      finalSystemContent = finalSystemContent.substring(0, maxSystemLength - 100) + '...';
    }

    const optimalModel = contextOptimizer.selectOptimalModel(message, hasContext && optimizedHistory.length > 2);
    
    // Ensure we always have at least one user message
    const messagesForAPI = [];
    if (finalSystemContent && finalSystemContent.trim().length > 0) {
      messagesForAPI.push({ role: 'system', content: finalSystemContent });
    }
    
    // Add history if available
    if (optimizedHistory && optimizedHistory.length > 0) {
      messagesForAPI.push(...optimizedHistory);
    }
    
    // Always add user message (ensure it's not empty)
    // Use userMessage if solving questions (includes PYQ context), otherwise use original message
    const finalUserMessage = userMessage || message;
    if (finalUserMessage && finalUserMessage.trim().length > 0) {
      messagesForAPI.push({ role: 'user', content: finalUserMessage.trim() });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Message cannot be empty', final: true })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // Final validation: ensure we have at least one user message
    if (messagesForAPI.filter(m => m.role === 'user').length === 0) {
      res.write(`data: ${JSON.stringify({ error: 'Invalid message format', final: true })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const estimatedPromptTokens = estimateTokenLength(messagesForAPI);
    const requiresLargeContextProvider = estimatedPromptTokens >= 16000;

    // Prefer OpenAI for long conversations (no token limits)
    if (openAIKey && (requiresLargeContextProvider || providerPreference === 'openai')) {
      useOpenAI = true;
    }

    // Calculate token budget: undefined for OpenAI (unlimited), higher limits for others
    const calculatedTokens = calculateMaxTokens(message, pyqPrompt ? 'pyq' : 'general', useOpenAI);
    const maxTokens = useOpenAI 
      ? undefined // OpenAI: no limit - uses full context window
      : (calculatedTokens || 40000); // Other providers: use calculated or default high limit

    if (requiresLargeContextProvider && !useOpenAI) {
      const conversationMessagesForAI = messagesForAPI.filter(msg => msg.role !== 'system');
      let aiResult;
      try {
        aiResult = await callAIWithFallback(
          conversationMessagesForAI,
          finalSystemContent,
          Math.min(maxTokens, 8000),
          pyqPrompt ? 0.2 : 0.7,
          {
            preferredProvider: 'perplexity',
            model: optimalModel === 'sonar' ? 'sonar' : selectedModel,
            useLongContextModel: true,
            openAIModel: resolvedOpenAIModel
          }
        );
      } catch (apiError) {
        const normalized = apiError.message?.toLowerCase() || '';
        let errorMessage = apiError.message || 'AI provider error. Please try again.';
        if (normalized.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (normalized.includes('api key') || normalized.includes('unauthorized')) {
          errorMessage = 'AI provider rejected the request. Please verify API keys and quotas.';
        }
        res.write(`data: ${JSON.stringify({ error: errorMessage, final: true })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      let fullResponse = (aiResult?.content || '').replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '').trim();
      if (!fullResponse || fullResponse.length < 10) {
        fullResponse = STREAMING_FALLBACK_MESSAGE;
      }

      let cleanedResponse = cleanAIResponse(fullResponse);
      let validResponse = validateAndCleanResponse(cleanedResponse, 30) || fullResponse;
      if (!validResponse || validResponse.length < 10) {
        validResponse = STREAMING_FALLBACK_MESSAGE;
      }

      responseCache.set(cacheKey, {
        response: validResponse,
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

      await persistMemory(validResponse);

      const chunkSize = 400;
      for (let i = 0; i < validResponse.length; i += chunkSize) {
        const chunk = validResponse.slice(i, i + chunkSize);
        if (chunk.trim().length > 0) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
          if (typeof res.flush === 'function') {
            res.flush();
          }
        }
      }
      res.write('data: [DONE]\n\n');
      if (typeof res.flush === 'function') {
        res.flush();
      }
      res.end();

      if (chatId && validResponse.length > 50) {
        (async () => {
          try {
            await connectToDatabase();
            const chat = await Chat.findOne({ 
              _id: chatId, 
              userEmail: session.user.email 
            }).lean();
            
            if (chat && chat.messages && chat.messages.length > 0) {
              const conversationFacts = await extractConversationFacts(chat.messages, session.user.email);
              
              if (conversationFacts.facts && conversationFacts.facts.length > 0) {
                const user = await User.findOne({ email: session.user.email });
                if (user) {
                  const profile = user.profile || {};
                  if (!profile.facts) {
                    profile.facts = [];
                  }
                  conversationFacts.facts.forEach(fact => {
                    if (!fact || typeof fact !== 'string') return;
                    const normalizedFact = fact.toLowerCase().trim();
                    if (normalizedFact.length < 10) return;
                    const exists = profile.facts.some(f => {
                      if (!f || typeof f !== 'string') return false;
                      return f.toLowerCase().trim() === normalizedFact;
                    });
                    if (!exists) {
                      profile.facts.push(fact);
                    }
                  });
                  if (profile.facts.length > 20) {
                    profile.facts = profile.facts.slice(-20);
                  }
                  profile.lastUpdated = new Date();
                  user.profile = profile;
                  await user.save();
                }
              }
            }
          } catch (err) {
            console.warn('Failed to extract conversation facts:', err.message);
          }
        })();
      }
      
      return;
    }

    let response;
    const providerName = useOpenAI ? 'openai' : 'perplexity';

    if (useOpenAI) {
      try {
        response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: resolvedOpenAIModel,
          messages: messagesForAPI,
          temperature: pyqPrompt ? 0.2 : 0.7,
          stream: true
        }, {
          headers: {
            'Authorization': `Bearer ${openAIKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream',
          timeout: 520000
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
          const fallbackMaxTokens = maxTokens ? Math.min(maxTokens, 8000) : 16000;
          const aiResult = await callAIWithFallback(
            conversationMessagesForAI,
            finalSystemContent,
            fallbackMaxTokens,
            pyqPrompt ? 0.2 : 0.7,
            {
              preferredProvider: 'perplexity',
              excludeProviders: ['openai'],
              model: optimalModel === 'sonar' ? 'sonar' : selectedModel,
              useLongContextModel: requiresLargeContextProvider,
              openAIModel: resolvedOpenAIModel
            }
          );

          let fullResponse = (aiResult?.content || '').replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '').trim();
          if (fullResponse && fullResponse.length >= 10) {
            let cleanedResponse = cleanAIResponse(fullResponse);
            let validResponse = validateAndCleanResponse(cleanedResponse, 30) || fullResponse;

            if (validResponse && validResponse.length >= 10) {
              await persistMemory(validResponse);
              const chunkSize = 400;
              for (let i = 0; i < validResponse.length; i += chunkSize) {
                const chunk = validResponse.slice(i, i + chunkSize);
                if (chunk.trim().length > 0) {
                  res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
                  if (typeof res.flush === 'function') {
                    res.flush();
                  }
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
        } catch (fallbackError) {
          console.error('OpenAI fallback failed:', fallbackError.message);
        }

        res.write(`data: ${JSON.stringify({ content: STREAMING_FALLBACK_MESSAGE, fallback: true })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
    } else {
    try {
      // Perplexity requires max_tokens, so use a high limit if undefined
      const perplexityMaxTokens = maxTokens || 40000;
      response = await axios.post('https://api.perplexity.ai/chat/completions', {
        model: optimalModel === 'sonar' ? 'sonar' : selectedModel,
        messages: messagesForAPI,
        max_tokens: perplexityMaxTokens,
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
        timeout: 520000
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
        
        console.error('Perplexity API 400 error:', errorText || apiError.message);
        console.error('API 400 Error Details:', {
          model: optimalModel === 'sonar' ? 'sonar' : selectedModel,
          maxTokens,
          messageLength: message.length,
          systemContentLength: finalSystemContent.length,
          messagesCount: messagesForAPI.length,
          hasPyqPrompt: !!pyqPrompt,
          errorMessage: errorText
        });
        
        if (errorText && (errorText.includes('system message') || errorText.includes('messages array'))) {
          errorMessage = 'Request format error. The system prompt may be too long. Please try a shorter question.';
        } else if (errorText && errorText.includes('user message')) {
          errorMessage = 'Invalid request format. Please try again.';
        }
      } else {
        console.error('Perplexity API error:', apiError.response?.status, apiError.message);
      }
      
      if (apiError.response?.status === 400 && !requiresLargeContextProvider) {
        console.log('Retrying with Perplexity fallback due to 400 error');
        try {
          const conversationMessagesForAI = messagesForAPI.filter(msg => msg.role !== 'system');
          const fallbackMaxTokens = maxTokens ? Math.min(maxTokens, 8000) : 16000;
          const aiResult = await callAIWithFallback(
            conversationMessagesForAI,
            finalSystemContent,
            fallbackMaxTokens,
            pyqPrompt ? 0.2 : 0.7,
            {
              preferredProvider: 'perplexity',
              model: optimalModel === 'sonar' ? 'sonar' : selectedModel,
                useLongContextModel: requiresLargeContextProvider,
                openAIModel: resolvedOpenAIModel
            }
          );
          
          let fullResponse = (aiResult?.content || '').replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '').trim();
          if (fullResponse && fullResponse.length >= 10) {
            let cleanedResponse = cleanAIResponse(fullResponse);
            let validResponse = validateAndCleanResponse(cleanedResponse, 30) || fullResponse;
            
            if (validResponse && validResponse.length >= 10) {
                await persistMemory(validResponse);
              const chunkSize = 400;
              for (let i = 0; i < validResponse.length; i += chunkSize) {
                const chunk = validResponse.slice(i, i + chunkSize);
                if (chunk.trim().length > 0) {
                  res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
                  if (typeof res.flush === 'function') {
                    res.flush();
                  }
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
        } catch (fallbackError) {
          console.error('Perplexity fallback also failed:', fallbackError.message);
        }
      }
      
      res.write(`data: ${JSON.stringify({
        content: STREAMING_FALLBACK_MESSAGE,
        fallback: true
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
      }
    }

    let fullResponse = '';
    let streamError = null;
    
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
              
              // Log if response is too short for debugging
              if (!fullResponse || fullResponse.trim().length < 10) {
                console.warn(`[Stream] Empty/short response received. Length: ${fullResponse?.length || 0}, Message: "${message?.substring(0, 50)}..."`);
                // Don't immediately use fallback - try to process what we have
              }

              let cleanedResponse = cleanAIResponse(fullResponse || '');
              // Use more lenient validation - allow shorter responses for simple questions
              const minLength = message && message.trim().length < 50 ? 15 : 30;
              let isValid = validateAndCleanResponse(cleanedResponse, minLength);
              
              // If validation failed but we have substantial content, try to salvage it
              if (!isValid && fullResponse && fullResponse.trim().length >= 20) {
                if (!isGarbledResponse(fullResponse)) {
                  cleanedResponse = fullResponse.trim();
                  cleanedResponse = cleanedResponse.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
                  cleanedResponse = cleanedResponse.replace(/From\s+result[^.!?\n]*/gi, '');
                  cleanedResponse = cleanedResponse.replace(/[ \t]+/g, ' ');
                  
                  if (!/[.!?]$/.test(cleanedResponse) && cleanedResponse.length > 20) {
                    cleanedResponse += '.';
                  }
                  
                  // Re-validate with lower threshold
                  isValid = validateAndCleanResponse(cleanedResponse, 15) || cleanedResponse;
                }
              }
              
              // Accept response if it's valid and meets minimum length
              const minAcceptableLength = message && message.trim().length < 50 ? 15 : 30;
              if (isValid && isValid.length >= minAcceptableLength) {
                responseCache.set(cacheKey, {
                  response: isValid,
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
              } else if (fullResponse && fullResponse.trim().length >= 20 && !isGarbledResponse(fullResponse)) {
                // Try to use response even if validation failed but it's substantial
                cleanedResponse = fullResponse.trim();
                cleanedResponse = cleanedResponse.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
                cleanedResponse = cleanedResponse.replace(/From\s+result[^.!?\n]*/gi, '');
                cleanedResponse = cleanedResponse.replace(/[ \t]+/g, ' ');
                if (!/[.!?]$/.test(cleanedResponse) && cleanedResponse.length > 20) {
                  cleanedResponse += '.';
                }
                // Use it if it's reasonable
                if (cleanedResponse.length >= 20) {
                  isValid = cleanedResponse;
                  responseCache.set(cacheKey, {
                    response: cleanedResponse,
                    timestamp: Date.now()
                  });
                }
              }
              
              // Only use fallback if we truly have nothing usable
              if (!isValid || isValid.length < 15) {
                console.error(`[Stream] Response too short or invalid. Length: ${fullResponse?.length || 0}, Valid: ${!!isValid}, Message: "${message?.substring(0, 50)}..."`);
                if (!res.writableEnded) {
                  res.write(`data: ${JSON.stringify({ content: STREAMING_FALLBACK_MESSAGE, fallback: true })}\n\n`);
                  res.write('data: [DONE]\n\n');
                  res.end();
                }
                resolve();
                return;
              }

              const finalMemoryText = isValid;
              if (finalMemoryText) {
                persistMemory(finalMemoryText).catch(err => {
                  console.warn('Failed to persist conversation memory (stream):', err.message);
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
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                let content = parsed.choices[0].delta.content;
                content = content.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
                content = content.replace(/\([A-Z][a-zA-Z\s]{3,}\):\s*(?![A-Z])/g, '');
                content = content.replace(/From\s+result\s*\([^)]*\)\s*[:.]?\s*/gi, '');
                content = content.replace(/From\s+result\s*[:.]?\s*/gi, '');
                content = content.replace(/From\s+result[^.!?]*/gi, '');
                content = content.replace(/\s*\([A-Z][a-zA-Z\s]{2,}\)\s*:\s*(?=\s*[a-z])/g, ' ');
                content = content.replace(/🌐\s*Translate\s+to[^\n]*/gi, '');
                content = content.replace(/\d{1,2}:\d{2}\s*(?:AM|PM)\s*/gi, '');
                content = content.replace(/👤|🎓|🌐/g, '');
                
                if (content.trim().length > 0) {
                  fullResponse += content;
                  if (!res.writableEnded) {
                    res.write(`data: ${JSON.stringify({ content })}\n\n`);
                    if (typeof res.flush === 'function') {
                      res.flush();
                    }
                  }
                }
              }
              if (parsed.error) {
                streamError = new Error(parsed.error.message || 'API error');
                throw streamError;
              }
            } catch (e) {
              if (e.message && !e.message.includes('JSON')) {
                console.error('[Stream] Parsing error:', e.message);
                streamError = e;
              }
            }
          }
        }
      });
      
      // Add error handler for stream
      response.data.on('error', (error) => {
        clearInterval(keepAlive);
        streamError = error;
        console.error('[Stream] Stream error:', error.message);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ content: STREAMING_FALLBACK_MESSAGE, fallback: true, error: error.message })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
        resolve();
      });

      response.data.on('end', () => {
        clearInterval(keepAlive);
        
        // Log if response is too short for debugging
        if (!fullResponse || fullResponse.trim().length < 10) {
          console.warn(`[Stream] Stream ended with empty/short response. Length: ${fullResponse?.length || 0}, Message: "${message?.substring(0, 50)}..."`);
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ content: STREAMING_FALLBACK_MESSAGE, fallback: true })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
          }
          resolve();
          return;
        }

        let cleanedResponse = cleanAIResponse(fullResponse);
        // Use more lenient validation - allow shorter responses for simple questions
        const minLength = message && message.trim().length < 50 ? 15 : 30;
        let isValid = validateAndCleanResponse(cleanedResponse, minLength);
        
        // If validation failed but we have substantial content, try to salvage it
        if (!isValid && fullResponse.trim().length >= 20) {
          if (!isGarbledResponse(fullResponse)) {
            cleanedResponse = fullResponse.trim();
            cleanedResponse = cleanedResponse.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
            cleanedResponse = cleanedResponse.replace(/\s+/g, ' ').trim();
            
            if (!/[.!?]$/.test(cleanedResponse) && cleanedResponse.length > 20) {
              cleanedResponse += '.';
            }
            
            // Re-validate with lower threshold
            isValid = validateAndCleanResponse(cleanedResponse, 15) || cleanedResponse;
          }
        }
        
        const minAcceptableLength = message && message.trim().length < 50 ? 15 : 30;
        if (isValid && isValid.length >= minAcceptableLength) {
          responseCache.set(cacheKey, {
            response: isValid,
            timestamp: Date.now()
          });
        } else if (fullResponse.trim().length >= 20 && !isGarbledResponse(fullResponse)) {
          // Try to use response even if validation failed but it's substantial
          cleanedResponse = fullResponse.trim();
          cleanedResponse = cleanedResponse.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
          cleanedResponse = cleanedResponse.replace(/\s+/g, ' ').trim();
          if (!/[.!?]$/.test(cleanedResponse) && cleanedResponse.length > 20) {
            cleanedResponse += '.';
          }
          // Use it if it's reasonable
          if (cleanedResponse.length >= 20) {
            isValid = cleanedResponse;
            responseCache.set(cacheKey, {
              response: cleanedResponse,
              timestamp: Date.now()
            });
          }
        }
        
        // If still no valid response, send fallback
        if (!isValid || isValid.length < 15) {
          console.error(`[Stream] Stream ended with invalid response. Length: ${fullResponse?.length || 0}, Valid: ${!!isValid}, Message: "${message?.substring(0, 50)}..."`);
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ content: STREAMING_FALLBACK_MESSAGE, fallback: true })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
          }
          resolve();
          return;
        }
        
        if (!res.writableEnded) {
          res.write('data: [DONE]\n\n');
          if (typeof res.flush === 'function') {
            res.flush();
          }
          res.end();
        }
        
        if (chatId && isValid && isValid.length > 50) {
          (async () => {
            try {
              await connectToDatabase();
              const chat = await Chat.findOne({ 
                _id: chatId, 
                userEmail: session.user.email 
              }).lean();
              
              if (chat && chat.messages && chat.messages.length > 0) {
                const conversationFacts = await extractConversationFacts(chat.messages, session.user.email);
                
                if (conversationFacts.facts && conversationFacts.facts.length > 0) {
                  const user = await User.findOne({ email: session.user.email });
                  if (user) {
                    const profile = user.profile || {};
                    if (!profile.facts) {
                      profile.facts = [];
                    }
                    conversationFacts.facts.forEach(fact => {
                      if (!fact || typeof fact !== 'string') return;
                      const normalizedFact = fact.toLowerCase().trim();
                      if (normalizedFact.length < 10) return;
                      const exists = profile.facts.some(f => {
                        if (!f || typeof f !== 'string') return false;
                        return f.toLowerCase().trim() === normalizedFact;
                      });
                      if (!exists) {
                        profile.facts.push(fact);
                      }
                    });
                    if (profile.facts.length > 20) {
                      profile.facts = profile.facts.slice(-20);
                    }
                    profile.lastUpdated = new Date();
                    user.profile = profile;
                    await user.save();
                  }
                }
              }
            } catch (err) {
              console.warn('Failed to extract conversation facts:', err.message);
            }
          })();
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
            ? `${providerName === 'openai' ? 'OpenAI' : 'Perplexity'} rejected the request. Please verify API keys and quotas.`
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


