import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { callAIWithFallback } from '@/lib/ai-providers';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { question, answer, questionType } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ error: 'Question and answer are required' });
    }

    const preferences = session.user?.preferences || {};
    const preferredModel = preferences.model || 'sonar-pro';
    const preferredProvider = preferences.provider || 'openai';
    const preferredOpenAIModel = preferences.openAIModel || process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o-mini';
    const excludedProviders = preferences.excludedProviders || [];

    const systemPrompt = `You are an expert interview evaluator for competitive exams (UPSC, PCS, SSC). Your task is to evaluate interview answers based on:

1. **Content Quality**: Accuracy, relevance, depth
2. **Communication**: Clarity, structure, articulation
3. **Critical Thinking**: Analysis, reasoning, perspective
4. **Exam Relevance**: Alignment with exam expectations

Provide constructive feedback with specific strengths and areas for improvement.`;

    const userPrompt = `Evaluate the following interview answer:

**Question:** ${question}
**Question Type:** ${questionType || 'personality'}
**Answer:** ${answer}

Provide evaluation in JSON format:
{
  "score": 8.5,
  "strengths": ["Strength 1", "Strength 2"],
  "improvements": ["Improvement 1", "Improvement 2"],
  "feedback": "Overall feedback on the answer",
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}

Score should be out of 10.`;

    // Force OpenAI usage for interview evaluation
    const aiResult = await callAIWithFallback(
      [{ role: 'user', content: userPrompt }],
      systemPrompt,
      2000,
      0.6,
      {
        model: preferredModel,
        preferredProvider: 'openai', // Force OpenAI
        excludeProviders: ['perplexity'], // Exclude Perplexity for this call
        openAIModel: preferredOpenAIModel
      }
    );
    const aiResponse = aiResult?.content || '';

    let evaluation;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0]);
      } else {
        evaluation = {
          score: 7,
          strengths: ['Good attempt'],
          improvements: ['Could be more detailed'],
          feedback: aiResponse,
          suggestions: []
        };
      }
    } catch (parseError) {
      evaluation = {
        score: 7,
        strengths: [],
        improvements: [],
        feedback: 'Evaluation completed',
        suggestions: []
      };
    }

    return res.status(200).json({ evaluation });
  } catch (error) {
    console.error('Error evaluating answer:', error);
    return res.status(500).json({ error: 'Failed to evaluate answer', details: error.message });
  }
}

