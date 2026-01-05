/**
 * Service to manage text highlights in chat messages using localStorage
 */

const STORAGE_KEY_PREFIX = 'indicore_highlights_';

export const saveHighlight = (chatId, messageIndex, highlight) => {
    if (!chatId) return null;

    const key = `${STORAGE_KEY_PREFIX}${chatId}`;
    const allHighlights = getHighlights(chatId);

    if (!allHighlights[messageIndex]) {
        allHighlights[messageIndex] = [];
    }

    const newHighlight = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        ...highlight
    };

    allHighlights[messageIndex].push(newHighlight);
    localStorage.setItem(key, JSON.stringify(allHighlights));

    return newHighlight;
};

export const getHighlights = (chatId) => {
    if (typeof window === 'undefined' || !chatId) return {};

    const key = `${STORAGE_KEY_PREFIX}${chatId}`;
    const stored = localStorage.getItem(key);

    try {
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Error parsing highlights:', e);
        return {};
    }
};

export const getHighlightsForMessage = (chatId, messageIndex) => {
    const highlights = getHighlights(chatId);
    return highlights[messageIndex] || [];
};

export const removeHighlight = (chatId, messageIndex, highlightId) => {
    if (!chatId) return;

    const key = `${STORAGE_KEY_PREFIX}${chatId}`;
    const allHighlights = getHighlights(chatId);

    if (allHighlights[messageIndex]) {
        allHighlights[messageIndex] = allHighlights[messageIndex].filter(h => h.id !== highlightId);

        if (allHighlights[messageIndex].length === 0) {
            delete allHighlights[messageIndex];
        }

        localStorage.setItem(key, JSON.stringify(allHighlights));
    }
};

export const getAllHighlights = () => {
    if (typeof window === 'undefined') return [];

    const allHighlights = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
            const chatId = key.replace(STORAGE_KEY_PREFIX, '');
            try {
                const chatHighlights = JSON.parse(localStorage.getItem(key));
                Object.keys(chatHighlights).forEach(msgIdx => {
                    chatHighlights[msgIdx].forEach(h => {
                        allHighlights.push({
                            ...h,
                            chatId,
                            messageIndex: parseInt(msgIdx)
                        });
                    });
                });
            } catch (e) {
                console.error(`Error parsing highlights for chat ${chatId}:`, e);
            }
        }
    }

    // Sort by timestamp descending
    return allHighlights.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
};

export const clearAllHighlights = (chatId) => {
    if (!chatId) return;
    const key = `${STORAGE_KEY_PREFIX}${chatId}`;
    localStorage.removeItem(key);
};

export default {
    saveHighlight,
    getHighlights,
    getHighlightsForMessage,
    removeHighlight,
    getAllHighlights,
    clearAllHighlights
};
