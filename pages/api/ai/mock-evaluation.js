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
    const { examType, language, questionType, subject, answerText, wordLimit } = req.body;

    if (!examType || !language || !questionType || !subject || !answerText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Prepare exam-specific evaluation criteria
    const examTypeNames = {
      pcs: 'Provincial Civil Service (PCS)',
      upsc: 'Union Public Service Commission (UPSC)',
      ssc: 'Staff Selection Commission (SSC)',
      other: 'Competitive Exam'
    };

    const questionTypeNames = {
      essay: 'Essay Writing',
      short_answer: 'Short Answer Questions',
      analytical: 'Analytical Questions',
      current_affairs: 'Current Affairs',
      general_studies: 'General Studies'
    };

    const languageNames = {
      en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', bn: 'Bengali',
      pa: 'Punjabi', gu: 'Gujarati', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada'
    };

    const langName = languageNames[language];
    const examName = examTypeNames[examType];
    const questionTypeName = questionTypeNames[questionType] || 'General Questions';

    const systemPrompt = `You are Indicore, an AI-powered mock evaluation specialist for ${examName} and other competitive exams. You excel at evaluating answers written in ${langName} for ${questionTypeName} questions.

**Your Task:**
Evaluate the student's answer and give detailed feedback for improvement.

**Evaluation Criteria:**
1. **Content Quality (30%)**: Accuracy, relevance, depth of knowledge, and factual correctness
2. **Structure & Organization (25%)**: Logical flow, clear introduction, body paragraphs, and conclusion
3. **Language & Expression (20%)**: Grammar, vocabulary, sentence structure, and clarity in ${langName}
4. **Critical Analysis (15%)**: Analytical thinking, argumentation, and critical evaluation
5. **Presentation (10%)**: Formatting, neatness, and adherence to word limits

**Response Format:**
Give a detailed evaluation with:

**📊 OVERALL SCORE: [X/100]**

**✅ STRENGTHS:**
- List 3-5 specific strengths of the answer

**❌ AREAS FOR IMPROVEMENT:**
- List 3-5 specific areas that need improvement

**📝 DETAILED FEEDBACK:**
- Content Analysis: Evaluate factual accuracy and depth
- Structure Review: Assess organization and flow
- Language Assessment: Check grammar, vocabulary, and expression
- Critical Analysis: Evaluate analytical depth and argumentation

**💡 SPECIFIC RECOMMENDATIONS:**
- Provide 5-7 actionable suggestions for improvement
- Include specific examples of how to improve

**📚 STUDY TIPS:**
- Suggest 3-4 study strategies for this topic
- Recommend resources for further improvement

**🎯 EXAM-SPECIFIC ADVICE:**
- Provide ${examName}-specific tips for this type of question
- Suggest time management strategies

Be encouraging but honest, specific but constructive. Focus on helping the student improve their performance in ${examName} exams.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Please evaluate this ${questionTypeName} answer for ${examName} in the subject "${subject}" written in ${langName}:

**Answer Text:**
${answerText}

**Evaluation Parameters:**
- Exam Type: ${examName}
- Question Type: ${questionTypeName}
- Subject: ${subject}
- Language: ${langName}
${wordLimit ? `- Word Limit: ${wordLimit} words` : ''}
- Current Word Count: ${answerText.split(/\s+/).filter(word => word.length > 0).length} words

Please provide a detailed evaluation following the format specified in your system prompt.`
      }
    ];

    let evaluation = '';

    try {
      // Use OpenAI for mock evaluation
      const openAIKey = getOpenAIKey();
      if (!openAIKey) {
        throw new Error('OpenAI API key not configured');
      }
      
      const openAIModel = process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o-mini';
      evaluation = await callOpenAIAPI(
        messages,
        openAIModel,
        undefined, // No token limit for OpenAI
        0.2 // Lower temperature for more consistent evaluation
      );
      evaluation = evaluation?.trim() || '';
    } catch (error) {
      console.error('OpenAI API error for mock evaluation:', error.message);
      throw error;
    }

    if (evaluation && evaluation.trim().length > 0) {
      return res.status(200).json({ 
        evaluation: evaluation.trim(),
        examType,
        language,
        questionType,
        subject,
        wordLimit,
        evaluatedAt: new Date().toISOString()
      });
    }

    throw new Error('AI provider returned an empty response');

  } catch (error) {

    if (error.response) {
      const status = error.response.status;
      let errorMessage = 'An error occurred while evaluating your answer.';

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

