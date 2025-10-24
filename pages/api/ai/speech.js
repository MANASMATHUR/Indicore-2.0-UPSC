// Speech API for text-to-speech functionality

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, language, voice } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    // Check if Azure Speech Services are configured
    const azureSpeechKey = process.env.AZURE_SPEECH_KEY;
    const azureSpeechRegion = process.env.AZURE_SPEECH_REGION;

    if (!azureSpeechKey || !azureSpeechRegion) {
      // Fallback to browser speech synthesis
      return res.status(200).json({ 
        success: true, 
        method: 'browser',
        message: 'Azure Speech Services not configured, using browser fallback',
        config: {
          text: text,
          language: language || 'en-IN',
          voice: getDefaultVoice(language),
          rate: '0.9',
          pitch: '1.0'
        }
      });
    }

    // Azure Speech Services implementation
    const defaultVoice = getDefaultVoice(language);
    
    // If no voice is available for this language, return browser fallback
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
    
    const speechConfig = {
      text: text,
      language: language || 'en-IN',
      voice: voice || defaultVoice,
      rate: '0.9',
      pitch: '1.0'
    };

    // Generate SSML for Azure Speech Services
    const ssml = generateSSML(speechConfig);

    // Call Azure Speech Services REST API
    console.log('Calling Azure Speech Services with:', {
      region: azureSpeechRegion,
      voice: speechConfig.voice,
      language: speechConfig.language,
      textLength: text.length
    });

    const azureResponse = await fetch(`https://${azureSpeechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
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
      console.error('Azure Speech API error:', {
        status: azureResponse.status,
        statusText: azureResponse.statusText,
        error: errorText
      });
      throw new Error(`Azure Speech API error: ${azureResponse.status} ${azureResponse.statusText} - ${errorText}`);
    }

    // Get the audio data
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
      message: 'Falling back to browser speech synthesis'
    });
  }
}

function getDefaultVoice(language) {
  const voiceMap = {
    'en': 'en-IN-NeerjaNeural',
    'hi': 'hi-IN-SwaraNeural',
    'mr': 'mr-IN-AarohiNeural',
    'ta': 'ta-IN-PallaviNeural',
    'bn': 'bn-IN-TanishaaNeural',
    'pa': 'pa-IN-MeharNeural',
    'gu': 'gu-IN-DhwaniNeural',
    'te': 'te-IN-ShrutiNeural',
    'ml': 'ml-IN-SobhanaNeural',
    'kn': 'kn-IN-SapnaNeural',
    'es': 'es-ES-ElviraNeural'
  };
  
  // Return the mapped voice or null if not found (no English fallback)
  return voiceMap[language] || null;
}

function generateSSML(config) {
  return `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${config.language}">
      <voice name="${config.voice}">
        <prosody rate="${config.rate}" pitch="${config.pitch}">
          ${escapeXml(config.text)}
        </prosody>
      </voice>
    </speak>
  `.trim();
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
