import axios from 'axios';
import { recordModelMetric } from './metrics';

const OPENAI_DEFAULT_MODEL = process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o';
const OPENAI_MAX_TOKENS = parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 64000;

export function getOpenAIKey() {
  return process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
}

export async function callOpenAIAPI(messages, model = OPENAI_DEFAULT_MODEL, maxTokens, temperature = 0.7) {
  // Fallback alias: OpenAI doesn't officially support 'gpt-5.1' yet, but users may have selected it.
  // We map it to 'gpt-4o' to ensure the request succeeds.
  const safeModel = (model === 'gpt-5.1' || model === 'gpt-5') ? 'gpt-4o' : model;

  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured (set OPENAI_API_KEY or OPEN_AI_KEY)');
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('OpenAI API requires at least one message');
  }

  const startedAt = Date.now();
  try {
    const safeMaxTokens = typeof maxTokens === 'number' && maxTokens > 0
      ? Math.min(maxTokens, OPENAI_MAX_TOKENS)
      : null;
    const payload = {
      model: safeModel,
      messages,
      temperature,
      stream: false
    };

    if (safeMaxTokens && typeof safeMaxTokens === 'number') {
      payload.max_tokens = safeMaxTokens;
    }

    // DEBUG LOGGING
    console.log('[OpenAI Debug] URL:', 'https://api.openai.com/v1/chat/completions');
    console.log('[OpenAI Debug] Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      const usage = response.data.usage || {};
      recordModelMetric({
        provider: 'openai',
        model: model, // Log the requested model name (e.g. gpt-5.1) even if backed by gpt-4o
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || null,
        durationMs: Date.now() - startedAt
      });
      return response.data.choices[0].message.content;
    }
    throw new Error('Invalid response format from OpenAI');
  } catch (error) {
    recordModelMetric({
      provider: 'openai',
      model,
      durationMs: Date.now() - startedAt,
      error: error.message
    });
    if (error.response?.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please try again later.');
    }
    throw error;
  }
}

export async function callGroqAPI(messages, maxTokens = 4000, temperature = 0.7) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }

  const startedAt = Date.now();
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
      recordModelMetric({
        provider: 'groq',
        model: 'llama-3.1-70b-versatile',
        durationMs: Date.now() - startedAt
      });
      return response.data.choices[0].message.content;
    }
    throw new Error('Invalid response format from Groq');
  } catch (error) {
    recordModelMetric({
      provider: 'groq',
      model: 'llama-3.1-70b-versatile',
      durationMs: Date.now() - startedAt,
      error: error.message
    });
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

  const startedAt = Date.now();
  try {
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\nUser: ${prompt}\nAssistant:`
      : prompt;

    const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    console.log('[Gemini Debug] URL:', geminiUrl);

    const response = await axios.post(
      geminiUrl,
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
      recordModelMetric({
        provider: 'gemini',
        model: geminiModel,
        durationMs: Date.now() - startedAt
      });
      return response.data.candidates[0].content.parts[0].text;
    }
    throw new Error('Invalid response format from Gemini');
  } catch (error) {
    recordModelMetric({
      provider: 'gemini',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest',
      durationMs: Date.now() - startedAt,
      error: error.message
    });
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

  const startedAt = Date.now();
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
      recordModelMetric({
        provider: 'huggingface',
        model,
        durationMs: Date.now() - startedAt
      });
      return response.data[0].generated_text;
    }
    throw new Error('Invalid response format from Hugging Face');
  } catch (error) {
    recordModelMetric({
      provider: 'huggingface',
      model,
      durationMs: Date.now() - startedAt,
      error: error.message
    });
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

  const startedAt = Date.now();
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
      recordModelMetric({
        provider: 'openrouter',
        model,
        durationMs: Date.now() - startedAt
      });
      return response.data.choices[0].message.content;
    }
    throw new Error('Invalid response format from OpenRouter');
  } catch (error) {
    recordModelMetric({
      provider: 'openrouter',
      model,
      durationMs: Date.now() - startedAt,
      error: error.message
    });
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

  const startedAt = Date.now();
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
      recordModelMetric({
        provider: 'deepseek',
        model: 'deepseek-chat',
        durationMs: Date.now() - startedAt
      });
      return response.data.choices[0].message.content;
    }
    throw new Error('Invalid response format from DeepSeek');
  } catch (error) {
    recordModelMetric({
      provider: 'deepseek',
      model: 'deepseek-chat',
      durationMs: Date.now() - startedAt,
      error: error.message
    });
    if (error.response?.status === 429) {
      throw new Error('DeepSeek rate limit exceeded. Please try again later.');
    }
    throw error;
  }
}

export async function callPerplexityAPI(messages, model = 'llama-3.1-sonar-large-128k-online', maxTokens = 4000, temperature = 0.7) {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  const startedAt = Date.now();
  try {
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        top_p: 0.9,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 90000 // Increased timeout for deep research models
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      recordModelMetric({
        provider: 'perplexity',
        model,
        durationMs: Date.now() - startedAt
      });
      return response.data.choices[0].message.content;
    }
    throw new Error('Invalid response format from Perplexity');
  } catch (error) {
    recordModelMetric({
      provider: 'perplexity',
      model,
      durationMs: Date.now() - startedAt,
      error: error.message
    });
    console.error('[Perplexity Error] Details:', error.response?.data || error.message);
    if (error.response?.status === 429) {
      throw new Error('Perplexity rate limit exceeded. Please try again later.');
    }

    throw error;
  }
}

export async function callAIWithFallback(messages, systemPrompt, maxTokens, temperature = 0.7, options = {}) {
  const {
    preferredProvider,
    excludeProviders = [],
    model = 'llama-3.1-sonar-large-128k-online',
    useLongContextModel = false,
    openAIModel
  } = options;

  // For OpenAI: undefined means no limit (uses full context window)
  // For other providers: use provided maxTokens or default to 2000
  const resolvedMaxTokens = typeof maxTokens === 'number' && maxTokens > 0 ? maxTokens : (maxTokens === undefined && preferredProvider === 'openai' ? undefined : 2000);
  const normalizedMessages = Array.isArray(messages) ? messages : [];
  const messageArray = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    ...normalizedMessages
  ];

  const requestedOpenAIModel = openAIModel || OPENAI_DEFAULT_MODEL;

  const providers = [
    {
      name: 'openai',
      enabled: !excludeProviders.includes('openai') && getOpenAIKey(),
      call: () => callOpenAIAPI(messageArray, requestedOpenAIModel, maxTokens === undefined ? undefined : resolvedMaxTokens, temperature)
    },
    {
      name: 'perplexity',
      enabled: !excludeProviders.includes('perplexity') && process.env.PERPLEXITY_API_KEY,
      call: () => callPerplexityAPI(messageArray, model, resolvedMaxTokens, temperature)
    },
    {
      name: 'groq',
      enabled: !excludeProviders.includes('groq') && process.env.GROQ_API_KEY,
      call: () => callGroqAPI(messageArray, resolvedMaxTokens, temperature)
    },
    {
      name: 'gemini',
      enabled: !excludeProviders.includes('gemini') && process.env.GEMINI_API_KEY,
      call: () => {
        const userMessage = normalizedMessages[normalizedMessages.length - 1]?.content || normalizedMessages[0]?.content || '';
        return callGeminiAPI(userMessage, systemPrompt, resolvedMaxTokens, temperature);
      }
    },
    {
      name: 'deepseek',
      enabled: !excludeProviders.includes('deepseek') && process.env.DEEPSEEK_API_KEY,
      call: () => callDeepSeekAPI(messageArray, resolvedMaxTokens, temperature)
    },
    {
      name: 'openrouter',
      enabled: !excludeProviders.includes('openrouter') && process.env.OPENROUTER_API_KEY,
      call: () => callOpenRouterAPI(messageArray, undefined, resolvedMaxTokens, temperature)
    },
    {
      name: 'huggingface',
      enabled: !excludeProviders.includes('huggingface') && process.env.HUGGINGFACE_API_KEY,
      call: () => {
        const userMessage = normalizedMessages[normalizedMessages.length - 1]?.content || normalizedMessages[0]?.content || '';
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser: ${userMessage}` : userMessage;
        return callHuggingFaceAPI(fullPrompt, undefined, resolvedMaxTokens);
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
      const result = await provider.call();
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

  if (getOpenAIKey()) providers.push('openai');
  if (process.env.GROQ_API_KEY) providers.push('groq');
  if (process.env.GEMINI_API_KEY) providers.push('gemini');
  if (process.env.DEEPSEEK_API_KEY) providers.push('deepseek');
  if (process.env.OPENROUTER_API_KEY) providers.push('openrouter');
  if (process.env.HUGGINGFACE_API_KEY) providers.push('huggingface');
  if (process.env.PERPLEXITY_API_KEY) providers.push('perplexity');

  return providers;
}

