import 'dotenv/config';
import axios from 'axios';

// Try to load from .env.local if not loaded
import fs from 'fs';
import path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    const envConfig = fs.readFileSync(envLocalPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
}

async function verifyAzure() {
    console.log('--- Azure Speech Credential Verification ---');

    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;

    console.log(`Region: ${region || 'MISSING'}`);
    console.log(`Key: ${key ? 'PRESENT (starts with ' + key.substring(0, 4) + '...)' : 'MISSING'}`);

    if (!key || !region) {
        console.error('❌ Missing credentials. Please check .env.local');
        return;
    }

    try {
        const tokenUrl = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
        console.log(`Attempting to fetch token from: ${tokenUrl}`);

        const response = await axios.post(tokenUrl, null, {
            headers: {
                'Ocp-Apim-Subscription-Key': key,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (response.status === 200) {
            console.log('✅ Success! Azure Speech credentials are valid.');
            console.log('Token received (length):', response.data.length);

            // Verify TTS
            console.log('\n--- Verifying TTS Endpoint ---');
            const ttsUrl = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
            const ssml = `<speak version='1.0' xml:lang='en-US'><voice xml:lang='en-US' xml:gender='Female' name='en-US-AvaMultilingualNeural'>Hello</voice></speak>`;

            try {
                const ttsResponse = await axios.post(ttsUrl, ssml, {
                    headers: {
                        'Ocp-Apim-Subscription-Key': key,
                        'Content-Type': 'application/ssml+xml',
                        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
                        'User-Agent': 'Indicore-Test'
                    },
                    responseType: 'arraybuffer'
                });

                if (ttsResponse.status === 200 && ttsResponse.data.length > 0) {
                    console.log('✅ Success! Azure TTS returned audio data.');
                    console.log('Audio size:', ttsResponse.data.length, 'bytes');
                } else {
                    console.error('❌ TTS Failed or returned empty data');
                }
            } catch (ttsError) {
                console.error('❌ TTS Error:', ttsError.message);
                if (ttsError.response) {
                    console.error('TTS Response Data:', ttsError.response.data.toString());
                }
            }
        } else {
            console.error(`❌ Failed with status: ${response.status}`);
            console.error('Response:', response.data);
        }
    } catch (error) {
        console.error('❌ Error verifying credentials:');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Data: ${error.response.data}`);
        } else {
            console.error(error.message);
        }
    }
}

verifyAzure();
