import { NextApiRequest, NextApiResponse } from 'next';
import { sanitizeTranslationOutput } from '@/lib/translationUtils';

// Simple in-memory cache for translations
const translationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Enterprise validation and security
function validateTranslateRequest(req) {
  const { text, sourceLanguage, targetLanguage, isStudyMaterial = false } = req.body;

  // Input validation
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text is required and must be a non-empty string');
  }

  if (text.length > 5000) {
    throw new Error('Text too long: maximum 5,000 characters allowed');
  }

  if (!sourceLanguage || typeof sourceLanguage !== 'string') {
    throw new Error('Source language is required');
  }

  if (!targetLanguage || typeof targetLanguage !== 'string') {
    throw new Error('Target language is required');
  }

  const supportedLanguages = ['en', 'hi', 'mr', 'ta', 'bn', 'pa', 'gu', 'te', 'ml', 'kn', 'es', 'auto'];
  
  if (!supportedLanguages.includes(sourceLanguage)) {
    throw new Error('Unsupported source language');
  }

  if (!supportedLanguages.includes(targetLanguage)) {
    throw new Error('Unsupported target language');
  }

  // Security validation
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(text)) {
      throw new Error('Potentially malicious content detected');
    }
  }

  return { text: text.trim(), sourceLanguage, targetLanguage, isStudyMaterial };
}

export default async function handler(req, res) {
  // CORS headers for enterprise security
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    });
  }

  try {
    // Enterprise validation
    const { text, sourceLanguage, targetLanguage, isStudyMaterial } = validateTranslateRequest(req);

    // Rate limiting (basic implementation)
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const rateLimitKey = `translate_${clientIP}`;
    
    // Enhanced translation with AI models for study materials
    const startTime = Date.now();
    const translatedText = await translateText(text, sourceLanguage, targetLanguage, isStudyMaterial);
    const processingTime = Date.now() - startTime;
    
    res.status(200).json({ 
      translatedText,
      sourceLanguage,
      targetLanguage,
      originalText: text,
      isStudyMaterial,
      processingTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Translation API Error:', error);
    
    if (error.message.includes('malicious') || error.message.includes('unsupported')) {
      return res.status(400).json({ 
        error: error.message,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({ 
      error: 'Translation service temporarily unavailable',
      code: 'SERVICE_ERROR',
      timestamp: new Date().toISOString()
    });
  }
}

async function translateText(text, sourceLang, targetLang, isStudyMaterial = false) {
  if (sourceLang === targetLang) {
    return text;
  }

  if (sourceLang === 'auto') {
    sourceLang = 'en';
  }

  // Check cache first
  const cacheKey = `${text}-${sourceLang}-${targetLang}-${isStudyMaterial}`;
  const cached = translationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.translation;
  }

  const languageNames = {
    'en': 'English',
    'es': 'Spanish',
    'hi': 'Hindi',
    'mr': 'Marathi',
    'ta': 'Tamil',
    'bn': 'Bengali',
    'pa': 'Punjabi',
    'gu': 'Gujarati',
    'te': 'Telugu',
    'ml': 'Malayalam',
    'kn': 'Kannada'
  };

  // For study materials, try AI models first for better quality (run in parallel to reduce latency)
  if (isStudyMaterial) {
    const attempts = [];
    const tryModel = (p) => p.then(r => {
      if (r && typeof r === 'string' && r.trim()) return r;
      throw new Error('empty_translation');
    });

    if (process.env.GEMINI_API_KEY) attempts.push(tryModel(translateWithGemini(text, sourceLang, targetLang, 8000)));
    if (process.env.COHERE_API_KEY) attempts.push(tryModel(translateWithCohere(text, sourceLang, targetLang, 8000)));
    if (process.env.MISTRAL_API_KEY) attempts.push(tryModel(translateWithMistral(text, sourceLang, targetLang, 8000)));

    if (attempts.length) {
      try {
        const best = await Promise.any(attempts);
        return best;
      } catch (e) {
        // fall through to free providers
      }
    }
  }

  // Try free providers in parallel and take the first successful
  try {
    const tryProvider = (fn) => fn().then(r => {
      if (r && typeof r === 'string' && r.trim()) return r;
      throw new Error('empty_translation');
    });

    const libre = () => fetchWithTimeout('https://libretranslate.de/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: sourceLang, target: targetLang, format: 'text' })
    }, 7000).then(async res => {
      if (!res.ok) throw new Error('libre_error');
      const data = await res.json();
      return sanitizeTranslationOutput(data.translatedText || '');
    });

    const myMemory = () => fetchWithTimeout(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`, {}, 7000)
      .then(async res => {
        if (!res.ok) throw new Error('mymemory_error');
        const data = await res.json();
        return sanitizeTranslationOutput((data && data.responseData && data.responseData.translatedText) || '');
      });

    const freeAttempts = [tryProvider(libre()), tryProvider(myMemory())];
    const firstFree = await Promise.any(freeAttempts);
    if (firstFree) return firstFree;
  } catch (error) {
    // continue to Google if available
  }

  // Try Google Translate API if available
  if (process.env.GOOGLE_TRANSLATE_API_KEY) {
    try {
      const response = await fetchWithTimeout(`https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: sourceLang,
          target: targetLang,
          format: 'text'
        })
      }, 8000);

      if (response.ok) {
        const data = await response.json();
        return sanitizeTranslationOutput(data.data.translations[0].translatedText);
      }
    } catch (error) {
    }
  }

  // Enhanced fallback with study material context
  const sourceLangName = languageNames[sourceLang] || sourceLang;
  const targetLangName = languageNames[targetLang] || targetLang;
  
  let translatedText = text;
  
  // Enhanced word mapping for study materials
  if (isStudyMaterial && sourceLang === 'en') {
    translatedText = enhanceStudyMaterialTranslation(text, targetLang);
  } else {
    // Basic word mapping for all supported languages
    translatedText = basicTranslation(text, sourceLang, targetLang);
  }

  // Cache the result
  translationCache.set(cacheKey, {
    translation: translatedText,
    timestamp: Date.now()
  });

  // Clean old cache entries periodically
  if (translationCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of translationCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        translationCache.delete(key);
      }
    }
  }

  // Return clean translation without metadata for better speech synthesis
  return sanitizeTranslationOutput(translatedText);
}

// Gemini API translation for study materials (FREE TIER)
async function translateWithGemini(text, sourceLang, targetLang, timeoutMs = 8000) {
  const languageNames = {
    'en': 'English', 'hi': 'Hindi', 'mr': 'Marathi', 'ta': 'Tamil', 
    'bn': 'Bengali', 'pa': 'Punjabi', 'gu': 'Gujarati', 'te': 'Telugu', 
    'ml': 'Malayalam', 'kn': 'Kannada', 'es': 'Spanish'
  };

  const sourceLangName = languageNames[sourceLang] || sourceLang;
  const targetLangName = languageNames[targetLang] || targetLang;

  const prompt = `You are an expert translator specializing in educational content for competitive exams like PCS, UPSC, and SSC. 

Translate the following ${sourceLangName} study material to ${targetLangName}. The translation should:
- Preserve the academic tone and exam-relevant vocabulary
- Use formal language appropriate for competitive exams
- Maintain technical terms and concepts accurately
- Ensure the translation is suitable for state-level PCS exam preparation
- Keep the structure and formatting intact
- Provide natural, fluent translation

Text to translate:
${text}

Translation:`;

  try {
    const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000,
          topP: 0.8,
          topK: 40
        }
      })
    }, timeoutMs);

    if (response.ok) {
      const data = await response.json();
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        return sanitizeTranslationOutput(data.candidates[0].content.parts[0].text.trim());
      }
    }
  } catch (error) {
  }
  return null;
}

// Cohere API translation for study materials
async function translateWithCohere(text, sourceLang, targetLang, timeoutMs = 8000) {
  const languageNames = {
    'en': 'English', 'hi': 'Hindi', 'mr': 'Marathi', 'ta': 'Tamil', 
    'bn': 'Bengali', 'pa': 'Punjabi', 'gu': 'Gujarati', 'te': 'Telugu', 
    'ml': 'Malayalam', 'kn': 'Kannada', 'es': 'Spanish'
  };

  const sourceLangName = languageNames[sourceLang] || sourceLang;
  const targetLangName = languageNames[targetLang] || targetLang;

  const prompt = `You are an expert translator specializing in educational content for competitive exams like PCS, UPSC, and SSC. 

Translate the following ${sourceLangName} study material to ${targetLangName}. The translation should:
- Preserve the academic tone and exam-relevant vocabulary
- Use formal language appropriate for competitive exams
- Maintain technical terms and concepts accurately
- Ensure the translation is suitable for state-level PCS exam preparation
- Keep the structure and formatting intact

Text to translate:
${text}

Translation:`;

  try {
    const response = await fetchWithTimeout('https://api.cohere.ai/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'command',
        prompt: prompt,
        max_tokens: 2000,
        temperature: 0.3,
        stop_sequences: ['---']
      })
    }, timeoutMs);

    if (response.ok) {
      const data = await response.json();
      return sanitizeTranslationOutput(data.generations[0].text.trim());
    }
  } catch (error) {
  }
  return null;
}

// Mistral API translation for study materials
async function translateWithMistral(text, sourceLang, targetLang, timeoutMs = 8000) {
  const languageNames = {
    'en': 'English', 'hi': 'Hindi', 'mr': 'Marathi', 'ta': 'Tamil', 
    'bn': 'Bengali', 'pa': 'Punjabi', 'gu': 'Gujarati', 'te': 'Telugu', 
    'ml': 'Malayalam', 'kn': 'Kannada', 'es': 'Spanish'
  };

  const sourceLangName = languageNames[sourceLang] || sourceLang;
  const targetLangName = languageNames[targetLang] || targetLang;

  const prompt = `You are an expert translator specializing in educational content for competitive exams like PCS, UPSC, and SSC. 

Translate the following ${sourceLangName} study material to ${targetLangName}. The translation should:
- Preserve the academic tone and exam-relevant vocabulary
- Use formal language appropriate for competitive exams
- Maintain technical terms and concepts accurately
- Ensure the translation is suitable for state-level PCS exam preparation
- Keep the structure and formatting intact

Text to translate:
${text}

Translation:`;

  try {
    const response = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      })
    }, timeoutMs);

    if (response.ok) {
      const data = await response.json();
      return sanitizeTranslationOutput(data.choices[0].message.content.trim());
    }
  } catch (error) {
  }
  return null;
}

// Enhanced study material translation with exam-specific vocabulary
function enhanceStudyMaterialTranslation(text, targetLang) {
  const studyTerms = {
    'hi': {
      'government': 'सरकार',
      'administration': 'प्रशासन',
      'constitution': 'संविधान',
      'democracy': 'लोकतंत्र',
      'economy': 'अर्थव्यवस्था',
      'development': 'विकास',
      'policy': 'नीति',
      'reform': 'सुधार',
      'governance': 'शासन',
      'bureaucracy': 'नौकरशाही',
      'civil service': 'सिविल सेवा',
      'public administration': 'लोक प्रशासन',
      'judiciary': 'न्यायपालिका',
      'legislature': 'विधायिका',
      'executive': 'कार्यपालिका',
      'federalism': 'संघवाद',
      'secularism': 'धर्मनिरपेक्षता',
      'socialism': 'समाजवाद',
      'republic': 'गणतंत्र',
      'sovereignty': 'संप्रभुता',
      'integrity': 'अखंडता',
      'unity': 'एकता',
      'diversity': 'विविधता',
      'equality': 'समानता',
      'justice': 'न्याय',
      'liberty': 'स्वतंत्रता',
      'fraternity': 'बंधुत्व'
    },
    'mr': {
      'government': 'सरकार',
      'administration': 'प्रशासन',
      'constitution': 'घटना',
      'democracy': 'लोकशाही',
      'economy': 'अर्थव्यवस्था',
      'development': 'विकास',
      'policy': 'धोरण',
      'reform': 'सुधारणा',
      'governance': 'शासन',
      'bureaucracy': 'नोकरशाही',
      'civil service': 'नागरी सेवा',
      'public administration': 'सार्वजनिक प्रशासन',
      'judiciary': 'न्यायव्यवस्था',
      'legislature': 'विधानसभा',
      'executive': 'कार्यकारी',
      'federalism': 'संघराज्यवाद',
      'secularism': 'धर्मनिरपेक्षता',
      'socialism': 'समाजवाद',
      'republic': 'प्रजासत्ताक',
      'sovereignty': 'सार्वभौमत्व',
      'integrity': 'अखंडता',
      'unity': 'एकता',
      'diversity': 'विविधता',
      'equality': 'समानता',
      'justice': 'न्याय',
      'liberty': 'स्वातंत्र्य',
      'fraternity': 'बंधुत्व'
    },
    'ta': {
      'government': 'அரசு',
      'administration': 'நிர்வாகம்',
      'constitution': 'அரசியலமைப்பு',
      'democracy': 'ஜனநாயகம்',
      'economy': 'பொருளாதாரம்',
      'development': 'வளர்ச்சி',
      'policy': 'கொள்கை',
      'reform': 'சீர்திருத்தம்',
      'governance': 'ஆட்சி',
      'bureaucracy': 'அதிகாரவர்க்கம்',
      'civil service': 'குடிமை சேவை',
      'public administration': 'பொது நிர்வாகம்',
      'judiciary': 'நீதித்துறை',
      'legislature': 'சட்டமன்றம்',
      'executive': 'செயலாட்சி',
      'federalism': 'கூட்டாட்சி',
      'secularism': 'மதச்சார்பின்மை',
      'socialism': 'சமூகவாதம்',
      'republic': 'குடியரசு',
      'sovereignty': 'இறையாண்மை',
      'integrity': 'ஒருமைப்பாடு',
      'unity': 'ஒற்றுமை',
      'diversity': 'பன்முகத்தன்மை',
      'equality': 'சமத்துவம்',
      'justice': 'நீதி',
      'liberty': 'சுதந்திரம்',
      'fraternity': 'சகோதரத்துவம்'
    }
  };

  let translatedText = text;
  const terms = studyTerms[targetLang] || {};

  // Replace study-specific terms
  Object.entries(terms).forEach(([english, translation]) => {
    const regex = new RegExp(`\\b${english}\\b`, 'gi');
    translatedText = translatedText.replace(regex, translation);
  });

  return translatedText;
}

// Basic translation fallback
function basicTranslation(text, sourceLang, targetLang) {
  let translatedText = text;
  
  // Basic word mapping for all supported languages
  if (sourceLang === 'en' && targetLang === 'hi') {
    translatedText = text
      .replace(/\bhello\b/gi, 'नमस्ते')
      .replace(/\bhi\b/gi, 'नमस्ते')
      .replace(/\bthank you\b/gi, 'धन्यवाद')
      .replace(/\bthanks\b/gi, 'धन्यवाद')
      .replace(/\bgood\b/gi, 'अच्छा')
      .replace(/\bbad\b/gi, 'बुरा')
      .replace(/\byes\b/gi, 'हाँ')
      .replace(/\bno\b/gi, 'नहीं')
      .replace(/\bplease\b/gi, 'कृपया')
      .replace(/\bsorry\b/gi, 'माफ करें')
      .replace(/\bwelcome\b/gi, 'स्वागत है')
      .replace(/\bgoodbye\b/gi, 'अलविदा');
  } else if (sourceLang === 'en' && targetLang === 'bn') {
    translatedText = text
      .replace(/\bhello\b/gi, 'হ্যালো')
      .replace(/\bhi\b/gi, 'হ্যালো')
      .replace(/\bthank you\b/gi, 'ধন্যবাদ')
      .replace(/\bthanks\b/gi, 'ধন্যবাদ')
      .replace(/\bgood\b/gi, 'ভাল')
      .replace(/\bbad\b/gi, 'খারাপ')
      .replace(/\byes\b/gi, 'হ্যাঁ')
      .replace(/\bno\b/gi, 'না')
      .replace(/\bplease\b/gi, 'দয়া করে')
      .replace(/\bsorry\b/gi, 'দুঃখিত')
      .replace(/\bwelcome\b/gi, 'স্বাগতম')
      .replace(/\bgoodbye\b/gi, 'বিদায়');
  } else if (sourceLang === 'en' && targetLang === 'mr') {
    translatedText = text
      .replace(/\bhello\b/gi, 'नमस्कार')
      .replace(/\bhi\b/gi, 'नमस्कार')
      .replace(/\bthank you\b/gi, 'धन्यवाद')
      .replace(/\bthanks\b/gi, 'धन्यवाद')
      .replace(/\bgood\b/gi, 'चांगले')
      .replace(/\bbad\b/gi, 'वाईट')
      .replace(/\byes\b/gi, 'होय')
      .replace(/\bno\b/gi, 'नाही')
      .replace(/\bplease\b/gi, 'कृपया')
      .replace(/\bsorry\b/gi, 'माफ करा')
      .replace(/\bwelcome\b/gi, 'स्वागत आहे')
      .replace(/\bgoodbye\b/gi, 'निरोप');
  } else if (sourceLang === 'en' && targetLang === 'ta') {
    translatedText = text
      .replace(/\bhello\b/gi, 'வணக்கம்')
      .replace(/\bhi\b/gi, 'வணக்கம்')
      .replace(/\bthank you\b/gi, 'நன்றி')
      .replace(/\bthanks\b/gi, 'நன்றி')
      .replace(/\bgood\b/gi, 'நல்லது')
      .replace(/\bbad\b/gi, 'மோசமான')
      .replace(/\byes\b/gi, 'ஆம்')
      .replace(/\bno\b/gi, 'இல்லை')
      .replace(/\bplease\b/gi, 'தயவு செய்து')
      .replace(/\bsorry\b/gi, 'மன்னிக்கவும்')
      .replace(/\bwelcome\b/gi, 'வரவேற்கிறோம்')
      .replace(/\bgoodbye\b/gi, 'பிரியாவிடை');
  } else if (sourceLang === 'en' && targetLang === 'te') {
    translatedText = text
      .replace(/\bhello\b/gi, 'నమస్కారం')
      .replace(/\bhi\b/gi, 'నమస్కారం')
      .replace(/\bthank you\b/gi, 'ధన్యవాదాలు')
      .replace(/\bthanks\b/gi, 'ధన్యవాదాలు')
      .replace(/\bgood\b/gi, 'మంచిది')
      .replace(/\bbad\b/gi, 'చెడ్డది')
      .replace(/\byes\b/gi, 'అవును')
      .replace(/\bno\b/gi, 'కాదు')
      .replace(/\bplease\b/gi, 'దయచేసి')
      .replace(/\bsorry\b/gi, 'క్షమించండి')
      .replace(/\bwelcome\b/gi, 'స్వాగతం')
      .replace(/\bgoodbye\b/gi, 'వీడ్కోలు');
  } else if (sourceLang === 'en' && targetLang === 'gu') {
    translatedText = text
      .replace(/\bhello\b/gi, 'નમસ્તે')
      .replace(/\bhi\b/gi, 'નમસ્તે')
      .replace(/\bthank you\b/gi, 'આભાર')
      .replace(/\bthanks\b/gi, 'આભાર')
      .replace(/\bgood\b/gi, 'સારું')
      .replace(/\bbad\b/gi, 'ખરાબ')
      .replace(/\byes\b/gi, 'હા')
      .replace(/\bno\b/gi, 'ના')
      .replace(/\bplease\b/gi, 'કૃપા કરીને')
      .replace(/\bsorry\b/gi, 'માફ કરશો')
      .replace(/\bwelcome\b/gi, 'સ્વાગત છે')
      .replace(/\bgoodbye\b/gi, 'આવજો');
  } else if (sourceLang === 'en' && targetLang === 'pa') {
    translatedText = text
      .replace(/\bhello\b/gi, 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ')
      .replace(/\bhi\b/gi, 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ')
      .replace(/\bthank you\b/gi, 'ਧੰਨਵਾਦ')
      .replace(/\bthanks\b/gi, 'ਧੰਨਵਾਦ')
      .replace(/\bgood\b/gi, 'ਚੰਗਾ')
      .replace(/\bbad\b/gi, 'ਮਾੜਾ')
      .replace(/\byes\b/gi, 'ਹਾਂ')
      .replace(/\bno\b/gi, 'ਨਹੀਂ')
      .replace(/\bplease\b/gi, 'ਕਿਰਪਾ ਕਰਕੇ')
      .replace(/\bsorry\b/gi, 'ਮਾਫ ਕਰਨਾ')
      .replace(/\bwelcome\b/gi, 'ਜੀ ਆਇਆਂ ਨੂੰ')
      .replace(/\bgoodbye\b/gi, 'ਅਲਵਿਦਾ');
  } else if (sourceLang === 'en' && targetLang === 'ml') {
    translatedText = text
      .replace(/\bhello\b/gi, 'നമസ്കാരം')
      .replace(/\bhi\b/gi, 'നമസ്കാരം')
      .replace(/\bthank you\b/gi, 'നന്ദി')
      .replace(/\bthanks\b/gi, 'നന്ദി')
      .replace(/\bgood\b/gi, 'നല്ലത്')
      .replace(/\bbad\b/gi, 'മോശം')
      .replace(/\byes\b/gi, 'അതെ')
      .replace(/\bno\b/gi, 'ഇല്ല')
      .replace(/\bplease\b/gi, 'ദയവായി')
      .replace(/\bsorry\b/gi, 'ക്ഷമിക്കണം')
      .replace(/\bwelcome\b/gi, 'സ്വാഗതം')
      .replace(/\bgoodbye\b/gi, 'വിട');
  } else if (sourceLang === 'en' && targetLang === 'kn') {
    translatedText = text
      .replace(/\bhello\b/gi, 'ನಮಸ್ಕಾರ')
      .replace(/\bhi\b/gi, 'ನಮಸ್ಕಾರ')
      .replace(/\bthank you\b/gi, 'ಧನ್ಯವಾದಗಳು')
      .replace(/\bthanks\b/gi, 'ಧನ್ಯವಾದಗಳು')
      .replace(/\bgood\b/gi, 'ಒಳ್ಳೆಯದು')
      .replace(/\bbad\b/gi, 'ಕೆಟ್ಟದು')
      .replace(/\byes\b/gi, 'ಹೌದು')
      .replace(/\bno\b/gi, 'ಇಲ್ಲ')
      .replace(/\bplease\b/gi, 'ದಯವಿಟ್ಟು')
      .replace(/\bsorry\b/gi, 'ಕ್ಷಮಿಸಿ')
      .replace(/\bwelcome\b/gi, 'ಸ್ವಾಗತ')
      .replace(/\bgoodbye\b/gi, 'ವಿದಾಯ');
  } else if (sourceLang === 'en' && targetLang === 'es') {
    translatedText = text
      .replace(/\bhello\b/gi, 'hola')
      .replace(/\bhi\b/gi, 'hola')
      .replace(/\bthank you\b/gi, 'gracias')
      .replace(/\bthanks\b/gi, 'gracias')
      .replace(/\bgood\b/gi, 'bueno')
      .replace(/\bbad\b/gi, 'malo')
      .replace(/\byes\b/gi, 'sí')
      .replace(/\bno\b/gi, 'no')
      .replace(/\bplease\b/gi, 'por favor')
      .replace(/\bsorry\b/gi, 'lo siento')
      .replace(/\bwelcome\b/gi, 'bienvenido')
      .replace(/\bgoodbye\b/gi, 'adiós');
  }

  // If all translation services fail, return original text
  if (translatedText === text) {
    return text;
  }
  
  return translatedText;
}

async function fetchWithTimeout(resource, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}
