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
    const { essayText, sourceLanguage, targetLanguage, essayType, wordLimit } = req.body;

    if (!essayText) {
      return res.status(400).json({ error: 'Essay text is required' });
    }

    // Prepare essay type specific prompts
    const essayTypePrompts = {
      general: 'general essay writing with clear structure and logical flow',
      current_affairs: 'current affairs essay with contemporary relevance and balanced analysis',
      social_issues: 'social issues essay with critical analysis and practical solutions',
      economic: 'economic essay with data-driven analysis and policy implications',
      political: 'political science essay with governance perspective and administrative insights',
      history: 'history and culture essay with historical context and cultural significance',
      science_tech: 'science and technology essay with technical accuracy and future implications',
      environment: 'environmental essay with ecological awareness and sustainable solutions',
      ethics: 'ethics and philosophy essay with moral reasoning and ethical considerations',
      international: 'international relations essay with global perspective and diplomatic analysis'
    };

    const languageNames = {
      en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', bn: 'Bengali',
      pa: 'Punjabi', gu: 'Gujarati', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada'
    };

    const sourceLangName = languageNames[sourceLanguage];
    const targetLangName = languageNames[targetLanguage];
    const essayTypeDesc = essayTypePrompts[essayType] || 'general essay writing';

    const systemPrompt = `You are Indicore, an AI-powered essay enhancement specialist for competitive exams like PCS, UPSC, and SSC. You excel at:

1. **Language Translation & Enhancement**: Convert essays from ${sourceLangName} to ${targetLangName} while improving quality
2. **Structure Improvement**: Organize content with clear introduction, body paragraphs, and conclusion
3. **Vocabulary Enhancement**: Use appropriate academic and exam-relevant vocabulary
4. **Grammar & Style**: Ensure proper grammar, sentence structure, and writing style
5. **Content Enrichment**: Add relevant examples, data, and insights where appropriate
6. **Exam-Specific Formatting**: Format according to competitive exam standards

**Enhancement Guidelines:**
- Maintain the original meaning and intent
- Improve clarity and coherence
- Use formal, academic language appropriate for competitive exams
- Ensure logical flow and smooth transitions
- Add relevant examples and evidence where beneficial
- Maintain appropriate length ${wordLimit ? `(target: ${wordLimit} words)` : ''}
- Focus on ${essayTypeDesc}

**Response Format:**
Provide only the enhanced essay text in ${targetLangName}. Do not include explanations or comments.`;

    // Call Perplexity/Sonar API for enhancement
    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Please enhance and translate this essay from ${sourceLangName} to ${targetLangName}:

**Original Essay:**
${essayText}

**Requirements:**
- Essay Type: ${essayTypeDesc}
- Target Language: ${targetLangName}
${wordLimit ? `- Word Limit: ${wordLimit} words` : ''}

Please provide the enhanced essay in ${targetLangName} only.`
        }
      ],
      max_tokens: 4000,
      temperature: 0.5, // Slightly higher for more creative enhancement
      top_p: 0.9,
      stream: false,
      presence_penalty: 0,
      frequency_penalty: 1
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
      const enhancedEssay = response.data.choices[0].message.content;
      
      return res.status(200).json({ 
        enhancedEssay,
        sourceLanguage,
        targetLanguage,
        essayType,
        wordLimit,
        enhancedAt: new Date().toISOString()
      });
    } else {
      throw new Error('Invalid response format from Perplexity API');
    }

  } catch (error) {

    if (error.response) {
      const status = error.response.status;
      let errorMessage = 'An error occurred while enhancing your essay.';

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

    return res.status(500).json({ error: 'Internal server error' });
  }
}

