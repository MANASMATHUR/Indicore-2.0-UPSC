import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { contextualLayer } from '@/lib/contextual-layer';
import examKnowledge from '@/lib/exam-knowledge';
import { findPresetAnswer } from '@/lib/presetAnswers';
import axios from 'axios';
import connectToDatabase from '@/lib/mongodb';
import Chat from '@/models/Chat';
import pyqService from '@/lib/pyqService';
import { cleanAIResponse, validateAndCleanResponse, isGarbledResponse } from '@/lib/responseCleaner';

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

// PYQ Pattern: More specific to avoid false positives with general questions
// Only matches when there's clear PYQ intent (explicit PYQ keywords or subject + pyq keywords)
const PYQ_PATTERN = /(pyq|pyqs|previous\s+year\s+(?:question|questions|paper|papers)|past\s+year\s+(?:question|questions)|search.*pyq|find.*pyq|(?:give|show|get|fetch|list|bring|tell|need|want)\s+(?:me\s+)?(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs|questions?|qs)|(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs))/i;

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
      
      // Extract text to translate (everything after "Translate" or the text after colon)
      let textToTranslate = message;
      const colonMatch = message.match(/translate[^:]*:\s*(.+)/i);
      if (colonMatch) {
        textToTranslate = colonMatch[1].trim();
      } else {
        // Remove translation instruction to get the text
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
          // Fall through to regular chat handling
        }
      }
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

    let finalSystemPrompt = systemPrompt || `You are Indicore, a helpful AI assistant. While you specialize in exam preparation for UPSC, PCS, and SSC exams, you can also answer general questions on any topic. Your role is to provide comprehensive, accurate, and well-structured responses.

CRITICAL REQUIREMENTS - RESPONSE QUALITY AND COMPLETENESS:
1. ALWAYS write complete, comprehensive answers. Never leave sentences incomplete or cut off mid-thought.
2. Write in full, well-formed sentences. Each sentence must have a subject, verb, and complete meaning.
3. Provide thorough, detailed responses that fully address the question asked with depth and clarity.
4. Use proper paragraph structure with clear topic sentences and supporting details.
5. Ensure your response has a logical flow: introduction, main content, and conclusion where appropriate.
6. Use bullet points only when listing multiple items. Otherwise, write in paragraph form.
7. Avoid markdown headers (###) or excessive bold text. Keep formatting simple and natural.
8. Never use placeholders, incomplete phrases, or cut-off words.
9. If discussing historical topics, provide complete information including time periods, locations, characteristics, and significance.
10. Always finish your response with a complete sentence. Never end with incomplete thoughts.
11. NEVER end responses with incomplete phrases like "and", "or", "but", "the", "a", "to", "from", "with", "for", "I can", "Let me", "Please note", etc.
12. Every sentence must be grammatically complete and meaningful. Do not leave any sentence hanging or incomplete.
13. If you need to stop, ensure you complete the current thought before ending. Never cut off mid-sentence.
14. Provide context and background information when relevant to help students understand the topic better.
15. Include examples, case studies, and real-world applications when appropriate to enhance understanding.

CONTENT REQUIREMENTS:
- For exam-related questions (UPSC/PCS/SSC): Focus on GS papers, Prelims, and Essay requirements. Include constitutional provisions, government schemes, and policies when relevant. Link topics to exam syllabus and previous year question patterns.
- For general questions: Provide comprehensive, accurate information on any topic asked. You can answer questions about weather, business, history, science, technology, or any other subject.
- Always provide context and background information when relevant
- Include examples, case studies, and real-world applications when appropriate

ACCURACY AND FACTUAL REQUIREMENTS:
- ONLY provide information you are certain about. If you are unsure about a fact, date, or detail, clearly state that you are uncertain.
- Do NOT make up facts, dates, names, or statistics. If you don't know something, say so rather than guessing.
- When discussing exam-related topics, be precise and accurate. Do not provide incorrect information.
- If asked about specific exam questions, papers, or dates, only provide information if you are confident it is correct.
- Never fabricate or hallucinate information. It is better to admit uncertainty than to provide incorrect information.
- When discussing current affairs, clearly distinguish between confirmed facts and general knowledge.
- For PYQ (Previous Year Questions), only reference actual questions from the database. Do not create or invent questions.

RESPONSE FORMATTING:
- Write in clear, natural language that is easy to understand
- Use proper grammar, punctuation, and sentence structure
- Organize information logically with clear transitions between ideas
- Break down complex topics into digestible sections
- Use examples to illustrate key points
- Ensure every paragraph has a clear purpose and contributes to answering the question

Write naturally and conversationally, but ensure every response is complete, accurate, and truthful. For exam-related questions, make them exam-focused. For general questions, provide comprehensive information on the topic. Do not include citations or reference numbers.`;

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
      
      // More strict check: must have PYQ keywords or clear PYQ intent
      const hasPyqKeyword = /(pyq|pyqs|previous\s+year|past\s+year)/i.test(effectiveMsg);
      const hasPyqIntent = /(?:give|show|get|fetch|list|bring|tell|need|want)\s+(?:me\s+)?(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs|questions?|qs)/i.test(effectiveMsg);
      const hasSubjectPyq = /(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs)/i.test(effectiveMsg);
      
      // Only try PYQ search if there's clear PYQ intent
      if (!hasPyqKeyword && !hasPyqIntent && !hasSubjectPyq) {
        return null;
      }
      
      return await pyqService.search(userMsg, context, language);
    }

    // Check for quick responses only for very specific exam-related queries
    // Don't block general questions - let them go through to LLM
    const quickResponse = contextualLayer.getQuickResponse(message);
    if (quickResponse && !quickResponse.requiresAI && contextOptimizer.shouldUseLLM(message) === false) {
      // Only use quick response if it's a simple query that doesn't need LLM
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

    // Check if this is a PYQ query - use more strict checking
    const hasPyqKeyword = /(pyq|pyqs|previous\s+year|past\s+year)/i.test(message);
    const hasPyqIntent = /(?:give|show|get|fetch|list|bring|tell|need|want)\s+(?:me\s+)?(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs|questions?|qs)/i.test(message);
    const hasSubjectPyq = /(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs)/i.test(message);
    const isPyqQuery = hasPyqKeyword || hasPyqIntent || hasSubjectPyq;
    
    // For general questions, always use LLM - don't restrict based on shouldUseLLM
    // Only skip context for very short messages or simple greetings
    const needsContext = !isPyqQuery && message.length > 10;

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
      // Clean PYQ response before sending
      const cleanedPyq = cleanAIResponse(pyqDb);
      const validPyq = validateAndCleanResponse(cleanedPyq, 20);
      
      if (validPyq) {
        const chunks = validPyq.match(/.{1,100}/g) || [validPyq];
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
      // If PYQ response is invalid, fall through to LLM
    }

    const contextualEnhancement = contextualData.contextualEnhancement;
    const examContext = contextualData.examContext;

    function extractPyqContextFromHistory(history) {
      if (!history || history.length === 0) return null;
      
      for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (msg.role === 'user' && msg.content) {
          const userMsg = msg.content;
          // Use same strict PYQ detection as above
          const hasPyqKeyword = /(pyq|pyqs|previous\s+year|past\s+year)/i.test(userMsg);
          const hasPyqIntent = /(?:give|show|get|fetch|list|bring|tell|need|want)\s+(?:me\s+)?(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs|questions?|qs)/i.test(userMsg);
          const hasSubjectPyq = /(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs)/i.test(userMsg);
          
          if (hasPyqKeyword || hasPyqIntent || hasSubjectPyq) {
            // Use pyqService to parse the query for consistent theme extraction
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
      // Use same strict PYQ detection
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
        // Use pyqService to parse the query for consistent theme extraction
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

COMPLETENESS REQUIREMENTS:
- Always end with a complete sentence or summary
- Never cut off mid-question or mid-sentence
- Ensure all questions are fully displayed
- Include all relevant information (year, paper, question text)
- Provide a clear summary at the end

Remember: Your goal is to present questions clearly and completely. If no questions are found, state that clearly. If questions are found, format them properly and ensure the response is complete and well-structured.`;
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
        // Clean PYQ response before sending
        const cleanedPyq = cleanAIResponse(pyqDb);
        const validPyq = validateAndCleanResponse(cleanedPyq, 20);
        
        if (validPyq) {
          const chunks = validPyq.match(/.{1,100}/g) || [validPyq];
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
        // If PYQ response is invalid, fall through to LLM
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
    if (previousPyqContext && isFollowUpQuestion && typeof previousPyqContext === 'object') {
      contextNote = `\nContext: ${previousPyqContext.theme || 'general'} (${previousPyqContext.fromYear || 'all'}-${previousPyqContext.toYear || 'present'}), ${previousPyqContext.examCode || ''}`;
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

    let response;
    try {
      response = await axios.post('https://api.perplexity.ai/chat/completions', {
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
    } catch (apiError) {
      console.error('Perplexity API error:', apiError.response?.status, apiError.response?.data || apiError.message);
      if (apiError.response?.status === 400) {
        console.error('API 400 Error Details:', {
          model: optimalModel === 'sonar' ? 'sonar' : selectedModel,
          maxTokens,
          messageLength: message.length,
          systemContentLength: systemContent.length,
          hasPyqPrompt: !!pyqPrompt
        });
      }
      res.write(`data: ${JSON.stringify({ error: 'API request failed. Please try again.', final: true })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

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
              
              // Validate that we have a meaningful response
              if (!fullResponse || fullResponse.trim().length < 10) {
                res.write(`data: ${JSON.stringify({ error: 'Empty response received. Please try again.', final: true })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
                resolve();
                return;
              }

              // Comprehensive cleaning of full response
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
              
              // Ensure we have a valid response before caching
              if (isValid && isValid.length > 30) {
                // Cache the cleaned response if valid
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
              } else {
                // Response is too short or garbled - send error
                res.write(`data: ${JSON.stringify({ error: 'Response validation failed. Please try rephrasing your question.', final: true })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
                resolve();
                return;
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
                // Comprehensive cleaning for streaming - remove citations and Perplexity patterns
                content = content.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '');
                // Remove Perplexity citation patterns during streaming (more comprehensive)
                content = content.replace(/\([A-Z][a-zA-Z\s]{3,}\):\s*(?![A-Z])/g, '');
                content = content.replace(/From\s+result\s*\([^)]*\)\s*[:.]?\s*/gi, '');
                content = content.replace(/From\s+result\s*[:.]?\s*/gi, '');
                content = content.replace(/From\s+result[^.!?]*/gi, '');
                // Remove broken citation patterns
                content = content.replace(/\s*\([A-Z][a-zA-Z\s]{2,}\)\s*:\s*(?=\s*[a-z])/g, ' ');
                // Remove UI elements
                content = content.replace(/🌐\s*Translate\s+to[^\n]*/gi, '');
                content = content.replace(/\d{1,2}:\d{2}\s*(?:AM|PM)\s*/gi, '');
                content = content.replace(/👤|🎓|🌐/g, '');
                
                // Skip empty or whitespace-only content
                if (content.trim().length > 0) {
                  fullResponse += content;
                  // Send content immediately for real-time streaming
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                  if (typeof res.flush === 'function') {
                    res.flush();
                  }
                }
              }
              // Handle error in response
              if (parsed.error) {
                throw new Error(parsed.error.message || 'API error');
              }
            } catch (e) {
              // Silently skip malformed JSON chunks
              if (e.message && !e.message.includes('JSON')) {
                console.error('Stream parsing error:', e.message);
              }
            }
          }
        }
      });

      response.data.on('end', () => {
        clearInterval(keepAlive);
        
        // Validate that we have a meaningful response
        if (!fullResponse || fullResponse.trim().length < 10) {
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ error: 'Empty response received. Please try again.', final: true })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
          }
          resolve();
          return;
        }

        // Clean and validate response before caching
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
        
        // Ensure we have a valid response
        if (isValid && isValid.length > 30) {
          responseCache.set(cacheKey, {
            response: isValid,
            timestamp: Date.now()
          });
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

