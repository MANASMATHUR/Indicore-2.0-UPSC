import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { withCache } from '@/lib/cache';
import { contextualLayer } from '@/lib/contextual-layer';
import examKnowledge from '@/lib/exam-knowledge';
import { findPresetAnswer } from '@/lib/presetAnswers';
import axios from 'axios';
import connectToDatabase from '@/lib/mongodb';
import Chat from '@/models/Chat';
import User from '@/models/User';
import pyqService from '@/lib/pyqService';
import { cleanAIResponse, validateAndCleanResponse } from '@/lib/responseCleaner';
import { extractUserInfo, updateUserProfile, formatProfileContext, detectSaveWorthyInfo, isSaveConfirmation } from '@/lib/userProfileExtractor';
import { getPyqContext, setPyqContext, clearPyqContext } from '@/lib/pyqContextCache';

const PYQ_PATTERN = /(pyq|pyqs|previous\s+year\s+(?:question|questions|paper|papers)|past\s+year\s+(?:question|questions)|search.*pyq|find.*pyq|(?:give|show|get|fetch|list|bring|tell|need|want)\s+(?:me\s+)?(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs|questions?|qs)|(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs))/i;

const responseCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

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
  
  // Increased max tokens to 20000 to prevent cutoffs for complex/long responses
  return Math.min(base, 20000);
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

function isPyqFollowUpMessage(message) {
  const normalized = message.trim().toLowerCase();
  return PYQ_FOLLOW_UP_REGEX.test(normalized) || PYQ_FOLLOW_UP_COMMAND_REGEX.test(normalized);
}

function extractPyqContextFromHistory(history, language) {
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
        return {
          theme: parsed.theme || '',
          fromYear: parsed.fromYear,
          toYear: parsed.toYear,
          examCode: parsed.examCode || 'UPSC',
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

  if (!process.env.PERPLEXITY_API_KEY) {
    console.error('PERPLEXITY_API_KEY is not configured');
    return res.status(500).json({ 
      error: 'AI service configuration error. Please contact support.',
    });
  }
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

    const cacheKey = `${message.trim()}-${language || 'en'}-${model || 'sonar-pro'}`;
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.status(200).json({
        response: cached.response,
        source: 'cache',
        timestamp: new Date().toISOString()
      });
    }

    const presetAnswer = findPresetAnswer(message);
    if (presetAnswer) {
      return res.status(200).json({
        response: presetAnswer,
        source: 'preset',
        timestamp: new Date().toISOString()
      });
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
          const recentMessages = chat.messages.slice(-15);
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

    let finalSystemPrompt = systemPrompt || `You are Indicore, an exam preparation assistant for UPSC, PCS, and SSC exams. 

CRITICAL REQUIREMENTS - RESPONSE COMPLETENESS:
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
11. NEVER end responses with incomplete phrases like "and", "or", "but", "the", "a", "to", "from", "with", "for", "I can", "Let me", "Please note", etc.
12. Every sentence must be grammatically complete and meaningful. Do not leave any sentence hanging or incomplete.
13. If you need to stop, ensure you complete the current thought before ending. Never cut off mid-sentence.

ANSWER FRAMEWORK INTEGRATION:
- ALWAYS follow the provided answer framework structure (Introduction → Main Body → Conclusion)
- When an answer framework is provided, strictly adhere to its structure and components
- When discussing topics that have appeared in previous year questions, reference PYQ patterns to show exam relevance
- Use PYQ context to show how similar questions have been framed in actual exams
- Balance theoretical knowledge with practical exam-oriented insights

ACCURACY AND FACTUAL REQUIREMENTS:
- ONLY provide information you are certain about. If you are unsure about a fact, date, or detail, clearly state that you are uncertain.
- Do NOT make up facts, dates, names, or statistics. If you don't know something, say so rather than guessing.
- When discussing exam-related topics, be precise and accurate. Do not provide incorrect information.
- If asked about specific exam questions, papers, or dates, only provide information if you are confident it is correct.
- Never fabricate or hallucinate information. It is better to admit uncertainty than to provide incorrect information.
- When discussing current affairs, clearly distinguish between confirmed facts and general knowledge.
- For PYQ (Previous Year Questions), only reference actual questions from the database. Do not create or invent questions.

PRESENTATION & FORMATTING GUIDELINES:
- Use Markdown naturally: short paragraphs separated by a blank line, clear section headers (bold or "## Heading"), and bullet/numbered lists for steps or points.
- Never dump everything into one block of text. Each idea or subheading must have its own paragraph or list entry.
- When giving lists, prefer numbered lists for sequences/steps and bullet lists for unordered points.
- Highlight key terms with bold (e.g., **Keyword:** explanation) to improve scanability, but avoid over-formatting.
- Ensure tables or structured data are formatted cleanly with Markdown or plain text columns.
- Always end with a concise summary or actionable next steps when relevant.

Write naturally and conversationally, but ensure every response is complete, accurate, and follows the structured framework. Integrate PYQ context seamlessly to enhance the answer's value for exam preparation. Do not include citations or reference numbers.`;

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
      finalSystemPrompt += ` Your response MUST be entirely in ${langName}. Do not use any other language. Ensure perfect grammar and natural flow in ${langName}.`;
    }

    const needsContext = !/(pyq|previous year)/i.test(message);
    const contextualEnhancement = needsContext ? contextualLayer.generateContextualPrompt(message) : '';
    const examContext = needsContext ? examKnowledge.generateContextualPrompt(message) : '';
    
    // Generate answer framework prompt
    const answerFrameworkPrompt = examKnowledge.generateAnswerFrameworkPrompt(message);
    
    // Try to get relevant PYQ context (not full PYQ list, but context about similar questions)
    let pyqContextPrompt = '';
    if (!/(pyq|previous year|past year)/i.test(message)) {
      const subject = examKnowledge.detectSubjectFromQuery(message);
      if (subject) {
        pyqContextPrompt = `\n\nPYQ CONTEXT:\nWhen relevant, mention that similar questions have been asked in previous UPSC exams. Reference PYQ patterns to show exam relevance.`;
      }
    }
    
    function buildPyqPrompt(userMsg) {
      const pyqMatch = /(pyq|previous year (?:question|questions|paper|papers)|past year (?:question|questions))/i.test(userMsg);
      if (!pyqMatch) return '';

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
      
      const hasPyqKeyword = /(pyq|pyqs|previous\s+year|past\s+year)/i.test(effectiveMessage);
      const hasPyqIntent = /(?:give|show|get|fetch|list|bring|tell|need|want)\s+(?:me\s+)?(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs|questions?|qs)/i.test(effectiveMessage);
      const hasSubjectPyq = /(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs)/i.test(effectiveMessage);
      
      if (!overrideContext && !hasPyqKeyword && !hasPyqIntent && !hasSubjectPyq) {
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
    const pyqDb = await tryPyqFromDb(message, isPyqFollowUp ? previousPyqContext : null);
    if (pyqDb) {
      const cleanedPyq = cleanAIResponse(pyqDb);
      const validPyq = validateAndCleanResponse(cleanedPyq, 20);
      
      if (validPyq) {
        return res.status(200).json({ response: validPyq, source: 'pyq-db' });
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
    const maxSystemLength = 2000;
    finalSystemPrompt = enhancedSystemPrompt;
    if (finalSystemPrompt.length > maxSystemLength) {
      finalSystemPrompt = finalSystemPrompt.substring(0, maxSystemLength - 100) + '...';
    }

    const optimalModel = contextOptimizer.selectOptimalModel(message, !!hasContext);
    // Increased token limits to prevent mid-response cutoffs
    // Allow up to 20000 tokens for complex queries, minimum 2000 for any response
    const calculatedTokens = calculateMaxTokens(message, pyqPrompt ? 'pyq' : 'general');
    const maxTokens = Math.max(
      Math.min(calculatedTokens, 20000), // Cap at 20000, but use calculated value if lower
      pyqPrompt ? 4000 : 2000 // Minimum tokens: 4000 for PYQ, 2000 for general
    );

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
    
    // Ensure message is valid before adding
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Message cannot be empty',
        code: 'INVALID_MESSAGE',
        timestamp: new Date().toISOString()
      });
    }
    
    messagesForAPI.push({ role: 'user', content: message.trim() });

    // Final validation: ensure we have at least one user message
    if (messagesForAPI.filter(m => m.role === 'user').length === 0) {
      return res.status(400).json({ 
        error: 'Invalid message format',
        code: 'INVALID_MESSAGE_FORMAT',
        timestamp: new Date().toISOString()
      });
    }

    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: optimalModel === 'sonar' ? 'sonar' : (model || 'sonar-pro'),
      messages: messagesForAPI,
      max_tokens: maxTokens,
      temperature: pyqPrompt ? 0.2 : 0.7,
      top_p: 0.9,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 520000 // Allow up to ~520 seconds for very long responses
    });

    if (response && response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
      const rawResponse = response.data.choices[0].message.content;
      
      const cleanedResponse = cleanAIResponse(rawResponse);
      const validResponse = validateAndCleanResponse(cleanedResponse, 30);
      
      if (!validResponse) {
        return res.status(500).json({
          error: 'Unable to generate a valid response. Please try rephrasing your question.',
          code: 'INVALID_RESPONSE',
          timestamp: new Date().toISOString()
        });
      }

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
    } else {
      throw new Error('Invalid response format from Perplexity API');
    }

  } catch (error) {
    console.error('Chat API Error:', error);

    if (error.message.includes('malicious') || error.message.includes('unsupported') || error.message.includes('required')) {
      return res.status(400).json({ 
        error: error.message,
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    if (error.response) {
      const status = error.response.status;
      let errorMessage = 'An error occurred while processing your request.';
      let errorCode = 'API_ERROR';

      if (status === 401) {
        errorMessage = 'API credits exhausted or invalid API key. Please check your Perplexity API key and add credits if needed.';
        errorCode = 'API_CREDITS_EXHAUSTED';
      } else if (status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        errorCode = 'RATE_LIMIT_EXCEEDED';
      } else if (status === 402) {
        errorMessage = 'Insufficient API credits. Please add credits to your Perplexity account to continue using this feature.';
        errorCode = 'API_CREDITS_EXHAUSTED';
      } else if (status === 403) {
        errorMessage = 'Access denied. Please verify your API key permissions.';
        errorCode = 'ACCESS_DENIED';
      }

      return res.status(status).json({ 
        error: errorMessage,
        code: errorCode,
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

