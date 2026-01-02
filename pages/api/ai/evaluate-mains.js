import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
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
        const { question, answer, subject, language = 'en' } = req.body;

        if (!question || !answer) {
            return res.status(400).json({ error: 'Question and answer are required' });
        }

        const languageNames = {
            en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', bn: 'Bengali',
            pa: 'Punjabi', gu: 'Gujarati', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada'
        };

        const langName = languageNames[language] || 'English';

        const systemPrompt = `You are Indicore's AI Mains Evaluator, a specialist in UPSC Civil Services Mains evaluation. 
Your goal is to provide deep, structural, and "value-addition" feedback on a candidate's answer.

EXAMINATION STANDARDS:
- Intro: Context, definition, or current relevance.
- Body: Multi-dimensional (PESTEL - Political, Economic, Social, Technological, Environmental, Legal), use of subheadings, bullet points.
- Conclusion: Balanced, forward-looking (Way Forward), and optimistic.

EVALUATION PARAMETERS:
1. Structural Analysis: Did they use a coherent skeleton?
2. Value Addition: Did they mention reports (NITI Aayog, ARC, Economic Survey), Articles of Constitution, or Case Laws?
3. Visualization Potential: Where could they have drawn a map, flow chart, or diagram?
4. Content Accuracy: Factual correctness.
5. Analytical Depth: Going beyond the surface.

RESPONSE FORMAT (JSON):
{
  "score": {
    "total": 0, // out of 10
    "intro": 0, // out of 2
    "body": 0, // out of 6
    "conclusion": 0 // out of 2
  },
  "feedback": {
    "intro": "string",
    "body": "string",
    "conclusion": "string"
  },
  "valueAddition": {
    "dataPoints": ["list of specific data/reports to mention"],
    "articles_cases": ["relevant articles or case laws"],
    "keywords": ["essential keywords used or missed"]
  },
  "visualSuggestions": "Description of a map/diagram that would fit here",
  "modelPoints": ["3-4 bullet points that MUST be in a perfect answer"],
  "overallComment": "summary"
}

Provide the response STRICTLY as a valid JSON object.`;

        const userPrompt = `Subject: ${subject}
Language: ${langName}

Question: ${question}

Candidate's Answer:
${answer}

Evaluate this answer and provide the JSON feedback.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        const openAIKey = getOpenAIKey();
        if (!openAIKey) {
            throw new Error('OpenAI API key not configured');
        }

        const openAIModel = process.env.OPENAI_MODEL || 'gpt-4o';
        const response = await callOpenAIAPI(
            messages,
            openAIModel,
            undefined,
            0.2,
            true // Expecting JSON
        );

        let evaluation;
        try {
            // Clean possible markdown formatting if AI didn't follow strictly
            const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim();
            evaluation = JSON.parse(jsonStr);
        } catch (e) {
            console.error('Failed to parse AI response as JSON:', response);
            return res.status(500).json({ error: 'AI returned invalid format', raw: response });
        }

        return res.status(200).json(evaluation);

    } catch (error) {
        console.error('Mains Evaluation Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
