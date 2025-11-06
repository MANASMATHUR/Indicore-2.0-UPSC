'use client';

class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 100;
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  logError(error, context = {}, severity = 'error') {
    const errorEntry = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      severity,
      context,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      sessionId: this.getSessionId()
    };

    this.errorLog.unshift(errorEntry);
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.pop();
    }

    if (this.isDevelopment) {
      console.group(`🚨 ${severity.toUpperCase()}: ${error.message}`);
      console.error('Error:', error);
      console.log('Context:', context);
      console.log('Stack:', error.stack);
      console.groupEnd();
    }

    if (!this.isDevelopment) {
      this.sendToMonitoring(errorEntry);
    }

    return errorEntry.id;
  }

  async handleApiError(error, retryFn, maxRetries = 3) {
    const errorId = this.logError(error, { 
      type: 'api_error',
      retryAttempts: 0 
    }, 'warning');

    if (this.isRetryableError(error) && maxRetries > 0) {
      try {
        await this.delay(this.getRetryDelay(3 - maxRetries));
        return await retryFn();
      } catch (retryError) {
        return this.handleApiError(retryError, retryFn, maxRetries - 1);
      }
    }

    return this.getUserFriendlyMessage(error);
  }

  handleSpeechError(error, speechContext = {}) {
    const errorId = this.logError(error, {
      type: 'speech_error',
      ...speechContext
    }, 'warning');

    if (error.message.includes('not supported')) {
      return {
        userMessage: 'Speech synthesis is not supported in your browser. Please use a modern browser like Chrome, Firefox, or Safari.',
        technicalMessage: 'Browser does not support Speech Synthesis API',
        errorId,
        canRetry: false
      };
    }

    if (error.message.includes('permission')) {
      return {
        userMessage: 'Microphone access is required for voice input. Please allow microphone permissions and try again.',
        technicalMessage: 'Microphone permission denied',
        errorId,
        canRetry: true
      };
    }

    if (error.message.includes('network')) {
      return {
        userMessage: 'Network connection issue. Please check your internet connection and try again.',
        technicalMessage: 'Network error during speech processing',
        errorId,
        canRetry: true
      };
    }

    return {
      userMessage: 'Speech processing encountered an issue. Please try again or use text input.',
      technicalMessage: error.message,
      errorId,
      canRetry: true
    };
  }

  handleChatError(error, chatContext = {}) {
    const errorId = this.logError(error, {
      type: 'chat_error',
      ...chatContext
    }, 'error');

    if (error.message.includes('rate limit')) {
      return {
        userMessage: 'Too many requests. Please wait a moment before sending another message.',
        technicalMessage: 'Rate limit exceeded',
        errorId,
        canRetry: true,
        retryAfter: 30
      };
    }

    if (error.message.includes('unauthorized')) {
      return {
        userMessage: 'Session expired. Please refresh the page and log in again.',
        technicalMessage: 'Authentication failed',
        errorId,
        canRetry: false,
        requiresAuth: true
      };
    }

    if (error.message.includes('timeout')) {
      return {
        userMessage: 'Request timed out. Please check your connection and try again.',
        technicalMessage: 'Request timeout',
        errorId,
        canRetry: true
      };
    }

    if (error.message.includes('temporarily unavailable') || error.message.includes('AI service')) {
      return {
        userMessage: error.message.includes('temporarily unavailable') 
          ? error.message 
          : 'AI service temporarily unavailable. Please try again in a moment.',
        technicalMessage: error.message,
        errorId,
        canRetry: true,
        retryAfter: 10
      };
    }

    return {
      userMessage: error.message.includes('API request failed') 
        ? 'Unable to process your request. Please try again or contact support if the issue persists.'
        : error.message || 'Unable to process your request. Please try again or contact support if the issue persists.',
      technicalMessage: error.message,
      errorId,
      canRetry: true
    };
  }

  getUserFriendlyMessage(error) {
    const friendlyMessages = {
      'NetworkError': 'Please check your internet connection and try again.',
      'TimeoutError': 'The request is taking longer than expected. Please try again.',
      'PermissionDeniedError': 'Please allow the required permissions and try again.',
      'NotSupportedError': 'This feature is not supported in your current browser.',
      'QuotaExceededError': 'Storage quota exceeded. Please clear some data and try again.'
    };

    return friendlyMessages[error.name] || 'An unexpected error occurred. Please try again.';
  }

  isRetryableError(error) {
    const retryableErrors = [
      'NetworkError',
      'TimeoutError',
      'AbortError'
    ];

    return retryableErrors.includes(error.name) || 
           error.message.includes('network') ||
           error.message.includes('timeout');
  }

  getRetryDelay(attempt) {
    return Math.min(1000 * Math.pow(2, attempt), 10000);
  }

  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getSessionId() {
    if (typeof window === 'undefined') return 'server';
    
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }

  async sendToMonitoring(errorEntry) {
    try {
      await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorEntry)
      });
    } catch (monitoringError) {
      const failedErrors = JSON.parse(localStorage.getItem('failedErrors') || '[]');
      failedErrors.push(errorEntry);
      localStorage.setItem('failedErrors', JSON.stringify(failedErrors.slice(-10)));
    }
  }

  getErrorLog() {
    return this.errorLog;
  }

  clearErrorLog() {
    this.errorLog = [];
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const errorHandler = new ErrorHandler();

export default errorHandler;
