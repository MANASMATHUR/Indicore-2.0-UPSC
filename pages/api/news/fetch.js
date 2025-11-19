import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import axios from 'axios';
import { callOpenAIAPI, getOpenAIKey } from '@/lib/ai-providers';
import { storeTrendingSnapshot } from '@/lib/cacheLayer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { 
      examType = 'UPSC', 
      category = '', 
      dateRange = '7', 
      searchQuery = '' 
    } = req.body;

    const openAIKey = getOpenAIKey();
    if (!openAIKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    let query = `Get latest current affairs and news relevant for ${examType} exam preparation`;
    
    if (category) {
      query += ` in the category: ${category}`;
    }
    
    if (dateRange) {
      const days = parseInt(dateRange);
      if (days === 1) {
        query += ` from the last 24 hours`;
      } else if (days === 7) {
        query += ` from the last 7 days`;
      } else if (days === 30) {
        query += ` from the last 30 days`;
      } else if (days === 90) {
        query += ` from the last 3 months`;
      }
    }
    
    if (searchQuery) {
      query += `. Focus on topics related to: ${searchQuery}`;
    }

    query += `. Provide a structured list of news items with:
1. Title
2. Brief summary (2-3 sentences)
3. Category
4. Date (if available)
5. Relevance to competitive exams
6. Key points/exam-relevant aspects

Format the response as a JSON array of news items, where each item has: title, summary, category, date, relevance, keyPoints (array), and tags (array).`;

    const systemPrompt = `You are Indicore, an AI assistant specialized in providing current affairs and news relevant to competitive exams like UPSC, PCS, and SSC. 

CRITICAL REQUIREMENTS:
1. **ONLY VERIFIABLE INFORMATION**: NEVER make up facts, dates, names, or statistics. Only include information you can verify. If uncertain, state it clearly or omit it.
2. **SOURCE ATTRIBUTION**: When information is outside your direct knowledge, provide sources: "According to [official source]" or "As reported by [reliable news source]". For government schemes, mention official documents or ministry sources.
3. **PROPER SUBJECT TAGGING**: Tag each news item with subject areas (Polity, History, Geography, Economics, Science & Technology, Environment, etc.) and relevant GS papers (GS-1, GS-2, GS-3, GS-4) or Prelims/Mains context.

**EXAM-FOCUSED REQUIREMENTS:**
1. **UPSC Relevance**: Focus on topics that appear in GS papers (GS-1, GS-2, GS-3, GS-4), Prelims, and Essay papers. Prioritize:
   - Constitutional provisions, amendments, and judicial interpretations
   - Government schemes, policies, and their implementation
   - International relations, bilateral/multilateral agreements
   - Economic policies, budget, fiscal measures
   - Science & Technology developments with policy implications
   - Environment and ecology (climate change, biodiversity, conservation)
   - Social issues, governance, and administration

2. **PCS Relevance**: Focus on state-specific policies, state government schemes, state-level governance, and regional current affairs relevant to state civil services.

3. **SSC Relevance**: Focus on general awareness topics, government schemes, important appointments, awards, and national/international events.

**Content Quality Standards:**
- Provide precise, factual information with dates and context
- Highlight exam-relevant aspects: constitutional articles, government schemes, policy implications
- Include key points that can be used in answer writing
- Mention relevant topics from syllabus (e.g., "Relevant for GS-2: Governance, Polity")
- Avoid generic news; focus on what examiners ask about
- Include recent developments (last 7-90 days based on dateRange parameter)
- Every news item MUST include: subject tag, GS paper relevance, and source information when available

**Format Requirements:**
- Format responses as valid JSON arrays when requested
- Each news item must have: title, summary, category, date, relevance (High/Medium/Low), keyPoints (array), tags (array), and source
- Tags should include exam-specific tags like "GS-2", "Prelims", "Governance", etc., and subject tags like "Polity", "Economics", etc.

Always prioritize accuracy, exam relevance, verifiable information, and actionable insights for competitive exam preparation.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query }
    ];

    let content = '';

    try {
      // Use OpenAI for news fetching
      const openAIModel = process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o-mini';
      content = await callOpenAIAPI(
        messages,
        openAIModel,
        undefined, // No token limit for OpenAI
        0.7
      );
      content = content?.trim() || '';
    } catch (error) {
      console.error('OpenAI API error for news fetch:', error.message);
      throw error;
    }

    if (!content) {
      throw new Error('AI provider returned an empty response');
    }
    
    let newsItems = [];
    try {
      const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/);
      if (jsonMatch) {
        newsItems = JSON.parse(jsonMatch[1]);
      } else {
        newsItems = JSON.parse(content);
      }
    } catch (parseError) {
      newsItems = parseTextResponse(content, examType, category);
    }

    if (!Array.isArray(newsItems)) {
      newsItems = [newsItems];
    }
    const enrichedNews = newsItems.map((item, index) => ({
      id: `news-${Date.now()}-${index}`,
      title: item.title || 'Untitled News',
      summary: item.summary || item.description || '',
      category: item.category || category || 'General',
      date: item.date || new Date().toISOString().split('T')[0],
      relevance: item.relevance || 'Medium',
      keyPoints: Array.isArray(item.keyPoints) ? item.keyPoints : [],
      tags: Array.isArray(item.tags) ? item.tags : [],
      exam: examType,
        source: item.source || 'OpenAI',
      ...item
    }));

    const trendingKey = `${examType}:${category || 'all'}:${dateRange}:${searchQuery || 'all'}`;
    const trendingPayload = buildTrendingPayload(enrichedNews);
    if (trendingPayload.totalItems > 0) {
      await storeTrendingSnapshot(trendingKey, trendingPayload);
    }

    return res.status(200).json({
      news: enrichedNews,
      count: enrichedNews.length,
      examType,
      category,
      dateRange,
      searchQuery,
      fetchedAt: new Date().toISOString(),
      trending: trendingPayload
    });

  } catch (error) {
    console.error('News fetching error:', error);

    if (error.response) {
      const status = error.response.status;
      let errorMessage = 'An error occurred while fetching news.';

      if (status === 401) {
        errorMessage = 'API credits exhausted or invalid API key. Please check your OpenAI API key and add credits if needed.';
      } else if (status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (status === 402) {
        errorMessage = 'Insufficient API credits. Please add credits to your OpenAI account to continue using this feature.';
      } else if (status === 403) {
        errorMessage = 'Access denied. Please verify your API key permissions.';
      }

      return res.status(status).json({ 
        error: errorMessage,
        code: status === 401 || status === 402 ? 'API_CREDITS_EXHAUSTED' : 'API_ERROR',
        status
      });
    }

    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

function parseTextResponse(text, examType, category) {
  const newsItems = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  let currentItem = null;
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.match(/^\d+[\.\)]\s*(.+)/) || line.match(/^[-*]\s*(.+)/) || line.match(/^Title:/i)) {
      if (currentItem) {
        newsItems.push(currentItem);
      }
      currentItem = {
        title: line.replace(/^\d+[\.\)]\s*/, '').replace(/^[-*]\s*/, '').replace(/^Title:\s*/i, '').trim(),
        summary: '',
        category: category || 'General',
        date: new Date().toISOString().split('T')[0],
        relevance: 'Medium',
        keyPoints: [],
        tags: [],
        exam: examType
      };
      currentSection = 'title';
    } else if (line.match(/^Summary:/i) || line.match(/^Description:/i)) {
      currentSection = 'summary';
      currentItem.summary = line.replace(/^(Summary|Description):\s*/i, '').trim();
    } else if (line.match(/^Category:/i)) {
      if (currentItem) {
        currentItem.category = line.replace(/^Category:\s*/i, '').trim();
      }
    } else if (line.match(/^Date:/i)) {
      if (currentItem) {
        currentItem.date = line.replace(/^Date:\s*/i, '').trim();
      }
    } else if (line.match(/^Key Points:/i) || line.match(/^Points:/i)) {
      currentSection = 'keyPoints';
    } else if (line.match(/^[-•]\s*(.+)/) && currentSection === 'keyPoints') {
      if (currentItem) {
        currentItem.keyPoints.push(line.replace(/^[-•]\s*/, '').trim());
      }
    } else if (currentItem && currentSection === 'summary') {
      currentItem.summary += ' ' + line;
    } else if (currentItem && line.length > 20) {
      if (!currentItem.summary) {
        currentItem.summary = line;
      } else {
        currentItem.summary += ' ' + line;
      }
    }
  }

  // Add the last item
  if (currentItem) {
    newsItems.push(currentItem);
  }

  // If we couldn't parse, create a single item from the text
  if (newsItems.length === 0 && text.length > 50) {
    newsItems.push({
      title: 'Current Affairs Update',
      summary: text.substring(0, 500),
      category: category || 'General',
      date: new Date().toISOString().split('T')[0],
      relevance: 'Medium',
      keyPoints: [],
      tags: [],
      exam: examType
    });
  }

  return newsItems;
}

function buildTrendingPayload(newsList = []) {
  if (!Array.isArray(newsList) || newsList.length === 0) {
    return {
      categories: [],
      tags: [],
      relevance: [],
      totalItems: 0
    };
  }

  const categoryCounts = new Map();
  const tagCounts = new Map();
  const relevanceCounts = new Map();

  newsList.forEach((item) => {
    const category = item.category || 'General';
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);

    const relevance = item.relevance || 'Medium';
    relevanceCounts.set(relevance, (relevanceCounts.get(relevance) || 0) + 1);

    if (Array.isArray(item.tags)) {
      item.tags.forEach((tag) => {
        if (typeof tag !== 'string' || tag.trim().length === 0) return;
        const normalized = tag.trim();
        tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
      });
    }
  });

  const toSortedArray = (map, limit = 6) =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([label, count]) => ({ label, count }));

  return {
    categories: toSortedArray(categoryCounts),
    tags: toSortedArray(tagCounts, 10),
    relevance: toSortedArray(relevanceCounts, 3),
    totalItems: newsList.length
  };
}


