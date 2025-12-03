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

  selectRelevantContext(history, currentMessage, maxMessages = 16) {
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
    if (!text || typeof text !== 'string') return [];
    
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
      'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around', 'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'during', 'except', 'inside', 'into', 'near', 'outside', 'over', 'through', 'throughout', 'toward', 'under', 'until', 'upon', 'within', 'without',
      'also', 'just', 'more', 'most', 'only', 'very', 'much', 'many', 'some', 'any', 'all', 'each', 'every', 'both', 'few', 'several', 'other', 'such', 'same', 'own', 'than', 'too', 'so', 'here', 'there', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'don', 'should', 'now'
    ]);
    
    // Extract words and phrases
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    // Count word frequency for better keyword selection
    const wordFreq = new Map();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });
    
    // Sort by frequency and length (prefer longer, more frequent words)
    const sortedWords = Array.from(wordFreq.entries())
      .sort((a, b) => {
        // Primary sort: frequency (descending)
        if (b[1] !== a[1]) return b[1] - a[1];
        // Secondary sort: length (descending)
        return b[0].length - a[0].length;
      })
      .map(([word]) => word)
      .slice(0, 5); // Return top 5 keywords
    
    return sortedWords;
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

    // Never skip context for very short or highly ambiguous messages
    // like "was he good?", "and then?", "what about him?"
    if (messageLower.length <= 40) {
      return false;
    }
    
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
      // Include pronouns so things like "was he good?" or "what about her?"
      // always keep conversation history.
      /(it|this|that|they|those|these|he|she|him|her|his|hers|them|their|theirs)/i,
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

  truncateContent(text, maxLength = 180) {
    if (!text) return '';
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }
    const effectiveMax = Math.max(40, maxLength - 3);
    return normalized.slice(0, effectiveMax).trim() + '...';
  }

  buildConversationLedger(messages, maxEntries = 60, preserveFirst = 10) {
    if (!messages || messages.length === 0) {
      return '';
    }

    const userPrompts = [];
    let promptIndex = 1;

    for (const msg of messages) {
      if (msg.role === 'user' && msg.content) {
        userPrompts.push({ index: promptIndex++, content: msg.content });
      }
    }

    if (userPrompts.length === 0) {
      return '';
    }

    let selectedPrompts = userPrompts;

    if (userPrompts.length > maxEntries) {
      const safeHead = Math.min(preserveFirst, Math.max(1, maxEntries - 2));
      const tailCount = Math.max(1, maxEntries - safeHead - 1);
      selectedPrompts = [
        ...userPrompts.slice(0, safeHead),
        { index: 'ellipsis', content: '... earlier prompts omitted for brevity ...' },
        ...userPrompts.slice(-tailCount)
      ];
    }

    return selectedPrompts.map(prompt => {
      if (prompt.index === 'ellipsis') {
        return prompt.content;
      }
      const snippet = this.truncateContent(prompt.content, 220);
      return `Prompt #${prompt.index}: ${snippet}`;
    }).join('\n');
  }
}

export default new ContextOptimizer();

