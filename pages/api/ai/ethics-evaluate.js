import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { caseStudy, userResponse } = req.body;

    if (!caseStudy || !userResponse) {
        return res.status(400).json({ error: 'Case study and response are required' });
    }

    try {
        const systemPrompt = `You are an Ethics (GS-4) Evaluator for UPSC. 
Your task is to evaluate the user's response to an ethical dilemma/case study.

EVALUATION CRITERIA:
1. Stakeholder Identification: Did the user identify all relevant people/entities?
2. Ethical Dilemmas: Did they spot the conflict between values (e.g., efficiency vs. equity)?
3. Legality vs. Ethics: Does the solution follow the law while being morally sound?
4. Pragmatism: Is the solution feasible for a bureaucrat?
5. Values: Does it reflect integrity, impartiality, and compassion?

Return the evaluation in JSON format:
{
  "score": number (out of 10),
  "strengths": ["string"],
  "weaknesses": ["string"],
  "ethicalValues": ["string of values touched upon"],
  "improvement": "Detailed advice on how to improve the response.",
  "idealApproach": "A brief summary of the 'Model' administrative approach for this case."
}`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `CASE STUDY:\n${caseStudy}\n\nUSER RESPONSE:\n${JSON.stringify(userResponse)}` }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content);
        return res.status(200).json(result);

    } catch (error) {
        console.error('Ethics Evaluate Error:', error);
        return res.status(500).json({ error: 'Failed to evaluate ethics response' });
    }
}
