import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withCache } from '@/lib/cache';
import { contextualLayer } from '@/lib/contextual-layer';
import examKnowledge from '@/lib/exam-knowledge';
import axios from 'axios';

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

  const supportedModels = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'claude-3-sonnet', 'claude-3-haiku', 'sonar-pro', 'sonar-medium', 'sonar-small'];
  if (model && !supportedModels.includes(model)) {
    throw new Error('Unsupported model');
  }

  return {
    message: message.trim(),
    model: model || 'gpt-3.5-turbo',
    systemPrompt: systemPrompt || '',
    language: language || 'en'
  };
}

function calculateMaxTokens(message) {
  const messageLength = message.length;
  
  if (messageLength < 100) return 4000;
  if (messageLength < 500) return 8000;
  if (messageLength < 2000) return 12000;
  return 16000;
}

function isResponseComplete(response) {
  const trimmedResponse = response.trim();
  if (trimmedResponse.length < 10) return false;
  
  const lastSentence = trimmedResponse.split(/[.!?]/).pop().trim();
  if (lastSentence.length > 0 && lastSentence.length < 5) return false;
  
  const incompletePatterns = [
    /-\s*$/,
    /,\s*$/,
    /and\s*$/,
    /or\s*$/,
    /the\s*$/,
    /a\s*$/,
    /an\s*$/,
    /to\s*$/,
    /of\s*$/,
    /in\s*$/,
    /for\s*$/,
    /with\s*$/,
    /by\s*$/,
    /from\s*$/,
    /about\s*$/,
    /through\s*$/,
    /during\s*$/,
    /while\s*$/,
    /because\s*$/,
    /although\s*$/,
    /however\s*$/,
    /therefore\s*$/,
    /moreover\s*$/,
    /furthermore\s*$/,
    /additionally\s*$/,
    /consequently\s*$/,
    /meanwhile\s*$/,
    /otherwise\s*$/,
    /nevertheless\s*$/,
    /nonetheless\s*$/
  ];
  
  return !incompletePatterns.some(pattern => pattern.test(trimmedResponse));
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
    const { inputType, enableCaching = true, quickResponses = true } = req.body;

    if (inputType === 'textOnly') {
      return res.status(200).json({ 
        response: null,
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

    let finalSystemPrompt = systemPrompt || `You are Indicore, an AI-powered exam preparation assistant specialized in PCS, UPSC, and SSC exams. You help students with multilingual study materials, answer writing practice, document evaluation, and regional language support.

EXAM EXPERTISE:
- UPSC Civil Services (Prelims, Mains, Interview)
- PCS (Provincial Civil Services) 
- SSC (Staff Selection Commission)
- State-level competitive exams
- Multilingual exam preparation
- Answer writing techniques
- Current affairs and general knowledge
- Subject-specific guidance

UPSC EXAM STRUCTURE:
- Prelims: 2 papers (GS Paper I: 100 questions, 200 marks; GS Paper II/CSAT: 80 questions, 200 marks)
- Mains: 9 papers (2 language papers, 1 essay, 4 GS papers, 2 optional papers) - Total 1750 marks
- Interview: 275 marks, 30-45 minutes duration

KEY SUBJECTS & WEIGHTAGE:
- Polity: High weightage (15-20 questions in Prelims) - Constitution, Fundamental Rights, Parliament, Judiciary
- History: High weightage (15-20 questions) - Ancient, Medieval, Modern periods, Freedom Struggle
- Geography: High weightage (15-20 questions) - Physical, Human, World Geography
- Economics: High weightage (15-20 questions) - Micro/Macro economics, Indian Economy
- Science & Technology: Medium weightage (10-15 questions) - Recent developments, Space, IT
- Environment: High weightage (10-15 questions) - Biodiversity, Climate Change, Conservation

ANSWER WRITING FRAMEWORKS:
- 150 words: Introduction (20-30 words) → Main Body (100-120 words) → Conclusion (20-30 words)
- 250 words: Introduction (40-50 words) → Main Body (150-180 words) → Conclusion (40-50 words)
- Essay: Introduction → Body (3-4 paragraphs) → Conclusion

CRITICAL RESPONSE REQUIREMENTS:
- Write complete, well-formed sentences
- Provide comprehensive answers that fully address the question
- Use proper grammar and punctuation
- Structure your response logically with clear paragraphs
- NEVER include reference numbers like [1], [2], [3], [7] or any citations
- NEVER include source references or footnotes
- NEVER include bracketed numbers or academic citations
- Always complete your thoughts and sentences fully
- Write in a helpful, conversational tone
- Focus on being educational and exam-focused
- Remove any citation patterns from your responses
- Provide exam-specific insights and strategies
- Include relevant examples and case studies
- Reference important acts, policies, and recent developments

RESPONSE FORMAT:
- Start with a clear introduction
- Provide detailed explanations with examples
- End with a helpful conclusion or summary
- Ensure every sentence is complete and meaningful
- Keep responses clean without any reference numbers
- Include practical exam tips when relevant
- Structure answers according to UPSC requirements when applicable`;

    if (language && language !== 'en') {
      const languageNames = {
        hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', bn: 'Bengali',
        pa: 'Punjabi', gu: 'Gujarati', te: 'Telugu', ml: 'Malayalam',
        kn: 'Kannada', es: 'Spanish'
      };

      const langName = languageNames[language] || 'English';
      finalSystemPrompt += ` Your response MUST be entirely in ${langName}. Do not use any other language. Ensure perfect grammar and natural flow in ${langName}.`;
    }

    const contextualEnhancement = contextualLayer.generateContextualPrompt(message);
    const examContext = examKnowledge.generateContextualPrompt(message);
    
    const enhancedSystemPrompt = finalSystemPrompt + contextualEnhancement + examContext;

    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: model || 'sonar-pro',
      messages: [
        { role: 'system', content: enhancedSystemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: calculateMaxTokens(message),
      temperature: 0.7,
      top_p: 0.9,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
      let aiResponse = response.data.choices[0].message.content;
      // Clean any citation patterns that might slip through
      aiResponse = aiResponse.replace(/\[\d+\]/g, '').replace(/\[\d+,\s*\d+\]/g, '');
      
      // Check if response is complete, if not, try to regenerate
      if (!isResponseComplete(aiResponse)) {
        
        // Try one more time with a more explicit prompt
        const retryPrompt = `${finalSystemPrompt}\n\nIMPORTANT: The previous response was incomplete. Please provide a complete, well-structured answer that fully addresses the user's question. Ensure your response ends with a proper conclusion.`;
        
        try {
          const retryResponse = await axios.post('https://api.perplexity.ai/chat/completions', {
            model: model || 'sonar-pro',
            messages: [
              { role: 'system', content: retryPrompt },
              { role: 'user', content: message }
            ],
            max_tokens: calculateMaxTokens(message),
            temperature: 0.7,
            top_p: 0.9,
            stream: false
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          
          if (retryResponse.data.choices && retryResponse.data.choices[0] && retryResponse.data.choices[0].message) {
            aiResponse = retryResponse.data.choices[0].message.content;
            aiResponse = aiResponse.replace(/\[\d+\]/g, '').replace(/\[\d+,\s*\d+\]/g, '');
          }
        } catch (retryError) {
        }
      }
      
      return res.status(200).json({ response: aiResponse });
    } else {
      throw new Error('Invalid response format from Perplexity API');
    }

  } catch (error) {
    console.error('Chat API Error:', error);

    // Handle validation errors
    if (error.message.includes('malicious') || error.message.includes('unsupported') || error.message.includes('required')) {
      return res.status(400).json({ 
        error: error.message,
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    // Handle API errors
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
