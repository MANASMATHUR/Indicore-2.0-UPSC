export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateMessage = (message) => {
  if (!message || typeof message !== 'string') {
    return { isValid: false, error: 'Message is required' };
  }
  
  if (message.trim().length === 0) {
    return { isValid: false, error: 'Message cannot be empty' };
  }
  
  if (message.length > 4000) {
    return { isValid: false, error: 'Message is too long (max 4000 characters)' };
  }
  
  return { isValid: true };
};

export const validateChatName = (name) => {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Chat name is required' };
  }
  
  if (name.trim().length === 0) {
    return { isValid: false, error: 'Chat name cannot be empty' };
  }
  
  if (name.length > 100) {
    return { isValid: false, error: 'Chat name is too long (max 100 characters)' };
  }
  
  return { isValid: true };
};

export const validateSettings = (settings) => {
  const errors = {};
  
  if (!settings.language || typeof settings.language !== 'string') {
    errors.language = 'Language is required';
  }
  
  if (!settings.model || typeof settings.model !== 'string') {
    errors.model = 'Model is required';
  }
  
  if (settings.systemPrompt && settings.systemPrompt.length > 2000) {
    errors.systemPrompt = 'System prompt is too long (max 2000 characters)';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim();
};
