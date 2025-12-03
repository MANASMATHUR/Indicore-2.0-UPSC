// Debug endpoint to check Azure Speech configuration
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const azureSpeechKey = process.env.AZURE_SPEECH_KEY?.trim();
        const azureSpeechRegion = process.env.AZURE_SPEECH_REGION?.trim();

        const hasKey = !!azureSpeechKey && azureSpeechKey.length > 0;
        const hasRegion = !!azureSpeechRegion && azureSpeechRegion.length > 0;

        return res.status(200).json({
            hasAzureSpeechKey: hasKey,
            hasAzureSpeechRegion: hasRegion,
            keyLength: hasKey ? azureSpeechKey.length : 0,
            region: hasRegion ? azureSpeechRegion : null,
            // Don't expose actual keys for security
            keySample: hasKey ? `${azureSpeechKey.substring(0, 4)}...${azureSpeechKey.substring(azureSpeechKey.length - 4)}` : null,
            configured: hasKey && hasRegion,
            message: hasKey && hasRegion
                ? 'Azure Speech credentials are configured correctly'
                : 'Azure Speech credentials are missing or incomplete',
            nodeEnv: process.env.NODE_ENV
        });
    } catch (error) {
        return res.status(500).json({
            error: error.message,
            configured: false
        });
    }
}
