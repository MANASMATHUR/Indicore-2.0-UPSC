import { callAIWithFallback } from '@/lib/ai-providers';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { text, model, provider, openAIModel } = req.body;

        // Validate input
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Text is required' });
        }

        if (text.trim().length < 50) {
            return res.status(400).json({ error: 'Text is too short to generate flashcards. Please provide at least 50 characters.' });
        }

        // Create prompt for flashcard generation
        const systemPrompt = `You are an expert educator creating study flashcards for PCS, UPSC, and SSC exam preparation.`;

        const userPrompt = `Given the following study notes, generate exactly 5 high-quality flashcards.

Each flashcard should:
- Have a clear, specific question that tests understanding
- Have a concise but complete answer
- Include a category/topic for organization
- Focus on important concepts, facts, or relationships

Study Notes:
${text.substring(0, 4000)}

Return ONLY a valid JSON array with this exact structure:
[
  {
    "question": "Clear question here?",
    "answer": "Concise answer here",
    "category": "Topic/Category"
  }
]

Generate exactly 5 flashcards. Return only the JSON array, no other text.`;

        // Generate flashcards using AI
        const result = await callAIWithFallback(
            [{ role: 'user', content: userPrompt }],
            systemPrompt,
            1500, // maxTokens
            0.7,  // temperature
            {
                preferredProvider: provider,
                model: model,
                openAIModel: openAIModel
            }
        );

        const responseContent = result.content;

        // Parse the response
        let flashcards;
        try {
            // Try to extract JSON from response
            const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                flashcards = JSON.parse(jsonMatch[0]);
            } else {
                flashcards = JSON.parse(responseContent);
            }

            // Validate flashcards structure
            if (!Array.isArray(flashcards)) {
                throw new Error('Response is not an array');
            }

            // Ensure we have exactly 5 flashcards
            flashcards = flashcards.slice(0, 5);

            // Validate each flashcard
            flashcards = flashcards.filter(card =>
                card.question &&
                card.answer &&
                card.category &&
                typeof card.question === 'string' &&
                typeof card.answer === 'string' &&
                typeof card.category === 'string'
            );

            if (flashcards.length === 0) {
                throw new Error('No valid flashcards generated');
            }

        } catch (parseError) {
            console.error('Failed to parse flashcards:', parseError);
            console.error('AI Response:', responseContent);
            return res.status(500).json({
                error: 'Failed to generate flashcards. Please try again.',
                details: parseError.message
            });
        }

        return res.status(200).json({
            success: true,
            flashcards,
            count: flashcards.length
        });

    } catch (error) {
        console.error('Error generating flashcards:', error);
        return res.status(500).json({
            error: 'Failed to generate flashcards',
            details: error.message
        });
    }
}
