import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import axios from 'axios';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { message, model, systemPrompt, language } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Prepare system prompt
    let finalSystemPrompt = systemPrompt || `You are Indicore, an AI-powered exam preparation assistant specialized in PCS, UPSC, and SSC exams. You help students with multilingual study materials, answer writing practice, document evaluation, and regional language support.

CRITICAL RESPONSE REQUIREMENTS:
- Write complete, well-formed sentences that make grammatical sense
- Provide comprehensive answers that fully address the user's question
- Use proper grammar, punctuation, and sentence structure
- Structure your response logically with clear paragraphs
- NEVER include reference numbers like [1], [2], [3]
- NEVER include citations or source references
- Always complete your thoughts and sentences fully
- Write in a helpful, conversational tone
- Focus on being educational and exam-focused
- Ensure every sentence is grammatically correct and meaningful

RESPONSE FORMAT:
- Start with a clear, complete introduction that directly addresses the user
- Provide detailed explanations with examples
- End with a helpful conclusion or summary
- Ensure every sentence is complete and meaningful
- Make sure your response reads like natural, fluent English

EXAMPLE OF GOOD RESPONSE:
"Hello! I'm Indicore, your AI-powered exam preparation assistant. I specialize in helping students prepare for PCS, UPSC, and SSC exams through comprehensive study materials, answer writing practice, and multilingual support. I can assist you with [specific examples]. How can I help you today?"

EXAMPLE OF BAD RESPONSE:
"PCSC exams need help materials writing or to preparation free. I'm to support learning journey help you achieve your. Let me know I can you today"`;

    if (language && language !== 'en') {
      const languageNames = {
        hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', bn: 'Bengali',
        pa: 'Punjabi', gu: 'Gujarati', te: 'Telugu', ml: 'Malayalam',
        kn: 'Kannada', es: 'Spanish'
      };

      const langName = languageNames[language] || 'English';
      finalSystemPrompt += ` Your response MUST be entirely in ${langName}. Do not use any other language. Ensure perfect grammar and natural flow in ${langName}.`;
    }

    // Set up streaming response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) {
      res.flushHeaders();
    }

    // Call Perplexity API with streaming
    
    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: model || 'sonar-pro',
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: calculateMaxTokens(message),
      temperature: 0.7,
      top_p: 0.9,
      stream: true // Enable streaming
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      responseType: 'stream',
      timeout: 120000
    });

    // Stream the response and keep the handler alive until completion
    let fullResponse = '';
    let isResponseComplete = false;
    
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
              
              // Check if response is complete or garbled before ending
              const isGarbled = /(PCSC|PCS|UPSC|SSC)\s+exams?\s+need\s+help|I'm\s+to\s+support|Let\s+me\s+know\s+I\s+can\s+you/i.test(fullResponse);
              
              if ((!isResponseComplete || isGarbled) && fullResponse.trim().length > 0) {
                
                // Send a completion signal and try regeneration
                res.write('\n\n[REGENERATING_INCOMPLETE_RESPONSE]');
                res.end();
                resolve();
                return;
              }
              
              res.end();
              resolve();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                let content = parsed.choices[0].delta.content;
                // Clean any citation patterns that might slip through
                content = content.replace(/\[\d+\]/g, '').replace(/\[\d+,\s*\d+\]/g, '');
                
                // Additional cleaning for garbled text patterns
                content = content.replace(/\b(PCSC|PCS|UPSC|SSC)\s+exams?\s+need\s+help\s+[^.]*\./gi, '');
                content = content.replace(/\bI'm\s+to\s+support\s+[^.]*\./gi, '');
                content = content.replace(/\bLet\s+me\s+know\s+I\s+can\s+you\s+today/gi, '');
                
                fullResponse += content;
                res.write(content);
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      });

      response.data.on('end', () => {
        clearInterval(keepAlive);
        
        // Final check for response completeness
        if (fullResponse.trim().length > 0 && !isResponseComplete) {
        }
        
        if (!res.writableEnded) res.end();
        resolve();
      });

      response.data.on('error', (error) => {
        clearInterval(keepAlive);
        if (!res.headersSent) res.status(500);
        if (!res.writableEnded) res.end('Streaming error');
        resolve();
      });
    });

  } catch (error) {
    
    // Log the actual error response from Perplexity API
    if (error.response && error.response.data) {
    }
    
    if (error.response) {
      const status = error.response.status;
      let errorMessage = 'An error occurred while processing your request.';

      if (status === 401) errorMessage = 'Invalid API key. Please check your Perplexity API key.';
      else if (status === 429) errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      else if (status === 402) errorMessage = 'Insufficient credits. Please add credits to your Perplexity account.';
      else if (status === 403) errorMessage = 'Access denied. Please verify your API key permissions.';

      res.status(status).write(errorMessage);
    } else {
      res.status(500).write('Internal server error');
    }
    res.end();
  }
}
