import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withCache } from '@/lib/cache';
import { contextualLayer } from '@/lib/contextual-layer';
import examKnowledge from '@/lib/exam-knowledge';
import { findPresetAnswer } from '@/lib/presetAnswers';
import axios from 'axios';
import connectToDatabase from '@/lib/mongodb';
import Chat from '@/models/Chat';
import pyqService from '@/lib/pyqService';

const PYQ_PATTERN = /(pyq|previous year (?:question|questions|paper|papers)|past year (?:question|questions))/i;

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

async function chatHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');

  // Validate API key
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

    const needsContext = !/(pyq|previous year)/i.test(message) && message.length > 30;
    const contextualEnhancement = needsContext ? contextualLayer.generateContextualPrompt(message) : '';
    const examContext = needsContext ? examKnowledge.generateContextualPrompt(message) : '';
    
    function buildPyqPrompt(userMsg) {
      const pyqMatch = /(pyq|previous year (?:question|questions|paper|papers)|past year (?:question|questions))/i.test(userMsg);
      if (!pyqMatch) return '';

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

      const yearLine = fromYear ? `Limit to ${fromYear}-${toYear}.` : 'Cover all available years.';
      
      let examCodeDetected = 'UPSC';
      if (/tnpsc|tamil nadu psc/i.test(userMsg) || language === 'ta') examCodeDetected = 'TNPSC';
      else if (/mpsc|maharashtra psc/i.test(userMsg) || language === 'mr') examCodeDetected = 'MPSC';
      else if (/upsc/i.test(userMsg)) examCodeDetected = 'UPSC';
      else if (/pcs/i.test(userMsg)) examCodeDetected = 'PCS';

      return `\n\nPYQ LISTING MODE:\nReturn only formatted PYQ list, no explanations. Use simple formatting without markdown headers or excessive bold text.\n\nFormat:\n1. Start with: "Previous Year Questions (${examCodeDetected})"\n2. Topic: "Topic: ${theme}" (if provided)\n3. Year Range: "Year Range: ${fromYear || 'All'} to ${toYear || 'Present'}" (if provided)\n4. Group by year: "Year {YEAR} ({count} questions)"\n5. Question format: "{number}. [{Paper}] {Question Text}"\n6. Status: ✅ verified, ⚠️ unverified\n7. Summary: "Summary" with total count\n\nRequirements:\n- Group by year (newest first)\n- Include paper name if known\n- Keep questions under 200 chars\n- Mark uncertain as "(unverified)" or ⚠️\n- Filter by theme if provided: ${theme || 'none'}\n- ${yearLine}\n- Exam: ${examCodeDetected}\n- Prioritize verified questions\n- Use plain text formatting, avoid markdown headers (##, ###) and excessive bold (**)`;
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
      const isPyq = /(pyq|previous year (?:question|questions|paper|papers)|past year (?:question|questions))/i.test(userMsg);
      if (!isPyq) return null;
      
      return await pyqService.search(userMsg, null, language);
    }
    const pyqDb = await tryPyqFromDb(message);
    if (pyqDb) {
      return res.status(200).json({ response: pyqDb, source: 'pyq-db' });
    }

    const pyqPrompt = buildPyqPrompt(message);
    const enhancedSystemPrompt = finalSystemPrompt + contextualEnhancement + examContext + (pyqPrompt || '');

    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: model || 'sonar-pro',
      messages: [
        { role: 'system', content: enhancedSystemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: calculateMaxTokens(message, pyqPrompt ? 'pyq' : 'general'),
      temperature: pyqPrompt ? 0.2 : 0.5,
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
      let aiResponse = response.data.choices[0].message.content;
      aiResponse = aiResponse.replace(/\[\d+\]/g, '').replace(/\[\d+,\s*\d+\]/g, '');
      
      
      
      responseCache.set(cacheKey, {
        response: aiResponse,
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
      
      return res.status(200).json({ response: aiResponse });
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
        errorMessage = 'Invalid API key. Please check your Perplexity API key.';
        errorCode = 'INVALID_API_KEY';
      } else if (status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        errorCode = 'RATE_LIMIT_EXCEEDED';
      } else if (status === 402) {
        errorMessage = 'Insufficient credits. Please add credits to your Perplexity account.';
        errorCode = 'INSUFFICIENT_CREDITS';
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
