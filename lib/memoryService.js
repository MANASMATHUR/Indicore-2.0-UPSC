/**
 * Memory Detection and Processing Service
 * Detects when users want to save information to memory
 * Works like ChatGPT's "Remember" feature
 */

/**
 * Patterns that indicate user wants to save something to memory
 */
const MEMORY_SAVE_PATTERNS = [
    // Direct commands
    /(?:remember|save|note|keep in mind|don't forget)(?:\s+that)?\s+(.+)/i,
    /(?:please|i want you to|can you)\s+(?:remember|save|note)\s+(.+)/i,
    /save to memory[:\s]+(.+)/i,
    /add to memory[:\s]+(.+)/i,
    /store this[:\s]+(.+)/i,

    // Contextual saves
    /my (?:goal|aim|target|aspiration) is (?:to\s+)?(.+)/i,
    /i (?:want to become|aspire to be|dream of becoming)\s+(.+)/i,
    /my optional (?:subject|is)\s+(.+)/i,
    /i (?:prefer|like|love|enjoy|hate|dislike)\s+(.+)/i,
    /important[:\s]+(.+)/i,
    /crucial to remember[:\s]+(.+)/i
];

/**
 * Patterns for memory confirmation (user saying "yes" to save)
 */
const MEMORY_CONFIRMATION_PATTERNS = [
    /^yes,?\s+(?:save|remember|note|keep) (?:it|that)$/i,
    /^yes,?\s+(?:please)?$/i,
    /^(?:sure|okay|ok|alright|definitely),?\s+(?:save|remember) (?:it|that)$/i,
    /^save (?:it|that)$/i,
    /^remember (?:it|that)$/i
];

/**
 * Patterns for viewing saved memories
 */
const MEMORY_VIEW_PATTERNS = [
    /what (?:do you|have you) remember(?:ed)?/i,
    /show (?:me )?(?:my )?memor(?:y|ies)/i,
    /what (?:have )?(?:i|you) (?:told you to remember|saved)/i,
    /list (?:my )?memor(?:y|ies)/i,
    /view (?:my )?saved memor(?:y|ies)/i
];

/**
 * Patterns for deleting memories
 */
const MEMORY_DELETE_PATTERNS = [
    /(?:delete|remove|forget|clear)\s+(?:the )?memory (?:about|of)\s+(.+)/i,
    /(?:delete|remove|forget)\s+(?:that|this)\s+memory/i,
    /clear (?:all )?memor(?:y|ies)/i
];

/**
 * Detect if user wants to save something to memory
 */
export function detectMemorySaveIntent(message) {
    if (!message || typeof message !== 'string') return null;

    for (const pattern of MEMORY_SAVE_PATTERNS) {
        const match = message.match(pattern);
        if (match) {
            return {
                type: 'save',
                content: match[1]?.trim(),
                originalMessage: message,
                shouldAskConfirmation: !isExplicitSaveCommand(message)
            };
        }
    }

    return null;
}

/**
 * Check if message is an explicit save command (doesn't need confirmation)
 */
function isExplicitSaveCommand(message) {
    const explicitPatterns = [
        /^(?:remember|save|note|keep|store)/i,
        /save to memory/i,
        /add to memory/i
    ];

    return explicitPatterns.some(pattern => pattern.test(message));
}

/**
 * Detect if user is confirming to save memory
 */
export function isMemoryConfirmation(message) {
    if (!message || typeof message !== 'string') return false;

    const trimmed = message.trim().toLowerCase();

    // Simple yes/no
    if (trimmed === 'yes' || trimmed === 'yeah' || trimmed === 'yep' ||
        trimmed === 'sure' || trimmed === 'okay' || trimmed === 'ok' ||
        trimmed === 'definitely' || trimmed === 'please') {
        return true;
    }

    return MEMORY_CONFIRMATION_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Detect if user wants to view saved memories
 */
export function isMemoryViewRequest(message) {
    if (!message || typeof message !== 'string') return false;
    return MEMORY_VIEW_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Detect if user wants to delete a memory
 */
export function detectMemoryDeleteIntent(message) {
    if (!message || typeof message !== 'string') return null;

    for (const pattern of MEMORY_DELETE_PATTERNS) {
        const match = message.match(pattern);
        if (match) {
            return {
                type: 'delete',
                target: match[1]?.trim() || 'all',
                clearAll: /clear (?:all )?memor(?:y|ies)/i.test(message)
            };
        }
    }

    return null;
}

/**
 * Format memories for AI context
 */
export function formatMemoriesForAI(memories) {
    if (!memories || memories.length === 0) {
        return '';
    }

    const formatted = memories
        .sort((a, b) => {
            // Sort by importance and recency
            if (a.importance === 'high' && b.importance !== 'high') return -1;
            if (a.importance !== 'high' && b.importance === 'high') return 1;
            return new Date(b.savedAt) - new Date(a.savedAt);
        })
        .map(memory => {
            const importance = memory.importance === 'high' ? '⚠️ IMPORTANT: ' : '';
            return `${importance}${memory.content}`;
        });

    return `\n\nMEMORIES - USER EXPLICITLY ASKED YOU TO REMEMBER:\n${formatted.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nAlways consider these saved memories when responding. They represent what the user explicitly wants you to remember about them.`;
}

/**
 * Generate response for memory save
 */
export function generateMemorySaveResponse(memory, needsConfirmation = false) {
    if (needsConfirmation) {
        return `💾 I noticed you mentioned: "${memory}"\n\nWould you like me to save this to my memory so I remember it in future conversations?`;
    }

    return `✅ Got it! I've saved this to memory:\n"${memory}"\n\nI'll remember this for all our future conversations!`;
}

/**
 * Generate response for viewing memories
 */
export function generateMemoriesListResponse(memories) {
    if (!memories || memories.length === 0) {
        return `🧠 **Your Memory Bank** is empty.\n\nYou haven't saved anything yet! To save something, just say:\n• "Remember that my goal is to become an IPS officer"\n• "Save to memory: I study best in the morning"\n• "Note that I'm weak in Economics"`;
    }

    let response = `🧠 **Your Memory Bank** (${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}):\n\n`;

    // Group by category
    const byCategory = memories.reduce((acc, memory) => {
        const cat = memory.category || 'general';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(memory);
        return {};
    }, {});

    // Category emojis
    const categoryIcons = {
        'goal': '🎯',
        'preference': '❤️',
        'study_habit': '📚',
        'exam': '📝',
        'subject': '📖',
        'personal': '👤',
        'general': '💡'
    };

    // Sort memories by most used
    const sortedMemories = [...memories].sort((a, b) => {
        if (a.importance === 'high' && b.importance !== 'high') return -1;
        if (a.importance !== 'high' && b.importance === 'high') return 1;
        return (b.useCount || 0) - (a.useCount || 0);
    });

    sortedMemories.forEach((memory, index) => {
        const icon = categoryIcons[memory.category] || '💡';
        const importance = memory.importance === 'high' ? ' ⭐' : '';
        const used = memory.useCount > 0 ? ` (used ${memory.useCount} times)` : '';
        response += `${index + 1}. ${icon} ${memory.content}${importance}${used}\n`;
    });

    response += `\n_💡 I use these memories to personalize all my responses to you!_`;

    return response;
}

/**
 * Extract specific memory topics from user query
 */
export function extractMemoryTopic(message) {
    // Extract what user is asking about their memories
    const patterns = [
        /memory (?:about|of|regarding)\s+(.+)/i,
        /what (?:do you remember|have you saved) about\s+(.+)/i,
        /show (?:me )?memories (?:about|of|for)\s+(.+)/i
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
            return match[1].trim();
        }
    }

    return null;
}

export default {
    detectMemorySaveIntent,
    isMemoryConfirmation,
    isMemoryViewRequest,
    detectMemoryDeleteIntent,
    formatMemoriesForAI,
    generateMemorySaveResponse,
    generateMemoriesListResponse,
    extractMemoryTopic
};
