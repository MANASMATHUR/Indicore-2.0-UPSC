import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { withCache } from '@/lib/cache';
import { contextualLayer } from '@/lib/contextual-layer';
import examKnowledge from '@/lib/exam-knowledge';
import { findPresetAnswer } from '@/lib/presetAnswers';
import { callAIWithFallback } from '@/lib/ai-providers';
import connectToDatabase from '@/lib/mongodb';
import Chat from '@/models/Chat';
import User from '@/models/User';
import pyqService from '@/lib/pyqService';
import { cleanAIResponse, validateAndCleanResponse, isGarbledResponse, GARBLED_PATTERNS } from '@/lib/responseCleaner';
import { extractUserInfo, updateUserProfile, formatProfileContext, detectSaveWorthyInfo, isSaveConfirmation } from '@/lib/userProfileExtractor';
import { buildConversationMemoryPrompt, saveConversationMemory } from '@/lib/conversationMemory';
import { updateUserPersonalization, generatePersonalizedPrompt } from '@/lib/personalizationService';
import { getPyqContext, setPyqContext, clearPyqContext } from '@/lib/pyqContextCache';

const PYQ_PATTERN = /(pyq|pyqs|previous\s+year\s+(?:question|questions|paper|papers)|past\s+year\s+(?:question|questions)|search.*pyq|find.*pyq|(?:give|show|get|fetch|list|bring|tell|need|want)\s+(?:me\s+)?(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs|questions?|qs)|(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs))/i;

// More flexible PYQ detection - checks for PYQ keywords OR subject + question words anywhere in message
function isPyqQuery(message) {
  if (!message || typeof message !== 'string') return false;

  const lowerMsg = message.toLowerCase();

  // EXCLUSION: Ignore memory saving, flashcard, or explicit context setting
  // This prevents "save this flashcard" from triggering PYQ search due to words like "question" and "technology"
  if (/(?:save|store|remember|keep).*(?:flashcard|memory|note|this)/i.test(message)) return false;
  if (/here\s+is\s+a\s+question/i.test(message)) return false;

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

const responseCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function estimateTokenLength(messages) {
  if (!Array.isArray(messages)) return 0;
  const totalChars = messages.reduce((sum, msg) => {
    if (!msg || !msg.content) return sum;
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return sum + content.length;
  }, 0);
  return Math.ceil(totalChars / 4);
}

function validateChatRequest(req) {
  const { message, model, systemPrompt, language } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('Message is required and must be a non-empty string');
  }

  if (message.length > 10000) {
    throw new Error('Message too long: maximum 10,000 characters allowed');
  }

  if (message.length < 1) {
    throw new Error('Message too short: minimum 1 character required');
  }

  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /Function\s*\(/gi
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(message)) {
      throw new Error('Potentially malicious content detected');
    }
  }

  const supportedLanguages = ['en', 'hi', 'mr', 'ta', 'bn', 'pa', 'gu', 'te', 'ml', 'kn', 'es'];
  if (language && !supportedLanguages.includes(language)) {
    throw new Error('Unsupported language');
  }

  const supportedModels = ['sonar-pro', 'sonar', 'sonar-reasoning', 'sonar-reasoning-pro', 'sonar-deep-research'];
  if (model && !supportedModels.includes(model)) {
    throw new Error('Unsupported model');
  }

  return {
    message: message.trim(),
    model: model || 'sonar-pro',
    systemPrompt: systemPrompt || '',
    language: language || 'en'
  };
}

function formatAnalysisResponse(analysisData) {
  let response = `## 📊 PYQ Analysis\n\n`;
  response += `**Question:** ${analysisData.question}\n\n`;

  if (analysisData.topicTags && analysisData.topicTags.length > 0) {
    response += `**Topic Tags:** ${analysisData.topicTags.join(', ')}\n\n`;
  }

  if (analysisData.keywords && analysisData.keywords.length > 0) {
    response += `**Important Keywords:** ${analysisData.keywords.join(', ')}\n\n`;
  }

  if (analysisData.analysis) {
    response += `**In-depth Analysis:**\n${analysisData.analysis}\n\n`;
  }

  if (analysisData.similarQuestions && analysisData.similarQuestions.length > 0) {
    response += `**Similar Questions:**\n`;
    analysisData.similarQuestions.forEach((q, idx) => {
      response += `${idx + 1}. [${q.year}] ${q.question} (${q.exam})\n`;
    });
  }

  return response;
}

function calculateMaxTokens(message, queryType = 'general', useOpenAI = false) {
  // For OpenAI: No token limit - let the model use its full context window (ChatGPT-like behavior)
  if (useOpenAI) {
    return undefined; // undefined means no limit - model uses full context window
  }

  // For other providers: Use higher limits for long conversations
  const msgLen = message.length;
  const wordCount = message.split(/\s+/).length;

  const isComplex = wordCount > 20 || /explain|describe|analyze|compare|discuss|elaborate/i.test(message);
  const isList = /list|enumerate|name|give.*examples/i.test(message);
  const isShort = /what is|who is|when|where|define/i.test(message);

  let base = 1500;

  if (isShort) {
    base = 8000;
  } else if (isList) {
    base = 16000;
  } else if (isComplex) {
    base = 32000;
  } else {
    base = Math.min(40000, Math.max(8000, msgLen * 10));
  }

  if (queryType === 'pyq') {
    base = Math.max(base, 40000);
  }

  return base; // Higher limits for other providers
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

const PYQ_FOLLOW_UP_REGEX = /^(?:more|another|additional|next|other|different|continue|keep going|show more|give me more|list more|fetch more|next set|next one|next ones)\b/i;
const PYQ_FOLLOW_UP_COMMAND_REGEX = /(?:give|show|get|fetch|list|bring)\s+(?:me\s+)?(?:some\s+)?more\b/i;
// Detect requests to solve/answer questions from previous PYQ context
// Match patterns like "solve them", "solve these", "answer these questions", etc.
// Also match standalone "solve" or "answer" when there's PYQ context (user likely referring to previous questions)
const PYQ_SOLVE_REGEX = /^(?:solve|answer|explain|provide\s+(?:answers?|solutions?)|give\s+(?:answers?|solutions?)|how\s+to\s+(?:solve|answer)|what\s+(?:are|is)\s+the\s+(?:answers?|solutions?))(?:\s+(?:these|those|the|these\s+questions?|those\s+questions?|the\s+questions?|them|all\s+of\s+them|the\s+pyqs?|pyqs?|questions?|you\s+just\s+(?:gave|provided|showed|listed)))?$/i;

function isPyqFollowUpMessage(message) {
  const normalized = message.trim().toLowerCase();
  return PYQ_FOLLOW_UP_REGEX.test(normalized) || PYQ_FOLLOW_UP_COMMAND_REGEX.test(normalized);
}

function isPyqSolveRequest(message) {
  const normalized = message.trim().toLowerCase();
  return PYQ_SOLVE_REGEX.test(normalized);
}

function extractPyqContextFromHistory(history, language) {
  if (!history || history.length === 0) return null;

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'user' && msg.content) {
      const userMsg = msg.content;
      if (isPyqQuery(userMsg)) {
        const parsed = pyqService.parseQuery(userMsg, language);
        return {
          theme: parsed.theme || '',
          fromYear: parsed.fromYear,
          toYear: parsed.toYear,
          examCode: parsed.examCode || 'UPSC',
          level: parsed.level || '',
          originalQuery: userMsg
        };
      }
    }
  }
  return null;
}

async function chatHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');

  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED'
    });
  }

  try {
    const { message, model, systemPrompt, language } = validateChatRequest(req);
    const { inputType, enableCaching = true, quickResponses = true, chatId } = req.body;
    const providerPreference = (req.body?.provider || 'openai').toLowerCase();
    const openAIModel = typeof req.body?.openAIModel === 'string' ? req.body.openAIModel.trim() : '';

    if (typeof message !== 'string' || message.length === 0) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    const unsafePatterns = [
      /leak|cheat|fraud|scam/i,
      /specific.*exam.*answer/i,
      /current.*year.*question/i,
      /confidential.*paper/i,
      /unauthorized.*material/i,
      /exam.*paper.*solution/i,
      /answer.*key.*leak/i
    ];

    if (unsafePatterns.some(pattern => pattern.test(message))) {
      return res.status(400).json({
        error: 'Request contains potentially unsafe content. Please focus on general exam preparation topics.',
        code: 'UNSAFE_CONTENT'
      });
    }

    if (inputType === 'textOnly') {
      return res.status(200).json({
        response: null,
        timestamp: new Date().toISOString()
      });
    }

    const cacheKey = `${message.trim()}-${language || 'en'}-${model || 'sonar-pro'}-${providerPreference}-${openAIModel || 'gpt-4o'}`;
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.status(200).json({
        response: cached.response,
        source: 'cache',
        timestamp: new Date().toISOString()
      });
    }

    const allowPresetAnswers = process.env.ENABLE_PRESET_ANSWERS !== 'false';
    const initialMessageIsPyq = isPyqQuery(message);
    if (allowPresetAnswers && !initialMessageIsPyq) {
      const presetAnswer = findPresetAnswer(message);
      if (presetAnswer) {
        const cleanedPreset = cleanAIResponse(presetAnswer);
        const finalPreset = validateAndCleanResponse(cleanedPreset, 30) || cleanedPreset || presetAnswer;
        return res.status(200).json({
          response: finalPreset,
          source: 'preset',
          timestamp: new Date().toISOString()
        });
      }
    }

    if (quickResponses) {
      const quickResponse = contextualLayer.getQuickResponse(message);
      if (quickResponse) {
        return res.status(200).json({
          ...quickResponse,
          timestamp: new Date().toISOString()
        });
      }
    }

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
        const userDoc = await User.findOne({ email: session.user.email });
        if (userDoc) {
          const updatedProfile = updateUserProfile(userDoc, extractedInfo);
          userDoc.profile = updatedProfile;
          await userDoc.save();
          userProfile = updatedProfile;
        }
      } catch (err) {
        console.warn('Failed to update user profile:', err.message);
      }
    }

    const saveWorthyInfo = detectSaveWorthyInfo(message);

    let conversationHistory = [];
    if (chatId) {
      try {
        await connectToDatabase();
        const chat = await Chat.findOne({
          _id: chatId,
          userEmail: session.user.email
        })
          .select('messages.sender messages.text messages.timestamp')
          .lean();

        if (chat && chat.messages && Array.isArray(chat.messages)) {
          // Use a large window of recent messages so short follow-ups like
          // "was he good?" still have plenty of context to resolve pronouns.
          const recentMessages = chat.messages.slice(-60);
          conversationHistory = recentMessages
            .filter(msg =>
              msg.sender &&
              msg.text &&
              msg.text.trim().length > 0 &&
              msg.text.trim() !== message.trim()
            )
            .map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.text
            }));
        }
      } catch (err) {
        console.warn('Failed to load conversation history:', err.message);
      }
    }

    const pyqContextKey = `${session.user.email}:${chatId || 'default'}`;
    const cachedPyqContext = chatId ? getPyqContext(pyqContextKey) : null;
    const historyPyqContext = extractPyqContextFromHistory(conversationHistory, language);
    const previousPyqContext = cachedPyqContext || historyPyqContext;
    const isPyqFollowUp = previousPyqContext && isPyqFollowUpMessage(message);

    let finalSystemPrompt = systemPrompt || `You are Indicore, your intelligent exam preparation companion—think of me as ChatGPT, but specialized for UPSC, PCS, and SSC exam preparation. I'm here to help you succeed, whether you need explanations, practice questions, answer writing guidance, or just someone to discuss exam topics with.

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

EXAMPLES - MANDATORY REQUIREMENT:
- ALWAYS include multiple relevant examples in every response (minimum 2-3 examples per topic)
- Use diverse examples: PYQ references, case studies, current affairs, historical events, government schemes, real-world applications
- Examples must be exam-relevant: connect to UPSC/PCS/SSC syllabus, PYQ patterns, and answer writing requirements
- Include examples from different contexts: national, international, historical, contemporary, regional (for PCS)
- For conceptual topics, provide both theoretical and practical examples
- For policy topics, include implementation examples, success stories, and challenges
- For historical topics, include chronological examples with dates and significance
- Examples should be specific, verifiable, and directly relevant to the question asked
- When explaining concepts, use analogies and real-world examples to enhance understanding

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
- Reference actual PYQs when relevant: Mention specific year and paper when discussing topics that have appeared in exams
- Connect to syllabus: Always relate topics to specific GS papers (GS-1, GS-2, GS-3, GS-4) or Prelims/Mains context
- Provide answer writing frameworks: For Mains topics, include how to structure answers, what examiners look for
- Include interconnections: Show how topics connect across subjects and papers (e.g., how a policy relates to GS-2 and GS-3)

BROAD SEARCH SCOPE & COMPREHENSIVE COVERAGE:
- Cast a wide net: Consider multiple perspectives, contexts, and dimensions of every topic
- Cover all relevant aspects: Don't just answer the direct question—address related concepts, background, implications, and applications
- Include interdisciplinary connections: Show how topics relate across subjects (e.g., how environmental policies connect to economics, geography, and governance)
- Provide comprehensive context: Include historical background, current status, future implications, and global comparisons where relevant
- Consider multiple exam perspectives: Address how topics appear in Prelims vs Mains, different GS papers, and various exam formats
- Include comparative analysis: When relevant, compare Indian context with international examples, historical vs contemporary, different states/regions
- Cover depth and breadth: Provide both detailed explanations and broader overviews to give complete understanding

Write like you're having a natural conversation with a knowledgeable friend who happens to be an exam prep expert. Be helpful, be real, be engaging. Make every interaction feel valuable and personal. Always prioritize exam relevance and factual accuracy.`;

    // Add user profile context to system prompt
    const profileContext = userProfile ? formatProfileContext(userProfile) : '';
    if (profileContext) {
      finalSystemPrompt += `\n\nUSER CONTEXT (Remember this across all conversations):\n${profileContext}\n\nIMPORTANT: Use this user context to provide personalized responses. If the user asks about "my exam" or "prep me for exam", refer to their specific exam details from the context above. Ask follow-up questions if needed to clarify which exam they're referring to (e.g., "Are you referring to your ${userProfile.targetExam || 'exam'}?" or reference specific facts from their profile). Always remember user-specific information like exam names, subjects, dates, and preferences mentioned in previous conversations.`;
    }

    // Add personalized prompt based on user's behavior and preferences
    const personalizedPrompt = userProfile ? generatePersonalizedPrompt(userProfile) : '';
    if (personalizedPrompt) {
      finalSystemPrompt += personalizedPrompt;
    }

    const memoryPrompt = buildConversationMemoryPrompt(userProfile?.conversationSummaries);
    if (memoryPrompt) {
      finalSystemPrompt += `\n\nRECENT CONVERSATIONS WITH THIS USER:\n${memoryPrompt}\nUse this continuity to avoid repeating earlier explanations unless the user asks again.`;
    }

    // Add instruction for memory saving prompts
    if (saveWorthyInfo && !isSaveConfirmation(message)) {
      finalSystemPrompt += `\n\nMEMORY SAVING INSTRUCTION:\nThe user just mentioned: "${saveWorthyInfo.value}". This seems like important information that should be remembered. At the END of your response, add a friendly follow-up question asking if they want to save this to memory. Use this exact format: "[Your main response]\n\n💾 I noticed you mentioned "${saveWorthyInfo.value}". Would you like me to save this to your memory so I can remember it in future conversations?"`;
    }

    // If user confirmed saving, add instruction to acknowledge and save
    if (isSaveConfirmation(message)) {
      finalSystemPrompt += `\n\nMEMORY SAVING CONFIRMATION:\nThe user just confirmed they want to save information to memory. Acknowledge this at the start of your response with something like "Got it! I've saved that to your memory." Then proceed with your normal response.`;
    }

    // Detect PYQ analysis requests
    const analyzeMatch = message.match(/analyze\s+(?:pyq|question|this\s+question|that\s+question)\s*(?:number\s*)?(\d+)?/i);
    if (analyzeMatch) {
      try {
        const questionNumber = analyzeMatch[1] ? parseInt(analyzeMatch[1], 10) : null;
        const questionText = message.replace(/analyze\s+(?:pyq|question|this\s+question|that\s+question)\s*(?:number\s*)?\d*/i, '').trim();

        // If question text is provided, analyze it directly
        if (questionText && questionText.length > 20) {
          const response = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/pyq/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionText })
          });

          if (response.ok) {
            const analysisData = await response.json();
            return res.status(200).json({
              response: formatAnalysisResponse(analysisData),
              source: 'pyq-analysis',
              timestamp: new Date().toISOString()
            });
          }
        }

        // Return helpful message
        return res.status(200).json({
          response: `To analyze a PYQ question:\n\n1. First search for PYQs (e.g., "PYQ on history")\n2. Then say "analyze question [number]" or provide the question text\n\nAlternatively, paste the question text and say "analyze this question"`,
          source: 'system',
          timestamp: new Date().toISOString()
        });
      } catch (analysisError) {
        console.warn('PYQ analysis request failed:', analysisError.message);
        // Fall through to regular chat
      }
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
            return res.status(200).json({
              response: translated,
              source: 'translation',
              timestamp: new Date().toISOString()
            });
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

    const needsContext = !initialMessageIsPyq;
    const contextualEnhancement = needsContext ? contextualLayer.generateContextualPrompt(message) : '';
    const examContext = needsContext ? examKnowledge.generateContextualPrompt(message) : '';

    // Generate answer framework prompt
    const answerFrameworkPrompt = examKnowledge.generateAnswerFrameworkPrompt(message);

    // Try to get relevant PYQ context (not full PYQ list, but context about similar questions)
    let pyqContextPrompt = '';
    if (!initialMessageIsPyq) {
      const subject = examKnowledge.detectSubjectFromQuery(message);
      if (subject) {
        pyqContextPrompt = `\n\nPYQ CONTEXT:\nWhen relevant, mention that similar questions have been asked in previous UPSC exams. Reference PYQ patterns to show exam relevance.`;
      }
    }

    function buildPyqPrompt(userMsg) {
      if (!isPyqQuery(userMsg)) return '';

      const parsed = pyqService.parseQuery(userMsg, language);
      const theme = parsed.theme || '';
      const fromYear = parsed.fromYear;
      const toYear = parsed.toYear;
      const examCodeDetected = parsed.examCode || 'UPSC';

      const yearLine = fromYear ? `Limit to ${fromYear}-${toYear}.` : 'Cover all available years.';

      return `\n\nPYQ LISTING MODE:\nYou are providing Previous Year Questions (PYQ) from the database. Return only a well-formatted, complete list with no explanations or extra commentary.

CRITICAL REQUIREMENTS:
1. Write complete, well-formed sentences and lists. Never leave responses incomplete.
2. Use simple, clean formatting without markdown headers (##, ###) or excessive bold text.
3. Ensure all questions are properly formatted and complete.
4. Group questions logically by year.
5. After listing questions, mention that users can request detailed analysis with "analyze PYQ [question number]" or "analyze this question".

Format:
1. Start with: "Previous Year Questions (${examCodeDetected})"
2. Topic: "Topic: ${theme}" (if provided)
3. Year Range: "Year Range: ${fromYear || 'All'} to ${toYear || 'Present'}" (if provided)
4. Group by year: "Year {YEAR} ({count} questions)"
5. Question format: "{number}. [{Paper}] {Question Text}"
6. Status: ✅ for verified, ⚠️ for unverified
7. Summary: "Summary" with total count
8. Add note: "💡 Tip: Request detailed analysis for any question by saying 'analyze PYQ [number]' or 'analyze this question'"

Requirements:
- Group by year (newest first)
- Include paper name if known
- Keep questions under 200 chars
- Mark uncertain as "(unverified)" or ⚠️
- Filter by theme if provided: ${theme || 'none'}
- ${yearLine}
- Exam: ${examCodeDetected}
- Prioritize verified questions
- Use plain text formatting only
- Ensure response is complete and properly formatted
- Mention analysis feature at the end`;
    }
    function detectExamCode(userMsg, lang) {
      if (/tnpsc|tamil nadu psc/i.test(userMsg) || lang === 'ta') return 'TNPSC';
      if (/mpsc|maharashtra psc/i.test(userMsg) || lang === 'mr') return 'MPSC';
      if (/bpsc|bihar psc/i.test(userMsg)) return 'BPSC';
      if (/uppsc|uttar pradesh psc/i.test(userMsg)) return 'UPPSC';
      if (/mppsc|madhya pradesh psc/i.test(userMsg)) return 'MPPSC';
      if (/ras|rajasthan psc/i.test(userMsg)) return 'RAS';
      if (/rpsc|rajasthan psc/i.test(userMsg)) return 'RPSC';
      if (/gpsc|gujarat psc/i.test(userMsg) || lang === 'gu') return 'GPSC';
      if (/(karnataka\s*psc|kpsc)\b/i.test(userMsg) || (lang === 'kn' && /karnataka/i.test(userMsg))) return 'KPSC';
      if (/wbpsc|west bengal psc/i.test(userMsg) || /wb psc/i.test(userMsg) || lang === 'bn') return 'WBPSC';
      if (/ppsc|punjab psc/i.test(userMsg) || lang === 'pa') return 'PPSC';
      if (/opsc|odisha psc/i.test(userMsg)) return 'OPSC';
      if (/apsc|assam psc/i.test(userMsg)) return 'APSC';
      if (/appsc|andhra pradesh psc/i.test(userMsg)) return 'APPSC';
      if (/tspsc|telangana psc/i.test(userMsg) || lang === 'te') return 'TSPSC';
      if (/(kerala\s*psc)/i.test(userMsg) || lang === 'ml') return 'Kerala PSC';
      if (/hpsc|haryana psc/i.test(userMsg)) return 'HPSC';
      if (/jkpsc|j&k psc|jammu.*kashmir.*psc/i.test(userMsg)) return 'JKPSC';
      if (/gpsc goa|goa psc/i.test(userMsg)) return 'Goa PSC';
      if (/upsc/i.test(userMsg)) return 'UPSC';
      if (/pcs/i.test(userMsg)) return 'PCS';
      return 'UPSC';
    }

    async function tryPyqFromDb(userMsg, overrideContext = null) {
      const effectiveMessage = overrideContext?.originalQuery || userMsg;
      const contextPayload = overrideContext ? { ...overrideContext } : null;
      if (contextPayload && typeof contextPayload.offset !== 'number') {
        contextPayload.offset = contextPayload.offset || 0;
      }

      // Use flexible PYQ detection
      if (!overrideContext && !isPyqQuery(effectiveMessage)) {
        return null;
      }

      try {
        const searchResult = await pyqService.search(effectiveMessage, contextPayload, language);
        if (searchResult?.content) {
          if (chatId) {
            setPyqContext(pyqContextKey, {
              ...searchResult.context,
              originalQuery: searchResult.context.originalQuery || effectiveMessage
            });
          }
          return searchResult.content;
        }

        if (overrideContext && chatId) {
          clearPyqContext(pyqContextKey);
        }
      } catch (error) {
        console.error('PYQ search error:', error.message);
      }
      return null;
    }
    // Check if user wants to solve questions from previous PYQ context
    // This must be checked BEFORE regular PYQ queries to avoid treating "solve the pyqs" as a new query
    const isSolveRequest = previousPyqContext && isPyqSolveRequest(message);

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
        return res.status(200).json({
          response: 'I apologize, but I couldn\'t retrieve the questions you asked about earlier. Please ask for the questions again, or provide the specific questions you\'d like me to solve.',
          source: 'error'
        });
      }
    }

    // Only check for new PYQ queries if this is NOT a solve request
    // This prevents "solve the pyqs you just gave me" from being treated as a new PYQ search
    const pyqDb = !isSolveRequest ? await tryPyqFromDb(message, isPyqFollowUp ? previousPyqContext : null) : null;
    if (pyqDb) {
      // For PYQ responses, minimal cleaning to preserve formatting structure
      // Only remove obvious artifacts, preserve all newlines and structure
      let cleanedPyq = pyqDb;
      // Remove citation patterns and UI artifacts but preserve structure
      cleanedPyq = cleanedPyq.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
      cleanedPyq = cleanedPyq.replace(/From\s+result[^.!?\n]*/gi, '');
      cleanedPyq = cleanedPyq.replace(/\([A-Z][a-zA-Z\s]{3,}\):\s*(?=\s*[a-z])/g, '');
      cleanedPyq = cleanedPyq.replace(/🌐\s*Translate\s+to[^\n]*/gi, '');
      cleanedPyq = cleanedPyq.replace(/\d{1,2}:\d{2}\s*(?:AM|PM)\s*/gi, '');
      // Normalize excessive blank lines (4+ to 2) - consistent with chat-stream.js
      cleanedPyq = cleanedPyq.replace(/\n{4,}/g, '\n\n');

      // Validate length but don't use cleanAIResponse which might strip newlines
      if (cleanedPyq && cleanedPyq.trim().length >= 20) {
        return res.status(200).json({ response: cleanedPyq.trim(), source: 'pyq-db' });
      }
    }

    const contextOptimizer = (await import('@/lib/context-optimizer')).default;

    if (!contextOptimizer.shouldUseLLM(message)) {
      const quickResponse = contextualLayer.getQuickResponse(message);
      if (quickResponse && !quickResponse.requiresAI) {
        return res.status(200).json({
          response: quickResponse.response || quickResponse.quickResponse,
          source: 'quick-response',
          timestamp: new Date().toISOString()
        });
      }
    }

    const pyqPrompt = buildPyqPrompt(message);
    const hasContext = contextualEnhancement || examContext || answerFrameworkPrompt;
    const optimizedPrompt = contextOptimizer.optimizeSystemPrompt(finalSystemPrompt, !!hasContext, false);

    let enhancedSystemPrompt = optimizedPrompt;

    if (answerFrameworkPrompt) {
      enhancedSystemPrompt += answerFrameworkPrompt;
    }

    if (pyqContextPrompt && !pyqPrompt) {
      enhancedSystemPrompt += pyqContextPrompt;
    }

    if (pyqPrompt) {
      enhancedSystemPrompt += pyqPrompt;
    } else if (contextualEnhancement && needsContext) {
      enhancedSystemPrompt += contextualEnhancement.substring(0, 300);
    }

    // Truncate system prompt if too long (Perplexity has limits)
    const maxSystemLength = 1400;
    finalSystemPrompt = enhancedSystemPrompt;
    if (finalSystemPrompt.length > maxSystemLength) {
      finalSystemPrompt = finalSystemPrompt.substring(0, maxSystemLength - 100) + '...';
    }

    const optimalModel = contextOptimizer.selectOptimalModel(message, !!hasContext);

    const estimatedPromptTokens = estimateTokenLength(messagesForAPI);
    const requiresLargeContextProvider = estimatedPromptTokens >= 16000;

    const openAIKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
    const useOpenAI = (requiresLargeContextProvider || providerPreference === 'openai') && !!openAIKey;

    // Calculate token budget: undefined for OpenAI (unlimited), higher limits for others
    const calculatedTokens = calculateMaxTokens(message, pyqPrompt ? 'pyq' : 'general', useOpenAI);
    const maxTokens = useOpenAI
      ? undefined // OpenAI: no limit - uses full context window
      : (calculatedTokens || 40000); // Other providers: use calculated or default high limit

    // Ensure proper message array structure
    const messagesForAPI = [];
    if (finalSystemPrompt && finalSystemPrompt.trim().length > 0) {
      messagesForAPI.push({ role: 'system', content: finalSystemPrompt });
    }

    // Add conversation history before the current message
    if (conversationHistory.length > 0) {
      // If we have many messages, keep the most recent ones
      if (conversationHistory.length > 10) {
        // Keep last 8 messages for better context
        const recentMessages = conversationHistory.slice(-8);
        messagesForAPI.push(...recentMessages);
      } else {
        messagesForAPI.push(...conversationHistory);
      }
    }

    // If solving questions, add PYQ context to the user message
    // Note: pyqContextForSolving is guaranteed to be non-null here because we return early if it's null
    let userMessage = message;
    if (isSolveRequest) {
      userMessage = `The user previously asked for PYQs and I provided the following questions:\n\n${pyqContextForSolving}\n\nNow the user is asking: "${message}"\n\nPlease provide comprehensive, well-structured answers/solutions to these questions. For each question:\n1. Provide a clear, detailed answer\n2. Explain key concepts and context\n3. Include relevant examples and current affairs connections\n4. Structure answers in exam-appropriate format (for Mains questions)\n5. Highlight important points that examiners look for\n6. Connect to broader syllabus topics where relevant`;
    }

    // Ensure message is valid before adding
    if (!userMessage || userMessage.trim().length === 0) {
      return res.status(400).json({
        error: 'Message cannot be empty',
        code: 'INVALID_MESSAGE',
        timestamp: new Date().toISOString()
      });
    }

    messagesForAPI.push({ role: 'user', content: userMessage.trim() });

    // Final validation: ensure we have at least one user message
    if (messagesForAPI.filter(m => m.role === 'user').length === 0) {
      return res.status(400).json({
        error: 'Invalid message format',
        code: 'INVALID_MESSAGE_FORMAT',
        timestamp: new Date().toISOString()
      });
    }

    const conversationMessages = messagesForAPI.filter(msg => msg.role !== 'system');

    const effectiveProvider = useOpenAI ? 'openai' : providerPreference;

    const providerOptions = {
      preferredProvider: effectiveProvider,
      model: optimalModel === 'sonar' ? 'sonar' : (model || 'sonar-pro'),
      useLongContextModel: !useOpenAI && requiresLargeContextProvider,
      openAIModel: openAIModel || undefined
    };

    if (requiresLargeContextProvider && !useOpenAI) {
      providerOptions.excludeProviders = ['perplexity'];
    } else if (useOpenAI) {
      providerOptions.excludeProviders = ['perplexity'];
    }

    const aiResult = await callAIWithFallback(
      conversationMessages,
      finalSystemPrompt,
      maxTokens,
      pyqPrompt ? 0.2 : 0.7,
      providerOptions
    );

    const rawResponse = aiResult?.content;

    if (!rawResponse || rawResponse.trim().length === 0) {
      console.error(`[Chat] Empty response from AI provider. Message: "${message?.substring(0, 50)}..."`);
      throw new Error('Empty response from AI provider');
    }

    const cleanedResponse = cleanAIResponse(rawResponse);
    // Use very lenient validation - allow shorter responses for simple questions
    const questionLength = message ? message.trim().length : 0;
    // For very short prompts (1-5 chars like "hi"), accept responses as short as 5 chars
    const minLength = questionLength <= 5 ? 5 : (questionLength < 20 ? 10 : (questionLength < 50 ? 15 : 30));
    let validResponse = validateAndCleanResponse(cleanedResponse, minLength);

    // If validation failed but we have any content, try to salvage it
    // For very short prompts, be extremely lenient
    const minSalvageLength = questionLength <= 5 ? 5 : (questionLength < 20 ? 10 : 15);
    if (!validResponse && rawResponse.trim().length >= minSalvageLength) {
      // Check for garbled patterns specifically, not isGarbledResponse() which includes length checks
      const hasGarbledPatterns = GARBLED_PATTERNS.some(pattern => pattern.test(rawResponse));
      if (!hasGarbledPatterns) {
        let salvaged = rawResponse.trim();
        salvaged = salvaged.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
        salvaged = salvaged.replace(/From\s+result[^.!?\n]*/gi, '');
        salvaged = salvaged.replace(/[ \t]+/g, ' ');

        if (!/[.!?]$/.test(salvaged) && salvaged.length > minSalvageLength) {
          salvaged += '.';
        }

        // Re-validate with very low threshold for short questions
        validResponse = validateAndCleanResponse(salvaged, minSalvageLength) || salvaged;
      }
    }

    // If still not valid, try one more aggressive salvage attempt
    if (!validResponse && rawResponse && rawResponse.trim().length >= minSalvageLength) {
      const veryLenientCleaned = rawResponse.trim()
        .replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '')
        .replace(/From\s+result[^.!?\n]*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      const hasGarbledPatterns = GARBLED_PATTERNS.some(pattern => pattern.test(veryLenientCleaned));
      if (!hasGarbledPatterns && /[A-Za-zÀ-ÖØ-öø-ÿ0-9]/.test(veryLenientCleaned)) {
        // Add punctuation if missing
        const finalCleaned = !/[.!?]$/.test(veryLenientCleaned) && veryLenientCleaned.length > minSalvageLength
          ? veryLenientCleaned + '.'
          : veryLenientCleaned;

        const revalidated = validateAndCleanResponse(finalCleaned, minSalvageLength);
        if (revalidated) {
          validResponse = revalidated;
        }
      }
    }

    // Use even more lenient fallback threshold (matching chat-stream.js)
    const minFallbackLength = questionLength <= 5 ? 3 : (questionLength < 20 ? 5 : 10);
    if (!validResponse || validResponse.length < minFallbackLength) {
      console.error(`[Chat] Invalid response. Length: ${rawResponse?.length || 0}, Valid: ${!!validResponse}, ValidLength: ${validResponse?.length || 0}, Message: "${message?.substring(0, 50)}..."`);
      return res.status(500).json({
        error: 'Unable to generate a valid response. Please try rephrasing your question.',
        code: 'INVALID_RESPONSE',
        timestamp: new Date().toISOString()
      });
    }

    await saveConversationMemory({
      userEmail: session.user.email,
      chatId: chatId ? String(chatId) : undefined,
      userMessage: message,
      assistantResponse: validResponse
    });

    // Update user personalization based on this interaction
    updateUserPersonalization(session.user.email, message, validResponse, chatId)
      .catch(err => {
        console.warn('Failed to update user personalization:', err.message);
      });

    // If user confirmed saving, save the information to profile
    // Check conversation history for previous save prompt
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

    return res.status(200).json({
      response: validResponse,
      savePrompt: saveWorthyInfo ? saveWorthyInfo.description : null,
      saveWorthyInfo: saveWorthyInfo ? { type: saveWorthyInfo.type, value: saveWorthyInfo.value } : null
    });

  } catch (error) {
    console.error('Chat API Error:', error);

    if (error.message.includes('malicious') || error.message.includes('unsupported') || error.message.includes('required')) {
      return res.status(400).json({
        error: error.message,
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    const normalizedMessage = error.message?.toLowerCase() || '';
    if (normalizedMessage.includes('rate limit')) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait a moment and try again.',
        code: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString()
      });
    }
    if (normalizedMessage.includes('api key') || normalizedMessage.includes('unauthorized')) {
      return res.status(401).json({
        error: 'AI provider rejected the request. Please verify API keys and quotas.',
        code: 'API_CREDITS_EXHAUSTED',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }
}

export default withCache(chatHandler);

