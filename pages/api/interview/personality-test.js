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
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers array is required' });
    }

    const preferences = session.user?.preferences || {};
    const preferredModel = preferences.model || 'sonar-pro';
    const preferredProvider = preferences.provider || 'perplexity';
    const excludedProviders = preferences.excludedProviders || [];

    const systemPrompt = `You are a personality assessment expert for competitive exam interviews. Analyze answers to personality test questions and identify key traits, strengths, and areas for development.

**Traits to assess:**
- Leadership
- Integrity
- Communication
- Problem-solving
- Emotional intelligence
- Adaptability
- Decision-making
- Teamwork`;

    const answersText = answers.map((a, idx) => 
      `${idx + 1}. Q: ${a.question}\n   A: ${a.answer}`
    ).join('\n\n');

    const userPrompt = `Analyze the following personality test answers and provide a comprehensive personality assessment:

${answersText}

Provide assessment in JSON format:
{
  "traits": [
    {"trait": "Leadership", "score": 8.5, "description": "Assessment"},
    {"trait": "Integrity", "score": 9.0, "description": "Assessment"}
  ],
  "overallAssessment": "Overall personality assessment",
  "strengths": ["Strength 1", "Strength 2"],
  "developmentAreas": ["Area 1", "Area 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

Scores should be out of 10.`;

    const aiResult = await callAIWithFallback(
      [{ role: 'user', content: userPrompt }],
      systemPrompt,
      2500,
      0.6,
      {
        model: preferredModel,
        preferredProvider,
        excludeProviders: excludedProviders
      }
    );
    const aiResponse = aiResult?.content || '';

    let assessment;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        assessment = JSON.parse(jsonMatch[0]);
      } else {
        assessment = {
          traits: [],
          overallAssessment: 'Assessment completed',
          strengths: [],
          developmentAreas: [],
          recommendations: []
        };
      }
    } catch (parseError) {
      assessment = {
        traits: [],
        overallAssessment: 'Assessment completed',
        strengths: [],
        developmentAreas: [],
        recommendations: []
      };
    }

    return res.status(200).json({ assessment });
  } catch (error) {
    console.error('Error in personality test:', error);
    return res.status(500).json({ error: 'Failed to assess personality', details: error.message });
  }
}

