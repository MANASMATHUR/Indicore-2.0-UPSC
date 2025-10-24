import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withCache } from '@/lib/cache';
import { contextualLayer } from '@/lib/contextual-layer';
import axios from 'axios';

// Enterprise validation and security
function validateChatRequest(req) {
  const { message, model, systemPrompt, language } = req.body;

  // Input validation
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('Message is required and must be a non-empty string');
  }

  if (message.length > 10000) {
    throw new Error('Message too long: maximum 10,000 characters allowed');
  }

  if (message.length < 1) {
    throw new Error('Message too short: minimum 1 character required');
  }

  // Security validation
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

  // Language validation
  const supportedLanguages = ['en', 'hi', 'mr', 'ta', 'bn', 'pa', 'gu', 'te', 'ml', 'kn', 'es'];
  if (language && !supportedLanguages.includes(language)) {
    throw new Error('Unsupported language');
  }

  // Model validation
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

// Function to calculate optimal token count based on message complexity
function calculateMaxTokens(message) {
  const messageLength = message.length;
  
  // Short questions (< 100 chars): 4000 tokens
  if (messageLength < 100) return 4000;
  
  // Medium questions (100-500 chars): 8000 tokens
  if (messageLength < 500) return 8000;
  
  // Long questions or document analysis (500-2000 chars): 12000 tokens
  if (messageLength < 2000) return 12000;
  
  // Very long content (> 2000 chars): 16000 tokens
  return 16000;
}

function isResponseComplete(response) {
  // Check if response ends with proper punctuation
  const trimmedResponse = response.trim();
  if (trimmedResponse.length < 10) return false;
  
  // Check for incomplete sentences (ends with incomplete words or fragments)
  const lastSentence = trimmedResponse.split(/[.!?]/).pop().trim();
  if (lastSentence.length > 0 && lastSentence.length < 5) return false;
  
  // Check for common incomplete patterns
  const incompletePatterns = [
    /-\s*$/,  // Ends with dash
    /,\s*$/,  // Ends with comma
    /and\s*$/,  // Ends with "and"
    /or\s*$/,   // Ends with "or"
    /the\s*$/,  // Ends with "the"
    /a\s*$/,    // Ends with "a"
    /an\s*$/,   // Ends with "an"
    /to\s*$/,   // Ends with "to"
    /of\s*$/,   // Ends with "of"
    /in\s*$/,   // Ends with "in"
    /for\s*$/,  // Ends with "for"
    /with\s*$/, // Ends with "with"
    /by\s*$/,   // Ends with "by"
    /from\s*$/, // Ends with "from"
    /about\s*$/, // Ends with "about"
    /through\s*$/, // Ends with "through"
    /during\s*$/, // Ends with "during"
    /while\s*$/, // Ends with "while"
    /because\s*$/, // Ends with "because"
    /although\s*$/, // Ends with "although"
    /however\s*$/, // Ends with "however"
    /therefore\s*$/, // Ends with "therefore"
    /moreover\s*$/, // Ends with "moreover"
    /furthermore\s*$/, // Ends with "furthermore"
    /additionally\s*$/, // Ends with "additionally"
    /consequently\s*$/, // Ends with "consequently"
    /meanwhile\s*$/, // Ends with "meanwhile"
    /otherwise\s*$/, // Ends with "otherwise"
    /nevertheless\s*$/, // Ends with "nevertheless"
    /nonetheless\s*$/ // Ends with "nonetheless"
  ];
  
  return !incompletePatterns.some(pattern => pattern.test(trimmedResponse));
}

async function chatHandler(req, res) {
  // CORS headers for enterprise security
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
    // Enterprise validation
    const { message, model, systemPrompt, language } = validateChatRequest(req);
    const { inputType, enableCaching = true, quickResponses = true } = req.body;

    // If input is text-only, skip AI generation
    if (inputType === 'textOnly') {
      return res.status(200).json({ 
        response: null,
        timestamp: new Date().toISOString()
      });
    }

    // Check for quick responses first
    if (quickResponses) {
      const quickResponse = contextualLayer.getQuickResponse(message);
      if (quickResponse) {
        return res.status(200).json({
          ...quickResponse,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Prepare system prompt
    let finalSystemPrompt = systemPrompt || `You are Indicore, an AI-powered exam preparation assistant specialized in PCS, UPSC, and SSC exams. You help students with multilingual study materials, answer writing practice, document evaluation, and regional language support.

CRITICAL RESPONSE REQUIREMENTS:
- Write complete, well-formed sentences
- Provide comprehensive answers that fully address the question
- Use proper grammar and punctuation
- Structure your response logically with clear paragraphs
- NEVER include reference numbers like [1], [2], [3]
- NEVER include citations or source references
- Always complete your thoughts and sentences fully
- Write in a helpful, conversational tone
- Focus on being educational and exam-focused

RESPONSE FORMAT:
- Start with a clear introduction
- Provide detailed explanations with examples
- End with a helpful conclusion or summary
- Ensure every sentence is complete and meaningful`;

    if (language && language !== 'en') {
      const languageNames = {
        hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', bn: 'Bengali',
        pa: 'Punjabi', gu: 'Gujarati', te: 'Telugu', ml: 'Malayalam',
        kn: 'Kannada', es: 'Spanish'
      };

      const langName = languageNames[language] || 'English';
      finalSystemPrompt += ` Your response MUST be entirely in ${langName}. Do not use any other language. Ensure perfect grammar and natural flow in ${langName}.`;
    }

    // Call Perplexity/Sonar API
    
    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: model || 'sonar-pro',
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: message }
      ],
      // Use dynamic token allocation based on message complexity
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
