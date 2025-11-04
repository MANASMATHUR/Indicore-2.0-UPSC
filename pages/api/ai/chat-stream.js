import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { contextualLayer } from '@/lib/contextual-layer';
import examKnowledge from '@/lib/exam-knowledge';
import axios from 'axios';
import connectToDatabase from '@/lib/mongodb';
import PYQ from '@/models/PYQ';
import Chat from '@/models/Chat';

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
    const { message, chatId, model, systemPrompt, language } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let conversationHistory = [];
    if (chatId) {
      try {
        await connectToDatabase();
        const chat = await Chat.findOne({ 
          _id: chatId, 
          userEmail: session.user.email 
        }).lean();
        
        if (chat && chat.messages && Array.isArray(chat.messages)) {
          conversationHistory = chat.messages
            .filter(msg => msg.sender && msg.text && msg.text.trim() !== message.trim())
            .slice(-10)
            .map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.text
            }));
          
        }
      } catch (err) {
        console.warn('Failed to load conversation history:', err.message);
      }
    }

    if (typeof message !== 'string' || message.length === 0) {
      return res.status(400).json({ error: 'Invalid message format' });
    }
    
    const supportedModels = ['sonar-pro', 'sonar', 'sonar-reasoning', 'sonar-reasoning-pro', 'sonar-deep-research'];
    const selectedModel = model || 'sonar-pro';
    if (!supportedModels.includes(selectedModel)) {
      return res.status(400).json({ error: 'Unsupported model' });
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
- Give complete answers that cover the user's question properly
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

FORMATTING REQUIREMENTS:
- Use compact, uniform formatting with minimal spacing
- Write concise paragraphs without excessive blank lines
- Keep lists tight with minimal spacing between items
- Use single line breaks between paragraphs, not multiple blank lines
- Avoid unnecessary spacing in lists, headings, and content
- Format responses to be visually uniform and easy to read
- Maintain consistent spacing throughout the response
- Do not add extra blank lines or excessive whitespace

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

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) {
      res.flushHeaders();
    }

    const contextualEnhancement = contextualLayer.generateContextualPrompt(message);
    const examContext = examKnowledge.generateContextualPrompt(message);

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
        
        const examCode = detectExamCode(userMsg, language);
        const filter = { exam: new RegExp(`^${examCode}$`, 'i') };
        filter.year = { $gte: 1990, $lte: new Date().getFullYear() };
        
        if (fromYear || toYear) {
          filter.year = {};
          filter.year.$gte = fromYear || 1990;
          filter.year.$lte = toYear || new Date().getFullYear();
        }
        
        let limit = 500;
        if (!theme && !fromYear && !toYear) {
          limit = 30;
        } else if (theme && !fromYear && !toYear) {
          limit = 50;
        } else if (fromYear || toYear) {
          limit = 100;
        }
        
        let items = [];
        try {
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
        
        const sortedItems = items.sort((a, b) => {
          const aVerified = a.verified === true || (a.sourceLink && a.sourceLink.includes('.gov.in'));
        const bVerified = b.verified === true || (b.sourceLink && b.sourceLink.includes('.gov.in'));
        if (aVerified !== bVerified) return bVerified ? 1 : -1;
        return (b.year || 0) - (a.year || 0);
        });
        
        const verifiedCount = sortedItems.filter(q => q.verified === true || (q.sourceLink && q.sourceLink.includes('.gov.in'))).length;
        const unverifiedCount = sortedItems.length - verifiedCount;
        
        const byYear = new Map();
        for (const q of sortedItems) {
          const year = q.year || 0;
          if (year < 1990 || year > new Date().getFullYear()) continue;
          
          if (!byYear.has(year)) byYear.set(year, []);
          
          const isUnverified = q.verified === false && (!q.sourceLink || !q.sourceLink.includes('.gov.in'));
          const topicTags = q.topicTags && q.topicTags.length > 0 ? q.topicTags.join(', ') : null;
          
          let questionText = q.question || '';
          if (questionText.length > 150) {
            questionText = questionText.substring(0, 147) + '...';
          }
          
          let label = `[${q.paper || 'General'}] ${questionText}`;
          
          if (topicTags && !questionText.toLowerCase().includes(topicTags.toLowerCase().substring(0, 20))) {
            label += ` (${topicTags})`;
          }
          
          if (isUnverified) {
            label += ' ⚠️';
          } else if (q.sourceLink && q.sourceLink.includes('.gov.in')) {
            label += ' ✅';
          }
          
          byYear.get(year).push(label);
        }
        
        const lines = [];
        lines.push(`## 📚 Previous Year Questions (${examCode})`);
        if (theme) {
          lines.push(`**Topic:** ${theme}`);
        }
        if (fromYear || toYear) {
          lines.push(`**Year Range:** ${fromYear || 'All'} to ${toYear || 'Present'}`);
        }
        lines.push('');
        
        // Group by year (most recent first)
        const sortedYears = Array.from(byYear.keys()).sort((a, b) => b - a);
        
        for (const year of sortedYears) {
          const yearQuestions = byYear.get(year);
          if (yearQuestions.length === 0) continue;
          
          lines.push(`### 📅 ${year} (${yearQuestions.length} question${yearQuestions.length > 1 ? 's' : ''})`);
          lines.push('');
          yearQuestions.forEach((q, idx) => {
            lines.push(`${idx + 1}. ${q}`);
          });
        lines.push('');
      }
      
      lines.push('---');
        lines.push('');
        if (verifiedCount > 0 && unverifiedCount > 0) {
          lines.push(`### 📊 Summary`);
          lines.push(`**Total:** ${sortedItems.length} questions`);
          lines.push(`- ✅ Verified: ${verifiedCount} (from official sources)`);
          lines.push(`- ⚠️ Unverified: ${unverifiedCount} (please verify before use)`);
        } else if (verifiedCount > 0) {
          lines.push(`### 📊 Summary`);
          lines.push(`**Total:** ${sortedItems.length} questions`);
          lines.push(`✅ All verified from official sources`);
        } else {
          lines.push(`### 📊 Summary`);
          lines.push(`**Total:** ${sortedItems.length} questions`);
          lines.push(`⚠️ All unverified - please verify before use`);
        }
      lines.push('');
      
      if (sortedItems.length >= limit) {
          lines.push('💡 **Tips for Better Results:**');
          lines.push('- Try: `"PYQ on [specific topic]"` for focused questions');
          lines.push('- Try: `"PYQ from 2020 to 2024"` for year-specific queries');
          lines.push('- Try: `"PYQ about [subject]"` for subject-wise questions');
          lines.push('- Combine filters: `"PYQ on Geography from 2020 to 2024"`');
          lines.push('');
        }
        
        return lines.join('\n');
      } catch (error) {
        console.error('PYQ database query error:', error.message);
        return null;
      }
    }

    const pyqDb = await tryPyqFromDb(message);
    if (pyqDb) {
      res.write(pyqDb);
      res.end();
      return;
    }

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
      
      return `\n\nSTRICT PYQ LISTING MODE - ENHANCED FORMATTING:\n- The user is asking for previous year questions (PYQs).\n- Return ONLY a well-formatted list of PYQs without explanations or advice.\n\nFORMATTING REQUIREMENTS:\n1. Start with header: "## 📚 Previous Year Questions (${examCodeDetected})"\n2. If theme provided, add: "**Topic:** ${theme}"\n3. If year range provided, add: "**Year Range:** ${fromYear || 'All'} to ${toYear || 'Present'}"\n4. Group questions by year using: "### 📅 {YEAR} ({count} questions)"\n5. Format each question as: "{number}. [{Paper}] {Question Text}"\n6. Add verification status: Add "✅" for verified, "⚠️" for unverified\n7. End with summary section: "### 📊 Summary" with total count\n\nCONTENT REQUIREMENTS:\n- Group by year (most recent first), NOT by decade\n- Include paper name if known (e.g., "GS Paper 1", "Mains GS-3", "Prelims")\n- Keep question text concise but complete (max 200 characters)\n- Do NOT fabricate questions; if uncertain, mark as "(unverified)" or add ⚠️\n- If theme is provided (${theme || 'none'}), filter strictly to that theme\n- ${yearLine}\n- Exam focus: ${examCodeDetected} by default\n- Prioritize verified/official questions when available\n\nOUTPUT EXAMPLE:\n## 📚 Previous Year Questions (UPSC)\n**Topic:** Indian Constitution\n**Year Range:** 2020 to 2024\n\n### 📅 2024 (3 questions)\n1. [GS Paper 2] What is the significance of Article 356? ✅\n2. [Prelims] Which article deals with fundamental rights? ✅\n\n### 📅 2023 (2 questions)\n1. [Mains GS-2] Explain the federal structure of India. ✅\n\n---\n\n### 📊 Summary\n**Total:** 5 questions\n✅ All verified from official sources`;
    }

    const pyqPrompt = buildPyqPrompt(message);
    const enhancedSystemPrompt = finalSystemPrompt + contextualEnhancement + examContext + (pyqPrompt || '');

    const messagesForAPI = [
      { role: 'system', content: enhancedSystemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: selectedModel,
      messages: messagesForAPI,
      max_tokens: calculateMaxTokens(message),
      temperature: pyqPrompt ? 0.2 : 0.5,
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
