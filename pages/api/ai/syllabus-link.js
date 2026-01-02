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

    const { headline, content } = req.body;

    if (!headline) {
        return res.status(400).json({ error: 'Headline is required' });
    }

    try {
        const systemPrompt = `You are a UPSC Syllabus Expert. Your goal is to analyze a news headline and link it to the PRECISE GS Paper, Topic, and Subtopic from the UPSC Syllabus.

UPSC SYLLABUS STRUCTURE:
GS-1: Indian Heritage and Culture, History and Geography of the World and Society.
GS-2: Governance, Constitution, Polity, Social Justice and International relations.
GS-3: Technology, Economic Development, Bio-diversity, Environment, Security and Disaster Management.
GS-4: Ethics, Integrity and Aptitude. (Usually refers to Probity, Public Service Values, etc.)

Return the analysis in the following JSON format:
{
  "gsPaper": "GS-1" | "GS-2" | "GS-3" | "GS-4",
  "topic": "The main topic name (e.g., Indian Economy, International Relations)",
  "subtopic": "The specific subtopic (e.g., Agriculture, Bilateral Relations)",
  "relevance": "A 1-2 sentence explanation of why this is important for UPSC."
}`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Headline: ${headline}\nContent: ${content || 'N/A'}` }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content);
        return res.status(200).json(result);

    } catch (error) {
        console.error('Syllabus Link Error:', error);
        return res.status(500).json({ error: 'Failed to link syllabus' });
    }
}
