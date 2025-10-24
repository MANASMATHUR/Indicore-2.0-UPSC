class ContextualLayer {
  constructor() {
    this.contexts = new Map();
    this.patterns = new Map();
    this.initializePatterns();
  }

  initializePatterns() {
    this.patterns.set(/what is (pcs|upsc|ssc)/i, {
      type: 'exam_info',
      quickResponse: 'PCS (Provincial Civil Service), UPSC (Union Public Service Commission), and SSC (Staff Selection Commission) are major competitive exams in India for government positions.',
      requiresAI: false
    });

    this.patterns.set(/syllabus for (pcs|upsc|ssc)/i, {
      type: 'syllabus',
      quickResponse: 'The syllabus includes General Studies, Current Affairs, Optional Subjects, and Language papers. Would you like specific details for any particular exam?',
      requiresAI: false
    });

    this.patterns.set(/previous year papers/i, {
      type: 'papers',
      quickResponse: 'Previous year papers are available for practice. Would you like me to help you with specific subjects or years?',
      requiresAI: false
    });

    this.patterns.set(/current affairs/i, {
      type: 'current_affairs',
      quickResponse: 'I can help you with current affairs preparation. What specific topics or time period are you interested in?',
      requiresAI: true
    });

    this.patterns.set(/essay writing/i, {
      type: 'essay',
      quickResponse: 'I can help you with essay writing techniques, structure, and practice. What type of essay are you working on?',
      requiresAI: true
    });
  }

  analyzeMessage(message) {
    const lowerMessage = message.toLowerCase();
    
    for (const [pattern, response] of this.patterns) {
      if (pattern.test(message)) {
        return {
          ...response,
          confidence: 0.9,
          context: this.extractContext(message)
        };
      }
    }

    if (/^(hi|hello|hey|good morning|good afternoon|good evening)/i.test(message.trim())) {
      return {
        type: 'greeting',
        quickResponse: 'Hello! I\'m Indicore AI, your exam preparation assistant. How can I help you with your PCS, UPSC, or SSC preparation today?',
        requiresAI: false,
        confidence: 0.95
      };
    }

    if (/help|assist|support/i.test(lowerMessage)) {
      return {
        type: 'help',
        quickResponse: 'I can help you with exam preparation, study materials, practice questions, essay writing, and more. What specific area would you like assistance with?',
        requiresAI: false,
        confidence: 0.9
      };
    }

    return {
      type: 'complex',
      requiresAI: true,
      confidence: 0.1
    };
  }

  extractContext(message) {
    const context = {
      examType: null,
      subject: null,
      difficulty: null,
      language: null
    };

    if (/pcs/i.test(message)) context.examType = 'PCS';
    else if (/upsc/i.test(message)) context.examType = 'UPSC';
    else if (/ssc/i.test(message)) context.examType = 'SSC';
    const subjects = ['history', 'geography', 'polity', 'economics', 'science', 'maths', 'english', 'hindi'];
    for (const subject of subjects) {
      if (new RegExp(subject, 'i').test(message)) {
        context.subject = subject;
        break;
      }
    }

    if (/easy|basic|beginner/i.test(message)) context.difficulty = 'easy';
    else if (/medium|intermediate/i.test(message)) context.difficulty = 'medium';
    else if (/hard|difficult|advanced/i.test(message)) context.difficulty = 'hard';

    return context;
  }

  getQuickResponse(message) {
    const analysis = this.analyzeMessage(message);
    
    if (!analysis.requiresAI && analysis.confidence > 0.8) {
      return {
        response: analysis.quickResponse,
        cached: true,
        type: analysis.type,
        context: analysis.context
      };
    }

    return null;
  }

  enhancePrompt(message, context, language) {
    let enhancedPrompt = message;
    
    if (context.examType) {
      enhancedPrompt = `For ${context.examType} exam preparation: ${message}`;
    }
    
    if (context.subject) {
      enhancedPrompt += ` Focus on ${context.subject} subject.`;
    }
    
    if (context.difficulty) {
      enhancedPrompt += ` Provide ${context.difficulty} level explanation.`;
    }

    return enhancedPrompt;
  }
}

export const contextualLayer = new ContextualLayer();
