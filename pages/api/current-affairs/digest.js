import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import CurrentAffairsDigest from '@/models/CurrentAffairsDigest';
import { callAIWithFallback } from '@/lib/ai-providers';
import { translateText } from '@/pages/api/ai/translate';
import { fetchGoogleNewsRSS } from '@/lib/newsService';
import { trackInteraction } from '@/lib/personalizationHelpers';
import { v4 as uuidv4 } from 'uuid';

/**
 * Parse date string in various formats (DD-MM-YYYY, YYYY-MM-DD, etc.) to Date object
 */
function parseDate(dateString) {
  if (!dateString) return new Date();
  if (dateString instanceof Date) return dateString;


  const isoDate = new Date(dateString);
  if (!isNaN(isoDate.getTime())) return isoDate;

  //  DD-MM-YYYY format
  const ddmmyyyy = dateString.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  //  YYYY-MM-DD format
  const yyyymmdd = dateString.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Fallback to current date if parsing fails
  console.warn(`Could not parse date: ${dateString}, using current date`);
  return new Date();
}

/**
 * Process news items and categories to convert date strings to Date objects
 */
function processDigestData(data) {
  if (!data) return data;

  // Process newsItems
  if (data.newsItems && Array.isArray(data.newsItems)) {
    data.newsItems = data.newsItems.map(item => ({
      ...item,
      date: item.date ? parseDate(item.date) : new Date()
    }));
  }

  // Process categories
  if (data.categories && Array.isArray(data.categories)) {
    data.categories = data.categories.map(category => ({
      ...category,
      items: category.items && Array.isArray(category.items)
        ? category.items.map(item => ({
          ...item,
          date: item.date ? parseDate(item.date) : new Date()
        }))
        : []
    }));
  }

  return data;
}

/**
 * Sanitize digest data to ensure enum values are valid
 */
function sanitizeDigestData(data) {
  if (!data) return data;

  const validRelevance = ['high', 'medium', 'low'];
  const validDifficulty = ['easy', 'medium', 'hard'];
  const validUrgency = ['immediate', 'upcoming', 'monitor'];

  const sanitizeItem = (item) => {
    if (item.relevance) {
      const rel = item.relevance.toLowerCase();
      if (rel === 'moderate') item.relevance = 'medium';
      else if (!validRelevance.includes(rel)) item.relevance = 'medium';
      else item.relevance = rel;
    }
    return item;
  };

  // Sanitize newsItems
  if (data.newsItems && Array.isArray(data.newsItems)) {
    data.newsItems = data.newsItems.map(sanitizeItem);
  }

  // Sanitize categories
  if (data.categories && Array.isArray(data.categories)) {
    data.categories.forEach(cat => {
      if (cat.items && Array.isArray(cat.items)) {
        cat.items = cat.items.map(sanitizeItem);
      }
    });
  }

  // Sanitize practiceQuestions
  if (data.practiceQuestions && Array.isArray(data.practiceQuestions)) {
    data.practiceQuestions.forEach(q => {
      if (q.difficulty) {
        const diff = q.difficulty.toLowerCase();
        if (!validDifficulty.includes(diff)) q.difficulty = 'medium';
        else q.difficulty = diff;
      }
    });
  }

  // Sanitize trendWatch
  if (data.trendWatch && Array.isArray(data.trendWatch)) {
    data.trendWatch.forEach(t => {
      if (t.urgency) {
        const urg = t.urgency.toLowerCase();
        if (!validUrgency.includes(urg)) t.urgency = 'monitor';
        else t.urgency = urg;
      }
    });
  }

  return data;
}

/**
 * Safely parse JSON from AI responses with multiple fallback strategies
 * @param {string} content - The content to parse
 * @param {string} context - Context for logging (e.g., 'news data', 'digest')
 * @returns {object|null} Parsed JSON object or null if parsing fails
 */
function parseJSONSafely(content, context = 'response') {
  if (!content || typeof content !== 'string') {
    console.warn(`parseJSONSafely: Invalid content for ${context}`);
    return null;
  }

  const trimmedContent = content.trim();

  // Strategy 1: Try direct JSON.parse
  try {
    return JSON.parse(trimmedContent);
  } catch (e) {
    // Continue to next strategy
  }

  // Strategy 2: Extract JSON from markdown code blocks
  const codeBlockPatterns = [
    /```json\s*\n?([\s\S]*?)\n?```/i,
    /```\s*\n?([\s\S]*?)\n?```/,
  ];

  for (const pattern of codeBlockPatterns) {
    const match = trimmedContent.match(pattern);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1].trim());
      } catch (e) {
        // Try to repair and parse
        const repaired = tryRepairJSON(match[1].trim());
        if (repaired) return repaired;
      }
    }
  }

  // Strategy 3: Extract JSON object or array using regex
  const jsonPatterns = [
    /(\{[\s\S]*\})/,  // Match entire JSON object
    /(\[[\s\S]*\])/,  // Match entire JSON array
  ];

  for (const pattern of jsonPatterns) {
    const match = trimmedContent.match(pattern);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        // Try to clean and repair common JSON issues
        const cleaned = cleanJSON(match[1]);
        try {
          return JSON.parse(cleaned);
        } catch (e2) {
          // Try JSON repair library
          const repaired = tryRepairJSON(cleaned);
          if (repaired) return repaired;
        }
      }
    }
  }

  // All strategies failed
  console.error(`parseJSONSafely: Failed to parse ${context} after trying all strategies`);
  console.error(`Content preview (first 2000 chars): ${trimmedContent.substring(0, 2000)}`);
  return null;
}

/**
 * Attempt to repair malformed JSON using jsonrepair library
 * @param {string} jsonStr - The JSON string to repair
 * @returns {object|null} Parsed JSON object or null if repair fails
 */
function tryRepairJSON(jsonStr) {
  try {
    // Try to use jsonrepair library if available
    const { jsonrepair } = require('jsonrepair');
    const repaired = jsonrepair(jsonStr);
    return JSON.parse(repaired);
  } catch (e) {
    // jsonrepair not available or failed, return null
    return null;
  }
}

/**
 * Clean common JSON formatting issues
 * @param {string} jsonStr - The JSON string to clean
 * @returns {string} Cleaned JSON string
 */
function cleanJSON(jsonStr) {
  let cleaned = jsonStr;

  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim();

  // Remove any text before the first { or [
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIndex = -1;

  if (firstBrace !== -1 && firstBracket !== -1) {
    startIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
  }

  if (startIndex > 0) {
    cleaned = cleaned.substring(startIndex);
  }

  // Remove any text after the last } or ]
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  let endIndex = -1;

  if (lastBrace !== -1 && lastBracket !== -1) {
    endIndex = Math.max(lastBrace, lastBracket);
  } else if (lastBrace !== -1) {
    endIndex = lastBrace;
  } else if (lastBracket !== -1) {
    endIndex = lastBracket;
  }

  if (endIndex !== -1 && endIndex < cleaned.length - 1) {
    cleaned = cleaned.substring(0, endIndex + 1);
  }

  // Remove trailing commas before closing brackets/braces
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // Remove control characters and zero-width characters
  cleaned = cleaned.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '');

  // Try to close unclosed strings by adding missing quotes
  const openQuotes = (cleaned.match(/(?<!\\)"/g) || []).length;
  if (openQuotes % 2 !== 0) {
    // Odd number of quotes, try to close the last one
    cleaned = cleaned + '"';
  }

  // Try to close unclosed arrays/objects
  const openBraces = (cleaned.match(/\{/g) || []).length;
  const closeBraces = (cleaned.match(/\}/g) || []).length;
  const openBrackets = (cleaned.match(/\[/g) || []).length;
  const closeBrackets = (cleaned.match(/\]/g) || []).length;

  // Add missing closing braces/brackets
  if (openBrackets > closeBrackets) {
    cleaned = cleaned + ']'.repeat(openBrackets - closeBrackets);
  }
  if (openBraces > closeBraces) {
    cleaned = cleaned + '}'.repeat(openBraces - closeBraces);
  }

  return cleaned;
}

/**
 * Translate digest content to target language using Azure Translator
 */
async function translateDigestContent(data, targetLanguage) {
  if (!data || targetLanguage === 'en') return data;

  const translated = { ...data };

  // Translate title
  if (data.title) {
    try {
      translated.title = await translateText(data.title, 'en', targetLanguage, true);
    } catch (e) {
      console.warn('Failed to translate title:', e.message);
    }
  }

  // Translate summary
  if (data.summary) {
    try {
      translated.summary = await translateText(data.summary, 'en', targetLanguage, true);
    } catch (e) {
      console.warn('Failed to translate summary:', e.message);
    }
  }

  // Translate key highlights
  if (data.keyHighlights && Array.isArray(data.keyHighlights)) {
    translated.keyHighlights = await Promise.all(
      data.keyHighlights.map(async (highlight) => {
        try {
          return await translateText(highlight, 'en', targetLanguage, true);
        } catch (e) {
          console.warn('Failed to translate highlight:', e.message);
          return highlight;
        }
      })
    );
  }

  // Translate news items
  if (data.newsItems && Array.isArray(data.newsItems)) {
    translated.newsItems = await Promise.all(
      data.newsItems.map(async (item) => {
        const translatedItem = { ...item };
        try {
          if (item.title) {
            translatedItem.title = await translateText(item.title, 'en', targetLanguage, true);
          }
          if (item.summary) {
            translatedItem.summary = await translateText(item.summary, 'en', targetLanguage, true);
          }
          if (item.source) {
            translatedItem.source = await translateText(item.source, 'en', targetLanguage, true);
          }
          if (item.category) {
            translatedItem.category = await translateText(item.category, 'en', targetLanguage, true);
          }
          if (item.tags && Array.isArray(item.tags)) {
            translatedItem.tags = await Promise.all(
              item.tags.map(async (tag) => {
                try {
                  return await translateText(tag, 'en', targetLanguage, true);
                } catch (e) {
                  return tag;
                }
              })
            );
          }
        } catch (e) {
          console.warn('Failed to translate news item:', e.message);
        }
        return translatedItem;
      })
    );
  }

  // Translate categories
  if (data.categories && Array.isArray(data.categories)) {
    translated.categories = await Promise.all(
      data.categories.map(async (category) => {
        const translatedCategory = { ...category };
        try {
          if (category.name) {
            translatedCategory.name = await translateText(category.name, 'en', targetLanguage, true);
          }
          if (category.items && Array.isArray(category.items)) {
            translatedCategory.items = await Promise.all(
              category.items.map(async (item) => {
                const translatedItem = { ...item };
                try {
                  if (item.title) {
                    translatedItem.title = await translateText(item.title, 'en', targetLanguage, true);
                  }
                  if (item.summary) {
                    translatedItem.summary = await translateText(item.summary, 'en', targetLanguage, true);
                  }
                  if (item.source) {
                    translatedItem.source = await translateText(item.source, 'en', targetLanguage, true);
                  }
                  if (item.category) {
                    translatedItem.category = await translateText(item.category, 'en', targetLanguage, true);
                  }
                  if (item.tags && Array.isArray(item.tags)) {
                    translatedItem.tags = await Promise.all(
                      item.tags.map(async (tag) => {
                        try {
                          return await translateText(tag, 'en', targetLanguage, true);
                        } catch (e) {
                          return tag;
                        }
                      })
                    );
                  }
                } catch (e) {
                  console.warn('Failed to translate category item:', e.message);
                }
                return translatedItem;
              })
            );
          }
        } catch (e) {
          console.warn('Failed to translate category:', e.message);
        }
        return translatedCategory;
      })
    );
  }

  if (data.practiceQuestions && Array.isArray(data.practiceQuestions)) {
    translated.practiceQuestions = await Promise.all(
      data.practiceQuestions.map(async (item) => {
        const translatedItem = { ...item };
        try {
          if (item.question) {
            translatedItem.question = await translateText(item.question, 'en', targetLanguage, true);
          }
          if (item.answerKey) {
            translatedItem.answerKey = await translateText(item.answerKey, 'en', targetLanguage, true);
          }
          if (item.subjectTag) {
            translatedItem.subjectTag = await translateText(item.subjectTag, 'en', targetLanguage, true);
          }
          if (item.gsPaper) {
            translatedItem.gsPaper = await translateText(item.gsPaper, 'en', targetLanguage, true);
          }
        } catch (e) {
          console.warn('Failed to translate practice question:', e.message);
        }
        return translatedItem;
      })
    );
  }

  if (data.trendWatch && Array.isArray(data.trendWatch)) {
    translated.trendWatch = await Promise.all(
      data.trendWatch.map(async (item) => {
        const translatedItem = { ...item };
        try {
          if (item.theme) {
            translatedItem.theme = await translateText(item.theme, 'en', targetLanguage, true);
          }
          if (item.insight) {
            translatedItem.insight = await translateText(item.insight, 'en', targetLanguage, true);
          }
          if (item.examImpact) {
            translatedItem.examImpact = await translateText(item.examImpact, 'en', targetLanguage, true);
          }
        } catch (e) {
          console.warn('Failed to translate trend insight:', e.message);
        }
        return translatedItem;
      })
    );
  }

  if (data.sourceNotes && Array.isArray(data.sourceNotes)) {
    translated.sourceNotes = await Promise.all(
      data.sourceNotes.map(async (note) => {
        try {
          return await translateText(note, 'en', targetLanguage, true);
        } catch (e) {
          return note;
        }
      })
    );
  }

  // Translate exam relevance
  if (data.examRelevance) {
    translated.examRelevance = {};
    for (const [exam, topics] of Object.entries(data.examRelevance)) {
      if (Array.isArray(topics)) {
        translated.examRelevance[exam] = await Promise.all(
          topics.map(async (topic) => {
            try {
              return await translateText(topic, 'en', targetLanguage, true);
            } catch (e) {
              return topic;
            }
          })
        );
      }
    }
  }

  return translated;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await connectToDatabase();

    if (req.method === 'GET') {
      const { period = 'daily', language = 'en', limit = 5, focus, startDate, endDate } = req.query;
      const limitNum = Math.min(20, Math.max(1, parseInt(limit, 10) || 5));

      const filter = { language };
      if (period !== 'all') {
        filter.period = period;
      }
      if (startDate || endDate) {
        filter.startDate = {};
        if (startDate) filter.startDate.$gte = new Date(startDate);
        if (endDate) filter.startDate.$lte = new Date(endDate);
      }
      if (focus) {
        const focusAreas = focus.split(',').map((item) => item.trim()).filter(Boolean);
        if (focusAreas.length) {
          filter.focusAreas = { $in: focusAreas };
        }
      }

      const digests = await CurrentAffairsDigest.find(filter)
        .sort({ startDate: -1 })
        .limit(limitNum)
        .lean();

      return res.status(200).json({ digests });
    }

    let {
      period = 'daily',
      startDate,
      endDate,
      categories = [],
      language = 'en',
      focusAreas = [],
      includePractice = true,
      includeTrendWatch = true,
      limitPerCategory = 3
    } = req.body;

    // Normalize period input
    if (period) {
      period = String(period).toLowerCase().trim();
    }
    console.log(`[DigestAPI] Generating digest for period: "${period}"`);

    const preferences = session.user?.preferences || {};
    // For current affairs digest, prefer Perplexity for real-time web search capabilities if available
    // Otherwise fall back to OpenAI
    // User requested to use ONLY OpenAI for current affairs
    const preferredProvider = 'openai';
    const preferredOpenAIModel = preferences.openAIModel || process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o';
    // Use the OpenAI model as the preferred model
    const preferredModel = preferredOpenAIModel;
    const excludedProviders = preferences.excludedProviders || [];

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();
    const safeLimitPerCategory = Math.min(5, Math.max(1, parseInt(limitPerCategory, 10) || 3));

    const defaultCategories = [
      'National Affairs',
      'International Affairs',
      'Science & Technology',
      'Environment & Ecology',
      'Economy & Finance',
      'Sports & Culture',
      'Awards & Honours',
      'Government Schemes',
      'Judicial Developments',
      'Defense & Security'
    ];

    const requestedCategories = Array.isArray(categories) && categories.length ? categories : defaultCategories;

    const existing = await CurrentAffairsDigest.findOne({
      period,
      language,
      startDate: { $gte: start, $lte: end }
    });

    if (existing) {
      const existingResponse = existing.toObject ? existing.toObject() : existing;
      return res.status(200).json({ digest: existingResponse, cached: true });
    }

    const languageNames = {
      en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', bn: 'Bengali',
      pa: 'Punjabi', gu: 'Gujarati', te: 'Telugu', ml: 'Malayalam',
      kn: 'Kannada', es: 'Spanish'
    };
    const langName = languageNames[language] || 'English';

    const focusInstruction = focusAreas.length
      ? `Give special emphasis to the following focus areas: ${focusAreas.join(', ')}.`
      : '';

    const categoryInstruction = `Limit each category to at most ${safeLimitPerCategory} high-impact items. Categories to prioritise: ${requestedCategories.join(', ')}.`;

    const practiceInstruction = includePractice
      ? 'Include a "practiceQuestions" array with 2-3 exam-ready questions (mention exam targets, GS paper, difficulty, and answerKey).'
      : 'Set "practiceQuestions": [] if there are no exam-ready questions to share.';

    const trendInstruction = includeTrendWatch
      ? 'Provide a "trendWatch" section with key themes, insights, exam impact, and urgency labels (immediate, upcoming, monitor).'
      : 'Set "trendWatch": [] if no patterns are observed.';

    const systemPrompt = `You are an expert current affairs analyst specializing in competitive exam preparation (UPSC, PCS, SSC). Your task is to create comprehensive current affairs digests that are:

REQUIREMENTS:
1. **USE PROVIDED DATA**: When news data is provided, use it as the primary source. Supplement with your knowledge base as needed.
2. **VERIFIABLE INFORMATION**: Only include information you are confident about. Provide sources when available.
3. **EXAM-RELEVANT**: Focus exclusively on topics likely to appear in competitive exams. Every item must have clear exam relevance.
4. **PROPER SUBJECT TAGGING**: Tag each news item with subject areas (Polity, History, Geography, Economics, Science & Technology, Environment, etc.) and relevant GS papers (GS-1, GS-2, GS-3, GS-4) or Prelims/Mains context.
5. **SOURCE ATTRIBUTION**: Mention sources for information: "According to [official source]" or "As reported by [reliable news source]".
6. **WELL-ORGANIZED**: Categorized by topics (National, International, Science & Tech, Economy, etc.)
7. **CONCISE**: Clear summaries with key points
8. **ACTIONABLE**: Include exam relevance indicators, subject tags, GS paper references, and exam-focused notes.`;

    // First, fetch real-time news to base the digest on
    let realNewsData = [];
    try {
      console.log('Fetching recent news for digest via RSS...');
      const dateRangeDays = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;

      // Fetch from Google News RSS
      const rssItems = await fetchGoogleNewsRSS(`"UPSC" India Current Affairs`, dateRangeDays);

      if (rssItems && rssItems.length > 0) {
        realNewsData = rssItems.map(item => ({
          title: item.title,
          summary: item.description,
          category: 'General', // We'll let the main AI categorize it better later
          date: item.pubDate,
          source: item.source,
          relevance: 'high',
          keyPoints: [],
          tags: []
        }));
        console.log(`Fetched ${realNewsData.length} items from Google News RSS`);
      } else {
        console.warn('No items found in RSS feed, digest will rely on AI internal knowledge.');
      }
    } catch (error) {
      console.warn('Error in news fetching process:', error.message);
      // Continue with AI generation as fallback
    }

    // Build context from real news
    const realNewsContext = Array.isArray(realNewsData) && realNewsData.length > 0
      ? `\n\nUSE THIS NEWS DATA as the primary source for your digest:\n\n${JSON.stringify(realNewsData.slice(0, 20), null, 2)}\n\nBase your digest on this data. Include dates, sources, and facts from this data.`
      : `\n\nProvide a comprehensive current affairs digest based on recent developments relevant for competitive exams. Include the most recent information from your knowledge base with proper dates and sources.`;

    const userPrompt = `Create a ${period} current affairs digest for ${langName} readers covering ${start.toDateString()} to ${end.toDateString()}.${realNewsContext}

${categoryInstruction}
${focusInstruction}
${practiceInstruction}
${trendInstruction}

IMPORTANT: 
- Include actual dates and sources for all news items
- Focus on exam-relevant developments
- Provide proper subject tagging and GS paper references

CRITICAL: Return ONLY valid JSON wrapped in a markdown code block. Do not include any explanatory text before or after the JSON.

Structure the response as:
\`\`\`json
{
  "title": "Current Affairs Digest - ${period}",
  "summary": "...",
  "keyHighlights": ["...", "..."],
  "newsItems": [
    {
      "title": "...",
      "summary": "...",
      "source": "...",
      "date": "YYYY-MM-DD",
      "category": "National Affairs",
      "tags": ["Polity", "GS-2"],
      "relevance": "high|medium|low",
      "subjectTag": "Polity",
      "gsPaper": "GS-2",
      "examRelevance": ["UPSC", "PCS"]
    }
  ],
  "categories": [
    {
      "name": "Economy & Finance",
      "count": 2,
      "items": [/* mapped news items */]
    }
  ],
  "examRelevance": {
    "upsc": ["..."],
    "pcs": ["..."],
    "ssc": ["..."]
  },
  "practiceQuestions": [
    {
      "question": "...",
      "answerKey": "...",
      "subjectTag": "Economics",
      "gsPaper": "GS-3",
      "difficulty": "medium",
      "examTargets": ["UPSC"]
    }
  ],
  "trendWatch": [
    {
      "theme": "...",
      "insight": "...",
      "examImpact": "...",
      "urgency": "monitor"
    }
  ],
  "sourceNotes": ["PIB - ...", "The Hindu - ..."]
}
\`\`\`

Remember: ONLY return the JSON code block, nothing else.`;

    let parsedData;
    try {
      // Use Perplexity for real-time web search to get latest news
      const aiResult = await callAIWithFallback(
        [{ role: 'user', content: userPrompt }],
        systemPrompt,
        3500,
        0.6,
        {
          model: preferredModel,
          preferredProvider: 'openai', // Force OpenAI
          excludeProviders: ['perplexity'], // Explicitly exclude Perplexity
          openAIModel: preferredOpenAIModel
        }
      );
      const aiResponse = aiResult?.content || '';
      parsedData = parseJSONSafely(aiResponse, 'current affairs digest');

      if (!parsedData) {
        throw new Error('Failed to parse AI response as valid JSON');
      }
    } catch (aiError) {
      console.error('AI generation failed for current affairs digest, using fallback content:', aiError?.message);
      parsedData = null;
    }

    if (!parsedData) {
      const formattedStart = start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const formattedEnd = end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      parsedData = {
        title: `Current Affairs Digest - ${period.charAt(0).toUpperCase() + period.slice(1)}`,
        summary: `Key developments between ${formattedStart} and ${formattedEnd} across governance, economy, and science.`,
        keyHighlights: [
          'Focus on government initiatives with impact on governance and welfare delivery.',
          'Track global developments affecting India’s strategic and economic interests.',
          'Review science and technology breakthroughs relevant for prelims and mains.'
        ],
        newsItems: [],
        categories: [],
        examRelevance: { upsc: [], pcs: [], ssc: [] },
        practiceQuestions: [],
        trendWatch: [],
        sourceNotes: []
      };
    }

    const processedData = processDigestData(parsedData);
    const sanitizedData = sanitizeDigestData(processedData);
    let finalData = sanitizedData || parsedData;

    if (language && language !== 'en') {
      try {
        console.log(`Translating digest content to ${language} using Azure Translator...`);
        finalData = await translateDigestContent(finalData, language);
        console.log('Translation completed successfully');
      } catch (translationError) {
        console.warn('Translation failed, using English content:', translationError.message);
      }
    }

    const digestData = {
      title: finalData.title || processedData.title || parsedData.title || `Current Affairs Digest - ${period}`,
      period,
      language,
      startDate: start,
      endDate: end,
      newsItems: finalData.newsItems || processedData.newsItems || parsedData.newsItems || [],
      categories: finalData.categories || processedData.categories || parsedData.categories || [],
      summary: finalData.summary || processedData.summary || parsedData.summary || '',
      keyHighlights: finalData.keyHighlights || processedData.keyHighlights || parsedData.keyHighlights || [],
      examRelevance: finalData.examRelevance || processedData.examRelevance || parsedData.examRelevance || { upsc: [], pcs: [], ssc: [] },
      focusAreas,
      requestedCategories,
      practiceQuestions: includePractice ? (finalData.practiceQuestions || []) : [],
      trendWatch: includeTrendWatch ? (finalData.trendWatch || []) : [],
      sourceNotes: finalData.sourceNotes || [],
    };

    const digest = await CurrentAffairsDigest.create(digestData);
    const digestResponse = digest.toObject ? digest.toObject() : digest;

    // Track the digest generation
    try {
      // Get or create session ID
      let sessionId = req.cookies.sessionId;
      if (!sessionId) {
        sessionId = uuidv4();
        res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`);
      }

      await trackInteraction(
        session?.user?.email || null,
        sessionId,
        'current_affairs',
        'digest_generate',
        'generate',
        {
          topic: 'Current Affairs',
          category: 'current_affairs',
          engagementScore: 7,
          customData: {
            period,
            timePeriod: period,
            days: period === 'daily' ? 1 : period === 'weekly' ? 7 : 30,
            newsCount: digestData.newsItems?.length || 0,
            categoriesCount: digestData.categories?.length || 0,
            practiceQuestionsCount: digestData.practiceQuestions?.length || 0,
            language,
            focusAreas
          }
        },
        {
          userAgent: req.headers['user-agent']
        }
      );
    } catch (trackError) {
      console.error('Failed to track digest generation:', trackError);
    }

    return res.status(200).json({ digest: digestResponse, cached: false });
  } catch (error) {
    console.error('Error generating current affairs digest:', error);
    return res.status(500).json({ error: 'Failed to generate digest', details: error.message });
  }
}
