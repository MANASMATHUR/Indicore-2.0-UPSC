import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { contextualLayer } from '@/lib/contextual-layer';
import examKnowledge from '@/lib/exam-knowledge';
import axios from 'axios';

const responseCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

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
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(cached.response);
      res.end();
      return;
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

CRITICAL RESPONSE REQUIREMENTS - BUILD TRUST THROUGH REASONING:
- ALWAYS provide step-by-step reasoning for your answers
- Explain WHY your answer is correct, not just WHAT the answer is
- Show your thought process and logical reasoning
- Break down complex topics into understandable parts
- Provide context and background information
- Use "Let me explain this step by step..." or "Here's my reasoning..."
- Include relevant examples and analogies to clarify concepts
- Acknowledge when there might be multiple perspectives
- Show confidence in your knowledge while being humble about limitations

SAFETY AND RELIABILITY REQUIREMENTS:
- NEVER provide information that could be harmful, misleading, or incorrect
- ALWAYS prioritize student safety and academic integrity
- NEVER encourage cheating, plagiarism, or academic dishonesty
- ALWAYS promote ethical study practices and honest preparation
- NEVER provide answers to specific exam questions or leaked papers
- ALWAYS encourage understanding over memorization
- NEVER provide medical, legal, or financial advice beyond exam preparation
- ALWAYS maintain professional and respectful tone
- NEVER share personal information or violate privacy
- ALWAYS focus on educational value and learning outcomes

CONTENT SAFETY GUIDELINES:
- Avoid controversial political statements or biased opinions
- Present balanced views on sensitive topics
- Focus on factual, exam-relevant information
- Avoid inflammatory or divisive content
- Maintain neutrality on political matters
- Present historical facts objectively
- Avoid speculation or unverified claims
- Focus on established academic knowledge
- Present multiple perspectives when applicable
- Maintain educational focus at all times

EXAM-SPECIFIC SAFETY MEASURES:
- NEVER provide specific answers to current exam questions
- NEVER share leaked papers or confidential exam materials
- ALWAYS encourage ethical preparation methods
- NEVER provide shortcuts that compromise learning
- ALWAYS promote understanding and critical thinking
- NEVER encourage rote memorization without comprehension
- ALWAYS provide context and reasoning for answers
- NEVER provide information that could be considered cheating
- ALWAYS maintain academic integrity standards
- NEVER compromise the fairness of competitive exams

QUALITY ASSURANCE REQUIREMENTS:
- Double-check all facts before presenting them
- Verify information against multiple reliable sources
- Clearly distinguish between facts and opinions
- Acknowledge limitations and uncertainties
- Provide disclaimers when appropriate
- Maintain consistency in information presentation
- Ensure accuracy of constitutional and legal references
- Verify current affairs information with official sources
- Cross-reference historical facts with established sources
- Maintain high standards of academic rigor

EXAM-ORIENTED RELIABILITY REQUIREMENTS:
- ALWAYS prioritize accuracy over speed - better to be thorough than quick
- Cross-reference information with official sources and established facts
- When uncertain about specific details, clearly state your confidence level
- Provide multiple perspectives when applicable (especially for current affairs)
- Include recent developments and updates relevant to exam patterns
- Focus on exam-specific insights, not general knowledge
- Highlight key points that frequently appear in UPSC/PCS/SSC exams
- Provide specific examples from previous year questions when relevant
- Include constitutional articles, acts, and official terminology accurately
- Mention relevant committees, reports, and government initiatives

ACCURACY AND RELIABILITY STANDARDS:
- Double-check facts before stating them as definitive
- Use phrases like "According to the Constitution..." or "As per official data..."
- When citing specific articles or sections, be precise (e.g., "Article 14 of the Constitution")
- For current affairs, mention the timeframe (e.g., "As of 2024..." or "Recently announced...")
- Distinguish between facts, opinions, and interpretations
- If information might be outdated, acknowledge it and suggest verification
- For controversial topics, present balanced views with proper context
- Always prioritize official government sources and constitutional provisions

EXAM-SPECIFIC GUIDELINES:
- Structure answers according to UPSC answer writing format when applicable
- Include relevant keywords that examiners look for
- Provide concise definitions followed by detailed explanations
- Connect topics to broader themes and interlinkages
- Mention practical applications and real-world examples
- Include comparative analysis when relevant (e.g., Indian vs other countries)
- Highlight implications for governance, policy, and administration
- Provide historical context for contemporary issues
- Include statistical data and facts when available
- Connect static topics to current developments

REASONING PATTERNS TO USE:
1. "Let me break this down for you..."
2. "Here's why this is important..."
3. "The reasoning behind this is..."
4. "Let me explain this step by step..."
5. "This connects to the broader concept of..."
6. "To understand this better, consider..."
7. "The key insight here is..."
8. "This is significant because..."

RESPONSE STRUCTURE FOR TRUST-BUILDING:
- Start with acknowledging the question and showing understanding
- Provide clear reasoning and step-by-step explanation
- Include relevant examples and context
- Explain the significance and implications
- End with actionable insights or next steps
- Use confident but humble language

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
- Include relevant examples and case studies
- Reference important acts, policies, and recent developments

RESPONSE FORMAT:
- Start with a clear, complete introduction that directly addresses the user
- Provide detailed explanations with step-by-step reasoning
- Include examples, analogies, and context
- End with a helpful conclusion or summary
- Ensure every sentence is complete and meaningful
- Make sure your response reads like natural, fluent English
- Structure answers according to UPSC requirements when applicable

EXAMPLE OF GOOD RESPONSE WITH REASONING:
"Excellent question! Let me provide a comprehensive, exam-oriented explanation. According to Article 1 of the Indian Constitution, India is described as a 'Union of States' rather than a 'Federation of States'. Here's my detailed reasoning: The Indian federal structure is unique because it combines federal and unitary features. Federal features include: (1) Division of powers between center and states (List I, II, III in Schedule 7), (2) Written constitution with supremacy, (3) Independent judiciary (Articles 124-147), and (4) Bicameral legislature at center. Unitary features include: (1) Single citizenship (Article 5-11), (2) Strong center with residuary powers (Article 248), (3) Emergency provisions (Articles 352-360), and (4) All-India services. This is significant for UPSC because: (1) It's frequently asked in Prelims (2019, 2021), (2) Important for Mains GS Paper 2, and (3) Relevant for understanding center-state relations. The framers adopted this model because they learned from the failures of the Articles of Confederation in the US and adapted federalism to India's diverse needs. This understanding is crucial for questions on cooperative federalism, fiscal federalism, and recent developments like GST implementation."

EXAMPLE OF BAD RESPONSE:
"Indian federalism is quasi-federal. It has federal and unitary features. This is important for exams."`;

    if (language && language !== 'en') {
      const languageNames = {
        hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', bn: 'Bengali',
        pa: 'Punjabi', gu: 'Gujarati', te: 'Telugu', ml: 'Malayalam',
        kn: 'Kannada', es: 'Spanish'
      };

      const langName = languageNames[language] || 'English';
      finalSystemPrompt += ` Your response MUST be entirely in ${langName}. Do not use any other language. Ensure perfect grammar and natural flow in ${langName}.`;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) {
      res.flushHeaders();
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
      stream: true
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      responseType: 'stream',
      timeout: 120000
    });

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
              
              const isGarbled = /(PCSC|PCS|UPSC|SSC)\s+exams?\s+need\s+help|I'm\s+to\s+support|Let\s+me\s+know\s+I\s+can\s+you/i.test(fullResponse);
              
              if ((!isResponseComplete || isGarbled) && fullResponse.trim().length > 0) {
                res.write('\n\n[REGENERATING_INCOMPLETE_RESPONSE]');
                res.end();
                resolve();
                return;
              }
              
              if (fullResponse.trim().length > 50 && !isGarbled) {
                responseCache.set(cacheKey, {
                  response: fullResponse,
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
              }
              
              res.end();
              resolve();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                let content = parsed.choices[0].delta.content;
                content = content.replace(/\[\d+\]/g, '').replace(/\[\d+,\s*\d+\]/g, '');
                content = content.replace(/\b(PCSC|PCS|UPSC|SSC)\s+exams?\s+need\s+help\s+[^.]*\./gi, '');
                content = content.replace(/\bI'm\s+to\s+support\s+[^.]*\./gi, '');
                content = content.replace(/\bLet\s+me\s+know\s+I\s+can\s+you\s+today/gi, '');
                fullResponse += content;
                res.write(content);
              }
            } catch (e) {
            }
          }
        }
      });

      response.data.on('end', () => {
        clearInterval(keepAlive);
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
    if (error.response) {
      const status = error.response.status;
      let errorMessage = 'An error occurred while processing your request.';

      if (status === 401) errorMessage = 'Invalid API key. Please check your Perplexity API key.';
      else if (status === 429) errorMessage = 'Rate limit exceeded. Please try again.';
      else if (status === 402) errorMessage = 'Insufficient credits. Please add credits.';
      else if (status === 403) errorMessage = 'Access denied. Please verify your API key permissions.';

      res.status(status).write(errorMessage);
    } else {
      res.status(500).write('Internal server error');
    }
    res.end();
  }
}
