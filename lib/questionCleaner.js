/**
 * Utility functions for cleaning and normalizing PYQ questions
 */

/**
 * Remove option markers (A, B, C, D, a, b, c, d, etc.) from the beginning of questions
 * @param {string} question - The question text
 * @returns {string} - Cleaned question without option markers
 */
export function removeOptionMarkers(question) {
  if (!question || typeof question !== 'string') return question;

  let cleaned = question.trim();

  // Patterns to match option markers at the start:
  // - (A), (B), (C), (D)
  // - A., B., C., D.
  // - a), b), c), d)
  // - (a), (b), (c), (d)
  // - A) B) C) D)
  // - i), ii), iii), iv)
  // - 1), 2), 3), 4)
  // - (1), (2), (3), (4)
  // - A., B., C., D. (with period)
  // - Hindi: (क), (ख), (ग), (घ)
  
  // Remove option markers at the start
  cleaned = cleaned.replace(/^\(?([A-Da-d1-4ivx]+)\)?\s*[\.\)]\s*/i, '');
  
  // Remove Hindi option markers: (क), (ख), (ग), (घ)
  cleaned = cleaned.replace(/^\(?([कखगघ])\)?\s*[\.\)]\s*/, '');
  
  // Remove Roman numerals: (i), (ii), (iii), (iv)
  cleaned = cleaned.replace(/^\(?([ivx]+)\)?\s*[\.\)]\s*/i, '');
  
  // Remove numbered options: 1), 2), 3), 4)
  cleaned = cleaned.replace(/^\(?([1-4])\)?\s*[\.\)]\s*/, '');
  
  // Remove "Option A:", "Option B:", etc.
  cleaned = cleaned.replace(/^Option\s+[A-Da-d1-4]\s*[:\.]\s*/i, '');
  
  // Remove "A:", "B:", "C:", "D:" at the start
  cleaned = cleaned.replace(/^([A-Da-d])\s*[:\.]\s*/, '');
  
  // Remove any remaining leading option-like patterns
  cleaned = cleaned.replace(/^\(?[A-Da-d1-4]\)?\s*[-–—]\s*/, '');
  
  return cleaned.trim();
}

/**
 * Extract and separate mixed-language questions
 * Attempts to extract the primary language version or split into separate parts
 * @param {string} question - The mixed-language question
 * @param {string} preferredLang - Preferred language ('en' or 'hi')
 * @returns {string} - Cleaned question in preferred language if possible
 */
export function cleanMixedLanguageQuestion(question, preferredLang = 'en') {
  if (!question || typeof question !== 'string') return question;

  // Check if it's truly mixed (has both Devanagari and Latin scripts)
  const hasHindi = /[\u0900-\u097F]/.test(question);
  const hasEnglish = /[a-zA-Z]/.test(question);
  
  if (!hasHindi || !hasEnglish) {
    // Not mixed, return as is
    return question.trim();
  }

  // Split by common separators that might indicate language boundaries
  const separators = [
    /\s+-\s+/,           // " - "
    /\s*[–—]\s*/,         // " – " or " — "
    /\s*\(/,              // " ("
    /\s*\)/,              // " )"
    /\s*\[/,              // " ["
    /\s*\]/,              // " ]"
    /\n+/,                // New lines
    /\s*:\s*/,            // " : "
  ];

  // Try to find the dominant language section
  const parts = question.split(/\s+-\s+|\s*[–—]\s*|\n+/);
  
  let hindiParts = [];
  let englishParts = [];
  
  for (const part of parts) {
    const partTrimmed = part.trim();
    if (!partTrimmed) continue;
    
    const partHasHindi = /[\u0900-\u097F]/.test(partTrimmed);
    const partHasEnglish = /[a-zA-Z]/.test(partTrimmed);
    
    // Count characters
    const hindiChars = (partTrimmed.match(/[\u0900-\u097F]/g) || []).length;
    const englishChars = (partTrimmed.match(/[a-zA-Z]/g) || []).length;
    
    if (partHasHindi && !partHasEnglish) {
      hindiParts.push({ text: partTrimmed, chars: hindiChars });
    } else if (partHasEnglish && !partHasHindi) {
      englishParts.push({ text: partTrimmed, chars: englishChars });
    } else if (partHasHindi && partHasEnglish) {
      // Still mixed, try to extract dominant
      if (hindiChars > englishChars * 1.5) {
        hindiParts.push({ text: partTrimmed, chars: hindiChars });
      } else if (englishChars > hindiChars * 1.5) {
        englishParts.push({ text: partTrimmed, chars: englishChars });
      } else {
        // Roughly equal, add to both
        hindiParts.push({ text: partTrimmed, chars: hindiChars });
        englishParts.push({ text: partTrimmed, chars: englishChars });
      }
    }
  }

  // If we have clean separation, return the preferred language version
  if (preferredLang === 'hi' && hindiParts.length > 0) {
    const totalHindiChars = hindiParts.reduce((sum, p) => sum + p.chars, 0);
    const totalEnglishChars = englishParts.reduce((sum, p) => sum + p.chars, 0);
    
    if (totalHindiChars > totalEnglishChars) {
      return hindiParts.map(p => p.text).join(' ').trim();
    }
  } else if (preferredLang === 'en' && englishParts.length > 0) {
    const totalHindiChars = hindiParts.reduce((sum, p) => sum + p.chars, 0);
    const totalEnglishChars = englishParts.reduce((sum, p) => sum + p.chars, 0);
    
    if (totalEnglishChars > totalHindiChars) {
      return englishParts.map(p => p.text).join(' ').trim();
    }
  }

  // If we can't cleanly separate, try to extract the question part (usually comes first)
  // Look for common patterns like "What is...", "Explain...", etc. in English
  // Or Hindi question words like "क्या", "कैसे", "क्यों"
  const englishQuestionStart = /^(What|Which|Who|When|Where|Why|How|Explain|Describe|Discuss|Analyze|Evaluate|Compare|Contrast|Define|List|Name|State|Write|Give|Provide|Mention|Identify|Classify|Distinguish|Differentiate|Elaborate|Illustrate|Justify|Critically|Examine|Assess|Outline|Summarize)/i;
  const hindiQuestionStart = /^(क्या|कैसे|क्यों|कौन|कहाँ|कब|किस|किसे|किसका|किसकी|किसके|किसको|किसमें|किसने|किसका|किसकी|किसके|किसको|किसमें|वर्णन|व्याख्या|समझाइए|लिखिए|बताइए|कीजिए|करें)/i;

  const lines = question.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
  
  for (const line of lines) {
    if (preferredLang === 'en' && englishQuestionStart.test(line)) {
      // Found English question start, extract from here
      const englishIndex = question.indexOf(line);
      const remaining = question.substring(englishIndex);
      // Try to extract just the English part
      const englishMatch = remaining.match(/^[^\u0900-\u097F]+/);
      if (englishMatch && englishMatch[0].trim().length > 20) {
        return englishMatch[0].trim();
      }
    } else if (preferredLang === 'hi' && hindiQuestionStart.test(line)) {
      // Found Hindi question start, extract from here
      const hindiIndex = question.indexOf(line);
      const remaining = question.substring(hindiIndex);
      // Try to extract just the Hindi part (may include some English)
      const hindiMatch = remaining.match(/^[\u0900-\u097F\s]+[^\u0900-\u097F]*/);
      if (hindiMatch && hindiMatch[0].trim().length > 20) {
        return hindiMatch[0].trim();
      }
    }
  }

  // Last resort: return the longer language version
  const totalHindiChars = (question.match(/[\u0900-\u097F]/g) || []).length;
  const totalEnglishChars = (question.match(/[a-zA-Z]/g) || []).length;
  
  if (preferredLang === 'hi' && totalHindiChars > totalEnglishChars) {
    // Try to extract Hindi parts
    const hindiOnly = question.replace(/[^\u0900-\u097F\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (hindiOnly.length > 20) return hindiOnly;
  } else if (preferredLang === 'en' && totalEnglishChars > totalHindiChars) {
    // Try to extract English parts
    const englishOnly = question.replace(/[\u0900-\u097F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (englishOnly.length > 20) return englishOnly;
  }

  // If all else fails, return as is (but cleaned)
  return question.trim().replace(/\s+/g, ' ');
}

/**
 * Comprehensive question cleaning
 * Removes options, cleans formatting, handles mixed languages
 * @param {string} question - The question text
 * @param {string} lang - Expected language ('en' or 'hi')
 * @returns {string} - Cleaned question
 */
export function cleanQuestion(question, lang = 'en') {
  if (!question || typeof question !== 'string') return question;

  let cleaned = question.trim();

  // Step 1: Remove option markers
  cleaned = removeOptionMarkers(cleaned);

  // Step 2: Remove leading question numbers (Q1, Q.1, 1., etc.)
  cleaned = cleaned.replace(/^Q\.?\s*\d+\s*[\.\):]\s*/i, '');
  cleaned = cleaned.replace(/^\d+[\.\)]\s*/, '');
  cleaned = cleaned.replace(/^Question\s+\d+\s*[\.\):]\s*/i, '');
  cleaned = cleaned.replace(/^प्रश्न\s*\d+\s*[\.\):]\s*/, '');

  // Step 3: Remove leading whitespace and normalize
  cleaned = cleaned.replace(/^\s+/, '');
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Step 4: Handle mixed-language questions
  const hasHindi = /[\u0900-\u097F]/.test(cleaned);
  const hasEnglish = /[a-zA-Z]/.test(cleaned);
  
  if (hasHindi && hasEnglish) {
    // Try to clean mixed language
    cleaned = cleanMixedLanguageQuestion(cleaned, lang);
  }

  // Step 5: Remove trailing option markers or incomplete sentences
  cleaned = cleaned.replace(/\s*\([A-Da-d]\)\s*$/, '');
  cleaned = cleaned.replace(/\s*[A-Da-d]\s*$/, '');
  
  // Step 6: Final cleanup
  cleaned = cleaned.trim();
  
  // Ensure question ends properly (should end with ? or be a complete statement)
  if (cleaned.length > 0 && !/[?!.]$/.test(cleaned)) {
    // Don't add punctuation, just ensure it's clean
  }

  return cleaned;
}

/**
 * Check if a question has options embedded in it
 * @param {string} question - The question text
 * @returns {boolean} - True if question likely contains options
 */
export function hasEmbeddedOptions(question) {
  if (!question || typeof question !== 'string') return false;

  // Check for common option patterns
  const optionPatterns = [
    /\([A-Da-d]\)/g,           // (A), (B), etc.
    /^[A-Da-d][\.\)]\s+/m,     // A., B., etc. at start of lines
    /Option\s+[A-D]/i,          // "Option A", "Option B"
    /\([कखगघ]\)/,              // Hindi options
  ];

  let optionCount = 0;
  for (const pattern of optionPatterns) {
    const matches = question.match(pattern);
    if (matches) optionCount += matches.length;
  }

  // If we find 2+ option markers, likely has embedded options
  return optionCount >= 2;
}

/**
 * Extract question text from a string that might contain options
 * @param {string} text - Text that might contain question + options
 * @returns {string} - Extracted question text
 */
export function extractQuestionFromText(text) {
  if (!text || typeof text !== 'string') return text;

  // If it has embedded options, try to extract just the question
  if (hasEmbeddedOptions(text)) {
    // Try to find where options start (usually after the question mark or colon)
    const questionEnd = text.search(/[?]\s*(?:\([A-Da-d]\)|Option\s+[A-D]|\([कखगघ]\))/i);
    if (questionEnd > 0) {
      return text.substring(0, questionEnd + 1).trim();
    }
    
    // Try splitting by option markers
    const parts = text.split(/(?:\([A-Da-d]\)|Option\s+[A-D])/i);
    if (parts.length > 1 && parts[0].trim().length > 10) {
      return parts[0].trim();
    }
  }

  return text.trim();
}

