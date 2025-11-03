import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { withCache } from '@/lib/cache';
import { contextualLayer } from '@/lib/contextual-layer';
import examKnowledge from '@/lib/exam-knowledge';
import axios from 'axios';
import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';

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

    // Enhanced safety validation
    if (typeof message !== 'string' || message.length === 0) {
      return res.status(400).json({ error: 'Invalid message format' });
    }
    
    // Content safety checks
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
- Write complete, well-formed sentences
- Give complete answers that cover the question properly
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
- Start with acknowledging the question and showing understanding
- Provide detailed explanations with step-by-step reasoning
- Include examples, analogies, and context
- End with actionable insights or next steps
- Ensure every sentence is complete and meaningful
- Keep responses clean without any reference numbers
- Include practical exam tips when relevant
- Structure answers according to UPSC requirements when applicable

EXAMPLE OF GOOD RESPONSE WITH REASONING:
"Great question! Here's a clear explanation for exam prep. According to Article 1 of the Indian Constitution, India is called a 'Union of States' rather than a 'Federation of States'. Here's why: The Indian federal structure is unique because it combines federal and unitary features. Federal features include: (1) Division of powers between center and states (List I, II, III in Schedule 7), (2) Written constitution with supremacy, (3) Independent judiciary (Articles 124-147), and (4) Bicameral legislature at center. Unitary features include: (1) Single citizenship (Article 5-11), (2) Strong center with residuary powers (Article 248), (3) Emergency provisions (Articles 352-360), and (4) All-India services. This is significant for UPSC because: (1) It's frequently asked in Prelims (2019, 2021), (2) Important for Mains GS Paper 2, and (3) Relevant for understanding center-state relations. The framers adopted this model because they learned from the failures of the Articles of Confederation in the US and adapted federalism to India's diverse needs. This understanding is crucial for questions on cooperative federalism, fiscal federalism, and recent developments like GST implementation."

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

    const contextualEnhancement = contextualLayer.generateContextualPrompt(message);
    const examContext = examKnowledge.generateContextualPrompt(message);
    
    // Detect PYQ (previous year questions) themed requests and enforce strict list output
    function buildPyqPrompt(userMsg) {
      const lower = userMsg.toLowerCase();
      const pyqMatch = /(pyq|previous year (?:question|questions|paper|papers)|past year (?:question|questions))/i.test(userMsg);
      if (!pyqMatch) return '';

      // Extract theme/topic words (everything except exam keywords)
      // Simple heuristic: take text before/after pyq keywords
      const themeMatch = userMsg.replace(/\b(upsc|pcs|ssc|exam|exams)\b/ig, '').match(/(?:on|about|of|for)\s+([^.,;\n]+)/i);
      const theme = themeMatch ? themeMatch[1].trim() : '';

      // Extract year range
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

      return `\n\nSTRICT PYQ LISTING MODE:\n- The user is asking for previous year questions (PYQs).\n- Return ONLY a clean list of PYQs without explanations or advice.\n- Group by decade. For each item: "[Year] – [Exam/Paper if known] – [Question]".\n- If a paper name is known (e.g., UPSC Mains GS-3), include it.\n- Do NOT include analysis, tips, or instructions.\n- Do NOT fabricate papers; if uncertain, mark as "(unverified)" at the end of the line.\n- If the theme is provided, filter strictly to the theme.\n- ${yearLine}\n- Theme: ${theme || 'as inferred from the query'}.\n- Exam focus: UPSC by default if not specified.\n- End with an explicit count line: "Total listed: N".`;
    }
    
    // DB-first for PYQs with state exam detection
    function detectExamCode(userMsg, lang) {
      const s = (userMsg || '').toLowerCase();
      // Check state PCS exams first (more specific)
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
      // Then check generic exams
      if (/upsc/i.test(userMsg)) return 'UPSC';
      if (/pcs/i.test(userMsg)) return 'PCS';
      // Default to UPSC
      return 'UPSC';
    }

    async function tryPyqFromDb(userMsg) {
      const isPyq = /(pyq|previous year (?:question|questions|paper|papers)|past year (?:question|questions))/i.test(userMsg);
      if (!isPyq) return null;
      
      try {
        await connectToDatabase();
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
        const examCode = detectExamCode(userMsg, language);
        const filter = { exam: new RegExp(`^${examCode}$`, 'i') };
        // Filter out invalid years - set defaults
        filter.year = { $gte: 1990, $lte: new Date().getFullYear() };
        
        if (fromYear || toYear) {
          // Override defaults if user specified year range
          filter.year = {};
          if (fromYear) filter.year.$gte = fromYear;
          else filter.year.$gte = 1990; // Keep default lower bound
          if (toYear) filter.year.$lte = toYear;
          else filter.year.$lte = new Date().getFullYear(); // Keep default upper bound
        }
        
        // Determine limit based on query specificity
        let limit = 500;
        if (!theme && !fromYear && !toYear) {
          // General query - limit to most recent 30 questions
          limit = 30;
        } else if (theme && !fromYear && !toYear) {
          // Theme query without year - limit to 50
          limit = 50;
        } else if (fromYear || toYear) {
          // Year-specific query - allow more
          limit = 100;
        }
        
        let items = [];
        try {
          // Try with text search first if theme is provided
          if (theme) {
            const query = PYQ.find({
              ...filter,
              $or: [
                { $text: { $search: theme } },
                { topicTags: { $regex: theme, $options: 'i' } },
                { question: { $regex: theme, $options: 'i' } }
              ]
            }).sort({ year: -1 }).limit(limit);
            items = await query.lean();
          } else {
            const query = PYQ.find(filter).sort({ year: -1 }).limit(limit);
            items = await query.lean();
          }
        } catch (dbError) {
          // Fallback: If $text index doesn't exist or query planner fails, use regex only
          console.warn('PYQ database query error:', dbError.message);
          if (theme) {
            const query = PYQ.find({
              ...filter,
              $or: [
                { topicTags: { $regex: theme, $options: 'i' } },
                { question: { $regex: theme, $options: 'i' } }
              ]
            }).sort({ year: -1 }).limit(limit);
            items = await query.lean();
          } else {
            const query = PYQ.find(filter).sort({ year: -1 }).limit(limit);
            items = await query.lean();
          }
        }
        
        if (!items.length) return null;
      
      // Sort items: verified first, then unverified (both sorted by year descending)
      const sortedItems = items.sort((a, b) => {
        const aVerified = a.verified === true || (a.sourceLink && a.sourceLink.includes('.gov.in'));
        const bVerified = b.verified === true || (b.sourceLink && b.sourceLink.includes('.gov.in'));
        if (aVerified !== bVerified) return bVerified ? 1 : -1; // Verified first
        return (b.year || 0) - (a.year || 0); // Then by year descending (most recent first)
      });
      
      const verifiedCount = sortedItems.filter(q => q.verified === true || (q.sourceLink && q.sourceLink.includes('.gov.in'))).length;
      const unverifiedCount = sortedItems.length - verifiedCount;
      
      // Group by year (more useful than decade)
      const byYear = new Map();
      for (const q of sortedItems) {
        const year = q.year || 0;
        if (year < 1990 || year > new Date().getFullYear()) continue; // Skip invalid years
        
        if (!byYear.has(year)) byYear.set(year, []);
        
        const isUnverified = q.verified === false && (!q.sourceLink || !q.sourceLink.includes('.gov.in'));
        const topicTags = q.topicTags && q.topicTags.length > 0 ? q.topicTags.join(', ') : null;
        
        // Build cleaner label - truncate long questions
        let questionText = q.question || '';
        if (questionText.length > 150) {
          questionText = questionText.substring(0, 147) + '...';
        }
        
        let label = `[${q.paper || 'General'}] ${questionText}`;
        
        // Add topic/theme if available (only if different from question)
        if (topicTags && !questionText.toLowerCase().includes(topicTags.toLowerCase().substring(0, 20))) {
          label += ` (${topicTags})`;
        }
        
        // Add verification status
        if (isUnverified) {
          label += ' ⚠️';
        } else if (q.sourceLink && q.sourceLink.includes('.gov.in')) {
          label += ' ✅';
        }
        
        byYear.get(year).push(label);
      }
      
      const lines = [];
      
      // Add header with summary
      if (theme) {
        lines.push(`📚 Previous Year Questions on "${theme}" (${examCode})`);
      } else {
        lines.push(`📚 Previous Year Questions (${examCode})`);
      }
      
      if (fromYear || toYear) {
        lines.push(`📅 Year Range: ${fromYear || 'All'} to ${toYear || 'Present'}`);
      }
      lines.push('');
      
      // Group by year (most recent first)
      const sortedYears = Array.from(byYear.keys()).sort((a, b) => b - a);
      
      for (const year of sortedYears) {
        const yearQuestions = byYear.get(year);
        if (yearQuestions.length === 0) continue;
        
        lines.push(`**${year}** (${yearQuestions.length} question${yearQuestions.length > 1 ? 's' : ''}):`);
        yearQuestions.forEach((q, idx) => {
          lines.push(`${idx + 1}. ${q}`);
        });
        lines.push('');
      }
      
      // Summary with counts
      lines.push('---');
      if (verifiedCount > 0 && unverifiedCount > 0) {
        lines.push(`📊 Total: ${sortedItems.length} questions (${verifiedCount} ✅ verified, ${unverifiedCount} ⚠️ unverified)`);
      } else if (verifiedCount > 0) {
        lines.push(`📊 Total: ${sortedItems.length} questions (✅ All verified from official sources)`);
      } else {
        lines.push(`📊 Total: ${sortedItems.length} questions (⚠️ All unverified - please verify before use)`);
      }
      
      // Add helpful message if too many results
      if (sortedItems.length >= limit) {
        lines.push('');
        lines.push('💡 Tip: To get more specific results, try:');
        lines.push(`   - "PYQ on [specific topic]"`);
        lines.push(`   - "PYQ from 2020 to 2024"`);
        lines.push(`   - "PYQ about [subject]"`);
      }
      
      return lines.join('\n');
      } catch (error) {
        // Log error but don't crash - fall back to AI response
        console.error('PYQ database query error:', error.message);
        return null; // Return null to allow fallback to AI
      }
    }

    // If DB has PYQs, return immediately
    const pyqDb = await tryPyqFromDb(message);
    if (pyqDb) {
      return res.status(200).json({ response: pyqDb, source: 'pyq-db' });
    }

    const pyqPrompt = buildPyqPrompt(message);
    const enhancedSystemPrompt = finalSystemPrompt + contextualEnhancement + examContext + (pyqPrompt || '');

    // Parallelize primary and fast fallback model for lower latency
    // Use longer timeouts for comprehensive research queries
    // Note: sonar-pro automatically does web search - no additional config needed
    const primaryReq = axios.post('https://api.perplexity.ai/chat/completions', {
      model: model || 'sonar-pro',
      messages: [
        { role: 'system', content: enhancedSystemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: calculateMaxTokens(message),
      temperature: pyqPrompt ? 0.2 : 0.5,
      top_p: 0.9,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 60000 // Increased to 60s for complex queries
    });

    // Use faster model (sonar) for parallel fallback, not deep-research
    const fastReq = axios.post('https://api.perplexity.ai/chat/completions', {
      model: 'sonar',
      messages: [
        { role: 'system', content: enhancedSystemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: calculateMaxTokens(message),
      temperature: pyqPrompt ? 0.2 : 0.5,
      top_p: 0.9,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 45000 // 45s for faster model
    });

    let response;
    try {
      response = await Promise.any([primaryReq, fastReq]);
    } catch (aggregateError) {
      // If both requests fail, try a single fallback request with simpler parameters
      const errors = aggregateError.errors || [];
      const errorMessages = errors.map(e => {
        const msg = e.message || e.response?.data?.error?.message || String(e);
        const status = e.response?.status;
        const code = e.code || e.response?.status;
        return `${msg} (status: ${status || code || 'N/A'})`;
      }).join('; ');
      
      console.error('Chat API Error: All parallel API calls failed, trying fallback', {
        primaryError: errors[0]?.message || errors[0]?.response?.status || errors[0]?.code,
        primaryStatus: errors[0]?.response?.status,
        primaryResponse: errors[0]?.response?.data,
        fallbackError: errors[1]?.message || errors[1]?.response?.status || errors[1]?.code,
        fallbackStatus: errors[1]?.response?.status,
        fallbackResponse: errors[1]?.response?.data,
        errorDetails: errorMessages
      });
      
      // Try a single fallback request with simpler config but adequate timeout
      try {
        const fallbackResponse = await axios.post('https://api.perplexity.ai/chat/completions', {
          model: 'sonar', // Use faster model for fallback
          messages: [
            { role: 'system', content: enhancedSystemPrompt },
            { role: 'user', content: message }
          ],
          max_tokens: Math.min(calculateMaxTokens(message), 4000), // Increased from 2000
          temperature: 0.7,
          top_p: 0.9,
          stream: false
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000 // Increased to 30s
        });
        
        response = fallbackResponse;
      } catch (fallbackError) {
        // If fallback also fails, return error
        const fallbackMsg = fallbackError.message || fallbackError.response?.data?.error?.message || String(fallbackError);
        console.error('Chat API Error: Fallback request also failed', {
          error: fallbackMsg,
          status: fallbackError.response?.status,
          statusText: fallbackError.response?.statusText,
          responseData: fallbackError.response?.data,
          code: fallbackError.code,
          message: fallbackError.message
        });
        
        return res.status(500).json({ 
          error: 'AI service temporarily unavailable. Please try again in a moment.',
          details: process.env.NODE_ENV === 'development' ? `${errorMessages}; Fallback: ${fallbackMsg}` : undefined
        });
      }
    }

    if (response && response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
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
            temperature: 0.5,
            top_p: 0.9,
            stream: false
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 60000 // Increased to 60s for retry
          });
          
          if (retryResponse.data.choices && retryResponse.data.choices[0] && retryResponse.data.choices[0].message) {
            aiResponse = retryResponse.data.choices[0].message.content;
            aiResponse = aiResponse.replace(/\[\d+\]/g, '').replace(/\[\d+,\s*\d+\]/g, '');
          }
        } catch (retryError) {
        }
      }
      
      // If this was a PYQ request and DB was empty, attempt to parse & seed results as unverified
      if (pyqPrompt) {
        try {
          await connectToDatabase();
          const examCode = (function detectExam(userMsg) {
            if (/tnpsc/i.test(userMsg)) return 'TNPSC';
            if (/bpsc/i.test(userMsg)) return 'BPSC';
            if (/mpsc/i.test(userMsg)) return 'MPSC';
            if (/uppsc/i.test(userMsg)) return 'UPPSC';
            if (/wbpsc/i.test(userMsg)) return 'WBPSC';
            if (/gpsc/i.test(userMsg)) return 'GPSC';
            if (/ppsc/i.test(userMsg)) return 'PPSC';
            if (/rpsc/i.test(userMsg)) return 'RPSC';
            if (/mppsc/i.test(userMsg)) return 'MPPSC';
            if (/hpsc/i.test(userMsg)) return 'HPSC';
            if (/jkpsc/i.test(userMsg)) return 'JKPSC';
            if (/upsc/i.test(userMsg)) return 'UPSC';
            if (/pcs/i.test(userMsg)) return 'PCS';
            return 'UPSC';
          })(message);

          const themeMatch2 = message.replace(/\b(upsc|pcs|ssc|exam|exams)\b/ig, '').match(/(?:on|about|of|for)\s+([^.,;\n]+)/i);
          const theme2 = themeMatch2 ? themeMatch2[1].trim() : '';

          const lines = aiResponse.split(/\r?\n/);
          const candidates = [];
          for (const raw of lines) {
            const line = raw.trim().replace(/^[-•]\s*/, '');
            if (!line) continue;
            const yMatch = line.match(/\b(19\d{2}|20\d{2})\b/);
            const year = yMatch ? parseInt(yMatch[1], 10) : null;
            // Extract text after last dash as question
            let question = line;
            const split = line.split('–');
            if (split.length >= 2) {
              question = split[split.length - 1].trim();
            }
            if (question.length < 8) continue;
            candidates.push({ exam: examCode, level: '', paper: '', year, question, topicTags: theme2 ? [theme2] : [], sourceLink: '', verified: false });
            if (candidates.length >= 400) break;
          }
          if (candidates.length) {
            await PYQ.insertMany(candidates, { ordered: false });
          }
        } catch (e) {
          // best-effort; ignore seeding failures
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
