import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import axios from 'axios';

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

    if (!process.env.PERPLEXITY_API_KEY) {
      return res.status(500).json({ error: 'Perplexity API key not configured' });
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

**Format Requirements:**
- Format responses as valid JSON arrays when requested
- Each news item must have: title, summary, category, date, relevance (High/Medium/Low), keyPoints (array), and tags (array)
- Tags should include exam-specific tags like "GS-2", "Prelims", "Governance", etc.

Always prioritize accuracy, exam relevance, and actionable insights for competitive exam preparation.`;

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        max_tokens: 4000,
        temperature: 0.7,
        top_p: 0.9,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 60000
      }
    );

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from Perplexity API');
    }

    const content = response.data.choices[0].message.content.trim();
    
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
      source: item.source || 'Perplexity',
      ...item
    }));

    return res.status(200).json({
      news: enrichedNews,
      count: enrichedNews.length,
      examType,
      category,
      dateRange,
      searchQuery,
      fetchedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('News fetching error:', error);

    if (error.response) {
      const status = error.response.status;
      let errorMessage = 'An error occurred while fetching news.';

      if (status === 401) {
        errorMessage = 'API credits exhausted or invalid API key. Please check your Perplexity API key and add credits if needed.';
      } else if (status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (status === 402) {
        errorMessage = 'Insufficient API credits. Please add credits to your Perplexity account to continue using this feature.';
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


