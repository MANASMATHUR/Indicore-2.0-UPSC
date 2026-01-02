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
import { cleanAIResponse, validateAndCleanResponse, isGarbledResponse, GARBLED_PATTERNS } from '@/lib/responseCleaner';
import { extractUserInfo, updateUserProfile, formatProfileContext, extractConversationFacts } from '@/lib/userProfileExtractor';
import { formatMemoriesForAI } from '@/lib/memoryService';
import { buildConversationMemoryPrompt, saveConversationMemory } from '@/lib/conversationMemory';
import { updateUserPersonalization, generatePersonalizedPrompt } from '@/lib/personalizationService';
import { getPyqContext, setPyqContext, clearPyqContext, getDisplayedQuestions, setDisplayedQuestions } from '@/lib/pyqContextCache';
import { callAIWithFallback } from '@/lib/ai-providers';
import intelligenceService from '@/lib/intelligenceService';
import { SystemPromptBuilder } from '@/lib/ai/prompts';

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

// More flexible PYQ detection - checks for PYQ keywords OR subject + question words anywhere in message
function isPyqQuery(message) {
  if (!message || typeof message !== 'string') return false;

  const lowerMsg = message.toLowerCase();

  // Check for explicit PYQ keywords
  const hasPyqKeyword = /(pyq|pyqs|previous\s+year|past\s+year)/i.test(message);
  if (hasPyqKeyword) return true;

  // Check for subject keywords (excluding "statistical" to avoid false positives on general statistics questions)
  // "statistical" is only matched in specific PYQ contexts below
  const subjectPattern = /(?:eco|geo|hist|pol|sci|tech|env|economics|economy|geography|history|polity|politics|science|technology|environment)/i;
  const hasSubject = subjectPattern.test(message);

  // Check for question-related words
  const questionPattern = /(?:questions?|qs|pyq|pyqs|question\s+paper|question\s+papers)/i;
  const hasQuestionWord = questionPattern.test(message);

  // If both subject and question words are present, it's likely a PYQ query
  if (hasSubject && hasQuestionWord) return true;

  // Check for patterns like "topic wise pyqs", "theme wise pyqs", "questions from", "questions of"
  // Include "statistical" only in specific PYQ contexts (e.g., "statistical questions from previous years")
  const flexiblePattern = /(?:topic\s+wise|theme\s+wise|subject\s+wise|questions?\s+(?:from|of|on|about|related\s+to))/i;
  if (flexiblePattern.test(message)) {
    // If it has "theme wise" or "topic wise" with PYQ/question words, it's definitely a PYQ query
    if (/(?:theme\s+wise|topic\s+wise|subject\s+wise)/i.test(message) && hasQuestionWord) return true;
    // Check for "statistical questions from/of/on" - this is a PYQ query
    if (/statistical\s+questions?\s+(?:from|of|on|about|related\s+to)/i.test(message)) return true;
    // Otherwise, require subject keyword
    if (hasSubject) return true;
  }

  // Check for "statistical" in combination with PYQ-specific terms
  if (/statistical.*(?:pyq|pyqs|previous\s+year|past\s+year|question\s+paper)/i.test(message)) return true;
  if (/(?:pyq|pyqs|previous\s+year|past\s+year|question\s+paper).*statistical/i.test(message)) return true;

  return false;
}

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
    let {
      message,
      chatId,
      model,
      systemPrompt,
      language,
      provider,
      openAIModel,
      pyqMetadata,
      simulationMode
    } = req.body;
    const STREAMING_FALLBACK_MESSAGE = "I couldn't generate a full answer this time, but I'm still here—please rephrase or ask again so I can try once more.";
    const pyqContextKey = `${session.user.email}:${chatId || 'stream'}`;
    const providerPreference = (provider || 'openai').toLowerCase();
    const normalizedOpenAIModel = typeof openAIModel === 'string' && openAIModel.trim().length > 0
      ? openAIModel.trim()
      : '';
    const resolvedOpenAIModel = normalizedOpenAIModel || process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o';
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

    const startTime = Date.now();
    const timings = {};

    if (global.rateLimitMap && global.rateLimitMap[rateLimitKey]) {
      const lastRequest = global.rateLimitMap[rateLimitKey];
      const timeSinceLast = Date.now() - lastRequest;
      if (timeSinceLast < 800) { // Slightly more lenient than 1000ms
        return res.status(429).json({
          error: `Wait ${Math.ceil((800 - timeSinceLast) / 100) / 10}s before next message.`,
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

      const chunks = cached.response.match(/[\s\S]{1,50}/g) || [cached.response];
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
            const chunks = translated.match(/[\s\S]{1,100}/g) || [translated];
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
    const initialMessageIsPyq = isPyqQuery(message);
    if (allowPresetAnswers && !initialMessageIsPyq) {
      const presetAnswer = findPresetAnswer(message);
      if (presetAnswer) {
        const cleanedPreset = cleanAIResponse(presetAnswer);
        const finalPreset = validateAndCleanResponse(cleanedPreset, 30) || cleanedPreset || presetAnswer;
        const chunks = finalPreset.match(/[\s\S]{1,100}/g) || [finalPreset];
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

    // Unified history fetching
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
            return { optimizedContext: [], fullHistory: allMessages };
          }

          let optimizedContext = [];
          if (allMessages.length > 12) {
            const summary = contextOptimizer.summarizeLongConversation(allMessages);
            const recent = allMessages.slice(-8);
            const relevant = contextOptimizer.selectRelevantContext(
              allMessages.slice(0, -8),
              message,
              12
            );

            if (summary) {
              optimizedContext = [
                { role: 'system', content: summary },
                ...relevant,
                ...recent
              ];
            } else {
              optimizedContext = contextOptimizer.selectRelevantContext(allMessages, message, 16);
            }
          } else {
            optimizedContext = contextOptimizer.selectRelevantContext(allMessages, message, 16);
          }

          return { optimizedContext, fullHistory: allMessages };
        }
      } catch (err) {
        console.warn('Failed to load conversation history:', err.message);
      }
      return { optimizedContext: [], fullHistory: [] };
    })() : Promise.resolve({ optimizedContext: [], fullHistory: [] });

    async function tryPyqFromDb(userMsg, context = null) {
      const fallbackMsg = context ? `PYQ on ${context.theme || 'history'} from ${context.fromYear || 2021} for ${context.examCode || 'UPSC'}` : userMsg;
      const effectiveMsg = context?.originalQuery || fallbackMsg;
      const contextPayload = context ? { ...context } : null;
      if (contextPayload && typeof contextPayload.offset !== 'number') {
        contextPayload.offset = contextPayload.offset || 0;
      }

      // Use flexible PYQ detection
      if (!context && !isPyqQuery(effectiveMsg)) {
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
            // Store displayable questions for "solve these" feature
            if (result.displayableQuestions && result.displayableQuestions.length > 0) {
              setDisplayedQuestions(pyqContextKey, result.displayableQuestions);
            }
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
      const chunks = responseText.match(/[\s\S]{1,100}/g) || [responseText];
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
    const historyData = await historyPromise;
    const rawHistoryForSolve = historyData.optimizedContext || [];
    const conversationHistoryForSolve = contextOptimizer.compressContext(rawHistoryForSolve);
    const fullConversationHistory = historyData.fullHistory || [];

    let ledgerPrompt = '';
    const conversationLedger = contextOptimizer.buildConversationLedger(fullConversationHistory, 50, 10);
    if (conversationLedger) {
      ledgerPrompt = `\n\nCONVERSATION LEDGER (chronological user prompts for recall):\n${conversationLedger}\nRefer to these prompt numbers whenever the user asks about earlier questions.`;
    }
    const cachedPyqContextForSolve = chatId ? getPyqContext(pyqContextKey) : null;
    // Use fullConversationHistory (uncompressed) to ensure PYQ keywords aren't lost from long queries
    const historyPyqContextForSolve = extractPyqContextFromHistory(fullConversationHistory);
    const previousPyqContextForSolve = cachedPyqContextForSolve || historyPyqContextForSolve;
    // Improved solve request detection function
    const isDirectQuestionToSolve = (msg) => {
      const trimmedMsg = msg.trim();

      // Pattern 1: Explicit "solve this" with metadata (even without colon)
      // Catches: "Please solve this UPSC | 2024 | Paper: GS Paper 1"
      if (/(?:please|kindly|can\s+you|could\s+you)?\s*(?:solve|answer|explain)\s+(?:this|the|following)\s+(?:upsc|pcs|ssc|previous\s+year|past\s+year|question|paper)/i.test(trimmedMsg)) {
        return true;
      }

      // Pattern 2: "solve/answer/explain this [metadata] question [with insights]: <actual question text>"
      // This catches embedded questions after colons, including our new enriched formatting.
      // Use [\s\S] to handle newlines between metadata and question text.
      if (/(?:please|kindly|can\s+you|could\s+you)?\s*(?:solve|answer|explain)\s+(?:this|the)[\s\S]*?(?:previous\s+year\s+)?question[\s\S]*?:\s*[\s\S]{10,}/i.test(trimmedMsg)) {
        return true;
      }

      // Pattern 3: Solve requests with previous context (for follow-up questions)
      if (previousPyqContextForSolve) {
        // Allow polite prefixes before solve commands
        const PYQ_SOLVE_REGEX_WITH_CONTEXT = /^(?:please|kindly|can\s+you|could\s+you)?\s*(?:solve|answer|explain|provide\s+(?:answers?|solutions?)|give\s+(?:answers?|solutions?)|how\s+to\s+(?:solve|answer)|what\s+(?:are|is)\s+the\s+(?:answers?|solutions?))(?:\s+(?:these|those|the|this|these\s+questions?|those\s+questions?|the\s+questions?|this\s+question|them|all\s+of\s+them|the\s+pyqs?|pyqs?|questions?|you\s+just\s+(?:gave|provided|showed|listed)))?$/i;
        if (PYQ_SOLVE_REGEX_WITH_CONTEXT.test(trimmedMsg)) {
          return true;
        }
      }

      return false;
    };

    const isSolveRequestEarly = isDirectQuestionToSolve(message) || pyqMetadata?.isPyqSolve === true;

    // SIMPLIFIED FIX: If it's a PYQ query, ALWAYS search the database first
    // Only treat as solve request if user explicitly says "solve" and message doesn't contain PYQ search terms
    const hasPyqSearchTerms = /(?:give|show|get|fetch|list|find|search|bring).*(?:pyq|question)/i.test(message) ||
      /(?:eco|geo|hist|pol|sci|tech|env|art|culture|modern|ancient|medieval|indian|world)\s*(?:pyqs?|questions?)/i.test(message) ||
      /pyqs?\s+(?:on|for|about|from|of|related)/i.test(message);

    // If message has PYQ search terms OR is a general PYQ query (and NOT explicitly asking to solve), run PYQ search
    const isPyqQueryResult = initialMessageIsPyq && (!isSolveRequestEarly || hasPyqSearchTerms);

    // Detect "solve these questions" pattern - user wants to solve previously shown PYQs
    const isSolveTheseRequest = /^(?:please\s+)?(?:solve|answer|explain|do)\s+(?:these|those|the|them|all)?\s*(?:questions?|pyqs?|that|you\s+(?:just\s+)?(?:gave|showed|listed|provided))?/i.test(message.trim());

    const needsContext = !isPyqQueryResult && message.length > 10;

    // Reuse the history we already fetched for solve detection
    const [contextualData, pyqDb] = await Promise.all([
      needsContext ? Promise.resolve({
        contextualEnhancement: contextualLayer.generateContextualPrompt(message),
        examContext: examKnowledge.generateContextualPrompt(message)
      }) : Promise.resolve({ contextualEnhancement: '', examContext: '' }),
      isPyqQueryResult ? tryPyqFromDb(message) : Promise.resolve(null),
    ]);
    const factStartTime = Date.now();
    const factDb = await intelligenceService.getRelevantFacts(message, 7); // Show 7 facts
    timings.factSearch = Date.now() - factStartTime;

    // Use the history we already processed
    const conversationHistory = conversationHistoryForSolve;
    const cachedPyqContext = cachedPyqContextForSolve;

    // Handle "solve these" request - retrieve and solve previously shown questions
    if (isSolveTheseRequest && pyqContextKey) {
      const displayedQuestions = getDisplayedQuestions(pyqContextKey);
      if (displayedQuestions && displayedQuestions.length > 0) {
        // Format questions for AI to solve
        const questionsToSolve = displayedQuestions.slice(0, 5); // Limit to 5 questions
        const questionsPrompt = questionsToSolve.map((q, i) => `${i + 1}. ${q.question} (${q.year})`).join('\n');
        const solvePrompt = `Please provide detailed, exam-oriented solutions for these UPSC Previous Year Questions:\n\n${questionsPrompt}\n\nFor each question, provide:\n1. Direct Answer (if MCQ)
2. Key Concepts
3. Brief Explanation
4. UPSC relevance`;

        // Override message to solve these questions
        const originalMessage = message;
        message = solvePrompt;
        // Mark this so it goes to AI, not PYQ search
        // Continue to AI processing below
      }
    }

    if (isPyqQueryResult) {
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
        const chunks = cleanedPyq.match(/[\s\S]{1,100}/g) || [cleanedPyq];
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
        const levelLine = parsed.level ? `**Level:** ${parsed.level}\n\n` : '';
        const noResultsMessage = `## Previous Year Questions (${parsed.examCode || 'UPSC'})\n\n${levelLine}**Topic:** ${parsed.theme || 'General'}\n\nNo questions were found in the database for the given criteria.\n\n### Suggestions:\n\n- Try a different topic or subject\n- Check if the spelling is correct\n- Try a broader search term\n- Use formats like "PYQ on economics" or "history pyqs"`;
        const chunks = noResultsMessage.match(/[\s\S]{1,100}/g) || [noResultsMessage];
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

          if (isPyqQuery(userMsg)) {
            const parsed = pyqService.parseQuery(userMsg, language);
            const theme = parsed.theme || '';
            const fromYear = parsed.fromYear;
            const toYear = parsed.toYear;
            const examCode = parsed.examCode || 'UPSC';
            const level = parsed.level || '';

            return { theme, fromYear, toYear, examCode, level, originalQuery: msg.content };
          }
        }
      }
      return null;
    }

    function buildPyqPrompt(userMsg, previousContext = null) {
      if (!previousContext) {
        if (!isPyqQuery(userMsg)) {
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
      const pyqStartTime = Date.now();
      const pyqDb = await tryPyqFromDb(followUpQuery, contextWithOffset);
      timings.pyqSearch = Date.now() - pyqStartTime;

      if (!pyqDb) {
        // Stop the stream and inform user no more questions are found
        const noMoreMsg = `No more questions found for **${previousPyqContext.theme || 'this topic'}** from **${previousPyqContext.fromYear || 'start'}** to **${previousPyqContext.toYear || 'present'}**. Try a different topic or year range.`;
        const chunks = noMoreMsg.match(/[\s\S]{1,100}/g) || [noMoreMsg];
        for (const chunk of chunks) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
          if (typeof res.flush === 'function') res.flush();
        }
        res.write('data: [DONE]\n\n');
        if (typeof res.flush === 'function') res.flush();
        res.end();
        return;
      }

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

        const chunks = cleanedPyq.match(/[\s\S]{1,100}/g) || [cleanedPyq];
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
        const chunks = noResultsMessage.match(/[\s\S]{1,100}/g) || [noResultsMessage];
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
    // BUT only if the user isn't providing the question text directly in the message
    let pyqContextForSolving = null;
    const messageHasDirectQuestion = message.includes(':') && message.split(':').slice(1).join(':').trim().length > 20;

    if (isSolveRequest && previousPyqContext && !messageHasDirectQuestion) {
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
        const chunks = errorMessage.match(/[\s\S]{1,100}/g) || [errorMessage];
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

    // Build final prompt using builder logic
    const pyqPrompt = !isSolveRequest ? buildPyqPrompt(message, previousPyqContext) : null;

    const subject = examKnowledge.detectSubjectFromQuery(message);

    // Assemble modular prompt
    const finalBuilder = new SystemPromptBuilder(language || 'en')
      .withExamFocus()
      .withSyllabusMapping(subject) // New: Automatic GS Paper mapping
      .withIndicoreBlueprint()     // New: Mandatory answer structure
      .withUserContext(formatProfileContext(userProfile))
      .withMemories(formatMemoriesForAI(userProfile?.memories || []))
      .withFacts(factDb || [])
      .withDirectiveAnalysis(message)
      .withSubjectKeywords(subject)
      .withDiagramSuggestions()
      .withMindMapSupport();

    if (simulationMode === 'ethics') {
      finalBuilder.withEthicsSimulation();
    }

    if (pyqMetadata) {
      finalBuilder.withPyqExpert(pyqMetadata);
      // Inject real questions for the drill if we have them
      if (pyqMetadata.questions) {
        finalBuilder.withRelatedPYQs(pyqMetadata.questions.slice(0, 3));
      }
    }

    if (isSolveRequest) {
      finalBuilder.withSolveContext(pyqContextForSolving);
    }

    // Base system content
    let systemContent = finalBuilder.build() + (ledgerPrompt || '');

    if (pyqPrompt) {
      systemContent += pyqPrompt;
    } else if (contextualEnhancement && needsContext) {
      systemContent += contextualEnhancement.substring(0, 500); // Increased slightly
    }

    let contextNote = '';
    if (previousPyqContext && isFollowUpQuestion && typeof previousPyqContext === 'object') {
      contextNote = `\nContext: ${previousPyqContext.theme || 'general'} (${previousPyqContext.fromYear || 'all'}-${previousPyqContext.toYear || 'present'}), ${previousPyqContext.examCode || ''}`;
    }

    // INCREASED TRUNCATION LIMIT (from 1400 to 4500)
    // This Prevents instruction loss while staying within model limits
    const maxSystemLength = 4500;
    let finalSystemContent = systemContent + contextNote;
    if (finalSystemContent.length > maxSystemLength) {
      finalSystemContent = finalSystemContent.substring(0, maxSystemLength - 100) + '... [Context limited]';
    }

    let userMessage = message;
    if (isSolveRequest) {
      if (pyqContextForSolving) {
        userMessage = `The user previously asked for PYQs and I provided the following questions:\n\n${pyqContextForSolving}\n\nNow the user is asking: "${message}"\n\nPlease provide comprehensive, well-structured answers/solutions to these questions. For each question:\n1. Provide a clear, detailed answer\n2. Explain key concepts and context\n3. Include relevant examples and current affairs connections\n4. Structure answers in exam-appropriate format (for Mains questions)\n5. Highlight important points that examiners look for\n6. Connect to broader syllabus topics where relevant`;
      } else if (messageHasDirectQuestion) {
        // Just use the message as is, but the system prompt will handle the solving instructions
        userMessage = message;
      }
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

      // Use dynamic validation based on question length
      const questionLength = message ? message.trim().length : 0;
      const minLength = questionLength <= 5 ? 5 : (questionLength < 20 ? 10 : (questionLength < 50 ? 15 : 30));
      const minFallbackLength = questionLength <= 5 ? 3 : (questionLength < 20 ? 5 : 10);

      let fullResponse = (aiResult?.content || '').replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '').trim();
      if (!fullResponse || fullResponse.length < minFallbackLength) {
        fullResponse = STREAMING_FALLBACK_MESSAGE;
      }

      let cleanedResponse = cleanAIResponse(fullResponse);
      let validResponse = validateAndCleanResponse(cleanedResponse, minLength) || fullResponse;
      if (!validResponse || validResponse.length < minFallbackLength) {
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

    // AI Model Selection & Preparation
    const streamTimeout = 120000; // 120s for better responsiveness

    let response;
    const providerName = useOpenAI ? 'openai' : 'perplexity';

    if (useOpenAI) {
      try {
        const aiStartTime = Date.now();
        console.log(`[Chat Stream] Initiating OpenAI ${resolvedOpenAIModel} stream...`);
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
          timeout: streamTimeout
        });
        timings.aiInitiation = Date.now() - aiStartTime;
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

          // Use dynamic validation based on question length
          const questionLength = message ? message.trim().length : 0;
          const minLength = questionLength <= 5 ? 5 : (questionLength < 20 ? 10 : (questionLength < 50 ? 15 : 30));
          const minFallbackLength = questionLength <= 5 ? 3 : (questionLength < 20 ? 5 : 10);

          let fullResponse = (aiResult?.content || '').replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '').trim();
          if (fullResponse && fullResponse.length >= minFallbackLength) {
            let cleanedResponse = cleanAIResponse(fullResponse);
            let validResponse = validateAndCleanResponse(cleanedResponse, minLength) || fullResponse;

            if (validResponse && validResponse.length >= minFallbackLength) {
              await persistMemory(validResponse);
              if (factDb && factDb.length > 0) {
                res.write(`data: ${JSON.stringify({ truthAnchored: true })}\n\n`);
              }
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
        const aiStartTime = Date.now();
        console.log(`[Chat Stream] Initiating Perplexity stream...`);
        // Perplexity requires max_tokens, so use a high limit if undefined
        const perplexityMaxTokens = maxTokens || 4000; // Reduced from 40k to 4k for safety
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
          timeout: streamTimeout
        });
        timings.aiInitiation = Date.now() - aiStartTime;
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

            // Use dynamic validation based on question length
            const questionLength = message ? message.trim().length : 0;
            const minLength = questionLength <= 5 ? 5 : (questionLength < 20 ? 10 : (questionLength < 50 ? 15 : 30));
            const minFallbackLength = questionLength <= 5 ? 3 : (questionLength < 20 ? 5 : 10);

            let fullResponse = (aiResult?.content || '').replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '').trim();
            if (fullResponse && fullResponse.length >= minFallbackLength) {
              let cleanedResponse = cleanAIResponse(fullResponse);
              let validResponse = validateAndCleanResponse(cleanedResponse, minLength) || fullResponse;

              if (validResponse && validResponse.length >= minFallbackLength) {
                await persistMemory(validResponse);
                if (factDb && factDb.length > 0) {
                  res.write(`data: ${JSON.stringify({ truthAnchored: true })}\n\n`);
                }
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

      // Send truth-anchoring metadata if relevant
      if (factDb && factDb.length > 0 && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({ truthAnchored: true })}\n\n`);
      }

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
              // Use very lenient validation - allow shorter responses for simple questions
              // For very short questions (like "who is akbar" or "hi"), accept even shorter responses
              const questionLength = message ? message.trim().length : 0;
              // For very short prompts (1-5 chars like "hi"), accept responses as short as 5 chars
              const minLength = questionLength <= 5 ? 5 : (questionLength < 20 ? 10 : (questionLength < 50 ? 15 : 30));
              let isValid = validateAndCleanResponse(cleanedResponse, minLength);

              // If validation failed but we have any content, try to salvage it
              // For very short prompts, be extremely lenient
              const minSalvageLength = questionLength <= 5 ? 5 : (questionLength < 20 ? 10 : 15);
              if (!isValid && fullResponse && fullResponse.trim().length >= minSalvageLength) {
                if (!isGarbledResponse(fullResponse)) {
                  cleanedResponse = fullResponse.trim();
                  cleanedResponse = cleanedResponse.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
                  cleanedResponse = cleanedResponse.replace(/From\s+result[^.!?\n]*/gi, '');
                  cleanedResponse = cleanedResponse.replace(/[ \t]+/g, ' ');

                  if (!/[.!?]$/.test(cleanedResponse) && cleanedResponse.length > minSalvageLength) {
                    cleanedResponse += '.';
                  }

                  // Re-validate with very low threshold for short questions
                  isValid = validateAndCleanResponse(cleanedResponse, minSalvageLength) || cleanedResponse;
                }
              }

              // Accept response if it's valid and meets minimum length (very lenient for short questions)
              // For very short prompts like "hi", accept responses as short as 5 chars
              const minAcceptableLength = questionLength <= 5 ? 5 : (questionLength < 20 ? 10 : (questionLength < 50 ? 15 : 30));

              // If validation returned null but we have content, try to use it anyway if it's reasonable
              if (!isValid && fullResponse && fullResponse.trim().length >= minSalvageLength) {
                // Try one more time with even more lenient validation
                const veryLenientCleaned = fullResponse.trim().replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '').replace(/\s+/g, ' ').trim();
                if (veryLenientCleaned.length >= minSalvageLength && !isGarbledResponse(veryLenientCleaned)) {
                  isValid = veryLenientCleaned;
                }
              }

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
              } else if (fullResponse && fullResponse.trim().length >= minSalvageLength && !isGarbledResponse(fullResponse)) {
                // Try to use response even if validation failed but it has some content
                cleanedResponse = fullResponse.trim();
                cleanedResponse = cleanedResponse.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
                cleanedResponse = cleanedResponse.replace(/From\s+result[^.!?\n]*/gi, '');
                cleanedResponse = cleanedResponse.replace(/[ \t]+/g, ' ');
                if (!/[.!?]$/.test(cleanedResponse) && cleanedResponse.length > minSalvageLength) {
                  cleanedResponse += '.';
                }
                // Use it if it's reasonable (very lenient for short questions)
                const minUseLength = questionLength <= 5 ? 5 : (questionLength < 20 ? 10 : 20);
                if (cleanedResponse.length >= minUseLength) {
                  isValid = cleanedResponse;
                  responseCache.set(cacheKey, {
                    response: cleanedResponse,
                    timestamp: Date.now()
                  });
                }
              }

              // Only use fallback if we truly have nothing usable (very lenient threshold)
              // For very short prompts like "hi", accept responses as short as 5 chars
              const minFallbackLength = questionLength <= 5 ? 5 : (questionLength < 20 ? 10 : 15);
              if (!isValid || isValid.length < minFallbackLength) {
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

                // Update user personalization based on this interaction
                updateUserPersonalization(session.user.email, message, finalMemoryText, chatId)
                  .catch(err => {
                    console.warn('Failed to update user personalization:', err.message);
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
                if (content.length > 0) {
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

        // Calculate question length and thresholds first
        const questionLength = message ? message.trim().length : 0;
        const minLength = questionLength <= 5 ? 5 : (questionLength < 20 ? 10 : (questionLength < 50 ? 15 : 30));
        const minSalvageLength = questionLength <= 5 ? 5 : (questionLength < 20 ? 10 : 15);
        const minFallbackLength = questionLength <= 5 ? 3 : (questionLength < 20 ? 5 : 10); // Even more lenient

        // Log if response is too short for debugging, but don't immediately reject
        if (!fullResponse || fullResponse.trim().length < minFallbackLength) {
          console.warn(`[Stream] Stream ended with empty/short response. Length: ${fullResponse?.length || 0}, Message: "${message?.substring(0, 50)}..."`);
          // Only send fallback if we truly have nothing
          if (!fullResponse || fullResponse.trim().length === 0) {
            if (!res.writableEnded) {
              res.write(`data: ${JSON.stringify({ content: STREAMING_FALLBACK_MESSAGE, fallback: true })}\n\n`);
              res.write('data: [DONE]\n\n');
              res.end();
            }
            resolve();
            return;
          }
          // If we have some content, continue to validation
        }

        let cleanedResponse = cleanAIResponse(fullResponse || '');
        let isValid = validateAndCleanResponse(cleanedResponse, minLength);

        // If validation failed but we have any content, try to salvage it
        // For very short prompts, be extremely lenient
        // Check for garbled patterns specifically, not isGarbledResponse() which includes length checks
        if (!isValid && fullResponse && fullResponse.trim().length >= minSalvageLength) {
          const hasGarbledPatterns = GARBLED_PATTERNS.some(pattern => pattern.test(fullResponse));
          if (!hasGarbledPatterns) {
            cleanedResponse = fullResponse.trim();
            cleanedResponse = cleanedResponse.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
            cleanedResponse = cleanedResponse.replace(/From\s+result[^.!?\n]*/gi, '');
            cleanedResponse = cleanedResponse.replace(/\s+/g, ' ').trim();

            if (!/[.!?]$/.test(cleanedResponse) && cleanedResponse.length > minSalvageLength) {
              cleanedResponse += '.';
            }

            // Re-validate with very low threshold for short questions
            isValid = validateAndCleanResponse(cleanedResponse, minSalvageLength) || cleanedResponse;
          }
        }

        // If still not valid, try one more aggressive salvage attempt
        // Note: fullResponse could be < minFallbackLength here (from line 1376), so check length first
        if (!isValid && fullResponse && fullResponse.trim().length > 0) {
          const veryLenientCleaned = fullResponse.trim()
            .replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '')
            .replace(/From\s+result[^.!?\n]*/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

          // Check for garbled patterns specifically, not isGarbledResponse() which includes length checks
          const hasGarbledPatterns = GARBLED_PATTERNS.some(pattern => pattern.test(veryLenientCleaned));
          if (veryLenientCleaned.length >= minFallbackLength && !hasGarbledPatterns) {
            // Add punctuation if missing
            const finalCleaned = !/[.!?]$/.test(veryLenientCleaned) && veryLenientCleaned.length > minFallbackLength
              ? veryLenientCleaned + '.'
              : veryLenientCleaned;

            // Accept if it meets minimum length and isn't garbled
            if (finalCleaned.length >= minFallbackLength) {
              isValid = finalCleaned;
            }
          }
        }

        const minAcceptableLength = questionLength <= 5 ? 5 : (questionLength < 20 ? 10 : (questionLength < 50 ? 15 : 30));
        if (isValid && isValid.length >= minAcceptableLength) {
          responseCache.set(cacheKey, {
            response: isValid,
            timestamp: Date.now()
          });
        } else if (fullResponse && fullResponse.trim().length >= minSalvageLength) {
          const hasGarbledPatterns = GARBLED_PATTERNS.some(pattern => pattern.test(fullResponse));
          if (!hasGarbledPatterns) {
            // Try to use response even if validation failed but it has some content
            cleanedResponse = fullResponse.trim();
            cleanedResponse = cleanedResponse.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
            cleanedResponse = cleanedResponse.replace(/\s+/g, ' ').trim();
            if (!/[.!?]$/.test(cleanedResponse) && cleanedResponse.length > minSalvageLength) {
              cleanedResponse += '.';
            }

            if (/[A-Za-zÀ-ÖØ-öø-ÿ0-9]/.test(cleanedResponse)) {
              const minUseLength = questionLength <= 5 ? 5 : (questionLength < 20 ? 10 : 20);
              const fallbackValidated = validateAndCleanResponse(cleanedResponse, minUseLength);
              if (fallbackValidated) {
                isValid = fallbackValidated;
                responseCache.set(cacheKey, {
                  response: fallbackValidated,
                  timestamp: Date.now()
                });
              }
            }
          }
        }

        // If still no valid response, send fallback (very lenient threshold)
        // For very short prompts like "hi", accept responses as short as 3-5 chars
        if (!isValid || isValid.length < minFallbackLength) {
          console.error(`[Stream] Stream ended with invalid response. Length: ${fullResponse?.length || 0}, Valid: ${!!isValid}, ValidLength: ${isValid?.length || 0}, Message: "${message?.substring(0, 50)}..."`);
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


