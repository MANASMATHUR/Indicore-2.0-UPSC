export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const azureSpeechKey = process.env.AZURE_SPEECH_KEY?.trim();
    const azureSpeechRegion = process.env.AZURE_SPEECH_REGION?.trim();

    if (!azureSpeechKey || !azureSpeechRegion) {
      return res.status(200).json({ 
        available: false,
        method: 'browser',
        message: 'Azure Speech not configured, using browser recognition'
      });
    }

    // Get Azure Speech token using Token Service
    const tokenUrl = `https://${azureSpeechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureSpeechKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get Azure token: ${tokenResponse.status}`);
    }

    const token = await tokenResponse.text();

    return res.status(200).json({
      available: true,
      method: 'azure',
      token: token,
      region: azureSpeechRegion,
      message: 'Azure Speech token generated successfully'
    });

  } catch (error) {
    console.error('Error getting Azure Speech token:', error);
    return res.status(200).json({ 
      available: false,
      method: 'browser',
      message: 'Azure Speech token unavailable, using browser recognition',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

