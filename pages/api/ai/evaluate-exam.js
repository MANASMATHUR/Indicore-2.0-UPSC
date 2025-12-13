import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import axios from 'axios';
import { callOpenAIAPI, getOpenAIKey } from '@/lib/ai-providers';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { examPaper, examType, subject, language } = req.body;

    if (!examPaper || !examType || !subject) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Prepare exam-specific system prompt
    const examTypeNames = {
      pcs: 'Provincial Civil Service (PCS)',
      upsc: 'Union Public Service Commission (UPSC)',
      ssc: 'Staff Selection Commission (SSC)',
      other: 'Competitive Exam'
    };

    const languageNames = {
      en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', bn: 'Bengali',
      pa: 'Punjabi', gu: 'Gujarati', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada'
    };

    const langName = languageNames[language];
    const examName = examTypeNames[examType];

    const systemPrompt = `You are Indicore, an AI-powered exam evaluation specialist for ${examName} and other competitive exams. You excel at:

1. **Answer Quality Assessment**: Evaluate answers for accuracy, completeness, structure, and depth
2. **Content Analysis**: Check factual accuracy, logical flow, and relevance to the question
3. **Language Proficiency**: Assess grammar, vocabulary, and expression quality in ${langName}
4. **Exam-Specific Feedback**: Provide targeted advice for ${examName} preparation
5. **Improvement Suggestions**: Offer specific, actionable recommendations

**UPSC/PCS/SSC EVALUATION STANDARDS:**
- UPSC Mains: Focus on analytical depth, multiple perspectives, and balanced approach
- PCS Exams: Include state-specific examples and regional governance aspects
- SSC Exams: Emphasize factual accuracy, precision, and objective-type preparation

**UPSC MARKING SCHEME:**
- Introduction (10-15%): Context setting and thesis statement
- Main Body (70-80%): Detailed analysis with examples and case studies
- Conclusion (10-15%): Synthesis and forward-looking approach
- Quality of Expression (10%): Language, grammar, and coherence

**Evaluation Criteria:**
- **Accuracy**: Factual correctness and precision
- **Completeness**: Coverage of all aspects of the question
- **Structure**: Logical organization and clear presentation
- **Language**: Grammar, vocabulary, and expression quality
- **Relevance**: Direct addressing of the question asked
- **Depth**: Level of analysis and insight provided
- **Examples**: Use of relevant case studies and current affairs
- **Balance**: Multiple perspectives and nuanced approach

**Subject-Specific Focus:**
- Polity: Constitutional provisions, governance structures, recent developments
- History: Chronological accuracy, cultural aspects, freedom struggle
- Geography: Physical features, climate, natural resources, environmental issues
- Economics: Economic concepts, government policies, recent developments
- Science & Technology: Recent developments, applications, policy implications
- Environment: Biodiversity, climate change, conservation strategies

**Response Format:**
Give a detailed evaluation with:
1. **Overall Score** (out of 100)
2. **Strengths** (what was done well)
3. **Areas for Improvement** (specific weaknesses)
4. **Detailed Feedback** (question-by-question analysis)
5. **Recommendations** (how to improve)
6. **Study Tips** (exam-specific preparation advice)
7. **Answer Writing Tips** (structure and approach)

Be encouraging but honest, specific but constructive. Focus on helping the student improve their performance.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Please evaluate this ${examName} exam paper for the subject "${subject}" written in ${langName}:

**Exam Paper Content:**
${examPaper}

Please provide a detailed evaluation following the format specified in your system prompt.`
      }
    ];

    let evaluation = '';

    try {
      // Use OpenAI for exam evaluation
      const openAIKey = getOpenAIKey();
      if (!openAIKey) {
        throw new Error('OpenAI API key not configured');
      }

      const openAIModel = process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o';
      evaluation = await callOpenAIAPI(
        messages,
        openAIModel,
        undefined, // No token limit for OpenAI
        0.2 // Lower temperature for more consistent evaluation
      );
      evaluation = evaluation?.trim() || '';
    } catch (error) {
      console.error('OpenAI API error for exam evaluation:', error.message);
      throw error;
    }

    if (evaluation && evaluation.trim().length > 0) {
      return res.status(200).json({
        evaluation: evaluation.trim(),
        examType,
        subject,
        language,
        evaluatedAt: new Date().toISOString()
      });
    }

    throw new Error('AI provider returned an empty response');

  } catch (error) {

    if (error.response) {
      const status = error.response.status;
      let errorMessage = 'An error occurred while evaluating your exam paper.';

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

    return res.status(500).json({ error: 'Internal server error' });
  }
}

