import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { withCache } from '@/lib/cache';
import { contextualLayer } from '@/lib/contextual-layer';
import examKnowledge from '@/lib/exam-knowledge';
import { findPresetAnswer } from '@/lib/presetAnswers';
import axios from 'axios';
import connectToDatabase from '@/lib/mongodb';
import Chat from '@/models/Chat';
import pyqService from '@/lib/pyqService';
import { cleanAIResponse, validateAndCleanResponse } from '@/lib/responseCleaner';

// PYQ Pattern: More specific to avoid false positives with general questions
// Only matches when there's clear PYQ intent (explicit PYQ keywords or subject + pyq keywords)
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
    const { inputType, enableCaching = true, quickResponses = true } = req.body;

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

Write naturally and conversationally, but ensure every response is complete, accurate, and follows the structured framework. Integrate PYQ context seamlessly to enhance the answer's value for exam preparation. Do not include citations or reference numbers.`;

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

    const needsContext = !/(pyq|previous year)/i.test(message) && message.length > 30;
    const contextualEnhancement = needsContext ? contextualLayer.generateContextualPrompt(message) : '';
    const examContext = needsContext ? examKnowledge.generateContextualPrompt(message) : '';
    
    // Generate answer framework prompt
    const answerFrameworkPrompt = examKnowledge.generateAnswerFrameworkPrompt(message);
    
    // Try to get relevant PYQ context (not full PYQ list, but context about similar questions)
    let pyqContextPrompt = '';
    if (!/(pyq|previous year|past year)/i.test(message)) {
      // For non-PYQ queries, provide context about similar PYQ patterns
      const subject = examKnowledge.detectSubjectFromQuery(message);
      if (subject) {
        pyqContextPrompt = `\n\nPYQ CONTEXT:\nWhen relevant, mention that similar questions have been asked in previous UPSC exams. Reference PYQ patterns to show exam relevance.`;
      }
    }
    
    function buildPyqPrompt(userMsg) {
      const pyqMatch = /(pyq|previous year (?:question|questions|paper|papers)|past year (?:question|questions))/i.test(userMsg);
      if (!pyqMatch) return '';

      // Use pyqService to parse the query for consistent theme extraction
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

Format:
1. Start with: "Previous Year Questions (${examCodeDetected})"
2. Topic: "Topic: ${theme}" (if provided)
3. Year Range: "Year Range: ${fromYear || 'All'} to ${toYear || 'Present'}" (if provided)
4. Group by year: "Year {YEAR} ({count} questions)"
5. Question format: "{number}. [{Paper}] {Question Text}"
6. Status: ✅ for verified, ⚠️ for unverified
7. Summary: "Summary" with total count

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
- Ensure response is complete and properly formatted`;
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

    async function tryPyqFromDb(userMsg) {
      // More strict check: must have PYQ keywords or clear PYQ intent
      const hasPyqKeyword = /(pyq|pyqs|previous\s+year|past\s+year)/i.test(userMsg);
      const hasPyqIntent = /(?:give|show|get|fetch|list|bring|tell|need|want)\s+(?:me\s+)?(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs|questions?|qs)/i.test(userMsg);
      const hasSubjectPyq = /(?:eco|geo|hist|pol|sci|tech|env|economics|geography|history|polity|science|technology|environment)\s+(?:pyq|pyqs)/i.test(userMsg);
      
      // Only try PYQ search if there's clear PYQ intent
      if (!hasPyqKeyword && !hasPyqIntent && !hasSubjectPyq) {
        return null;
      }
      
      return await pyqService.search(userMsg, null, language);
    }
    const pyqDb = await tryPyqFromDb(message);
    if (pyqDb) {
      // Clean PYQ response before sending
      const cleanedPyq = cleanAIResponse(pyqDb);
      const validPyq = validateAndCleanResponse(cleanedPyq, 20);
      
      if (validPyq) {
        return res.status(200).json({ response: validPyq, source: 'pyq-db' });
      }
      // If PYQ response is invalid, fall through to LLM
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
    
    // Add answer framework (always add for better structured answers)
    if (answerFrameworkPrompt) {
      enhancedSystemPrompt += answerFrameworkPrompt;
    }
    
    // Add PYQ context (for non-PYQ queries)
    if (pyqContextPrompt && !pyqPrompt) {
      enhancedSystemPrompt += pyqContextPrompt;
    }
    
    // Add PYQ listing prompt (for explicit PYQ queries)
    if (pyqPrompt) {
      enhancedSystemPrompt += pyqPrompt;
    } else if (contextualEnhancement && needsContext) {
      enhancedSystemPrompt += contextualEnhancement.substring(0, 300);
    }

    const optimalModel = contextOptimizer.selectOptimalModel(message, !!hasContext);
    const maxTokens = Math.min(
      Math.max(calculateMaxTokens(message, pyqPrompt ? 'pyq' : 'general'), 1500),
      pyqPrompt ? 4000 : 3000
    );

    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: optimalModel === 'sonar' ? 'sonar' : (model || 'sonar-pro'),
      messages: [
        { role: 'system', content: enhancedSystemPrompt },
        { role: 'user', content: message }
      ],
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
      timeout: 45000
    });

    if (response && response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
      const rawResponse = response.data.choices[0].message.content;
      
      // Clean and validate the response
      const cleanedResponse = cleanAIResponse(rawResponse);
      const validResponse = validateAndCleanResponse(cleanedResponse, 30);
      
      if (!validResponse) {
        // If response is invalid, return a helpful error
        return res.status(500).json({
          error: 'Unable to generate a valid response. Please try rephrasing your question.',
          code: 'INVALID_RESPONSE',
          timestamp: new Date().toISOString()
        });
      }
      
      // Cache the cleaned response
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
      
      return res.status(200).json({ response: validResponse });
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

// Export with caching middleware
export default withCache(chatHandler);

