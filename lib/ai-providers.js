import axios from 'axios';

export async function callGroqAPI(messages, maxTokens = 4000, temperature = 0.7) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-70b-versatile',
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: 0.9,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content;
    }
    throw new Error('Invalid response format from Groq');
  } catch (error) {
    if (error.response?.status === 429) {
      throw new Error('Groq rate limit exceeded. Please try again later.');
    }
    throw error;
  }
}

export async function callGeminiAPI(prompt, systemPrompt, maxTokens = 4000, temperature = 0.7) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  try {
    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\nUser: ${prompt}\nAssistant:`
      : prompt;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: temperature,
          topP: 0.9,
          topK: 40
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      }
    );

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.data.candidates[0].content.parts[0].text;
    }
    throw new Error('Invalid response format from Gemini');
  } catch (error) {
    if (error.response?.status === 429) {
      throw new Error('Gemini rate limit exceeded. Please try again later.');
    }
    throw error;
  }
}

export async function callHuggingFaceAPI(prompt, model = 'meta-llama/Llama-2-7b-chat-hf', maxTokens = 2000) {
  if (!process.env.HUGGINGFACE_API_KEY) {
    throw new Error('HUGGINGFACE_API_KEY not configured');
  }

  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: maxTokens,
          temperature: 0.7,
          return_full_text: false
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    if (response.data?.[0]?.generated_text) {
      return response.data[0].generated_text;
    }
    throw new Error('Invalid response format from Hugging Face');
  } catch (error) {
    if (error.response?.status === 503) {
      throw new Error('Hugging Face model is loading. Please wait a moment and try again.');
    }
    throw error;
  }
}

export async function callOpenRouterAPI(messages, model = 'meta-llama/llama-3.2-3b-instruct:free', maxTokens = 4000, temperature = 0.7) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: model,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.APP_URL || 'https://indicore.ai',
          'X-Title': 'Indicore',
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content;
    }
    throw new Error('Invalid response format from OpenRouter');
  } catch (error) {
    if (error.response?.status === 429) {
      throw new Error('OpenRouter rate limit exceeded. Please try again later.');
    }
    throw error;
  }
}

export async function callDeepSeekAPI(messages, maxTokens = 4000, temperature = 0.7) {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: 0.9
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content;
    }
    throw new Error('Invalid response format from DeepSeek');
  } catch (error) {
    if (error.response?.status === 429) {
      throw new Error('DeepSeek rate limit exceeded. Please try again later.');
    }
    throw error;
  }
}

export async function callAIWithFallback(messages, systemPrompt, maxTokens, temperature = 0.7, options = {}) {
  const { preferredProvider, excludeProviders = [] } = options;
  
  const messageArray = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    ...messages
  ];

  const providers = [
    {
      name: 'groq',
      enabled: !excludeProviders.includes('groq') && process.env.GROQ_API_KEY,
      call: () => callGroqAPI(messageArray, maxTokens, temperature)
    },
    {
      name: 'gemini',
      enabled: !excludeProviders.includes('gemini') && process.env.GEMINI_API_KEY,
      call: () => {
        const userMessage = messages[messages.length - 1]?.content || messages[0]?.content || '';
        return callGeminiAPI(userMessage, systemPrompt, maxTokens, temperature);
      }
    },
    {
      name: 'deepseek',
      enabled: !excludeProviders.includes('deepseek') && process.env.DEEPSEEK_API_KEY,
      call: () => callDeepSeekAPI(messageArray, maxTokens, temperature)
    },
    {
      name: 'openrouter',
      enabled: !excludeProviders.includes('openrouter') && process.env.OPENROUTER_API_KEY,
      call: () => callOpenRouterAPI(messageArray, undefined, maxTokens, temperature)
    },
    {
      name: 'huggingface',
      enabled: !excludeProviders.includes('huggingface') && process.env.HUGGINGFACE_API_KEY,
      call: () => {
        const userMessage = messages[messages.length - 1]?.content || messages[0]?.content || '';
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser: ${userMessage}` : userMessage;
        return callHuggingFaceAPI(fullPrompt, undefined, maxTokens);
      }
    }
  ];

  if (preferredProvider) {
    const preferred = providers.find(p => p.name === preferredProvider);
    if (preferred && preferred.enabled) {
      providers.unshift(providers.splice(providers.indexOf(preferred), 1)[0]);
    }
  }

  const enabledProviders = providers.filter(p => p.enabled);

  if (enabledProviders.length === 0) {
    throw new Error('No AI providers configured. Please set at least one API key.');
  }

  const errors = [];
  for (const provider of enabledProviders) {
    try {
      console.log(`[AI Provider] Trying ${provider.name}...`);
      const result = await provider.call();
      console.log(`[AI Provider] Success with ${provider.name}`);
      return { content: result, provider: provider.name };
    } catch (error) {
      console.warn(`[AI Provider] ${provider.name} failed:`, error.message);
      errors.push({ provider: provider.name, error: error.message });
    }
  }

  throw new Error(`All AI providers failed. Errors: ${errors.map(e => `${e.provider}: ${e.error}`).join('; ')}`);
}

export function getAvailableProviders() {
  const providers = [];
  
  if (process.env.GROQ_API_KEY) providers.push('groq');
  if (process.env.GEMINI_API_KEY) providers.push('gemini');
  if (process.env.DEEPSEEK_API_KEY) providers.push('deepseek');
  if (process.env.OPENROUTER_API_KEY) providers.push('openrouter');
  if (process.env.HUGGINGFACE_API_KEY) providers.push('huggingface');
  if (process.env.PERPLEXITY_API_KEY) providers.push('perplexity');
  
  return providers;
}

