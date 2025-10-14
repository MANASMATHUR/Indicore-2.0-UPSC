import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, sourceLanguage, targetLanguage } = req.body;

  if (!text || !sourceLanguage || !targetLanguage) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // For now, we'll use a simple translation approach
    // In production, you would integrate with a translation service like Google Translate API
    const translatedText = await translateText(text, sourceLanguage, targetLanguage);
    
    res.status(200).json({ 
      translatedText,
      sourceLanguage,
      targetLanguage,
      originalText: text
    });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
}

async function translateText(text, sourceLang, targetLang) {
  if (sourceLang === targetLang) {
    return text;
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

  // Try LibreTranslate (FREE) first
  try {
    const libreTranslateResponse = await fetch('https://libretranslate.de/translate', {
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
    });

    if (libreTranslateResponse.ok) {
      const data = await libreTranslateResponse.json();
      if (data.translatedText) {
        return data.translatedText;
      }
    }
  } catch (error) {
    console.log('LibreTranslate failed, trying MyMemory...');
  }

  // Try MyMemory API (FREE tier)
  try {
    const myMemoryResponse = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`);
    
    if (myMemoryResponse.ok) {
      const data = await myMemoryResponse.json();
      if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      }
    }
  } catch (error) {
    console.log('MyMemory failed, trying Google Translate...');
  }

  // Try Google Translate API if available
  if (process.env.GOOGLE_TRANSLATE_API_KEY) {
    try {
      const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`, {
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
      });

      if (response.ok) {
        const data = await response.json();
        return data.data.translations[0].translatedText;
      }
    } catch (error) {
      console.error('Google Translate API error:', error);
    }
  }

  // Enhanced fallback: Better translation simulation
  const sourceLangName = languageNames[sourceLang] || sourceLang;
  const targetLangName = languageNames[targetLang] || targetLang;
  
  let translatedText = text;
  
  // Enhanced word mapping for all supported chatbot languages
  if (sourceLang === 'en' && targetLang === 'hi') {
    // English to Hindi
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
    // English to Bengali
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
    // English to Marathi
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
    // English to Tamil
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
    // English to Telugu
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
    // English to Gujarati
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
    // English to Punjabi
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
    // English to Malayalam
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
    // English to Kannada
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
    // English to Spanish
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

  return `[Translated from ${sourceLangName} to ${targetLangName}]\n\n${translatedText}\n\n[Note: This is a demo translation. For real-time translation, the system will automatically use free translation services like LibreTranslate or MyMemory API.]`;
}
