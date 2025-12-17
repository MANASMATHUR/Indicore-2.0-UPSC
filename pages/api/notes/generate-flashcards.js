import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { callAIWithFallback } from '@/lib/ai-providers';
import { trackInteraction } from '@/lib/personalizationHelpers';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await getServerSession(req, res, authOptions);
    if (!session) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { text, count = 10 } = req.body;

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({ error: 'Text content is required' });
        }

        // Truncate text if it's too long to avoid token limits (approx 15k chars)
        const truncatedText = text.length > 15000 ? text.substring(0, 15000) + '...' : text;

        const systemPrompt = `You are an expert study assistant. Your task is to create high-quality flashcards from the provided text.
    
    OUTPUT FORMAT:
    You must return ONLY a valid JSON array of objects. Do not include any markdown formatting, backticks, or explanatory text.
    
    JSON Structure:
    [
      {
        "front": "Question or concept",
        "back": "Answer or explanation"
      }
    ]
    
    GUIDELINES:
    - Create exactly ${count} flashcards.
    - Focus on key concepts, definitions, dates, and important facts.
    - Keep the "front" concise (the question).
    - Keep the "back" clear and informative (the answer).
    - Ensure the content is accurate based ONLY on the provided text.
    `;

        const userPrompt = `Generate ${count} flashcards from the following notes:\n\n${truncatedText}`;

        const aiResponse = await callAIWithFallback(
            systemPrompt,
            userPrompt,
            'sonar-pro', // Use a capable model
            'openai' // Default provider preference
        );

        // Clean the response to ensure it's valid JSON
        let cleanJson = aiResponse.trim();
        // Remove markdown code blocks if present
        if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        let flashcards;
        try {
            flashcards = JSON.parse(cleanJson);
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            console.error('Raw Response:', aiResponse);
            // Fallback: Try to extract JSON array if parsing failed
            const jsonMatch = cleanJson.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                try {
                    flashcards = JSON.parse(jsonMatch[0]);
                } catch (e) {
                    throw new Error('Failed to parse AI response as JSON');
                }
            } else {
                throw new Error('Invalid response format from AI');
            }
        }

        // Track the flashcard generation
        try {
            // Get or create session ID
            let sessionId = req.cookies.sessionId;
            if (!sessionId) {
                sessionId = uuidv4();
                res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; SameSite=Lax`);
            }

            await trackInteraction(
                session?.user?.email || null,
                sessionId,
                'flashcard',
                'flashcard_generate',
                'generate',
                {
                    topic: 'Notes',
                    category: 'flashcard',
                    engagementScore: 7,
                    customData: {
                        flashcardCount: flashcards.length,
                        textLength: truncatedText.length,
                        requestedCount: count,
                        source: 'notes'
                    }
                },
                {
                    userAgent: req.headers['user-agent']
                }
            );
        } catch (trackError) {
            console.error('Failed to track flashcard generation:', trackError);
        }

        return res.status(200).json({ flashcards });

    } catch (error) {
        console.error('Error generating flashcards:', error);
        return res.status(500).json({
            error: 'Failed to generate flashcards',
            details: error.message
        });
    }
}
