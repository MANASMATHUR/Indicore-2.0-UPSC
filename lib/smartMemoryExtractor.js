/**
 * AI-Powered Smart Memory Extraction
 * Automatically identifies and extracts important information from conversations
 * No explicit "remember that" commands needed!
 */

import { callAIWithFallback } from './ai-providers';

/**
 * Use AI to extract important, save-worthy information from a message
 * This is MUCH smarter than pattern matching!
 */
export async function extractSmartMemories(message, userProfile = null) {
    if (!message || message.length < 10) return [];

    try {
        const prompt = `You are an information extraction expert. Analyze the following user message and extract any important information that should be saved to their profile for personalization.

USER MESSAGE:
"${message}"

${userProfile ? `\nEXISTING USER CONTEXT:\n${JSON.stringify(userProfile, null, 2)}` : ''}

EXTRACT and return ONLY information that is:
1. Personal facts (goals, preferences, background)
2. Study-related (subjects, exam prep, study habits)
3. Long-term relevant (not temporary or one-time)
4. Useful for personalizing future responses

Return a JSON array of extracted memories. Each memory should have:
- content: The exact information to remember (clear, concise statement)
- category: One of [goal, preference, study_habit, exam, subject, personal]
- importance: One of [high, normal, low]
- reason: Why this is important to remember

If there is NOTHING important to extract, return an empty array: []

IMPORTANT:
- Extract ONLY new information (don't repeat what's in existing context)
- Be selective - only truly important information
- Make content statements clear and actionable
- Don't extract temporary or trivial information

Return ONLY valid JSON, no other text.`;

        const response = await callAIWithFallback(
            [{ role: 'user', content: prompt }],
            {
                temperature: 0.1,
                max_tokens: 500,
                response_format: { type: 'json_object' }
            }
        );

        const extracted = JSON.parse(response);

        // Handle both array and object responses
        if (Array.isArray(extracted)) {
            return extracted;
        } else if (extracted.memories && Array.isArray(extracted.memories)) {
            return extracted.memories;
        }

        return [];
    } catch (error) {
        console.error('Smart memory extraction error:', error);
        return [];
    }
}

/**
 * Analyze conversation and suggest memories to save
 * This functions as a "memory suggestion engine"
 */
export async function analyzeConversationForMemories(messages, userProfile = null) {
    if (!messages || messages.length === 0) return [];

    try {
        // Get last 5 user messages
        const userMessages = messages
            .filter(m => m.role === 'user')
            .slice(-5)
            .map(m => m.content)
            .join('\n\n');

        const prompt = `Analyze this conversation and identify important information about the user that should be remembered for future personalization.

CONVERSATION (Last 5 user messages):
${userMessages}

${userProfile ? `\nALREADY KNOWN ABOUT USER:\n${JSON.stringify(userProfile, null, 2)}` : ''}

Extract NEW important information about:
- Goals and aspirations
- Study preferences and habits
- Exam preparation details
- Subject preferences (strong/weak areas)
- Personal context
- Important dates or deadlines

Return JSON with structure:
{
  "memories": [
    {
      "content": "Clear statement of what to remember",
      "category": "goal|preference|study_habit|exam|subject|personal",
      "importance": "high|normal|low",
      "reason": "Why this is important",
      "confidence": 0.0-1.0
    }
  ]
}

Only include memories with confidence > 0.7
Return empty array if nothing important found.
Return ONLY valid JSON.`;

        const response = await callAIWithFallback(
            [{ role: 'user', content: prompt }],
            {
                temperature: 0.1,
                max_tokens: 800,
                response_format: { type: 'json_object' }
            }
        );

        const result = JSON.parse(response);
        const memories = result.memories || [];

        // Filter by confidence
        return memories.filter(m => m.confidence >= 0.7);
    } catch (error) {
        console.error('Conversation analysis error:', error);
        return [];
    }
}

/**
 * Quick pattern-based extraction for common cases
 * Fast fallback when AI isn't needed
 */
export function quickExtractMemories(message) {
    const memories = [];
    const lowerMessage = message.toLowerCase();

    // Goal detection
    const goalPatterns = [
        /(?:my )?goal is (?:to\s+)?(.+?)(?:\.|$|,)/i,
        /i (?:want to|aim to|aspire to|dream of)\s+(.+?)(?:\.|$|,)/i,
        /become (?:a|an)\s+(.+?)(?:\.|$|,)/i
    ];

    goalPatterns.forEach(pattern => {
        const match = message.match(pattern);
        if (match) {
            memories.push({
                content: match[1].trim(),
                category: 'goal',
                importance: 'high',
                confidence: 0.9
            });
        }
    });

    // Exam detection
    if (/preparing for|appearing for|targeting/i.test(message)) {
        const examMatch = message.match(/(?:preparing for|appearing for|targeting)\s+([A-Z]+\s*\d{4})/i);
        if (examMatch) {
            memories.push({
                content: `Preparing for ${examMatch[1]}`,
                category: 'exam',
                importance: 'high',
                confidence: 0.95
            });
        }
    }

    // Preference detection
    const prefPatterns = [
        /i (?:prefer|like|love|enjoy)\s+(.+?)(?:\.|$|,)/i,
        /my (?:preferred|favorite)\s+(.+?)(?:is|are)\s+(.+?)(?:\.|$|,)/i
    ];

    prefPatterns.forEach(pattern => {
        const match = message.match(pattern);
        if (match) {
            memories.push({
                content: match[0].trim(),
                category: 'preference',
                importance: 'normal',
                confidence: 0.8
            });
        }
    });

    return memories;
}

/**
 * Main smart extraction function that combines AI + patterns
 */
export async function smartExtractAndSave(message, userProfile = null, useAI = true) {
    let allMemories = [];

    // Always try fast pattern matching first
    const quickMemories = quickExtractMemories(message);
    allMemories.push(...quickMemories);

    // Use AI for deeper extraction if enabled and message is substantial
    if (useAI && message.length > 30) {
        const aiMemories = await extractSmartMemories(message, userProfile);

        // Merge AI memories, avoiding duplicates
        aiMemories.forEach(aiMem => {
            const isDuplicate = allMemories.some(mem =>
                mem.content.toLowerCase().includes(aiMem.content.toLowerCase()) ||
                aiMem.content.toLowerCase().includes(mem.content.toLowerCase())
            );
            if (!isDuplicate) {
                allMemories.push(aiMem);
            }
        });
    }

    // Sort by importance and confidence
    allMemories.sort((a, b) => {
        const importanceScore = { high: 3, normal: 2, low: 1 };
        const scoreA = importanceScore[a.importance] * (a.confidence || 0.8);
        const scoreB = importanceScore[b.importance] * (b.confidence || 0.8);
        return scoreB - scoreA;
    });

    return allMemories;
}

/**
 * Detect if extracted memories should be auto-saved or need confirmation
 */
export function shouldAutoSave(memory) {
    // Auto-save high confidence, high importance memories
    if (memory.importance === 'high' && (memory.confidence || 0) > 0.85) {
        return true;
    }

    // Auto-save clear factual information
    const autoSaveCategories = ['exam', 'goal'];
    if (autoSaveCategories.includes(memory.category) && (memory.confidence || 0) > 0.8) {
        return true;
    }

    // Everything else needs confirmation
    return false;
}


export default {
    extractSmartMemories,
    analyzeConversationForMemories,
    quickExtractMemories,
    smartExtractAndSave,
    shouldAutoSave
};
