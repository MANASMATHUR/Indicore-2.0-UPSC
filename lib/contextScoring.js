/**
 * Context Scoring Utility
 * Scores conversation context relevance for better AI responses
 */

/**
 * Calculate semantic similarity between two texts (simple keyword-based)
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} - Similarity score (0-1)
 */
function calculateSemanticSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;

    const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
}

/**
 * Calculate recency score (more recent = higher score)
 * @param {Date} timestamp - Message timestamp
 * @returns {number} - Recency score (0-1)
 */
function calculateRecencyScore(timestamp) {
    if (!timestamp) return 0;

    const now = Date.now();
    const messageTime = new Date(timestamp).getTime();
    const hoursSince = (now - messageTime) / (1000 * 60 * 60);

    // Exponential decay: recent messages get higher scores
    // 24 hours = 0.5, 1 hour = 0.95, 168 hours (1 week) = 0.1
    return Math.exp(-hoursSince / 48);
}

/**
 * Calculate topic continuity score
 * @param {string} currentTopic - Current conversation topic
 * @param {string} messageTopic - Message topic
 * @returns {number} - Continuity score (0-1)
 */
function calculateTopicContinuity(currentTopic, messageTopic) {
    if (!currentTopic || !messageTopic) return 0;
    if (currentTopic === messageTopic) return 1;

    // Check for related topics
    const topicRelations = {
        'Polity': ['History', 'Current Affairs'],
        'Economics': ['Current Affairs', 'Geography'],
        'Geography': ['Environment', 'Economics'],
        'Environment': ['Geography', 'Science'],
        'Science': ['Environment', 'Current Affairs'],
        'History': ['Polity', 'Current Affairs'],
    };

    const related = topicRelations[currentTopic] || [];
    return related.includes(messageTopic) ? 0.5 : 0;
}

/**
 * Score a conversation message for relevance to current query
 * @param {Object} message - Message object with content, timestamp, topic
 * @param {string} currentQuery - Current user query
 * @param {string} currentTopic - Current topic
 * @returns {number} - Relevance score (0-1)
 */
export function scoreMessageRelevance(message, currentQuery, currentTopic = null) {
    if (!message || !currentQuery) return 0;

    const content = message.content || message.text || '';
    const timestamp = message.timestamp || message.createdAt;
    const messageTopic = message.topic;

    // Calculate component scores
    const semanticScore = calculateSemanticSimilarity(content, currentQuery);
    const recencyScore = calculateRecencyScore(timestamp);
    const topicScore = currentTopic && messageTopic
        ? calculateTopicContinuity(currentTopic, messageTopic)
        : 0;

    // Weighted combination
    // Semantic similarity is most important, then recency, then topic continuity
    const weights = {
        semantic: 0.5,
        recency: 0.3,
        topic: 0.2,
    };

    return (
        semanticScore * weights.semantic +
        recencyScore * weights.recency +
        topicScore * weights.topic
    );
}

/**
 * Select most relevant messages from conversation history
 * @param {Array} messages - Array of message objects
 * @param {string} currentQuery - Current user query
 * @param {number} limit - Maximum number of messages to return
 * @param {string} currentTopic - Current topic (optional)
 * @returns {Array} - Sorted array of most relevant messages
 */
export function selectRelevantMessages(messages, currentQuery, limit = 10, currentTopic = null) {
    if (!Array.isArray(messages) || messages.length === 0) return [];

    // Score all messages
    const scoredMessages = messages.map(message => ({
        message,
        score: scoreMessageRelevance(message, currentQuery, currentTopic),
    }));

    // Sort by score (descending) and take top N
    return scoredMessages
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.message);
}

/**
 * Calculate user engagement score based on interaction patterns
 * @param {Object} interactionPatterns - User interaction patterns
 * @returns {number} - Engagement score (0-1)
 */
export function calculateEngagementScore(interactionPatterns) {
    if (!interactionPatterns) return 0.5; // Default neutral score

    const {
        followUpFrequency = 0,
        clarificationFrequency = 0,
        bookmarkFrequency = 0,
        averageMessagesPerSession = 0,
    } = interactionPatterns;

    // Normalize each metric (assuming reasonable max values)
    const followUpScore = Math.min(followUpFrequency / 10, 1);
    const clarificationScore = Math.min(clarificationFrequency / 5, 1);
    const bookmarkScore = Math.min(bookmarkFrequency / 5, 1);
    const sessionLengthScore = Math.min(averageMessagesPerSession / 20, 1);

    // Higher engagement = more follow-ups, bookmarks, longer sessions
    // Clarifications might indicate confusion, so weight it less
    return (
        followUpScore * 0.3 +
        bookmarkScore * 0.3 +
        sessionLengthScore * 0.3 +
        clarificationScore * 0.1
    );
}

export default {
    scoreMessageRelevance,
    selectRelevantMessages,
    calculateEngagementScore,
};
