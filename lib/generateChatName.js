import axios from 'axios';

export default async function generateChatName(firstMessage, language = 'en') {
  if (!firstMessage) return 'New Chat';

  try {
    const prompt = `Generate a short, catchy 1-3 word title for this conversation: "${firstMessage}"`;
    const apiKey = process.env.GROK_API_KEY;
    if (!apiKey) return 'New Chat';

    const response = await axios.post(
      'https://api.grok.com/v1/generate',
      {
        prompt,
        max_tokens: 10,
        temperature: 0.7,
        language
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const title = response?.data?.text?.trim();
    if (!title) return 'New Chat';
    return title.length > 30 ? `${title.slice(0, 30)}...` : title;
  } catch (err) {
    console.error('Grok name generation failed:', err?.response?.data || err?.message || err);
    return 'New Chat';
  }
}


