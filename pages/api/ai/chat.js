import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { message, model, systemPrompt, language, inputType } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // If input is text-only, skip AI generation
    if (inputType === 'textOnly') {
      return res.status(200).json({ response: null });
    }

    // Prepare system prompt
    let finalSystemPrompt = systemPrompt || 'You are Indicore, an AI-powered exam preparation assistant specialized in PCS, UPSC, and SSC exams. You help students with multilingual study materials, answer writing practice, document evaluation, and regional language support. Provide accurate, detailed, and exam-focused responses that help students prepare effectively for competitive exams.';

    if (language && language !== 'en') {
      const languageNames = {
        hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', bn: 'Bengali',
        pa: 'Punjabi', gu: 'Gujarati', te: 'Telugu', ml: 'Malayalam',
        kn: 'Kannada', es: 'Spanish'
      };

      const langName = languageNames[language] || 'English';
      finalSystemPrompt += ` Your response MUST be entirely in ${langName}. Do not use any other language. Ensure perfect grammar and natural flow in ${langName}.`;
    }

    // Call Perplexity/Sonar API
    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: model || 'sonar-pro',
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: message }
      ],
      // Do not hard-cap tokens; let model decide or use a high ceiling
      max_tokens: 4000,
      temperature: 0.7,
      top_p: 0.9,
      stream: false,
      presence_penalty: 0,
      frequency_penalty: 1
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
      const aiResponse = response.data.choices[0].message.content;
      return res.status(200).json({ response: aiResponse });
    } else {
      throw new Error('Invalid response format from Perplexity API');
    }

  } catch (error) {
    console.error('AI Chat API error:', error);

    if (error.response) {
      const status = error.response.status;
      let errorMessage = 'An error occurred while processing your request.';

      if (status === 401) errorMessage = 'Invalid API key. Please check your Perplexity API key.';
      else if (status === 429) errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      else if (status === 402) errorMessage = 'Insufficient credits. Please add credits to your Perplexity account.';
      else if (status === 403) errorMessage = 'Access denied. Please verify your API key permissions.';

      return res.status(status).json({ error: errorMessage });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
