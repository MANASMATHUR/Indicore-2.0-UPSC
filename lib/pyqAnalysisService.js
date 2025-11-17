import connectToDatabase from './mongodb';
import PYQ from '@/models/PYQ';
import axios from 'axios';

class PyqAnalysisService {
  constructor() {
    this.analysisCache = new Map();
    this.cacheTTL = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Analyze a PYQ question using AI to extract keywords, topics, and generate analysis
   */
  async analyzeQuestion(questionId, questionText, answer = '', existingTags = [], existingTheme = '') {
    try {
      await connectToDatabase();

      // Check cache first
      const cacheKey = `analysis_${questionId}`;
      const cached = this.analysisCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }

      // Build analysis prompt
      const analysisPrompt = this.buildAnalysisPrompt(questionText, answer, existingTags, existingTheme);

      // Call AI for analysis
      const analysisResult = await this.callAIAnalysis(analysisPrompt);

      // Parse AI response
      const parsed = this.parseAnalysisResponse(analysisResult);

      // Find similar questions
      const similarQuestions = await this.findSimilarQuestions(
        questionId,
        parsed.topicTags || existingTags,
        parsed.keywords,
        existingTheme
      );

      const result = {
        keywords: parsed.keywords || [],
        topicTags: parsed.topicTags || existingTags,
        analysis: parsed.analysis || '',
        similarQuestions: similarQuestions.map(q => ({
          id: q._id.toString(),
          question: q.question.substring(0, 150) + (q.question.length > 150 ? '...' : ''),
          year: q.year,
          paper: q.paper,
          exam: q.exam
        }))
      };

      // Cache the result
      this.analysisCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('PYQ analysis error:', error.message);
      // Return fallback analysis
      return this.generateFallbackAnalysis(questionText, existingTags, existingTheme);
    }
  }

  buildAnalysisPrompt(questionText, answer, existingTags, existingTheme) {
    return `Analyze the following UPSC Previous Year Question and provide:

1. **Topic Tags**: Identify 3-5 specific topic tags (e.g., "Indian Polity", "Constitutional Provisions", "Fundamental Rights", "Judiciary"). Be specific and relevant to UPSC syllabus.

2. **Important Keywords**: Extract 5-8 key terms, concepts, or phrases that are crucial for understanding and answering this question. Include:
   - Technical terms
   - Important concepts
   - Key institutions/acts/schemes mentioned
   - Relevant dates or periods

3. **In-depth Analysis**: Provide a comprehensive analysis (150-250 words) covering:
   - What the question is testing (concept, application, analysis)
   - Key concepts involved
   - Why this topic is important for UPSC
   - How to approach answering this question
   - Related topics that might be asked

**Question:**
${questionText}

${answer ? `**Answer/Context:**\n${answer}` : ''}

${existingTags.length > 0 ? `**Existing Tags:** ${existingTags.join(', ')}` : ''}
${existingTheme ? `**Existing Theme:** ${existingTheme}` : ''}

Respond in JSON format:
{
  "topicTags": ["tag1", "tag2", "tag3"],
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "analysis": "Detailed analysis text here..."
}`;
  }

  async callAIAnalysis(prompt) {
    try {
      // Try Perplexity first
      if (process.env.PERPLEXITY_API_KEY) {
        const response = await axios.post(
          'https://api.perplexity.ai/chat/completions',
          {
            model: 'sonar-pro',
            messages: [
              {
                role: 'system',
                content: 'You are an expert UPSC exam analyst. Provide detailed, accurate analysis of previous year questions. Always respond with valid JSON only, no additional text.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.3,
            max_tokens: 2000
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        if (response.data?.choices?.[0]?.message?.content) {
          return response.data.choices[0].message.content;
        }
      }

      // Fallback to other AI providers if needed
      throw new Error('No AI provider available');
    } catch (error) {
      console.error('AI analysis call failed:', error.message);
      throw error;
    }
  }

  parseAnalysisResponse(aiResponse) {
    try {
      // Try to extract JSON from response
      let jsonStr = aiResponse.trim();
      
      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Try to find JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      return {
        topicTags: Array.isArray(parsed.topicTags) ? parsed.topicTags.slice(0, 5) : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 8) : [],
        analysis: typeof parsed.analysis === 'string' ? parsed.analysis.trim() : ''
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error.message);
      // Try to extract information manually
      return this.extractFromText(aiResponse);
    }
  }

  extractFromText(text) {
    const result = {
      topicTags: [],
      keywords: [],
      analysis: ''
    };

    // Try to extract topic tags
    const tagsMatch = text.match(/"topicTags":\s*\[(.*?)\]/i) || text.match(/topic[_\s]?tags?[:\s]+\[(.*?)\]/i);
    if (tagsMatch) {
      const tags = tagsMatch[1].match(/"([^"]+)"/g);
      if (tags) {
        result.topicTags = tags.map(t => t.replace(/"/g, '')).slice(0, 5);
      }
    }

    // Try to extract keywords
    const keywordsMatch = text.match(/"keywords":\s*\[(.*?)\]/i) || text.match(/keywords?[:\s]+\[(.*?)\]/i);
    if (keywordsMatch) {
      const keywords = keywordsMatch[1].match(/"([^"]+)"/g);
      if (keywords) {
        result.keywords = keywords.map(k => k.replace(/"/g, '')).slice(0, 8);
      }
    }

    // Extract analysis
    const analysisMatch = text.match(/"analysis":\s*"([^"]+(?:"[^"]*")*[^"]*)"/i) || 
                         text.match(/analysis[:\s]+"([^"]+(?:"[^"]*")*[^"]*)"/i);
    if (analysisMatch) {
      result.analysis = analysisMatch[1].replace(/\\"/g, '"').trim();
    } else {
      // Fallback: use the text itself as analysis
      result.analysis = text.substring(0, 500).trim();
    }

    return result;
  }

  async findSimilarQuestions(questionId, topicTags, keywords, theme, limit = 5) {
    try {
      await connectToDatabase();

      const question = await PYQ.findById(questionId).lean();
      if (!question) return [];

      const searchTerms = [
        ...(topicTags || []),
        ...(keywords || []),
        ...(theme ? [theme] : [])
      ].filter(term => term && term.length > 2);

      if (searchTerms.length === 0) return [];

      // Build search query
      const searchPatterns = searchTerms.map(term => {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(escaped, 'i');
      });

      const similar = await PYQ.find({
        _id: { $ne: questionId },
        exam: question.exam,
        $or: [
          { topicTags: { $in: searchPatterns } },
          { keywords: { $in: searchPatterns } },
          { theme: { $in: searchPatterns } },
          { question: { $regex: searchPatterns[0] } }
        ]
      })
      .sort({ year: -1, verified: -1 })
      .limit(limit)
      .lean()
      .exec();

      return similar;
    } catch (error) {
      console.error('Error finding similar questions:', error.message);
      return [];
    }
  }

  generateFallbackAnalysis(questionText, existingTags, existingTheme) {
    // Extract basic keywords from question text
    const words = questionText
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4 && !['which', 'what', 'where', 'when', 'about', 'their', 'there', 'these', 'those'].includes(w))
      .slice(0, 8);

    return {
      keywords: words,
      topicTags: existingTags.length > 0 ? existingTags : [],
      analysis: `This question tests your understanding of ${existingTheme || 'the topic'}. Review the key concepts and ensure you understand the fundamental principles involved.`,
      similarQuestions: []
    };
  }

  /**
   * Batch analyze multiple questions
   */
  async batchAnalyze(questionIds, batchSize = 5) {
    const results = [];
    
    for (let i = 0; i < questionIds.length; i += batchSize) {
      const batch = questionIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (id) => {
        try {
          const question = await PYQ.findById(id).lean();
          if (!question) return null;
          
          return await this.analyzeQuestion(
            id,
            question.question,
            question.answer || '',
            question.topicTags || [],
            question.theme || ''
          );
        } catch (error) {
          console.error(`Error analyzing question ${id}:`, error.message);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null));

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < questionIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

const pyqAnalysisService = new PyqAnalysisService();
export default pyqAnalysisService;

