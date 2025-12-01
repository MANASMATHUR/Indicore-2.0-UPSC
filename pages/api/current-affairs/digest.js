import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import CurrentAffairsDigest from '@/models/CurrentAffairsDigest';
import { callAIWithFallback } from '@/lib/ai-providers';
import { translateText } from '@/pages/api/ai/translate';

/**
 * Parse date string in various formats (DD-MM-YYYY, YYYY-MM-DD, etc.) to Date object
 */
function parseDate(dateString) {
  if (!dateString) return new Date();
  if (dateString instanceof Date) return dateString;

  // Try ISO format first
  const isoDate = new Date(dateString);
  if (!isNaN(isoDate.getTime())) return isoDate;

  // Try DD-MM-YYYY format
  const ddmmyyyy = dateString.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Try YYYY-MM-DD format
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

    const {
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

    const preferences = session.user?.preferences || {};
    // For current affairs digest, prefer Perplexity for real-time web search capabilities if available
    // Otherwise fall back to OpenAI
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY;
    const preferredProvider = hasPerplexity ? 'perplexity' : 'openai';
    const preferredModel = hasPerplexity ? 'sonar-pro' : (preferences.openAIModel || process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o-mini');
    const preferredOpenAIModel = preferences.openAIModel || process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o-mini';
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

CRITICAL REQUIREMENTS:
1. **USE REAL-TIME DATA**: When real-time news data is provided, you MUST use it as the primary source. DO NOT rely on your training data cutoff. Today's date is ${new Date().toISOString().split('T')[0]}.
2. **ONLY VERIFIABLE INFORMATION**: NEVER make up facts, dates, names, or statistics. Only include information you can verify from the provided news data or reliable sources.
3. **CURRENT DATES**: All dates must be current (${new Date().toISOString().split('T')[0]} or recent). If you cannot provide current information, clearly state that verification is needed.
4. **EXAM-RELEVANT**: Focus exclusively on topics likely to appear in competitive exams. Every item must have clear exam relevance.
5. **PROPER SUBJECT TAGGING**: Tag each news item with subject areas (Polity, History, Geography, Economics, Science & Technology, Environment, etc.) and relevant GS papers (GS-1, GS-2, GS-3, GS-4) or Prelims/Mains context.
6. **SOURCE ATTRIBUTION**: When information is outside your direct knowledge, provide sources: "According to [official source]" or "As reported by [reliable news source]". For government schemes, mention official documents or ministry sources.
7. **WELL-ORGANIZED**: Categorized by topics (National, International, Science & Tech, Economy, etc.)
8. **CONCISE**: Clear summaries with key points
9. **ACTIONABLE**: Include exam relevance indicators, subject tags, GS paper references, and a short exam-focused note.

IMPORTANT: If real-time news data is provided in the user's message, prioritize that data over any information from your training. Always use the most recent dates and information available.`;

    // First, fetch real-time news to ensure we have latest information
    let realNewsData = [];
    try {
      console.log('Fetching real-time news for digest...');
      // Use Perplexity or OpenAI with web search for real-time news
      const dateRangeDays = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
      const newsQuery = `Get latest current affairs and news relevant for UPSC exam preparation from the last ${dateRangeDays} days. Focus on: ${requestedCategories.join(', ')}. Provide actual current dates and sources. Today's date is ${new Date().toISOString().split('T')[0]}.`;

      // Try to get real-time news using Perplexity (which has web search) or OpenAI
      const newsSystemPrompt = `You are a current affairs news aggregator. Fetch and provide REAL-TIME news from the last ${dateRangeDays} days relevant for competitive exams. Today is ${new Date().toISOString().split('T')[0]}. Include actual dates, sources, and current information. Format as JSON array with: title, summary, category, date (YYYY-MM-DD), source, relevance, keyPoints, tags.`;

      try {
        const newsAIResult = await callAIWithFallback(
          [{ role: 'user', content: newsQuery }],
          newsSystemPrompt,
          2000,
          0.7,
          {
            model: preferredModel,
            preferredProvider: preferredProvider, // Use dynamic provider
            excludeProviders: [],
            openAIModel: preferredOpenAIModel
          }
        );

        const newsContent = newsAIResult?.content || '';
        if (newsContent) {
          try {
            const jsonMatch = newsContent.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              // Ensure it's an array
              if (Array.isArray(parsed)) {
                realNewsData = parsed;
                console.log(`Fetched ${realNewsData.length} real-time news items`);
              } else {
                console.warn('Parsed news data is not an array');
              }
            }
          } catch (parseError) {
            console.warn('Could not parse news data:', parseError.message);
          }
        }
      } catch (newsError) {
        console.warn('Error fetching real-time news via AI:', newsError.message);
      }
    } catch (error) {
      console.warn('Error in news fetching process:', error.message);
      // Continue with AI generation as fallback
    }

    // Build context from real news
    const realNewsContext = Array.isArray(realNewsData) && realNewsData.length > 0
      ? `\n\nIMPORTANT: Use the following REAL-TIME NEWS DATA (fetched on ${new Date().toISOString().split('T')[0]}) as the PRIMARY SOURCE for this digest:\n\n${JSON.stringify(realNewsData.slice(0, 20), null, 2)}\n\nBase your digest on this real-time data. Include actual dates, sources, and facts from this data. DO NOT use outdated information from your training data.`
      : `\n\nCRITICAL: You MUST provide CURRENT and REAL-TIME information. Today's date is ${new Date().toISOString().split('T')[0]}. Do NOT use information from your training data cutoff. Focus on recent developments that would be relevant for competitive exams. If you cannot provide current information, clearly state that the information may need verification.`;

    const userPrompt = `Create a ${period} current affairs digest for ${langName} readers covering ${start.toDateString()} to ${end.toDateString()}.${realNewsContext}

${categoryInstruction}
${focusInstruction}
${practiceInstruction}
${trendInstruction}

IMPORTANT: 
- Use ONLY the real-time news data provided above
- Include actual dates from the news data
- Reference actual sources mentioned in the news
- Today's date is ${new Date().toISOString().split('T')[0]} - ensure all dates are current
- If real news data is provided, prioritize it over any training data

Structure the response as JSON:
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
}`;

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
          preferredProvider: preferredProvider, // Use dynamic provider based on availability

          excludeProviders: [], // Allow fallback if Perplexity fails
          openAIModel: preferredOpenAIModel
        }
      );
      const aiResponse = aiResult?.content || '';
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (aiError) {
      console.warn('AI generation failed for current affairs digest, using fallback content:', aiError?.message);
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

    return res.status(200).json({ digest: digestResponse, cached: false });
  } catch (error) {
    console.error('Error generating current affairs digest:', error);
    return res.status(500).json({ error: 'Failed to generate digest', details: error.message });
  }
}

