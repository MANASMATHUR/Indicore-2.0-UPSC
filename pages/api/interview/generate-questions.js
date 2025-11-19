import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/getAuthOptions';
import { callAIWithFallback } from '@/lib/ai-providers';
import { translateText } from '@/pages/api/ai/translate';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { examType = 'UPSC', questionType = 'personality', count = 5, language = 'en' } = req.body;
    const preferences = session.user?.preferences || {};
    const preferredModel = preferences.model || 'sonar-pro';
    const preferredProvider = preferences.provider || 'openai';
    const preferredOpenAIModel = preferences.openAIModel || process.env.OPENAI_MODEL || process.env.OPEN_AI_MODEL || 'gpt-4o-mini';
    const excludedProviders = preferences.excludedProviders || [];

    // Get language name for prompt
    const languageNames = {
      'en': 'English', 'hi': 'Hindi', 'mr': 'Marathi', 'ta': 'Tamil', 'bn': 'Bengali',
      'pa': 'Punjabi', 'gu': 'Gujarati', 'te': 'Telugu', 'ml': 'Malayalam',
      'kn': 'Kannada', 'es': 'Spanish'
    };
    const langName = languageNames[language] || 'English';
    
    const systemPrompt = `You are an expert interview coach specializing in competitive exam interviews (UPSC, PCS, SSC). You excel at creating realistic interview questions that test:

1. **Personality Assessment**: Leadership, ethics, decision-making, values
2. **Current Affairs**: Recent events, government policies, international relations
3. **Situational**: Problem-solving, crisis management, administrative scenarios
4. **Technical**: Subject-specific knowledge for optional subjects

**Question Requirements:**
- Realistic and exam-appropriate
- Open-ended to assess thinking process
- Relevant to the exam type (UPSC/PCS/SSC)
- Progressive difficulty
- Focus on practical application

**IMPORTANT**: Generate all questions, hints, and expected points in English. The system will handle translation to other languages using professional translation services.`;

    const questionTypes = {
      personality: 'personality assessment questions that evaluate leadership, ethics, values, and decision-making abilities',
      current_affairs: 'current affairs questions about recent events, government policies, and national/international developments',
      situational: 'situational questions presenting administrative scenarios and problem-solving challenges',
      technical: 'technical questions related to optional subjects and specialized knowledge'
    };

    const userPrompt = `Generate ${count} ${questionTypes[questionType] || 'interview'} questions for ${examType} interview preparation in English.

Format as JSON array:
[
  {
    "question": "Question text",
    "questionType": "${questionType}",
    "hints": ["Hint 1", "Hint 2"],
    "expectedPoints": ["Point 1", "Point 2"]
  }
]`;

    let questions;
    try {
      // Force OpenAI usage for interview questions
      const aiResult = await callAIWithFallback(
        [{ role: 'user', content: userPrompt }],
        systemPrompt,
        2500,
        0.7,
        {
          model: preferredModel,
          preferredProvider: 'openai', // Force OpenAI
          excludeProviders: ['perplexity', 'claude'], // Exclude other providers
          openAIModel: preferredOpenAIModel
        }
      );
      const aiResponse = aiResult?.content || '';

      try {
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          questions = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON array found');
        }
      } catch (parseError) {
        questions = aiResponse
          .split('\n')
          .filter(line => line.trim() && (line.includes('?') || line.match(/^\d+\./)))
          .slice(0, count)
          .map((q) => ({
            question: q.replace(/^\d+\.\s*/, '').trim(),
            questionType,
            hints: [],
            expectedPoints: []
          }));
      }
    } catch (aiError) {
      console.warn('AI generation failed for interview questions, using fallback set:', aiError?.message);
      questions = null;
    }

    const fallbackQuestionBank = {
      personality: [
        {
          question: 'Tell us about a situation where you had to take a tough decision that went against popular opinion. How did you handle it?',
          hints: ['Discuss context briefly', 'Highlight decision-making framework', 'Share outcome and learnings'],
          expectedPoints: ['Demonstrates leadership courage', 'Shows ethical reasoning', 'Reflects on results']
        },
        {
          question: 'How do you keep yourself motivated during setbacks or long preparation cycles?',
          hints: ['Reference personal strategies', 'Mention support system', 'Connect to exam readiness'],
          expectedPoints: ['Self-awareness', 'Resilience', 'Long-term orientation']
        },
        {
          question: 'What does integrity mean to you in a public service context?',
          hints: ['Define integrity', 'Provide a real or hypothetical example', 'Link to governance'],
          expectedPoints: ['Values clarity', 'Ethical grounding', 'Administrative relevance']
        }
      ],
      current_affairs: [
        {
          question: 'How would you assess the impact of recent monetary policy decisions on inflation and growth?',
          hints: ['Mention latest policy stance', 'Discuss inflation trajectory', 'Balance growth concerns'],
          expectedPoints: ['Knowledge of recent RBI decisions', 'Balanced economic reasoning', 'Awareness of fiscal-monetary coordination']
        },
        {
          question: 'What are the strategic implications of India’s engagement in the Indo-Pacific region?',
          hints: ['Refer to key initiatives', 'Discuss regional partners', 'Highlight challenges'],
          expectedPoints: ['Geostrategic awareness', 'Clarity on foreign policy priorities', 'Understanding of maritime security']
        },
        {
          question: 'Analyse the key provisions and significance of the latest climate-related commitments made by India.',
          hints: ['Mention major targets', 'Discuss implementation challenges', 'Link to development needs'],
          expectedPoints: ['Updated factual knowledge', 'Sustainable development perspective', 'Balanced analysis']
        }
      ],
      situational: [
        {
          question: 'You are a district magistrate and a sudden flood affects multiple villages. Outline your immediate priority actions.',
          hints: ['Life and safety first', 'Coordination with agencies', 'Communication strategy'],
          expectedPoints: ['Crisis management framework', 'Stakeholder coordination', 'Resource prioritisation']
        },
        {
          question: 'An RTI reveals procedural lapses in a government scheme under your charge. How will you address transparency while maintaining morale within the department?',
          hints: ['Acknowledge issue', 'Corrective steps', 'Preventive measures'],
          expectedPoints: ['Accountability', 'Process improvement', 'Team leadership']
        },
        {
          question: 'As a police officer, you receive conflicting orders from political executives and your superior officer. How will you resolve the situation?',
          hints: ['Reference rule of law', 'Seek clarity through hierarchy', 'Document decisions'],
          expectedPoints: ['Adherence to legal procedures', 'Ethical judgement', 'Communication ability']
        }
      ],
      technical: [
        {
          question: 'Explain the significance of federalism in the Indian Constitution with reference to recent Supreme Court judgements.',
          hints: ['Define federal features', 'Cite landmark cases', 'Discuss contemporary relevance'],
          expectedPoints: ['Conceptual clarity', 'Link to current jurisprudence', 'Analytical depth']
        },
        {
          question: 'Differentiate between GDP deflator and CPI. In which situations is one preferred over the other?',
          hints: ['Define both indicators', 'Explain calculation base', 'Give practical use-cases'],
          expectedPoints: ['Economic concepts clarity', 'Understanding of data interpretation', 'Policy relevance']
        },
        {
          question: 'Discuss the role of biotechnology in sustainable agriculture with examples from Indian context.',
          hints: ['Mention key technologies', 'Discuss benefits and concerns', 'Provide policy references'],
          expectedPoints: ['Subject knowledge', 'Awareness of national initiatives', 'Balanced viewpoint']
        }
      ]
    };

    if (!questions || questions.length === 0) {
      const bank = fallbackQuestionBank[questionType] || fallbackQuestionBank.personality;
      const replicated = [];
      for (let i = 0; i < count; i++) {
        replicated.push(bank[i % bank.length]);
      }
      questions = replicated.map((q) => ({
        ...q,
        questionType
      }));
    }

    // Translate questions to target language if not English (using Azure Translator)
    if (language && language !== 'en' && questions && Array.isArray(questions)) {
      try {
        console.log(`Translating ${questions.length} interview questions to ${language} using Azure Translator...`);
        questions = await Promise.all(
          questions.map(async (q) => {
            const translatedQ = { ...q };
            try {
              if (q.question) {
                translatedQ.question = await translateText(q.question, 'en', language, true);
              }
              if (q.hints && Array.isArray(q.hints)) {
                translatedQ.hints = await Promise.all(
                  q.hints.map(async (hint) => {
                    try {
                      return await translateText(hint, 'en', language, true);
                    } catch (e) {
                      return hint;
                    }
                  })
                );
              }
              if (q.expectedPoints && Array.isArray(q.expectedPoints)) {
                translatedQ.expectedPoints = await Promise.all(
                  q.expectedPoints.map(async (point) => {
                    try {
                      return await translateText(point, 'en', language, true);
                    } catch (e) {
                      return point;
                    }
                  })
                );
              }
            } catch (e) {
              console.warn('Failed to translate question:', e.message);
            }
            return translatedQ;
          })
        );
        console.log('Interview questions translation completed successfully');
      } catch (translationError) {
        console.warn('Translation failed, using English content:', translationError.message);
        // Continue with English content if translation fails
      }
    }

    return res.status(200).json({ questions });
  } catch (error) {
    console.error('Error generating interview questions:', error);
    return res.status(500).json({ error: 'Failed to generate questions', details: error.message });
  }
}

