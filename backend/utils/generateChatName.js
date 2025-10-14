const axios = require('axios');

async function generateChatName(firstMessage, language = 'en') {
    if (!firstMessage) return 'New Chat';

    try {
        const prompt = `Generate a short, catchy 1-3 word title for this conversation: "${firstMessage}"`;

        const response = await axios.post(
            'https://api.grok.com/v1/generate', // replace with actual Grok endpoint if different
            {
                prompt,
                max_tokens: 10,
                temperature: 0.7,
                language
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data && response.data.text) {
            const title = response.data.text.trim();
            return title.length > 30 ? title.slice(0, 30) + '...' : title;
        }

        return 'New Chat';
    } catch (err) {
        console.error('Error generating chat name with Grok AI:', err);
        return 'New Chat';
    }
}

module.exports = generateChatName;
