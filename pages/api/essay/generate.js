import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import connectToDatabase from '@/lib/mongodb';
import Essay from '@/models/Essay';
import axios from 'axios';
import { translateText } from '@/pages/api/ai/translate';
import { callOpenAIAPI, getOpenAIKey } from '@/lib/ai-providers';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { topic, letter, language = 'en' } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    await connectToDatabase();

    // Get language name for prompt
    const languageNames = {
      'en': 'English', 'hi': 'Hindi', 'mr': 'Marathi', 'ta': 'Tamil', 'bn': 'Bengali',
      'pa': 'Punjabi', 'gu': 'Gujarati', 'te': 'Telugu', 'ml': 'Malayalam',
      'kn': 'Kannada', 'es': 'Spanish'
    };
    const langName = languageNames[language] || 'English';

    // Check if essay already exists
    let essay = await Essay.findOne({ topic: topic.trim(), language: language });

    if (essay) {
      // Update access tracking
      await essay.updateAccess();
      return res.status(200).json({
        essay: essay.content,
        topic: essay.topic,
        letter: essay.letter,
        wordCount: essay.wordCount,
        language: essay.language,
        cached: true,
        generatedAt: essay.generatedAt
      });
    }

    // Generate new essay using OpenAI
    const openAIKey = getOpenAIKey();
    if (!openAIKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const systemPrompt = `You are Indicore, an AI-powered essay writing specialist for competitive exams like UPSC, PCS, and SSC. You excel at writing comprehensive, well-structured essays that are:

1. **Well-Organized**: Clear introduction, body paragraphs with sub-points, and a strong conclusion
2. **Content-Rich**: Include relevant examples, data, facts, and current affairs
3. **Exam-Focused**: Written in a style suitable for competitive exam essay papers
4. **Balanced Perspective**: Present multiple viewpoints and balanced analysis
5. **Academic Language**: Use formal, academic vocabulary appropriate for competitive exams
6. **Comprehensive**: Cover all important aspects of the topic

**Essay Requirements:**
- Length: Approximately 1000-1500 words
- Structure: Introduction, Body (3-4 paragraphs), Conclusion
- Include relevant examples, case studies, and current affairs
- Use formal academic language
- Ensure logical flow and coherence
- Make it suitable for UPSC/PCS/SSC Mains examination

**IMPORTANT**: Generate the essay in English. The system will handle translation to other languages using professional translation services.`;

    const userPrompt = `Write a comprehensive essay on the topic: "${topic}" in English.

**Requirements:**
- Write a complete, well-structured essay suitable for competitive exams (UPSC/PCS/SSC Mains)
- Include introduction, body paragraphs with sub-points, and conclusion
- Add relevant examples, data, and current affairs
- Use formal academic language
- Length: Approximately 1000-1500 words
- Ensure the essay is comprehensive, balanced, and exam-ready

**Essay Topic:** ${topic}

Please provide the complete essay text only, without any additional explanations or metadata.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    let essayText = '';

    try {
      // Use OpenAI for essay generation
      const openAIModel = process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o-mini';
      essayText = await callOpenAIAPI(
        messages,
        openAIModel,
        undefined, // No token limit for OpenAI
        0.7
      );
      essayText = essayText?.trim() || '';
    } catch (error) {
      console.error('OpenAI API error for essay generation:', error.message);
      throw error;
    }

    if (!essayText || essayText.trim().length === 0) {
      throw new Error('AI provider returned an empty response');
    }

    let essayContent = essayText.trim();
    
    // Translate to target language if not English (using Azure Translator)
    if (language && language !== 'en') {
      try {
        console.log(`Translating essay to ${language} using Azure Translator...`);
        essayContent = await translateText(essayContent, 'en', language, true);
        console.log('Essay translation completed successfully');
      } catch (translationError) {
        console.warn('Translation failed, using English content:', translationError.message);
        // Continue with English content if translation fails
      }
    }
    
    const wordCount = essayContent.split(/\s+/).filter(word => word.length > 0).length;

    // Determine letter if not provided
    const essayLetter = letter || topic.charAt(0).toUpperCase();

    // Save essay to database using upsert to handle race conditions
    const essayData = {
      topic: topic.trim(),
      content: essayContent,
      letter: essayLetter,
      wordCount: wordCount,
      language: language,
      essayType: 'general',
      generatedBy: 'openai',
      generatedAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 1
    };

    try {
      essay = await Essay.create(essayData);
    } catch (error) {
      // Handle race condition: if another request created the essay simultaneously
      if (error.code === 11000 && error.keyPattern?.topic) {
        // Essay was created by another request, fetch it instead
        essay = await Essay.findOne({ topic: topic.trim() });
        if (essay) {
          await essay.updateAccess();
          return res.status(200).json({
            essay: essay.content,
            topic: essay.topic,
            letter: essay.letter,
            wordCount: essay.wordCount,
            language: essay.language,
            cached: true,
            generatedAt: essay.generatedAt
          });
        }
      }
      // Re-throw if it's a different error
      throw error;
    }

    return res.status(200).json({
      essay: essayContent,
      topic: essay.topic,
      letter: essay.letter,
      wordCount: essay.wordCount,
      language: essay.language,
      cached: false,
      generatedAt: essay.generatedAt
    });

  } catch (error) {
    console.error('Essay generation error:', error);

    if (error.response) {
      const status = error.response.status;
      let errorMessage = 'An error occurred while generating the essay.';

      if (status === 401) {
        errorMessage = 'API credits exhausted or invalid API key. Please check your OpenAI API key and add credits if needed.';
      } else if (status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (status === 402) {
        errorMessage = 'Insufficient API credits. Please add credits to your OpenAI account to continue using this feature.';
      } else if (status === 403) {
        errorMessage = 'Access denied. Please verify your API key permissions.';
      }

      return res.status(status).json({ 
        error: errorMessage,
        code: status === 401 || status === 402 ? 'API_CREDITS_EXHAUSTED' : 'API_ERROR',
        status
      });
    }

    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}


