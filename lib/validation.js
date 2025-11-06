'use client';

export class ValidationError extends Error {
  constructor(message, field = null, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
  }
}

export class SecurityError extends Error {
  constructor(message, code = 'SECURITY_ERROR') {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
  }
}

export const validators = {
  text: {
    required: (value, fieldName = 'Text') => {
      if (!value || typeof value !== 'string' || value.trim().length === 0) {
        throw new ValidationError(`${fieldName} is required`, fieldName, 'REQUIRED');
      }
      return true;
    },

    maxLength: (value, maxLength, fieldName = 'Text') => {
      if (value && value.length > maxLength) {
        throw new ValidationError(`${fieldName} must be no more than ${maxLength} characters`, fieldName, 'MAX_LENGTH');
      }
      return true;
    },

    minLength: (value, minLength, fieldName = 'Text') => {
      if (value && value.length < minLength) {
        throw new ValidationError(`${fieldName} must be at least ${minLength} characters`, fieldName, 'MIN_LENGTH');
      }
      return true;
    },

    pattern: (value, pattern, fieldName = 'Text', message = 'Invalid format') => {
      if (value && !pattern.test(value)) {
        throw new ValidationError(`${fieldName}: ${message}`, fieldName, 'PATTERN');
      }
      return true;
    }
  },

  email: (value) => {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (value && !emailPattern.test(value)) {
      throw new ValidationError('Invalid email format', 'email', 'INVALID_EMAIL');
    }
    return true;
  },

  language: (value) => {
    const supportedLanguages = ['en', 'hi', 'mr', 'ta', 'bn', 'pa', 'gu', 'te', 'ml', 'kn', 'es'];
    if (value && !supportedLanguages.includes(value)) {
      throw new ValidationError('Unsupported language', 'language', 'UNSUPPORTED_LANGUAGE');
    }
    return true;
  },

  file: {
    type: (file, allowedTypes) => {
      if (file && !allowedTypes.includes(file.type)) {
        throw new ValidationError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`, 'file', 'INVALID_FILE_TYPE');
      }
      return true;
    },

    size: (file, maxSizeInMB) => {
      const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
      if (file && file.size > maxSizeInBytes) {
        throw new ValidationError(`File size too large. Maximum size: ${maxSizeInMB}MB`, 'file', 'FILE_TOO_LARGE');
      }
      return true;
    }
  }
};

export const sanitizers = {
  html: (input) => {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:/gi, '');
  },

  text: (input) => {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/vbscript:/gi, '') // Remove vbscript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .trim();
  },

  sql: (input) => {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/['"]/g, '') // Remove quotes
      .replace(/;/g, '') // Remove semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove SQL comment starts
      .replace(/\*\//g, ''); // Remove SQL comment ends
  }
};

export const security = {
  rateLimiter: new Map(),

  checkRateLimit: (identifier, maxRequests = 10, windowMs = 60000) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!security.rateLimiter.has(identifier)) {
      security.rateLimiter.set(identifier, []);
    }
    
    const requests = security.rateLimiter.get(identifier);
    
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    security.rateLimiter.set(identifier, validRequests);
    
    if (validRequests.length >= maxRequests) {
      throw new SecurityError('Rate limit exceeded. Please wait before making another request.', 'RATE_LIMIT');
    }
    
    validRequests.push(now);
    return true;
  },

  xssProtection: (input) => {
    if (typeof input !== 'string') return input;
    
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(input)) {
        throw new SecurityError('Potentially malicious content detected', 'XSS_DETECTED');
      }
    }
    
    return input;
  },

  validateCSRFToken: (token) => {
    const storedToken = sessionStorage.getItem('csrfToken');
    if (!token || token !== storedToken) {
      throw new SecurityError('Invalid CSRF token', 'INVALID_CSRF');
    }
    return true;
  },

  generateCSRFToken: () => {
    const token = `csrf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('csrfToken', token);
    return token;
  },

  validateCSP: (content) => {
    const cspViolations = [
      'eval(',
      'Function(',
      'setTimeout(',
      'setInterval(',
      'document.write(',
      'innerHTML',
      'outerHTML'
    ];
    
    for (const violation of cspViolations) {
      if (content.includes(violation)) {
        throw new SecurityError('Content Security Policy violation detected', 'CSP_VIOLATION');
      }
    }
    
    return true;
  }
};

export class ValidationPipeline {
  constructor() {
    this.rules = [];
    this.sanitizers = [];
  }

  addRule(validator, ...args) {
    this.rules.push({ validator, args });
    return this;
  }

  addSanitizer(sanitizer) {
    this.sanitizers.push(sanitizer);
    return this;
  }

  validate(value, fieldName = 'field') {
    try {
      let sanitizedValue = value;
      for (const sanitizer of this.sanitizers) {
        sanitizedValue = sanitizer(sanitizedValue);
      }

      for (const rule of this.rules) {
        rule.validator(sanitizedValue, ...rule.args, fieldName);
      }

      return {
        isValid: true,
        value: sanitizedValue,
        errors: []
      };
    } catch (error) {
      return {
        isValid: false,
        value: value,
        errors: [error]
      };
    }
  }
}

export const validationPipelines = {
  chatMessage: new ValidationPipeline()
    .addSanitizer(sanitizers.text)
    .addSanitizer(sanitizers.html)
    .addRule(validators.text.required, 'Message')
    .addRule(validators.text.maxLength, 5000, 'Message')
    .addRule(validators.text.minLength, 1, 'Message'),

  voiceInput: new ValidationPipeline()
    .addRule(validators.text.maxLength, 1000, 'Voice input'),

  multilingualText: new ValidationPipeline()
    .addRule(validators.text.maxLength, 10000, 'Multilingual text'),

  language: new ValidationPipeline()
    .addRule(validators.language),

  fileUpload: (file, maxSizeMB = 10) => new ValidationPipeline()
    .addRule(validators.file.type, ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
    .addRule(validators.file.size, maxSizeMB),

  email: new ValidationPipeline()
    .addSanitizer(sanitizers.text)
    .addRule(validators.email)
    .addRule(validators.text.maxLength, 254, 'Email')
};

export function validateInput(type, value, options = {}) {
  const pipeline = validationPipelines[type];
  if (!pipeline) {
    throw new Error(`Unknown validation type: ${type}`);
  }

  const customPipeline = options.customPipeline || pipeline;
  
  return customPipeline.validate(value, options.fieldName);
}

export function validateSecurity(content, type = 'general') {
  try {
    security.xssProtection(content);
    security.validateCSP(content);
    
    if (content.identifier) {
      security.checkRateLimit(content.identifier, content.maxRequests, content.windowMs);
    }
    
    return { isValid: true, sanitized: content };
  } catch (error) {
    return { isValid: false, error };
  }
}

export default {
  ValidationError,
  SecurityError,
  validators,
  sanitizers,
  security,
  ValidationPipeline,
  validationPipelines,
  validateInput,
  validateSecurity
};
