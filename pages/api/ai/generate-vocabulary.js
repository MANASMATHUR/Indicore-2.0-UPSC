import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
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
    const { category, sourceLanguage, targetLanguage, difficulty, count } = req.body;

    if (!category || !sourceLanguage || !targetLanguage) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const categoryFocus = {
      general: 'General Studies, administration, governance, and public service',
      history: 'Indian history, world history, ancient, medieval, and modern periods',
      geography: 'Physical geography, human geography, Indian geography, world geography',
      polity: 'Constitution, governance, political systems, rights, duties, and administration',
      economics: 'Indian economy, economic concepts, development, finance, and trade',
      science: 'Science and technology, innovations, research, and scientific concepts',
      environment: 'Environmental science, ecology, conservation, climate change, and sustainability',
      current_affairs: 'Recent events, contemporary issues, and current developments',
      ethics: 'Ethics, moral philosophy, values, integrity, and ethical decision making',
      international: 'International relations, diplomacy, global affairs, and foreign policy'
    };

    const languageNames = {
      en: 'English', hi: 'Hindi', mr: 'Marathi', ta: 'Tamil', bn: 'Bengali',
      pa: 'Punjabi', gu: 'Gujarati', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada'
    };

    const sourceLangName = languageNames[sourceLanguage];
    const targetLangName = languageNames[targetLanguage];
    const categoryDesc = categoryFocus[category] || 'general studies and administration';

    const systemPrompt = `You are Indicore, an AI-powered vocabulary specialist for competitive exams like PCS, UPSC, and SSC. You excel at creating bilingual vocabulary flashcards for exam preparation.

**Your Task:**
Generate ${count || 10} vocabulary flashcards focused on ${categoryDesc} for competitive exam preparation.

**Requirements:**
- Source Language: ${sourceLangName}
- Target Language: ${targetLangName}
- Difficulty Level: ${difficulty}
- Category Focus: ${categoryDesc}

**Flashcard Format:**
For each vocabulary item, provide:
1. **term**: The word/phrase in ${sourceLangName}
2. **pronunciation**: Phonetic pronunciation guide
3. **definition**: Clear, exam-relevant definition in ${sourceLangName}
4. **translation**: Accurate translation in ${targetLangName}
5. **example**: Practical example sentence using the term

**Response Format:**
Return a JSON array of flashcards with the exact structure:
[
  {
    "term": "word in source language",
    "pronunciation": "phonetic guide",
    "definition": "clear definition",
    "translation": "translation in target language",
    "example": "example sentence"
  }
]

**Quality Guidelines:**
- **Exam-Specific Terms**: Prioritize vocabulary that appears frequently in UPSC, PCS, and SSC exam papers
- **Answer Writing Focus**: Include terms that enhance essay writing, answer writing, and descriptive answers
- **Precision**: Definitions must be accurate, concise, and exam-relevant (not generic dictionary definitions)
- **Practical Examples**: Provide examples that demonstrate usage in exam context (e.g., "The concept of federalism is crucial in understanding Indian polity")
- **Difficulty Alignment**: 
  - Beginner: Basic administrative and governance terms
  - Intermediate: Terms from GS papers, polity, economics
  - Advanced: Specialized terms from optional subjects, complex concepts
- **Bilingual Accuracy**: Ensure translations are accurate and commonly used in exam contexts
- **Category Relevance**: Terms must be directly relevant to the selected category (e.g., History terms for history category)
- **Reproducibility**: Focus on terms that can be reused across multiple questions in the same theme

**Exam Context Examples:**
- For Polity: Terms like "judicial review", "constitutional morality", "cooperative federalism"
- For Economics: Terms like "fiscal deficit", "inclusive growth", "sustainable development"
- For History: Terms like "renaissance", "nationalism", "decolonization"
- For Geography: Terms like "biodiversity", "sustainable development", "climate resilience"`;

    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Generate ${count || 10} vocabulary flashcards for ${categoryDesc} with ${sourceLangName} to ${targetLangName} translation. Difficulty: ${difficulty}. Return as JSON array.`
        }
      ],
      max_tokens: 3000,
      temperature: 0.3, // Lower temperature for more consistent vocabulary
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
      const content = response.data.choices[0].message.content;
      
      let flashcards;
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          flashcards = JSON.parse(jsonMatch[0]);
        } else {
          flashcards = JSON.parse(content);
        }
      } catch (parseError) {
        flashcards = generateFallbackFlashcards(category, sourceLanguage, targetLanguage, count || 10);
      }
      
      return res.status(200).json({ 
        flashcards,
        category,
        sourceLanguage,
        targetLanguage,
        difficulty,
        generatedAt: new Date().toISOString()
      });
    } else {
      throw new Error('Invalid response format from Perplexity API');
    }

  } catch (error) {

    if (error.response) {
      const status = error.response.status;
      let errorMessage = 'An error occurred while generating vocabulary.';

      if (status === 401) {
        errorMessage = 'API credits exhausted or invalid API key. Please check your Perplexity API key and add credits if needed.';
      } else if (status === 429) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (status === 402) {
        errorMessage = 'Insufficient API credits. Please add credits to your Perplexity account to continue using this feature.';
      } else if (status === 403) {
        errorMessage = 'Access denied. Please verify your API key permissions.';
      }

      return res.status(status).json({ 
        error: errorMessage,
        code: status === 401 || status === 402 ? 'API_CREDITS_EXHAUSTED' : 'API_ERROR',
        status
      });
    }

    const fallbackFlashcards = generateFallbackFlashcards(
      req.body.category || 'general',
      req.body.sourceLanguage || 'en',
      req.body.targetLanguage || 'hi',
      req.body.count || 10
    );

    return res.status(200).json({ 
      flashcards: fallbackFlashcards,
      category: req.body.category || 'general',
      sourceLanguage: req.body.sourceLanguage || 'en',
      targetLanguage: req.body.targetLanguage || 'hi',
      difficulty: req.body.difficulty || 'intermediate',
      generatedAt: new Date().toISOString()
    });
  }
}

function generateFallbackFlashcards(category, sourceLang, targetLang, count) {
  const sampleTerms = {
    general: [
      { term: 'Governance', definition: 'The way in which a country or organization is controlled and managed', translation: 'शासन' },
      { term: 'Administration', definition: 'The process of managing and organizing public affairs', translation: 'प्रशासन' },
      { term: 'Bureaucracy', definition: 'A system of government in which most important decisions are taken by state officials', translation: 'नौकरशाही' },
      { term: 'Democracy', definition: 'A system of government by the whole population through elected representatives', translation: 'लोकतंत्र' },
      { term: 'Constitution', definition: 'A body of fundamental principles according to which a state is governed', translation: 'संविधान' }
    ],
    history: [
      { term: 'Independence', definition: 'The fact or state of being independent', translation: 'स्वतंत्रता' },
      { term: 'Revolution', definition: 'A forcible overthrow of a government or social order', translation: 'क्रांति' },
      { term: 'Empire', definition: 'An extensive group of states under a single supreme authority', translation: 'साम्राज्य' },
      { term: 'Civilization', definition: 'The stage of human social development and organization', translation: 'सभ्यता' },
      { term: 'Colonization', definition: 'The action of establishing control over indigenous people', translation: 'उपनिवेशीकरण' }
    ],
    geography: [
      { term: 'Ecosystem', definition: 'A biological community of interacting organisms and their environment', translation: 'पारिस्थितिकी तंत्र' },
      { term: 'Biodiversity', definition: 'The variety of life in the world or in a particular habitat', translation: 'जैव विविधता' },
      { term: 'Climate', definition: 'The weather conditions prevailing in an area over a long period', translation: 'जलवायु' },
      { term: 'Topography', definition: 'The arrangement of physical features of an area', translation: 'स्थलाकृति' },
      { term: 'Sustainability', definition: 'The ability to maintain ecological balance', translation: 'सतत विकास' }
    ]
  };

  const terms = sampleTerms[category] || sampleTerms.general;
  const flashcards = [];

  for (let i = 0; i < Math.min(count, terms.length); i++) {
    const term = terms[i];
    flashcards.push({
      term: term.term,
      pronunciation: `/${term.term.toLowerCase()}/`,
      definition: term.definition,
      translation: term.translation,
      example: `The concept of ${term.term.toLowerCase()} is important in competitive exams.`
    });
  }

  return flashcards;
}

