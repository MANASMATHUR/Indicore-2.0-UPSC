import connectToDatabase from './mongodb';
import PYQ from '@/models/PYQ';
import axios from 'axios';
import { callOpenAIAPI, getOpenAIKey } from './ai-providers';

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
      // Use OpenAI for PYQ analysis
      const openAIKey = getOpenAIKey();
      if (!openAIKey) {
        throw new Error('OpenAI API key not configured');
      }

      const messages = [
        {
          role: 'system',
          content: 'You are an expert UPSC exam analyst. Provide detailed, accurate analysis of previous year questions. Always respond with valid JSON only, no additional text. ONLY provide verifiable information. Tag subjects properly (Polity, History, Geography, etc.) and mention relevant GS papers.'
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      const openAIModel = process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o';
      const content = await callOpenAIAPI(
        messages,
        openAIModel,
        undefined, // No token limit for OpenAI
        0.3
      );

      if (content) {
        return content;
      }

      throw new Error('OpenAI returned empty response');
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

      // Try to find JSON object (handle nested objects and arrays)
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      // Convert single-quoted strings to double-quoted strings first
      // (before removing trailing commas to avoid corrupting string content)
      // Use a function to handle apostrophes within strings correctly
      // This avoids the issue where 'don't' gets split into 'don' and 't'
      jsonStr = (() => {
        let result = jsonStr;
        let i = 0;
        const output = [];

        while (i < result.length) {
          if (result[i] === "'" && (i === 0 || /[{:,\[\s]/.test(result[i - 1]))) {
            // Found opening single quote in JSON context
            const start = i;
            i++; // Skip opening quote
            let content = '';
            let foundClosing = false;

            // Look for closing quote, handling escaped quotes
            while (i < result.length) {
              if (result[i] === '\\' && i + 1 < result.length) {
                // Escaped character
                content += result[i] + result[i + 1];
                i += 2;
              } else if (result[i] === "'") {
                // Check if this is a closing quote (followed by JSON delimiter or whitespace + delimiter)
                const nextChar = result[i + 1];
                if (nextChar === undefined || /[\s,:\]\}]/.test(nextChar) ||
                  (nextChar === ' ' && /[,:\]\}]/.test(result.substring(i + 1).trim()[0]))) {
                  // This is a closing quote
                  foundClosing = true;
                  i++; // Skip closing quote
                  output.push('"', content, '"');
                  break;
                } else {
                  // Apostrophe within string content (e.g., 'don't')
                  content += result[i];
                  i++;
                }
              } else {
                content += result[i];
                i++;
              }
            }

            if (!foundClosing) {
              // No closing quote found, treat as regular character
              output.push(result[start]);
              i = start + 1;
            }
          } else {
            output.push(result[i]);
            i++;
          }
        }

        return output.join('');
      })();

      // Quote unquoted keys (avoid double-quoting already quoted keys)
      // Match word followed by colon, but only if not already quoted
      jsonStr = jsonStr.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

      // Clean up common JSON issues (after quote conversion to avoid corrupting strings)
      // Remove trailing commas only outside of quoted strings
      // Use a parser that tracks whether we're inside a string
      jsonStr = (() => {
        let result = jsonStr;
        let inString = false;
        let escapeNext = false;
        const output = [];

        for (let i = 0; i < result.length; i++) {
          const char = result[i];

          if (escapeNext) {
            output.push(char);
            escapeNext = false;
            continue;
          }

          if (char === '\\') {
            escapeNext = true;
            output.push(char);
            continue;
          }

          if (char === '"') {
            inString = !inString;
            output.push(char);
            continue;
          }

          // Only process commas when outside strings
          if (!inString && char === ',') {
            // Check if this is a trailing comma (followed by } or ])
            let j = i + 1;
            // Skip whitespace
            while (j < result.length && /\s/.test(result[j])) {
              j++;
            }
            // If followed by } or ], skip the comma
            if (j < result.length && (result[j] === '}' || result[j] === ']')) {
              // Skip this comma, don't add it to output
              continue;
            }
          }

          output.push(char);
        }

        return output.join('');
      })();

      const parsed = JSON.parse(jsonStr);

      // Validate and sanitize parsed data
      return {
        topicTags: Array.isArray(parsed.topicTags)
          ? parsed.topicTags.filter(tag => typeof tag === 'string' && tag.trim().length > 0).slice(0, 5)
          : [],
        keywords: Array.isArray(parsed.keywords)
          ? parsed.keywords.filter(kw => typeof kw === 'string' && kw.trim().length > 0).slice(0, 8)
          : [],
        analysis: typeof parsed.analysis === 'string'
          ? parsed.analysis.trim().substring(0, 2000) // Limit analysis length
          : ''
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

    if (!text || typeof text !== 'string') {
      return result;
    }

    // Try to extract topic tags - multiple patterns
    const tagsPatterns = [
      /"topicTags":\s*\[(.*?)\]/i,
      /topic[_\s]?tags?[:\s]+\[(.*?)\]/i,
      /topic[_\s]?tags?[:\s]+(.*?)(?:\n|$)/i
    ];

    for (const pattern of tagsPatterns) {
      const tagsMatch = text.match(pattern);
      if (tagsMatch) {
        const tagsStr = tagsMatch[1];
        // Try to extract quoted strings
        const quotedTags = tagsStr.match(/"([^"]+)"/g);
        if (quotedTags) {
          result.topicTags = quotedTags.map(t => t.replace(/"/g, '').trim()).filter(t => t.length > 0).slice(0, 5);
          break;
        }
        // Try unquoted tags separated by commas
        const unquotedTags = tagsStr.split(',').map(t => t.trim().replace(/^["']|["']$/g, '')).filter(t => t.length > 0);
        if (unquotedTags.length > 0) {
          result.topicTags = unquotedTags.slice(0, 5);
          break;
        }
      }
    }

    // Try to extract keywords - multiple patterns
    const keywordsPatterns = [
      /"keywords":\s*\[(.*?)\]/i,
      /keywords?[:\s]+\[(.*?)\]/i,
      /keywords?[:\s]+(.*?)(?:\n|$)/i
    ];

    for (const pattern of keywordsPatterns) {
      const keywordsMatch = text.match(pattern);
      if (keywordsMatch) {
        const keywordsStr = keywordsMatch[1];
        // Try to extract quoted strings
        const quotedKeywords = keywordsStr.match(/"([^"]+)"/g);
        if (quotedKeywords) {
          result.keywords = quotedKeywords.map(k => k.replace(/"/g, '').trim()).filter(k => k.length > 0).slice(0, 8);
          break;
        }
        // Try unquoted keywords separated by commas
        const unquotedKeywords = keywordsStr.split(',').map(k => k.trim().replace(/^["']|["']$/g, '')).filter(k => k.length > 0);
        if (unquotedKeywords.length > 0) {
          result.keywords = unquotedKeywords.slice(0, 8);
          break;
        }
      }
    }

    // Extract analysis - multiple patterns
    const analysisPatterns = [
      /"analysis":\s*"((?:[^"\\]|\\.)*)"/i,
      /analysis[:\s]+"((?:[^"\\]|\\.)*)"/i,
      /analysis[:\s]+(.*?)(?:\n\n|\n\s*\{|\n\s*\[|$)/is
    ];

    for (const pattern of analysisPatterns) {
      const analysisMatch = text.match(pattern);
      if (analysisMatch && analysisMatch[1]) {
        result.analysis = analysisMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim().substring(0, 2000);
        if (result.analysis.length > 50) {
          break;
        }
      }
    }

    // Fallback: if no analysis found, try to extract meaningful text
    if (!result.analysis || result.analysis.length < 50) {
      // Look for paragraphs that might contain analysis
      const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 50);
      if (paragraphs.length > 0) {
        // Take the longest paragraph that doesn't look like JSON
        const analysisCandidates = paragraphs
          .filter(p => !p.includes('{') && !p.includes('[') && !p.includes('"topicTags"') && !p.includes('"keywords"'))
          .sort((a, b) => b.length - a.length);
        if (analysisCandidates.length > 0) {
          result.analysis = analysisCandidates[0].trim().substring(0, 2000);
        }
      }
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

