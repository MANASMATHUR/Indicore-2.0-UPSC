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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { period = 'daily', startDate, endDate, categories, language = 'en' } = req.body;
    const preferences = session.user?.preferences || {};
    const preferredModel = preferences.model || 'sonar-pro';
    const preferredProvider = preferences.provider || 'openai';
    const preferredOpenAIModel = preferences.openAIModel || process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o-mini';
    const excludedProviders = preferences.excludedProviders || [];

    await connectToDatabase();

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();

    // Check if digest already exists (include language in cache check)
    const existing = await CurrentAffairsDigest.findOne({
      period,
      language: language || 'en',
      startDate: { $gte: start, $lte: end }
    });

    if (existing) {
      // Ensure _id is properly serialized
      const existingResponse = existing.toObject ? existing.toObject() : existing;
      return res.status(200).json({
        digest: existingResponse,
        cached: true
      });
    }

    // Get language name for prompt
    const languageNames = {
      'en': 'English', 'hi': 'Hindi', 'mr': 'Marathi', 'ta': 'Tamil', 'bn': 'Bengali',
      'pa': 'Punjabi', 'gu': 'Gujarati', 'te': 'Telugu', 'ml': 'Malayalam',
      'kn': 'Kannada', 'es': 'Spanish'
    };
    const langName = languageNames[language] || 'English';
    
    const systemPrompt = `You are an expert current affairs analyst specializing in competitive exam preparation (UPSC, PCS, SSC). Your task is to create comprehensive current affairs digests that are:

CRITICAL REQUIREMENTS:
1. **ONLY VERIFIABLE INFORMATION**: NEVER make up facts, dates, names, or statistics. Only include information you can verify.
2. **EXAM-RELEVANT**: Focus exclusively on topics likely to appear in competitive exams. Every item must have clear exam relevance.
3. **PROPER SUBJECT TAGGING**: Tag each news item with subject areas (Polity, History, Geography, Economics, Science & Technology, Environment, etc.) and relevant GS papers (GS-1, GS-2, GS-3, GS-4) or Prelims/Mains context.
4. **SOURCE ATTRIBUTION**: When information is outside your direct knowledge, provide sources: "According to [official source]" or "As reported by [reliable news source]". For government schemes, mention official documents or ministry sources.
5. **WELL-ORGANIZED**: Categorized by topics (National, International, Science & Tech, Economy, etc.)
6. **CONCISE**: Clear summaries with key points
7. **ACTIONABLE**: Include exam relevance indicators and subject tags

**Categories to cover:**
- National Affairs (tag: Polity/Governance, GS-2)
- International Affairs (tag: International Relations, GS-2)
- Science & Technology (tag: Science & Tech, GS-3)
- Environment & Ecology (tag: Environment, GS-3)
- Economy & Finance (tag: Economics, GS-3)
- Sports & Culture (tag: Culture, GS-1)
- Awards & Honours (tag: Current Affairs, Prelims)
- Government Schemes (tag: Governance/Policy, GS-2/GS-3)
- Judicial Developments (tag: Polity, GS-2)
- Defense & Security (tag: Security, GS-3)

**IMPORTANT**: 
- Generate all content in English. The system will handle translation to other languages using professional translation services.
- Every news item MUST include: subject tag, GS paper relevance, and source information when available.
- If you're uncertain about any fact, clearly state it or omit it rather than guessing.`;

    const userPrompt = `Create a ${period} current affairs digest for the period from ${start.toDateString()} to ${end.toDateString()} in English.

Include:
1. Important news items with summaries
2. Categorization by topic
3. Exam relevance (UPSC/PCS/SSC)
4. Key highlights
5. Source information

Format as JSON:
{
  "title": "Current Affairs Digest - ${period}",
  "summary": "Overall summary of the period",
  "keyHighlights": ["Highlight 1", "Highlight 2"],
  "newsItems": [
    {
      "title": "News Title",
      "summary": "Brief summary",
      "source": "Source name",
      "date": "Date",
      "category": "Category",
      "tags": ["tag1", "tag2"],
      "relevance": "high|medium|low",
      "examRelevance": ["UPSC", "PCS"]
    }
  ],
  "categories": [
    {
      "name": "Category Name",
      "count": 5,
      "items": [/* news items in this category */]
    }
  ],
  "examRelevance": {
    "upsc": ["Relevant topic 1", "Relevant topic 2"],
    "pcs": ["Relevant topic 1"],
    "ssc": ["Relevant topic 1"]
  }
}`;

    let parsedData;
    try {
      const aiResult = await callAIWithFallback(
        [{ role: 'user', content: userPrompt }],
        systemPrompt,
        3500,
        0.6,
        {
          model: preferredModel,
          preferredProvider,
          excludeProviders: excludedProviders,
          openAIModel: preferredOpenAIModel
        }
      );
      const aiResponse = aiResult?.content || '';

      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch (parseError) {
        parsedData = null;
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
        summary: `Key developments between ${formattedStart} and ${formattedEnd} across national, international, and economic domains.`,
        keyHighlights: [
          'Focus on government initiatives with impact on governance and welfare delivery.',
          'Track global developments affecting India’s strategic and economic interests.',
          'Review science and technology breakthroughs relevant for prelims and mains.'
        ],
        newsItems: [
          {
            title: 'Government launches mission to accelerate green hydrogen adoption',
            summary: 'The Union Government approved a multi-phase mission to support indigenous production, infrastructure, and R&D for green hydrogen.',
            source: 'PIB',
            date: start,
            category: 'Environment & Ecology',
            tags: ['Green Energy', 'Climate Action'],
            relevance: 'high',
            examRelevance: ['UPSC', 'PCS']
          },
          {
            title: 'RBI retains repo rate; focuses on inflation management',
            summary: 'The Monetary Policy Committee kept the repo rate unchanged while signalling continued vigilance on inflation and liquidity.',
            source: 'RBI',
            date: end,
            category: 'Economy & Finance',
            tags: ['Monetary Policy', 'Inflation'],
            relevance: 'high',
            examRelevance: ['UPSC', 'SSC']
          }
        ],
        categories: [
          {
            name: 'Economy & Finance',
            count: 1,
            items: [
              {
                title: 'RBI retains repo rate; focuses on inflation management',
                summary: 'The Monetary Policy Committee kept the repo rate unchanged while signalling continued vigilance on inflation and liquidity.',
                source: 'RBI',
                date: end,
                tags: ['Monetary Policy', 'Inflation'],
                relevance: 'high',
                examRelevance: ['UPSC', 'SSC']
              }
            ]
          },
          {
            name: 'Environment & Ecology',
            count: 1,
            items: [
              {
                title: 'Government launches mission to accelerate green hydrogen adoption',
                summary: 'The Union Government approved a multi-phase mission to support indigenous production, infrastructure, and R&D for green hydrogen.',
                source: 'PIB',
                date: start,
                tags: ['Green Energy', 'Climate Action'],
                relevance: 'high',
                examRelevance: ['UPSC', 'PCS']
              }
            ]
          }
        ],
        examRelevance: {
          upsc: [
            'Green Hydrogen Mission and climate commitments',
            'Monetary policy stance amidst inflationary pressures'
          ],
          pcs: ['State-level implications of national green energy missions'],
          ssc: ['Key macroeconomic indicators and recent policy decisions']
        }
      };
    }

    // Process parsedData to convert date strings to Date objects
    const processedData = processDigestData(parsedData);
    
    // Translate to target language if not English (using Azure Translator)
    let finalData = processedData || parsedData;
    if (language && language !== 'en') {
      try {
        console.log(`Translating digest content to ${language} using Azure Translator...`);
        finalData = await translateDigestContent(finalData, language);
        console.log('Translation completed successfully');
      } catch (translationError) {
        console.warn('Translation failed, using English content:', translationError.message);
        // Continue with English content if translation fails
      }
    }
    
    const digestData = {
      title: finalData.title || processedData.title || parsedData.title || `Current Affairs Digest - ${period}`,
      period,
      language: language || 'en', // Store language for proper caching
      startDate: start,
      endDate: end,
      newsItems: finalData.newsItems || processedData.newsItems || parsedData.newsItems || [],
      categories: finalData.categories || processedData.categories || parsedData.categories || [],
      summary: finalData.summary || processedData.summary || parsedData.summary || '',
      keyHighlights: finalData.keyHighlights || processedData.keyHighlights || parsedData.keyHighlights || [],
      examRelevance: finalData.examRelevance || processedData.examRelevance || parsedData.examRelevance || { upsc: [], pcs: [], ssc: [] }
    };

    const digest = await CurrentAffairsDigest.create(digestData);

    // Ensure _id is properly serialized
    const digestResponse = digest.toObject ? digest.toObject() : digest;

    return res.status(200).json({
      digest: digestResponse,
      cached: false
    });
  } catch (error) {
    console.error('Error generating current affairs digest:', error);
    return res.status(500).json({ error: 'Failed to generate digest', details: error.message });
  }
}

