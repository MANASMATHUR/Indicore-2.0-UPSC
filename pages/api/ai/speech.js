export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, language, voice } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    const azureSpeechKey = process.env.AZURE_SPEECH_KEY?.trim();
    const azureSpeechRegion = process.env.AZURE_SPEECH_REGION?.trim();

    if (!azureSpeechKey || !azureSpeechRegion) {
      return res.status(200).json({ 
        success: true, 
        method: 'browser',
        message: 'Using browser speech synthesis',
        config: {
          text: text,
          language: language || 'en-IN',
          voice: getDefaultVoice(language),
          rate: '0.9',
          pitch: '1.0'
        }
      });
    }

    const defaultVoice = getDefaultVoice(language);
    
    if (!defaultVoice) {
      return res.status(200).json({ 
        success: true, 
        method: 'browser',
        message: `No Azure voice available for language: ${language}, using browser fallback`,
        config: {
          text: text,
          language: language,
          voice: null,
          rate: '0.9',
          pitch: '1.0'
        }
      });
    }
    
    // Convert short language code to full language code
    const languageMap = {
      'en': 'en-IN',
      'hi': 'hi-IN',
      'mr': 'mr-IN',
      'ta': 'ta-IN',
      'bn': 'bn-IN',
      'pa': 'pa-IN',
      'gu': 'gu-IN',
      'te': 'te-IN',
      'ml': 'ml-IN',
      'kn': 'kn-IN',
      'es': 'es-ES'
    };
    
    const fullLanguageCode = languageMap[language] || language || 'en-IN';
    
    const speechConfig = {
      text: text,
      language: fullLanguageCode,
      voice: voice || defaultVoice,
      rate: '0.9',
      pitch: '1.0'
    };

    const ssml = generateSSML(speechConfig);

    const azureEndpoint = `https://${azureSpeechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
    
    const azureResponse = await fetch(azureEndpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureSpeechKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        'User-Agent': 'Indicore-AI'
      },
      body: ssml
    });

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text();
      throw new Error(`Azure Speech API error: ${azureResponse.status} ${azureResponse.statusText} - ${errorText}`);
    }

    const audioBuffer = await azureResponse.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');
    
    return res.status(200).json({
      success: true,
      method: 'azure',
      audioData: audioBase64,
      audioFormat: 'audio/mp3',
      config: speechConfig,
      message: 'Azure Speech Services audio generated successfully'
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to process speech request',
      fallback: true,
      message: 'Falling back to browser speech synthesis',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

function getDefaultVoice(language) {
  const voiceMap = {
    'en': 'en-IN-NeerjaNeural',
    'en-IN': 'en-IN-NeerjaNeural',
    'hi': 'hi-IN-SwaraNeural',
    'hi-IN': 'hi-IN-SwaraNeural',
    'mr': 'mr-IN-AarohiNeural',
    'mr-IN': 'mr-IN-AarohiNeural',
    'ta': 'ta-IN-PallaviNeural',
    'ta-IN': 'ta-IN-PallaviNeural',
    'bn': 'bn-IN-TanishaaNeural',
    'bn-IN': 'bn-IN-TanishaaNeural',
    'pa': null,
    'pa-IN': null,
    'gu': 'gu-IN-DhwaniNeural',
    'gu-IN': 'gu-IN-DhwaniNeural',
    'te': 'te-IN-ShrutiNeural',
    'te-IN': 'te-IN-ShrutiNeural',
    'ml': 'ml-IN-SobhanaNeural',
    'ml-IN': 'ml-IN-SobhanaNeural',
    'kn': 'kn-IN-SapnaNeural',
    'kn-IN': 'kn-IN-SapnaNeural',
    'es': 'es-ES-ElviraNeural',
    'es-ES': 'es-ES-ElviraNeural'
  };
  
  return voiceMap[language] || null;
}

function generateSSML(config) {
  // Convert short language code to full language code for SSML
  const languageMap = {
    'en': 'en-IN',
    'hi': 'hi-IN',
    'mr': 'mr-IN',
    'ta': 'ta-IN',
    'bn': 'bn-IN',
    'pa': 'pa-IN',
    'gu': 'gu-IN',
    'te': 'te-IN',
    'ml': 'ml-IN',
    'kn': 'kn-IN',
    'es': 'es-ES'
  };
  
  const fullLanguageCode = languageMap[config.language] || config.language;
  
  // Simple SSML format that works with Azure
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${fullLanguageCode}">
    <voice name="${config.voice}">
      ${escapeXml(config.text)}
    </voice>
  </speak>`.trim();
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

