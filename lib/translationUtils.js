'use client';

/**
 * Utility functions for multilingual support across features
 */

export const supportedLanguages = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'bn', name: 'Bengali' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'te', name: 'Telugu' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'kn', name: 'Kannada' },
];

/**
 * Translate text using the translation API
 */
export async function translateText(text, targetLanguage = 'en', sourceLanguage = 'auto') {
  if (!text || !text.trim()) return text;
  if (targetLanguage === 'en' && sourceLanguage === 'auto') return text;

  try {
    const response = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim(),
        sourceLanguage,
        targetLanguage,
        isStudyMaterial: true
      })
    });

    if (!response.ok) {
      throw new Error(`Translation failed: ${response.status}`);
    }

    const data = await response.json();
    return data.translatedText || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Return original text on error
  }
}

/**
 * Translate an array of texts
 */
export async function translateArray(texts, targetLanguage = 'en', sourceLanguage = 'auto') {
  if (!Array.isArray(texts) || texts.length === 0) return texts;
  if (targetLanguage === 'en' && sourceLanguage === 'auto') return texts;

  try {
    // Translate all texts in parallel
    const translations = await Promise.all(
      texts.map(text => translateText(text, targetLanguage, sourceLanguage))
    );
    return translations;
  } catch (error) {
    console.error('Batch translation error:', error);
    return texts;
  }
}

/**
 * Get language name from code
 */
export function getLanguageName(code) {
  const lang = supportedLanguages.find(l => l.code === code);
  return lang ? lang.name : 'English';
}

/**
 * Store selected language in localStorage
 */
export function saveLanguagePreference(language) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('preferredLanguage', language);
  }
}

/**
 * Get saved language preference from localStorage
 */
export function getLanguagePreference() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('preferredLanguage') || 'en';
  }
  return 'en';
}

/**
 * Sanitize translation output to remove any unwanted content
 */
export function sanitizeTranslationOutput(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Remove any HTML tags that might have been added
  let sanitized = text.replace(/<[^>]*>/g, '');
  
  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Remove any control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
}
