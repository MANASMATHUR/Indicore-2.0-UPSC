class ContextOptimizer {
  constructor() {
    this.summaryCache = new Map();
    this.semanticCache = new Map();
  }

  shouldUseLLM(message) {
    const messageLower = message.toLowerCase();
    
    const skipPatterns = [
      /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no)$/i,
      /^(what is|who is|when|where|why|how)\s+(upsc|pcs|ssc|exam)$/i,
      /^(upsc|pcs|ssc)\s+(syllabus|exam|paper|pattern|date)$/i,
    ];

    if (skipPatterns.some(p => p.test(message.trim()))) {
      return false;
    }

    const needsLLM = [
      /explain|describe|analyze|discuss|elaborate|compare|contrast|evaluate|critically/i,
      /what is|who is|when did|where is|why did|how does/i,
      /(pyq|previous year|past year)/i,
      /essay|answer writing|structure/i,
      /current affairs|recent|latest/i,
      /example|case study|illustrate/i,
    ];

    return needsLLM.some(p => p.test(message));
  }

  selectRelevantContext(history, currentMessage, maxMessages = 3) {
    if (!history || history.length === 0) return [];
    
    const currentLower = currentMessage.toLowerCase();
    const keywords = this.extractKeywords(currentMessage);
    
    const relevantMessages = history
      .map((msg, idx) => {
        const score = this.calculateRelevance(msg.content, keywords, currentLower);
        return { msg, score, idx };
      })
      .filter(item => item.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxMessages)
      .sort((a, b) => a.idx - b.idx)
      .map(item => item.msg);

    if (relevantMessages.length > 0) {
      return relevantMessages;
    }

    return history.slice(-2);
  }

  extractKeywords(text) {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how']);
    
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 5);
  }

  calculateRelevance(messageContent, keywords, currentMessage) {
    if (!messageContent) return 0;
    
    const msgLower = messageContent.toLowerCase();
    let score = 0;
    
    for (const keyword of keywords) {
      if (msgLower.includes(keyword)) {
        score += 1;
      }
    }
    
    const commonWords = currentMessage.split(/\s+/).filter(w => w.length > 3);
    for (const word of commonWords) {
      if (msgLower.includes(word.toLowerCase())) {
        score += 0.5;
      }
    }
    
    return score / (keywords.length + commonWords.length);
  }

  summarizeLongConversation(messages, maxLength = 500) {
    if (!messages || messages.length <= 4) return null;
    
    const cacheKey = messages.map(m => m.content).join('|').slice(0, 200);
    if (this.summaryCache.has(cacheKey)) {
      return this.summaryCache.get(cacheKey);
    }

    const topics = new Set();
    const keyPoints = [];

    for (const msg of messages.slice(0, -3)) {
      if (msg.role === 'user') {
        const keywords = this.extractKeywords(msg.content);
        keywords.forEach(k => topics.add(k));
      }
    }

    const summary = `Previous conversation covered: ${Array.from(topics).slice(0, 5).join(', ')}.`;
    
    if (summary.length < maxLength) {
      this.summaryCache.set(cacheKey, summary);
      return summary;
    }
    
    return null;
  }

  optimizeSystemPrompt(basePrompt, hasContext, isFollowUp) {
    if (!hasContext && !isFollowUp) {
      return basePrompt.replace(/CRITICAL REQUIREMENTS:[\s\S]{1,500}/, 'Provide clear, complete answers. Write in full sentences with proper structure.');
    }
    return basePrompt;
  }

  shouldSkipContext(message, historyLength) {
    const messageLower = message.toLowerCase();
    
    const standalonePatterns = [
      /^(what|who|when|where|why|how)\s+/i,
      /^(explain|describe|define|list|name|give examples of)\s+/i,
      /^(tell me about|tell me)\s+/i,
    ];

    if (standalonePatterns.some(p => p.test(message.trim()))) {
      return historyLength < 2;
    }

    const needsContext = [
      /(continue|more|another|further|elaborate on|expand on)/i,
      /(it|this|that|they|those|these)/i,
      /(as discussed|as mentioned|previously|earlier)/i,
    ];

    return !needsContext.some(p => p.test(message));
  }

  selectOptimalModel(message, hasComplexContext = false) {
    const messageLower = message.toLowerCase();
    
    const simplePatterns = [
      /^(what is|who is|define|meaning of)\s+/i,
      /^(list|name|give)\s+/i,
      /^(when|where|which year)\s+/i,
    ];

    if (simplePatterns.some(p => p.test(message.trim())) && !hasComplexContext) {
      return 'sonar';
    }

    const complexPatterns = [
      /(analyze|critically examine|evaluate|discuss in detail|elaborate)/i,
      /(compare and contrast|explain the relationship)/i,
      /(essay|comprehensive answer|detailed explanation)/i,
    ];

    if (complexPatterns.some(p => p.test(message))) {
      return 'sonar-pro';
    }

    return 'sonar-pro';
  }

  compressContext(contextMessages) {
    if (!contextMessages || contextMessages.length <= 2) {
      return contextMessages;
    }

    return contextMessages.map(msg => {
      if (msg.content && msg.content.length > 200) {
        const sentences = msg.content.split(/[.!?]/).filter(s => s.trim());
        if (sentences.length > 3) {
          return {
            ...msg,
            content: sentences.slice(0, 2).join('. ') + '.'
          };
        }
      }
      return msg;
    });
  }
}

export default new ContextOptimizer();

