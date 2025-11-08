/**
 * Language detection and separation utility for PYQ questions
 */

// Common language patterns and scripts
const languagePatterns = {
  // Hindi (Devanagari script)
  hi: {
    script: /[\u0900-\u097F]/,
    patterns: [/[\u0900-\u097F]+/g],
    name: 'Hindi'
  },
  // Tamil
  ta: {
    script: /[\u0B80-\u0BFF]/,
    patterns: [/[\u0B80-\u0BFF]+/g],
    name: 'Tamil'
  },
  // Telugu
  te: {
    script: /[\u0C00-\u0C7F]/,
    patterns: [/[\u0C00-\u0C7F]+/g],
    name: 'Telugu'
  },
  // Kannada
  kn: {
    script: /[\u0C80-\u0CFF]/,
    patterns: [/[\u0C80-\u0CFF]+/g],
    name: 'Kannada'
  },
  // Malayalam
  ml: {
    script: /[\u0D00-\u0D7F]/,
    patterns: [/[\u0D00-\u0D7F]+/g],
    name: 'Malayalam'
  },
  // Marathi (uses Devanagari like Hindi)
  mr: {
    script: /[\u0900-\u097F]/,
    patterns: [/[\u0900-\u097F]+/g],
    name: 'Marathi'
  },
  // Gujarati
  gu: {
    script: /[\u0A80-\u0AFF]/,
    patterns: [/[\u0A80-\u0AFF]+/g],
    name: 'Gujarati'
  },
  // Punjabi (Gurmukhi)
  pa: {
    script: /[\u0A00-\u0A7F]/,
    patterns: [/[\u0A00-\u0A7F]+/g],
    name: 'Punjabi'
  },
  // Bengali
  bn: {
    script: /[\u0980-\u09FF]/,
    patterns: [/[\u0980-\u09FF]+/g],
    name: 'Bengali'
  },
  // Odia
  or: {
    script: /[\u0B00-\u0B7F]/,
    patterns: [/[\u0B00-\u0B7F]+/g],
    name: 'Odia'
  },
  // Assamese
  as: {
    script: /[\u0980-\u09FF]/,
    patterns: [/[\u0980-\u09FF]+/g],
    name: 'Assamese'
  },
  // Urdu (Arabic script)
  ur: {
    script: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/,
    patterns: [/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g],
    name: 'Urdu'
  },
  // Nepali (Devanagari)
  ne: {
    script: /[\u0900-\u097F]/,
    patterns: [/[\u0900-\u097F]+/g],
    name: 'Nepali'
  },
  // Sinhala
  si: {
    script: /[\u0D80-\u0DFF]/,
    patterns: [/[\u0D80-\u0DFF]+/g],
    name: 'Sinhala'
  },
  // English (Latin script, default)
  en: {
    script: /[a-zA-Z]/,
    patterns: [/[a-zA-Z]+/g],
    name: 'English'
  }
};

/**
 * Detect languages present in a text
 * @param {string} text - The text to analyze
 * @returns {Array<string>} - Array of language codes detected
 */
export function detectLanguages(text) {
  if (!text || typeof text !== 'string') return ['en'];

  const detectedLanguages = new Set();
  const textLength = text.length;

  // Check each language pattern
  for (const [langCode, langInfo] of Object.entries(languagePatterns)) {
    if (langCode === 'en') continue; // Skip English for now
    
    const matches = text.match(langInfo.script);
    if (matches) {
      const matchLength = matches.join('').length;
      // If at least 5% of the text is in this script, consider it detected
      if (matchLength / textLength > 0.05) {
        detectedLanguages.add(langCode);
      }
    }
  }

  // Check for English (Latin script with common English words)
  const englishWords = text.match(/[a-zA-Z]+/g) || [];
  const englishWordCount = englishWords.length;
  const totalWords = text.split(/\s+/).filter(w => w.length > 0).length;
  
  if (totalWords > 0 && englishWordCount / totalWords > 0.3) {
    detectedLanguages.add('en');
  } else if (detectedLanguages.size === 0) {
    // Default to English if no other language detected
    detectedLanguages.add('en');
  }

  return Array.from(detectedLanguages);
}

/**
 * Separate multi-language text into language-specific segments
 * @param {string} text - The text containing multiple languages
 * @returns {Array<{language: string, text: string}>} - Array of language-specific text segments
 */
export function separateLanguages(text) {
  if (!text || typeof text !== 'string') return [{ language: 'en', text: text || '' }];

  const detectedLanguages = detectLanguages(text);
  
  // If only one language detected, return as is
  if (detectedLanguages.length === 1) {
    return [{ language: detectedLanguages[0], text: text.trim() }];
  }

  // Separate by language
  const segments = [];
  const lines = text.split(/\n/).filter(line => line.trim().length > 0);
  
  // Group consecutive lines by language
  let currentLanguage = null;
  let currentSegment = [];

  for (const line of lines) {
    const lineLanguages = detectLanguages(line);
    const primaryLanguage = lineLanguages[0] || 'en';

    if (currentLanguage === primaryLanguage) {
      currentSegment.push(line);
    } else {
      // Save previous segment
      if (currentSegment.length > 0 && currentLanguage) {
        segments.push({
          language: currentLanguage,
          text: currentSegment.join('\n').trim()
        });
      }
      // Start new segment
      currentLanguage = primaryLanguage;
      currentSegment = [line];
    }
  }

  // Save last segment
  if (currentSegment.length > 0 && currentLanguage) {
    segments.push({
      language: currentLanguage,
      text: currentSegment.join('\n').trim()
    });
  }

  // If separation didn't work well, try character-level separation
  if (segments.length === 0 || segments.length === 1) {
    // Try splitting by script boundaries
    const scriptSegments = [];
    let currentScript = null;
    let currentText = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      let charScript = null;

      // Determine script of current character
      for (const [langCode, langInfo] of Object.entries(languagePatterns)) {
        if (langInfo.script.test(char)) {
          charScript = langCode;
          break;
        }
      }

      // If character is space/newline, keep it with current script
      if (/\s/.test(char)) {
        if (currentText) {
          currentText += char;
        }
        continue;
      }

      if (charScript === currentScript || (!currentScript && charScript)) {
        currentScript = charScript || 'en';
        currentText += char;
      } else {
        // Save previous segment
        if (currentText.trim().length > 10) {
          scriptSegments.push({
            language: currentScript || 'en',
            text: currentText.trim()
          });
        }
        // Start new segment
        currentScript = charScript || 'en';
        currentText = char;
      }
    }

    // Save last segment
    if (currentText.trim().length > 10) {
      scriptSegments.push({
        language: currentScript || 'en',
        text: currentText.trim()
      });
    }

    // Use script-based separation if it found multiple segments
    if (scriptSegments.length > 1) {
      return scriptSegments;
    }
  }

  // If we still have only one segment but detected multiple languages, 
  // mark it as multi-language
  if (segments.length === 1 && detectedLanguages.length > 1) {
    return [{
      language: 'multi',
      text: text.trim(),
      detectedLanguages: detectedLanguages
    }];
  }

  // Filter out very short segments (likely noise)
  return segments.filter(seg => seg.text.length >= 10);
}

/**
 * Check if text contains multiple languages
 * @param {string} text - The text to check
 * @returns {boolean} - True if multiple languages detected
 */
export function isMultiLanguage(text) {
  const languages = detectLanguages(text);
  return languages.length > 1;
}

/**
 * Get primary language of text
 * @param {string} text - The text to analyze
 * @returns {string} - Primary language code
 */
export function getPrimaryLanguage(text) {
  const languages = detectLanguages(text);
  // Prefer non-English languages if present
  const nonEnglish = languages.filter(lang => lang !== 'en');
  return nonEnglish.length > 0 ? nonEnglish[0] : (languages[0] || 'en');
}

